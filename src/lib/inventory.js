import Product from '@/models/Product';
import {
  findSelectedVariantOptions,
  hasVariantManagedStock,
  optionHasOwnStock,
} from '@/lib/stock';

const validObjectId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || ''));

export class InventoryError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = 'InventoryError';
    this.status = status;
  }
}

const productIdForItem = (item) => String(item?.product || item?.productId || '');

const quantityForItem = (item) => {
  const quantity = Number(item?.quantity || 1);
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
};

function addRequest(grouped, request) {
  const key = request.type === 'variant'
    ? `${request.productId}:variant:${request.variantName}:${request.optionLabel}`
    : `${request.productId}:product`;
  const existing = grouped.get(key);
  if (existing) {
    existing.quantity += request.quantity;
    existing.items.push(...request.items);
    return;
  }
  grouped.set(key, { ...request, items: [...request.items] });
}

function resolveStockRequestsForItem(item, product) {
  if (!product) throw new InventoryError(`${item?.title || 'Product'} is no longer available`, 404);
  if (product.isActive === false) throw new InventoryError(`${product.title || item?.title || 'Product'} is not available for purchase`);

  const quantity = quantityForItem(item);
  const variantSelections = findSelectedVariantOptions(product, item?.variant);

  for (const { option } of variantSelections) {
    if (option?.inStock === false) {
      throw new InventoryError(`${product.title}: ${option.label} is sold out`);
    }
  }

  const variantStockRequests = variantSelections
    .filter(({ option }) => optionHasOwnStock(option))
    .map(({ variant, option }) => ({
      type: 'variant',
      productId: String(product._id),
      title: product.title || item?.title || 'Product',
      variantName: variant.name,
      optionLabel: option.label,
      available: Math.max(0, Number(option.stock || 0)),
      quantity,
      items: [item],
    }));

  if (variantStockRequests.length > 0) return variantStockRequests;

  if (hasVariantManagedStock(product)) {
    throw new InventoryError(`Please select an available variant for ${product.title || item?.title || 'this product'}`);
  }

  return [{
    type: 'product',
    productId: String(product._id),
    title: product.title || item?.title || 'Product',
    available: Math.max(0, Number(product.stock || 0)),
    quantity,
    items: [item],
  }];
}

export function getGroupedStockRequests(items = [], productsById = {}) {
  const grouped = new Map();
  for (const item of items) {
    const productId = productIdForItem(item);
    const product = productsById[productId];
    const requests = resolveStockRequestsForItem(item, product);
    requests.forEach((request) => addRequest(grouped, request));
  }
  return [...grouped.values()];
}

export function assertStockAvailable(requests = []) {
  for (const request of requests) {
    if (request.available < request.quantity) {
      const variantLabel = request.type === 'variant' ? ` (${request.variantName}: ${request.optionLabel})` : '';
      throw new InventoryError(`Only ${request.available} left for ${request.title}${variantLabel}`);
    }
  }
}

export async function loadProductsByOrderItems(items = []) {
  const productIds = [...new Set(items.map(productIdForItem).filter(validObjectId))];
  const products = await Product.find({ _id: { $in: productIds } }).select('title stock variants delivery isActive').lean();
  return Object.fromEntries(products.map((product) => [String(product._id), product]));
}

async function restoreInventory(applied = []) {
  for (const request of applied.reverse()) {
    if (request.type === 'variant') {
      await Product.updateOne(
        { _id: request.productId },
        {
          $inc: { 'variants.$[variant].options.$[option].stock': request.quantity },
          $set: { 'variants.$[variant].options.$[option].inStock': true },
        },
        {
          arrayFilters: [
            { 'variant.name': request.variantName },
            { 'option.label': request.optionLabel },
          ],
        }
      );
    } else {
      await Product.updateOne({ _id: request.productId }, { $inc: { stock: request.quantity } });
    }
  }
}

export async function deductOrderInventory(items = []) {
  const productsById = await loadProductsByOrderItems(items);
  const requests = getGroupedStockRequests(items, productsById);
  assertStockAvailable(requests);

  const applied = [];
  try {
    for (const request of requests) {
      let result;
      if (request.type === 'variant') {
        result = await Product.updateOne(
          { _id: request.productId },
          { $inc: { 'variants.$[variant].options.$[option].stock': -request.quantity } },
          {
            arrayFilters: [
              { 'variant.name': request.variantName },
              {
                'option.label': request.optionLabel,
                'option.inStock': { $ne: false },
                'option.stock': { $gte: request.quantity },
              },
            ],
          }
        );
        if (result.modifiedCount !== 1) throw new InventoryError(`Insufficient stock for ${request.title} (${request.variantName}: ${request.optionLabel})`);
        await Product.updateOne(
          { _id: request.productId },
          { $set: { 'variants.$[variant].options.$[option].inStock': false } },
          {
            arrayFilters: [
              { 'variant.name': request.variantName },
              { 'option.label': request.optionLabel, 'option.stock': { $lte: 0 } },
            ],
          }
        );
      } else {
        result = await Product.updateOne(
          { _id: request.productId, stock: { $gte: request.quantity } },
          { $inc: { stock: -request.quantity } }
        );
        if (result.modifiedCount !== 1) throw new InventoryError(`Insufficient stock for ${request.title}`);
      }
      applied.push(request);
    }
  } catch (error) {
    await restoreInventory(applied);
    throw error;
  }

  return requests;
}


'use client';

import { useEffect, useMemo } from 'react';
import AdminWebsitePhotoSlot from '@/components/admin/AdminWebsitePhotoSlot';
import PhotoUploadCard from '@/components/product/PhotoUploadCard';
import { sanitizeIntegerInput } from '@/lib/sanitizeNumericInput';
import {
  buildAdditionalVariantSlots,
  buildCatalogSelectCustomizationPlan,
  listUniqueWebsiteSizes,
  resolveWebsiteSizeConfig,
  mergeSlotsPreserveUploads,
  getTextCustomFields,
  getCollageTemplates,
} from '@/lib/websiteProductPhotoConfig';
import { COMBO_SOURCE_PRODUCT_TITLE_RX } from '@/lib/customizedCombo';

const fieldClass = 'mt-1 w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base sm:text-sm';
const labelClass = 'block text-sm font-semibold text-gray-900';

/** Master size catalog: Personalized Single Photo Frame (not the Select Product choice). */
function resolveSizeCatalogProduct(sizeCatalogProduct, products = []) {
  if (sizeCatalogProduct?._id) return sizeCatalogProduct;
  const match = (products || []).find((p) => COMBO_SOURCE_PRODUCT_TITLE_RX.test(String(p?.title || '')));
  return match || null;
}

function UniqueSizeSelect({
  value,
  onChange,
  sizes,
  emptyLabel = 'Select website size',
  className = fieldClass,
}) {
  return (
    <select value={value} onChange={onChange} className={className}>
      <option value="">{emptyLabel}</option>
      {(sizes || []).map((size) => (
        <option key={size.sizeKey} value={size.sizeKey}>
          {size.sizeLabel}
        </option>
      ))}
    </select>
  );
}

function filesToLocalPhotos(fileList) {
  return Array.from(fileList || []).filter(Boolean).map((file) => ({
    file,
    previewUrl: URL.createObjectURL(file),
    name: file.name,
  }));
}

function SlotGrid({ slots, excludedKeys = [], onChangeSlot, onReference, onExclude, onRestore, allowExclude }) {
  const visible = slots.filter((slot) => !excludedKeys.includes(slot.slotKey));
  const excluded = slots.filter((slot) => excludedKeys.includes(slot.slotKey));
  return (
    <div className="space-y-3">
      {visible.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((slot) => {
            const index = slots.findIndex((s) => s.slotKey === slot.slotKey);
            return (
              <div key={slot.slotKey} className="space-y-1">
                <AdminWebsitePhotoSlot
                  label={slot.label}
                  sizeLabel={slot.sizeLabel}
                  frameImage={slot.frameImage}
                  instructions={slot.instructions}
                  required={slot.required !== false}
                  allowPreview={slot.allowPreview !== false}
                  area={slot.area || null}
                  extraLabel={slot.variantLabel || ''}
                  value={slot.photo || null}
                  referenceValue={slot.reference || null}
                  onChange={(photo) => onChangeSlot(index, photo)}
                  onReferenceChange={(reference) => onReference(index, reference)}
                />
                {allowExclude ? (
                  <button
                    type="button"
                    className="min-h-[40px] text-xs font-semibold text-amber-800"
                    onClick={() => onExclude(slot.slotKey)}
                  >
                    Exclude for this order only
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {excluded.length ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 p-3 space-y-2">
          <p className="text-xs font-bold text-amber-900">Excluded for this WhatsApp order (website product unchanged)</p>
          {excluded.map((slot) => (
            <div key={slot.slotKey} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-gray-700">{slot.label}</span>
              <button
                type="button"
                className="min-h-[36px] font-semibold text-emerald-800"
                onClick={() => onRestore(slot.slotKey)}
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CollageUploadSection({
  templates,
  uploads,
  onUploadsChange,
  excludedKeys = [],
  onExclude,
  onRestore,
  allowExclude = true,
}) {
  if (!templates?.length) return null;
  const active = templates.filter((t) => !excludedKeys.includes(t.groupKey || `collage:${t.label}`));
  const excluded = templates.filter((t) => excludedKeys.includes(t.groupKey || `collage:${t.label}`));

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-sky-950">Collage uploads (from website product)</p>
      {active.map((template) => {
        const label = template.label;
        const groupKey = template.groupKey || `collage:${label}`;
        const photos = uploads?.[label] || [];
        const min = Math.max(0, Number(template.minImages || 0));
        const max = Math.max(min, Number(template.maxImages || min || 0));
        const belowMin = photos.length < min;
        return (
          <div
            key={groupKey}
            className={`rounded-xl border bg-white p-3 space-y-2 ${belowMin ? 'border-red-300' : 'border-sky-100'}`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 break-words">{label}</p>
                <p className="text-[11px] text-gray-500">Upload between {min} and {max} images.</p>
                {template.instructions ? (
                  <p className="mt-1 text-[11px] text-primary-700 break-words">{template.instructions}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${belowMin ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
                  {photos.length}/{min}-{max}
                </span>
                {allowExclude ? (
                  <button
                    type="button"
                    className="min-h-[40px] text-xs font-semibold text-amber-800"
                    onClick={() => onExclude?.(groupKey)}
                  >
                    Exclude for this order only
                  </button>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2">
              {photos.map((photo, idx) => (
                <PhotoUploadCard
                  key={`${label}-${idx}-${photo.previewUrl || photo.name || idx}`}
                  label={`${label} ${idx + 1}`}
                  photoUrl={photo.previewUrl || photo.url || ''}
                  onUpload={(files) => {
                    const next = filesToLocalPhotos(files);
                    if (!next[0]) return;
                    const list = [...photos];
                    if (list[idx]?.previewUrl?.startsWith?.('blob:')) {
                      try { URL.revokeObjectURL(list[idx].previewUrl); } catch { /* ignore */ }
                    }
                    list[idx] = next[0];
                    onUploadsChange({ ...uploads, [label]: list });
                  }}
                  onRemove={() => {
                    const list = photos.filter((_, i) => i !== idx);
                    if (photo.previewUrl?.startsWith?.('blob:')) {
                      try { URL.revokeObjectURL(photo.previewUrl); } catch { /* ignore */ }
                    }
                    onUploadsChange({ ...uploads, [label]: list });
                  }}
                />
              ))}
              {photos.length < max ? (
                <PhotoUploadCard
                  label={`${label} ${photos.length + 1}`}
                  required={belowMin}
                  missingRequired={belowMin}
                  multiple
                  onUpload={(files) => {
                    const room = Math.max(0, max - photos.length);
                    const next = filesToLocalPhotos(files).slice(0, room);
                    if (!next.length) return;
                    onUploadsChange({ ...uploads, [label]: [...photos, ...next] });
                  }}
                />
              ) : null}
            </div>
          </div>
        );
      })}
      {excluded.length ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 p-3 space-y-2">
          <p className="text-xs font-bold text-amber-900">Excluded collage groups (this order only)</p>
          {excluded.map((template) => {
            const groupKey = template.groupKey || `collage:${template.label}`;
            return (
              <div key={groupKey} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-gray-700">{template.label}</span>
                <button type="button" className="min-h-[36px] font-semibold text-emerald-800" onClick={() => onRestore?.(groupKey)}>
                  Restore
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function TextCustomFieldsBlock({ fields, values, onChange }) {
  if (!fields?.length) return null;
  return (
    <div className="space-y-2 rounded-xl border border-primary-50 bg-primary-50/30 p-3">
      <p className="text-xs font-bold text-gray-800">Product custom fields</p>
      {fields.map((field) => (
        <label key={field.label} className={labelClass}>
          {field.label}{field.required ? ' *' : ''}
          {field.type === 'textarea' ? (
            <textarea
              rows={2}
              value={values?.[field.label] || ''}
              onChange={(e) => onChange({ ...(values || {}), [field.label]: e.target.value })}
              className={`${fieldClass} font-normal`}
            />
          ) : (
            <input
              value={values?.[field.label] || ''}
              onChange={(e) => onChange({ ...(values || {}), [field.label]: e.target.value })}
              className={`${fieldClass} font-normal`}
            />
          )}
        </label>
      ))}
    </div>
  );
}

export function newCatalogProductRow(seed = {}) {
  return {
    rowId: seed.rowId || `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: seed.productId || '',
    selectedSizeKey: seed.selectedSizeKey || '',
    productOptionValue: seed.productOptionValue || '',
    quantity: seed.quantity || '1',
    customFieldValues: seed.customFieldValues || {},
    photoSlots: seed.photoSlots || [],
    excludedDefaultKeys: seed.excludedDefaultKeys || [],
    collageUploads: seed.collageUploads || {},
    excludedCollageKeys: seed.excludedCollageKeys || [],
    orderVariantValue: seed.orderVariantValue || '',
    orderVariantId: seed.orderVariantId || '',
    sizeLabel: seed.sizeLabel || '',
    catalogSizeChoice: seed.catalogSizeChoice || '',
    nonSizeOptionCount: seed.nonSizeOptionCount || 0,
    requiresSize: seed.requiresSize === true,
    collageTemplates: seed.collageTemplates || [],
  };
}

function CatalogProductRow({
  row,
  index,
  products,
  sizeSourceProduct,
  uniqueSizes,
  uniqueSizesPlan,
  onChange,
  onRemove,
  canRemove,
}) {
  const product = useMemo(
    () => products.find((p) => String(p._id) === String(row.productId)) || null,
    [products, row.productId],
  );
  const plan = useMemo(
    () => buildCatalogSelectCustomizationPlan(product, sizeSourceProduct, row.selectedSizeKey, {
      productOptionValue: row.productOptionValue,
    }),
    [product, sizeSourceProduct, row.selectedSizeKey, row.productOptionValue],
  );

  useEffect(() => {
    const nextSlots = product
      ? mergeSlotsPreserveUploads(plan.defaultPhotoSlots, row.photoSlots || [])
      : [];
    const nextExcludedDefaults = (row.excludedDefaultKeys || [])
      .filter((key) => nextSlots.some((s) => s.slotKey === key));
    const nextExcludedCollage = (row.excludedCollageKeys || [])
      .filter((key) => plan.collageTemplates.some((t) => (t.groupKey || `collage:${t.label}`) === key));
    const slotSig = (slots = []) => (slots || [])
      .map((s) => `${s.slotKey}|${s.sizeLabel || ''}|${s.area?.width || ''}x${s.area?.height || ''}|${s.photo ? '1' : '0'}|${s.reference ? '1' : '0'}`)
      .join('||');
    const listSig = (list = []) => (list || []).join('|');
    const templateSig = (list = []) => (list || []).map((t) => t.label || t.groupKey || '').join('|');
    const patch = {
      orderVariantValue: plan.orderVariantValue || '',
      orderVariantId: plan.orderVariantId || '',
      sizeLabel: plan.sizeLabel || '',
      catalogSizeChoice: plan.resolvedSize?.config?.value || '',
      nonSizeOptionCount: plan.nonSizeOptions.length,
      requiresSize: plan.requiresSize === true,
      collageTemplates: plan.collageTemplates,
      photoSlots: nextSlots,
      excludedDefaultKeys: nextExcludedDefaults,
      excludedCollageKeys: nextExcludedCollage,
    };
    const changed = row.orderVariantValue !== patch.orderVariantValue
      || row.orderVariantId !== patch.orderVariantId
      || row.sizeLabel !== patch.sizeLabel
      || row.catalogSizeChoice !== patch.catalogSizeChoice
      || Number(row.nonSizeOptionCount || 0) !== Number(patch.nonSizeOptionCount || 0)
      || Boolean(row.requiresSize) !== Boolean(patch.requiresSize)
      || templateSig(row.collageTemplates) !== templateSig(patch.collageTemplates)
      || slotSig(row.photoSlots) !== slotSig(patch.photoSlots)
      || listSig(row.excludedDefaultKeys) !== listSig(patch.excludedDefaultKeys)
      || listSig(row.excludedCollageKeys) !== listSig(patch.excludedCollageKeys);
    if (changed) onChange(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    row.productId,
    row.selectedSizeKey,
    row.productOptionValue,
    plan.orderVariantValue,
    plan.orderVariantId,
    plan.sizeLabel,
    plan.requiresSize,
    plan.nonSizeOptions.length,
    plan.defaultPhotoSlots.map((s) => s.slotKey).join('|'),
    plan.collageTemplates.map((t) => t.label).join('|'),
  ]);

  const showSizeDropdown = Boolean(product && plan.requiresSize);

  return (
    <div className="space-y-3 rounded-xl border border-emerald-100 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-gray-900">
            Product {index + 1}
            {product?.title ? (
              <span className="mt-0.5 block text-[11px] font-semibold text-gray-500 break-words sm:mt-0 sm:ml-2 sm:inline">
                {product.title}
              </span>
            ) : null}
          </h4>
          <p className="text-[11px] text-gray-500 break-words">
            {!product
              ? 'Select a website product first.'
              : plan.requiresSize
                ? 'This product has variants — choose a size. Uploads/collage follow this product.'
                : 'No variants — website customization for this product loads by default.'}
          </p>
        </div>
        {canRemove ? (
          <button
            type="button"
            className="min-h-[44px] w-full shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 sm:w-auto"
            onClick={onRemove}
          >
            Remove product
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`${labelClass} sm:col-span-2`}>
          Select product
          <select
            value={row.productId || ''}
            onChange={(e) => onChange({
              productId: e.target.value,
              selectedSizeKey: '',
              productOptionValue: '',
              customFieldValues: {},
              photoSlots: [],
              excludedDefaultKeys: [],
              collageUploads: {},
              excludedCollageKeys: [],
              requiresSize: false,
            })}
            className={fieldClass}
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>{p.title}</option>
            ))}
          </select>
        </label>

        {showSizeDropdown ? (
          <label className={`${labelClass} sm:col-span-2`}>
            Size
            <UniqueSizeSelect
              value={row.selectedSizeKey || ''}
              sizes={uniqueSizes}
              emptyLabel="Select size"
              onChange={(e) => onChange({ selectedSizeKey: e.target.value })}
            />
            <span className="mt-1 block text-[10px] font-normal text-gray-500 break-words">
              {!sizeSourceProduct
                ? 'Personalized Single Photo Frame size catalog is not loaded yet.'
                : uniqueSizesPlan.uniqueCount
                  ? `${uniqueSizesPlan.uniqueCount} size${uniqueSizesPlan.uniqueCount === 1 ? '' : 's'} from Personalized Single Photo Frame`
                  : 'No sizes configured on Personalized Single Photo Frame yet.'}
            </span>
          </label>
        ) : null}

        {product ? (
          <label className={labelClass}>
            Qty
            <input
              inputMode="numeric"
              value={row.quantity}
              onChange={(e) => onChange({ quantity: sanitizeIntegerInput(e.target.value) })}
              className={fieldClass}
            />
          </label>
        ) : null}

        {product && plan.nonSizeOptions.length ? (
          <label className={labelClass}>
            Product option
            <select
              value={row.productOptionValue || ''}
              onChange={(e) => onChange({ productOptionValue: e.target.value })}
              className={fieldClass}
            >
              <option value="">Select option</option>
              {plan.nonSizeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {product ? (
        <>
          <TextCustomFieldsBlock
            fields={plan.textCustomFields}
            values={row.customFieldValues || {}}
            onChange={(nextValues) => onChange({ customFieldValues: nextValues })}
          />

          <CollageUploadSection
            templates={plan.collageTemplates}
            uploads={row.collageUploads || {}}
            onUploadsChange={(nextUploads) => onChange({ collageUploads: nextUploads })}
            excludedKeys={row.excludedCollageKeys || []}
            onExclude={(key) => onChange({
              excludedCollageKeys: [...(row.excludedCollageKeys || []), key],
            })}
            onRestore={(key) => onChange({
              excludedCollageKeys: (row.excludedCollageKeys || []).filter((k) => k !== key),
            })}
            allowExclude
          />

          {(row.photoSlots || []).length ? (
            <SlotGrid
              slots={row.photoSlots}
              excludedKeys={row.excludedDefaultKeys || []}
              allowExclude
              onExclude={(key) => onChange({
                excludedDefaultKeys: [...(row.excludedDefaultKeys || []), key],
              })}
              onRestore={(key) => onChange({
                excludedDefaultKeys: (row.excludedDefaultKeys || []).filter((k) => k !== key),
              })}
              onChangeSlot={(slotIndex, photo) => {
                const nextSlots = [...(row.photoSlots || [])];
                nextSlots[slotIndex] = { ...nextSlots[slotIndex], photo };
                onChange({ photoSlots: nextSlots });
              }}
              onReference={(slotIndex, reference) => {
                const nextSlots = [...(row.photoSlots || [])];
                nextSlots[slotIndex] = { ...nextSlots[slotIndex], reference };
                onChange({ photoSlots: nextSlots });
              }}
            />
          ) : (
            <p className="text-[11px] text-gray-500 break-words">
              {plan.requiresSize && !row.selectedSizeKey
                ? 'Choose a size to load frame preview and any size-based photo fields.'
                : plan.hasCollage
                  ? 'Collage uploads are shown above.'
                  : 'No extra photo upload slots configured on this website product.'}
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

/**
 * Catalog Select Product — multiple product rows in one WhatsApp order.
 * Each row: website product + full Personalized Single Photo Frame sizes + that product's rules.
 */
export function CatalogProductSection({
  products,
  rows,
  onRowsChange,
  sizeCatalogProduct = null,
}) {
  const sizeSourceProduct = useMemo(
    () => resolveSizeCatalogProduct(sizeCatalogProduct, products),
    [sizeCatalogProduct, products],
  );
  const uniqueSizesPlan = useMemo(
    () => listUniqueWebsiteSizes(sizeSourceProduct ? [sizeSourceProduct] : []),
    [sizeSourceProduct],
  );
  const uniqueSizes = uniqueSizesPlan.sizes;
  const list = Array.isArray(rows) && rows.length ? rows : [newCatalogProductRow()];

  const updateRow = (rowId, patch) => {
    onRowsChange((prev) => {
      const base = Array.isArray(prev) && prev.length ? prev : [newCatalogProductRow()];
      return base.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row));
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900">Products</h3>
        <p className="text-[11px] text-gray-500 break-words">
          Add one or more website products. No variants → website defaults. Has variants → size list from Personalized Single Photo Frame.
        </p>
      </div>

      {list.map((row, index) => (
        <CatalogProductRow
          key={row.rowId}
          row={row}
          index={index}
          products={products}
          sizeSourceProduct={sizeSourceProduct}
          uniqueSizes={uniqueSizes}
          uniqueSizesPlan={uniqueSizesPlan}
          canRemove={list.length > 1}
          onChange={(patch) => updateRow(row.rowId, patch)}
          onRemove={() => {
            const hasUploads = (row.photoSlots || []).some((s) => s.photo?.file || s.reference?.file)
              || Object.values(row.collageUploads || {}).some((arr) => Array.isArray(arr) && arr.some((p) => p?.file));
            if (hasUploads && !window.confirm('Remove this product and discard its uploads for this order?')) return;
            onRowsChange((prev) => {
              const base = Array.isArray(prev) ? prev : [];
              const next = base.filter((r) => r.rowId !== row.rowId);
              return next.length ? next : [newCatalogProductRow()];
            });
          }}
        />
      ))}

      <button
        type="button"
        className="min-h-[44px] w-full rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 sm:w-auto"
        onClick={() => onRowsChange((prev) => [
          ...(Array.isArray(prev) && prev.length ? prev : [newCatalogProductRow()]),
          newCatalogProductRow(),
        ])}
      >
        + Add product
      </button>
    </div>
  );
}

/**
 * Customized Combo: sizes from the combo source product (Admin-configured).
 * New sizes added on that product appear automatically.
 */
export function ComboProductSection({
  products = [],
  comboProduct,
  comboError,
  selections,
  onSelectionsChange,
  comboCustomFields,
  onComboCustomFieldsChange,
  comboExtraTextFields = [],
  onComboExtraTextFieldsChange,
  comboCollageUploads,
  onComboCollageUploadsChange,
  excludedComboCollageKeys,
  onExcludedComboCollageKeysChange,
}) {
  const defaultProductId = comboProduct?._id ? String(comboProduct._id) : '';
  // Prefer sizes on the Customized Combo source product; fall back to catalog if none.
  const sizeSourceProducts = useMemo(() => {
    if (comboProduct) return [comboProduct];
    return Array.isArray(products) ? products : [];
  }, [comboProduct, products]);
  const catalogProducts = useMemo(() => {
    const list = Array.isArray(products) ? [...products] : [];
    if (comboProduct && !list.some((p) => String(p._id) === String(comboProduct._id))) {
      list.unshift(comboProduct);
    }
    return list;
  }, [products, comboProduct]);
  const uniqueSizesPlan = useMemo(
    () => listUniqueWebsiteSizes(sizeSourceProducts),
    [sizeSourceProducts],
  );
  const uniqueSizes = uniqueSizesPlan.sizes;

  const updateRow = (rowId, patch) => {
    onSelectionsChange((prev) => prev.map((row) => {
      if (row.rowId !== rowId) return row;
      const next = { ...row, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'sizeKey')
        || Object.prototype.hasOwnProperty.call(patch, 'productId')
        || Object.prototype.hasOwnProperty.call(patch, 'catalogChoiceValue')) {
        if (Object.prototype.hasOwnProperty.call(patch, 'sizeKey')
          || Object.prototype.hasOwnProperty.call(patch, 'catalogChoiceValue')
          || (Object.prototype.hasOwnProperty.call(patch, 'productId') && next.sizeKey)) {
          const sizeKey = Object.prototype.hasOwnProperty.call(patch, 'sizeKey')
            ? patch.sizeKey
            : (next.sizeKey || patch.catalogChoiceValue || '');
          const resolved = resolveWebsiteSizeConfig(sizeKey, {
            products: sizeSourceProducts.length ? sizeSourceProducts : catalogProducts,
            preferredProductIds: [defaultProductId, next.productId],
            explicitProductId: Object.prototype.hasOwnProperty.call(patch, 'productId')
              ? patch.productId
              : (defaultProductId || ''),
          });
          next.sizeKey = resolved.sizeKey || sizeKey || '';
          next.size = resolved.sizeLabel || next.size || '';
          next.needsProductDisambiguation = false;
          next.candidateProductIds = [];
          if (resolved.config) {
            next.catalogChoiceValue = resolved.config.value || '';
            next.productId = resolved.config.productId || defaultProductId || '';
            next.variantValue = resolved.config.variantValue || '';
            next.variantId = resolved.config.variantId || resolved.config.optionId || '';
          } else if (!sizeKey) {
            next.catalogChoiceValue = '';
            next.variantValue = '';
            next.variantId = '';
            next.productId = defaultProductId;
          } else {
            next.productId = defaultProductId || next.productId || '';
          }
        }
      }
      const product = comboProduct
        || catalogProducts.find((p) => String(p._id) === String(next.productId))
        || null;
      if (Object.prototype.hasOwnProperty.call(patch, 'sizeKey')
        || Object.prototype.hasOwnProperty.call(patch, 'catalogChoiceValue')
        || Object.prototype.hasOwnProperty.call(patch, 'variantValue')
        || Object.prototype.hasOwnProperty.call(patch, 'size')
        || Object.prototype.hasOwnProperty.call(patch, 'quantity')
        || Object.prototype.hasOwnProperty.call(patch, 'productId')
        || Object.prototype.hasOwnProperty.call(patch, 'photoSlots')) {
        const variantValue = next.variantValue || (next.size ? `Size: ${next.size}` : '');
        if (!Object.prototype.hasOwnProperty.call(patch, 'photoSlots')) {
          if (product && variantValue) {
            const nextSlots = buildAdditionalVariantSlots(product, variantValue, next.quantity);
            next.photoSlots = mergeSlotsPreserveUploads(nextSlots, row.photoSlots || []);
          } else {
            next.photoSlots = [];
          }
        }
      }
      return next;
    }));
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-600 break-words">
        Each combo line picks a size configured on the combo source product. Preview uses that size&apos;s frame dimensions.
        Combo source:{' '}
        <strong>{comboProduct?.title || (comboError ? 'Unavailable' : 'Loading…')}</strong>.
      </p>
      {comboError ? <p className="text-xs font-semibold text-red-700">{comboError}</p> : null}
      <p className="text-[11px] text-gray-500">
        {uniqueSizesPlan.uniqueCount
          ? `${uniqueSizesPlan.uniqueCount} size${uniqueSizesPlan.uniqueCount === 1 ? '' : 's'} on combo source`
          : 'No sizes configured on the combo source product yet.'}
      </p>

      {comboProduct ? (
        <div className="space-y-3 rounded-xl border border-emerald-100 bg-white p-3">
          <h4 className="text-sm font-bold text-gray-900">Combo source customization</h4>
          <TextCustomFieldsBlock
            fields={getTextCustomFields(comboProduct)}
            values={comboCustomFields}
            onChange={onComboCustomFieldsChange}
          />
          <div className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/40 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold text-gray-900">Additional text fields (this order only)</p>
                <p className="text-[11px] text-gray-500">Does not change the website product configuration.</p>
              </div>
              <button
                type="button"
                className="min-h-[44px] w-full sm:w-auto rounded-xl border border-violet-300 bg-white px-4 py-2 text-sm font-bold text-violet-900"
                onClick={() => onComboExtraTextFieldsChange?.([
                  ...(comboExtraTextFields || []),
                  {
                    id: `txt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    label: '',
                    value: '',
                  },
                ])}
              >
                + Add Text Field
              </button>
            </div>
            {(comboExtraTextFields || []).map((field) => (
              <div key={field.id} className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2">
                <label className={labelClass}>
                  Text label
                  <input
                    value={field.label || ''}
                    onChange={(e) => onComboExtraTextFieldsChange?.(
                      (comboExtraTextFields || []).map((f) => (
                        f.id === field.id ? { ...f, label: e.target.value } : f
                      )),
                    )}
                    placeholder="e.g. Name on frame"
                    className={fieldClass}
                  />
                </label>
                <label className={labelClass}>
                  Customer text
                  <input
                    value={field.value || ''}
                    onChange={(e) => onComboExtraTextFieldsChange?.(
                      (comboExtraTextFields || []).map((f) => (
                        f.id === field.id ? { ...f, value: e.target.value } : f
                      )),
                    )}
                    placeholder="Customer-requested text"
                    className={fieldClass}
                  />
                </label>
                <button
                  type="button"
                  className="sm:col-span-2 min-h-[40px] text-left text-sm font-semibold text-red-700"
                  onClick={() => onComboExtraTextFieldsChange?.(
                    (comboExtraTextFields || []).filter((f) => f.id !== field.id),
                  )}
                >
                  Remove text field
                </button>
              </div>
            ))}
          </div>
          <CollageUploadSection
            templates={getCollageTemplates(comboProduct)}
            uploads={comboCollageUploads || {}}
            onUploadsChange={onComboCollageUploadsChange}
            excludedKeys={excludedComboCollageKeys || []}
            onExclude={(key) => onExcludedComboCollageKeysChange?.([...(excludedComboCollageKeys || []), key])}
            onRestore={(key) => onExcludedComboCollageKeysChange?.((excludedComboCollageKeys || []).filter((k) => k !== key))}
          />
        </div>
      ) : null}

      {selections.map((row) => {
        const rowProduct = comboProduct
          || catalogProducts.find((p) => String(p._id) === String(row.productId))
          || null;
        return (
          <div key={row.rowId} className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                {row.size
                  ? `Size ${row.size}${rowProduct?.title ? ` · ${rowProduct.title}` : ''}`
                  : 'Combo website size'}
              </p>
              <button
                type="button"
                className="min-h-[40px] text-sm font-semibold text-red-700"
                onClick={() => {
                  const hasUploads = (row.photoSlots || []).some((s) => s.photo?.file || s.reference?.file);
                  if (hasUploads && !window.confirm('Remove this variant and discard its uploads for this order?')) return;
                  onSelectionsChange(selections.filter((r) => r.rowId !== row.rowId));
                }}
              >
                Remove Variant
              </button>
            </div>
            <label className={`${labelClass} col-span-full`}>
              Variant / size
              <UniqueSizeSelect
                value={row.sizeKey || ''}
                sizes={uniqueSizes}
                emptyLabel="Select website size"
                onChange={(e) => updateRow(row.rowId, { sizeKey: e.target.value })}
              />
              <span className="mt-1 block text-[10px] font-normal text-gray-500">
                Sizes configured on the combo source product
              </span>
            </label>
            {rowProduct?.title ? (
              <p className="sm:col-span-2 col-span-full text-[11px] text-gray-500">
                Source product: <strong>{rowProduct.title}</strong>
              </p>
            ) : null}
            <label className={`${labelClass} col-span-full sm:col-span-1`}>
              Qty
              <input
                inputMode="numeric"
                value={row.quantity}
                onChange={(e) => updateRow(row.rowId, { quantity: sanitizeIntegerInput(e.target.value) })}
                className={fieldClass}
              />
            </label>
            {(row.photoSlots || []).length ? (
              <div className="sm:col-span-2 col-span-full">
                <SlotGrid
                  slots={row.photoSlots}
                  excludedKeys={[]}
                  allowExclude={false}
                  onChangeSlot={(index, photo) => {
                    const nextSlots = [...(row.photoSlots || [])];
                    nextSlots[index] = { ...nextSlots[index], photo };
                    updateRow(row.rowId, { photoSlots: nextSlots });
                  }}
                  onReference={(index, reference) => {
                    const nextSlots = [...(row.photoSlots || [])];
                    nextSlots[index] = { ...nextSlots[index], reference };
                    updateRow(row.rowId, { photoSlots: nextSlots });
                  }}
                />
              </div>
            ) : (row.variantValue || row.size) ? (
              <p className="sm:col-span-2 col-span-full text-[11px] text-gray-500">
                No upload slots for this size configuration.
              </p>
            ) : null}
          </div>
        );
      })}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="min-h-[44px] w-full sm:w-auto rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-800"
          onClick={() => onSelectionsChange([
            ...selections,
            {
              rowId: `combo-${Date.now()}`,
              productId: defaultProductId,
              catalogChoiceValue: '',
              sizeKey: '',
              size: '',
              variantValue: '',
              variantId: '',
              quantity: '1',
              photoSlots: [],
              needsProductDisambiguation: false,
              candidateProductIds: [],
            },
          ])}
        >
          + Add Variant
        </button>
      </div>
    </div>
  );
}

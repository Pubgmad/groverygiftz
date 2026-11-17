'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AdminWebsitePhotoSlot from '@/components/admin/AdminWebsitePhotoSlot';
import PhotoUploadCard from '@/components/product/PhotoUploadCard';
import { sanitizeIntegerInput } from '@/lib/sanitizeNumericInput';
import {
  buildAdditionalVariantSlots,
  buildOrderLocalCustomVariantSlots,
  listUniqueWebsiteSizes,
  resolveWebsiteSizeConfig,
  mergeSlotsPreserveUploads,
  resolveProductCustomizationPlan,
  getTextCustomFields,
  getCollageTemplates,
  ORDER_LOCAL_CUSTOM_VARIANT,
} from '@/lib/websiteProductPhotoConfig';

const fieldClass = 'mt-1 w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base sm:text-sm';
const labelClass = 'block text-sm font-semibold text-gray-900';

function resolveRowSourceProduct(products, fallbackProduct, row) {
  if (row?.sourceProductId) {
    const match = (products || []).find((p) => String(p._id) === String(row.sourceProductId));
    if (match) return match;
  }
  return fallbackProduct || null;
}

function applyResolvedSizeConfig(next, resolved) {
  const config = resolved?.config || null;
  next.sizeKey = resolved?.sizeKey || next.sizeKey || '';
  next.sizeLabel = resolved?.sizeLabel || config?.sizeLabel || next.sizeLabel || '';
  next.isCustom = false;
  next.customLabel = '';
  next.needsProductDisambiguation = Boolean(resolved?.ambiguous);
  next.candidateProductIds = (resolved?.candidates || []).map((c) => String(c.productId));
  if (config) {
    next.catalogChoiceValue = config.value || '';
    next.sourceProductId = config.productId || '';
    next.variant = config.variantValue || '';
    next.variantId = config.variantId || config.optionId || '';
    next.customFieldValues = {};
  } else {
    next.catalogChoiceValue = '';
    next.sourceProductId = '';
    next.variant = '';
    next.variantId = '';
    next.customFieldValues = {};
  }
  return next;
}

function newVariantRow(fallbackProduct, seed = {}) {
  const row = {
    rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sizeKey: seed.sizeKey || '',
    sizeLabel: seed.sizeLabel || '',
    catalogChoiceValue: seed.catalogChoiceValue || '',
    sourceProductId: seed.sourceProductId || '',
    variant: seed.variant || '',
    variantId: seed.variantId || '',
    customLabel: seed.customLabel || '',
    isCustom: seed.isCustom === true,
    quantity: seed.quantity || '1',
    photoSlots: seed.photoSlots || [],
    excludedSlotKeys: [],
    customFieldValues: seed.customFieldValues || {},
    needsProductDisambiguation: seed.needsProductDisambiguation === true,
    candidateProductIds: seed.candidateProductIds || [],
  };
  if (!row.photoSlots.length && fallbackProduct) {
    row.photoSlots = rebuildAdditionalSlots(fallbackProduct, row);
  }
  return row;
}

function rebuildAdditionalSlots(product, row) {
  if (row.isCustom || row.variant === ORDER_LOCAL_CUSTOM_VARIANT) {
    return buildOrderLocalCustomVariantSlots(product, row.customLabel, row.quantity);
  }
  return buildAdditionalVariantSlots(product, row.variant, row.quantity);
}

function UniqueSizeSelect({
  value,
  onChange,
  sizes,
  includeCustom = true,
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
      {includeCustom ? (
        <option value={ORDER_LOCAL_CUSTOM_VARIANT}>Custom Variant — This Order Only</option>
      ) : null}
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

/**
 * Catalog Select Product: original website customizations + Additional Variants.
 */
export function CatalogProductSection({
  products,
  productId,
  onProductIdChange,
  selectedVariant,
  onSelectedVariantChange,
  customFieldValues,
  onCustomFieldChange,
  defaultSlots,
  onDefaultSlotsChange,
  excludedDefaultKeys,
  onExcludedDefaultKeysChange,
  collageUploads,
  onCollageUploadsChange,
  excludedCollageKeys,
  onExcludedCollageKeysChange,
  additionalVariants,
  onAdditionalVariantsChange,
}) {
  const product = useMemo(
    () => products.find((p) => String(p._id) === String(productId)) || null,
    [products, productId],
  );
  const plan = useMemo(
    () => resolveProductCustomizationPlan(product, { selectedVariantValue: selectedVariant }),
    [product, selectedVariant],
  );
  const uniqueSizesPlan = useMemo(
    () => listUniqueWebsiteSizes(products),
    [products],
  );
  const uniqueSizes = uniqueSizesPlan.sizes;
  const hasCatalogSizes = uniqueSizes.length > 0;

  useEffect(() => {
    if (!product) {
      onDefaultSlotsChange([]);
      onExcludedDefaultKeysChange([]);
      onExcludedCollageKeysChange?.([]);
      onCollageUploadsChange?.({});
      return;
    }
    // Sync selected variant when product changes or plan auto-picks one
    if (plan.selectedVariantValue && plan.selectedVariantValue !== selectedVariant) {
      onSelectedVariantChange?.(plan.selectedVariantValue);
    }
    onDefaultSlotsChange((prev) => mergeSlotsPreserveUploads(plan.defaultPhotoSlots, prev));
    onExcludedDefaultKeysChange((prev) => prev.filter((key) => plan.defaultPhotoSlots.some((s) => s.slotKey === key)));
    onExcludedCollageKeysChange?.((prev) => prev.filter((key) => plan.collageTemplates.some((t) => (t.groupKey || `collage:${t.label}`) === key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, plan.selectedVariantValue, plan.defaultPhotoSlots.map((s) => s.slotKey).join('|'), plan.collageTemplates.map((t) => t.label).join('|')]);

  const updateAdditionalRow = (rowId, patch) => {
    onAdditionalVariantsChange((prev) => prev.map((row) => {
      if (row.rowId !== rowId) return row;
      const next = { ...row, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'sizeKey')
        || Object.prototype.hasOwnProperty.call(patch, 'sourceProductId')
        || Object.prototype.hasOwnProperty.call(patch, 'catalogChoiceValue')
        || Object.prototype.hasOwnProperty.call(patch, 'variant')) {
        const selectedValue = Object.prototype.hasOwnProperty.call(patch, 'sizeKey')
          ? patch.sizeKey
          : (Object.prototype.hasOwnProperty.call(patch, 'catalogChoiceValue')
            ? patch.catalogChoiceValue
            : patch.variant);
        if (selectedValue === ORDER_LOCAL_CUSTOM_VARIANT) {
          next.isCustom = true;
          next.sizeKey = '';
          next.sizeLabel = '';
          next.catalogChoiceValue = ORDER_LOCAL_CUSTOM_VARIANT;
          next.sourceProductId = productId || '';
          next.variantId = '';
          next.variant = ORDER_LOCAL_CUSTOM_VARIANT;
          next.customFieldValues = {};
          next.needsProductDisambiguation = false;
          next.candidateProductIds = [];
        } else if (Object.prototype.hasOwnProperty.call(patch, 'sourceProductId') && next.sizeKey) {
          const resolved = resolveWebsiteSizeConfig(next.sizeKey, {
            products,
            preferredProductIds: [productId],
            explicitProductId: patch.sourceProductId,
          });
          applyResolvedSizeConfig(next, resolved);
        } else {
          const resolved = resolveWebsiteSizeConfig(selectedValue, {
            products,
            preferredProductIds: [productId],
            explicitProductId: next.sourceProductId || '',
          });
          applyResolvedSizeConfig(next, resolved);
        }
      }
      const sourceProduct = resolveRowSourceProduct(products, product, next);
      if (Object.prototype.hasOwnProperty.call(patch, 'sizeKey')
        || Object.prototype.hasOwnProperty.call(patch, 'sourceProductId')
        || Object.prototype.hasOwnProperty.call(patch, 'catalogChoiceValue')
        || Object.prototype.hasOwnProperty.call(patch, 'variant')
        || Object.prototype.hasOwnProperty.call(patch, 'quantity')
        || Object.prototype.hasOwnProperty.call(patch, 'customLabel')
        || Object.prototype.hasOwnProperty.call(patch, 'isCustom')
        || Object.prototype.hasOwnProperty.call(patch, 'photoSlots')) {
        if (!Object.prototype.hasOwnProperty.call(patch, 'photoSlots')) {
          if (next.needsProductDisambiguation && !next.sourceProductId) {
            next.photoSlots = [];
            next.excludedSlotKeys = [];
          } else {
            const nextSlots = rebuildAdditionalSlots(sourceProduct, next);
            next.photoSlots = mergeSlotsPreserveUploads(nextSlots, row.photoSlots || []);
            next.excludedSlotKeys = (next.excludedSlotKeys || []).filter((key) => next.photoSlots.some((s) => s.slotKey === key));
          }
        }
      }
      return next;
    }));
  };

  return (
    <div className="space-y-4">
      <label className={labelClass}>
        Select Product
        <select
          value={productId}
          onChange={(e) => {
            onProductIdChange(e.target.value);
            onAdditionalVariantsChange([]);
            onExcludedDefaultKeysChange([]);
            onExcludedCollageKeysChange?.([]);
            onCustomFieldChange({});
            onCollageUploadsChange?.({});
            onSelectedVariantChange?.('');
          }}
          className={fieldClass}
        >
          <option value="">Select product</option>
          {products.map((p) => (
            <option key={p._id} value={p._id}>{p.title}</option>
          ))}
        </select>
      </label>

      {product ? (
        <>
          <div className="space-y-3 rounded-xl border border-emerald-100 bg-white p-3">
            <div>
              <h4 className="text-sm font-bold text-gray-900">Original Product Details &amp; Customization</h4>
              <p className="text-[11px] text-gray-500">
                Loaded from the website product configuration. Exclusions apply to this WhatsApp order only.
              </p>
            </div>

            {plan.variantOptions.length ? (
              <label className={labelClass}>
                Default variant / size
                <select
                  value={selectedVariant || plan.selectedVariantValue || ''}
                  onChange={(e) => onSelectedVariantChange?.(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select variant</option>
                  {plan.variantOptions.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <TextCustomFieldsBlock
              fields={plan.textCustomFields}
              values={customFieldValues}
              onChange={onCustomFieldChange}
            />

            <CollageUploadSection
              templates={plan.collageTemplates}
              uploads={collageUploads || {}}
              onUploadsChange={onCollageUploadsChange}
              excludedKeys={excludedCollageKeys || []}
              onExclude={(key) => onExcludedCollageKeysChange?.([...(excludedCollageKeys || []), key])}
              onRestore={(key) => onExcludedCollageKeysChange?.((excludedCollageKeys || []).filter((k) => k !== key))}
              allowExclude
            />

            {defaultSlots.length ? (
              <SlotGrid
                slots={defaultSlots}
                excludedKeys={excludedDefaultKeys}
                allowExclude
                onExclude={(key) => onExcludedDefaultKeysChange([...excludedDefaultKeys, key])}
                onRestore={(key) => onExcludedDefaultKeysChange(excludedDefaultKeys.filter((k) => k !== key))}
                onChangeSlot={(index, photo) => {
                  const next = [...defaultSlots];
                  next[index] = { ...next[index], photo };
                  onDefaultSlotsChange(next);
                }}
                onReference={(index, reference) => {
                  const next = [...defaultSlots];
                  next[index] = { ...next[index], reference };
                  onDefaultSlotsChange(next);
                }}
              />
            ) : (
              <p className="text-[11px] text-gray-500">
                {plan.hasCollage
                  ? 'Collage uploads are shown above. Add sizes under Additional Variants if needed.'
                  : plan.hasVariantOnlyUploads
                    ? 'Default variant upload loaded below when a variant is selected. Add more sizes under Additional Variants.'
                    : 'This website product has no default photo upload sections. Add variants below if needed.'}
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-xl border bg-gray-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Additional Variants</h4>
                <p className="text-[11px] text-gray-500">
                  Unique website sizes only. Uploads and preview follow the selected product when it offers that size; otherwise choose the source product.
                </p>
              </div>
              <button
                type="button"
                className="min-h-[44px] w-full sm:w-auto rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-800"
                onClick={() => {
                  const seed = hasCatalogSizes
                    ? {}
                    : {
                      isCustom: true,
                      variant: ORDER_LOCAL_CUSTOM_VARIANT,
                      catalogChoiceValue: ORDER_LOCAL_CUSTOM_VARIANT,
                      sourceProductId: productId || '',
                    };
                  onAdditionalVariantsChange([
                    ...additionalVariants,
                    newVariantRow(product, seed),
                  ]);
                }}
              >
                + Add Variant
              </button>
            </div>

            {additionalVariants.map((row) => {
              const isCustom = row.isCustom || row.variant === ORDER_LOCAL_CUSTOM_VARIANT
                || row.catalogChoiceValue === ORDER_LOCAL_CUSTOM_VARIANT;
              const sourceProduct = resolveRowSourceProduct(products, product, row);
              const sourceTextFields = isCustom || row.needsProductDisambiguation
                ? []
                : getTextCustomFields(sourceProduct);
              const hasSelection = isCustom ? true : Boolean(row.sizeKey || row.catalogChoiceValue || row.variant);
              const selectValue = isCustom
                ? ORDER_LOCAL_CUSTOM_VARIANT
                : (row.sizeKey || '');
              const candidateConfigs = (uniqueSizes.find((s) => s.sizeKey === row.sizeKey)?.configs || [])
                .filter((c) => (row.candidateProductIds || []).includes(String(c.productId))
                  || !(row.candidateProductIds || []).length);
              return (
              <div key={row.rowId} className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2">
                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    {isCustom
                      ? 'Custom variant — this order only'
                      : (row.sizeLabel
                        ? `Size ${row.sizeLabel}${sourceProduct?.title ? ` · ${sourceProduct.title}` : ''}`
                        : 'Website size')}
                  </p>
                  <button
                    type="button"
                    className="min-h-[40px] text-sm font-semibold text-red-700"
                    onClick={() => {
                      const hasUploads = (row.photoSlots || []).some((s) => s.photo?.file || s.reference?.file);
                      if (hasUploads && !window.confirm('Remove this variant and discard its uploads for this order?')) return;
                      onAdditionalVariantsChange(additionalVariants.filter((r) => r.rowId !== row.rowId));
                    }}
                  >
                    Remove Variant
                  </button>
                </div>
                <label className={`${labelClass} col-span-full`}>
                  Variant / size
                  <UniqueSizeSelect
                    value={selectValue}
                    sizes={uniqueSizes}
                    includeCustom
                    emptyLabel="Select website size"
                    onChange={(e) => updateAdditionalRow(row.rowId, { sizeKey: e.target.value })}
                  />
                  <span className="mt-1 block text-[10px] font-normal text-gray-500">
                    {hasCatalogSizes
                      ? `${uniqueSizesPlan.uniqueCount} unique website sizes`
                      : 'No website size options found in the loaded catalog. Use a custom order-only label.'}
                  </span>
                </label>
                {!isCustom && row.needsProductDisambiguation ? (
                  <label className={`${labelClass} col-span-full`}>
                    Source product for this size
                    <select
                      value={row.sourceProductId || ''}
                      onChange={(e) => updateAdditionalRow(row.rowId, { sourceProductId: e.target.value })}
                      className={fieldClass}
                    >
                      <option value="">Select product configuration</option>
                      {(candidateConfigs.length
                        ? candidateConfigs
                        : (uniqueSizes.find((s) => s.sizeKey === row.sizeKey)?.configs || [])
                      ).map((config) => (
                        <option key={config.value} value={config.productId}>
                          {config.productTitle}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-[10px] font-normal text-amber-800">
                      This size exists on multiple products. Choose which configuration to use for uploads and preview.
                    </span>
                  </label>
                ) : null}
                {isCustom ? (
                  <label className={`${labelClass} sm:col-span-2`}>
                    Custom label / size
                    <input
                      value={row.customLabel || ''}
                      onChange={(e) => updateAdditionalRow(row.rowId, {
                        customLabel: e.target.value,
                        isCustom: true,
                        variant: ORDER_LOCAL_CUSTOM_VARIANT,
                        catalogChoiceValue: ORDER_LOCAL_CUSTOM_VARIANT,
                        sourceProductId: productId || '',
                      })}
                      placeholder="e.g. 10×12 — customer request"
                      className={fieldClass}
                    />
                    <span className="mt-1 block text-[10px] font-normal text-amber-800">
                      Order-only — does not change the website product. No unrelated website preview is applied.
                    </span>
                  </label>
                ) : null}
                <label className={`${labelClass} col-span-full sm:col-span-1`}>
                  Qty
                  <input
                    inputMode="numeric"
                    value={row.quantity}
                    onChange={(e) => updateAdditionalRow(row.rowId, { quantity: sanitizeIntegerInput(e.target.value) })}
                    className={fieldClass}
                  />
                </label>
                {!isCustom && sourceTextFields.length ? (
                  <div className="sm:col-span-2 col-span-full">
                    <TextCustomFieldsBlock
                      fields={sourceTextFields}
                      values={row.customFieldValues || {}}
                      onChange={(nextValues) => updateAdditionalRow(row.rowId, { customFieldValues: nextValues })}
                    />
                  </div>
                ) : null}
                {(row.photoSlots || []).length ? (
                  <div className="sm:col-span-2 col-span-full">
                    <SlotGrid
                      slots={row.photoSlots}
                      excludedKeys={row.excludedSlotKeys || []}
                      allowExclude
                      onExclude={(key) => updateAdditionalRow(row.rowId, {
                        excludedSlotKeys: [...(row.excludedSlotKeys || []), key],
                      })}
                      onRestore={(key) => updateAdditionalRow(row.rowId, {
                        excludedSlotKeys: (row.excludedSlotKeys || []).filter((k) => k !== key),
                      })}
                      onChangeSlot={(index, photo) => {
                        const nextSlots = [...(row.photoSlots || [])];
                        nextSlots[index] = { ...nextSlots[index], photo };
                        updateAdditionalRow(row.rowId, { photoSlots: nextSlots });
                      }}
                      onReference={(index, reference) => {
                        const nextSlots = [...(row.photoSlots || [])];
                        nextSlots[index] = { ...nextSlots[index], reference };
                        updateAdditionalRow(row.rowId, { photoSlots: nextSlots });
                      }}
                    />
                  </div>
                ) : hasSelection ? (
                  <p className="sm:col-span-2 col-span-full text-[11px] text-gray-500">
                    {isCustom
                      ? 'No product-level upload sections to copy for this custom variant. Add photos later in Order Details if needed.'
                      : row.needsProductDisambiguation
                        ? 'Choose the source product above to load uploads and preview for this size.'
                        : (row.sizeKey || row.catalogChoiceValue || row.variant)
                          ? 'No upload slots for this size configuration.'
                          : 'Select a website size to load its upload and preview fields.'}
                  </p>
                ) : (
                  <p className="sm:col-span-2 col-span-full text-[11px] text-gray-500">
                    Select a website size to load its upload and preview fields.
                  </p>
                )}
              </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Customized Combo: catalog-wide website sizes with source-product mapping.
 * No hardcoded sizes — every website size configuration is selectable.
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
  const [showBespoke, setShowBespoke] = useState(false);
  const [customSizeDraft, setCustomSizeDraft] = useState('');

  const defaultProductId = comboProduct?._id ? String(comboProduct._id) : '';
  const catalogProducts = useMemo(() => {
    const list = Array.isArray(products) ? [...products] : [];
    if (comboProduct && !list.some((p) => String(p._id) === String(comboProduct._id))) {
      list.unshift(comboProduct);
    }
    return list;
  }, [products, comboProduct]);
  const uniqueSizesPlan = useMemo(
    () => listUniqueWebsiteSizes(catalogProducts),
    [catalogProducts],
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
            products: catalogProducts,
            preferredProductIds: [defaultProductId, next.productId],
            explicitProductId: Object.prototype.hasOwnProperty.call(patch, 'productId')
              ? patch.productId
              : '',
          });
          next.isCustom = false;
          next.sizeKey = resolved.sizeKey || sizeKey || '';
          next.size = resolved.sizeLabel || next.size || '';
          next.needsProductDisambiguation = Boolean(resolved.ambiguous);
          next.candidateProductIds = (resolved.candidates || []).map((c) => String(c.productId));
          if (resolved.config) {
            next.catalogChoiceValue = resolved.config.value || '';
            next.productId = resolved.config.productId || '';
            next.variantValue = resolved.config.variantValue || '';
            next.variantId = resolved.config.variantId || resolved.config.optionId || '';
          } else if (resolved.ambiguous) {
            next.catalogChoiceValue = '';
            next.variantValue = '';
            next.variantId = '';
            if (!Object.prototype.hasOwnProperty.call(patch, 'productId')) {
              next.productId = '';
            }
          }
        }
      }
      const product = catalogProducts.find((p) => String(p._id) === String(next.productId))
        || (String(next.productId) === String(comboProduct?._id) ? comboProduct : null)
        || comboProduct;
      if (Object.prototype.hasOwnProperty.call(patch, 'sizeKey')
        || Object.prototype.hasOwnProperty.call(patch, 'catalogChoiceValue')
        || Object.prototype.hasOwnProperty.call(patch, 'variantValue')
        || Object.prototype.hasOwnProperty.call(patch, 'size')
        || Object.prototype.hasOwnProperty.call(patch, 'quantity')
        || Object.prototype.hasOwnProperty.call(patch, 'productId')
        || Object.prototype.hasOwnProperty.call(patch, 'photoSlots')) {
        const variantValue = next.variantValue || (next.size ? `Size: ${next.size}` : '');
        if (!Object.prototype.hasOwnProperty.call(patch, 'photoSlots')) {
          if (next.needsProductDisambiguation && !next.productId) {
            next.photoSlots = [];
          } else if (!next.isCustom && product) {
            const nextSlots = buildAdditionalVariantSlots(product, variantValue, next.quantity);
            next.photoSlots = mergeSlotsPreserveUploads(nextSlots, row.photoSlots || []);
          } else if (next.isCustom && next.size) {
            const nextSlots = buildOrderLocalCustomVariantSlots(product || comboProduct, next.size, next.quantity);
            next.photoSlots = mergeSlotsPreserveUploads(nextSlots, row.photoSlots || []);
          }
        }
      }
      return next;
    }));
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-600 break-words">
        Each combo line picks a unique website size. Uploads follow the combo source product when it offers that size; otherwise choose the source product.
        Default combo source:{' '}
        <strong>{comboProduct?.title || (comboError ? 'Unavailable' : 'Loading…')}</strong>.
      </p>
      {comboError ? <p className="text-xs font-semibold text-red-700">{comboError}</p> : null}
      <p className="text-[11px] text-gray-500">
        {uniqueSizesPlan.uniqueCount} unique website sizes
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
        const rowProduct = catalogProducts.find((p) => String(p._id) === String(row.productId))
          || (String(row.productId) === String(comboProduct?._id) ? comboProduct : null)
          || comboProduct;
        const candidateConfigs = uniqueSizes.find((s) => s.sizeKey === row.sizeKey)?.configs || [];
        return (
          <div key={row.rowId} className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                {row.isCustom
                  ? 'Custom combo size — this order only'
                  : (row.size
                    ? `Size ${row.size}${rowProduct?.title ? ` · ${rowProduct.title}` : ''}`
                    : 'Combo website size')}
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
              {row.isCustom ? (
                <input
                  value={row.size}
                  onChange={(e) => updateRow(row.rowId, {
                    size: e.target.value,
                    variantValue: `Size: ${e.target.value}`,
                    productId: row.productId || defaultProductId,
                  })}
                  placeholder="Order-only size label"
                  className={fieldClass}
                />
              ) : (
                <UniqueSizeSelect
                  value={row.sizeKey || ''}
                  sizes={uniqueSizes}
                  includeCustom={false}
                  emptyLabel="Select website size"
                  onChange={(e) => updateRow(row.rowId, { sizeKey: e.target.value })}
                />
              )}
              {row.isCustom ? (
                <span className="mt-1 block text-[10px] font-normal text-amber-800">
                  Order-specific size — not saved to website product
                </span>
              ) : (
                <span className="mt-1 block text-[10px] font-normal text-gray-500">
                  Unique website sizes only
                </span>
              )}
            </label>
            {!row.isCustom && row.needsProductDisambiguation ? (
              <label className={`${labelClass} col-span-full`}>
                Source product for this size
                <select
                  value={row.productId || ''}
                  onChange={(e) => updateRow(row.rowId, { productId: e.target.value })}
                  className={fieldClass}
                >
                  <option value="">Select product configuration</option>
                  {candidateConfigs.map((config) => (
                    <option key={config.value} value={config.productId}>
                      {config.productTitle}
                    </option>
                  ))}
                </select>
              </label>
            ) : (!row.isCustom && rowProduct?.title ? (
              <p className="sm:col-span-2 col-span-full text-[11px] text-gray-500">
                Source product: <strong>{rowProduct.title}</strong>
              </p>
            ) : null)}
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
                {row.needsProductDisambiguation
                  ? 'Choose the source product above to load uploads for this size.'
                  : 'No upload slots for this size configuration.'}
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
              isCustom: false,
              photoSlots: [],
              needsProductDisambiguation: false,
              candidateProductIds: [],
            },
          ])}
        >
          + Add Variant
        </button>
        <button
          type="button"
          className="min-h-[40px] text-left text-xs font-semibold text-amber-900"
          onClick={() => setShowBespoke((v) => !v)}
        >
          {showBespoke ? 'Hide' : 'Show'} bespoke size (order only — not a catalog variant)
        </button>
        {showBespoke ? (
          <label className="text-xs font-semibold text-gray-700">
            Bespoke size (order only)
            <span className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                value={customSizeDraft}
                onChange={(e) => setCustomSizeDraft(e.target.value)}
                placeholder="Bespoke size"
                className="min-h-[44px] w-full rounded-xl border px-3 py-2 text-sm font-normal"
              />
              <button
                type="button"
                className="min-h-[44px] shrink-0 rounded-xl border bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
                onClick={() => {
                  const size = String(customSizeDraft || '').trim();
                  if (!size) {
                    toast.error('Enter a custom size label');
                    return;
                  }
                  onSelectionsChange([
                    ...selections,
                    {
                      rowId: `combo-custom-${Date.now()}`,
                      productId: defaultProductId,
                      size,
                      variantValue: `Size: ${size}`,
                      quantity: '1',
                      isCustom: true,
                      photoSlots: [],
                    },
                  ]);
                  setCustomSizeDraft('');
                }}
              >
                Add bespoke
              </button>
            </span>
          </label>
        ) : null}
      </div>
    </div>
  );
}

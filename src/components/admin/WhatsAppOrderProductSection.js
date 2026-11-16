'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AdminWebsitePhotoSlot from '@/components/admin/AdminWebsitePhotoSlot';
import PhotoUploadCard from '@/components/product/PhotoUploadCard';
import { sanitizeIntegerInput } from '@/lib/sanitizeNumericInput';
import {
  buildAdditionalVariantSlots,
  buildOrderLocalCustomVariantSlots,
  listAdditionalVariantChoices,
  mergeSlotsPreserveUploads,
  resolveProductCustomizationPlan,
  getTextCustomFields,
  getCollageTemplates,
  ORDER_LOCAL_CUSTOM_VARIANT,
} from '@/lib/websiteProductPhotoConfig';

const fieldClass = 'mt-1 w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base sm:text-sm';
const labelClass = 'block text-sm font-semibold text-gray-900';

function newVariantRow(product, seed = {}) {
  const row = {
    rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    variant: seed.variant || '',
    variantId: seed.variantId || '',
    customLabel: seed.customLabel || '',
    isCustom: seed.isCustom === true,
    quantity: seed.quantity || '1',
    photoSlots: seed.photoSlots || [],
    excludedSlotKeys: [],
  };
  if (!row.photoSlots.length && product) {
    row.photoSlots = rebuildAdditionalSlots(product, row);
  }
  return row;
}

function rebuildAdditionalSlots(product, row) {
  if (row.isCustom || row.variant === ORDER_LOCAL_CUSTOM_VARIANT) {
    return buildOrderLocalCustomVariantSlots(product, row.customLabel, row.quantity);
  }
  return buildAdditionalVariantSlots(product, row.variant, row.quantity);
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
  const additionalChoices = useMemo(
    () => listAdditionalVariantChoices(product),
    [product],
  );
  const variantChoices = additionalChoices.choices;
  const hasVariantChoices = variantChoices.length > 0;

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
      if (Object.prototype.hasOwnProperty.call(patch, 'variant')) {
        if (patch.variant === ORDER_LOCAL_CUSTOM_VARIANT) {
          next.isCustom = true;
          next.variantId = '';
          next.variant = ORDER_LOCAL_CUSTOM_VARIANT;
        } else {
          next.isCustom = false;
          next.customLabel = '';
          const match = variantChoices.find((v) => v.value === patch.variant);
          next.variantId = match?.optionId || '';
        }
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'variant')
        || Object.prototype.hasOwnProperty.call(patch, 'quantity')
        || Object.prototype.hasOwnProperty.call(patch, 'customLabel')
        || Object.prototype.hasOwnProperty.call(patch, 'isCustom')
        || Object.prototype.hasOwnProperty.call(patch, 'photoSlots')) {
        if (!Object.prototype.hasOwnProperty.call(patch, 'photoSlots')) {
          const nextSlots = rebuildAdditionalSlots(product, next);
          next.photoSlots = mergeSlotsPreserveUploads(nextSlots, row.photoSlots || []);
          next.excludedSlotKeys = (next.excludedSlotKeys || []).filter((key) => next.photoSlots.some((s) => s.slotKey === key));
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
                  Optional extras for this WhatsApp order. Use website variants when available, or an order-only custom variant.
                </p>
              </div>
              <button
                type="button"
                className="min-h-[44px] w-full sm:w-auto rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-800"
                onClick={() => {
                  // Prefer website / area-derived size dropdown. Only default to
                  // order-local custom when the product has no selectable sizes.
                  const seed = hasVariantChoices
                    ? {}
                    : { isCustom: true, variant: ORDER_LOCAL_CUSTOM_VARIANT };
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
              const isCustom = row.isCustom || row.variant === ORDER_LOCAL_CUSTOM_VARIANT;
              const hasSelection = isCustom
                ? true
                : Boolean(row.variant);
              const choiceSourceLabel = additionalChoices.source === 'area_sizes'
                ? 'Product size (from preview config)'
                : 'Website variant';
              return (
              <div key={row.rowId} className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2">
                <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    {isCustom ? 'Custom variant — this order only' : choiceSourceLabel}
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
                <label className={`${labelClass} ${isCustom ? 'sm:col-span-2' : 'sm:col-span-1'} col-span-full`}>
                  Variant / size
                  <select
                    value={isCustom ? ORDER_LOCAL_CUSTOM_VARIANT : (row.variant || '')}
                    onChange={(e) => updateAdditionalRow(row.rowId, { variant: e.target.value })}
                    className={fieldClass}
                  >
                    {!isCustom ? <option value="">Select variant / size</option> : null}
                    {variantChoices.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                    <option value={ORDER_LOCAL_CUSTOM_VARIANT}>Custom Variant — This Order Only</option>
                  </select>
                  {!hasVariantChoices ? (
                    <span className="mt-1 block text-[10px] font-normal text-gray-500">
                      This product has no website size options. Use a custom order-only label, or pick Custom above.
                    </span>
                  ) : additionalChoices.source === 'area_sizes' ? (
                    <span className="mt-1 block text-[10px] font-normal text-gray-500">
                      Sizes derived from this product&apos;s preview configuration (no conventional variants array).
                    </span>
                  ) : null}
                </label>
                {isCustom ? (
                  <label className={`${labelClass} sm:col-span-2`}>
                    Custom label / size
                    <input
                      value={row.customLabel || ''}
                      onChange={(e) => updateAdditionalRow(row.rowId, {
                        customLabel: e.target.value,
                        isCustom: true,
                        variant: ORDER_LOCAL_CUSTOM_VARIANT,
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
                      : row.variant
                        ? 'No upload slots for this variant configuration.'
                        : 'Select a variant / size to load its upload and preview fields.'}
                  </p>
                ) : (
                  <p className="sm:col-span-2 col-span-full text-[11px] text-gray-500">
                    Select a variant / size to load its upload and preview fields.
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
 * Customized Combo: each row picks a website product (defaults to combo source) + real variant.
 * Catalog sizes come from the selected product — not hardcoded.
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
  const sourcePlan = useMemo(
    () => resolveProductCustomizationPlan(comboProduct),
    [comboProduct],
  );

  const updateRow = (rowId, patch) => {
    onSelectionsChange((prev) => prev.map((row) => {
      if (row.rowId !== rowId) return row;
      const next = { ...row, ...patch };
      const product = products.find((p) => String(p._id) === String(next.productId))
        || (String(next.productId) === String(comboProduct?._id) ? comboProduct : null)
        || comboProduct;
      const options = listAdditionalVariantChoices(product).choices;
      if (Object.prototype.hasOwnProperty.call(patch, 'productId')) {
        next.variantValue = '';
        next.variantId = '';
        next.size = '';
        next.photoSlots = [];
        next.isCustom = false;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'variantValue')
        || Object.prototype.hasOwnProperty.call(patch, 'size')
        || Object.prototype.hasOwnProperty.call(patch, 'quantity')
        || Object.prototype.hasOwnProperty.call(patch, 'productId')
        || Object.prototype.hasOwnProperty.call(patch, 'photoSlots')) {
        const variantValue = next.variantValue || (next.size ? `Size: ${next.size}` : '');
        if (patch.variantValue) {
          const opt = options.find((o) => o.value === patch.variantValue);
          next.size = opt?.optionLabel || opt?.label || next.size;
          next.variantId = opt?.optionId || '';
        }
        if (!Object.prototype.hasOwnProperty.call(patch, 'photoSlots')) {
          if (!next.isCustom && product) {
            const nextSlots = buildAdditionalVariantSlots(product, variantValue, next.quantity);
            next.photoSlots = mergeSlotsPreserveUploads(nextSlots, row.photoSlots || []);
          } else if (next.isCustom && next.size) {
            const nextSlots = buildOrderLocalCustomVariantSlots(product, next.size, next.quantity);
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
        Each combo line uses a real website product and its configured variants.
        Default source:{' '}
        <strong>{comboProduct?.title || (comboError ? 'Unavailable' : 'Loading…')}</strong>.
        Pick another catalog product on a row to use that product’s sizes and uploads.
      </p>
      {comboError ? <p className="text-xs font-semibold text-red-700">{comboError}</p> : null}
      {comboProduct && sourcePlan.variantOptions.length <= 1 ? (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          The default combo source currently exposes {sourcePlan.variantOptions.length || 0} size option
          {sourcePlan.variantOptions.length === 1 ? ` (${sourcePlan.variantOptions[0]?.optionLabel || sourcePlan.variantOptions[0]?.label})` : ''}.
          Add more Size options on that website product, or choose a different product on each combo row.
        </p>
      ) : null}

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
        const rowProduct = products.find((p) => String(p._id) === String(row.productId))
          || (String(row.productId) === String(comboProduct?._id) ? comboProduct : null)
          || comboProduct;
        const options = row.isCustom ? [] : listAdditionalVariantChoices(rowProduct).choices;
        return (
          <div key={row.rowId} className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2">
            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Combo variant</p>
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
            <label className={`${labelClass} sm:col-span-2`}>
              Product / component
              <select
                value={row.productId || defaultProductId}
                disabled={row.isCustom}
                onChange={(e) => updateRow(row.rowId, { productId: e.target.value })}
                className={fieldClass}
              >
                {!row.productId && !defaultProductId ? <option value="">Select product</option> : null}
                {comboProduct ? (
                  <option value={String(comboProduct._id)}>{comboProduct.title} (combo source)</option>
                ) : null}
                {products
                  .filter((p) => String(p._id) !== String(comboProduct?._id))
                  .map((p) => (
                    <option key={p._id} value={p._id}>{p.title}</option>
                  ))}
              </select>
            </label>
            <label className={`${labelClass} col-span-full sm:col-span-1`}>
              Variant / size
              {row.isCustom ? (
                <input
                  value={row.size}
                  onChange={(e) => updateRow(row.rowId, { size: e.target.value, variantValue: `Size: ${e.target.value}` })}
                  placeholder="Order-only size label"
                  className={fieldClass}
                />
              ) : (
                <select
                  value={row.variantValue || ''}
                  onChange={(e) => updateRow(row.rowId, { variantValue: e.target.value })}
                  className={fieldClass}
                >
                  <option value="">Select variant</option>
                  {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
              {row.isCustom ? (
                <span className="mt-1 block text-[10px] font-normal text-amber-800">
                  Order-specific size — not saved to website product
                </span>
              ) : null}
            </label>
            <label className={labelClass}>
              Qty
              <input
                inputMode="numeric"
                value={row.quantity}
                onChange={(e) => updateRow(row.rowId, { quantity: sanitizeIntegerInput(e.target.value) })}
                className={fieldClass}
              />
            </label>
            {(row.photoSlots || []).length ? (
              <div className="sm:col-span-2">
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
              <p className="sm:col-span-2 text-[11px] text-gray-500">No upload slots for this variant configuration.</p>
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
              size: '',
              variantValue: '',
              variantId: '',
              quantity: '1',
              isCustom: false,
              photoSlots: [],
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

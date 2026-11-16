'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AdminWebsitePhotoSlot from '@/components/admin/AdminWebsitePhotoSlot';
import { sanitizeIntegerInput } from '@/lib/sanitizeNumericInput';
import {
  buildAdditionalVariantSlots,
  mergeSlotsPreserveUploads,
  resolveProductCustomizationPlan,
} from '@/lib/websiteProductPhotoConfig';

const fieldClass = 'mt-1 w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base sm:text-sm';
const labelClass = 'block text-sm font-semibold text-gray-900';

function newVariantRow(seed = {}) {
  return {
    rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    variant: seed.variant || '',
    variantId: seed.variantId || '',
    quantity: seed.quantity || '1',
    photoSlots: seed.photoSlots || [],
    excludedSlotKeys: [],
  };
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

/**
 * Catalog Select Product: default customizations + Additional Variants.
 */
export function CatalogProductSection({
  products,
  productId,
  onProductIdChange,
  customFieldValues,
  onCustomFieldChange,
  defaultSlots,
  onDefaultSlotsChange,
  excludedDefaultKeys,
  onExcludedDefaultKeysChange,
  additionalVariants,
  onAdditionalVariantsChange,
}) {
  const product = useMemo(
    () => products.find((p) => String(p._id) === String(productId)) || null,
    [products, productId],
  );
  const plan = useMemo(() => resolveProductCustomizationPlan(product), [product]);

  useEffect(() => {
    if (!product) {
      onDefaultSlotsChange([]);
      onExcludedDefaultKeysChange([]);
      return;
    }
    onDefaultSlotsChange((prev) => mergeSlotsPreserveUploads(plan.defaultPhotoSlots, prev));
    // Keep exclusions that still exist
    onExcludedDefaultKeysChange((prev) => prev.filter((key) => plan.defaultPhotoSlots.some((s) => s.slotKey === key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, plan.defaultPhotoSlots.map((s) => s.slotKey).join('|')]);

  const updateAdditionalRow = (rowId, patch) => {
    onAdditionalVariantsChange((prev) => prev.map((row) => {
      if (row.rowId !== rowId) return row;
      const next = { ...row, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'variant')
        || Object.prototype.hasOwnProperty.call(patch, 'quantity')) {
        const nextSlots = buildAdditionalVariantSlots(product, next.variant, next.quantity);
        next.photoSlots = mergeSlotsPreserveUploads(nextSlots, row.photoSlots || []);
        const match = plan.variantOptions.find((v) => v.value === next.variant);
        next.variantId = match?.optionId || '';
        next.excludedSlotKeys = (next.excludedSlotKeys || []).filter((key) => next.photoSlots.some((s) => s.slotKey === key));
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
            onCustomFieldChange({});
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
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Default Customer Customization</h4>
                <p className="text-[11px] text-gray-500">
                  Loaded from the website product configuration. Exclusions apply to this WhatsApp order only.
                </p>
              </div>
            </div>

            {plan.textCustomFields.length ? (
              <div className="space-y-2 rounded-xl border border-primary-50 bg-primary-50/30 p-3">
                <p className="text-xs font-bold text-gray-800">Product custom fields</p>
                {plan.textCustomFields.map((field) => (
                  <label key={field.label} className={labelClass}>
                    {field.label}{field.required ? ' *' : ''}
                    {field.type === 'textarea' ? (
                      <textarea
                        rows={2}
                        value={customFieldValues?.[field.label] || ''}
                        onChange={(e) => onCustomFieldChange({
                          ...(customFieldValues || {}),
                          [field.label]: e.target.value,
                        })}
                        className={`${fieldClass} font-normal`}
                      />
                    ) : (
                      <input
                        value={customFieldValues?.[field.label] || ''}
                        onChange={(e) => onCustomFieldChange({
                          ...(customFieldValues || {}),
                          [field.label]: e.target.value,
                        })}
                        className={`${fieldClass} font-normal`}
                      />
                    )}
                  </label>
                ))}
              </div>
            ) : null}

            {plan.collageTemplates.length ? (
              <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-xs text-sky-950 space-y-1">
                <p className="font-bold">Collage requirements (from website product)</p>
                {plan.collageTemplates.map((template) => (
                  <p key={template.label}>
                    {template.label}: {template.minImages}
                    {template.maxImages > template.minImages ? `–${template.maxImages}` : ''} image(s)
                    {template.instructions ? ` — ${template.instructions}` : ''}
                  </p>
                ))}
                <p className="text-[11px] text-sky-800">
                  Use Additional Variants / Order Details collage uploads to fulfill these counts when creating the order.
                </p>
              </div>
            ) : null}

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
                {plan.hasVariantOnlyUploads
                  ? 'Default variant upload loaded below. Add more sizes under Additional Variants.'
                  : 'This website product has no default photo upload sections. Add variants below if needed.'}
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-xl border bg-gray-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Additional Variants</h4>
                <p className="text-[11px] text-gray-500">Optional extra sizes/options for this order. Dropdowns use actual website variants.</p>
              </div>
              <button
                type="button"
                className="min-h-[44px] rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-800"
                onClick={() => {
                  if (!plan.variantOptions.length) {
                    toast.error('This product has no configured variants to add');
                    return;
                  }
                  onAdditionalVariantsChange([...additionalVariants, newVariantRow()]);
                }}
              >
                + Add Variant
              </button>
            </div>

            {additionalVariants.map((row) => (
              <div key={row.rowId} className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-2">
                <div className="sm:col-span-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Variant</p>
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
                <label className={labelClass}>
                  Variant / size
                  <select
                    value={row.variant}
                    onChange={(e) => updateAdditionalRow(row.rowId, { variant: e.target.value })}
                    className={fieldClass}
                  >
                    <option value="">Select variant</option>
                    {plan.variantOptions.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Qty
                  <input
                    inputMode="numeric"
                    value={row.quantity}
                    onChange={(e) => updateAdditionalRow(row.rowId, { quantity: sanitizeIntegerInput(e.target.value) })}
                    className={fieldClass}
                  />
                </label>
                {(row.photoSlots || []).length ? (
                  <div className="sm:col-span-2">
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
                ) : row.variant ? (
                  <p className="sm:col-span-2 text-[11px] text-gray-500">No upload slots for this variant configuration.</p>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Customized Combo: dynamic variants from configured source product (no hardcoded sizes).
 */
export function ComboProductSection({
  comboProduct,
  comboOptions,
  comboError,
  selections,
  onSelectionsChange,
}) {
  const [customSizeDraft, setCustomSizeDraft] = useState('');

  const updateRow = (rowId, patch) => {
    onSelectionsChange((prev) => prev.map((row) => {
      if (row.rowId !== rowId) return row;
      const next = { ...row, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, 'variantValue')
        || Object.prototype.hasOwnProperty.call(patch, 'size')
        || Object.prototype.hasOwnProperty.call(patch, 'quantity')) {
        const variantValue = next.variantValue || (next.size ? `Size: ${next.size}` : '');
        if (patch.variantValue) {
          const opt = comboOptions.find((o) => o.value === patch.variantValue);
          next.size = opt?.label || next.size;
          next.variantId = opt?.optionId || '';
        }
        const nextSlots = comboProduct
          ? buildAdditionalVariantSlots(comboProduct, variantValue, next.quantity)
          : [];
        next.photoSlots = mergeSlotsPreserveUploads(nextSlots, row.photoSlots || []);
      }
      return next;
    }));
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-600">
        Variants from configured Website product:{' '}
        <strong>{comboProduct?.title || (comboError ? 'Unavailable' : 'Loading…')}</strong>
        . Upload slots appear automatically from that product’s configuration.
      </p>
      {comboError ? <p className="text-xs font-semibold text-red-700">{comboError}</p> : null}

      {selections.map((row) => (
        <div key={row.rowId} className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-3">
          <label className={`${labelClass} sm:col-span-2`}>
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
                {comboOptions.map((opt) => (
                  <option key={opt.value || opt.label} value={opt.value || `Size: ${opt.label}`}>
                    {opt.label}
                  </option>
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
          <button
            type="button"
            className="min-h-[40px] sm:col-span-3 text-left text-sm font-semibold text-red-700"
            onClick={() => {
              const hasUploads = (row.photoSlots || []).some((s) => s.photo?.file || s.reference?.file);
              if (hasUploads && !window.confirm('Remove this variant and discard its uploads for this order?')) return;
              onSelectionsChange(selections.filter((r) => r.rowId !== row.rowId));
            }}
          >
            Remove Variant
          </button>
          {(row.photoSlots || []).length ? (
            <div className="sm:col-span-3">
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
          ) : null}
        </div>
      ))}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <button
          type="button"
          className="min-h-[44px] rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-bold text-emerald-800"
          onClick={() => onSelectionsChange([
            ...selections,
            {
              rowId: `combo-${Date.now()}`,
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
        <label className="text-xs font-semibold text-gray-700">
          Additional size (order only)
          <span className="mt-1 flex flex-col gap-2 sm:flex-row">
            <input
              value={customSizeDraft}
              onChange={(e) => setCustomSizeDraft(e.target.value)}
              placeholder="Bespoke size"
              className="min-h-[44px] rounded-xl border px-3 py-2 text-sm font-normal"
            />
            <button
              type="button"
              className="min-h-[44px] rounded-xl border bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
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
              Add custom
            </button>
          </span>
        </label>
      </div>
    </div>
  );
}

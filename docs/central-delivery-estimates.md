# Centralized Estimated Delivery Days

## Configuration

Admin location: `/account/manage/estimated-delivery` (Estimated Delivery Days in the existing navigation).

Exactly two editable categories reuse the existing Settings document fields: `tamilNaduDeliveryEstimate` and `otherStateDeliveryEstimate`. The dedicated `/api/delivery-estimates` endpoint validates and saves both in one atomic `$set`, restricted to admins. It cannot update shipping prices, credentials or unrelated settings. General Settings saves omit/ignore these fields to prevent stale forms from becoming a second writer.

Accepted formats include `3-4 days`, `Within 8 working days`, and `1 day`. Ranges must be positive, ordered integers, with a maximum of 365 days. Invalid/missing values and database errors do not produce a successful save response. Existing global defaults are retained as the single initialization fallback, not independently repeated in customer components.

## Existing data and synchronization

Before centralization, estimates existed in Settings, template state rows, product delivery fields, variant state overrides and browser cart copies. These could disagree. Current template/product API responses now project the two central values onto every existing state row. New and edited records receive the same values. Product and template editors display read-only central estimates.

This is read-time synchronization rather than a bulk migration. Old stored template/product estimate strings are superseded at read time; no templates, products or orders are deleted, no template references/weights are changed, and shipping charges are not rewritten. Updating the single Settings document cannot leave a partially synchronized set of template documents.

Only normalized Tamil Nadu identifiers use the Tamil Nadu duration; all other existing supported destinations use Other States. No city-name inference or serviceable-state changes are introduced. Destinations not yet selected display a choose-state prompt.

## Customer and historical behavior

Product/variant estimates, cart, cart drawer and checkout use the central duration while retaining the existing shipping-price precedence and quantity calculation. New orders snapshot the current holiday-aware estimate. The shipping policy displays live central durations; exact legacy generated timeline markup is replaced only in the rendered view, without rewriting CMS records or unrelated policy text. Independently authored policy wording still warrants admin review.

Already stored dated order promises are returned unchanged, including when holidays or central durations change later. Undated legacy promises retain their stored duration and existing order-date calculation, never today's central duration. No historical order rewrite or backfill runs.

## Freshness

Settings, template and product endpoints are dynamic/no-store. Saving central values invalidates the root layout cache. Customer settings refresh on mount, focus, visibility, same-tab save events, cross-tab storage signals and every 15 seconds while visible. Different devices receive updates on their next fetch/poll; this is not websocket-style instantaneous push. Failed refreshes retain the last successful settings rather than guessing a new delivery duration.

## Changed files

- Central configuration: `src/lib/centralDeliveryEstimates.js`, `src/lib/deliveryEstimateSettings.js`, `src/models/Settings.js`, `src/app/api/delivery-estimates/route.js`, `src/app/api/settings/route.js`.
- Template/product projection and saves: `src/lib/shippingTemplateHydration.js`, `src/app/api/shipping-templates/route.js`, `src/app/api/shipping-templates/[id]/route.js`, `src/app/api/products/route.js`, `src/app/api/products/[slug]/route.js`.
- Admin controls/navigation: `src/components/admin/AdminSidebar.js`, `src/app/account/manage/estimated-delivery/page.js`, `src/app/account/manage/settings/page.js`, `src/app/account/manage/shipping/page.js`, `src/app/account/manage/products/[id]/page.js`.
- Current and historical calculations: `src/lib/shipping.js`, `src/app/api/orders/create-cashfree-order/route.js`, `src/lib/orderDeliveryEstimate.js`.
- Customer displays/freshness: `src/hooks/useDeliverySettings.js`, `src/components/product/ProductDetail.js`, `src/components/product/DeliveryEstimateSummary.js`, `src/components/checkout/CheckoutFlow.js`, `src/components/cart/CartDrawer.js`, `src/app/cart/page.js`, `src/app/policies/[slug]/page.js`.
- Regression coverage: `scripts/test-central-delivery.cjs`, `scripts/test-meta-attribution.cjs` (test loader dependency only).

## Verification Results

`node --test scripts/test-central-delivery.cjs scripts/test-checkout-reliability.cjs scripts/test-ga4.cjs scripts/test-meta-purchase.cjs scripts/test-meta-attribution.cjs scripts/test-image-reliability.cjs`

Final local run: 187 tests passed, none failed. `npm run build` passed. The encoding scan found no replacement characters or common mojibake markers in changed/new source and documentation.

Coverage includes range validation, all existing destination categories, multiple weight/template examples, product and variant hydration, template create/edit enforcement, price/payment-total comparisons against the pre-change Git version, actual Sunday/holiday calculation, historical promise preservation, atomic/admin-only saves, database failure, stale Settings forms, client refresh/race/cleanup behavior and read-only editor controls.

Live Atlas records, historical per-template value differences, physical Android/iOS browsers and production admin sessions have not been inspected or changed by this implementation. A build and mocked regression suite do not replace production/browser verification.

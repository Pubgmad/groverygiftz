# GA4 Purpose-Specific Consent Correction

Date: 15 October 2026. Measurement ID: G-JNPXLZQB0V. The operator confirmed India-only sales. Sales territory is not used as a substitute for visitor location or permission; no IP geolocation service or regional auto-grant was added.

## Confirmed Findings

- The operator observed no real GA script request until accepting the old marketing preference. The code coupled GA eligibility to Meta's cookie, deployment mode and privacy checks.
- Google advertising consent was always denied even when the old preference was accepted. This explains a code-level zero-advertising-consent condition, but does not establish the exact regional/time-window interpretation of the private diagnostics screen.
- The old preferences UI was mounted inside the server-configured Meta component. It could disappear when Meta settings/database lookup failed. Its combined Accept/Reject choice did not independently represent Analytics and Google Advertising.
- Product/cart/search views rendered before consent had no consistent remeasurement signal after a grant. A product-card observer also disconnected even when tracking was blocked.
- Deployed JavaScript containing GA code was previously confirmed. Downloading bundles is not proof of browser execution or Google ingestion. Tag Assistant's id=DUMMY HEAD request is a diagnostic probe, not this site's measurement ID.

## Implementation

An independent, nonblocking Cookie preferences panel is mounted once in the root layout. It is not dependent on a Meta configuration lookup, and is hidden on admin routes. The existing footer entry reopens this panel. Necessary cookies remain active. Analytics and Advertising use separate, initially unchecked controls. Customers can reject optional tracking, save selected purposes or explicitly accept both.

The Google preference cookie gg_google_consent stores a versioned Analytics/Advertising choice for 180 days, with Path=/, SameSite=Lax, Secure on HTTPS and the site's parent domain. Invalid, incomplete or unsupported-version choices do not grant access. Old gg_marketing_consent values are not silently expanded into new Google permissions: existing visitors receive the new choices. If preference-cookie access is blocked, an explicit choice is retained only in memory for that document; it cannot be promised to persist after reload.

| Saved choice | analytics_storage | ad_storage | ad_user_data | ad_personalization | Manual GA ecommerce |
| --- | --- | --- | --- | --- | --- |
| No choice | denied | denied | denied | denied | Not sent |
| Reject optional | denied | denied | denied | denied | Not sent |
| Analytics only | granted | denied | denied | denied | Sent when otherwise eligible |
| Advertising only | denied | granted | granted | granted | Not sent |
| Both explicitly accepted | granted | granted | granted | granted | Sent when otherwise eligible |

This is a basic, explicit-choice Google loading model, not an advanced cookieless-ping implementation. Before either purpose is granted, no Google SDK/config/events are sent. When at least one purpose is granted, the one existing SDK is loaded; its consent default precedes configuration. Advertising-only consent may initialize the tag but never authorizes the application's GA page/ecommerce events. Consent updates precede remeasurement notifications. No Google Ads conversion tag or GTM container was added.

Changing a purpose updates Google's Consent Mode and advertising-personalization flag without installing another tag or repeating config. Google signals remain disabled, as previously. GPC/DNT override grants. Analytics withdrawal clears unsent analytics events and resets view guards; SDK suppression and best-effort deletion of this property's GA cookies remain in place. Advertising withdrawal deletes accessible _gcl_ cookies without clearing cart/authentication/Meta cookies in the GA helper. Already transmitted events cannot be recalled by this code; browser-blocked cookie deletion cannot be guaranteed.

The root analytics component sends a consent-synchronized notification after updating Google. Visible product cards, product detail, cart page/drawer, search and ready checkout use it to retry their current impressions. No denied-period Add to Cart or Purchase actions are retrospectively reconstructed. Existing impression guards suppress repeated focus/consent/render notifications. Intersection observers continue monitoring visibility and are cleaned up on unmount.

The Advertising selection also invokes the existing setMarketingConsent path for Meta when the customer saves. Meta's SDK/event builders, CAPI senders, attribution rules, purchase value policy and server automatic/strict configuration are not rewritten. Before a new Google choice is saved, the existing Meta policy still applies; this is not a claim that all vendors were converted into a new global consent framework. The old combined panel was removed to prevent competing preference interfaces. Privacy copy describes the separate choices and the existing Meta bridge.

## Commerce and Privacy Boundaries

- No authentication/credential/hash/seed, order schema, Cashfree API/finalization, stock, shipping, wishlist or cart persistence logic changed.
- Checkout changes only replace the GA consent-notification listener and reset its analytics-only view guard when tracking becomes unavailable. Payment handlers and paid-order purchase mapping are unchanged.
- Purchase still requires a verified paid-order snapshot, saved amounts/items, INR and the stable display-number/database-ID transaction key. It does not fire from visiting a success screen. Existing memory/receipt guards and the 72-hour eligibility window remain.
- No server-side GA purchase channel was added. Customer non-return, SDK/network blocking, denied analytics or a still-pending verification can still leave a paid database order absent from GA. The database remains the sales authority.
- No name, email, phone, delivery address, customer upload or payment credential fields were added to manual Google events. Review Google tag settings > Allow user-provided data capabilities separately: automatic contact detection was seen in an earlier public configuration audit and cannot be disabled or certified through account settings without access. The implementation does not deliberately supply Google user_data or enable Google signals.
- India-only sales do not justify fake granted states. No legal-compliance certification is claimed. A zero advertising-consent rate can legitimately remain if visitors reject Advertising or choose only Analytics; it must not be removed by falsifying choices.

## Verification

The combined GA, existing Meta/payment/attribution and image suites pass: **143 tests, zero failures**. Tests exercise consent-purpose combinations, default/legacy/invalid cookies, cookie-access failures, privacy overrides, withdrawal, permission independence from Meta, update-before-event ordering, source wiring/cleanup, actual stock-capped cart mutations, verified-purchase sums, failed/pending responses and duplicate guards. Tracking/provider boundaries are mocked; these are not actual Google collection acknowledgments or Cashfree sandbox transactions.

The final production build passed after the cookie-access edge-case correction: compilation, lint/type checks and all 57 static-page generations succeeded. The existing stale Browserslist-data notice remains nonblocking. Changed files are checked for UTF-8 integrity and git whitespace errors.

No browser is connected for automated visual/device tests or private GA access. The panel uses viewport-constrained width/height, wrapping labels, native checkboxes and at least 44px command buttons; physical desktop/tablet/mobile alignment still needs browser verification. No production purchase or fake conversion was generated.

## Operator Verification After Deployment

1. Keep Enhanced Measurement OFF and the stream enabled. Do not install GTM or a second Google snippet.
2. In Tag Assistant, open a customer product page. Before a new Google purpose is accepted, no debuggable tag is expected under this basic model.
3. Choose Analytics only > Save choices. Without reloading, verify one Google tag for G-JNPXLZQB0V, analytics_storage=granted and all three advertising permissions denied. Verify current page/product events, then a genuine Add to Cart. Check Realtime and inspect parameters in Tag Assistant/DebugView.
4. Enable Advertising and save. Verify the three advertising states update to granted; no second config/tag or synthetic Purchase is created. Reject Advertising again and confirm Analytics continues while advertising states return to denied.
5. Reject optional tracking; verify no subsequent manual analytics events. Reopen preferences and grant Analytics to test resumption. Repeat with a supported privacy signal and a private/cookie-restricted window. Do not bypass privacy controls to inflate counts.
6. With approved sandbox credentials and an isolated test property, exercise paid, failed, pending and repeated-return flows. Match purchase transaction ID, INR, items, merchandise value and separate shipping to the saved order. No chargeable production order should be created solely for validation without approval.
7. Review property filters, automatic user-provided-data settings, Google Ads links/imports and diagnostic time range using authorized Google access. This implementation alone cannot prove private account configuration or immediate warning clearance.

## Official References

- [Google Consent Mode setup](https://developers.google.com/tag-platform/security/guides/consent): default/update order and mapping actual choices.
- [Consent types and tag behavior](https://developers.google.com/tag-platform/security/concepts/consent-mode): Analytics and advertising are separate purposes; basic and advanced loading differ.
- [User-provided data setup](https://support.google.com/analytics/answer/14078702): automatic data capabilities have separate Google tag settings.
- [GA4 ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce): item-based purchase value, currency and shipping.

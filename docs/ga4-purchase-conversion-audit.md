# Purchase Conversion Setup Audit

The current Google consent policy is documented in [GA4 Purpose-Specific Consent Correction](ga4-consent-correction.md), superseding the automatic/strict Google consent description in this earlier audit. The direct-tag versus GTM findings remain applicable.

Date: 15 October 2026. Website: https://groverygiftz.in/. Measurement ID: G-JNPXLZQB0V. Application baseline: a47e964.

## Conclusion

The reported wording matches Google's Tag Assistant visual-tagging workflow, launched through Google Ads conversion troubleshooting. That workflow scans the order confirmation page for a Google Tag Manager container. This application deliberately uses the direct Google tag (gtag.js), not GTM. A G- measurement ID is not a GTM- container ID, even though Google's direct-tag script is hosted on googletagmanager.com.

No GTM installation, duplicate Google tag, new success route or payment rewrite is needed to address this message. The exact screen/account was not inspected: identification is based on the supplied wording and Google's matching documentation. A missing GTM container does not establish missing GA4 events or failed payment.

## Audit Matrix

| Area | Current Status | Problem Found | Correction | Verification |
| --- | --- | --- | --- | --- |
| GA4 installation | One root GoogleAnalytics component; direct Google tag for G-JNPXLZQB0V | No installation defect demonstrated by the guided warning | Keep direct installation | Source reviewed; live homepage HTTP 200 and GA-bearing bundles found; actual browser execution not inspected |
| GTM container detection | No GTM bootstrap in source or inspected live bundles | A GTM-specific wizard expects a container that this architecture does not use | Exit visual tagging; configure/import the existing GA event instead | Google's visual-tagging documentation matches the reported message |
| Order confirmation page | Step 3 of /checkout; analytics-only virtual /checkout/success | No dedicated /checkout/success route; unsuitable for a URL-only conversion rule | Keep existing screen; do not manufacture Purchase from a URL | Return/confirmation code reviewed; direct-view and repeated-response regression tests |
| Cashfree payment verification | Backend queries Cashfree; persists paid state and final order number; webhook also invokes finalizer | No evidence that the container warning changes payment success | No payment changes | Existing mocked finalization tests cover paid, pending/failed/cancelled, stock and repeated calls |
| GA4 purchase event | Safe snapshot returned after successful finalization; browser queues purchase | Google ingestion is not observable from local payload tests | Verify receipt using the real event, not the visual wizard | Payload/queue/eligibility tests pass; DebugView/Realtime pending |
| Purchase value and currency | Saved net unit price x quantity; INR; shipping separate | No paise conversion or guided-page text scraping needed | Preserve mapping | Sum/value/shipping and invalid-payload tests pass |
| Duplicate event prevention | One config per document; manual page views; purchase memory/receipt guards and stable transaction ID | Browser blocking and cross-device replay remain limitations | Keep Enhanced Measurement OFF; do not add a second sender | Re-render/SPA/refresh/queue and reused-display-ID tests pass; Google-side processing unverified |
| GA4 / Google Ads conversion configuration | App sends GA purchase; actual account links/imports were not inspected | Guided-flow container requirement is not the correct setup path | Confirm purchase key event; import/create one GA4-based Ads conversion if Ads is used | Official dashboard steps below; account-side completion remains manual |
| Meta Pixel / CAPI compatibility | Existing Meta initialization and finalizer sender retained | No conflict found in reviewed code/tests | No Meta changes | Existing Meta suites pass; no live Meta conversion generated |

## Cashfree and Confirmation Lifecycle

1. Guest cart/account-cart restoration and existing authentication are unchanged. begin_checkout requires a ready, nonempty cart and authenticated customer, and excludes a payment-return URL.
2. create-cashfree-order calculates and saves the order items, subtotal, shipping and total, with a pending internal order number. Its return URL is /checkout?cashfree_order_id={order_id}.
3. The customer pays through Cashfree. SDK errors do not enter the successful-order handler.
4. A webhook may finalize the order independently. The webhook is not a GA event sender. It queries Cashfree rather than treating the incoming webhook body alone as proof of payment.
5. The returning authenticated customer triggers verify-cashfree-payment. The backend queries the Cashfree order API; paid results are finalized and saved, including paidAt and the final GG number, with existing inventory guards.
6. A successful verification response includes ga4Purchase built from the saved order. Pending responses do not supply a GA purchase snapshot.
7. Only an OK verification response with success enters showSuccessfulOrder. GA purchase is requested before the cart is cleared. Receipt rendering may have UI fallbacks, but the GA purchase builder does not use those fallbacks.
8. The success UI remains on /checkout. Google receives a sanitized virtual confirmation page_view for /checkout/success; this does not create a route or change browser history. The raw Cashfree order parameter is not copied into the measurement URL.

### Direct Visits, Refreshes and Delays

- Opening /checkout or calling the analytics confirmation-view helper without a verified snapshot does not emit Purchase. Opening /checkout/success is not a supported receipt route.
- Before successful return-query cleanup, a refresh with the return parameter can reverify. Tracking guards reject ordinary duplicate purchases. After cleanup, the success screen is React state, not a persistent receipt URL: refreshing does not recreate a paid purchase from a URL and can return the empty cart to /cart. Account order history remains the durable customer record.
- A pending verification or a concurrent-finalization 409 response shows the existing error/pending feedback. This return effect does not automatically poll/retry: returnVerifyRef suppresses repeat effect calls for that same ID within the mount. Refreshing the callback can retry verification. This is an existing recovery limitation, not the reason GTM is absent; payment behavior was not changed in this audit.
- If a customer never returns, closes the page before reporting, blocks Google, opts out, or verification remains pending in that visit, a database-paid order can have no browser GA purchase. The webhook can complete the order without sending GA. A GTM container alone would not solve this limitation.
- Valid purchase receipts must be within 72 hours of saved paidAt (five-minute future clock tolerance). Older receipt visits are not backfilled. No historical purchases or fake test conversions were sent.

## Payload and Privacy

The transaction ID combines the final GG display number with the immutable database order ID. This avoids collisions if a test-order counter is reset. Item IDs/titles, public variant text, saved net price and actual quantity are mapped; value is their sum. Shipping is the saved shippingCost and is separate. The builder verifies merchandise plus shipping equals saved total within one paisa. Currency is INR in rupees, not paise.

No authoritative separate tax/coupon fields exist in the current order model; those optional fields are omitted, not invented. Gift-wrap amounts already included in saved unit prices keep their current behavior. Offline/COD creation is disabled by the existing order API, so no COD conversion policy was added.

Manual GA payloads exclude customer contact/address fields, uploaded photos, notes and payment credentials. Page locations/referrers are sanitized. Existing automatic/strict policy, opt-outs, GPC/DNT and nonproduction/debug guards still apply. Automatic mode permits analytics storage; strict mode requires a recorded grant. Google advertising permissions remain denied. Account-side automatic user-provided-data settings still warrant separate review; no assertion is made that the account has been fully audited.

## Manual Configuration - No GTM Required

### Google Analytics

1. Select the property whose web stream is G-JNPXLZQB0V. Keep Enhanced Measurement OFF for this manual implementation and keep the stream enabled. Do not install a second snippet.
2. Open Admin > Data display > Events and check the key events list for lowercase purchase. Google marks purchase as a key event by default; do not create a URL-based event with the same name or give it a fixed revenue value.
3. Verify a genuine eligible purchase event and its transaction_id, INR, merchandise value, shipping and items through Tag Assistant/DebugView. Tag Assistant's general event inspection is different from its GTM visual-tagging guided flow. No debug mode is forced on ordinary production visitors.
4. Check Realtime for recent eligible events and Ecommerce purchases for processed item/revenue data. Normal processed reports can take 24-48 hours. Review date range, property, timezone and active data filters if events are absent; do not blindly change those filters.

### Google Ads - Only If You Use It

1. Link the correct Ads account in GA Admin > Product links > Google Ads links. Enable Ads auto-tagging. These settings require authorized account access.
2. In GA Advertising > Tools > Conversion management, choose New conversion, select the linked Ads account and select the existing purchase event/key event, then review and save. This feature is not available on every property; use Google Ads' GA4 event import/create path if absent.
3. The alternative Ads path is Goals > Conversions > Summary > create a conversion action and choose the linked Google Analytics source. Depending on the account UI this is under Import or the website/data-source selection. Select the existing GA4 purchase, not visual tagging or a confirmation-URL rule.
4. Review the purchase conversion category, event-provided value/currency and Every counting for sales. Review action optimization in Google Ads: make it Primary only when it is the intended purchase bidding action and has been validated. Avoid two Primary purchase actions for the same sale. A second Ads-native tag and a GA4 import can duplicate Ads bidding credit even when each sender deduplicates internally.
5. GA ecommerce collection, GA key-event classification and an Ads conversion action are separate layers. Ads reports only attributable/eligible conversions, not necessarily every sale reported in GA or the order database. Configuring an Ads conversion is unnecessary if only GA reporting is required.

## Tests Executed and Access Limits

Executed: node --test scripts/test-ga4.cjs scripts/test-meta-purchase.cjs scripts/test-meta-attribution.cjs scripts/test-image-reliability.cjs. **130 tests passed, zero failures**, including the new confirmation-view/unverified-response test. Provider, database and analytics boundaries in these tests are mocked: they are not a Cashfree sandbox transaction or actual Google receipt.

Read-only deployment check: live homepage HTTP 200; one global GA SDK component, one measurement-ID-bearing asset, manual-pageview setting and purchase guards detected in downloaded same-origin bundles; no GTM bootstrap detected. Downloaded JavaScript was not executed and no tracking event was generated by this check.

No connected browser or Analytics/Ads connector is available in this session. Therefore Tag Assistant, DebugView, Realtime, Ads linking/imports, data filters and actual received paid transactions were not inspected. No production database records were queried: schema and database operations were reviewed and tested with controlled fixtures; no particular real order was supplied for reconciliation. No live/sandbox payment, seed command, credential update, order edit or stock mutation was performed. Passing local tests is not proof that Google received a specific customer's payment event.

No production application code changes are required for this guided-flow warning. Changes in this audit are a regression test and this report only. The production build passed for the application baseline; it was not rerun for documentation/test-only additions.

## Answers

1. Why the message? The reported wizard expects GTM; the site intentionally has the direct Google tag instead.
2. Is GTM required? No, not for this direct GA4 ecommerce/Ads-import architecture. It would be an optional future tag-management decision, not a repair for this message.
3. Is direct GA4 sufficient? Yes for collecting the implemented ecommerce events and using purchase as a key event or an imported Ads conversion; dashboard configuration and live delivery still matter.
4. Is purchase sent correctly? The reviewed code requests the documented event with a validated paid-order payload, and tests pass. This session cannot certify actual live delivery.
5. Are successful payments accurately recorded in GA? Payload arithmetic is verified, but completeness and Google receipt are not proven. Browser-only events can miss database-paid orders; reconcile using real transaction IDs before claiming completeness.
6. What manual steps? Confirm the existing purchase key event, verify receipt, and link/import into Ads only if required, using the paths above rather than visual tagging.
7. What code changes? No production changes or GTM dependency; only focused regression coverage and documentation.

## Official Sources

- [Visual tagging in Tag Assistant](https://support.google.com/tagmanager/answer/17096871): the guided order-confirmation scan specifically looks for a GTM container.
- [Set up purchase with the direct Google tag](https://developers.google.com/analytics/devguides/collection/ga4/set-up-ecommerce): direct gtag.js is a supported ecommerce implementation.
- [Ecommerce measurement](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce): purchase items/value and shipping semantics.
- [Mark events as key events](https://support.google.com/analytics/answer/13128484): purchase is a default key event; key-event classification does not create the underlying payment event.
- [Create Ads conversions from GA key events](https://support.google.com/google-ads/answer/10632359): linked-account prerequisites and Analytics conversion-management flow.
- [Manage imported conversions](https://support.google.com/google-ads/answer/2375435): Ads settings, counting and reporting differences.

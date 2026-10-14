# Meta Purchase Audit and Verification

## Evidence and Root Causes

The code audit found one explicit browser Purchase call in checkout and one CAPI sender invoked by Cashfree finalization. The root layout initializes the Pixel and reports PageView; it does not explicitly report Purchase. No GTM installation or additional manual Pixel installation was found in the repository.

The read-only production audit on 14 October 2026 found Pixel and CAPI enabled for the same data source, no test event code configured, and 20 recent paid orders marked as sent. Their saved totals were numeric. These markers record the existing sender's acknowledgement, not a new Events Manager verification.

Confirmed identifier collision: the deleted INR 1 test orders GG0054 and GG0055 used purchase-GG0054 and purchase-GG0055. These display numbers were subsequently reused by different INR 1399 orders, and their stored tracking identifiers reused the same strings. Different real purchases could therefore be paired under the same event ID with different values. New events now use the immutable database order ID. Identifiers already used by historical events are preserved to avoid reporting them again under a new identity.

The browser previously used a generic cart payload builder, accepted fallback cart totals, and lacked refresh protection. That builder substituted the item sum when the provided value was zero or invalid. The CAPI sender used Number(order.total || 0), which substituted zero for missing totals and could serialize non-finite values to null. Purchase reporting now rejects invalid totals and uses one canonical paid-order payload for both channels, including the persisted grand total and INR currency.

Both explicit implementations already included INR. The live public Pixel configuration additionally opted into InferredEvents, SmartSetup and SmartSetupTotalPriceExtraction. This confirms additional automatic sources are enabled, but does not establish which specific event produced each diagnostic sample. The integration now calls the supported autoConfig false command before init, keeping all existing manual events. Events Manager's automatic event settings and any Event Setup Tool Purchase mappings still require inspection. Missing fields reported for other server integrations cannot be attributed to this application's CAPI without the sampled event details.

The old CAPI source URL was NEXTAUTH_URL/the site root. That explains homepage URLs in server diagnostic samples without proving a Purchase occurred on the homepage. New CAPI events identify /checkout, without customer or payment identifiers in the URL.

## Corrected Behavior

| Area | Result |
| --- | --- |
| Amount and currency | Saved paid order total in rupees, including shipping; INR matches Cashfree order_currency. No amount or unit conversion from the cart or gateway metadata. |
| Product details | Product IDs, saved quantities and saved item prices are shared by Pixel and CAPI. Invalid optional item entries are omitted; they never redefine the order amount. |
| Browser | Reports only the canonical payload returned by successful payment verification; validates payment status, total, currency and identity. |
| Browser refresh | Per-Pixel/event-ID receipt markers plus in-memory protection. Storage-blocked browsers retain the same ID for Meta deduplication. Receipts older than 48 hours do not create a fresh browser conversion. |
| Pixel readiness | Verified Purchase is queued until the configured Pixel is ready. Purchase uses trackSingle for the intended data source. |
| Server retries | Atomic paid-order claim; existing identifiers preserved; same payload/ID on transient retry; ten-second request timeout and at most two attempts. |
| Interrupted sender | Stale claims can be recovered on subsequent payment verification/webhook invocation after five minutes. There is no new background replay job. |
| Acknowledgement | Sent marker written only after events_received equals 1. Errors release the claim and record a sanitized reason. |
| Matching data | Existing hashed matching fields retained. Ten-digit Indian phone numbers normalized with country code before hashing. No access tokens in request URLs or application logs. |
| Purchase time | Saved paidAt, never a receipt refresh timestamp. |
| Payment | Cashfree's authenticated Get Order response remains authoritative; redirect or webhook payload alone does not prove payment. This webhook route does not currently validate a signature, but finalization independently verifies status through Cashfree. Payment behavior was not changed. |
| Other events | Existing PageView, ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo, Search and custom event implementations retained. |

The implementation follows Meta's official SDK field definitions for numeric custom_data.value, currency, event_id, event_time, action_source and event_source_url. Graph API version v26.0 matches Meta's current official Business SDK configuration. Meta developer documentation URLs returned HTTP 429 during the audit; the public official SDK and Pixel runtime were available for verification.

## Files and Functions

- src/lib/metaPurchase.js: buildMetaPurchase, purchaseAmount, isValidMetaPurchase.
- src/lib/metaPixel.js: trackVerifiedMetaPurchase, flushMetaPurchases and guarded trackMetaEvent.
- src/lib/metaConversionApi.js: buildPurchasePayload and sendMetaPurchaseEvent.
- src/lib/cashfreeOrderFinalization.js: responseForOrder adds the safe tracking snapshot; payment/stock logic unchanged.
- src/components/meta/MetaPixelClient.js: initialization disables automatic setup and flushes verified pending purchases.
- src/app/checkout/page.js: showSuccessfulOrder reports the verified snapshot instead of a cart-derived Purchase.
- scripts/test-meta-purchase.cjs: isolated regression tests, all conversion and payment requests mocked.

## Tests

Run from the repository root:

```text
node --test scripts/test-meta-purchase.cjs scripts/test-image-reliability.cjs
npm run build
```

Coverage includes discounts, shipping, quantities, variants, distinct totals, zero values, major/minor units, invalid values, missing currency configuration, failed/pending/cancelled/refunded payments, recycled order numbers, legacy identifiers, browser refresh, blocked storage, Pixel readiness, intended data source, initialization count, other manual events, duplicate/concurrent CAPI invocations, transient HTTP and network failures, unaccepted responses, stale claims, matching hashes, actual purchase time, verification-response eligibility, and mocked Cashfree finalization with stock/order-number idempotency. These are local simulated tests, not real Meta Test Events or real payment verification results.

Results on 14 October 2026: 32 Purchase/payment tracking tests and 13 existing image reliability tests passed (45 total). The production Next.js build passed. No real payment or Meta conversion was generated by these tests.

Follow-up audit: browser Purchase queues now recheck the 48-hour receipt window when flushed, so an old queued receipt cannot fire after a long delay. The server-only test_event_code is no longer appended to browser event parameters. Product/cart event builders preserve explicit zero amounts and prices, normalize numeric overrides, and keep the site's INR currency. Invalid optional monetary values are omitted rather than guessed, and invalid item prices cannot serialize as null; Purchase retains its stricter rejection rules. Meta browser account verification could not begin because browser discovery returned no connected browser. The user subsequently deferred live Meta verification and requested completion of the code audit only. The optional live verification instructions below remain available; no Meta Test Events result is claimed.

Follow-up results: all 50 tests passed (37 tracking/payment tests and 13 image regressions). The final production build passed. A read-only check of the deployed checkout bundles confirmed the prior verified-Purchase and automatic-configuration commands were present; reading these bundles generated no conversion or payment requests.

## Deployment and Events Manager Verification

1. Deploy the commit through the existing Hostinger pipeline. No seed command, admin password reset, database migration, or historical event replay is required.
2. In Events Manager, select the existing data source and open Settings. Review Track Events Automatically Without Code and Event Setup Tool rules. Disable/remove duplicate Purchase triggers for this site; retain intentional non-Purchase mappings only if they do not duplicate the site's manual events. Also inspect connected integrations for any independent server Purchase sender.
3. Open Test Events. Use an isolated staging deployment with Cashfree sandbox credentials for a controlled successful transaction. Use the provided server test event code in the existing admin configuration. Keep live production Cashfree settings unchanged.
4. Open the test checkout through Meta's Test Browser Events flow. Complete the controlled transaction. Check the browser request: Purchase, cd[value], cd[currency]=INR and eid. Check the server event: custom_data.value, custom_data.currency, event_id and order_id. Value and identifier must match exactly, and both must belong to the same data source.
5. Confirm Pixel and CAPI are paired/deduplicated. Refresh the receipt, repeat verification, and retry the sandbox webhook; these must not create independent conversions. Visit homepage, product, cart and an unpaid checkout; these must not create Purchase.
6. Check Hostinger logs for Meta Purchase accepted with order number, ID, value and currency. Failures are recorded in the existing order metaConversionPurchaseError field. Do not publish access tokens, customer matching data, cookies or request bodies.
7. Clear the server test event code after sandbox verification. Observe the next genuine production order's paired event in Events Manager; do not create fake production purchases or resend historical customer events.

Meta account Test Events and fresh production events remain unverified until these steps are executed. Historical diagnostics may take time to update after corrected new events arrive; the code does not erase historical warnings or collisions.

Official references:

- https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/custom_data.py
- https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/event.py
- https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/apiconfig.py
- https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/
- https://developers.facebook.com/docs/marketing-api/conversions-api/using-the-api/
- https://developers.facebook.com/docs/meta-pixel/implementation/conversion-tracking/

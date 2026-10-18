# Purchase confirmation reliability

The existing checkout implementation is shared by three route wrappers. `/checkout` retains address and payment entry. Cashfree returns to `/checkout/return?cashfree_order_id=...`; verified payment then opens `/checkout/success?cashfree_order_id=...`. Confirmation rechecks ownership and payment before showing the existing receipt and reviews. Old `/checkout?cashfree_order_id=...` links redirect to the new return route. No order migration or database rewrite is required.

## Safeguards

- Browser verification requires the signed-in customer to own the order. Verification responses are not cacheable.
- Webhooks require Cashfree's HMAC-SHA256 signature over the timestamp plus the exact raw request body, using the existing configured Cashfree secret. Payment is independently checked with Cashfree's server API.
- A paid response must match the stored order identity, INR currency and total. A stale ACTIVE response cannot write a paid order back to pending. Refunded payments are not reactivated.
- The browser retries temporary verification failures four times, with bounded request timeouts. Further checks verify the same payment rather than creating another payment. A synchronous lock prevents double-click initiation.
- The confirmation URL identifies the order for reloads; every visit is reverified on the server. The existing account-scoped session reference remains a compatibility fallback. It expires after 72 hours, contains no address or uploaded images, and does not override a new nonempty cart with an old completed receipt. Receipt revisits do not clear the customer's current cart.
- New payment attempts validate prices using the existing catalog, variant, offer and gift-pack rules. Existing order prices and shipping amounts are not rewritten. No data migration, seed or deletion is required.

## Tracking delivery

- GA4 still requires explicit analytics permission and honors withdrawal, DNT and GPC. No permission is fabricated and activity collected without permission is not replayed after a later grant.
- A verified, consented purchase awaiting SDK processing has a bounded, sanitized local outbox. It can resume after reload with the same transaction ID. A callback records SDK processing, not guaranteed receipt in Google's reports. Google transaction deduplication remains necessary if an interrupted dispatch is retried.
- Meta Purchase waits for the real Pixel SDK instead of marking its loading stub as sent. Pixel/CAPI continue to share purchase identity, value and currency.
- Browser Purchase events are dispatched only after verified confirmation. GA4 sanitizes the order query out of page locations and avoids double-counting automatic/manual confirmation page views. CAPI uses the canonical `/checkout/success` source URL without an order identifier. Consent behavior is unchanged.
- Transient CAPI failures and active delivery claims cause the signed webhook to return HTTP 503 after the order has been finalized. Cashfree can redeliver the webhook; the existing paid-order and CAPI claim guards prevent another stock deduction or a second independent conversion. Customer confirmation is not failed solely because advertising delivery failed.

## Deployment verification still required

Confirm signed Cashfree webhook delivery and its retry policy in the merchant dashboard. Webhook retries are finite; this is not an unlimited background retry scheduler. Failed permanent Meta configuration must be corrected before replaying a signed webhook.

Verify with Cashfree sandbox, GA4 DebugView/Realtime and Meta Test Events: success, pending, cancellation, duplicate webhook, simultaneous browser/webhook verification, reload, blocked SDK, withdrawal and failed redirect. Check final order number, stored amount, stock, transaction/event IDs and accepted revenue against the database. Do not generate real chargeable payments for testing.

GA4 remains browser-based: if a customer never reaches verification/confirmation, this change cannot guarantee a GA4 Purchase. Server-side GA4 delivery would require a separate consent-aware Measurement Protocol configuration and session attribution design. A browser callback or a passing mock test must not be described as proof that Google or Meta received a live conversion.

The existing stock-deduction implementation is retained. Converting inventory, counter and order writes into a single database transaction is a separate persistence change; this patch does not claim to remove that previously identified failure window.

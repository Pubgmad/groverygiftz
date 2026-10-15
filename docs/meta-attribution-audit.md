# Meta Attribution and Consent Audit

Audit date: 15 October 2026. This supplements [the Purchase audit](./meta-purchase-audit.md); it does not replace its canonical amount, payment verification or event identity policy.

## Confirmed Root Causes and Results

| Area | Previous Issue | Root Cause | Correction Implemented | Test Result | Status |
| --- | --- | --- | --- | --- | --- |
| Meta Pixel | Consent and attribution unverified | SDK loaded without an explicit marketing choice | Default off; explicit Accept/Reject; footer preferences; GPC/DNT honored; one existing SDK | Consent gates and SDK initialization tested | Local verification passed; live reception unverified |
| Conversions API | Missing website browser context | Sender had order/customer data, not original browser metadata | Private consented metadata captured before redirect and selected explicitly by sender | Payload and mocked sender tests passed | Implemented; live reception unverified |
| Click ID fbc | Missing server-side | No original cookie/landing capture in the order flow | Validate actual cookie or genuine same-origin fbclid; include raw fbc in user_data | Ad/non-ad landing, existing/repeated/new click and malformed values tested | Implemented for eligible consented visits |
| Browser ID fbp | Coverage unverified | Existing SDK cookie not passed into server events | Capture valid existing _fbp unchanged; existing Pixel remains its sole generator | Raw cookie preservation and absence tested | Actual browser cookie creation still requires browser verification |
| Customer information | Formatting incomplete | Matching covered fewer fields; country-code handling incomplete | Normalize/hash available email, phone, first/last name, city, state, postcode, country and stable customer ID | Normalization, SHA-256 and no-double-hash tests passed | Implemented; no DOB/gender collected |
| Event deduplication | Recycled display IDs and independent paths | Historical deleted display order numbers reused | Retain canonical immutable order ID + Purchase name; keep legacy sent IDs; same data source | Matching browser/server ID, name, value and currency tested | Prior fix retained and tested |
| Purchase value | Historical browser/server mismatch | Cart-derived fallback versus saved order amount | Canonical paid order grand total in rupees, including saved shipping/discount effects | Discounts, shipping, quantities, variants, zero and minor units tested | Prior fix retained and tested |
| Purchase currency | Historical missing/inconsistent diagnostics | Automatic event sources also enabled; exact offending samples unavailable | Canonical INR; manual verified Purchase only; autoConfig false | Payload validity and automatic initialization tested | Code verified; external mappings unverified |
| Payment event timing | Must not report unpaid orders | Redirect alone is not proof of payment | Existing authenticated Cashfree GET remains authority; only paid final orders eligible | Paid/pending/failed/cancelled and finalization regressions passed | Existing commerce behavior preserved |
| Duplicate events | Refresh/webhook/retry risk | Multiple delivery paths and interrupted requests | Existing atomic claim, acknowledgement marker, stable retry ID, browser receipt guard | Concurrent/duplicate calls, retry, timeout, stale locks and refresh tested | Application idempotency verified locally |
| Existing functionality | Risk of unrelated changes | Tracking intersects checkout/payment | Add only private tracking metadata and optional consent recovery; tracking failures do not prevent verification | Checkout auth/totals, stock/order-number idempotency and existing image tests passed | Targeted regression verification, not a full physical-device audit |

The diagnostic percentages in the request are historical; no new percentages or cleared warnings are claimed. No extra explicit Pixel, GTM installation or independent CAPI sender was found in the repository audit. External Events Manager/partner mappings cannot be fully audited from source code.

## Architecture and Policies

1. Before a choice, do not load Pixel or emit manual marketing events. Accept permits tracking; Reject, GPC and DNT block it. Login/cart/session cookies are not cleared. Shopping and payment do not require marketing consent.
2. After acceptance, capture a genuine landing fbclid in the documented fbc format. Preserve a valid existing cookie unless a different genuine click arrives. Without a click/cookie, omit fbc. Never create a random click ID. Existing Pixel owns fbp; CAPI-only mode does not manufacture fbp.
3. At authenticated order creation, read browser cookies and actual request User-Agent, not body-supplied attribution. Capture IP only from explicitly verified/configured trusted proxy headers. Save a private optional metaAttribution subdocument before leaving for Cashfree. Do not send that metadata to Cashfree or the customer's order response.
4. After Cashfree independently confirms payment, build both channels from the same paid-order snapshot. Purchase value is the persisted final grand total in INR rupees, not subtotal, formatted text, paise or a refreshed cart total. Failed/pending/cancelled payments do not emit Purchase. Offline order creation remains disabled; no COD policy or new payment method is introduced.
5. The webhook uses the saved original browser metadata, not the gateway's User-Agent/IP. If consent/required browser metadata is absent or expired, skip CAPI rather than fabricate it. An authenticated owner can recover missing legacy metadata during actual browser verification; a denied choice revokes it. Historical paid orders are not bulk replayed.
6. Customer fields use SHA-256 once; fbc, fbp, IP and User-Agent remain unhashed. external_id uses the stable registered customer ID, not the order ID or browser. It is server-only here: no undocumented dynamic Pixel user-data command or unsupported browser ID matching is introduced. Primary pairing remains event name + event ID.
7. Withdrawal immediately blocks browser events, clears only advertising cookies and queued purchases, and requests revocation of that customer's unsent server metadata through a same-origin authenticated endpoint. Guest withdrawal cannot change another customer's orders. Already delivered or in-flight external requests cannot be recalled. A failed/offline withdrawal request cannot guarantee revocation on the remote server; the endpoint returns failure rather than claiming server success.
8. Metadata expires after seven days and is removed immediately after Meta acknowledges acceptance. Expired metadata is excluded from payloads even before cleanup. A throttled daily sweep on subsequent site traffic unsets expired metadata only; it is not a scheduler or an order-deleting TTL. With no site traffic, physical cleanup waits until the next request. Order/payment records and sent-event markers remain intact.
9. Browser events retain the existing 48-hour receipt-age guard and per-data-source/event-ID receipt markers. Meta's actual pairing also depends on its receiving window; the application cannot guarantee delivery if blockers/network issues prevent it. CAPI retries retain the same payload/ID. Repeated payment verification/webhooks can retry released/stale claims; no background replay service is added.

## Official References and Parameter Builder Review

The requested [deduplication documentation](https://developers.facebook.com/documentation/ads-commerce/conversions-api/deduplicate-pixel-and-server-events) and [customer information documentation](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters) were attempted but were not accessible through the research tool. The documented event name/ID and hashing requirements in the request were retained, and these accessible official implementations were inspected:

- [Meta Parameter Builder](https://github.com/facebook/capi-param-builder) and [Node integration](https://github.com/facebook/capi-param-builder/blob/main/nodejs/README.md).
- [Node parameter implementation](https://github.com/facebook/capi-param-builder/blob/main/nodejs/capi-param-builder/src/ParamBuilder.js) and [format constants](https://github.com/facebook/capi-param-builder/blob/main/nodejs/capi-param-builder/src/model/Constants.js).
- [Official Business SDK normalization](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/normalize.py).

Parameter Builder supports Node, but would introduce a second cookie generator/proxy-handling path alongside the installed Pixel. It is not installed. The narrow shared validator accepts the basic format and the official language/version appendices inspected in that repository (legacy language suffix and version-one six-byte appendix), preserving those values unchanged. Future official format changes should be reviewed, not accepted indiscriminately. Proxy trust stays explicit rather than adopting forwarded headers blindly. No extra tracking dependency or SDK was added.

## Sanitized Payload Examples

Before: the server event included hashed order contact fields and custom_data, but no fbc/fbp/client_user_agent. The earlier cart fallback/reused display-number issue is illustrated in the Purchase audit. Do not infer which historical diagnostic sample came from which source without Meta's sample.

After, illustrative eligible consented event (not transmitted test data):

```javascript
fbq('trackSingle', '<configured-pixel-id>', 'Purchase',
  { value: 1499, currency: 'INR', order_id: '<display-order-id>' },
  { eventID: 'purchase-<immutable-order-id>' });
```

```json
{
  "event_name": "Purchase",
  "event_id": "purchase-<immutable-order-id>",
  "event_time": "<actual saved paidAt in Unix seconds>",
  "action_source": "website",
  "event_source_url": "https://groverygiftz.in/checkout",
  "user_data": {
    "em": "<SHA-256 normalized registered email>",
    "ph": "<SHA-256 country-code-normalized phone>",
    "external_id": "<SHA-256 stable customer ID>",
    "fbc": "fb.1.<actual creation milliseconds>.<genuine click ID>",
    "fbp": "fb.1.<actual creation milliseconds>.<existing SDK browser ID>",
    "client_user_agent": "<original browser request User-Agent>"
  },
  "custom_data": { "value": 1499, "currency": "INR", "order_id": "<display-order-id>" }
}
```

Placeholders are explanatory, not valid literal payload values. Real values are numeric where required. Optional identifiers are omitted when unavailable; the additional normalized contact fields and contents are supplied when valid. IP is included only after trusted proxy configuration. Do not publish complete production request bodies, cookies, hashes or access tokens.

## Files in This Change

- src/lib/metaAttribution.js: browser/shared cookie validation, genuine landing capture and consent operations.
- src/lib/metaAttributionServer.js: original request capture, proxy validation, authenticated recovery and metadata-only expiry sweep.
- src/lib/metaCustomerData.js: customer normalization/hashing and permitted browser metadata builder.
- src/models/Order.js: private optional metadata subdocument, no migration or order TTL.
- src/app/api/orders/create-cashfree-order/route.js: persist tracking metadata before redirect.
- src/app/api/orders/verify-cashfree-payment/route.js: optional owner-only attribution recovery/revocation, without blocking payment verification.
- src/app/api/meta/consent/route.js: same-origin unsent metadata withdrawal.
- src/lib/metaConversionApi.js: raw browser identifiers combined with hashed matching, consent gate, clear metadata after acknowledgement.
- src/lib/metaPixel.js: consent gates for all existing browser event entry points.
- src/components/meta/MetaPixel.js: expose whether either existing tracking channel is enabled and run throttled expiry maintenance.
- src/components/meta/MetaPixelClient.js: consent-dependent existing SDK and responsive preference prompt.
- src/components/meta/MarketingPreferencesLink.js and src/components/layout/Footer.js: reopen marketing preferences.
- scripts/test-meta-attribution.cjs and scripts/test-meta-purchase.cjs: real helper/route source exercised with isolated browser/DB/provider/Meta fixtures.
- docs/meta-attribution-audit.md: this report. The existing image reliability suite is unchanged.

No auth credential provider, admin hash/seed, product, price/stock/shipping calculation, cart/wishlist merge or order status implementation is modified.

## Verification and Deployment

```text
node --test scripts/test-meta-attribution.cjs scripts/test-meta-purchase.cjs scripts/test-image-reliability.cjs
npm run build
```

- Automated local results: 82 tests passed, zero failures. These exercise actual source with controlled fixtures, not real provider calls. Android/iOS/desktop cases validate representative User-Agent persistence, not physical browser execution. Withdrawal between a failed send and its retry prevents the retry.
- Production Next.js build: passed. An existing stale Browserslist database warning is unrelated to tracking.
- No connected browser was available for visual/mobile interaction testing. The prompt uses constrained width, two equal action columns and wrapping text, but physical viewport checks are not claimed.
- Meta Test Events: not verified; no connected authenticated Meta data source or staging sandbox was available. Production event reception/deduplication and historical warning clearance: not verified. No real payment or fabricated production conversion was generated.

Deployment does not require npm run seed, admin password changes, migrations or historical event replay. Existing admin Pixel ID/token settings remain the source of truth. Deploy via the existing pipeline and check Hostinger deployment/runtime logs. Keep test event codes out of ordinary production reporting.

For IP coverage, first confirm which client-IP header Hostinger's trusted ingress overwrites, including its exact proxy chain. Only then configure META_TRUSTED_CLIENT_IP_HEADER to x-real-ip, cf-connecting-ip or x-forwarded-for. The last option also requires META_TRUSTED_PROXY_HOPS (1-10, counted from the right). Do not guess these settings from the browser or from user-supplied forwarding headers. Without verified configuration IP is intentionally omitted; User-Agent and other eligible fields remain usable.

The operator should review the existing privacy policy to disclose consented Meta measurement, sharing of hashed matching information, cookie lifetimes (advertising identifiers up to 90 days; consent choice 180 days), server metadata retention and withdrawal behavior. This implementation is not a claim of legal compliance in every jurisdiction.

For external verification, follow the Events Manager procedure in the Purchase audit: review automatic/partner Purchase mappings, use a controlled staging Cashfree sandbox payment and Meta test-event code, and inspect both channels for identical IDs, name, INR value and intended data source. Test genuine ad attribution where available, direct traffic, Reject/withdrawal, failed payments, receipt refresh and webhook retries. Verify no Purchase on unrelated visits. Monitor new accepted/failure records and fresh Meta diagnostics after deployment; historical percentages may lag and blocked/denied traffic must not be bypassed to improve coverage.

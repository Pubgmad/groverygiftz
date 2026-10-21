# Meta Manual Advanced Matching

## Scope

Browser advanced matching now uses the authenticated customer record. A private, no-store GET `/api/meta/matching` endpoint reads only `_id name email phone` for the current session customer. It returns SHA-256 email, phone, first/last name and stable account ID hashes where available. It never uses an order's gift recipient, arbitrary request/customer IDs, scraped form inputs or saved delivery addresses. Hashes remain personal data, not anonymous data.

No authentication callbacks, credentials/hashes, customer/order schemas, payment/stock code, shipping code, Google Analytics or marketing-permission defaults were changed. No database mutation or seed is part of this implementation. The endpoint is read-only.

## Permission and identity boundaries

Both browser and endpoint honor the existing Meta permission mode, explicit rejection, GPC and DNT. Disabled Pixel settings, admin/guest sessions, missing accounts and database failures do not expose matching data. Raw identity and Meta access tokens are not returned. Matching data is not placed in local/session storage, cookies, event custom parameters or URLs.

The Pixel is initialized once without identity; once the current account response arrives, the supported `fbq('init', pixelId, userData)` path enriches that initially empty identity. The current SDK permits this only while its existing manual identity is empty. Repeated successful responses for the same account do not repeatedly initialize it. Automatic form matching is opted out so manually supplied account data is the source for this feature. Base events are not held up by a failed matching request; events already sent before matching resolves cannot be enriched retroactively.

Meta's generic current SDK does not provide a safe arbitrary-user reset through `set userData` (that setter is gated to particular integrations). On logout/account switch, withdrawal, admin entry, component unmount or a no-longer-owned matching response, application matching state and queued purchases are cleared, SDK consent is revoked and that SDK document is quarantined. The SDK's internal old identity cannot be claimed erased; it is prevented from being used by further application events. Tracking resumes in a fresh document, not by a forced redirect/reload. Normal existing full-page sign-in/sign-out behavior is unchanged. A purely same-document account change intentionally suppresses browser Pixel events until the next full load; eligible server CAPI is independent.

Requests are aborted on cleanup/supersession and time out after five seconds. Session identity, response identity, request generation, permission and mounted state are checked before applying a response. Focus retries recover optional matching failures. Temporary session loading blocks event dispatch without discarding an already queued verified purchase; definitive identity changes clear old-account queues.

## Missing-IP diagnostic

No client-IP trust setting or IP-header fallback was added. On this shared-hosting deployment there is no verified origin lock; `META_TRUSTED_CLIENT_IP_HEADER` must remain unset and no proxy hop count should be guessed. The existing default ignores forwarding headers. No visitor IP is fabricated, inferred from the browser, replaced with Cashfree/Hostinger's address or obtained through a third-party IP service. Genuine user agent and eligible hashed CAPI identity remain intact. This change does not promise to eliminate Meta's missing-IP warning. A trustworthy ingress is still required for trustworthy server IP attribution.

## Verification

`node --test scripts/test-meta-matching.cjs scripts/test-meta-purchase.cjs scripts/test-meta-attribution.cjs scripts/test-ga4.cjs scripts/test-checkout-reliability.cjs scripts/test-image-reliability.cjs scripts/test-central-delivery.cjs`

Matching tests execute the endpoint and client effect lifecycle with mocked sessions, database, requests and SDK. They cover authenticated field selection/hashing, privacy signals, failures, stale/unmounted/mismatched responses, identity quarantine, SDK initialization, no duplicate PageView and unchanged verified-purchase behavior. They do not create a real Meta conversion, charge a customer, modify production MongoDB or inspect a signed-in Events Manager session.

Final local verification: all 200 tests passed, including 13 matching-specific tests; the Next.js production build passed. Changed/new files passed the common encoding-corruption scan. There was only the existing outdated Browserslist data warning.

A local production-server smoke check returned HTTP 401 and an empty matching object for an unauthenticated request, with `private, no-store` and `Vary: Cookie`. This workspace has no configured NextAuth runtime secret, so the smoke-test process used a disposable process-only secret and localhost URL; no environment file, production setting or admin password/hash was changed.

The public Meta Pixel SDK at `https://connect.facebook.net/en_US/fbevents.js` was inspected on 2026-10-21 to verify the initially-empty init enrichment and integration-gated userData setter. Final acceptance still requires deployed browser/Pixel Helper and Meta Test Events verification for fresh opted-in/otherwise-eligible customer sessions. Existing historical diagnostics are not proof that a fresh event failed, and no zero-warning or perfect-attribution guarantee is made.

# GA4 Integration and Verification

Current consent behavior is documented in [GA4 Purpose-Specific Consent Correction](ga4-consent-correction.md). It supersedes the automatic Google consent policy described in this earlier integration audit; the historical audit below is retained for context.

Date: 15 October 2026. Measurement ID: **G-JNPXLZQB0V**. No new property, dependency, Google Tag Manager container, database field or admin setting was created.

## Activation Prerequisite

**Enhanced Measurement OFF was confirmed by the operator's screenshot on 15 October 2026 for G-JNPXLZQB0V, stream ID 16133425918. Keep the web stream enabled.** The application uses manual page views and allowlisted ecommerce events. Google documents that send_page_view=false does not disable Enhanced Measurement's history events. Automatic search/form/file/link events can also bypass the application's privacy filtering. The website cannot change the property's settings without authorized Google account access. The screenshot resolves the predeployment settings confirmation; actual collection still requires live verification.

Exact steps: Google Analytics > Admin > Data streams > select the stream with measurement ID G-JNPXLZQB0V > turn the Enhanced measurement master switch OFF > Save, if shown. This replaces the earlier instruction to disable only browser-history changes, forms and search individually. Do not disable the stream or remove the Google tag destination. Do not install the provided snippet a second time in Hostinger, GTM or an individual page.

Read-only public configuration evidence on 15 October 2026, rechecked after the operator's confirmation: Google's SDK URL for this measurement ID returned HTTP 200 and contained the correct stream ID, with vtp_enableHistoryEvents, vtp_enableForm, vtp_enableDownload, vtp_enableOutboundClick, vtp_enableVideo, vtp_enableScroll and vtp_enablePageView all true. A second request with a unique query parameter and Cache-Control: no-cache returned the same configuration. The resource also contained an enabled __ogt_1p_data_v2 tag with automatic email, phone and address detection enabled. Its initialization rule included both the automatic-event and first-party-data tags. These are apparent configuration risks, not proof of actual event delivery or personal-data transmission. The script was downloaded as text, not executed; no pageview or conversion was sent. These generated internals are audit evidence only, not an application dependency. The operator subsequently supplied a screenshot confirming the exact stream and Enhanced Measurement OFF. Raw generated flags do not override that UI evidence or establish actual runtime collection. Publishing delay or other configuration layers remain possible explanations, not verified causes. Proceed with deployment based on the confirmed UI setting and inspect actual events afterward.

Also review Admin > Data streams > this stream > Configure tag settings > Allow user-provided data capabilities. Disable automatic detection for this implementation: manual ecommerce does not require names, emails, phone numbers or addresses. This is separate from Enhanced Measurement. Denied advertising-user-data consent is already set by the application, but does not replace reviewing the property's configuration.

## Measurement Quality and Scope

The recommended baseline for this personalized-upload store is controlled manual page, product, cart, checkout and verified-purchase measurement, with safe campaign parameters and no duplicate automatic senders. Enhanced Measurement OFF does not disable these manual events or the web stream. It is not universally necessary for every website, and is not a claim that every automatic feature is unsafe.

Scroll depth and supported embedded-video events are optional metrics not manually implemented here. They can be considered separately after the baseline is verified; leaving them off initially sacrifices those optional metrics, not ecommerce instrumentation. Automatic file/link/form collection should not be enabled indiscriminately on pages containing private customer uploads.

Reporting is not complete simply because the build passes. Analytics storage now follows the store's existing automatic/strict tracking policy, described below. Explicit opt-outs and strict unknown choices remain blocked. Browser blocking and customers not returning from payment can prevent browser-only Purchase delivery. Server-side GA purchase reporting and authenticated cross-device user linking are not implemented and must not be implied by account/cart cross-device functionality. These limitations remain explicit rather than being hidden behind a production-ready claim.

## Empty Dashboard Investigation - 15 October 2026

Confirmed code-level mismatch: the original GA implementation allowed the SDK/events for an unknown visitor in the store's automatic mode, but always set analytics_storage=denied until a saved grant existed. The automatic flow does not request a choice, so this state could persist indefinitely. Google's denied-state pings are not a substitute for ordinary observed traffic in reports; reporting/modeling has eligibility requirements. This can explain an empty dashboard and was missed by tests that asserted denied storage as the intended default. Without a connected browser, it is not evidence that every missing live event had this single cause.

The targeted correction uses the same existing policy for analytics storage and event eligibility: automatic mode permits analytics storage unless opted out; strict mode requires a saved grant. This applies consistently to Google consent defaults/updates, purchase receipt markers and the Google login intent. No consent-choice cookie is fabricated, no new popup is added, and advertising storage/user data/personalization remain denied. The store operator must ensure the selected automatic policy is appropriate for its visitors; this implementation change is not a legal-compliance assertion.

New regression tests cover fresh automatic visits, purchase refresh deduplication without a saved choice, Google login intent in automatic mode, strict unknown visitors, real grant/rejection transitions, DNT and GPC. Actual Google request receipt and property filters still require browser/Google-account verification. Do not turn Enhanced Measurement back on as a workaround.

## Implementation Report

| Component | Implementation | Verification | Status |
| --- | --- | --- | --- |
| Google tag installation | One next/script instance and one js/config initialization per document; afterInteractive loading | Initialization/id tests and production build passed | Code verified locally; live tag reception pending |
| Page views | Manual direct/SPA views with safe URL, title and referrer; confirmation is a virtual screen | Repeated renders, route/query changes, return-query cleanup and context scope tested | Google Enhanced Measurement must be OFF; Realtime/DebugView pending |
| Product views | Catalog/selected-variant view_item; visible list-card impressions and real selections | Actual ID/name, price, variant, list/index and per-visit guards tested | Local tests passed; physical-browser validation pending |
| Add to Cart | Actual successful CartContext mutation and quantity delta, after stock caps | Real CartContext source exercised; no event for a capped no-op | Local tests passed |
| Checkout | Ready authenticated checkout, validated address confirmation, provider-ready payment method | Payload tests, source guards and existing checkout/payment regressions passed | Local tests passed; sandbox E2E pending |
| Purchase | Safe snapshot from Cashfree-verified paid order; browser-only reporting | Merchandise value, shipping, items, INR, stable transaction ID and duplicate/retry guards tested | Local tests passed; Google receipt/dedup pending |
| Campaign attribution | Safe UTM/click parameters retained in measurement URL; actual URL untouched | URL/referrer filtering and preservation tested | Acquisition reports pending; privacy restrictions affect attribution |
| Privacy and consent | Existing preferences read without modifying Meta; no new banner, no invented storage grant | Unknown/granted/denied/GPC/DNT/strict-mode and withdrawal tests passed | Local tests passed; operator policy/legal review remains required |
| Meta tracking | Existing SDK, fbc/fbp, matching data, ID/value policy and CAPI sender unchanged | Existing Meta suites passed; paired response test checks both value policies | Regression tests passed; no new live Meta verification claimed |
| Website functionality | Analytics side effects only; no awaited tracking in commerce handlers | Existing image/payment/stock/order tests and production build passed | Targeted regressions passed, not a full physical-device certification |

## Audit and Installation

The repository uses Next.js 14.2.35, React 18 and the App Router. The root layout is src/app/layout.js. No preexisting gtag, dataLayer, Google Analytics tag, Google Tag Manager container or additional analytics library was found in src. Existing Meta initialization remains mounted separately.

GoogleAnalytics is mounted once in the root layout, inside the existing providers and a Suspense boundary. It uses the framework-supported nonblocking next/script strategy. The SDK initializes the supplied measurement ID, not a new ID. Admin paths /admin and /account/manage are excluded; a public-to-admin SPA transition disables this GA destination. Customer account/authentication pages are included without sending account identity.

The initial config sets send_page_view=false and disables Google signals/ad personalization. Page context is set before config, not frozen at the higher-priority config scope. SPA updates use set and explicit event parameters; config is not repeated. Each event explicitly targets the supplied measurement ID. A bounded in-memory queue retains up to 100 eligible events while the SDK loads, for at most 30 minutes. SDK failures do not block checkout, change the cart or wait for analytics.

## Events and Trigger Conditions

| Event | Actual trigger |
| --- | --- |
| page_view | Direct public page or committed pathname/query navigation, once per current URL; sensitive query values are not transmitted |
| view_item_list | A shared product card becomes visible; catalog-backed list ID/name and displayed index accompany the item |
| select_item | Genuine shared product-card navigation; prevented wishlist-button clicks are excluded |
| view_item | Product detail/selected catalog variant is displayed; repeated render of the same selection is suppressed |
| add_to_cart | Cart state successfully receives an item or an actual positive quantity delta after stock capping; Buy Now shares this path |
| remove_from_cart | A real line removal or negative quantity delta; payment clearCart and missing-line removals are not removal events |
| view_cart | Restored cart page or cart drawer opening; quantity edits do not repeatedly count a cart impression; an empty cart view is valid |
| begin_checkout | Authenticated customer has a ready, nonempty cart and enters checkout, not a payment-return verification; consent grant can retry a previously blocked eligible impression |
| add_shipping_info | Existing address validation succeeds and customer continues to payment; no address fields are sent |
| add_payment_info | Existing order creation and Cashfree SDK readiness succeed immediately before payment begins; method is Cashfree, with no card or gateway IDs |
| purchase | Successful payment verification returns a valid paid/final order GA snapshot; no cart-total or redirect fallback |
| sign_up | Email registration API succeeds; not a submit click or failed duplicate registration |
| login | Credentials sign-in succeeds, including successful automatic sign-in after registration; Google requires an authenticated customer return with a fresh, once-consumed intent |
| search | Search results resolve and the term matches public result-title vocabulary after privacy validation; repeat effects are suppressed |

List impressions are per visible product, not one synthetic page-level event containing off-screen products. List context covers shop views, collections, home featured/collection sections, related products and search results through ProductCard. Other pages, including wishlist, retain page-view measurement; their unrelated UI/business behavior is not rewritten.

No refund event is emitted: a refunded enum/status exists, but no authoritative refund-completion workflow with confirmed amount/items and event idempotency was found. Cancellation/status changes are not treated as refunds. No fabricated offline/COD order tracking is added; offline creation remains disabled.

## Ecommerce Mapping and Value Policy

| GA4 field | Existing source |
| --- | --- |
| item_id | Product database ID / saved cart productId / saved order item.product |
| item_name | Public catalog title / saved original product title, with contact/URL-pattern rejection |
| item_variant | Selected catalog-option description, never custom note/upload fields |
| item_category | Available populated public category/collection name; omitted if unavailable |
| price | Displayed catalog/selected-variant unit price for views; actual saved unit price for cart/order events |
| quantity | Real line quantity or actual mutation delta; product/list views use displayed product quantity |
| discount | Known regular-unit minus discounted-unit price when available; not invented for saved orders lacking a regular-price snapshot |
| currency | INR, consistently numeric rupee amounts, no paise conversion or formatted price strings |
| transaction_id | Final display order number plus immutable order database ID; distinct from Meta's event ID and not a Cashfree payment identifier |
| purchase value | Sum of saved net unit price multiplied by quantity, excluding shipping |
| shipping | Saved shippingCost, separate from merchandise value |
| tax / coupon | Omitted: this order model has no authoritative separate tax/coupon fields or coupon flow to report |

The purchase builder requires merchandise value + saved shipping = saved total within one paisa. Invalid/missing amounts, empty orders, invalid quantities, pending/failed/refunded orders, non-final IDs and more than 200 line items are rejected for tracking rather than guessed or truncated. Commerce still works if analytics rejects a payload.

Example from controlled fixtures: two INR 500 items and INR 100 shipping produce GA value=1000, shipping=100, total paid=1100. Meta continues reporting its established grand-total policy, value=1100. This difference is deliberate; each integration follows its own documented semantics. Existing discounted prices and gift-wrap-in-unit-price behavior remain unchanged.

The existing /checkout page renders its success screen without a separate route. Analytics records that genuine verified screen as virtual /checkout/success, with a confirmation title. It does not navigate there or change browser history. Payment-return query cleanup cannot turn it into another checkout impression.

## Purchase Delivery and Deduplication

- The existing authenticated Cashfree verification remains the payment authority. The only finalization change is an additional safe ga4Purchase response snapshot. No stock, shipping, total, ID generation, order state or Meta payload policy changes.
- A queued/sent in-memory guard suppresses repeated React/API callbacks. Where the existing automatic/strict policy permits analytics storage, a per-property/transaction local marker also prevents refresh replay; markers expire logically after seven days and are physically pruned on the next permitted initialization. No GA purchase storage is read or written when analytics storage is not granted.
- The stable transaction ID gives GA a secondary deduplication key. The application's guards are not replaced by that key. With denied/unavailable persistent storage, cross-document deduplication is weaker: the existing return-query cleanup/cart-clear flow avoids ordinary receipt replay, memory guards handle same-document duplicates, and Google's transaction-ID processing is the fallback for repeated external returns. Cross-device duplicates and Google-side dedup behavior require live verification; no universal guarantee is claimed.
- Historical receipts older than 72 hours do not generate a new purchase; queued events recheck age. Payment webhooks do not send GA events. If payment succeeds but the customer never returns, closes the page before the tag is ready, or blocks the SDK/network, this browser-only implementation can miss the purchase.
- No Measurement Protocol channel was silently added. It would require an authorized server secret, suitable consented client/session attribution, and an explicit single-channel/idempotency design. Adding a second sender blindly would risk duplicate revenue.
- A local marker means submission to gtag, not a Google ingestion acknowledgement. No current code can prove delivery when an extension or network drops the request. SDK web events use their actual send time; saved paidAt is an eligibility guard, not a backdated web event parameter.

## Privacy, Consent and Attribution

No GA User-ID, enhanced conversion contact matching, customer name/email/phone/address, notes, password, uploaded files or payment credentials are sent by the manual event builders. Product metadata is allowlisted; arbitrary customization objects are excluded. Search terms must consist of words in public result titles. Unverifiable free text, possible contact details and zero-result unknown terms are deliberately not sent as search terms. Their search page visits remain measurable without q in the URL. This reduces search-term coverage rather than risking personal data.

Measurement URLs allow only standard UTM fields, genuine click parameters and safe page/sort parameters. Reset tokens, emails, nested callbackUrl, Cashfree order IDs, arbitrary query parameters and fragments are excluded from measurement copies. External referrers retain their origin, not private path/query data. Actual page URLs are never rewritten by GA instrumentation, so existing Meta attribution and checkout callbacks keep working. Cashfree referrers are ignored for acquisition; review the property's unwanted-referral list for the actual processor domains as appropriate.

GA reads the existing preference cookie/signals and respects the existing strict-mode environment setting without changing Meta's policy. Explicit denial, GPC/DNT and unknown consent in strict mode prevent SDK/events and analytics storage. The existing automatic mode permits analytics storage for an unknown choice; it does not create a cookie falsely recording an explicit customer grant. In strict mode, only an actual saved grant permits analytics storage. Google advertising storage, advertising user data and ad personalization remain denied. No new consent banner is introduced.

Cookie-based session attribution and Google login intent now use the same policy as analytics storage. The login intent contains a timestamp/document marker, never account details; without a fresh permitted cross-document intent, Google login is not guessed from an existing session. Opted-out visits remain untracked. Cookie-blocking browsers and blocked SDK/network requests can still reduce measurement. The earlier denied-storage implementation could send cookieless pings without making them reportable on an ineligible property; those historical pings must not be described as guaranteed tracked dashboard visits.

The privacy-policy page adds a GA disclosure without overwriting admin-managed policy text. The operator remains responsible for applicable policy/legal requirements. A disclosure or Consent Mode is not itself a lawful basis or proof of consent. The external Enhanced Measurement prerequisite is necessary to keep automatic events from bypassing these manual controls.

Safe future Meta campaign example:

```text
https://groverygiftz.in/shop?utm_source=instagram&utm_medium=paid_social&utm_campaign=frames_october
```

Use actual campaign names/source/medium. Do not put names, emails, phone numbers or other personal data in UTMs. Missing campaign information is not fabricated.

## Files Modified or Added

- src/app/layout.js: one global GA client component inside Suspense, existing Meta left in place.
- src/components/analytics/GoogleAnalytics.js: new nonblocking SDK/lifecycle, SPA/privacy handling and successful Google return observer.
- src/components/analytics/GA4SearchTracker.js: new independent search-result tracker.
- src/lib/ga4.js: new isolated event queue, page context, privacy, ecommerce/auth/search and purchase guards.
- src/lib/ga4Data.js: new pure safe item/URL/money/verified-order builders and supplied measurement ID.
- src/lib/cashfreeOrderFinalization.js: safe GA snapshot in existing verification response only.
- src/context/CartContext.js: after-mutation analytics side effects; original merge/persistence/quantity calculations retained.
- src/components/product/ProductCard.js: visibility/selection observers and optional list metadata, no markup/style redesign.
- src/components/product/ProductDetail.js: selected product/variant view event; existing Meta/upload/cart calls retained.
- src/app/cart/page.js and src/components/cart/CartDrawer.js: ready-cart/opening impressions only.
- src/app/checkout/page.js: eligible funnel events and verified purchase/confirmation measurement; existing payment handlers retained.
- src/app/auth/login/page.js and src/app/auth/register/page.js: success-guarded events and optional Google intent only; no validation, authentication/provider or redirect changes.
- src/app/search/page.js: title-only vocabulary for the separate GA search tracker, existing Meta SearchTracker unchanged.
- src/app/shop/page.js, src/app/collections/[slug]/page.js, src/app/products/[slug]/page.js, src/components/home/FeaturedProducts.js and src/components/home/CollectionShowcase.js: existing ProductCard callers provide actual list identity/index only.
- src/app/policies/[slug]/page.js: add the GA disclosure to the privacy page.
- scripts/test-ga4.cjs: isolated tests of actual GA helpers and CartContext functions with mocked tag/provider boundaries.
- scripts/test-meta-purchase.cjs: extend its fixture loader for the additional GA snapshot and assert Meta/GA distinct value policies; Meta application logic unchanged.
- docs/ga4-integration.md: this report.

No package/lockfile, database schema, admin credential/hash/seed, order API authorization, customer relationship, stock/shipping formula or Meta implementation file is changed. No seed command or password reset is needed or was run.

## Test Results and Remaining Verification

```text
node --test scripts/test-ga4.cjs scripts/test-meta-purchase.cjs scripts/test-meta-attribution.cjs scripts/test-image-reliability.cjs
npm run build
git diff --check
```

Local suites after the empty-dashboard correction: **129 passed, zero failures** (43 GA tests plus 86 existing Meta/payment/attribution/image regressions). The suites use actual helper/handler source with mocked tracking/provider boundaries; no fake production event or real payment was sent. Coverage includes real stock-capped CartContext deltas, privacy changes, missing/zero/discounted amounts, variant/quantity mapping, browser queue readiness, return cleanup, safe page context/UTMs/referrers, successful action guards and receipt replay protection. Existing payment tests confirm unchanged stock/order-number behavior.

The production build includes compilation, Next lint/type checks and route generation. A stale Browserslist database notice is an existing nonblocking warning, not a tracking validation result. No TypeScript conversion or dependency upgrade was introduced.

No browser was connected for physical Android/iOS/desktop or visual interaction tests. Actual Google collection requests, Tag Assistant, Realtime, DebugView, acquisition attribution and production purchase deduplication are **not live-verified**. All 127 tests and the production build passed again after the operator confirmed Enhanced Measurement OFF. Passing local tests/build does not establish Google reception. The operator's screenshot confirms the required stream setting; this is not an unconditional production sign-off. Its inactive-data warning was shown before this integration was deployed and does not by itself establish a deployment failure.

After saving the prerequisite setting, deploy through the existing pipeline, then verify a genuine visit in Realtime and use Tag Assistant/DebugView with approved controlled testing. Localhost and development tracking are disabled by default to avoid contaminating live analytics. For an approved isolated local/staging build, NEXT_PUBLIC_GA4_DEBUG=true explicitly opts in and enables debug_mode; do not enable it casually for ordinary production traffic or send fabricated purchase events to the live property. Verify one Google tag and one page_view per committed navigation, correct locations/referrers, visible list/product events, cart deltas, all checkout steps, and one genuine confirmed purchase with matching saved items/value/shipping/INR and transaction ID. Refresh the receipt, repeat verification and inspect blocked/denied behavior. Verify existing Meta events separately. Keep Meta and Cashfree production credentials unchanged.

## Official References

- [Google tag configuration](https://developers.google.com/tag-platform/gtagjs/configure): initialize config once; use set for subsequent context.
- [Parameter precedence](https://developers.google.com/tag-platform/gtagjs/reference#parameter_precedence): avoid freezing page context at a higher-priority scope.
- [Pageviews](https://developers.google.com/analytics/devguides/collection/ga4/views): manual views require config suppression and disabling Enhanced Measurement history separately.
- [SPA measurement](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications): track committed screens and referrers consistently.
- [Recommended events](https://developers.google.com/analytics/devguides/collection/ga4/reference/events): ecommerce item structures and merchandise value separate from shipping/tax.
- [Consent Mode](https://developers.google.com/tag-platform/security/guides/consent): set defaults before measurement and update real choices.
- [Behavioral modeling prerequisites](https://support.google.com/analytics/answer/11161109): denied-storage pings do not guarantee reportable visits on an ineligible property.
- [User-provided data collection](https://support.google.com/analytics/answer/14077171): separate property/tag controls for automatic customer-data collection.
- [Next.js 14 scripts](https://nextjs.org/docs/14/app/building-your-application/optimizing/scripts): framework-supported script lifecycle/nonblocking loading.

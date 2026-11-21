const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('customer JWT sessions persist for 180 days with daily refresh and secure cookies', () => {
  const auth = read('src/lib/auth.js');
  assert.match(auth, /maxAge:\s*180\s*\*\s*24\s*\*\s*60\s*\*\s*60/);
  assert.match(auth, /updateAge:\s*24\s*\*\s*60\s*\*\s*60/);
  assert.match(auth, /strategy:\s*'jwt'/);
  assert.match(auth, /useSecureCookies/);
  assert.doesNotMatch(auth, /localStorage.*session-token|sessionStorage.*NEXTAUTH/i);
  const providers = read('src/components/Providers.js');
  assert.match(providers, /refetchInterval=\{5\s*\*\s*60\}/);
  assert.match(providers, /refetchOnWindowFocus/);
});

test('checkout draft helpers restore Step 1 fields and Step 2 history without starting payment', () => {
  const flow = read('src/components/checkout/CheckoutFlow.js').replace(/\r\n/g, '\n');
  assert.match(flow, /CHECKOUT_DRAFT_KEY/);
  assert.match(flow, /writeCheckoutDraft/);
  assert.match(flow, /readCheckoutDraft/);
  assert.match(flow, /ggCheckoutStep/);
  assert.match(flow, /returnToCheckoutAddress/);
  assert.match(flow, /status !== 'unauthenticated'/);
  assert.doesNotMatch(flow.slice(flow.indexOf('returnToCheckoutAddress'), flow.indexOf('handleAddressNext')), /create-cashfree-order|handleCashfreePayment/);
  const helpers = flow.slice(flow.indexOf('const CHECKOUT_DRAFT_KEY'), flow.indexOf('const cartLineKey'));
  const context = { module: { exports: {} }, exports: {}, console, Date, JSON, Math, Number, String };
  vm.createContext(context);
  vm.runInContext(`${helpers}
    const store = new Map();
    globalThis.window = {
      sessionStorage: {
        getItem: (key) => store.get(key) || null,
        setItem: (key, value) => store.set(key, value),
        removeItem: (key) => store.delete(key),
      },
    };
    writeCheckoutDraft('customer-1', {
      address: { fullName: 'Test Buyer', phone: '9876543210', state: 'Tamil Nadu', pincode: '641001' },
      orderNote: 'Leave at gate',
      step: 2,
    });
    const draft = readCheckoutDraft('customer-1');
    module.exports = { draft, cleared: (() => { clearCheckoutDraft('customer-1'); return readCheckoutDraft('customer-1'); })() };
  `, context);
  assert.equal(context.module.exports.draft.address.fullName, 'Test Buyer');
  assert.equal(context.module.exports.draft.step, 2);
  assert.equal(context.module.exports.draft.orderNote, 'Leave at gate');
  assert.equal(context.module.exports.cleared, null);
});

test('photo editor uses history so Back/X close without committing unsaved edits', () => {
  const editor = read('src/components/product/PhotoAdjuster.js').replace(/\r\n/g, '\n');
  assert.match(editor, /ggPhotoEditor/);
  assert.match(editor, /requestClose/);
  assert.match(editor, /history\.pushState/);
  assert.match(editor, /popstate/);
  assert.match(editor, /onClick=\{requestClose\}/);
  assert.match(editor, /onApply\?\.\(draft\)/);
  assert.doesNotMatch(editor, /onApply\?\.\(draft\).*requestClose|requestClose.*onApply/);
});

test('Cashfree return verifies then restores checkout Step 2 when unpaid, success only when paid', () => {
  const payment = read('src/lib/checkoutPayment.js');
  assert.match(payment, /PAYMENT_RETURN_PATH = '\/checkout\/return'/);
  assert.match(payment, /ORDER_CONFIRMATION_PATH = '\/checkout\/success'/);
  const returnPage = read('src/app/checkout/return/page.js');
  assert.match(returnPage, /mode="return"/);
  assert.doesNotMatch(returnPage, /Confirming your payment/);
  const flow = read('src/components/checkout/CheckoutFlow.js');
  assert.match(flow, /restoreUnpaidCheckout/);
  assert.match(flow, /Checking payment status\.\.\./);
  assert.doesNotMatch(flow, /Confirming your payment|Please wait while we securely check your order/);
  assert.match(flow, /verifyCheckoutPayment|verifyCashfreeOrder/);
  assert.match(flow, /checkout-incomplete:/);
  assert.match(flow, /startFreshPayment/);
  assert.doesNotMatch(flow.slice(flow.indexOf('{step === 2 && ('), flow.indexOf('Order Summary')), /Check payment status/);
});

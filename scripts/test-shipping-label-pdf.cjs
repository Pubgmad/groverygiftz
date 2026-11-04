/* Page-count + bundled shippingLabelPdf smoke tests. */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { PDFDocument } = require('pdf-lib');

const root = path.join(__dirname, '..');
const layoutSrc = fs.readFileSync(path.join(root, 'src/lib/shippingLabelLayout.js'), 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')
  .replace(/export \{[^}]+\};?/g, '');
const layoutCtx = { module: { exports: {} }, exports: {}, console, Math, Date, Number, String, Boolean, Array, Object, Map, Set, JSON, Intl };
vm.createContext(layoutCtx);
vm.runInContext(`${layoutSrc}\nmodule.exports={SHIPPING_LABEL_LAYOUTS,pageCountForLabels};`, layoutCtx);
const { SHIPPING_LABEL_LAYOUTS, pageCountForLabels } = layoutCtx.module.exports;

const bundlePath = path.join(__dirname, '.bundle-shipping-pdf.cjs');
const esbuildCli = path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
execFileSync(
  process.execPath,
  [esbuildCli, 'src/lib/shippingLabelPdf.js', '--bundle', '--platform=node', '--format=cjs', `--outfile=${bundlePath}`, '--external:pdf-lib', '--external:qrcode', '--external:bwip-js'],
  { cwd: root, stdio: 'pipe' },
);

const { buildShippingLabelsPdf, shippingLabelFilename } = require(bundlePath);

const makeOrder = (i) => ({
  id: `id-${i}`,
  orderNumber: `GG${1000 + i}`,
  orderDateIst: '04 Nov 2026, 11:00 am IST',
  recipientName: `Customer Name Very Long Example ${i}`,
  phone: '9876543210',
  line1: '126, 3rd Street, Sample Layout Area with long address text',
  line2: 'Near Landmark Optional',
  city: 'Coimbatore',
  state: 'Tamil Nadu',
  pincode: '641012',
  items: [
    { title: 'Photo Cloud Frame', quantity: 1, variant: '8x10' },
    { title: 'Gift Wrap', quantity: 2, variant: '' },
  ],
  trackUrl: `https://groverygiftz.in/track/label/token${i}`,
});

const company = {
  siteName: 'GroveryGiftz',
  tradeName: 'GroveryGiftz',
  logoUrl: '',
  returnAddress: '126, 3rd St, Coimbatore, Tamil Nadu 641012',
  phone: '+91 99945 49781',
};

(async () => {
  for (const [count, layoutKey, expectedPages] of [
    [1, 'four', 1],
    [3, 'four', 1],
    [4, 'four', 1],
    [5, 'four', 2],
    [8, 'four', 2],
    [12, 'four', 3],
    [20, 'four', 5],
    [5, 'two', 3],
    [3, 'single', 3],
  ]) {
    const layout = SHIPPING_LABEL_LAYOUTS[layoutKey];
    assert.strictEqual(pageCountForLabels(count, layout), expectedPages);
    const orders = Array.from({ length: count }, (_, i) => makeOrder(i + 1));
    const buf = await buildShippingLabelsPdf({ orders, company, layout, origin: 'https://groverygiftz.in' });
    const pdf = await PDFDocument.load(buf);
    assert.strictEqual(pdf.getPageCount(), expectedPages, `${layoutKey} n=${count}`);
    const asText = Buffer.from(buf).toString('latin1');
    assert.ok(!/subtotal|paymentStatus|makingCost|Cashfree/i.test(asText), 'no financial leakage');
  }

  assert.ok(/^GroveryGiftz-Shipping-Labels-\d{4}-\d{2}-\d{2}\.pdf$/.test(shippingLabelFilename(new Date('2026-11-04T06:00:00.000Z'))));
  try { fs.unlinkSync(bundlePath); } catch {}
  console.log('Shipping label PDF smoke tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

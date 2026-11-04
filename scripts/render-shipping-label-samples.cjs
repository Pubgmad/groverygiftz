/* Generate sample shipping-label PDFs for visual QA (not committed). */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { PDFDocument } = require('pdf-lib');

const root = path.join(__dirname, '..');
const outDir = path.join(root, '.data', 'label-samples');
fs.mkdirSync(outDir, { recursive: true });

const bundlePath = path.join(__dirname, '.bundle-shipping-pdf.cjs');
const esbuildCli = path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild');
execFileSync(process.execPath, [
  esbuildCli,
  'src/lib/shippingLabelPdf.js',
  '--bundle',
  '--platform=node',
  '--format=cjs',
  `--outfile=${bundlePath}`,
  '--external:pdf-lib',
  '--external:qrcode',
], { cwd: root, stdio: 'pipe' });

const { buildShippingLabelsPdf } = require(bundlePath);
const { SHIPPING_LABEL_LAYOUTS, pageCountForLabels } = (() => {
  const vm = require('vm');
  const src = fs.readFileSync(path.join(root, 'src/lib/shippingLabelLayout.js'), 'utf8')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')
    .replace(/export \{[^}]+\};?/g, '');
  const ctx = { module: { exports: {} }, exports: {}, console, Math, Date, Number, String, Boolean, Array, Object, Map, Set, JSON, Intl };
  vm.createContext(ctx);
  vm.runInContext(`${src}\nmodule.exports={SHIPPING_LABEL_LAYOUTS,pageCountForLabels};`, ctx);
  return ctx.module.exports;
})();

function makeOrder(i, opts = {}) {
  return {
    id: `id-${i}`,
    orderNumber: `GG${2400 + i}`,
    orderDateIst: '04 Nov 2026, 12:05 pm IST',
    recipientName: opts.longName
      ? 'Smt. Rajeshwari Venkataramanathan Very Long Name'
      : `Customer ${i}`,
    phone: '9876543210',
    line1: opts.longAddr
      ? 'Door No 126/3, Third Cross Street, V.C.K.N. Layout Near Sivananda Colony Bus Stop'
      : '126, 3rd Street, VCKN Layout',
    line2: opts.longAddr ? 'Opposite temple complex, Tatabad Extension Area' : 'Sivananda Colony',
    landmark: opts.longAddr ? 'Near park entrance' : '',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    pincode: '641012',
    deliveryType: 'Tamil Nadu delivery estimate',
    items: opts.manyItems
      ? [
        { title: 'Photo Cloud Acrylic Frame Premium Edition', quantity: 1, variant: '8x10 Glossy' },
        { title: 'Custom Name Plaque', quantity: 2, variant: 'Wood / Large' },
        { title: 'Gift Wrap Deluxe', quantity: 1, variant: '' },
        { title: 'Greeting Card Set', quantity: 3, variant: 'Birthday' },
        { title: 'Extra Magnet Pack', quantity: 1, variant: 'Set of 4' },
      ]
      : [
        { title: 'Photo Cloud Frame', quantity: 1, variant: '8x10' },
        { title: 'Gift Wrap', quantity: 1, variant: '' },
      ],
    trackUrl: `https://groverygiftz.in/track/label/sampletoken${i}`,
  };
}

const company = {
  siteName: 'GroveryGiftz',
  tradeName: 'GroveryGiftz',
  logoUrl: '',
  returnAddress: '126, 3rd St, V.C.K.N.Layout, Sivananda Colony, Tatabad, Coimbatore, Tamil Nadu 641012',
  phone: '+91 99945 49781',
};

(async () => {
  const scenarios = [
    { name: 'four-5-orders', layout: 'four', count: 5 },
    { name: 'four-1-order', layout: 'four', count: 1 },
    { name: 'two-5-orders', layout: 'two', count: 5 },
    { name: 'single-3-orders', layout: 'single', count: 3 },
    { name: 'four-long-content', layout: 'four', count: 2, longName: true, longAddr: true, manyItems: true },
    { name: 'single-long-content', layout: 'single', count: 1, longName: true, longAddr: true, manyItems: true },
  ];

  const report = [];
  for (const sc of scenarios) {
    const layout = SHIPPING_LABEL_LAYOUTS[sc.layout];
    const orders = Array.from({ length: sc.count }, (_, i) => makeOrder(i + 1, sc));
    const expected = pageCountForLabels(sc.count, layout);
    const buf = await buildShippingLabelsPdf({ orders, company, layout, origin: 'https://groverygiftz.in' });
    const pdf = await PDFDocument.load(buf);
    const pages = pdf.getPageCount();
    const file = path.join(outDir, `${sc.name}.pdf`);
    fs.writeFileSync(file, buf);
    // pdf-lib compresses content streams — plain latin1 search is not reliable for labels.
    // Page-count + financial-keyword scan on raw bytes is still useful as a smoke check.
    const text = buf.toString('latin1');
    const leaks = /subtotal|paymentStatus|makingCost|Cashfree|weight/i.test(text);
    report.push({
      name: sc.name,
      file,
      expectedPages: expected,
      actualPages: pages,
      pageMatch: expected === pages,
      noFinancialLeak: !leaks,
      bytes: buf.length,
    });
  }

  console.log(JSON.stringify(report, null, 2));
  const failed = report.filter((r) => !r.pageMatch || !r.noFinancialLeak);
  if (failed.length) {
    console.error('FAILED', failed.map((f) => f.name));
    process.exit(1);
  }
  console.log('All sample PDFs OK in', outDir);
  try { fs.unlinkSync(bundlePath); } catch {}
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Admin performance helper checks (no DB / Next runtime).
 * Run: node scripts/test-admin-perf.mjs
 */
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'admin-perf-test-'));
const outfile = join(tmp, 'bundle.cjs');

await esbuild.build({
  stdin: {
    contents: `
      export { parseOrderPutAllowlist, ORDER_PUT_STATUSES } from './src/lib/orderUpdateAllowlist.js';
      export {
        ADMIN_ORDER_LIST_SELECT,
        ORDER_MUTATION_SELECT,
        serializeOrderMutationResult,
        pickAdminOrderListPatch,
      } from './src/lib/adminOrderFields.js';
      export { withAdminThumbUrl, boundedThumbWidth } from './src/lib/adminImageThumb.js';
      export { verifyCustomerDisplayAccess, buildCustomerDisplayUrl } from './src/lib/customerFileAccess.js';
    `,
    resolveDir: root,
    sourcefile: 'admin-perf-entry.js',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  alias: { '@': join(root, 'src') },
  logLevel: 'silent',
});

process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'admin-perf-test-secret';
const require = createRequire(import.meta.url);
const lib = require(outfile);

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log(`  PASS ${msg}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${msg}`);
  }
}

console.log('Admin performance helpers');

assert(
  !lib.ADMIN_ORDER_LIST_SELECT.includes('items')
    && !lib.ADMIN_ORDER_LIST_SELECT.includes('customFields')
    && !lib.ADMIN_ORDER_LIST_SELECT.includes('timeline'),
  'Admin order list projection excludes items, customFields, and timeline',
);
assert(
  lib.ADMIN_ORDER_LIST_SELECT.includes('orderNumber')
    && lib.ADMIN_ORDER_LIST_SELECT.includes('status')
    && lib.ADMIN_ORDER_LIST_SELECT.includes('shippingAddress.fullName'),
  'Admin order list projection keeps table fields',
);
assert(
  lib.ORDER_MUTATION_SELECT.includes('paymentStatus')
    && lib.ORDER_MUTATION_SELECT.includes('parcelRefs')
    && !lib.ORDER_MUTATION_SELECT.includes('items'),
  'Status mutation select loads payment/parcel fields without item photos',
);

const parsed = lib.parseOrderPutAllowlist({ status: 'dispatched' });
assert(parsed.ok && parsed.patch.status === 'dispatched', 'Status allowlist still accepts dispatched');
assert(lib.ORDER_PUT_STATUSES.includes('on_process'), 'On Process remains a valid PUT status');
assert(
  !lib.parseOrderPutAllowlist({ status: 'dispatched', total: 1 }).ok,
  'Status PUT still rejects non-allowlisted fields',
);

const mutation = lib.serializeOrderMutationResult({
  _id: 'abc',
  status: 'dispatched',
  paymentStatus: 'paid',
  trackingNumber: 'ST1',
  items: [{ customFields: { photo: 'huge' } }],
  timeline: [{ type: 'status_update' }],
});
assert(mutation.status === 'dispatched' && mutation.trackingNumber === 'ST1', 'Mutation result keeps status and tracking');
assert(mutation.items === undefined && mutation.timeline === undefined, 'Mutation result does not return photos or timeline');

const patched = lib.pickAdminOrderListPatch({
  status: 'dispatched',
  opsStatus: 'dispatched',
  items: [{ title: 'secret' }],
});
assert(patched.status === 'dispatched' && patched.items === undefined, 'List patch copies status without items');

const signed = lib.buildCustomerDisplayUrl('customizations/demo/photo.jpg');
const thumb = lib.withAdminThumbUrl(signed, 320);
assert(thumb.includes('thumb=1') && thumb.includes('w=320'), 'Admin thumb URL adds thumb params');
assert(lib.withAdminThumbUrl('/media/products/x.jpg') === '/media/products/x.jpg', 'Non-customer URLs are left unchanged');
assert(lib.boundedThumbWidth(12) === 64 && lib.boundedThumbWidth(9999) === 1280, 'Thumb width is bounded');

if (signed.includes('sig=')) {
  const params = new URLSearchParams(signed.split('?')[1]);
  const paramsWithThumb = new URLSearchParams(thumb.split('?')[1]);
  assert(
    lib.verifyCustomerDisplayAccess('customizations/demo/photo.jpg', paramsWithThumb),
    'Thumb query params do not invalidate HMAC signature',
  );
  assert(
    params.get('sig') === paramsWithThumb.get('sig'),
    'Thumb URL keeps the original display signature',
  );
}

rmSync(tmp, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

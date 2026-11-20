/** Regression: Admin Orders list projection, selection race guards, Phase-2 hide. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('admin list select excludes heavy photo/timeline blobs', () => {
  const src = read('src/lib/adminOrderFields.js');
  const selectBlock = src.slice(src.indexOf('ADMIN_ORDER_LIST_SELECT'), src.indexOf('].join'));
  assert.match(src, /ADMIN_ORDER_LIST_SELECT/);
  assert.match(selectBlock, /confirmationSchedule\.expectedReadyDateIst/);
  assert.doesNotMatch(selectBlock, /items\.customFields/);
  assert.doesNotMatch(selectBlock, /designVersions/);
  assert.doesNotMatch(selectBlock, /['"]timeline['"]/);
  assert.doesNotMatch(selectBlock, /photoHistory/);
});

test('GET /api/orders admin path uses lean projection', () => {
  const src = read('src/app/api/orders/route.js');
  assert.match(src, /ADMIN_ORDER_LIST_SELECT/);
  assert.match(src, /if \(isAdmin\) listQuery = listQuery\.select\(ADMIN_ORDER_LIST_SELECT\)/);
  assert.match(src, /skips attachAdminConfirmationEmails/);
  assert.doesNotMatch(src, /await attachAdminConfirmationEmails/);
});

test('orders page uses race-safe detail open and in-place status patch', () => {
  const src = read('src/app/account/manage/orders/page.js');
  assert.match(src, /detailRequestRef/);
  assert.match(src, /openOrderDetail/);
  assert.match(src, /patchOrderInLists/);
  assert.match(src, /statusSaving/);
  assert.match(src, /AbortController/);
  assert.match(src, /requestId !== detailRequestRef\.current/);
  assert.match(src, /pickAdminOrderListPatch/);
  // Must not replace selected with lean list row after fetch
  assert.doesNotMatch(src, /setSelected\(nextOrders\.find/);
  // Status update must not await full list refetch
  assert.match(src, /patchOrderInLists\(id, data\)/);
});

test('Phase-2 Courier / Printing / Photo Replacement UI is gated off', () => {
  const flag = read('src/lib/adminOrdersPhase2.js');
  assert.match(flag, /SHOW_ADMIN_ORDERS_PHASE2_UI = false/);
  const page = read('src/app/account/manage/orders/page.js');
  assert.match(page, /SHOW_ADMIN_ORDERS_PHASE2_UI/);
  assert.match(page, /OrderDesignSheetsPanel/);
  const ops = read('src/components/admin/OrderOpsPanel.js');
  assert.match(ops, /SHOW_ADMIN_ORDERS_PHASE2_UI/);
  assert.match(ops, /Courier &amp; Dispatch Details/);
  assert.match(ops, /Customer photos by product \/ size/);
  // Essential tracking + shipping label remain
  assert.match(page, /ST Couriers tracking ID/);
  assert.match(page, /Print \/ download shipping label/);
});

test('pickAdminOrderListPatch only returns status-safe fields', () => {
  const strip = (file) => fs.readFileSync(path.join(root, file), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
    .replace(/export /g, '');
  const context = { console };
  vm.createContext(context);
  vm.runInContext(`${strip('src/lib/adminOrderFields.js')}\nthis.api = { pickAdminOrderListPatch };`, context);
  const patch = context.api.pickAdminOrderListPatch({
    status: 'dispatched',
    opsStatus: 'ready_to_dispatch',
    items: [{ customFields: { Photo: { url: '/x' } } }],
    timeline: [{ type: 'x' }],
    total: 999,
  });
  assert.equal(patch.status, 'dispatched');
  assert.equal(patch.total, 999);
  assert.equal(patch.items, undefined);
  assert.equal(patch.timeline, undefined);
});

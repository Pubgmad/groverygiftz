/**
 * Focused RBAC unit checks (no DB / Next runtime).
 * Run: node scripts/test-rbac-permissions.mjs
 */
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import * as esbuild from 'esbuild';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'rbac-test-'));
const outfile = join(tmp, 'bundle.cjs');

await esbuild.build({
  stdin: {
    contents: `
      export {
        hasActionPermission,
        hasModulePermission,
        mergePermissionOverrides,
        normalizePermissions,
      } from './src/lib/adminPermissions.js';
      export {
        normalizeDataVisibility,
        normalizeModuleActions,
        listModuleActions,
      } from './src/lib/adminPermissionCatalog.js';
      export {
        resolveDataVisibility,
        assertCanAccessOrder,
        staffOrderScopeFilter,
      } from './src/lib/opsStaffAccess.js';
    `,
    resolveDir: root,
    sourcefile: 'rbac-entry.js',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  alias: { '@': join(root, 'src') },
  logLevel: 'silent',
});

const require = createRequire(import.meta.url);
const rbac = require(outfile);

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

console.log('\n1) Legacy RW inheritance (no actions map)');
{
  const perms = normalizeCompat({ orders: { read: true, write: true } });
  assert(rbac.hasModulePermission(perms, 'orders', 'write'), 'orders write');
  assert(rbac.hasActionPermission(perms, 'orders', 'verify_payments'), 'verify inherits write');
  assert(rbac.hasActionPermission(perms, 'orders', 'view_orders'), 'view inherits read/write');
  assert(!rbac.hasActionPermission(perms, 'revenue', 'view_revenue_analytics'), 'no revenue without module');
}

console.log('\n2) Granular map default-deny for unset actions');
{
  const perms = rbac.normalizePermissions({
    orders: {
      read: true,
      write: true,
      actions: { view_orders: true, verify_payments: false },
    },
  }, { expandActions: false });
  assert(rbac.hasActionPermission(perms, 'orders', 'view_orders'), 'explicit allow');
  assert(!rbac.hasActionPermission(perms, 'orders', 'verify_payments'), 'explicit deny');
  assert(!rbac.hasActionPermission(perms, 'orders', 'reject_payments'), 'unset sensitive → deny');
}

console.log('\n3) Staff overrides merge');
{
  const role = { orders: { read: true, write: false } };
  const over = { orders: { write: true, actions: { verify_payments: true } } };
  const merged = rbac.mergePermissionOverrides(role, over);
  assert(merged.orders.write === true, 'override grants write');
  assert(rbac.hasActionPermission(merged, 'orders', 'verify_payments'), 'override grants verify');
}

console.log('\n4) Data visibility + order scope');
{
  const assigned = {
    isPrimary: false,
    adminId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    dataVisibility: 'assigned',
    permissions: rbac.normalizePermissions({ orders: { read: true, write: true } }),
  };
  assert(rbac.resolveDataVisibility(assigned) === 'assigned', 'assigned visibility');
  const scope = rbac.staffOrderScopeFilter(assigned);
  assert(Boolean(scope.$or), 'assigned scope uses $or');

  const allViaAction = {
    ...assigned,
    permissions: rbac.normalizePermissions({
      orders: {
        read: true,
        write: false,
        actions: { view_orders: true, view_all_orders: true },
      },
    }, { expandActions: false }),
  };
  assert(rbac.resolveDataVisibility(allViaAction) === 'all', 'view_all_orders widens scope');

  const order = {
    assignedTo: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    createdByAdmin: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  };
  assert(!rbac.assertCanAccessOrder(assigned, order), 'editor cannot see unassigned order');
  assert(rbac.assertCanAccessOrder({ ...assigned, adminId: 'bbbbbbbbbbbbbbbbbbbbbbbb' }, order), 'assignee can see');
  assert(rbac.assertCanAccessOrder({ isPrimary: true }, order), 'primary can see');
}

console.log('\n5) Visibility option normalize');
{
  assert(rbac.normalizeDataVisibility('own') === 'own', 'own');
  assert(rbac.normalizeDataVisibility('nope', 'assigned') === 'assigned', 'fallback');
}

console.log('\n6) Catalog coverage');
{
  const orders = rbac.listModuleActions('orders');
  const ops = rbac.listModuleActions('operations');
  assert(orders.some((a) => a.id === 'verify_payments'), 'verify_payments in catalog');
  assert(ops.some((a) => a.id === 'view_other_editors_orders'), 'editor broader access action');
  assert(orders.length >= 30, `orders actions count (${orders.length})`);
}

function normalizeCompat(input) {
  return rbac.normalizePermissions(input, { expandActions: false });
}

console.log(`\nResult: ${passed} passed, ${failed} failed`);
rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);

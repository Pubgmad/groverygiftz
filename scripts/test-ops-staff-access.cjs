const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '../src/lib/opsStaffAccess.js'), 'utf8')
  .replace(/^import .+$/gm, '')
  .replace(/export function /g, 'function ')
  .replace(/roleSlugFromName\(/g, '('); // no-op if already removed
// Provide stubs
const wrapped = src
  .replace(/import[\s\S]*?from ['"]@\/lib\/adminPermissions['"];?/, '')
  .replace(/roleSlugFromName\(/g, '((n)=>String(n||"").toLowerCase().replace(/[^a-z0-9]+/g,"-"))(');

const ctx = {
  module: { exports: {} },
  exports: {},
  console,
  mongoose: { Types: { ObjectId: { isValid: (id) => Boolean(id) } } },
};
vm.createContext(ctx);
vm.runInContext(`
function roleSlugFromName(name=''){return String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);}
${wrapped.replace(/^import .+$/gm, '')}
module.exports={isOpsOversight,staffOrderScopeFilter,assertCanAccessOrder,mergeStaffOrderFilter};
`, ctx);

const { isOpsOversight, staffOrderScopeFilter, assertCanAccessOrder, mergeStaffOrderFilter } = ctx.module.exports;

assert.strictEqual(isOpsOversight({ ok: true, isPrimary: true }), true);
assert.strictEqual(isOpsOversight({ ok: true, isPrimary: false, roleSlug: 'owner-admin' }), true);
assert.strictEqual(isOpsOversight({ ok: true, isPrimary: false, roleSlug: 'sales-person' }), false);

const scope = staffOrderScopeFilter({ ok: true, isPrimary: false, adminId: 'abc' });
assert.ok(scope.$or);
assert.strictEqual(staffOrderScopeFilter({ ok: true, isPrimary: true }).$or, undefined);

assert.strictEqual(assertCanAccessOrder({ isPrimary: true, ok: true }, { assignedTo: 'x' }), true);
assert.strictEqual(assertCanAccessOrder({ isPrimary: false, ok: true, adminId: 'a1', roleSlug: 'editor' }, { assignedTo: 'a1' }), true);
assert.strictEqual(assertCanAccessOrder({ isPrimary: false, ok: true, adminId: 'a1', roleSlug: 'editor' }, { assignedTo: 'other' }), false);

const merged = mergeStaffOrderFilter({ paymentStatus: 'paid' }, { ok: true, isPrimary: false, adminId: 'a1', roleSlug: 'editor' });
assert.ok(merged.$and);

console.log('Ops staff access tests passed');

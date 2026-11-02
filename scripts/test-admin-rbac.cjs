const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, '../src/lib/adminPermissions.js');
const source = fs.readFileSync(sourcePath, 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ');
const context = { module: { exports: {} }, exports: {}, console };
vm.createContext(context);
vm.runInContext(`${source}\nmodule.exports = { ADMIN_MODULES, emptyAdminPermissions, fullAdminPermissions, hasModulePermission, moduleIdFromPath, normalizeEmail, isValidEmail, normalizePermissions, normalizeRoleName, roleSlugFromName };`, context);
const {
  ADMIN_MODULES,
  emptyAdminPermissions,
  fullAdminPermissions,
  hasModulePermission,
  moduleIdFromPath,
  normalizeEmail,
  isValidEmail,
  normalizePermissions,
  normalizeRoleName,
  roleSlugFromName,
} = context.module.exports;

assert.ok(ADMIN_MODULES.length >= 10, 'module catalog should be derived from existing admin sections');
assert.ok(!ADMIN_MODULES.some((module) => ['sales', 'editor', 'accountant'].includes(module.id)), 'example role names must not be hardcoded as modules');

const writeImpliesRead = normalizePermissions({ products: { read: false, write: true } });
assert.strictEqual(writeImpliesRead.products.write, true);
assert.strictEqual(writeImpliesRead.products.read, true);

const unknownIgnored = normalizePermissions({ notAModule: { read: true, write: true }, orders: { read: true } });
assert.strictEqual(unknownIgnored.notAModule, undefined);
assert.strictEqual(unknownIgnored.orders.read, true);
assert.strictEqual(unknownIgnored.orders.write, false);

const customersWriteDisabled = ADMIN_MODULES.find((module) => module.id === 'customers');
assert.strictEqual(customersWriteDisabled.writeSupported, false);
const customersPerms = normalizePermissions({ customers: { read: true, write: true } });
assert.strictEqual(customersPerms.customers.write, false);
assert.strictEqual(customersPerms.customers.read, true);

const empty = emptyAdminPermissions();
assert.strictEqual(hasModulePermission(empty, 'orders', 'read'), false);
assert.strictEqual(hasModulePermission(empty, 'orders', 'write'), false);

const full = fullAdminPermissions();
assert.strictEqual(hasModulePermission(full, 'products', 'write'), true);
assert.strictEqual(hasModulePermission(full, 'reviews', 'write'), false);

assert.strictEqual(moduleIdFromPath('/account/manage'), 'dashboard');
assert.strictEqual(moduleIdFromPath('/account/manage/products/abc'), 'products');
assert.strictEqual(moduleIdFromPath('/account/manage/roles'), 'roles');
assert.strictEqual(moduleIdFromPath('/shop'), null);

assert.strictEqual(normalizeEmail('  Sales@Example.COM '), 'sales@example.com');
assert.strictEqual(isValidEmail('sales@example.com'), true);
assert.strictEqual(isValidEmail('not-an-email'), false);
assert.strictEqual(normalizeRoleName('  Sales Team  '), 'Sales Team');
assert.strictEqual(roleSlugFromName('Sales Team'), 'sales-team');

const deniedWrite = normalizePermissions({ products: { read: true, write: false } });
assert.strictEqual(hasModulePermission(deniedWrite, 'products', 'read'), true);
assert.strictEqual(hasModulePermission(deniedWrite, 'products', 'write'), false);

console.log('RBAC permission helper tests passed');

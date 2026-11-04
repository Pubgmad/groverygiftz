const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '../src/lib/opsConstants.js'), 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ');
const ctx = { module: { exports: {} }, exports: {}, console, Math, Date, Number, String, Boolean, Array, Object, Set, Map };
vm.createContext(ctx);
vm.runInContext(`${src}\nmodule.exports={canPrintDesign,getLatestDesignVersionsBySheet,syncDesignApprovalFromSheets,requiresPaidRevisionGate};`, ctx);
const {
  canPrintDesign,
  getLatestDesignVersionsBySheet,
  syncDesignApprovalFromSheets,
  requiresPaidRevisionGate,
} = ctx.module.exports;

// Legacy single-design still works
assert.strictEqual(canPrintDesign({
  currentDesignVersion: 2,
  previewRequired: true,
  designApprovalStatus: 'approved',
  designApprovedVersion: 2,
  designVersions: [{ version: 2, sheetNumber: 1, url: '/a.png' }],
}), true);

// Multi-sheet: both must be approved at latest versions
const multi = {
  currentDesignVersion: 3,
  previewRequired: true,
  designApprovalStatus: 'awaiting_approval',
  designApprovedVersion: 0,
  designVersions: [
    { version: 1, sheetNumber: 1, sheetLabel: 'Sheet A', url: '/a1.png' },
    { version: 2, sheetNumber: 2, sheetLabel: 'Sheet B', url: '/b1.png' },
    { version: 3, sheetNumber: 1, sheetLabel: 'Sheet A', url: '/a2.png' },
  ],
  designSheetApprovals: [
    { sheetNumber: 1, status: 'approved', approvedVersion: 3 },
    { sheetNumber: 2, status: 'approved', approvedVersion: 2 },
  ],
};
assert.strictEqual(canPrintDesign(multi), true);

multi.designSheetApprovals[0].approvedVersion = 1;
assert.strictEqual(canPrintDesign(multi), false);

const sheets = getLatestDesignVersionsBySheet(multi);
assert.strictEqual(sheets.length, 2);
assert.strictEqual(sheets[0].versionNumber, 3);
assert.strictEqual(sheets[1].versionNumber, 2);

const order = {
  previewRequired: true,
  currentDesignVersion: 3,
  designVersions: multi.designVersions,
  designSheetApprovals: [
    { sheetNumber: 1, status: 'approved', approvedVersion: 3 },
    { sheetNumber: 2, status: 'approved', approvedVersion: 2 },
  ],
};
syncDesignApprovalFromSheets(order);
assert.strictEqual(order.designApprovalStatus, 'approved');

assert.strictEqual(requiresPaidRevisionGate({
  freeRevisionUsed: true,
  revisionPaymentVerified: false,
  designRevisionCount: 2,
}), true);
assert.strictEqual(requiresPaidRevisionGate({
  freeRevisionUsed: true,
  revisionPaymentVerified: true,
  designRevisionCount: 2,
}), false);

// Preview not required: any uploaded design is printable
assert.strictEqual(canPrintDesign({
  currentDesignVersion: 1,
  previewRequired: false,
  designVersions: [{ version: 1, sheetNumber: 1 }],
}), true);

console.log('Design sheet tests passed');

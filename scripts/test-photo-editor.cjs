const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/photoEditor.js'), 'utf8').replace(/export /g, '');
const context = { module: { exports: {} }, exports: {}, console };
vm.createContext(context);
vm.runInContext(`${source}
module.exports = { getFrameSize, getFillZoom, estimatePrintPpi, qualityLabel, formatFrameSubtitle };
`, context);
const { getFrameSize, getFillZoom, estimatePrintPpi, qualityLabel } = context.module.exports;

assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 12, height: 18 }, 'auto'))), { width: 12, height: 18 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 12, height: 18 }, 'portrait'))), { width: 12, height: 18 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 12, height: 18 }, 'landscape'))), { width: 18, height: 12 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 4, height: 4 }, 'auto'))), { width: 4, height: 4 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 4, height: 4 }, 'portrait'))), { width: 4, height: 4 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 4, height: 4 }, 'landscape'))), { width: 4, height: 4 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 9, height: 10.99 }, 'auto'))), { width: 9, height: 10.99 });

assert.strictEqual(Number(getFillZoom(4000, 3000, 1, 1).toFixed(3)), 1.333);
assert.ok(getFillZoom(1000, 1000, 12, 18) > 1);

const best = estimatePrintPpi({ imageWidth: 4000, imageHeight: 6000, printWidth: 12, printHeight: 18, unit: 'inch', zoom: 1 });
assert.strictEqual(best, 333);
assert.strictEqual(qualityLabel(best), 'Best');
assert.strictEqual(qualityLabel(160), 'Good');
assert.strictEqual(qualityLabel(80), 'Low');
assert.strictEqual(estimatePrintPpi({ imageWidth: 4000, imageHeight: 6000, printWidth: 12, printHeight: 18, unit: 'ratio' }), null);

const zoomed = estimatePrintPpi({ imageWidth: 4000, imageHeight: 6000, printWidth: 12, printHeight: 18, unit: 'inch', zoom: 2 });
assert.ok(zoomed < best);

console.log('Photo editor helper tests passed');

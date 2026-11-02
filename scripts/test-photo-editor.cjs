const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/photoEditor.js'), 'utf8').replace(/export /g, '');
const context = { module: { exports: {} }, exports: {}, console };
vm.createContext(context);
vm.runInContext(`${source}
module.exports = { detectPhotoOrientation, getFrameSize, getFillZoom, getContainScale, estimatePrintPpi, qualityLabel, qualityGuidance, adjustmentsForUploadedPhoto, formatFrameSizeLabel, formatFrameSubtitle };
`, context);
const {
  detectPhotoOrientation,
  getFrameSize,
  getFillZoom,
  getContainScale,
  estimatePrintPpi,
  qualityLabel,
  adjustmentsForUploadedPhoto,
} = context.module.exports;

assert.strictEqual(detectPhotoOrientation(4000, 3000), 'landscape');
assert.strictEqual(detectPhotoOrientation(3000, 4000), 'portrait');
assert.strictEqual(detectPhotoOrientation(2000, 2000), 'auto');
assert.strictEqual(detectPhotoOrientation(4000, 3000, 90), 'portrait');

assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 6, height: 8 }, 'auto'))), { width: 6, height: 8 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 6, height: 8 }, 'portrait'))), { width: 6, height: 8 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 6, height: 8 }, 'landscape'))), { width: 8, height: 6 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 12, height: 18 }, 'auto'))), { width: 12, height: 18 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 12, height: 18 }, 'portrait'))), { width: 12, height: 18 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 12, height: 18 }, 'landscape'))), { width: 18, height: 12 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 4, height: 4 }, 'auto'))), { width: 4, height: 4 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 4, height: 4 }, 'portrait'))), { width: 4, height: 4 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 4, height: 4 }, 'landscape'))), { width: 4, height: 4 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 9, height: 10.99 }, 'auto'))), { width: 9, height: 10.99 });

const landscapeUpload = adjustmentsForUploadedPhoto(4000, 3000, { width: 6, height: 8, unit: 'inch' });
assert.strictEqual(landscapeUpload.orientation, 'landscape');
assert.strictEqual(landscapeUpload.fitMode, 'fill');
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 6, height: 8 }, landscapeUpload.orientation))), { width: 8, height: 6 });
// Matching 4:3 photo into 8×6 frame → fill zoom is 1 (same as fit). Mismatched aspect must zoom up.
const mismatchedFill = adjustmentsForUploadedPhoto(4000, 2000, { width: 10, height: 12, unit: 'inch' });
assert.strictEqual(mismatchedFill.fitMode, 'fill');
assert.ok(mismatchedFill.zoom > 1);

const portraitUpload = adjustmentsForUploadedPhoto(3000, 4000, { width: 10, height: 12, unit: 'inch' });
assert.strictEqual(portraitUpload.orientation, 'portrait');
assert.strictEqual(portraitUpload.fitMode, 'fill');
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 10, height: 12 }, portraitUpload.orientation))), { width: 10, height: 12 });
assert.deepStrictEqual(JSON.parse(JSON.stringify(getFrameSize({ width: 10, height: 12 }, 'landscape'))), { width: 12, height: 10 });

assert.strictEqual(Number(getFillZoom(4000, 3000, 1, 1).toFixed(3)), 1.333);
assert.ok(getFillZoom(1000, 1000, 12, 18) > 1);
assert.ok(getContainScale(1600, 900, 220, 180, 0) < getContainScale(1600, 900, 220, 180, 0) * getFillZoom(1600, 900, 220, 180, 0));
assert.strictEqual(Number((getContainScale(1000, 1000, 200, 200) * getFillZoom(1000, 1000, 200, 200)).toFixed(3)), 0.2);

const best = estimatePrintPpi({ imageWidth: 4000, imageHeight: 6000, printWidth: 12, printHeight: 18, unit: 'inch', zoom: 1 });
assert.strictEqual(best, 333);
assert.strictEqual(qualityLabel(best), 'Excellent');
assert.strictEqual(qualityLabel(220), 'High');
assert.strictEqual(qualityLabel(160), 'Good');
assert.strictEqual(qualityLabel(80), 'Low');
assert.strictEqual(estimatePrintPpi({ imageWidth: 4000, imageHeight: 6000, printWidth: 12, printHeight: 18, unit: 'ratio' }), null);

const zoomed = estimatePrintPpi({ imageWidth: 4000, imageHeight: 6000, printWidth: 12, printHeight: 18, unit: 'inch', zoom: 2 });
assert.ok(zoomed < best);

const fillZoom = getFillZoom(4000, 3000, 12, 18);
const filled = estimatePrintPpi({ imageWidth: 4000, imageHeight: 3000, printWidth: 12, printHeight: 18, unit: 'inch', zoom: fillZoom });
const fitted = estimatePrintPpi({ imageWidth: 4000, imageHeight: 3000, printWidth: 12, printHeight: 18, unit: 'inch', zoom: 1 });
assert.ok(filled < fitted);

console.log('Photo editor helper tests passed');

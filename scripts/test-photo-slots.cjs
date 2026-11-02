const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/photoSlots.js'), 'utf8').replace(/export /g, '');
const context = { module: { exports: {} }, exports: {}, console };
vm.createContext(context);
vm.runInContext(`${source}
module.exports = { emptyPhotoSlots, alignPhotoSlots, setPhotoSlot, clearPhotoSlot, filledPhotos, filledPhotoCount, firstEmptyPhotoSlot, removeListPhotoByUrl, planPhotoUploads };
`, context);
const {
  emptyPhotoSlots, alignPhotoSlots, setPhotoSlot, clearPhotoSlot, filledPhotos, filledPhotoCount, firstEmptyPhotoSlot, removeListPhotoByUrl, planPhotoUploads,
} = context.module.exports;

const photos = [
  { url: 'A' }, { url: 'B' }, { url: 'C' }, { url: 'D' }, { url: 'E' },
];
const afterB = clearPhotoSlot(photos, 1);
assert.deepStrictEqual(JSON.parse(JSON.stringify(afterB.map((photo) => photo?.url || null))), ['A', null, 'C', 'D', 'E']);
assert.strictEqual(filledPhotoCount(afterB), 4);
assert.strictEqual(firstEmptyPhotoSlot(afterB), 1);

const afterF = setPhotoSlot(afterB, 1, { url: 'F' });
assert.deepStrictEqual(JSON.parse(JSON.stringify(afterF.map((photo) => photo?.url || null))), ['A', 'F', 'C', 'D', 'E']);

const afterD = clearPhotoSlot(afterF, 3);
assert.deepStrictEqual(JSON.parse(JSON.stringify(afterD.map((photo) => photo?.url || null))), ['A', 'F', 'C', null, 'E']);

const compacted = filledPhotos(afterD);
assert.deepStrictEqual(JSON.parse(JSON.stringify(compacted.map((photo) => photo.url))), ['A', 'F', 'C', 'E']);

const shiftedWrong = photos.filter((_, index) => index !== 1).map((photo) => photo.url);
assert.deepStrictEqual(shiftedWrong, ['A', 'C', 'D', 'E']);
assert.notDeepStrictEqual(JSON.parse(JSON.stringify(afterB.map((photo) => photo?.url || null))), ['A', 'C', 'D', 'E', null]);

const list = [{ url: 'A' }, { url: 'B' }, { url: 'C' }];
assert.deepStrictEqual(JSON.parse(JSON.stringify(removeListPhotoByUrl(list, 'B').map((photo) => photo.url))), ['A', 'C']);

const aligned = alignPhotoSlots([{ url: 'A' }], 3);
assert.strictEqual(aligned.length, 3);
assert.strictEqual(aligned[1], null);
assert.strictEqual(emptyPhotoSlots(2).length, 2);

const threeFilled = [{ url: 'A' }, { url: 'B' }, { url: 'C' }, null, null];
const excess = planPhotoUploads(threeFilled, [{ name: '1' }, { name: '2' }, { name: '3' }, { name: '4' }], null, 5);
assert.strictEqual(excess.blocked, true);
assert.strictEqual(excess.mode, 'excess');
assert.strictEqual(excess.remaining, 2);
assert.strictEqual(excess.used, 3);
assert.deepStrictEqual(JSON.parse(JSON.stringify(threeFilled.map((photo) => photo?.url || null))), ['A', 'B', 'C', null, null]);

const single = planPhotoUploads(threeFilled, [{ name: 'D' }], null, 5);
assert.strictEqual(single.mode, 'single');
assert.strictEqual(single.jobs[0].index, 3);
assert.strictEqual(single.blocked, false);

const replace = planPhotoUploads(threeFilled, [{ name: 'Z' }], 1, 5);
assert.strictEqual(replace.mode, 'replace');
assert.strictEqual(replace.jobs[0].index, 1);
assert.strictEqual(replace.blocked, false);

console.log('Photo slot identity tests passed');

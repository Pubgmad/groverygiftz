const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const clientSource = fs.readFileSync('src/lib/clientImageUpload.js', 'utf8').replace(/export /g, '');
const productSource = fs.readFileSync('src/components/product/ProductDetail.js', 'utf8');
function functionSource(name, nextName) {
  const start = productSource.indexOf(`const ${name} =`);
  const end = productSource.indexOf(`const ${nextName} =`, start);
  assert.ok(start >= 0 && end > start);
  return productSource.slice(start, end);
}
function runFunction(name, nextName, globals) {
  const context = vm.createContext(globals);
  vm.runInContext(functionSource(name, nextName) + `\nglobalThis.subject = ${name};`, context);
  return context.subject;
}
function clientContext() {
  const blobs = [];
  const revoked = [];
  class Image {
    set src(value) {
      this.naturalWidth = 100;
      this.naturalHeight = 80;
      queueMicrotask(() => value.includes('broken') ? this.onerror?.() : this.onload?.());
    }
  }
  const context = vm.createContext({ Uint8Array, Image, setTimeout, clearTimeout, URL: {
    createObjectURL(blob) { blobs.push(blob); return blob.type === 'image/broken' ? 'blob:broken' : 'blob:valid'; },
    revokeObjectURL(url) { revoked.push(url); },
  } });
  vm.runInContext(clientSource, context);
  return { context, blobs, revoked };
}
test('actual JPEG signature overrides misleading HEIC extension and MIME for display only', async () => {
  const { context, blobs } = clientContext();
  const file = new Blob([Buffer.from([255, 216, 255, 0, 0])], { type: 'image/heic' });
  file.name = 'shared.heic';
  const prepared = await context.prepareImageUpload(file);
  assert.equal(prepared.previewUrl, 'blob:valid');
  assert.equal(blobs[0].type, 'image/jpeg');
  assert.equal(file.type, 'image/heic');
});
test('AVIF with mif1 compatible brand is not sent through HEIC conversion', async () => {
  const { context } = clientContext();
  const file = new Blob([Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypavif'), Buffer.alloc(4), Buffer.from('mif1avif')])], { type: 'image/avif' });
  file.name = 'photo.avif';
  assert.equal((await context.prepareImageUpload(file)).previewUrl, 'blob:valid');
});
test('unreadable browser image rejects instead of reporting successful preview preparation', async () => {
  const { context, revoked } = clientContext();
  const file = new Blob(['invalid'], { type: 'image/broken' });
  file.name = 'photo.jpg';
  await assert.rejects(context.prepareImageUpload(file), /could not be decoded/);
  assert.deepEqual(revoked, ['blob:broken']);
});
test('failed second photo retains the first successfully uploaded photo', async () => {
  let photos = [];
  let calls = 0;
  const errors = [];
  const subject = runFunction('handleCustomerPhotoUpload', 'handleVariantLabelUpload', {
    maxPhotoCount: 2, customerPhotos: [], setUploadingCustomerPhotos() {},
    prepareImageUpload: async () => ({ previewUrl: 'blob:valid' }),
    FormData: class {}, appendImageUpload() {},
    fetch: async () => ++calls === 1 ? { ok: true, json: async () => ({ url: '/first.jpg' }) } : { ok: false, json: async () => ({ error: 'Upload failed' }) },
    attachLocalPreview: (data) => data,
    setCustomerPhotos: (update) => { photos = update(photos); },
    toast: { success() {}, error: (error) => errors.push(error) },
    trackMetaCustomEvent() {}, getProductPixelPayload() {},
  });
  await subject([{ name: 'first.jpg' }, { name: 'second.jpg' }]);
  assert.equal(photos.length, 1);
  assert.equal(photos[0].url, '/first.jpg');
  assert.equal(errors.length, 1);
});
test('failed second collage upload retains the first image under its correct label', async () => {
  let groups = {};
  let calls = 0;
  const subject = runFunction('handleCollageUpload', 'removeCollagePhoto', {
    collageTemplates: [{ label: 'Left frame', minImages: 1, maxImages: 2 }], collageUploads: {},
    setUploadingCollageLabels() {}, prepareImageUpload: async () => ({}), FormData: class {}, appendImageUpload() {},
    fetch: async () => ++calls === 1 ? { ok: true, json: async () => ({ url: '/first.jpg' }) } : { ok: false, json: async () => ({ error: 'Upload failed' }) },
    attachLocalPreview: (data) => data, setCollageUploads: (update) => { groups = update(groups); },
    toast: { success() {}, error() {} }, trackMetaCustomEvent() {}, getProductPixelPayload() {},
  });
  await subject('Left frame', [{ name: 'first.jpg' }, { name: 'second.jpg' }]);
  assert.equal(groups['Left frame'].length, 1);
  assert.equal(groups['Left frame'][0].url, '/first.jpg');
});
test('failed variant replacement preserves the existing uploaded image', async () => {
  let changes = 0;
  const subject = runFunction('handleVariantLabelUpload', 'handleCollageUpload', {
    setUploadingVariantLabels() {}, prepareImageUpload: async () => { throw new Error('Decode failed'); },
    setVariantLabelUploads() { changes += 1; }, toast: { error() {} },
  });
  await subject('Frame', { name: 'broken.jpg' });
  assert.equal(changes, 0);
});
test('preview generation failure propagates instead of becoming an empty saved preview', async () => {
  const subject = runFunction('renderFinalPreviewImage', 'uploadRenderedPreviewImage', {
    customerPhotos: [{ url: '/original.jpg' }], displayUploadUrl: (photo) => photo.url,
    getAreaAdjustments: () => ({}), getPreviewDimensions: () => ({ displayWidth: 360, displayHeight: 480 }),
    document: { createElement: () => ({ getContext: () => ({ fillRect() {} }) }) },
    loadPreviewImage: async () => { throw new Error('Decode failed'); },
  });
  await assert.rejects(subject({}, 0), /Decode failed/);
});
test('an expired local blob retries the same image from its persistent display URL', async () => {
  const calls = [];
  const subject = runFunction('renderFinalPreviewImage', 'uploadRenderedPreviewImage', {
    customerPhotos: [{ previewUrl: 'blob:expired', displayUrl: '/same-image.jpg' }],
    displayUploadUrl: (photo) => photo.previewUrl || photo.displayUrl,
    getAreaAdjustments: () => ({}), getPreviewDimensions: () => ({ displayWidth: 360, displayHeight: 480 }),
    document: { createElement: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,preview' }) },
    loadPreviewImage: async (url) => { calls.push(url); if (url.startsWith('blob:')) throw new Error('Expired'); return { naturalWidth: 100, naturalHeight: 80 }; },
    getContainedDrawRect: () => ({ x: 0, y: 0, width: 100, height: 80 }),
  });
  assert.match(await subject({}, 0), /^data:image/);
  assert.deepEqual(calls, ['blob:expired', '/same-image.jpg']);
});
test('failed generated-preview upload is surfaced to the cart operation', async () => {
  const subject = runFunction('uploadRenderedPreviewImage', 'buildCustomizationPreviewPayload', {
    fetch: async (url) => url.startsWith('data:') ? { blob: async () => new Blob(['preview']) } : { ok: false, json: async () => ({ error: 'Storage unavailable' }) },
    FormData, File,
  });
  await assert.rejects(subject('data:image/jpeg;base64,AA==', 'Frame', 0), /Storage unavailable/);
});
test('empty preview is rejected before any upload request', async () => {
  const subject = runFunction('uploadRenderedPreviewImage', 'buildCustomizationPreviewPayload', {});
  await assert.rejects(subject('', 'Frame', 0), /preview is empty/);
});
test('cart preview payload generation rejects when one required preview fails', async () => {
  const subject = runFunction('buildCustomizationPreviewPayload', 'updateAreaAdjustments', {
    previewEnabled: true, previewAreas: [{ label: 'First' }, { label: 'Second' }],
    customerPhotos: [{ url: '/first.jpg' }, { url: '/second.jpg' }], savedPreviewFilesRef: { current: {} },
    getAreaAdjustments: () => ({}), renderFinalPreviewImage: async () => { throw new Error('First preview failed'); },
  });
  await assert.rejects(subject(), /First preview failed/);
});

test('Save Preview only reports success after its file is stored', async () => {
  const cache = { current: {} };
  const locked = { current: new Set() };
  let markedSaved = false;
  let success = false;
  let finishUpload;
  const upload = new Promise((resolve) => { finishUpload = resolve; });
  const subject = runFunction('savePreviewArea', 'editPreviewArea', {
    previewSaveLocksRef: locked, actionLockRef: { current: false }, setSavingPreviewAreas() {},
    previewAreas: [{ label: 'Frame' }], customerPhotos: [{ url: '/original.jpg' }],
    getAreaAdjustments: () => ({ zoom: 1 }), renderFinalPreviewImage: async () => 'data:image/jpeg;base64,AA==',
    uploadRenderedPreviewImage: () => upload, savedPreviewFilesRef: cache,
    setSavedPreviewAreas() { markedSaved = true; }, toast: { success() { success = true; }, error() {} },
  });
  const pending = subject(0);
  await Promise.resolve();
  assert.equal(markedSaved, false);
  assert.equal(success, false);
  assert.equal(locked.current.has(0), true);
  finishUpload({ url: '/stored-preview.jpg' });
  await pending;
  assert.equal(markedSaved, true);
  assert.equal(success, true);
  assert.equal(cache.current[0].file.url, '/stored-preview.jpg');
  assert.equal(locked.current.size, 0);
});

test('failed Save Preview retains an editable state and releases its lock', async () => {
  const cache = { current: {} };
  const locked = { current: new Set() };
  let markedSaved = false;
  let error = '';
  const subject = runFunction('savePreviewArea', 'editPreviewArea', {
    previewSaveLocksRef: locked, actionLockRef: { current: false }, setSavingPreviewAreas() {},
    previewAreas: [{ label: 'Frame' }], customerPhotos: [{ url: '/original.jpg' }],
    getAreaAdjustments: () => ({ zoom: 1 }), renderFinalPreviewImage: async () => { throw new Error('Decode failed'); },
    savedPreviewFilesRef: cache, setSavedPreviewAreas() { markedSaved = true; },
    toast: { success() {}, error(message) { error = message; } },
  });
  await subject(0);
  assert.equal(markedSaved, false);
  assert.equal(error, 'Decode failed');
  assert.equal(Object.keys(cache.current).length, 0);
  assert.equal(locked.current.size, 0);
});

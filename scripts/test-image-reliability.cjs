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
  const context = vm.createContext({ JSON, Blob, console, ...globals });
  Object.assign(context, globals);
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
  const subject = runFunction('handleCustomerPhotoUpload', 'removeCustomerPhoto', {
    stockLocked: false,
    photoSlotCount: 2, customerPhotos: [], setUploadingCustomerPhotos() {},
    setPhotoLimitPlan() {}, setUploadingPhotoSlots() {}, setActivePreviewSlot() {},
    setPreviewAdjustments() {}, setEditorSlotKey() {}, editPreviewArea() {},
    photoUploadTokenRef: { current: {} }, photoUploadPromiseRef: { current: {} },
    customerPhotosRef: { current: [] }, previewAreas: [],
    imagePerfMark() {}, imagePerfMeasure() {},
    readJsonResponse: async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return data;
    },
    planPhotoUploads: (_photos, files) => ({
      blocked: false,
      jobs: files.map((file, index) => ({ file, index })),
    }),
    alignPhotoSlots: (list, count = 2) => Array.from({ length: count }, (_, index) => list[index] || null),
    clearPhotoSlot: (list, index) => {
      const next = list.slice();
      next[index] = null;
      return next;
    },
    setPhotoSlot: (list, index, file) => {
      const next = list.slice();
      next[index] = file;
      return next;
    },
    adjustmentsForUploadedPhoto: () => ({ zoom: 1 }),
    prepareImageUpload: async () => ({ previewUrl: 'blob:valid', width: 100, height: 80 }),
    FormData: class {}, appendImageUpload() {},
    fetch: async () => ++calls === 1 ? { ok: true, json: async () => ({ url: '/first.jpg' }) } : { ok: false, json: async () => ({ error: 'Upload failed' }) },
    attachLocalPreview: (data) => data,
    setCustomerPhotos: (update) => { photos = update(photos); },
    toast: { success() {}, error: (error) => errors.push(error) },
    trackMetaCustomEvent() {}, getProductPixelPayload() {},
  });
  await subject([{ name: 'first.jpg' }, { name: 'second.jpg' }]);
  const kept = photos.filter((photo) => photo?.url);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].url, '/first.jpg');
  assert.equal(errors.length, 1);
});
test('failed second collage upload retains the first image under its correct label', async () => {
  let groups = {};
  let calls = 0;
  const subject = runFunction('handleCollageUpload', 'removeCollagePhoto', {
    stockLocked: false,
    collageTemplates: [{ label: 'Left frame', minImages: 1, maxImages: 2 }], collageUploads: {},
    collageUploadsRef: { current: {} }, collageUploadPromiseRef: { current: {} },
    setUploadingCollageLabels() {}, prepareImageUpload: async () => ({}), FormData: class {}, appendImageUpload() {},
    readJsonResponse: async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return data;
    },
    fetch: async () => ++calls === 1 ? { ok: true, json: async () => ({ url: '/first.jpg' }) } : { ok: false, json: async () => ({ error: 'Upload failed' }) },
    attachLocalPreview: (data) => data, setCollageUploads: (update) => { groups = update(groups); },
    toast: { success() {}, error() {} }, trackMetaCustomEvent() {}, getProductPixelPayload() {},
  });
  await subject('Left frame', [{ name: 'first.jpg' }, { name: 'second.jpg' }]);
  assert.equal(groups['Left frame'].length, 1);
  assert.equal(groups['Left frame'][0].url, '/first.jpg');
});
test('failed variant replacement preserves the existing uploaded image', async () => {
  let uploads = { Frame: { url: '/existing.jpg', name: 'kept.jpg' } };
  const subject = runFunction('handleVariantLabelUpload', 'handleCollageUpload', {
    stockLocked: false,
    editorSlotKey: null,
    setEditorSlotKey() {},
    editPreviewArea() {},
    selectedVariantUploadOptions: [],
    variantUploadPromiseRef: { current: {} },
    setUploadingVariantLabels() {}, prepareImageUpload: async () => { throw new Error('Decode failed'); },
    setVariantLabelUploads: (update) => {
      uploads = typeof update === 'function' ? update(uploads) : { ...uploads, ...update };
    },
    toast: { error() {} },
  });
  await subject('Frame', { name: 'broken.jpg' });
  assert.equal(uploads.Frame.url, '/existing.jpg');
});
test('previewLoadUrls prefers the live editor blob before signed display URL', () => {
  const { context } = clientContext();
  assert.equal(
    JSON.stringify(context.previewLoadUrls({ previewUrl: 'blob:live', displayUrl: '/signed.jpg', url: '/original.jpg' })),
    JSON.stringify(['blob:live', '/signed.jpg', '/original.jpg'])
  );
});
const renderGlobals = {
  imagePerfMark() {},
  imagePerfMeasure() {},
  beginCanvasPhotoLook() {},
  endCanvasPhotoLook() {},
  previewImageCache: new Map(),
  frameImageCache: new Map(),
  canvasToJpegBlob: async (canvas) => {
    if (typeof canvas.toBlob === 'function') {
      return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))), 'image/jpeg', 0.9);
      });
    }
    return new Blob([canvas.toDataURL?.() || 'jpeg'], { type: 'image/jpeg' });
  },
  Math,
  Number,
  getDefaultPreviewAdjustments: () => ({ zoom: 1, x: 0, y: 0, orientation: 'auto', rotation: 0, fitMode: 'fit' }),
};
test('preview generation failure propagates instead of becoming an empty saved preview', async () => {
  const { context } = clientContext();
  const subject = runFunction('renderFinalPreviewImage', 'uploadRenderedPreviewImage', {
    ...renderGlobals,
    customerPhotos: [{ url: '/original.jpg' }],
    previewLoadUrls: context.previewLoadUrls,
    getAreaAdjustments: () => ({}), getPreviewDimensions: () => ({ displayWidth: 360, displayHeight: 480 }),
    document: { createElement: () => ({ getContext: () => ({ fillRect() {}, save() {}, restore() {}, drawImage() {}, translate() {}, rotate() {} }) }) },
    loadPreviewImage: async () => { throw new Error('Decode failed'); },
  });
  await assert.rejects(subject({}, 0), /Decode failed/);
});
function previewCanvasDocument() {
  return {
    createElement: () => ({
      getContext: () => ({
        fillRect() {},
        drawImage() {},
        save() {},
        restore() {},
        translate() {},
        rotate() {},
      }),
      toBlob: (cb) => cb(new Blob(['preview-jpeg'], { type: 'image/jpeg' })),
      toDataURL: () => 'data:image/jpeg;base64,preview',
    }),
  };
}
test('an expired local blob retries the same image from its persistent display URL', async () => {
  const { context } = clientContext();
  const calls = [];
  const subject = runFunction('renderFinalPreviewImage', 'uploadRenderedPreviewImage', {
    ...renderGlobals,
    customerPhotos: [{ previewUrl: 'blob:expired', displayUrl: '/same-image.jpg' }],
    previewLoadUrls: context.previewLoadUrls,
    getAreaAdjustments: () => ({}), getPreviewDimensions: () => ({ displayWidth: 360, displayHeight: 480 }),
    document: previewCanvasDocument(),
    loadPreviewImage: async (url) => { calls.push(url); if (url.startsWith('blob:')) throw new Error('Expired'); return { naturalWidth: 100, naturalHeight: 80 }; },
    getContainedDrawRect: () => ({ x: 0, y: 0, width: 100, height: 80 }),
  });
  const blob = await subject({}, 0);
  assert.equal(blob instanceof Blob, true);
  assert.equal(blob.type, 'image/jpeg');
  assert.equal(JSON.stringify(calls), JSON.stringify(['blob:expired', '/same-image.jpg']));
});
test('failed signed display URL retries the live blob the editor already shows', async () => {
  const { context } = clientContext();
  const calls = [];
  // Reproduce the old production order (display first); Apply must still recover via blob.
  const subject = runFunction('renderFinalPreviewImage', 'uploadRenderedPreviewImage', {
    ...renderGlobals,
    customerPhotos: [{ previewUrl: 'blob:live', displayUrl: '/signed-401.jpg' }],
    previewLoadUrls: () => ['/signed-401.jpg', 'blob:live'],
    getAreaAdjustments: () => ({}), getPreviewDimensions: () => ({ displayWidth: 360, displayHeight: 480 }),
    document: previewCanvasDocument(),
    loadPreviewImage: async (url) => {
      calls.push(url);
      if (url.includes('signed-401')) throw new Error('Unable to load the image for preview. Please try uploading it again.');
      return { naturalWidth: 100, naturalHeight: 80 };
    },
    getContainedDrawRect: () => ({ x: 0, y: 0, width: 100, height: 80 }),
  });
  const blob = await subject({}, 0);
  assert.equal(blob instanceof Blob, true);
  assert.equal(JSON.stringify(calls), JSON.stringify(['/signed-401.jpg', 'blob:live']));
  assert.equal(JSON.stringify(context.previewLoadUrls({ previewUrl: 'blob:live', displayUrl: '/signed-401.jpg' })), JSON.stringify(['blob:live', '/signed-401.jpg']));
});
test('failed generated-preview upload is surfaced to the cart operation', async () => {
  const subject = runFunction('uploadRenderedPreviewImage', 'buildCustomizationPreviewPayload', {
    imagePerfMark() {}, imagePerfMeasure() {},
    readJsonResponse: async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return data;
    },
    fetch: async (url) => url.startsWith('data:') ? { blob: async () => new Blob(['preview']) } : { ok: false, json: async () => ({ error: 'Storage unavailable' }) },
    FormData, File, URL: { createObjectURL: () => 'blob:preview' },
  });
  await assert.rejects(subject('data:image/jpeg;base64,AA==', 'Frame', 0), /Storage unavailable/);
});
test('empty preview is rejected before any upload request', async () => {
  const subject = runFunction('uploadRenderedPreviewImage', 'buildCustomizationPreviewPayload', {
    imagePerfMark() {}, imagePerfMeasure() {},
  });
  await assert.rejects(subject(null, 'Frame', 0), /preview is empty/);
});
test('cart preview payload generation rejects when one required preview fails', async () => {
  const subject = runFunction('buildCustomizationPreviewPayload', 'savePreviewArea', {
    imagePerfMark() {}, imagePerfMeasure() {},
    previewLoadUrls: (upload) => [upload?.url].filter(Boolean),
    durableUploadRef: (file) => file,
    resolveDurableFinalPreview: async () => { throw new Error('First preview failed'); },
    previewEnabled: true, previewAreas: [{ label: 'First' }, { label: 'Second' }],
    customerPhotos: [{ url: '/first.jpg' }, { url: '/second.jpg' }],
    customerPhotosRef: { current: [{ url: '/first.jpg' }, { url: '/second.jpg' }] },
    variantLabelUploadsRef: { current: {} },
    savedPreviewFilesRef: { current: {} },
    selectedVariantUploadOptions: [],
    getAreaAdjustments: () => ({}),
    getFrameSize: (area) => ({ width: area.width || 1, height: area.height || 1 }),
    renderFinalPreviewImage: async () => { throw new Error('First preview failed'); },
    JSON,
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
    JSON, Blob,
    previewSaveLocksRef: locked, actionLockRef: { current: false }, setSavingPreviewAreas() {},
    previewAreas: [{ label: 'Frame' }], customerPhotos: [{ url: '/original.jpg' }],
    customerPhotosRef: { current: [{ url: '/original.jpg' }] },
    variantLabelUploadsRef: { current: {} },
    photoUploadPromiseRef: { current: {} },
    photoUploadTokenRef: { current: {} },
    previewPersistPromiseRef: { current: {} },
    selectedVariantUploadOptions: [], variantLabelUploads: {}, previewEnabled: true,
    getDefaultPreviewAdjustments: () => ({ zoom: 1 }),
    setPreviewAdjustments() {},
    imagePerfMark() {}, imagePerfMeasure() {},
    previewLoadUrls: (upload) => [upload?.previewUrl, upload?.displayUrl, upload?.url].filter(Boolean),
    liveBlobUrl: () => '',
    URL: { createObjectURL: () => 'blob:local-preview', revokeObjectURL() {} },
    getAreaAdjustments: () => ({ zoom: 1 }), renderFinalPreviewImage: async () => new Blob(['AA'], { type: 'image/jpeg' }),
    uploadRenderedPreviewImage: () => upload, savedPreviewFilesRef: cache,
    setSavedPreviewAreas() { markedSaved = true; }, toast: { success() { success = true; }, error() {} },
  });
  const result = await subject(0);
  assert.equal(result, true);
  assert.equal(success, true);
  assert.equal(locked.current.has(0), true);
  assert.equal(Boolean(cache.current[0]?.file?.url), false);
  finishUpload({ url: '/stored-preview.jpg' });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(markedSaved, true);
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
    customerPhotosRef: { current: [{ url: '/original.jpg' }] },
    variantLabelUploadsRef: { current: {} },
    photoUploadPromiseRef: { current: {} },
    photoUploadTokenRef: { current: {} },
    previewPersistPromiseRef: { current: {} },
    selectedVariantUploadOptions: [], variantLabelUploads: {}, previewEnabled: true,
    getDefaultPreviewAdjustments: () => ({ zoom: 1 }),
    setPreviewAdjustments() {},
    imagePerfMark() {}, imagePerfMeasure() {},
    previewLoadUrls: (upload) => [upload?.previewUrl, upload?.displayUrl, upload?.url].filter(Boolean),
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

test('cart reuses a durable applied preview even if Apply started from a blob URL', async () => {
  let rendered = 0;
  const subject = runFunction('resolveDurableFinalPreview', 'buildCustomizationPreviewPayload', {
    previewPersistPromiseRef: { current: {} },
    savedPreviewFilesRef: { current: {
      0: {
        file: { url: '/preview.jpg', originalUrl: '/preview.jpg', displayUrl: '/preview.jpg' },
        sourceUrl: 'blob:local',
        adjustments: JSON.stringify({ zoom: 1 }),
        pending: false,
      },
    } },
    getAreaAdjustments: () => ({ zoom: 1 }),
    JSON,
    durableUploadRef: (file) => (file?.url ? file : null),
    isEphemeralMediaUrl: (value) => String(value || '').startsWith('blob:') || String(value || '').startsWith('data:'),
    renderFinalPreviewImage: async () => { rendered += 1; throw new Error('should not render'); },
    uploadRenderedPreviewImage: async () => { throw new Error('should not upload'); },
  });
  const file = await subject({
    previewKey: 0,
    area: { label: 'Frame' },
    uploadedFile: { url: '/original.jpg', storagePath: 'customizations/o.jpg' },
    areaLabel: 'Frame',
    uploadIndex: 0,
  });
  assert.equal(file.url, '/preview.jpg');
  assert.equal(rendered, 0);
});

test('cart awaits an in-flight Apply persist instead of baking again', async () => {
  let rendered = 0;
  let finish;
  const persist = new Promise((resolve) => { finish = resolve; });
  const cache = { current: {
    0: { file: { previewUrl: 'blob:local' }, sourceUrl: 'blob:local', adjustments: JSON.stringify({ zoom: 1 }), pending: true },
  } };
  const persistRef = { current: { 0: persist.then(() => {
    cache.current[0] = {
      file: { url: '/preview.jpg', originalUrl: '/preview.jpg' },
      sourceUrl: '/original.jpg',
      adjustments: JSON.stringify({ zoom: 1 }),
      pending: false,
    };
  }) } };
  const subject = runFunction('resolveDurableFinalPreview', 'buildCustomizationPreviewPayload', {
    previewPersistPromiseRef: persistRef,
    savedPreviewFilesRef: cache,
    getAreaAdjustments: () => ({ zoom: 1 }),
    JSON,
    durableUploadRef: (file) => (file?.url ? file : null),
    isEphemeralMediaUrl: (value) => String(value || '').startsWith('blob:'),
    renderFinalPreviewImage: async () => { rendered += 1; throw new Error('should not render'); },
    uploadRenderedPreviewImage: async () => { throw new Error('should not upload'); },
  });
  const pending = subject({
    previewKey: 0,
    area: { label: 'Frame' },
    uploadedFile: { url: '/original.jpg' },
    areaLabel: 'Frame',
    uploadIndex: 0,
  });
  finish();
  const file = await pending;
  assert.equal(file.url, '/preview.jpg');
  assert.equal(rendered, 0);
});

test('Add to Cart awaits in-flight image work instead of failing immediately', () => {
  assert.equal(productSource.includes('Please wait for your images and previews to finish saving.'), false);
  assert.equal(productSource.includes('await awaitPendingCartAssets()'), true);
  assert.equal(productSource.includes('flush: true'), true);
});

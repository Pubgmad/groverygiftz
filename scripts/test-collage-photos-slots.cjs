/** Unit checks for Collage Photos size+count slot builder. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const strip = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];\r?\n/gm, '')
  .replace(/export /g, '');

function loadPhotoConfig() {
  // formatFrameSizeLabel is imported — stub a tiny local helper in context.
  const photoEditorStub = `
    function formatFrameSizeLabel(area) {
      if (!area) return '';
      const w = Number(area.width) || 0;
      const h = Number(area.height) || 0;
      if (!(w > 0) || !(h > 0)) return '';
      return w + '×' + h + ' ' + (area.unit || 'inch');
    }
  `;
  const source = strip('src/lib/websiteProductPhotoConfig.js');
  const context = { console, Intl, Date, Number, String, Array, Math, Boolean, Map, Set };
  vm.createContext(context);
  vm.runInContext(`${photoEditorStub}\n${source}\nthis.api = { buildCollageRolePhotoSlots, listUniqueWebsiteSizes, resolveWebsiteSizeConfig };`, context);
  return context.api;
}

const frameProduct = {
  _id: 'frame1',
  title: 'Personalized Single Photo Frame with Matte Finish',
  variants: [{
    name: 'Size',
    options: [
      {
        _id: 'opt-8x10',
        label: '8x10 inch',
        requiresImageUpload: true,
        previewWidth: 8,
        previewHeight: 10,
        previewUnit: 'inch',
        previewFrameImage: '/frames/8x10.png',
      },
      {
        _id: 'opt-12x18',
        label: '12x18 inch',
        requiresImageUpload: true,
        previewWidth: 12,
        previewHeight: 18,
        previewUnit: 'inch',
        previewFrameImage: '/frames/12x18.png',
      },
    ],
  }],
  customizationPreview: { enabled: true, previewEnabled: true, uploadEnabled: true },
};

test('main count 1 yields one main slot with frame dims', () => {
  const api = loadPhotoConfig();
  const sizes = api.listUniqueWebsiteSizes([frameProduct]).sizes;
  const eight = sizes.find((s) => /8/.test(s.sizeLabel) && /10/.test(s.sizeLabel));
  assert.ok(eight, '8x10 size present');
  const slots = api.buildCollageRolePhotoSlots({
    sizeCatalogProduct: frameProduct,
    sizeKey: eight.sizeKey,
    count: 1,
    role: 'main',
    roleLabel: 'Main photo',
  });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].label, 'Main photo');
  assert.equal(slots[0].collageRole, 'main');
  assert.equal(slots[0].area.width, 8);
  assert.equal(slots[0].area.height, 10);
  assert.equal(slots[0].required, false);
});

test('background count 2 yields two background slots', () => {
  const api = loadPhotoConfig();
  const sizes = api.listUniqueWebsiteSizes([frameProduct]).sizes;
  const twelve = sizes.find((s) => /12/.test(s.sizeLabel) && /18/.test(s.sizeLabel));
  assert.ok(twelve, '12x18 size present');
  const slots = api.buildCollageRolePhotoSlots({
    sizeCatalogProduct: frameProduct,
    sizeKey: twelve.sizeKey,
    count: 2,
    role: 'background',
    roleLabel: 'Background photo',
  });
  assert.equal(slots.length, 2);
  assert.equal(slots[0].label, 'Background photo 1');
  assert.equal(slots[1].label, 'Background photo 2');
  assert.ok(slots.every((s) => s.collageRole === 'background'));
  assert.ok(slots.every((s) => s.area.width === 12 && s.area.height === 18));
});

test('missing size or zero count yields no slots', () => {
  const api = loadPhotoConfig();
  assert.equal(api.buildCollageRolePhotoSlots({
    sizeCatalogProduct: frameProduct,
    sizeKey: '',
    count: 2,
    role: 'main',
  }).length, 0);
  assert.equal(api.buildCollageRolePhotoSlots({
    sizeCatalogProduct: frameProduct,
    sizeKey: '8x10',
    count: 0,
    role: 'main',
  }).length, 0);
});

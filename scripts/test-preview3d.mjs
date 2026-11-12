import * as esbuild from 'esbuild';
import { createRequire } from 'module';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'preview3d-'));
const outfile = join(tmp, 'bundle.cjs');

await esbuild.build({
  stdin: {
    contents: `
      export * from './src/lib/preview3d.js';
      export * from './src/lib/preview3dGlb.js';
    `,
    resolveDir: root,
    sourcefile: 'entry.js',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  alias: { '@': join(root, 'src') },
  logLevel: 'silent',
});

process.env.PREVIEW3D_ALLOW_PROTOTYPE = process.env.PREVIEW3D_ALLOW_PROTOTYPE || '1';
const require = createRequire(import.meta.url);
const m = require(outfile);

const disabled = m.normalizePreview3dConfig({});
if (disabled.enabled !== false) throw new Error('default must be disabled');
if (!Array.isArray(disabled.surfaces)) throw new Error('surfaces array required');

const product = {
  customizationPreview: {
    areas: [
      { label: 'Frame A', requiresImageUpload: true },
      { label: 'Frame B', requiresImageUpload: true },
      { label: 'Frame C', requiresImageUpload: true },
    ],
  },
};
const slots = m.listCustomizationSlotDescriptors(product);
if (slots.length !== 3) throw new Error(`expected 3 slots, got ${slots.length}`);
if (slots[0].slotKey !== 'area:index:0') throw new Error(`expected index-stable key, got ${slots[0].slotKey}`);
if (slots[0].legacySlotKey !== 'area:Frame A') throw new Error('legacy label key missing');

const dupProduct = {
  customizationPreview: {
    areas: [
      { label: 'Photo', requiresImageUpload: true },
      { label: 'Photo', requiresImageUpload: true },
    ],
  },
};
const dupSlots = m.listCustomizationSlotDescriptors(dupProduct);
if (dupSlots[0].slotKey === dupSlots[1].slotKey) throw new Error('duplicate labels must not collide on slotKey');
if (!dupSlots[0].labelCollision || !dupSlots[1].labelCollision) throw new Error('labelCollision flag required');
const dupMapped = m.buildViewerTextureSlots({
  product: dupProduct,
  preview3d: {
    enabled: true,
    geometryType: 'multi_grid',
    surfaceMappings: [
      { slotKey: 'area:index:0', surfaceId: 'face_1' },
      { slotKey: 'area:index:1', surfaceId: 'face_2' },
    ],
  },
  customerPhotos: [{ url: '/media/a.jpg' }, { url: '/media/b.jpg' }],
});
if (dupMapped[0].surfaceId !== 'face_1' || dupMapped[1].surfaceId !== 'face_2') {
  throw new Error('duplicate-label slots must map by index');
}
const legacyCompat = m.buildViewerTextureSlots({
  product,
  preview3d: {
    enabled: true,
    geometryType: 'multi_grid',
    surfaceMappings: [{ slotKey: 'area:Frame A', surfaceId: 'face_1' }],
  },
  customerPhotos: [{ url: '/media/a.jpg' }],
});
if (legacyCompat[0].surfaceId !== 'face_1') throw new Error('legacy area:Label mappings must still resolve');

const textures = m.buildViewerTextureSlots({
  product,
  preview3d: { enabled: true, geometryType: 'multi_grid' },
  customerPhotos: [
    { url: '/media/a.jpg' },
    null,
    { displayUrl: '/media/c.jpg' },
  ],
});
if (textures.length !== 3) throw new Error('texture slots must match config count');
if (textures[0].isPlaceholder) throw new Error('slot 0 should have texture');
if (!textures[1].isPlaceholder) throw new Error('slot 1 should be placeholder');
if (textures[2].isPlaceholder) throw new Error('slot 2 should have texture');

if (m.isPreview3dEligible({ preview3d: { enabled: false } })) throw new Error('disabled not eligible');
if (!m.isPreview3dEligible({ preview3d: { enabled: true, geometryType: 'single_plane' } })) {
  throw new Error('enabled single_plane should be eligible');
}
if (m.isPreview3dEligible({ preview3d: { enabled: true, geometryType: 'custom_glb', modelUrl: '' } })) {
  throw new Error('custom_glb without model should not be eligible');
}

if (m.isPhotoFrame3dAdminPreviewFlagEnabled({})) {
  throw new Error('admin preview flag must default off');
}
if (m.isPhotoFrame3dAdminPreviewFlagEnabled({ PHOTO_FRAME_3D_ADMIN_PREVIEW_ENABLED: 'true' })) {
  throw new Error('admin preview flag must require literal 1');
}
if (!m.isPhotoFrame3dAdminPreviewFlagEnabled({ PHOTO_FRAME_3D_ADMIN_PREVIEW_ENABLED: '1' })) {
  throw new Error('admin preview flag 1 should enable');
}
if (!m.isPreview3dAdminCandidate({ preview3d: { enabled: true, geometryType: 'photo_frame' } })) {
  throw new Error('enabled photo_frame should be an admin candidate');
}

{
  const prevNode = process.env.NODE_ENV;
  const prevProto = process.env.PREVIEW3D_ALLOW_PROTOTYPE;
  const prevPublic = process.env.NEXT_PUBLIC_PREVIEW3D_ALLOW_PROTOTYPE;
  process.env.NODE_ENV = 'production';
  delete process.env.PREVIEW3D_ALLOW_PROTOTYPE;
  delete process.env.NEXT_PUBLIC_PREVIEW3D_ALLOW_PROTOTYPE;
  try {
    if (m.allowPrototypeCustomerPreview()) throw new Error('production must not allow prototypes');
    if (!m.isPreview3dEligible({ preview3d: { enabled: true, geometryType: 'photo_frame' } })) {
      throw new Error('enabled photo_frame must be customer-visible');
    }
    if (!m.isPreview3dEligible({ preview3d: { enabled: true, geometryType: 'single_plane', retailReadiness: 'prototype' } })) {
      throw new Error('enabled 3D toggle must show customers the preview regardless of retail readiness');
    }
    if (m.isPreview3dEligible({ preview3d: { enabled: false, geometryType: 'photo_frame' } })) {
      throw new Error('disabled products must not show customer 3D');
    }
    const visible = m.applyPublicPreview3dVisibility(
      { title: 'Frame', preview3d: { enabled: true, geometryType: 'photo_frame' } },
      {},
    );
    if (visible.preview3d?.enabled !== true) throw new Error('enabled 3D config must reach the customer product payload');
    const hidden = m.applyPublicPreview3dVisibility(
      { title: 'Frame', preview3d: { enabled: false, geometryType: 'photo_frame' } },
      { adminPreview: false, authorizedAdmin: false },
    );
    if (hidden.preview3d?.enabled !== false) throw new Error('disabled 3D must stay redacted for customers');
  } finally {
    process.env.NODE_ENV = prevNode;
    if (prevProto === undefined) delete process.env.PREVIEW3D_ALLOW_PROTOTYPE;
    else process.env.PREVIEW3D_ALLOW_PROTOTYPE = prevProto;
    if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_PREVIEW3D_ALLOW_PROTOTYPE;
    else process.env.NEXT_PUBLIC_PREVIEW3D_ALLOW_PROTOTYPE = prevPublic;
  }
}

const pick = m.pickTextureUrlForSlot({ url: '/media/photo.jpg' }, { finalPreviewImage: '/media/composed-with-frame.jpg' });
if (pick.source !== 'customer_photo') throw new Error('must prefer customer photo over composed frame preview');

const live = m.pickTextureUrlForSlot({ previewUrl: 'blob:http://localhost/fake' }, null);
if (live.source !== 'live_preview') throw new Error('live blob should be usable in viewer');

const named = m.normalizePreview3dConfig({
  enabled: true,
  geometryType: 'custom_glb',
  modelUrl: '/media/preview3d/models/x.glb',
  surfaces: [{ id: 'mesh:PhotoPlane', label: 'Photo', meshName: 'PhotoPlane', hasUvs: true }],
  surfaceMappings: [{ slotKey: 'area:index:0', surfaceId: 'mesh:PhotoPlane', areaLabel: 'Frame A' }],
});
const validation = m.validateSurfaceMappings(product, named);
if (!validation.ok) throw new Error(`named mapping should validate: ${validation.errors.join(', ')}`);

const bad = m.validateSurfaceMappings(product, {
  ...named,
  surfaceMappings: [
    { slotKey: 'area:index:0', surfaceId: 'mesh:PhotoPlane' },
    { slotKey: 'area:index:1', surfaceId: 'mesh:PhotoPlane' },
  ],
});
if (bad.ok) throw new Error('duplicate surface mapping should fail');

const dupValidation = m.validateSurfaceMappings(dupProduct, {
  enabled: true,
  geometryType: 'multi_grid',
  surfaceMappings: [
    { slotKey: 'area:index:0', surfaceId: 'face_1' },
    { slotKey: 'area:index:1', surfaceId: 'face_2' },
  ],
});
if (!dupValidation.ok) throw new Error('index mappings for duplicate labels should validate');
if (!(dupValidation.warnings || []).some((w) => /Duplicate customization labels/i.test(w))) {
  throw new Error('duplicate labels must surface an admin warning');
}

const meshId = m.buildMeshSurfaceId({ name: 'FrontGlass', parent: { name: 'Root', parent: null } }, 0);
if (meshId !== 'mesh:FrontGlass') throw new Error(`unexpected mesh id ${meshId}`);

const path = m.buildMeshPath({ name: 'Leaf', parent: { name: 'Branch', parent: { name: 'Root', parent: null } } });
if (path !== 'Root/Branch/Leaf') throw new Error(`unexpected path ${path}`);

const diff = m.diffSavedSurfaces(
  [{ id: 'mesh:Old', label: 'Old', meshName: 'Old' }],
  [{ id: 'mesh:New', label: 'New', meshName: 'New' }],
);
if (diff.compatible) throw new Error('missing mesh should be incompatible');

const arranged = m.computeArrangementPositions(10, { mode: 'wall_grid', columns: 5, gap: 0.14, cellScale: 0.8 }, []);
if (arranged.length !== 10) throw new Error('arrangement must honor slot count');
if (arranged[0].x === arranged[4].x) throw new Error('wall_grid row should span distinct x');
const row = m.computeArrangementPositions(4, { mode: 'wall_row' }, []);
if (row.length !== 4) throw new Error('wall_row count mismatch');

const reordered = m.analyzeSlotMappingStability({
  previousAreas: [{ label: 'Frame A' }, { label: 'Frame B' }, { label: 'Frame C' }],
  product: {
    customizationPreview: {
      areas: [
        { label: 'Frame C', requiresImageUpload: true },
        { label: 'Frame A', requiresImageUpload: true },
        { label: 'Frame B', requiresImageUpload: true },
      ],
    },
  },
  preview3d: {
    surfaceMappings: [
      { slotKey: 'area:index:0', surfaceId: 'face_1' },
      { slotKey: 'area:index:1', surfaceId: 'face_2' },
      { slotKey: 'area:index:2', surfaceId: 'face_3' },
    ],
  },
});
if (!(reordered.warnings || []).some((w) => /reordered/i.test(w))) {
  throw new Error('area reorder must warn about index mapping drift');
}

const removed = m.validateSurfaceMappings(
  {
    customizationPreview: {
      areas: [{ label: 'Only', requiresImageUpload: true }],
    },
  },
  {
    geometryType: 'multi_grid',
    surfaceMappings: [
      { slotKey: 'area:index:0', surfaceId: 'face_1' },
      { slotKey: 'area:index:7', surfaceId: 'face_8' },
    ],
  },
);
if (removed.ok) throw new Error('stale index mapping must fail validation');

const framed = m.resolvePreview3dForSelection(
  {
    preview3d: {
      enabled: true,
      geometryType: 'photo_frame',
      photoFrame: {
        enabled: true,
        sizeRuleKey: '5x7',
        designProfileKey: 'design_matte_black_procedural',
        openingWidth: 5,
        openingHeight: 7,
      },
    },
  },
  { Size: { label: '10 × 8', previewWidth: 10, previewHeight: 8 } },
);
if (framed.photoFrame.sizeRuleKey !== '10x8') {
  throw new Error(`selection must apply 10x8 size rule, got ${framed.photoFrame.sizeRuleKey}`);
}
if (framed.photoFrame.openingWidth !== 10 || framed.photoFrame.openingHeight !== 8) {
  throw new Error('selection must copy catalog opening onto preview3d.photoFrame');
}

const variantOnlyProduct = { customizationPreview: { areas: [] } };
const variantSlots = m.listViewerSlotDescriptors(variantOnlyProduct, {
  Size: { label: '5*7 inch', requiresImageUpload: true, previewWidth: 0, previewHeight: 0 },
});
if (variantSlots.length !== 1) throw new Error(`variant-only product must expose 1 live 3D slot, got ${variantSlots.length}`);
if (variantSlots[0].slotKey !== 'variant:5*7 inch') throw new Error(`unexpected variant slot key ${variantSlots[0].slotKey}`);
if (variantSlots[0].width !== 5 || variantSlots[0].height !== 7) {
  throw new Error('variant slot must parse 5×7 from the option label');
}

const variantTextures = m.buildViewerTextureSlots({
  product: variantOnlyProduct,
  preview3d: { enabled: true, geometryType: 'photo_frame' },
  customerPhotos: [],
  selectedVariants: { Size: { label: '5*7 inch', requiresImageUpload: true } },
  variantLabelUploads: { '5*7 inch': { url: '/media/customer-approved.jpg' } },
});
if (variantTextures.length !== 1) throw new Error('variant texture slots must exist');
if (variantTextures[0].isPlaceholder) throw new Error('approved variant upload must appear in 3D texture slots');
if (variantTextures[0].textureUrl !== '/media/customer-approved.jpg') {
  throw new Error('3D texture must use the approved customer image, not a placeholder');
}

const areaProductKeepsAreas = m.listViewerSlotDescriptors(
  { customizationPreview: { areas: [{ label: 'Main', width: 12, height: 8, requiresImageUpload: true }] } },
  { Size: { label: '12*8 inch', requiresImageUpload: true } },
);
if (areaProductKeepsAreas.length !== 1 || areaProductKeepsAreas[0].source !== 'area') {
  throw new Error('configured photo areas must remain the customer size/source of truth');
}

const fromLabel = m.resolvePreview3dDimensions({
  config: { geometryType: 'photo_frame', dimensions: { width: null, height: null, unit: 'inch' } },
  selectedVariantOptions: [{ label: '36*24 inch', previewWidth: 0, previewHeight: 0 }],
});
if (fromLabel.width !== 36 || fromLabel.height !== 24) {
  throw new Error(`36×24 label must drive 36×24 opening, got ${fromLabel.width}x${fromLabel.height}`);
}

const productA = {
  variants: [{ name: 'Size', options: [{ label: '5*7 inch' }] }],
};
const productB = {
  variants: [{ name: 'Size', options: [{ label: '36*24 inch' }, { label: '12*15 inch' }] }],
};
const rulesA = m.sizeRulesForProduct(productA);
const rulesB = m.sizeRulesForProduct(productB);
if (rulesA.length !== 1 || rulesA[0].key !== '5x7') {
  throw new Error(`product A must expose only 5x7, got ${JSON.stringify(rulesA.map((r) => r.key))}`);
}
if (rulesA.some((rule) => rule.key === '12x15' || rule.key === '36x24')) {
  throw new Error('product A must not leak other catalog sizes');
}
if (!rulesB.some((rule) => rule.key === '36x24') || !rulesB.some((rule) => rule.key === '12x15')) {
  throw new Error('product B must keep its configured 36×24 and 12×15');
}
if (rulesB.some((rule) => rule.key === '5x7' || rule.key === '24x36')) {
  throw new Error('product B must not leak 5×7 or swap 36×24 onto 24×36');
}

const framedA = m.resolvePreview3dForSelection(
  {
    ...productA,
    preview3d: {
      enabled: true,
      geometryType: 'photo_frame',
      photoFrame: { enabled: true, sizeRuleKey: '5x7', openingWidth: 5, openingHeight: 7 },
    },
  },
  { Size: { label: '5*7 inch' } },
);
if (framedA.photoFrame.openingWidth !== 5 || framedA.photoFrame.openingHeight !== 7) {
  throw new Error('product A 5×7 selection must keep 5×7 geometry');
}

{
  const threeAreaProduct = {
    customizationPreview: {
      areas: [
        { label: 'Photo 1', requiresImageUpload: true },
        { label: 'Photo 2', requiresImageUpload: true },
        { label: 'Photo 3', requiresImageUpload: true },
      ],
    },
  };
  const threeSlots = m.buildViewerTextureSlots({
    product: threeAreaProduct,
    preview3d: { enabled: true, geometryType: 'photo_frame' },
    customerPhotos: [{ url: '/media/p1.jpg' }, { url: '/media/p2.jpg' }, { url: '/media/p3.jpg' }],
  });
  if (threeSlots[0].slotKey !== 'area:index:0' || threeSlots[2].slotKey !== 'area:index:2') {
    throw new Error('area slots must use stable index keys');
  }
  if (threeSlots[2].textureUrl !== '/media/p3.jpg') throw new Error('Photo 3 must map to slot 3');
  const afterDelete = m.photoForViewerSlot(threeSlots[1], {
    customerPhotos: [{ url: '/media/p1.jpg' }, null, { url: '/media/p3.jpg' }],
    index: 0,
  });
  if (afterDelete) throw new Error('deleted Photo 2 must not fall back to Photo 1 or Photo 3');
  const stillThree = m.photoForViewerSlot(threeSlots[2], {
    customerPhotos: [{ url: '/media/p1.jpg' }, null, { url: '/media/p3.jpg' }],
    index: 0,
  });
  if (stillThree?.url !== '/media/p3.jpg') throw new Error('Photo 3 must stay Photo 3 after deleting Photo 2');
}

console.log('preview3d phase2b helpers ok', {
  slots: slots.length,
  filled: textures.filter((t) => !t.isPlaceholder).length,
  namedSurfaces: named.surfaces.length,
  arranged: arranged.length,
  reorderWarnings: reordered.warnings.length,
});
rmSync(tmp, { recursive: true, force: true });

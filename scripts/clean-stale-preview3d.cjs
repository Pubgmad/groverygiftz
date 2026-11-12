'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const stalePaths = [
  'src/app/account/manage/photo-frame-3d',
  'src/app/account/manage/preview-3d',
  'src/app/api/admin/photo-frame-3d',
  'src/app/api/admin/preview-3d-assets',
  'src/app/api/admin/preview-3d-profiles',
  'src/app/dev',
  'src/components/admin/ProductPreview3dEditor.js',
  'src/components/admin/preview3d',
  'src/components/product/preview3d',
  'src/hooks/usePhotoFrame3dAdminPreview.js',
  'src/lib/photoFrame3d.js',
  'src/lib/photoFrame3dAdminPreview.js',
  'src/lib/preview3d.js',
  'src/lib/preview3dAr.js',
  'src/lib/preview3dAssetWorkflow.js',
  'src/lib/preview3dCropTexture.js',
  'src/lib/preview3dGlb.js',
  'src/lib/productCardFields.js',
  'src/models/PhotoFrameDesignProfile.js',
  'src/models/PhotoFrameHardwareProfile.js',
  'src/models/PhotoFrameSizeRule.js',
  'src/models/Preview3dAsset.js',
  'src/models/Preview3dProfile.js',
];

const remove = (target) => {
  if (!fs.existsSync(target)) return false;
  fs.rmSync(target, { recursive: true, force: true });
  return true;
};

const walkNamed = (dir, names, found = []) => {
  if (!fs.existsSync(dir)) return found;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return found; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (names.has(entry.name)) found.push(full);
      else walkNamed(full, names, found);
    }
  }
  return found;
};

let removed = 0;
for (const relative of stalePaths) {
  if (remove(path.join(root, relative))) {
    removed += 1;
    console.log(`[clean-stale-preview3d] removed ${relative}`);
  }
}
for (const extra of walkNamed(path.join(root, 'src'), new Set(['preview3d', 'photo-frame-3d', 'preview-3d']))) {
  if (remove(extra)) {
    removed += 1;
    console.log(`[clean-stale-preview3d] removed leftover ${path.relative(root, extra)}`);
  }
}
console.log(`[clean-stale-preview3d] done (${removed} leftover path${removed === 1 ? '' : 's'})`);

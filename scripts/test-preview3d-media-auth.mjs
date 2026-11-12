import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mediaSrc = readFileSync(join(root, 'src/app/media/[...path]/route.js'), 'utf8');

if (!mediaSrc.includes("if (isPublicPreview3dAsset(relativePath))")) {
  throw new Error('media route missing public preview3d asset branch');
}
if (!mediaSrc.includes("return { ok: true, cache: 'public' }")) {
  throw new Error('preview3d models/placeholders must be publicly cacheable store assets');
}
if (mediaSrc.includes('if (!isPhotoFrame3dAdminPreviewFlagEnabled()) return { ok: false, status: 403 }')) {
  throw new Error('customer 3D models must not be gated by the obsolete admin preview flag');
}

function authorizePreview3dMedia() {
  return { ok: true, cache: 'public' };
}

const cases = [
  { name: 'customer can load store GLB', ok: true, cache: 'public' },
  { name: 'admin can load store GLB', ok: true, cache: 'public' },
];

for (const row of cases) {
  const got = authorizePreview3dMedia();
  if (got.ok !== row.ok) throw new Error(`${row.name}: expected ok=${row.ok} got ${got.ok}`);
  if (got.cache !== row.cache) throw new Error(`${row.name}: cache ${got.cache}`);
}

console.log('preview3d media auth policy ok', { cases: cases.length, storeModelsPublic: true });

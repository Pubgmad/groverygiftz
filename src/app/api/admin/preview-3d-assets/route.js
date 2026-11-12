export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { access } from 'fs/promises';
import path from 'path';
import dbConnect from '@/lib/db';
import Preview3dAsset from '@/models/Preview3dAsset';
import Preview3dProfile from '@/models/Preview3dProfile';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import {
  listUploadFiles,
  pathFromPublicUrl,
  saveUploadFile,
  storagePath,
  uploadStorageRoot,
} from '@/lib/uploadStorage';
import {
  normalizePreview3dAppearance,
  normalizeRetailReadiness,
  normalizeSurface,
} from '@/lib/preview3d';

const MAX_GLB_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

async function fileExistsForUrl(url) {
  const relativePath = pathFromPublicUrl(url);
  if (!relativePath) return false;
  const abs = storagePath(relativePath);
  if (!abs) return false;
  try {
    await access(abs);
    return true;
  } catch {
    return false;
  }
}

function displayNameFromPath(relativePath = '', originalFilename = '') {
  const base = originalFilename || path.posix.basename(String(relativePath || '')) || '3D model';
  return String(base)
    .replace(/^\d{10,}-[a-z0-9]+-/i, '')
    .replace(/\.glb$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .slice(0, 120) || '3D model';
}

/**
 * Admin-only upload + reusable GLB registry listing.
 * Never exposes customer customization uploads.
 */
export async function GET() {
  const { error } = await requireAdminPermission('products', 'read');
  if (error) return error;

  await dbConnect();

  const primaryDisk = await listUploadFiles('preview3d/models', { extensions: ['.glb'] }).catch(() => []);
  // Also discover isolated staging upload trees without duplicating binary storage.
  let stagingDisk = [];
  try {
    const altRoot = path.join(process.cwd(), '.data', 'phase2b-uploads');
    if (path.resolve(altRoot) !== path.resolve(uploadStorageRoot)) {
      const { readdir, stat } = await import('fs/promises');
      const modelsDir = path.join(altRoot, 'preview3d', 'models');
      const entries = await readdir(modelsDir).catch(() => []);
      stagingDisk = await Promise.all(entries.filter((name) => /\.glb$/i.test(name)).map(async (name) => {
        const abs = path.join(modelsDir, name);
        const fileStat = await stat(abs).catch(() => null);
        const relativePath = `preview3d/models/${name}`;
        return {
          filename: name,
          relativePath,
          url: `/media/${relativePath}`,
          size: fileStat?.size || 0,
          mtimeMs: fileStat?.mtimeMs || 0,
        };
      }));
    }
  } catch {
    stagingDisk = [];
  }
  const diskFiles = [...primaryDisk, ...stagingDisk];
  const [registry, profiles] = await Promise.all([
    Preview3dAsset.find({ kind: 'model' }).sort({ updatedAt: -1 }).lean(),
    Preview3dProfile.find({ modelUrl: { $nin: [null, ''] } })
      .select('name modelUrl surfaces retailReadiness geometryType')
      .lean(),
  ]);

  const byUrl = new Map();

  for (const file of diskFiles) {
    byUrl.set(file.url, {
      url: file.url,
      relativePath: file.relativePath,
      originalFilename: file.filename,
      name: displayNameFromPath(file.relativePath, file.filename),
      size: file.size,
      mtimeMs: file.mtimeMs,
      kind: 'model',
      retailReadiness: 'prototype',
      isAccessible: true,
      source: 'disk',
      surfaceHints: [],
      geometryHint: 'custom_glb',
      notes: '',
      _id: null,
    });
  }

  for (const profile of profiles) {
    const url = String(profile.modelUrl || '').trim();
    if (!url) continue;
    const existing = byUrl.get(url) || {
      url,
      relativePath: pathFromPublicUrl(url) || '',
      originalFilename: '',
      name: displayNameFromPath(pathFromPublicUrl(url) || '', ''),
      size: 0,
      mtimeMs: 0,
      kind: 'model',
      retailReadiness: 'prototype',
      isAccessible: false,
      source: 'profile',
      surfaceHints: [],
      geometryHint: profile.geometryType || 'custom_glb',
      notes: '',
      _id: null,
    };
    existing.surfaceHints = Array.isArray(profile.surfaces)
      ? profile.surfaces.map((row, index) => normalizeSurface(row, index))
      : existing.surfaceHints;
    if (profile.retailReadiness) {
      existing.retailReadiness = normalizeRetailReadiness(profile.retailReadiness);
    }
    existing.profileNames = [...(existing.profileNames || []), profile.name].filter(Boolean);
    byUrl.set(url, existing);
  }

  for (const asset of registry) {
    const url = String(asset.url || '').trim();
    if (!url) continue;
    const existing = byUrl.get(url) || {
      url,
      relativePath: asset.relativePath || pathFromPublicUrl(url) || '',
      originalFilename: asset.originalFilename || '',
      name: asset.name,
      size: 0,
      mtimeMs: 0,
      kind: 'model',
      retailReadiness: 'prototype',
      isAccessible: false,
      source: 'registry',
      surfaceHints: [],
      geometryHint: 'custom_glb',
      notes: '',
      _id: null,
    };
    existing._id = String(asset._id);
    existing.name = asset.name || existing.name;
    existing.retailReadiness = normalizeRetailReadiness(asset.retailReadiness);
    existing.notes = asset.notes || '';
    existing.geometryHint = asset.geometryHint || existing.geometryHint;
    existing.surfaceHints = Array.isArray(asset.surfaceHints) && asset.surfaceHints.length
      ? asset.surfaceHints.map((row, index) => normalizeSurface(row, index))
      : existing.surfaceHints;
    existing.source = 'registry';
    byUrl.set(url, existing);
  }

  const assets = [];
  for (const row of byUrl.values()) {
    const accessible = await fileExistsForUrl(row.url);
    row.isAccessible = accessible;
    // Inaccessible URLs cannot be selected as valid retail assets.
    if (!accessible && row.retailReadiness === 'approved_retail') {
      row.retailReadiness = 'awaiting_approval';
      row.accessWarning = 'File missing from storage — approval suspended until restored.';
    }
    assets.push(row);
  }

  assets.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  return NextResponse.json({
    assets,
    storageRootHint: uploadStorageRoot,
    retailStatuses: ['prototype', 'awaiting_approval', 'approved_retail'],
  });
}

export async function POST(req) {
  const { error, access } = await requireAdminPermission('products', 'write');
  if (error) return error;

  try {
    const form = await req.formData();
    const file = form.get('file');
    const kind = String(form.get('kind') || 'model').toLowerCase();
    const displayName = String(form.get('name') || '').trim().slice(0, 120);
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const name = String(file.name || '').toLowerCase();
    const type = String(file.type || '').toLowerCase();

    if (kind === 'model') {
      const isGlb = name.endsWith('.glb') || type.includes('model/gltf-binary') || type === 'application/octet-stream';
      if (!isGlb) {
        return NextResponse.json({ error: 'Only .glb models are supported in Phase 1' }, { status: 400 });
      }
      if (file.size > MAX_GLB_BYTES) {
        return NextResponse.json({ error: 'GLB must be under 25 MB' }, { status: 400 });
      }
      const stored = await saveUploadFile(file, 'preview3d/models');
      await dbConnect();
      const asset = await Preview3dAsset.findOneAndUpdate(
        { url: stored.url },
        {
          $set: {
            name: displayName || displayNameFromPath(stored.relativePath, file.name),
            url: stored.url,
            relativePath: stored.relativePath,
            originalFilename: String(file.name || ''),
            kind: 'model',
            // Upload success never auto-approves for retail.
            retailReadiness: 'prototype',
            isAccessible: true,
            geometryHint: 'custom_glb',
            updatedBy: access.adminId,
          },
          $setOnInsert: {
            createdBy: access.adminId,
            surfaceHints: [],
            notes: '',
          },
        },
        { upsert: true, new: true },
      );

      await logAdminAudit({
        access,
        req,
        action: 'preview3d.asset_upload',
        targetType: 'Preview3dAsset',
        targetId: String(asset._id),
        details: { url: stored.url, retailReadiness: 'prototype' },
      });

      return NextResponse.json({
        url: stored.url,
        kind: 'model',
        relativePath: stored.relativePath,
        asset,
      }, { status: 201 });
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Placeholder image must be under 12 MB' }, { status: 400 });
    }
    if (!type.startsWith('image/')) {
      return NextResponse.json({ error: 'Placeholder must be an image' }, { status: 400 });
    }
    const stored = await saveUploadFile(file, 'preview3d/placeholders');
    return NextResponse.json({ url: stored.url, kind: 'placeholder', relativePath: stored.relativePath }, { status: 201 });
  } catch (err) {
    console.error('preview-3d asset upload failed', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

/** Update registry metadata / retail readiness for an existing GLB URL or asset id. */
export async function PATCH(req) {
  const { error, access } = await requireAdminPermission('products', 'write');
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  await dbConnect();

  const url = String(body.url || '').trim();
  const id = String(body.assetId || body.id || '').trim();
  let asset = null;
  if (id && /^[a-fA-F0-9]{24}$/.test(id)) {
    asset = await Preview3dAsset.findById(id);
  } else if (url) {
    asset = await Preview3dAsset.findOne({ url });
  }
  if (!asset && url) {
    const relativePath = pathFromPublicUrl(url) || '';
    const accessible = await fileExistsForUrl(url);
    if (!accessible) {
      return NextResponse.json({ error: 'Asset file is missing from storage' }, { status: 404 });
    }
    asset = await Preview3dAsset.create({
      name: String(body.name || displayNameFromPath(relativePath, '')).slice(0, 120),
      url,
      relativePath,
      kind: 'model',
      retailReadiness: 'prototype',
      isAccessible: true,
      geometryHint: 'custom_glb',
      createdBy: access.adminId,
      updatedBy: access.adminId,
    });
  }
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

  if (body.name !== undefined) asset.name = String(body.name || '').trim().slice(0, 120) || asset.name;
  if (body.notes !== undefined) asset.notes = String(body.notes || '').trim().slice(0, 400);
  if (body.retailReadiness !== undefined) {
    const next = normalizeRetailReadiness(body.retailReadiness);
    if (next === 'approved_retail') {
      const accessible = await fileExistsForUrl(asset.url);
      if (!accessible) {
        return NextResponse.json({ error: 'Cannot approve a missing GLB file' }, { status: 400 });
      }
    }
    asset.retailReadiness = next;
  }
  if (Array.isArray(body.surfaceHints)) {
    asset.surfaceHints = body.surfaceHints.map((row, index) => {
      const surface = normalizeSurface(row, index);
      return {
        ...surface,
        preview3dAppearance: normalizePreview3dAppearance(surface.preview3dAppearance),
      };
    }).filter((row) => row.id || row.meshName);
  }
  if (body.geometryHint !== undefined) {
    asset.geometryHint = String(body.geometryHint || 'custom_glb');
  }
  asset.isAccessible = await fileExistsForUrl(asset.url);
  asset.updatedBy = access.adminId;
  await asset.save();

  await logAdminAudit({
    access,
    req,
    action: 'preview3d.asset_update',
    targetType: 'Preview3dAsset',
    targetId: String(asset._id),
    details: { url: asset.url, retailReadiness: asset.retailReadiness },
  });

  return NextResponse.json({ asset });
}

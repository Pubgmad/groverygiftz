export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Preview3dProfile from '@/models/Preview3dProfile';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import {
  PREVIEW3D_GEOMETRY_TYPES,
  buildSurfacesForGeometry,
  normalizePreview3dConfig,
  normalizeSurface,
} from '@/lib/preview3d';

function slugify(name = '') {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export async function GET() {
  const { error } = await requireAdminPermission('products', 'read');
  if (error) return error;
  await dbConnect();
  const profiles = await Preview3dProfile.find({}).sort({ updatedAt: -1 }).lean();
  return NextResponse.json({
    profiles,
    geometryTypes: PREVIEW3D_GEOMETRY_TYPES,
  });
}

export async function POST(req) {
  const { error, access } = await requireAdminPermission('products', 'write');
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: 'Profile name is required' }, { status: 400 });
  const slug = slugify(body.slug || name);
  if (!slug) return NextResponse.json({ error: 'Invalid profile name' }, { status: 400 });

  await dbConnect();
  const exists = await Preview3dProfile.findOne({ slug }).lean();
  if (exists) return NextResponse.json({ error: 'A profile with this name already exists' }, { status: 409 });

  const normalized = normalizePreview3dConfig(body);
  const surfaces = Array.isArray(body.surfaces) && body.surfaces.length
    ? body.surfaces.map((s, index) => normalizeSurface(s, index)).filter((s) => s.id)
    : buildSurfacesForGeometry(normalized.geometryType, Number(body.slotHint) || 1);

  const profile = await Preview3dProfile.create({
    name,
    slug,
    description: String(body.description || '').trim().slice(0, 400),
    isActive: body.isActive !== false,
    geometryType: normalized.geometryType,
    modelUrl: normalized.modelUrl,
    placeholderUrl: normalized.placeholderUrl,
    assetId: normalized.assetId || null,
    retailReadiness: normalized.retailReadiness || 'prototype',
    environment: normalized.environment,
    frameColor: normalized.frameColor,
    accentColor: normalized.accentColor,
    camera: normalized.camera,
    dimensions: normalized.dimensions,
    layout: normalized.layout,
    surfaces,
    createdBy: access.adminId,
    updatedBy: access.adminId,
  });

  await logAdminAudit({
    access,
    req,
    action: 'preview3d.profile_create',
    targetType: 'Preview3dProfile',
    targetId: String(profile._id),
    details: { name, geometryType: profile.geometryType },
  });

  return NextResponse.json({ profile }, { status: 201 });
}

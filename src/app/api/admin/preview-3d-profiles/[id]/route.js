export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Preview3dProfile from '@/models/Preview3dProfile';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import { buildSurfacesForGeometry, normalizePreview3dConfig, normalizeSurface } from '@/lib/preview3d';

const validId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value || ''));

export async function PUT(req, { params }) {
  const { error, access } = await requireAdminPermission('products', 'write');
  if (error) return error;
  const { id } = await params;
  if (!validId(id)) return NextResponse.json({ error: 'Invalid profile' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  await dbConnect();
  const profile = await Preview3dProfile.findById(id);
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  if (body.name !== undefined) profile.name = String(body.name || '').trim().slice(0, 80) || profile.name;
  if (body.description !== undefined) profile.description = String(body.description || '').trim().slice(0, 400);
  if (body.isActive !== undefined) profile.isActive = body.isActive !== false;

  const normalized = normalizePreview3dConfig({ ...profile.toObject(), ...body });
  profile.geometryType = normalized.geometryType;
  profile.modelUrl = normalized.modelUrl;
  profile.placeholderUrl = normalized.placeholderUrl;
  profile.assetId = normalized.assetId || null;
  profile.retailReadiness = normalized.retailReadiness || 'prototype';
  profile.environment = normalized.environment;
  profile.frameColor = normalized.frameColor;
  profile.accentColor = normalized.accentColor;
  profile.camera = normalized.camera;
  profile.dimensions = normalized.dimensions;
  profile.layout = normalized.layout;

  if (Array.isArray(body.surfaces)) {
    profile.surfaces = body.surfaces.map((s, index) => normalizeSurface(s, index)).filter((s) => s.id);
  } else if (!profile.surfaces?.length) {
    profile.surfaces = buildSurfacesForGeometry(profile.geometryType, Number(body.slotHint) || 1);
  }

  profile.updatedBy = access.adminId;
  await profile.save();

  await logAdminAudit({
    access,
    req,
    action: 'preview3d.profile_update',
    targetType: 'Preview3dProfile',
    targetId: String(profile._id),
    details: { name: profile.name, geometryType: profile.geometryType },
  });

  return NextResponse.json({ profile });
}

export async function DELETE(req, { params }) {
  const { error, access } = await requireAdminPermission('products', 'write');
  if (error) return error;
  const { id } = await params;
  if (!validId(id)) return NextResponse.json({ error: 'Invalid profile' }, { status: 400 });
  await dbConnect();
  const profile = await Preview3dProfile.findByIdAndDelete(id);
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  await logAdminAudit({
    access,
    req,
    action: 'preview3d.profile_delete',
    targetType: 'Preview3dProfile',
    targetId: id,
    details: { name: profile.name },
  });
  return NextResponse.json({ success: true });
}

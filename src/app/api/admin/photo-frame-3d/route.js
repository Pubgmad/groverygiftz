export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import PhotoFrameSizeRule from '@/models/PhotoFrameSizeRule';
import PhotoFrameHardwareProfile from '@/models/PhotoFrameHardwareProfile';
import PhotoFrameDesignProfile from '@/models/PhotoFrameDesignProfile';
import { requireAdminPermission, logAdminAudit } from '@/lib/adminAccess';
import {
  DEFAULT_PHOTO_FRAME_DESIGN_PROFILES,
  DEFAULT_PHOTO_FRAME_HARDWARE_PROFILES,
  DEFAULT_PHOTO_FRAME_SIZE_RULES,
  assertNineteenSizeRules,
  buildDesignCoverageMatrix,
  buildSizeHardwareMatrix,
  normalizeCustomerReadiness,
} from '@/lib/photoFrame3d';

export async function GET() {
  const { error } = await requireAdminPermission('products', 'read');
  if (error) return error;
  await dbConnect();
  const [sizeRules, hardwareProfiles, designProfiles] = await Promise.all([
    PhotoFrameSizeRule.find({}).sort({ sortOrder: 1, key: 1 }).lean(),
    PhotoFrameHardwareProfile.find({}).sort({ key: 1 }).lean(),
    PhotoFrameDesignProfile.find({}).sort({ key: 1 }).lean(),
  ]);
  const effectiveSizes = sizeRules.length ? sizeRules : DEFAULT_PHOTO_FRAME_SIZE_RULES;
  const effectiveHw = hardwareProfiles.length ? hardwareProfiles : DEFAULT_PHOTO_FRAME_HARDWARE_PROFILES;
  const effectiveDesigns = designProfiles.length ? designProfiles : DEFAULT_PHOTO_FRAME_DESIGN_PROFILES;
  return NextResponse.json({
    sizeRules: effectiveSizes,
    hardwareProfiles: effectiveHw,
    designProfiles: effectiveDesigns,
    fromDatabase: {
      sizeRules: sizeRules.length,
      hardwareProfiles: hardwareProfiles.length,
      designProfiles: designProfiles.length,
    },
    matrix: buildSizeHardwareMatrix(effectiveSizes, effectiveHw),
    coverage: buildDesignCoverageMatrix({
      sizeRules: effectiveSizes,
      hardwareProfiles: effectiveHw,
      designProfiles: effectiveDesigns,
    }),
    nineteenCheck: assertNineteenSizeRules(effectiveSizes),
    defaultsAvailable: true,
  });
}

/** Upsert owner default catalog (editable afterward). */
export async function POST(req) {
  const { error, access } = await requireAdminPermission('products', 'write');
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || 'seed_defaults');
  await dbConnect();

  if (action === 'seed_defaults') {
    let sort = 0;
    for (const rule of DEFAULT_PHOTO_FRAME_SIZE_RULES) {
      sort += 1;
      await PhotoFrameSizeRule.updateOne(
        { key: rule.key },
        {
          $set: {
            ...rule,
            openingWidth: rule.openingWidth ?? rule.nominalWidth,
            openingHeight: rule.openingHeight ?? rule.nominalHeight,
            unit: 'inch',
            isActive: true,
            sortOrder: sort,
          },
        },
        { upsert: true },
      );
    }
    for (const hw of DEFAULT_PHOTO_FRAME_HARDWARE_PROFILES) {
      await PhotoFrameHardwareProfile.updateOne(
        { key: hw.key },
        { $set: { ...hw, isActive: true } },
        { upsert: true },
      );
    }
    for (const design of DEFAULT_PHOTO_FRAME_DESIGN_PROFILES) {
      await PhotoFrameDesignProfile.updateOne(
        { key: design.key },
        { $set: { ...design, isActive: true } },
        { upsert: true },
      );
    }
    await logAdminAudit({
      access,
      req,
      action: 'photoFrame3d.seed_defaults',
      targetType: 'PhotoFrameCatalog',
      targetId: 'defaults',
      details: { sizes: 19, hardware: 4, designs: 3 },
    });
    return NextResponse.json({ ok: true, seeded: true });
  }

  if (action === 'upsert_size_rule') {
    const rule = body.rule || {};
    const key = String(rule.key || '').trim().toLowerCase();
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
    await PhotoFrameSizeRule.updateOne(
      { key },
      {
        $set: {
          key,
          label: String(rule.label || key),
          nominalWidth: Number(rule.nominalWidth),
          nominalHeight: Number(rule.nominalHeight),
          openingWidth: rule.openingWidth == null ? null : Number(rule.openingWidth),
          openingHeight: rule.openingHeight == null ? null : Number(rule.openingHeight),
          borderWidth: Number(rule.borderWidth),
          borderGroup: rule.borderGroup || 'custom',
          hardwareProfileKey: String(rule.hardwareProfileKey || ''),
          orientation: rule.orientation || 'auto',
          unit: rule.unit || 'inch',
          isActive: rule.isActive !== false,
          sortOrder: Number(rule.sortOrder) || 0,
          notes: String(rule.notes || '').slice(0, 400),
        },
      },
      { upsert: true },
    );
    return NextResponse.json({ ok: true, key });
  }

  if (action === 'upsert_hardware_profile') {
    const profile = body.profile || {};
    const key = String(profile.key || '').trim();
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
    await PhotoFrameHardwareProfile.updateOne(
      { key },
      {
        $set: {
          key,
          name: String(profile.name || key),
          description: String(profile.description || '').slice(0, 500),
          sizeRuleKeys: Array.isArray(profile.sizeRuleKeys) ? profile.sizeRuleKeys.map(String) : [],
          referenceImage: String(profile.referenceImage || ''),
          components: profile.components || {},
          isActive: profile.isActive !== false,
          notes: String(profile.notes || '').slice(0, 400),
        },
      },
      { upsert: true },
    );
    return NextResponse.json({ ok: true, key });
  }

  if (action === 'upsert_design_profile') {
    const profile = body.profile || {};
    const key = String(profile.key || '').trim();
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
    const mode = profile.mode === 'custom_glb' ? 'custom_glb' : 'procedural';
    await PhotoFrameDesignProfile.updateOne(
      { key },
      {
        $set: {
          key,
          name: String(profile.name || key),
          description: String(profile.description || '').slice(0, 500),
          mode,
          frameColor: String(profile.frameColor || '#1a1a1a'),
          accentColor: String(profile.accentColor || '#2a2a2a'),
          material: profile.material || { roughness: 0.75, metalness: 0.05 },
          modelUrl: String(profile.modelUrl || ''),
          assetId: profile.assetId || null,
          compatibleSizeKeys: Array.isArray(profile.compatibleSizeKeys)
            ? profile.compatibleSizeKeys.map(String).map((k) => k.trim().toLowerCase()).filter(Boolean)
            : String(profile.compatibleSizeKeysText || '')
              .split(/[,\s]+/)
              .map((k) => k.trim().toLowerCase())
              .filter(Boolean),
          lockedSizeKey: String(profile.lockedSizeKey || '').trim().toLowerCase(),
          mouldingProfileKey: String(profile.mouldingProfileKey || ''),
          customerReadiness: normalizeCustomerReadiness(profile.customerReadiness),
          ownerReferenceUrls: Array.isArray(profile.ownerReferenceUrls)
            ? profile.ownerReferenceUrls.map(String).filter(Boolean).slice(0, 8)
            : [],
          fidelity: String(profile.fidelity || 'approximate'),
          isActive: profile.isActive !== false,
          notes: String(profile.notes || '').slice(0, 400),
        },
      },
      { upsert: true },
    );
    await logAdminAudit({
      access,
      req,
      action: 'photoFrame3d.upsert_design_profile',
      targetType: 'PhotoFrameDesignProfile',
      targetId: key,
      details: { mode, modelUrl: String(profile.modelUrl || '').slice(0, 200) },
    });
    return NextResponse.json({ ok: true, key });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

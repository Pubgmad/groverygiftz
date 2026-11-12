/**
 * Admin-facing checklist for production-quality Universal 3D assets.
 * Documentation lives here (and in the Phase 2B report) — not product-specific hardcoding.
 */

export const PREVIEW3D_ASSET_REQUIREMENTS = Object.freeze([
  {
    id: 'format',
    title: 'GLB format',
    detail: 'Deliver a single .glb (binary glTF 2.0). Prefer Draco/meshopt compression for large meshes.',
  },
  {
    id: 'scale',
    title: 'Real-world scale',
    detail: 'Model units ≈ meters. Match configured product dimensions (e.g. 8×10 in frame ≈ 0.203×0.254 m photo opening).',
  },
  {
    id: 'uvs',
    title: 'UV islands',
    detail: 'Every customizable surface must have non-overlapping UVs covering the printable region only (no frame moulding UVs on the photo plane).',
  },
  {
    id: 'names',
    title: 'Named meshes',
    detail: 'Stable mesh names such as PhotoPlane, WrapSurface, FaceFront, FaceBack. Admin maps by mesh name — avoid anonymous Mesh_0 renames.',
  },
  {
    id: 'materials',
    title: 'Materials',
    detail: 'Use PBR materials. Photo receivers should accept baseColor textures; metal/roughness should suit wood, acrylic, or metal finishes.',
  },
  {
    id: 'optimize',
    title: 'Optimization',
    detail: 'Target < 3 MB per model when possible. Remove unused nodes, merge static meshes, bake high-poly details into normals when needed.',
  },
  {
    id: 'camera',
    title: 'Camera defaults',
    detail: 'Origin at product center. Front faces +Z (or document otherwise). Admin sets min/max orbit distance per profile.',
  },
  {
    id: 'license',
    title: 'Ownership / license',
    detail: 'Only owned or appropriately licensed assets. Never scrape competitor store models.',
  },
]);

export const PREVIEW3D_PILOT_ASSET_SPECS = Object.freeze({
  wall_frame: {
    family: 'single_plane / custom_glb',
    purpose: 'Single personalized wall photo frame',
    requiredSurfaces: ['PhotoPlane (front opening)'],
    optionalSurfaces: ['MatPlane', 'GlassPlane'],
    notes: 'Show thickness on side view. Photo plane must not include decorative frame pixels.',
  },
  cylinder_wrap: {
    family: 'cylinder / custom_glb',
    purpose: 'Bottle, mug, or tumbler wrap',
    requiredSurfaces: ['WrapSurface (cylindrical UV)'],
    optionalSurfaces: ['Cap', 'LabelBand'],
    notes: 'Seamless wrap UVs (U 0–1 around circumference). Avoid polar pinch at poles.',
  },
  pendant_locket: {
    family: 'pendant / custom_glb',
    purpose: 'Keychain, locket, or compact keepsake',
    requiredSurfaces: ['FaceFront'],
    optionalSurfaces: ['FaceBack'],
    notes: 'Correct thickness; check mirroring on back face. Bail/ring should be non-customizable metal.',
  },
  multi_frame_wall: {
    family: 'multi_grid + layout',
    purpose: 'Combo wall arrangements',
    requiredSurfaces: ['face_1 … face_N (or named Frame_* meshes)'],
    optionalSurfaces: [],
    notes: 'Physical arrangement configured in Admin layout (wall_grid / wall_row / manual). Never invent misleading spacing.',
  },
});

export function getPreview3dAssetWorkflowSummary() {
  return {
    requirements: PREVIEW3D_ASSET_REQUIREMENTS,
    pilots: PREVIEW3D_PILOT_ASSET_SPECS,
    adminSteps: [
      'Prepare GLB externally (Blender / approved vendor).',
      'Upload via Admin → 3D Profiles or product 3D section.',
      'Inspect named meshes; mark photo surfaces only.',
      'Map existing customization slots → surfaces.',
      'Preview with sample textures; validate UVs.',
      'Assign reusable profile to compatible products.',
      'Enable per product only after visual QA.',
    ],
  };
}

/**
 * GLB mesh inspection helpers for admin-driven surface mapping.
 * Browser-only utilities (Three.js scene graph). No code execution from assets.
 */

/** Stable hierarchical path for a Object3D node. */
export function buildMeshPath(object) {
  const parts = [];
  let current = object;
  while (current) {
    const name = String(current.name || '').trim() || current.type || 'node';
    parts.unshift(name);
    current = current.parent;
    if (parts.length > 24) break;
  }
  return parts.join('/');
}

export function buildMeshSurfaceId(object, index = 0) {
  const name = String(object?.name || '').trim();
  if (name) return `mesh:${name}`;
  const path = buildMeshPath(object);
  if (path) return `path:${path}`;
  return `mesh_index:${index}`;
}

export function meshHasUvs(mesh) {
  const uv = mesh?.geometry?.attributes?.uv;
  return !!(uv && uv.count > 0);
}

/**
 * Inspect a loaded Three.js scene for mappable meshes.
 * @returns {Array<{id,label,kind,meshName,meshPath,materialName,hasUvs,uvWarning,vertexCount}>}
 */
export function inspectSceneMeshes(scene) {
  const surfaces = [];
  let index = 0;
  if (!scene || typeof scene.traverse !== 'function') return surfaces;
  scene.traverse((obj) => {
    if (!obj?.isMesh) return;
    const hasUvs = meshHasUvs(obj);
    const meshName = String(obj.name || '').trim();
    const meshPath = buildMeshPath(obj);
    const materialName = String(obj.material?.name || '').trim();
    const id = buildMeshSurfaceId(obj, index);
    surfaces.push({
      id,
      label: meshName || materialName || `Mesh ${index + 1}`,
      kind: 'plane',
      meshName,
      meshPath,
      materialName,
      hasUvs,
      uvWarning: hasUvs
        ? ''
        : 'This mesh has no UV coordinates — customer photos may not map correctly.',
      vertexCount: Number(obj.geometry?.attributes?.position?.count) || 0,
    });
    index += 1;
  });
  return surfaces;
}

/**
 * Find a mesh in a scene for a configured surface definition.
 * Prefers meshName, then meshPath, then materialName, then surface id.
 */
export function findMeshForSurface(scene, surface) {
  if (!scene || !surface) return null;
  const wantedName = String(surface.meshName || '').trim();
  const wantedPath = String(surface.meshPath || '').trim();
  const wantedMaterial = String(surface.materialName || '').trim();
  const wantedId = String(surface.id || '').trim();
  let found = null;
  let index = 0;
  scene.traverse((obj) => {
    if (found || !obj?.isMesh) return;
    const meshName = String(obj.name || '').trim();
    const meshPath = buildMeshPath(obj);
    const materialName = String(obj.material?.name || '').trim();
    const id = buildMeshSurfaceId(obj, index);
    if (wantedName && meshName === wantedName) found = obj;
    else if (wantedPath && meshPath === wantedPath) found = obj;
    else if (wantedMaterial && materialName === wantedMaterial) found = obj;
    else if (wantedId && (id === wantedId || `mesh:${meshName}` === wantedId)) found = obj;
    index += 1;
  });
  return found;
}

/**
 * Detect incompatible saved surfaces vs a freshly inspected mesh list.
 */
export function diffSavedSurfaces(savedSurfaces = [], inspected = []) {
  const inspectedIds = new Set(inspected.map((s) => s.id));
  const inspectedNames = new Set(inspected.map((s) => s.meshName).filter(Boolean));
  const missing = [];
  const warnings = [];
  (savedSurfaces || []).forEach((surface) => {
    const id = String(surface.id || '');
    const name = String(surface.meshName || '');
    const stillThere = inspectedIds.has(id)
      || (name && inspectedNames.has(name))
      || inspected.some((m) => m.meshPath && m.meshPath === surface.meshPath);
    if (!stillThere) {
      missing.push(surface);
      warnings.push(`Saved surface "${surface.label || surface.id}" is missing from the current GLB.`);
    }
  });
  return { missing, warnings, compatible: missing.length === 0 };
}

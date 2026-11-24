import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Materials that look the same are merged too, unless they're animated (RGB strips).
function materialKey(m) {
  return [m.type, m.color?.getHex(), m.emissive?.getHex(), m.emissiveIntensity, m.metalness, m.roughness,
    m.map?.uuid, m.emissiveMap?.uuid, m.opacity, m.transparent, m.side, m.toneMapped, m.blending,
    m.depthWrite, m.depthTest, m.envMapIntensity, m.flatShading].join('|');
}

const q = (v) => Math.round((v ?? 0) * 20) / 20;
// Plain untextured standard materials differ mostly by colour: bake the colour into the
// vertices so all of them with the same finish become one mesh.
const tintable = (m) => m.type === 'MeshStandardMaterial' && !m.map && !m.vertexColors && !m.transparent
  && !m.emissiveMap && !m.normalMap && !m.roughnessMap && !m.metalnessMap;
const tintKey = (m) => ['tint', q(m.metalness), q(m.roughness), m.emissive?.getHex(), m.emissiveIntensity, m.side,
  m.envMapIntensity, m.flatShading].join('|');

const mergeable = (o) => o.isMesh && !o.isInstancedMesh && !o.userData.interact && !o.userData.grab && !o.userData.proxy && !o.isSkinnedMesh && !Array.isArray(o.material)
  && o.children.length === 0 && !o.geometry.morphAttributes?.position
  && o.geometry.attributes.position?.array instanceof Float32Array
  && Object.values(o.geometry.attributes).every((a) => !a.isInterleavedBufferAttribute && a.array instanceof Float32Array)
  && o.matrixWorld.determinant() > 0;

/**
 * Merge a static group's meshes into one mesh per material (in the group's own space),
 * so a part made of 60 little boxes costs a handful of draw calls instead of 60.
 * The group keeps its transform and userData, so picking and grabbing still work.
 * Instanced meshes and anything unusual are left as they are.
 */
export function bakeStatic(root, live = []) {
  const liveSet = new Set(live);
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const buckets = new Map();
  const done = [];
  const m4 = new THREE.Matrix4();
  root.traverse((o) => {
    if (o === root || !o.visible || !mergeable(o)) return;
    const geo = o.geometry;
    const m = o.material;
    const tint = !liveSet.has(m) && tintable(m);
    const matKey = liveSet.has(m) ? m.uuid : tint ? tintKey(m) : materialKey(m);
    // meshes that ignore rays (glass you point through, glows) stay apart from solid ones
    const key = `${o.hasOwnProperty('raycast') ? 'noray' : 'ray'}#${matKey}#${Object.keys(geo.attributes).filter((n) => ['position', 'normal', 'uv'].includes(n)).sort().join(',')}#${geo.index ? 'i' : 'n'}`;
    let b = buckets.get(key);
    if (!b) {
      let material = m;
      if (tint) {
        material = m.clone();
        material.color.set(0xffffff);
        material.vertexColors = true;
      }
      buckets.set(key, (b = { material, geos: [], cast: false, receive: false, noRay: true }));
    }
    const g = geo.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (tint) {
      const n = g.attributes.position.count;
      const colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { colors[i * 3] = m.color.r; colors[i * 3 + 1] = m.color.g; colors[i * 3 + 2] = m.color.b; }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    g.applyMatrix4(m4.multiplyMatrices(toRoot, o.matrixWorld));
    g.clearGroups();
    b.geos.push(g);
    b.cast ||= o.castShadow;
    b.receive ||= o.receiveShadow;
    b.noRay &&= o.hasOwnProperty('raycast');
    done.push(o);
  });
  for (const o of done) o.parent.remove(o);
  for (const b of buckets.values()) {
    const keys = (g) => Object.keys(g.attributes).sort().join(',');
    const k0 = keys(b.geos[0]);
    const geos = b.geos.filter((g) => keys(g) === k0);
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    if (b.noRay) mesh.raycast = () => {};
    root.add(mesh);
  }
  // drop groups left empty
  const empty = [];
  root.traverse((o) => { if (o !== root && o.isGroup && o.children.length === 0) empty.push(o); });
  for (const o of empty) o.parent?.remove(o);
  return root;
}

const proxyMaterial = new THREE.MeshBasicMaterial({ visible: false });

/**
 * Bake a whole display (shelves plus the parts on them) into a few meshes. The parts
 * on show never move (grabbing one hands you a fresh copy), so their meshes can be
 * merged with everything else; each part keeps an invisible box for pointing and
 * grabbing, with its userData.
 */
export function bakeDisplay(root, items, live = []) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4();
  const m4 = new THREE.Matrix4();
  for (const item of items) {
    inv.copy(item.matrixWorld).invert();
    const box = new THREE.Box3();
    item.traverse((n) => {
      if (!n.isMesh) return;
      if (!n.geometry.boundingBox) n.geometry.computeBoundingBox();
      box.union(n.geometry.boundingBox.clone().applyMatrix4(m4.multiplyMatrices(inv, n.matrixWorld)));
    });
    for (const c of [...item.children]) root.attach(c);
    // a centimetre of padding: always hit before the part itself, and easier to aim at
    const size = box.getSize(new THREE.Vector3()).addScalar(0.02);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), proxyMaterial);
    box.getCenter(proxy.position);
    proxy.userData.proxy = true;
    item.add(proxy);
  }
  return bakeStatic(root, live);
}

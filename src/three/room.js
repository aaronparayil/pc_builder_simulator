import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { plankFloorTexture, pegboardTexture, woodTexture, deskMatTexture, posterTexture, slatWallTexture, washTexture, neonTexture } from './textures.js';
import { bakeStatic } from './bake.js';

export const DESK_TOP = 0.75;

/** The walkable showroom (metres). The workbench sits at the origin against the back wall. */
export const ROOM = { minX: -5.5, maxX: 5.5, minZ: -0.95, maxZ: 8.5, H: 3.2 };

function panelTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#262a35');
  g.addColorStop(1, '#1b1e26');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = '#0a0b0e';
  ctx.fillRect(0, 0, 3, 512);
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.fillRect(3, 0, 2, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function mesh(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

const metal = new THREE.MeshStandardMaterial({ color: 0x23262d, metalness: 0.7, roughness: 0.4 });

export function buildRoom(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const { minX, maxX, minZ, maxZ, H } = ROOM;
  const W = maxX - minX, D = maxZ - minZ, cz = (minZ + maxZ) / 2;

  // Floor, walls and ceiling
  const planks = plankFloorTexture();
  planks.repeat.set((W + 0.2) / 1.6, (D + 0.2) / 1.6);
  const floor = mesh(new THREE.PlaneGeometry(W + 0.2, D + 0.2),
    new THREE.MeshStandardMaterial({ map: planks, roughness: 0.5, metalness: 0.05 }), { cast: false });
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = cz;
  root.add(floor);

  const slats = slatWallTexture();
  slats.repeat.set(W / 0.72, 1);
  const backWall = mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: slats, roughness: 0.75 }), { cast: false });
  backWall.position.set(0, H / 2, minZ);
  root.add(backWall);
  // pegboard panel behind the workbench, in a slim frame
  const peg = pegboardTexture();
  peg.repeat.set(2.7 * 1.35, 1.45 * 1.35);
  const pegPanel = mesh(new THREE.PlaneGeometry(2.7, 1.45), new THREE.MeshStandardMaterial({ map: peg, roughness: 0.85 }), { cast: false });
  pegPanel.position.set(0, 1.58, minZ + 0.012);
  root.add(pegPanel);
  for (const [w, h, x, y] of [[2.76, 0.03, 0, 1.58 + 0.74], [2.76, 0.03, 0, 1.58 - 0.74], [0.03, 1.5, -1.38, 1.58], [0.03, 1.5, 1.38, 1.58]]) {
    const bar = mesh(new THREE.BoxGeometry(w, h, 0.02), metal, { cast: false });
    bar.position.set(x, y, minZ + 0.012);
    root.add(bar);
  }
  const panels = panelTexture();
  panels.repeat.set(D / 1.2, 1);
  const sideMat = new THREE.MeshStandardMaterial({ map: panels, roughness: 0.9 });
  const leftWall = mesh(new THREE.PlaneGeometry(D, H), sideMat, { cast: false });
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(minX, H / 2, cz);
  const rightWall = leftWall.clone();
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.x = maxX;
  const frontPanels = panels.clone();
  frontPanels.repeat.set(W / 1.2, 1);
  const frontWall = mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: frontPanels, roughness: 0.9 }), { cast: false });
  frontWall.rotation.y = Math.PI;
  frontWall.position.set(0, H / 2, maxZ);
  const ceiling = mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0x121419, roughness: 1 }), { cast: false });
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, H, cz);
  root.add(leftWall, rightWall, frontWall, ceiling);

  // Decor that never moves is built into one group and merged into a few meshes
  const decor = new THREE.Group();
  root.add(decor);
  const add = (geo, mat, x, y, z, { cast = false, ry = 0, rx = 0, rz = 0, noRay = false } = {}) => {
    const m = mesh(geo, mat, { cast });
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    if (noRay) m.raycast = () => {};
    decor.add(m);
    return m;
  };

  // Ceiling: a recessed panel ringed by a soft LED line
  const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe9eeff).multiplyScalar(1.15), toneMapped: false });
  const inset = 1.1, rx0 = minX + inset, rx1 = maxX - inset, rz0 = minZ + inset + 0.6, rz1 = maxZ - inset;
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0c0d11, roughness: 1 });
  add(new THREE.BoxGeometry(rx1 - rx0, 0.06, rz1 - rz0), ceilMat, (rx0 + rx1) / 2, H - 0.03, (rz0 + rz1) / 2, { noRay: true });
  for (const [w, d, x, z] of [[rx1 - rx0, 0.025, (rx0 + rx1) / 2, rz0], [rx1 - rx0, 0.025, (rx0 + rx1) / 2, rz1], [0.025, rz1 - rz0, rx0, (rz0 + rz1) / 2], [0.025, rz1 - rz0, rx1, (rz0 + rz1) / 2]]) {
    add(new THREE.BoxGeometry(w, 0.012, d), stripMat, x, H - 0.062, z, { noRay: true });
  }

  // Warm light washing down from a cove along the top of every wall
  const washMat = new THREE.MeshBasicMaterial({ map: washTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const coveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe2c4).multiplyScalar(1.3), toneMapped: false });
  for (const [len, x, z, ry] of [[W, 0, minZ + 0.02, 0], [W, 0, maxZ - 0.02, Math.PI], [D, minX + 0.02, cz, Math.PI / 2], [D, maxX - 0.02, cz, -Math.PI / 2]]) {
    add(new THREE.PlaneGeometry(len, 1.1), washMat, x, H - 0.55, z, { ry, noRay: true });
    const dx = Math.sin(ry) * 0.04, dz = Math.cos(ry) * 0.04;
    add(new THREE.BoxGeometry(len, 0.012, 0.012), coveMat, x + dx, H - 0.05, z + dz, { ry, noRay: true });
  }
  const skirtMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5eead4).multiplyScalar(1.3), toneMapped: false });
  for (const [x, z, len, rot] of [[minX + 0.01, cz, D, Math.PI / 2], [maxX - 0.01, cz, D, Math.PI / 2], [0, maxZ - 0.01, W, 0]]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(len, 0.012, 0.012), skirtMat);
    skirt.rotation.y = rot;
    skirt.position.set(x, 0.06, z);
    root.add(skirt);
  }

  // Neon tube along the back wall
  const neonColor = new THREE.Color(0x5eead4);
  const neon = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 2.6, 4, 12),
    new THREE.MeshBasicMaterial({ color: neonColor.clone().multiplyScalar(2.2), toneMapped: false }));
  neon.rotation.z = Math.PI / 2;
  neon.position.set(0, 2.05, minZ + 0.02);
  root.add(neon);

  // Neon logo on the back wall, right of the workbench
  const logoMat = new THREE.MeshBasicMaterial({ map: neonTexture('RIG//BUILDER'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  add(new THREE.PlaneGeometry(2.3, 0.43), logoMat, 3.3, 2.6, minZ + 0.03, { noRay: true });
  // redraw once the display font has loaded
  document.fonts?.ready.then(() => {
    logoMat.map.dispose();
    logoMat.map = neonTexture('RIG//BUILDER');
    logoMat.needsUpdate = true;
  });

  // Pendant lamps over the workbench
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide });
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a8).multiplyScalar(1.6), toneMapped: false });
  const cordMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0c });
  for (const x of [-0.8, 0.8]) {
    const y = 2.2;
    add(new THREE.CylinderGeometry(0.004, 0.004, H - y - 0.1, 6), cordMat, x, (H + y) / 2 + 0.05, 0.05, { noRay: true });
    add(new THREE.CylinderGeometry(0.035, 0.13, 0.17, 24, 1, true), shadeMat, x, y, 0.05, { noRay: true });
    add(new THREE.CircleGeometry(0.11, 24), bulbMat, x, y - 0.07, 0.05, { rx: Math.PI / 2, noRay: true });
  }

  // A halo ring hanging over the middle of the showroom
  const haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9ff5e8).multiplyScalar(1.5), toneMapped: false });
  add(new THREE.TorusGeometry(1.15, 0.022, 8, 96), haloMat, 0, 2.72, 5.3, { rx: Math.PI / 2, noRay: true });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(new THREE.CylinderGeometry(0.003, 0.003, H - 2.72, 4), cordMat, Math.cos(a) * 1.15, (H + 2.72) / 2, 5.3 + Math.sin(a) * 1.15, { noRay: true });
  }

  // Lounge corner, back right: sofa, coffee table, floor lamp
  const fabric = new THREE.MeshStandardMaterial({ color: 0x2b3140, roughness: 0.95 });
  const fabricDark = new THREE.MeshStandardMaterial({ color: 0x232835, roughness: 0.95 });
  const oak = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.5 });
  const SX = 3.35, SZ = minZ + 0.5;
  add(new RoundedBoxGeometry(2.1, 0.24, 0.86, 3, 0.04), fabricDark, SX, 0.2, SZ, { cast: true });
  add(new RoundedBoxGeometry(2.1, 0.5, 0.2, 3, 0.06), fabric, SX, 0.55, SZ - 0.33, { cast: true });
  for (const dx of [-0.5, 0.5]) add(new RoundedBoxGeometry(0.98, 0.14, 0.64, 3, 0.05), fabric, SX + dx, 0.38, SZ + 0.08, { cast: true });
  for (const dx of [-1.0, 1.0]) add(new RoundedBoxGeometry(0.16, 0.46, 0.86, 3, 0.05), fabric, SX + dx, 0.31, SZ, { cast: true });
  for (const [dx, dz] of [[-0.95, -0.35], [0.95, -0.35], [-0.95, 0.35], [0.95, 0.35]]) add(new THREE.CylinderGeometry(0.018, 0.014, 0.08, 8), metal, SX + dx, 0.04, SZ + dz);
  // throw cushions in the accent colours
  add(new RoundedBoxGeometry(0.36, 0.34, 0.12, 3, 0.05), new THREE.MeshStandardMaterial({ color: 0x1f6f66, roughness: 0.9 }), SX - 0.7, 0.6, SZ - 0.18, { rx: -0.25, ry: 0.2 });
  add(new RoundedBoxGeometry(0.34, 0.32, 0.12, 3, 0.05), new THREE.MeshStandardMaterial({ color: 0x7a2547, roughness: 0.9 }), SX + 0.72, 0.6, SZ - 0.18, { rx: -0.25, ry: -0.25 });
  const TX = SX, TZ = SZ + 0.95;
  add(new THREE.CylinderGeometry(0.42, 0.42, 0.035, 40), oak, TX, 0.42, TZ, { cast: true });
  add(new THREE.CylinderGeometry(0.05, 0.08, 0.4, 16), metal, TX, 0.2, TZ);
  add(new THREE.CylinderGeometry(0.2, 0.22, 0.02, 24), metal, TX, 0.01, TZ);
  // floor lamp with a glowing shade
  const LX = SX + 1.45, LZ = minZ + 0.35;
  add(new THREE.CylinderGeometry(0.14, 0.15, 0.02, 24), metal, LX, 0.01, LZ);
  add(new THREE.CylinderGeometry(0.012, 0.012, 1.5, 8), metal, LX, 0.76, LZ);
  add(new THREE.CylinderGeometry(0.15, 0.2, 0.28, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffcf99).multiplyScalar(1.1), toneMapped: false, side: THREE.DoubleSide }), LX, 1.55, LZ);
  // a big plant beside the sofa
  const plant = buildPlant(SX - 1.45, 0, minZ + 0.35);
  plant.scale.setScalar(3.2);
  decor.add(plant);
  bakeStatic(decor);

  // Art posters on the back wall
  [[-1.05, 1.7, 0], [0.95, 1.75, 1], [1.75, 1.55, 2], [-4.65, 1.65, 1], [5.0, 1.7, 0]].forEach(([x, y, i]) => {
    const p = mesh(new THREE.PlaneGeometry(0.48, 0.64), new THREE.MeshStandardMaterial({ map: posterTexture(i), roughness: 0.6 }), { cast: false });
    p.position.set(x, y, minZ + 0.01);
    root.add(p);
  });

  // Desk
  const desk = new THREE.Group();
  desk.userData.interact = { kind: 'bench', label: 'Build at the workbench' };
  const top = mesh(new THREE.BoxGeometry(1.8, 0.04, 0.85), new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.55 }));
  top.position.y = DESK_TOP - 0.02;
  desk.add(top);
  const legGeo = new THREE.BoxGeometry(0.05, DESK_TOP - 0.04, 0.7);
  [-0.82, 0.82].forEach((x) => {
    const leg = mesh(legGeo, metal);
    leg.position.set(x, (DESK_TOP - 0.04) / 2, 0);
    desk.add(leg);
  });
  const mat = mesh(new THREE.PlaneGeometry(0.9, 0.42), new THREE.MeshStandardMaterial({ map: deskMatTexture(), roughness: 0.9 }), { cast: false });
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(0.32, DESK_TOP + 0.001, 0.12);
  desk.add(mat);
  // Under-desk glow strip
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.006, 0.006),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3d7f).multiplyScalar(2), toneMapped: false }));
  strip.position.set(0, DESK_TOP - 0.045, 0.4);
  desk.add(strip);
  root.add(desk);

  // Monitor
  const monitor = buildMonitor();
  monitor.group.position.set(0.5, DESK_TOP, -0.2);
  monitor.group.rotation.y = -0.32;
  root.add(monitor.group);

  // Keyboard + mouse
  const kb = mesh(new THREE.BoxGeometry(0.36, 0.018, 0.12), new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.6 }));
  kb.position.set(0.38, DESK_TOP + 0.01, 0.16);
  kb.rotation.y = -0.12;
  root.add(kb);
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.18, toneMapped: false }));
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(0, 0.0095, 0);
  kb.add(keys);
  const mouse = mesh(new THREE.CapsuleGeometry(0.025, 0.04, 4, 12), new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.5 }));
  mouse.rotation.x = Math.PI / 2;
  mouse.scale.set(1, 1, 0.5);
  mouse.position.set(0.66, DESK_TOP + 0.012, 0.18);
  root.add(mouse);

  // Mug and plant
  const mug = mesh(new THREE.CylinderGeometry(0.035, 0.032, 0.09, 24), new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.35 }));
  mug.position.set(-0.68, DESK_TOP + 0.045, 0.22);
  root.add(mug);
  root.add(buildPlant(0.78, DESK_TOP, -0.28));

  // Lighting
  scene.add(new THREE.HemisphereLight(0x9fb3d9, 0x120c0c, 0.6));
  const key = new THREE.SpotLight(0xfff1e0, 32, 6, 0.55, 0.65, 1.6);
  key.position.set(0.5, 2.5, 1.4);
  key.target.position.set(-0.2, DESK_TOP + 0.2, -0.05);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.5);
  fill.position.set(-2, 2, 2);
  scene.add(fill);
  const rimA = new THREE.PointLight(0x5eead4, 2.5, 3.5, 2);
  rimA.position.set(-0.9, 1.5, -0.6);
  const rimB = new THREE.PointLight(0xff3d7f, 2.2, 3.5, 2);
  rimB.position.set(1.2, 1.3, -0.5);
  scene.add(rimA, rimB);
  // Showroom lighting: soft pools under the ceiling strips (no shadows, cheap)
  for (const [x, z] of [[-3, 2.4], [3, 2.4], [-3, 6.2], [3, 6.2], [0, 4.6]]) {
    const l = new THREE.PointLight(0xdde7ff, 12, 8, 2);
    l.position.set(x, ROOM.H - 0.3, z);
    scene.add(l);
  }

  monitor.group.userData.interact = desk.userData.interact;

  // Things the walker bumps into, as world-space XZ boxes
  const colliders = [
    { minX: -0.95, maxX: 0.95, minZ: -0.95, maxZ: 0.46 }, // desk
    { minX: SX - 1.1, maxX: SX + 1.1, minZ: minZ, maxZ: SZ + 0.45 }, // sofa
    { minX: TX - 0.45, maxX: TX + 0.45, minZ: TZ - 0.45, maxZ: TZ + 0.45 }, // coffee table
  ];
  // Boxes that thrown parts land on
  const solids = [
    new THREE.Box3(new THREE.Vector3(SX - 1.08, 0, minZ), new THREE.Vector3(SX + 1.08, 0.45, SZ + 0.43)),
    new THREE.Box3(new THREE.Vector3(SX - 1.08, 0, minZ), new THREE.Vector3(SX + 1.08, 0.8, SZ - 0.23)),
    new THREE.Box3(new THREE.Vector3(TX - 0.42, 0, TZ - 0.42), new THREE.Vector3(TX + 0.42, 0.44, TZ + 0.42)),
  ];

  return { monitor, lights: { key, fill, rimA, rimB }, colliders, solids };
}

function buildPlant(x, y, z) {
  const g = new THREE.Group();
  const pot = mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.11, 24), new THREE.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 0.8 }));
  pot.position.y = 0.055;
  g.add(pot);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7d4f, roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const leaf = mesh(new THREE.SphereGeometry(0.05, 12, 8), leafMat);
    leaf.scale.set(0.35, 1.6, 0.12);
    const a = (i / 9) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.03, 0.17 + (i % 3) * 0.015, Math.sin(a) * 0.03);
    leaf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
    g.add(leaf);
  }
  g.position.set(x, y, z);
  return g;
}

function buildMonitor() {
  const group = new THREE.Group();
  const standMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, metalness: 0.6, roughness: 0.35 });
  const base = mesh(new THREE.BoxGeometry(0.22, 0.012, 0.16), standMat);
  base.position.y = 0.006;
  const neck = mesh(new THREE.BoxGeometry(0.04, 0.2, 0.025), standMat);
  neck.position.set(0, 0.11, -0.04);
  const bezel = mesh(new THREE.BoxGeometry(0.62, 0.37, 0.025), standMat);
  bezel.position.set(0, 0.36, -0.02);
  group.add(base, neck, bezel);

  const W = 1024, H = 576;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.595, 0.335), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(0, 0.36, -0.0065);
  group.add(screen);

  const glow = new THREE.PointLight(0x5eead4, 0.0, 1.2, 2);
  glow.position.set(0, 0.36, 0.2);
  group.add(glow);

  function draw(fn) {
    ctx.save();
    fn(ctx, W, H);
    ctx.restore();
    tex.needsUpdate = true;
  }
  return { group, draw, glow, screen };
}

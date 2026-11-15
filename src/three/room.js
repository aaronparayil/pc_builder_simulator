import * as THREE from 'three';
import { floorTexture, pegboardTexture, woodTexture, deskMatTexture, posterTexture, boxTexture } from './textures.js';

export const DESK_TOP = 0.75;

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

  // Floor and walls
  const floor = mesh(new THREE.PlaneGeometry(14, 14),
    new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.55, metalness: 0.1 }), { cast: false });
  floor.rotation.x = -Math.PI / 2;
  root.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ map: pegboardTexture(), roughness: 0.85 });
  const backWall = mesh(new THREE.PlaneGeometry(6, 3.2), wallMat, { cast: false });
  backWall.position.set(0, 1.6, -0.95);
  root.add(backWall);
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.9 });
  const leftWall = mesh(new THREE.PlaneGeometry(6, 3.2), sideMat, { cast: false });
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-2.4, 1.6, 2);
  root.add(leftWall);
  const rightWall = leftWall.clone();
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(2.4, 1.6, 2);
  root.add(rightWall);

  // Neon tube along the back wall
  const neonColor = new THREE.Color(0x5eead4);
  const neon = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 2.6, 4, 12),
    new THREE.MeshBasicMaterial({ color: neonColor.clone().multiplyScalar(2.2), toneMapped: false }));
  neon.rotation.z = Math.PI / 2;
  neon.position.set(0, 2.05, -0.93);
  root.add(neon);

  // Posters
  [[-1.05, 1.7, 0], [0.95, 1.75, 1], [1.75, 1.55, 2]].forEach(([x, y, i]) => {
    const p = mesh(new THREE.PlaneGeometry(0.48, 0.64), new THREE.MeshStandardMaterial({ map: posterTexture(i), roughness: 0.6 }), { cast: false });
    p.position.set(x, y, -0.94);
    root.add(p);
  });

  // Desk
  const desk = new THREE.Group();
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

  // Parts shelf (decorative boxes)
  root.add(buildShelf(-1.5, -0.62));

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

  return { monitor, lights: { key, fill, rimA, rimB } };
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

function buildShelf(x, z) {
  const g = new THREE.Group();
  const w = 0.9, d = 0.4;
  [-w / 2, w / 2].forEach((ox) => [-d / 2, d / 2].forEach((oz) => {
    const post = mesh(new THREE.BoxGeometry(0.025, 1.6, 0.025), metal);
    post.position.set(ox, 0.8, oz);
    g.add(post);
  }));
  const boards = [0.25, 0.75, 1.25];
  boards.forEach((y) => {
    const b = mesh(new THREE.BoxGeometry(w + 0.02, 0.02, d), metal);
    b.position.y = y;
    g.add(b);
  });
  const boxes = [
    ['GPU', '#5eead4', 0.38, 0.12, 0.26, 0.25],
    ['PSU', '#ffd166', 0.2, 0.12, 0.22, 0.25],
    ['CPU', '#ff3d7f', 0.12, 0.12, 0.12, 0.75],
    ['RAM', '#a78bfa', 0.2, 0.06, 0.12, 0.75],
    ['SSD', '#60a5fa', 0.14, 0.05, 0.1, 0.75],
    ['FANS', '#5eead4', 0.3, 0.14, 0.3, 1.25],
  ];
  let cursor = { 0.25: -w / 2 + 0.05, 0.75: -w / 2 + 0.05, 1.25: -w / 2 + 0.05 };
  for (const [label, color, bw, bh, bd, y] of boxes) {
    const side = new THREE.MeshStandardMaterial({ map: boxTexture(label, color), roughness: 0.9 });
    const plain = new THREE.MeshStandardMaterial({ color: 0x9c774f, roughness: 0.9 });
    const box = mesh(new THREE.BoxGeometry(bw, bh, bd), [plain, plain, plain, plain, side, plain]);
    box.position.set(cursor[y] + bw / 2, y + 0.01 + bh / 2, 0.02);
    box.rotation.y = (Math.random() - 0.5) * 0.1;
    cursor[y] += bw + 0.04;
    g.add(box);
  }
  g.position.set(x, 0, z);
  g.rotation.y = 0.35;
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

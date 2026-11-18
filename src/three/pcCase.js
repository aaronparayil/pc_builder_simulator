import * as THREE from 'three';

// Case coordinate frame (metres, origin at bottom centre):
//   +X = front of the case, +Y = up, +Z = glass side (towards the viewer).
export const CASE = { D: 0.46, H: 0.48, W: 0.23 };
const Z0 = -CASE.W / 2 + 0.03; // front face of the motherboard tray
const SHROUD_TOP = 0.105;

/** The motherboard's front face (it sits on standoffs in front of the tray). */
export const BOARD_Z = Z0 + 0.008;
const BOARD_CENTER = new THREE.Vector2(-0.093, 0.2825);
// Mirrors LAYOUT in models/board.js (board-local → case coordinates)
const onBoard = (x, y, z) => new THREE.Vector3(BOARD_CENTER.x + x, BOARD_CENTER.y + y, BOARD_Z + z);

/**
 * Where each part's origin goes. `size`/`center` describe the "goes here" indicator.
 * Procedural parts are built with their mounting point at the origin.
 */
export const SLOTS = {
  motherboard: { pos: onBoard(0, 0, 0), center: onBoard(0, 0, 0.012), size: new THREE.Vector3(0.244, 0.305, 0.03) },
  cpu: { pos: onBoard(0.001, 0.0435, 0.004), center: onBoard(0.001, 0.0435, 0.0065), size: new THREE.Vector3(0.042, 0.047, 0.005) },
  cooler: { pos: onBoard(0.001, 0.0435, 0.0086), size: null },
  ram: { pos: onBoard(0.0615, 0.04, 0.0045), center: onBoard(0.0615, 0.04, 0.022), size: new THREE.Vector3(0.022, 0.136, 0.036) },
  storage: { pos: onBoard(-0.029, -0.1045, 0.003), size: new THREE.Vector3(0.08, 0.022, 0.004) },
  storageBay: { pos: new THREE.Vector3(0.075, SHROUD_TOP, 0.02), size: null },
  // GPU origin = I/O bracket, top of the PCB, PCIe edge
  gpu: { pos: new THREE.Vector3(-0.222, BOARD_CENTER.y - 0.0215 + 0.0005, BOARD_Z + 0.007), center: new THREE.Vector3(-0.087, 0.236, BOARD_Z + 0.067), size: new THREE.Vector3(0.27, 0.05, 0.12) },
  psu: { pos: new THREE.Vector3(-0.142, 0.049, 0.0), size: new THREE.Vector3(0.15, 0.086, 0.14) },
};

const panelMat = new THREE.MeshStandardMaterial({ color: 0x101217, metalness: 0.55, roughness: 0.45 });
const innerMat = new THREE.MeshStandardMaterial({ color: 0x15181e, metalness: 0.1, roughness: 0.85, envMapIntensity: 0.4 });

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createFan(size = 0.12, ringMaterial) {
  const group = new THREE.Group();
  const r = size / 2;
  const frame = new THREE.Mesh(new THREE.TorusGeometry(r - 0.006, 0.006, 8, 40), new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.6 }));
  group.add(frame);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r - 0.012, 0.0022, 6, 48), ringMaterial);
  ring.position.z = 0.004;
  group.add(ring);
  const rotor = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.32, 0.02, 24), new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.5 }));
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1b1e25, roughness: 0.4, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 7; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(r * 0.62, r * 0.32, 0.002), bladeMat);
    blade.position.x = r * 0.58;
    const pivot = new THREE.Group();
    pivot.rotation.z = (i / 7) * Math.PI * 2;
    blade.rotation.x = 0.45;
    pivot.add(blade);
    rotor.add(pivot);
  }
  group.add(rotor);
  group.userData.rotor = rotor;
  return group;
}

export function buildCase() {
  const { D, H, W } = CASE;
  const group = new THREE.Group();
  const t = 0.008;

  // Shell
  group.add(box(D, H, t, panelMat, 0, H / 2, -W / 2 + t / 2)); // back side panel
  group.add(box(D, t, W, panelMat, 0, H - t / 2, 0)); // top
  group.add(box(D, t, W, panelMat, 0, t / 2, 0)); // bottom
  group.add(box(t, H, W, panelMat, D / 2 - t / 2, H / 2, 0)); // front
  group.add(box(t, H, W, panelMat, -D / 2 + t / 2, H / 2, 0)); // rear
  // Front panel accent
  const accent = new THREE.Mesh(new THREE.BoxGeometry(0.002, H * 0.8, 0.004),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5eead4).multiplyScalar(1.6), toneMapped: false }));
  accent.position.set(D / 2 + 0.001, H / 2, W / 2 - 0.02);
  group.add(accent);
  // Motherboard tray standoffs
  // Standoffs line up with the board's screw holes and reach its back face
  const backOfBoard = BOARD_Z - 0.0016, tray = -W / 2 + t;
  for (const [x, y] of [[-0.107, -0.1325], [-0.107, 0.1375], [0.108, -0.1325], [0.108, 0.1375], [0.003, -0.0825]]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, backOfBoard - tray, 8), new THREE.MeshStandardMaterial({ color: 0xb59a5a, metalness: 0.9, roughness: 0.3 }));
    s.rotation.x = Math.PI / 2;
    s.position.set(BOARD_CENTER.x + x, BOARD_CENTER.y + y, (tray + backOfBoard) / 2);
    group.add(s);
  }
  // Rear expansion slot covers
  for (let i = 0; i < 7; i++) group.add(box(0.002, 0.012, 0.11, innerMat, -D / 2 + t + 0.002, 0.13 + i * 0.02, -0.02));
  // PSU shroud: top plate and front-half side panel (the PSU end stays visible)
  group.add(box(D - 2 * t - 0.04, 0.004, W - 2 * t, innerMat, -0.02, SHROUD_TOP - 0.002, 0));
  group.add(box(0.24, SHROUD_TOP, 0.004, innerMat, 0.05, SHROUD_TOP / 2, W / 2 - 0.012));
  // Feet
  for (const [x, z] of [[-0.19, -0.08], [0.19, -0.08], [-0.19, 0.08], [0.19, 0.08]]) {
    group.add(box(0.05, 0.016, 0.03, panelMat, x, -0.008, z));
  }

  // Fans with RGB rings
  const fans = [];
  const ringMats = [];
  function addFan(x, y, z, rotY, size = 0.12) {
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x202228, toneMapped: false });
    ringMats.push(ringMat);
    const fan = createFan(size, ringMat);
    fan.position.set(x, y, z);
    fan.rotation.y = rotY;
    group.add(fan);
    fans.push(fan);
    return fan;
  }
  for (const y of [0.13, 0.255, 0.38]) addFan(D / 2 - t - 0.014, y, 0.01, Math.PI / 2);
  addFan(-D / 2 + t + 0.014, 0.405, 0.01, -Math.PI / 2);

  // Glass side panel (slides off while building)
  const glass = new THREE.Group();
  const pane = new THREE.Mesh(new THREE.BoxGeometry(D - 0.01, H - 0.01, 0.004), new THREE.MeshPhysicalMaterial({
    color: 0x9fb8cc, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.5,
  }));
  pane.userData.noPick = true;
  glass.add(pane);
  glass.position.set(0, H / 2, W / 2 + 0.002);
  group.add(glass);

  // Interior light (comes alive on boot)
  const interior = new THREE.PointLight(0x5eead4, 0, 0.6, 2);
  interior.position.set(0, H * 0.6, 0.05);
  group.add(interior);

  // Slot target indicator
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.12, depthWrite: false });
  const ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), ghostMat);
  const ghostEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.9 }));
  ghost.add(ghostEdges);
  ghost.visible = false;
  ghost.userData.noPick = true;
  group.add(ghost);

  let powered = false;
  let fanSpeed = 0;
  let glassOpen = 0; // 0 = closed, 1 = removed

  function setGlassOpen(v) {
    glassOpen = v;
    glass.position.z = W / 2 + 0.002 + v * 0.6;
    glass.position.y = H / 2 + v * 0.05;
    pane.material.opacity = 0.16 * (1 - v);
    glass.visible = v < 0.999;
  }
  setGlassOpen(1);

  function showGhost(slot) {
    if (!slot) { ghost.visible = false; return; }
    ghost.visible = true;
    ghost.position.copy(slot.center);
    ghost.scale.copy(slot.size).addScalar(0.006);
  }

  function update(dt, time) {
    const target = powered ? 1 : 0;
    fanSpeed += (target - fanSpeed) * Math.min(1, dt * 1.5);
    for (const f of fans) f.userData.rotor.rotation.z += fanSpeed * dt * 28;
    ringMats.forEach((m, i) => {
      if (fanSpeed > 0.02) m.color.setHSL((time * 0.12 + i * 0.12) % 1, 0.9, 0.55).multiplyScalar(0.6 + fanSpeed * 1.6);
      else m.color.setRGB(0.12, 0.13, 0.15);
    });
    interior.color.setHSL((time * 0.12) % 1, 0.8, 0.6);
    interior.intensity = fanSpeed * 0.35;
    if (ghost.visible) {
      const k = 0.5 + 0.5 * Math.sin(time * 4);
      ghostMat.opacity = 0.06 + 0.1 * k;
      ghostEdges.material.opacity = 0.4 + 0.5 * k;
    }
  }

  return {
    group,
    fans,
    update,
    showGhost,
    setPowered(v) { powered = v; },
    get glassOpen() { return glassOpen; },
    setGlassOpen,
    center: new THREE.Vector3(0, H / 2, 0),
  };
}

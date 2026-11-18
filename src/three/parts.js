import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { SLOTS, createFan } from './pcCase.js';
import { buildBoard } from './models/board.js';
import { buildCpu } from './models/cpu.js';
import { buildGpu } from './models/gpu.js';
import { box as addBox, gold, rgbMaterial } from './models/common.js';
import { RAM_LOOKS } from '../data/looks.js';

const BASE = import.meta.env.BASE_URL;

// Scanned/modelled parts: how to rotate each model into case space.
// Only the M.2 SSD is a scanned model; every other part is built in code (see models/).
const MODELS = {
  storage: { url: 'models/storage.glb', rotation: [0, 0, 0] },
};

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

export const templates = new Map();

function normalize(object, rotation, fit) {
  const holder = new THREE.Group();
  object.rotation.set(...rotation);
  holder.add(object);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const scale = Math.min(fit.x / size.x, fit.y / size.y, fit.z / size.z);
  object.scale.multiplyScalar(scale);
  holder.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(holder).getCenter(new THREE.Vector3());
  object.position.sub(center);
  return holder;
}

function prepare(object) {
  object.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
  return object;
}

/** Start downloading every model; resolves with progress callbacks. */
export function preloadModels(onProgress) {
  const entries = Object.entries(MODELS);
  let done = 0;
  return Promise.all(entries.map(([category, cfg]) => new Promise((resolve) => {
    loader.load(BASE + cfg.url, (gltf) => {
      templates.set(category, normalize(prepare(gltf.scene), cfg.rotation, SLOTS[category].size));
      onProgress?.(++done / entries.length);
      resolve();
    }, undefined, (err) => {
      console.warn(`Could not load ${cfg.url}, using a placeholder`, err);
      onProgress?.(++done / entries.length);
      resolve();
    });
  })));
}

function placeholder(category) {
  const size = SLOTS[category]?.size || new THREE.Vector3(0.05, 0.05, 0.05);
  return prepare(new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshStandardMaterial({ color: 0x334155 })));
}

// --- procedural parts -----------------------------------------------------------
const alu = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.9, roughness: 0.32 });
const copper = new THREE.MeshStandardMaterial({ color: 0xc8794a, metalness: 0.95, roughness: 0.3 });
const black = new THREE.MeshStandardMaterial({ color: 0x15171c, metalness: 0.4, roughness: 0.5 });

function ringMat() {
  return new THREE.MeshBasicMaterial({ color: 0x202228, toneMapped: false });
}

function finStack(w, h, depth, spacing = 0.003) {
  const count = Math.floor(depth / spacing);
  const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(w, h, 0.0007), alu, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.makeTranslation(0, 0, -depth / 2 + i * spacing);
    fins.setMatrixAt(i, m);
  }
  fins.castShadow = true;
  return fins;
}

function buildCooler(style) {
  const g = new THREE.Group();
  const fans = [];
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.008), copper);
  base.position.z = 0.004;
  g.add(base);
  if (style === 'stock') {
    const sink = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 32), alu);
    sink.rotation.x = Math.PI / 2;
    sink.position.z = 0.023;
    g.add(sink);
    const fan = createFan(0.085, ringMat());
    fan.position.z = 0.045;
    g.add(fan);
    fans.push(fan);
  } else if (style === 'lowpro') {
    const fins = finStack(0.09, 0.09, 0.03, 0.0025);
    fins.position.z = 0.025;
    g.add(fins);
    const fan = createFan(0.092, ringMat());
    fan.position.z = 0.05;
    g.add(fan);
    fans.push(fan);
  } else if (style === 'tower' || style === 'dual') {
    const towers = style === 'dual' ? [-0.035, 0.035] : [0];
    for (let i = 0; i < 4; i++) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.14, 8), copper);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(0, -0.015 + i * 0.01, 0.075);
      g.add(pipe);
    }
    for (const x of towers) {
      const fins = finStack(0.045, 0.125, 0.12);
      fins.position.set(x, 0, 0.088);
      g.add(fins);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.047, 0.127, 0.004), black);
      cap.position.set(x, 0, 0.15);
      g.add(cap);
    }
    const fanX = style === 'dual' ? 0 : 0.036;
    const fan = createFan(style === 'dual' ? 0.12 : 0.12, ringMat());
    fan.rotation.y = Math.PI / 2;
    fan.position.set(fanX, 0, 0.088);
    g.add(fan);
    fans.push(fan);
  } else if (style === 'aio') {
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 32), black);
    pump.rotation.x = Math.PI / 2;
    pump.position.z = 0.023;
    g.add(pump);
    const logo = new THREE.Mesh(new THREE.CircleGeometry(0.022, 32), ringMat());
    logo.position.z = 0.0385;
    g.add(logo);
    g.userData.logo = logo.material;
    // Radiator under the top panel, in case coordinates relative to the CPU
    const rad = new THREE.Group();
    const radPos = new THREE.Vector3(0.03, 0.452, 0.02).sub(SLOTS.cooler.pos);
    rad.position.copy(radPos);
    rad.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.026, 0.122), black));
    for (const x of [-0.065, 0.065]) {
      const fan = createFan(0.12, ringMat());
      fan.rotation.x = Math.PI / 2;
      fan.position.set(x, -0.026, 0);
      rad.add(fan);
      fans.push(fan);
    }
    g.add(rad);
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.6 });
    for (const off of [-0.012, 0.012]) {
      const start = new THREE.Vector3(off, 0.03, 0.025);
      const end = radPos.clone().add(new THREE.Vector3(-0.15, -0.005, off));
      const mid = new THREE.Vector3(off - 0.02, radPos.y * 0.6, 0.08);
      const curve = new THREE.CatmullRomCurve3([start, mid, end]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0055, 8, false), tubeMat);
      tube.castShadow = true;
      g.add(tube);
    }
  }
  g.userData.fans = fans;
  return prepare(g);
}

function labelTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = fg;
  let size = 30;
  do { ctx.font = `700 ${size}px "Space Grotesk", sans-serif`; size -= 1; } while (ctx.measureText(text).width > 216 && size > 12);
  ctx.fillText(text, 20, 74);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildBayDrive(form) {
  const g = new THREE.Group();
  if (form === 'hdd') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.147, 0.026, 0.102), alu);
    body.position.y = 0.013;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.07), new THREE.MeshStandardMaterial({ map: labelTexture('2TB HDD', '#e5e7eb', '#111'), roughness: 0.7 }));
    label.rotation.x = -Math.PI / 2;
    label.position.set(-0.01, 0.0262, 0);
    g.add(body, label);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.007, 0.07), black);
    body.position.y = 0.0035;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.06), new THREE.MeshStandardMaterial({ map: labelTexture('SSD 1TB', '#111318', '#5eead4'), roughness: 0.5 }));
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, 0.0072, 0);
    g.add(body, label);
  }
  return prepare(g);
}

function buildRam(part) {
  const look = RAM_LOOKS[part.id] || RAM_LOOKS['d4-16'];
  const g = new THREE.Group();
  const rgb = [];
  const spreader = new THREE.MeshStandardMaterial({ color: look.spreader, metalness: 0.75, roughness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: look.accent, metalness: 0.5, roughness: 0.4 });
  const pcbMat = new THREE.MeshStandardMaterial({ color: 0x0f3d2a, roughness: 0.6 });
  const top = look.height;
  const barH = look.rgb ? 0.0065 : 0;
  const sh = top - 0.004 - barH;
  // Origin = bottom edge of the sticks (where they enter the slot); the two sticks
  // sit in the 2nd and 4th DIMM slots.
  for (const x of [-0.0084, 0.0084]) {
    const stick = new THREE.Group();
    addBox(stick, 0.0012, 0.133, 0.031, pcbMat, 0, 0, 0.0155);
    addBox(stick, 0.0013, 0.128, 0.003, gold, 0, 0, 0.0015);
    for (const side of [-1, 1]) {
      addBox(stick, 0.0022, 0.13, sh, spreader, side * 0.0018, 0, 0.004 + sh / 2);
      addBox(stick, 0.0003, 0.09, Math.min(0.006, sh * 0.25), accentMat, side * 0.003, 0.01, 0.004 + sh * 0.62);
    }
    if (look.rgb) {
      const bar = rgbMaterial();
      rgb.push(bar);
      addBox(stick, 0.0055, 0.128, barH, bar, 0, 0, top - barH / 2);
    } else {
      addBox(stick, 0.0058, 0.13, 0.0022, accentMat, 0, 0, top - 0.0011);
    }
    stick.position.x = x;
    g.add(stick);
  }
  g.userData.rgb = rgb;
  return prepare(g);
}

/** PSU length grows with wattage, like real units (140-180 mm). */
const psuLength = (part) => (part.watts >= 1000 ? 0.18 : part.watts >= 850 ? 0.16 : 0.14);

function buildPsu(part) {
  const g = new THREE.Group();
  const len = psuLength(part);
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, 0.086, 0.14), new THREE.MeshStandardMaterial({ color: 0x121419, metalness: 0.5, roughness: 0.55 }));
  g.add(body);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.05),
    new THREE.MeshStandardMaterial({ map: labelTexture(`${part.watts} W · ${part.rating.toUpperCase()}`, '#1a1d24', part.rating === 'Bronze' ? '#d08b4f' : part.rating === 'Gold' ? '#ffd166' : '#d9dde3'), roughness: 0.5 }));
  label.position.set(0, 0, 0.0701);
  g.add(label);
  const grille = new THREE.Mesh(new THREE.CircleGeometry(0.055, 32), new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.8 }));
  grille.rotation.x = Math.PI / 2;
  grille.position.y = -0.0431;
  g.add(grille);
  // Cable bundle heading to the board
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.75 });
  for (const [dx, dz] of [[0.03, 0.02], [0.045, -0.01], [0.06, 0.03]]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.06 + dx * 0.2, 0.043, dz),
      new THREE.Vector3(0.07 + dx * 0.3, 0.08, dz * 0.5),
      new THREE.Vector3(0.1 + dx, 0.11, -0.03),
    ]);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.004, 6), sleeve);
    g.add(cable);
  }
  return prepare(g);
}

/** The Gen4 drive ships with a finned heatsink over the M.2 module. */
function withHeatsink(template) {
  const g = new THREE.Group();
  if (template) g.add(template.clone(true));
  const sink = new THREE.MeshStandardMaterial({ color: 0x17191e, metalness: 0.7, roughness: 0.4 });
  addBox(g, 0.072, 0.0215, 0.0035, sink, 0.002, 0, 0.0028);
  for (let i = 0; i < 9; i++) addBox(g, 0.0016, 0.0215, 0.003, sink, -0.03 + i * 0.0075, 0, 0.0058);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.008), new THREE.MeshStandardMaterial({ map: labelTexture('GEN4', '#17191e', '#5eead4'), roughness: 0.5 }));
  label.position.set(0.028, 0, 0.0046);
  g.add(label);
  return prepare(g);
}

// --- public API -----------------------------------------------------------------

/** Build a 3D object for a catalog part, plus where it goes in the case. */
export function createPartObject(part) {
  let object;
  let position;
  if (part.category === 'cooler') {
    object = buildCooler(part.style);
    position = SLOTS.cooler.pos.clone();
  } else if (part.category === 'storage' && part.form !== 'm2') {
    object = buildBayDrive(part.form);
    position = SLOTS.storageBay.pos.clone();
  } else if (part.category === 'ram') {
    object = buildRam(part);
    position = SLOTS.ram.pos.clone();
  } else if (part.category === 'psu') {
    object = buildPsu(part);
    // keep the PSU's back flush with the rear of the case
    position = SLOTS.psu.pos.clone().setX(-0.217 + psuLength(part) / 2);
  } else if (part.category === 'motherboard') {
    object = prepare(buildBoard(part));
    position = SLOTS.motherboard.pos.clone();
  } else if (part.category === 'cpu') {
    object = buildCpu(part);
    position = SLOTS.cpu.pos.clone();
  } else if (part.category === 'gpu') {
    object = prepare(buildGpu(part));
    position = SLOTS.gpu.pos.clone();
  } else if (part.category === 'storage' && part.id === 'nvme4-2t') {
    object = withHeatsink(templates.get('storage'));
    position = SLOTS.storage.pos.clone();
  } else {
    const tpl = templates.get(part.category);
    object = tpl ? tpl.clone(true) : placeholder(part.category);
    position = SLOTS[part.category].pos.clone();
  }
  object.position.copy(position);
  object.userData.partId = part.id;
  object.userData.category = part.category;
  return object;
}

/**
 * A part posed for a display case: front facing +Z, sitting on y = 0, centred on x/z,
 * scaled up so it reads from across the room.
 */
export function createDisplayObject(part) {
  // A fixed enlargement per category, so real size differences stay visible
  // (an RTX 4090 really is much longer than an RX 7600).
  let object;
  let scale;
  if (part.category === 'ram') {
    object = buildRam(part);
    object.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); // lie the sticks down, face out
    scale = 2.2;
  } else if (part.category === 'storage' && part.form !== 'm2') {
    object = buildBayDrive(part.form);
    object.rotation.x = Math.PI / 2;
    scale = part.form === 'hdd' ? 1.8 : 2.2;
  } else if (part.category === 'gpu') {
    object = prepare(buildGpu(part));
    object.rotation.x = -Math.PI / 2; // stand on its edge, fans facing out
    scale = 1.6;
  } else if (part.category === 'cpu') {
    object = buildCpu(part);
    scale = 4;
  } else if (part.category === 'storage') {
    const tpl = templates.get('storage');
    object = part.id === 'nvme4-2t' ? withHeatsink(tpl) : tpl ? tpl.clone(true) : placeholder('storage');
    scale = 3;
  } else {
    object = createPartObject(part);
    object.position.set(0, 0, 0);
    scale = 1;
  }
  const holder = new THREE.Group();
  holder.add(object);
  object.scale.multiplyScalar(scale);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const c = box.getCenter(new THREE.Vector3());
  object.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  holder.userData.rgb = object.userData.rgb || [];
  return holder;
}

/** Bounding box (case space) used for the "goes here" indicator. */
export function slotBox(category) {
  if (category === 'cooler') {
    return { center: SLOTS.cooler.pos.clone().add(new THREE.Vector3(0, 0, 0.075)), size: new THREE.Vector3(0.1, 0.13, 0.15) };
  }
  if (category === 'storage') {
    return { center: SLOTS.storage.pos.clone(), size: SLOTS.storage.size.clone().setZ(0.006) };
  }
  const s = SLOTS[category];
  return s ? { center: (s.center || s.pos).clone(), size: s.size.clone() } : null;
}

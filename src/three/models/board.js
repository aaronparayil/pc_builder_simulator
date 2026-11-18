import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BOARD_LOOKS } from '../../data/looks.js';
import { box, canvasTexture, fitFont, gold, metal, MONO, plastic, rgbMaterial, SANS } from './common.js';

// ATX board, 244 × 305 mm. Board-local metres, origin at the centre of the front face.
export const BOARD = { W: 0.244, H: 0.305 };
export const LAYOUT = {
  socket: [0.001, 0.0435],
  dimmX: 0.0615,
  dimmOffsets: [-0.0168, -0.0084, 0, 0.0084], // sticks go in the 2nd and 4th slots
  dimmY: 0.04,
  pcie1: [-0.0445, -0.0215],
  m2: [-0.029, -0.1045],
  holes: [[-0.107, -0.1325], [-0.107, 0.1375], [0.108, -0.1325], [0.108, 0.1375], [0.003, -0.0825]],
};

const px = (x) => ((x + BOARD.W / 2) / BOARD.W) * 512;
const py = (y) => ((BOARD.H / 2 - y) / BOARD.H) * 640;

function pcbTexture(look, part) {
  return canvasTexture(512, 640, (ctx, w, h) => {
    ctx.fillStyle = look.pcb;
    ctx.fillRect(0, 0, w, h);
    const ink = look.light ? 'rgba(20,24,30,' : 'rgba(255,255,255,';
    // traces
    ctx.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      ctx.strokeStyle = `${ink}${0.03 + (i % 5) * 0.008})`;
      const x0 = (i * 37) % w, y0 = (i * 71) % h;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + 40 + (i % 7) * 12, y0);
      ctx.lineTo(x0 + 60 + (i % 7) * 12, y0 + 30 + (i % 4) * 15);
      ctx.stroke();
    }
    // silkscreen
    ctx.fillStyle = `${ink}0.55)`;
    ctx.font = `500 11px ${MONO}`;
    ctx.fillText('PCIEX16_1', px(-0.088), py(-0.0215) - 9);
    ctx.fillText('PCIEX16_2', px(-0.088), py(-0.0615) - 9);
    ctx.fillText('M2_1', px(-0.075), py(-0.1045) + 20);
    ctx.fillText(`${part.ramType}_A2  B2`, px(0.04), py(0.127));
    ctx.fillText(part.socket, px(-0.015), py(-0.012) + 12);
    ctx.fillText('ATX_24P', px(0.098), py(0.06));
    ctx.fillText('CPU_8P', px(-0.093), py(0.13));
    ctx.fillStyle = `${ink}0.12)`;
    fitFont(ctx, look.label, 700, SANS, 54, 200);
    ctx.fillText(look.label, px(-0.115), py(-0.14));
    // socket keep-out square
    ctx.strokeStyle = `${ink}0.35)`;
    const [sx, sy] = LAYOUT.socket;
    ctx.strokeRect(px(sx - 0.034), py(sy + 0.036), px(0.068) - px(0), py(0) - py(0.072));
  });
}

function socket(g, socketType, look) {
  const [sx, sy] = LAYOUT.socket;
  if (socketType === 'AM4') {
    // PGA socket: a beige block full of pin holes, with a lever on the side
    const holes = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#e6dcc5';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#6f6a5f';
      for (let y = 12; y < h - 8; y += 7) for (let x = 12; x < w - 8; x += 7) {
        if (Math.abs(x - w / 2) < 30 && Math.abs(y - h / 2) < 30) continue;
        ctx.fillRect(x, y, 2, 2);
      }
    });
    const side = plastic(0xe6dcc5);
    const top = new THREE.MeshStandardMaterial({ map: holes, roughness: 0.7 });
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.048, 0.004), [side, side, side, side, top, side]);
    block.position.set(sx, sy - 0.002, 0.002);
    g.add(block);
    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.048, 8), metal(0xb9bec6, 0.3));
    lever.position.set(sx + 0.025, sy - 0.002, 0.0025);
    g.add(lever);
  } else {
    // LGA socket: dark base plus the steel load plate frame and lever
    const [w, h] = socketType === 'LGA1700' ? [0.0375, 0.045] : [0.04, 0.04];
    box(g, w + 0.006, h + 0.006, 0.0015, plastic(0x14161a), sx, sy, 0.00075);
    const steel = metal(0xc3c8cf, 0.3);
    const t = 0.0032, z = 0.0021;
    box(g, w + 0.008, t, 0.0035, steel, sx, sy + h / 2 + t / 2, z);
    box(g, w + 0.008, t, 0.0035, steel, sx, sy - h / 2 - t / 2, z);
    box(g, t, h, 0.0035, steel, sx - w / 2 - t / 2, sy, z);
    box(g, t, h, 0.0035, steel, sx + w / 2 + t / 2, sy, z);
    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, h + 0.012, 8), steel);
    lever.position.set(sx + w / 2 + 0.006, sy, 0.0025);
    g.add(lever);
  }
}

/** A motherboard for the given catalog part, front face at z = 0. */
export function buildBoard(part) {
  const look = BOARD_LOOKS[part.id] || BOARD_LOOKS.b550;
  const g = new THREE.Group();
  const rgb = [];
  const { W, H } = BOARD;

  // PCB
  const edge = plastic(look.light ? 0xd5d8dc : 0x101114);
  const face = new THREE.MeshStandardMaterial({ map: pcbTexture(look, part), roughness: 0.6 });
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.0016), [edge, edge, edge, edge, face, edge]);
  pcb.position.z = -0.0008;
  pcb.receiveShadow = true;
  g.add(pcb);
  for (const [x, y] of LAYOUT.holes) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.0018, 0.0034, 20), metal(0xc9b37a, 0.35));
    ring.position.set(x, y, 0.0002);
    g.add(ring);
  }

  socket(g, look.socket, look);

  // Heatsinks: VRM blocks around the socket, I/O cover, chipset
  const hs = metal(look.heatsink, 0.45, 0.75);
  const accent = new THREE.MeshStandardMaterial({ color: look.accent, emissive: look.accent, emissiveIntensity: 0.2, roughness: 0.4, metalness: 0.4 });
  const rounded = (w, h, d, x, y, mat = hs) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.0015), mat);
    m.position.set(x, y, d / 2);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  rounded(0.022, 0.085, 0.02, -0.06, 0.05);
  rounded(0.07, 0.018, 0.018, -0.002, 0.105);
  box(g, 0.0025, 0.07, 0.0012, accent, -0.0505, 0.05, 0.0204);
  const io = rounded(0.03, 0.09, 0.032, -0.107, 0.105);
  void io;
  if (look.rgb) {
    const strip = rgbMaterial();
    rgb.push(strip);
    box(g, 0.0025, 0.07, 0.001, strip, -0.0915, 0.105, 0.0285);
  } else {
    box(g, 0.0025, 0.07, 0.001, accent, -0.0915, 0.105, 0.0285);
  }
  rounded(0.05, 0.045, 0.008, 0.07, -0.1);
  const chipLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.014), new THREE.MeshStandardMaterial({
    transparent: true,
    roughness: 0.5,
    map: canvasTexture(512, 160, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `#${look.accent.toString(16).padStart(6, '0')}`;
      fitFont(ctx, look.label, 700, SANS, 120, w - 20);
      ctx.textBaseline = 'middle';
      ctx.fillText(look.label, 10, h / 2 + 4);
    }),
  }));
  chipLabel.position.set(0.07, -0.1, 0.0082);
  g.add(chipLabel);
  if (part.m2 >= 3) {
    rounded(0.085, 0.018, 0.006, -0.03, -0.136);
    box(g, 0.06, 0.0015, 0.0008, accent, -0.03, -0.136, 0.0062);
  }

  // Memory slots
  const slotMat = plastic(look.slot, 0.5);
  const latch = plastic(look.light ? 0xbfc4cc : 0x2e3138, 0.5);
  for (const o of LAYOUT.dimmOffsets) {
    const x = LAYOUT.dimmX + o;
    box(g, 0.0058, 0.1395, 0.0058, slotMat, x, LAYOUT.dimmY, 0.0029);
    box(g, 0.0062, 0.006, 0.009, latch, x, LAYOUT.dimmY + 0.0725, 0.0045);
    box(g, 0.0062, 0.006, 0.009, latch, x, LAYOUT.dimmY - 0.0725, 0.0045);
  }

  // Expansion slots: armoured x16, an x1, a second x16
  const [p1x, p1y] = LAYOUT.pcie1;
  box(g, 0.089, 0.0075, 0.011, metal(0xb9bec6, 0.3), p1x, p1y, 0.0055);
  box(g, 0.025, 0.0072, 0.011, slotMat, -0.0765, -0.0415, 0.0055);
  box(g, 0.089, 0.0072, 0.011, slotMat, p1x, -0.0615, 0.0055);

  // M.2 connector and standoff
  const [mx, my] = LAYOUT.m2;
  box(g, 0.004, 0.023, 0.0042, plastic(0x111215), mx - 0.04, my, 0.0021);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.003, 12), gold);
  stand.rotation.x = Math.PI / 2;
  stand.position.set(mx + 0.04, my, 0.0015);
  g.add(stand);

  // Connectors, battery and capacitors
  const connector = plastic(look.light ? 0xeceef0 : 0x0e0f12, 0.6);
  box(g, 0.009, 0.052, 0.012, connector, 0.113, 0.03, 0.006);
  box(g, 0.018, 0.009, 0.011, connector, -0.08, 0.143, 0.0055);
  for (let i = 0; i < 4; i++) box(g, 0.007, 0.009, 0.006, connector, 0.114, -0.075 - i * 0.012, 0.003);
  const battery = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.0032, 32), metal(0xd0d4da, 0.25));
  battery.rotation.x = Math.PI / 2;
  battery.position.set(0.025, -0.06, 0.0016);
  g.add(battery);
  const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0021, 0.0021, 0.008, 14), metal(0x2c2f36, 0.4, 0.6), 8);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    m.compose(new THREE.Vector3(0.0368, -0.004 + i * 0.012, 0.004), q, new THREE.Vector3(1, 1, 1));
    caps.setMatrixAt(i, m);
  }
  caps.castShadow = true;
  g.add(caps);

  g.userData.rgb = rgb;
  return g;
}

import * as THREE from 'three';
import { ROOM } from './room.js';
import { createDisplayObject } from './parts.js';
import { PARTS, CATEGORIES } from '../data/catalog.js';

const SANS = '"Space Grotesk", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const TEAL = '#5eead4';
const CHART_ACCENT = '#13a898';
const CHART_MUTED = '#4b5263';

// ---------------------------------------------------------------------------
// Info posters

function wrap(ctx, text, x, y, maxW, lineH) {
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineH;
    } else line = test;
  }
  if (line) { ctx.fillText(line, x, y); y += lineH; }
  return y;
}

function hbars(ctx, rows, { x, y, w, max, unit, highlight }) {
  // Horizontal bars: label column, 24px bars with a rounded data end, value at the tip.
  const labelW = 250;
  rows.forEach((r, i) => {
    const yy = y + i * 64;
    ctx.fillStyle = '#c3cad6';
    ctx.font = `500 26px ${MONO}`;
    ctx.fillText(r.label, x, yy + 19);
    const bw = Math.max(6, ((w - labelW - 150) * r.value) / max);
    ctx.fillStyle = r.label === highlight ? CHART_ACCENT : CHART_MUTED;
    ctx.beginPath();
    ctx.roundRect(x + labelW, yy, bw, 24, [0, 4, 4, 0]);
    ctx.fill();
    ctx.fillStyle = '#e6edf3';
    ctx.font = `600 26px ${SANS}`;
    ctx.fillText(`${r.value.toLocaleString()}${unit}`, x + labelW + bw + 14, yy + 20);
  });
  return y + rows.length * 64;
}

const sockets = () => ['AM4', 'AM5', 'LGA1700'].map((s) => ({
  socket: s,
  cpus: PARTS.cpu.filter((c) => c.socket === s).map((c) => c.name),
  boards: PARTS.motherboard.filter((b) => b.socket === s).map((b) => b.name.split(' ')[0]),
}));

export const INFO_POSTERS = [
  {
    id: 'anatomy', color: '#5eead4', eyebrow: 'Field notes 01', title: 'Anatomy of a build',
    intro: 'Seven parts, installed in roughly this order. Everything plugs into the motherboard.',
    body(ctx, x, y, w) {
      CATEGORIES.forEach((c, i) => {
        ctx.fillStyle = TEAL;
        ctx.font = `700 34px ${MONO}`;
        ctx.fillText(String(i + 1).padStart(2, '0'), x, y + 34);
        ctx.fillStyle = '#e6edf3';
        ctx.font = `600 34px ${SANS}`;
        ctx.fillText(c.label, x + 80, y + 34);
        ctx.fillStyle = '#8b95a7';
        ctx.font = `400 24px ${SANS}`;
        y = wrap(ctx, c.hint, x + 80, y + 70, w - 80, 32) + 18;
      });
    },
  },
  {
    id: 'sockets', color: '#ff3d7f', eyebrow: 'Field notes 02', title: 'Sockets 101',
    intro: 'A CPU only fits a motherboard with the same socket. The chipset name tells you which socket a board has.',
    body(ctx, x, y, w) {
      for (const s of sockets()) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.roundRect(x, y, w, 220, 16);
        ctx.fill();
        ctx.fillStyle = '#ff3d7f';
        ctx.font = `700 44px ${MONO}`;
        ctx.fillText(s.socket, x + 28, y + 64);
        ctx.fillStyle = '#e6edf3';
        ctx.font = `500 26px ${SANS}`;
        let yy = wrap(ctx, `CPUs: ${s.cpus.join(', ')}`, x + 28, y + 112, w - 56, 34);
        ctx.fillStyle = '#8b95a7';
        wrap(ctx, `Boards: ${s.boards.join(', ')}`, x + 28, yy + 4, w - 56, 34);
        y += 248;
      }
    },
  },
  {
    id: 'memory', color: '#a78bfa', eyebrow: 'Field notes 03', title: 'DDR4 vs DDR5',
    intro: 'Same length, different notch. A board takes one type or the other, never both.',
    body(ctx, x, y, w) {
      const stick = (yy, label, notch, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(x, yy, w, 90);
        ctx.fillStyle = '#c8a24a';
        for (let i = 0; i < 60; i++) ctx.fillRect(x + 10 + i * ((w - 20) / 60), yy + 70, 6, 20);
        ctx.fillStyle = '#121419';
        ctx.fillRect(x + w * notch - 10, yy + 62, 20, 30);
        ctx.fillStyle = '#e6edf3';
        ctx.font = `700 34px ${SANS}`;
        ctx.fillText(label, x, yy - 18);
      };
      stick(y + 50, 'DDR4 · notch off-centre', 0.55, '#1f4d3a');
      stick(y + 230, 'DDR5 · notch near the middle', 0.5, '#1d3557');
      y += 380;
      ctx.font = `400 28px ${SANS}`;
      ctx.fillStyle = '#c3cad6';
      y = wrap(ctx, 'DDR5 runs faster (4800–8000 MT/s vs 2133–3600) and gives games a few percent more frame rate. If a kit is rated faster than the board supports, it simply runs at the board\'s limit.', x, y, w, 40);
      y += 20;
      ctx.fillStyle = '#8b95a7';
      wrap(ctx, 'Tip: 32 GB is the sweet spot for gaming. Creators should go 64 GB.', x, y, w, 40);
    },
  },
  {
    id: 'power', color: '#ffd166', eyebrow: 'Field notes 04', title: 'Power budget',
    intro: 'Add up the CPU and GPU, plus about 60 W for everything else. Then leave 30% headroom.',
    body(ctx, x, y, w) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, 120, 16);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.font = `700 34px ${MONO}`;
      ctx.fillText('(CPU + GPU + 60) × 1.3', x + 28, y + 72);
      y += 180;
      ctx.fillStyle = '#e6edf3';
      ctx.font = `600 30px ${SANS}`;
      ctx.fillText('Example: Core i9-14900K + RTX 4090', x, y);
      y = hbars(ctx, [
        { label: 'CPU', value: 253 }, { label: 'GPU', value: 450 }, { label: 'Rest', value: 60 }, { label: 'Target', value: 990 },
      ], { x, y: y + 30, w, max: 990, unit: ' W', highlight: 'Target' });
      ctx.fillStyle = '#8b95a7';
      ctx.font = `400 26px ${SANS}`;
      wrap(ctx, 'Too small and the PC shuts off under load. A little extra keeps fans quiet and the PSU efficient.', x, y + 20, w, 36);
    },
  },
  {
    id: 'bottleneck', color: '#60a5fa', eyebrow: 'Field notes 05', title: 'Bottlenecks',
    intro: 'Your frame rate is whichever is lower: what the CPU can prepare, or what the GPU can draw.',
    body(ctx, x, y, w) {
      ctx.fillStyle = '#e6edf3';
      ctx.font = `600 30px ${SANS}`;
      ctx.fillText('RTX 4070 Super, GPU-limited FPS', x, y);
      y = hbars(ctx, [
        { label: '1080p', value: 165 }, { label: '1440p', value: 112 }, { label: '4K', value: 63 },
      ], { x, y: y + 30, w, max: 165, unit: ' fps', highlight: '1440p' });
      ctx.fillStyle = '#c3cad6';
      ctx.font = `400 28px ${SANS}`;
      y = wrap(ctx, 'Higher resolutions load the GPU, not the CPU. A Ryzen 5 5600 tops out near 110 fps, so at 1080p it holds this card back. At 4K it doesn\'t matter.', x, y + 30, w, 40);
      ctx.fillStyle = '#8b95a7';
      wrap(ctx, 'Rule of thumb: pair the GPU with your monitor, then pick a CPU that keeps up.', x, y + 20, w, 40);
    },
  },
  {
    id: 'cooling', color: '#f97316', eyebrow: 'Field notes 06', title: 'Keep it cool',
    intro: 'A cooler\'s rating should be at least the CPU\'s peak power. Under-rated coolers make the CPU throttle.',
    body(ctx, x, y, w) {
      const short = { lowpro: 'Low-profile', tower1: 'Single-tower', tower2: 'Dual-tower', aio240: 'AIO 240' };
      const rows = [{ label: 'Stock', value: 88 }, ...PARTS.cooler.map((c) => ({ label: short[c.id] || c.name, value: c.tdpRating }))];
      ctx.fillStyle = '#e6edf3';
      ctx.font = `600 30px ${SANS}`;
      ctx.fillText('Cooler ratings', x, y);
      y = hbars(ctx, rows, { x, y: y + 30, w, max: 270, unit: ' W', highlight: 'Dual-tower' });
      ctx.fillStyle = '#c3cad6';
      ctx.font = `400 28px ${SANS}`;
      y = wrap(ctx, 'Check the bracket too: the low-profile cooler has no AM5 mount, so it can\'t fit a Ryzen 7000 chip.', x, y + 20, w, 40);
    },
  },
  {
    id: 'storage', color: '#38bdf8', eyebrow: 'Field notes 07', title: 'Storage speeds',
    intro: 'The boot drive decides how fast Windows and games load. Sequential read speed, MB/s:',
    body(ctx, x, y, w) {
      y = hbars(ctx, PARTS.storage.map((s) => ({ label: s.name.replace(/^\d+ TB /, ''), value: s.read })), { x, y, w, max: 7000, unit: '', highlight: 'NVMe Gen4' });
      ctx.fillStyle = '#c3cad6';
      ctx.font = `400 28px ${SANS}`;
      y = wrap(ctx, 'NVMe drives plug straight into an M.2 slot on the board. SATA drives need a data cable and power from the PSU.', x, y + 30, w, 40);
      ctx.fillStyle = '#8b95a7';
      wrap(ctx, 'Hard drives are cheap per terabyte: great for bulk storage, slow as a boot drive.', x, y + 20, w, 40);
    },
  },
];

export function drawInfoPoster(poster, W = 900, H = 1200) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f1117';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = poster.color;
  ctx.fillRect(0, 0, W, 14);
  const pad = 64;
  ctx.font = `600 24px ${MONO}`;
  ctx.fillText(poster.eyebrow.toUpperCase(), pad, 90);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 76px ${SANS}`;
  ctx.fillText(poster.title, pad, 180);
  ctx.fillStyle = '#c3cad6';
  ctx.font = `400 30px ${SANS}`;
  const y = wrap(ctx, poster.intro, pad, 250, W - pad * 2, 42);
  poster.body(ctx, pad, y + 40, W - pad * 2);
  ctx.fillStyle = '#4b5263';
  ctx.font = `500 22px ${MONO}`;
  ctx.fillText('RIG//BUILDER', pad, H - 50);
  return c;
}

// ---------------------------------------------------------------------------
// Display cabinets

const frameMat = new THREE.MeshStandardMaterial({ color: 0x14161c, metalness: 0.6, roughness: 0.4 });
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xbfd4e6, roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false });

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function plaque(part) {
  const tex = canvasTexture(512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#0d0f15';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = TEAL;
    ctx.fillRect(0, 0, 8, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 40px ${SANS}`;
    let size = 40;
    while (ctx.measureText(part.name).width > 330 && size > 24) { size -= 2; ctx.font = `700 ${size}px ${SANS}`; }
    ctx.fillText(part.name, 28, 62);
    ctx.fillStyle = '#ffd166';
    ctx.font = `700 40px ${SANS}`;
    ctx.textAlign = 'right';
    ctx.fillText(`$${part.price}`, w - 24, 62);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8b95a7';
    ctx.font = `500 26px ${MONO}`;
    ctx.fillText(part.specs.slice(0, 3).join(' · '), 28, 122);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.106), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  return m;
}

function buildCabinet(category, title, parts) {
  const W = 1.4, H = 2.05, D = 0.5, base = 0.18, levels = [base, 0.78, 1.38];
  const g = new THREE.Group();
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  box(W, base, D, frameMat, 0, base / 2, 0);
  box(W, H - base, 0.02, new THREE.MeshStandardMaterial({ color: 0x1a1d25, roughness: 0.8 }), 0, base + (H - base) / 2, -D / 2 + 0.01);
  box(0.04, H, D, frameMat, -W / 2 + 0.02, H / 2, 0);
  box(0.04, H, D, frameMat, W / 2 - 0.02, H / 2, 0);
  box(W, 0.2, D, frameMat, 0, H - 0.1, 0);
  for (const y of levels.slice(1)) {
    const shelf = box(W - 0.08, 0.012, D - 0.04, glassMat, 0, y, 0);
    shelf.castShadow = false;
  }
  const front = box(W - 0.08, H - base - 0.2, 0.01, glassMat, 0, base + (H - base - 0.2) / 2, D / 2 - 0.005);
  front.castShadow = false;
  front.raycast = () => {}; // look through the glass at the parts

  // Lit sign
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.12, 0.15), new THREE.MeshBasicMaterial({
    toneMapped: false,
    map: canvasTexture(1024, 120, (ctx, w, h) => {
      ctx.fillStyle = '#0d0f15';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = TEAL;
      ctx.font = `700 64px ${SANS}`;
      ctx.fillText(title.toUpperCase(), 32, 82);
      ctx.fillStyle = '#8b95a7';
      ctx.font = `500 30px ${MONO}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${parts.length} models`, w - 32, 78);
    }),
  }));
  sign.position.set(0, H - 0.1, D / 2 + 0.001);
  g.add(sign);

  // LED strips and an inner light
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xdff7f2).multiplyScalar(1.5), toneMapped: false });
  for (const y of [0.76, 1.36, 1.83]) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(W - 0.12, 0.008, 0.008), ledMat);
    led.position.set(0, y - 0.01, D / 2 - 0.04);
    g.add(led);
  }
  const lamp = new THREE.PointLight(0xffffff, 1.6, 1.8, 2);
  lamp.position.set(0, 1.2, 0.15);
  g.add(lamp);

  // Parts, up to two per level
  const items = [];
  parts.forEach((part, i) => {
    // Fill from the top shelf down so eye level is never empty
    const row = Math.floor(i / 2);
    const level = levels.length - 1 - row;
    const perLevel = Math.min(2, parts.length - row * 2);
    const x = perLevel === 1 ? 0 : (i % 2 === 0 ? -0.33 : 0.33);
    const y = levels[Math.max(0, level)] + (level ? 0.006 : 0);
    const obj = createDisplayObject(part);
    obj.position.set(x, y + 0.03, -0.04);
    obj.userData.interact = { kind: 'part', partId: part.id, category, label: `Inspect ${part.name}` };
    g.add(obj);
    items.push(obj);
    const p = plaque(part);
    p.position.set(x, y + 0.055, D / 2 - 0.07);
    p.rotation.x = -0.5;
    p.userData.interact = obj.userData.interact;
    g.add(p);
  });
  g.userData.interact = { kind: 'cabinet', category, label: `Browse ${title.toLowerCase()}` };
  return { group: g, items, size: { W, D } };
}

// ---------------------------------------------------------------------------
// Compare kiosk

function buildKiosk() {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.0, 0.3), frameMat);
  stand.position.y = 0.5;
  stand.castShadow = true;
  g.add(stand);
  const accent = new THREE.Mesh(new THREE.BoxGeometry(0.455, 0.01, 0.305), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5eead4).multiplyScalar(1.5), toneMapped: false }));
  accent.position.y = 0.3;
  g.add(accent);
  const gpus = [...PARTS.gpu].sort((a, b) => b.fps1080 - a.fps1080);
  const tex = canvasTexture(1024, 640, (ctx, w, h) => {
    ctx.fillStyle = '#0d0f15';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = TEAL;
    ctx.font = `700 52px ${SANS}`;
    ctx.fillText('COMPARE PARTS', 48, 86);
    ctx.fillStyle = '#8b95a7';
    ctx.font = `500 26px ${MONO}`;
    ctx.fillText('GPU · 1440p FPS', 48, 128);
    gpus.forEach((gpu, i) => {
      const y = 180 + i * 72;
      const v = Math.round(gpu.fps1080 * 0.68);
      ctx.fillStyle = '#c3cad6';
      ctx.font = `500 26px ${SANS}`;
      ctx.fillText(gpu.name.replace('GeForce ', '').replace('Radeon ', ''), 48, y + 20);
      const bw = (560 * v) / 200;
      ctx.fillStyle = i === 0 ? CHART_ACCENT : CHART_MUTED;
      ctx.beginPath();
      ctx.roundRect(330, y, bw, 24, [0, 4, 4, 0]);
      ctx.fill();
      ctx.fillStyle = '#e6edf3';
      ctx.font = `600 26px ${SANS}`;
      ctx.fillText(String(v), 330 + bw + 12, y + 21);
    });
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 28px ${SANS}`;
    ctx.fillText('Press E to compare CPUs and GPUs', 48, h - 36);
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.4), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.44, 0.03), frameMat);
  const head = new THREE.Group();
  head.add(bezel);
  screen.position.z = 0.016;
  head.add(screen);
  head.position.set(0, 1.22, 0.02);
  head.rotation.x = -0.35;
  g.add(head);
  g.userData.interact = { kind: 'compare', label: 'Compare CPUs and GPUs' };
  return g;
}

// ---------------------------------------------------------------------------

export function buildShowroom(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const colliders = [];
  const rgb = [];
  const posters = new Map();

  // Cabinets along the side walls, facing into the room
  const layout = [
    ['gpu', 'Graphics cards', -1, 2.6],
    ['cpu', 'Processors', -1, 4.7],
    ['ram', 'Memory', 1, 2.6],
    ['storage', 'Storage', 1, 4.7],
  ];
  for (const [category, title, side, z] of layout) {
    const cab = buildCabinet(category, title, PARTS[category]);
    const x = side < 0 ? ROOM.minX + cab.size.D / 2 + 0.03 : ROOM.maxX - cab.size.D / 2 - 0.03;
    cab.group.position.set(x, 0, z);
    cab.group.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    root.add(cab.group);
    cab.items.forEach((it) => rgb.push(...it.userData.rgb));
    const hw = cab.size.D / 2 + 0.03, hd = cab.size.W / 2;
    colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });
  }

  // Info posters on the side and front walls
  const spots = [
    ['anatomy', 0, 1.65, ROOM.maxZ - 0.01, Math.PI],
    ['power', -2.6, 1.65, ROOM.maxZ - 0.01, Math.PI],
    ['bottleneck', 2.6, 1.65, ROOM.maxZ - 0.01, Math.PI],
    ['sockets', ROOM.minX + 0.01, 1.65, 6.75, Math.PI / 2],
    ['cooling', ROOM.minX + 0.01, 1.65, 0.85, Math.PI / 2],
    ['memory', ROOM.maxX - 0.01, 1.65, 6.75, -Math.PI / 2],
    ['storage', ROOM.maxX - 0.01, 1.65, 0.85, -Math.PI / 2],
  ];
  for (const [id, x, y, z, rot] of spots) {
    const def = INFO_POSTERS.find((p) => p.id === id);
    const canvas = drawInfoPoster(def);
    posters.set(id, { ...def, canvas });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.28, 0.03), frameMat);
    frame.position.z = 0.015;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }));
    art.position.z = 0.031;
    g.add(frame, art);
    g.position.set(x, y, z);
    g.rotation.y = rot;
    g.userData.interact = { kind: 'poster', id, label: `Read “${def.title}”` };
    root.add(g);
  }

  // Decor: a rug with the logo, tall plants and a bench by the front wall
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), new THREE.MeshStandardMaterial({
    roughness: 1,
    map: canvasTexture(1024, 1024, (ctx, w) => {
      ctx.fillStyle = '#12151c';
      ctx.beginPath(); ctx.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = TEAL; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.arc(w / 2, w / 2, w / 2 - 40, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(94,234,212,0.25)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(w / 2, w / 2, w / 2 - 80, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e6edf3'; ctx.textAlign = 'center';
      ctx.font = `700 120px ${SANS}`;
      ctx.fillText('RIG//BUILDER', w / 2, w / 2 + 300);
    }),
  }));
  rug.rotation.x = -Math.PI / 2;
  rug.rotation.z = Math.PI;
  rug.position.set(0, 0.004, 5.3);
  rug.receiveShadow = true;
  root.add(rug);

  const potMat = new THREE.MeshStandardMaterial({ color: 0x1f232c, roughness: 0.7 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7d4f, roughness: 0.75, side: THREE.DoubleSide });
  for (const [x, z] of [[ROOM.minX + 0.5, ROOM.maxZ - 0.5], [ROOM.maxX - 0.5, ROOM.maxZ - 0.5], [ROOM.minX + 0.5, 3.65], [ROOM.maxX - 0.5, 3.65]]) {
    const plant = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.45, 24), potMat);
    pot.position.y = 0.225;
    plant.add(pot);
    for (let i = 0; i < 14; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), leafMat);
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const h = 0.6 + (i % 4) * 0.2;
      leaf.scale.set(0.45, 2.6, 0.12);
      leaf.position.set(Math.cos(a) * 0.12, h, Math.sin(a) * 0.12);
      leaf.rotation.set(Math.sin(a) * 0.45, -a, Math.cos(a) * 0.45);
      leaf.castShadow = true;
      plant.add(leaf);
    }
    plant.position.set(x, 0, z);
    root.add(plant);
    colliders.push({ minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25 });
  }

  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.45), new THREE.MeshStandardMaterial({ color: 0x3a2a1f, roughness: 0.6 }));
  seat.position.y = 0.45;
  seat.castShadow = seat.receiveShadow = true;
  bench.add(seat);
  for (const x of [-0.8, 0.8]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.41, 0.4), frameMat);
    leg.position.set(x, 0.205, 0);
    bench.add(leg);
  }
  bench.position.set(0, 0, ROOM.maxZ - 0.9);
  root.add(bench);
  colliders.push({ minX: -0.95, maxX: 0.95, minZ: ROOM.maxZ - 1.15, maxZ: ROOM.maxZ - 0.65 });

  // Comparison kiosk in the middle of the room, facing the bench
  const kiosk = buildKiosk();
  kiosk.position.set(0, 0, 5.3);
  kiosk.rotation.y = Math.PI;
  root.add(kiosk);
  colliders.push({ minX: -0.3, maxX: 0.3, minZ: 5.1, maxZ: 5.5 });

  function update(dt, time) {
    rgb.forEach((m, i) => m.color.setHSL((time * 0.15 + i * 0.12) % 1, 0.85, 0.55).multiplyScalar(1.6));
  }

  return { root, colliders, posters, update };
}

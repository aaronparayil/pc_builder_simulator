import * as THREE from 'three';
import { ROOM } from './room.js';
import { createDisplayObject, createShelfObject } from './parts.js';
import { bakeDisplay } from './bake.js';
import { PARTS, CATEGORIES, CATEGORY_BY_ID } from '../data/catalog.js';

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
      // Seven steps must fit above the footer (canvas is 1200 tall)
      CATEGORIES.forEach((c, i) => {
        ctx.fillStyle = TEAL;
        ctx.font = `700 30px ${MONO}`;
        ctx.fillText(String(i + 1).padStart(2, '0'), x, y + 30);
        ctx.fillStyle = '#e6edf3';
        ctx.font = `600 30px ${SANS}`;
        ctx.fillText(c.label, x + 72, y + 30);
        ctx.fillStyle = '#8b95a7';
        ctx.font = `400 22px ${SANS}`;
        y = wrap(ctx, c.hint, x + 72, y + 58, w - 72, 27) - 2;
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
const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x101217, metalness: 0.3, roughness: 0.5 });
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
  lamp.userData.vrOff = true;
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
    // Each item stands on a small pedestal so the price plaque never hides it
    const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    const width = size.x;
    const pedH = Math.max(0.075, 0.21 - size.y); // short items get a taller stand
    const ped = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.56, width + 0.05), pedH, 0.2), pedestalMat);
    ped.position.set(x, y + pedH / 2, -0.06);
    ped.castShadow = ped.receiveShadow = true;
    g.add(ped);
    obj.position.set(x, y + pedH, -0.06);
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
  bakeDisplay(g, items, items.flatMap((it) => it.userData.rgb || []));
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

// ---------------------------------------------------------------------------
// Parts wall

const WALL_X = -2.8;
/** Top row first: the order you build in. */
const WALL_ROWS = ['motherboard', 'cpu', 'cooler', 'ram', 'storage', 'gpu', 'psu'];
const onStand = (part) => part.category === 'cpu' || (part.category === 'storage' && part.form === 'm2');

function glowTexture(stops) {
  return canvasTexture(8, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function haloTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.12, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(94,234,212,0.55)');
    g.addColorStop(0.6, 'rgba(94,234,212,0.16)');
    g.addColorStop(1, 'rgba(94,234,212,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function drawTag(part) {
  return (ctx, w, h) => {
    ctx.fillStyle = '#0d0f15';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = TEAL;
    ctx.fillRect(0, 0, 6, h);
    ctx.fillStyle = TEAL;
    ctx.textAlign = 'right';
    ctx.font = `700 ${Math.round(h * 0.36)}px ${MONO}`;
    ctx.fillText(`$${part.price}`, w - 16, h * 0.47);
    const priceW = ctx.measureText(`$${part.price}`).width + 30;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e6edf3';
    ctx.font = `600 ${Math.round(h * 0.4)}px ${SANS}`;
    let name = part.name;
    while (ctx.measureText(name).width > w - 30 - priceW && name.length > 4) name = name.slice(0, -2).trimEnd() + '…';
    ctx.fillText(name, 20, h * 0.47);
    ctx.fillStyle = '#8b95a7';
    ctx.font = `500 ${Math.round(h * 0.27)}px ${MONO}`;
    let spec = (part.specs || []).slice(0, 2).join(' · ');
    while (ctx.measureText(spec).width > w - 36 && spec.length > 4) spec = spec.slice(0, -2).trimEnd() + '…';
    ctx.fillText(spec, 20, h * 0.86);
  };
}

function drawHeader(index, category, count) {
  return (ctx, w, h) => {
    ctx.fillStyle = 'rgba(13,15,21,0.9)';
    ctx.beginPath(); ctx.roundRect(0, 0, w, h, 22); ctx.fill();
    ctx.strokeStyle = 'rgba(94,234,212,0.5)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 20); ctx.stroke();
    ctx.fillStyle = TEAL;
    ctx.font = `700 110px ${MONO}`;
    ctx.fillText(String(index + 1).padStart(2, '0'), 30, 128);
    ctx.fillStyle = '#e6edf3';
    const label = CATEGORY_BY_ID[category].label.toUpperCase();
    let size = 58;
    ctx.font = `700 ${size}px ${SANS}`;
    while (ctx.measureText(label).width > w - 60 && size > 30) ctx.font = `700 ${--size}px ${SANS}`;
    ctx.fillText(label, 30, 210);
    ctx.fillStyle = '#8b95a7';
    ctx.font = `500 34px ${MONO}`;
    ctx.fillText(`${count} options`, 30, 262);
  };
}

/**
 * Many small labels drawn into one canvas, so they share a texture and a material
 * (and end up as a single draw call once baked).
 */
function createAtlas(W, H) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true });
  const GAP = 4;
  /** A horizontal band of the canvas (y0..y1 px) that packs labels left to right. */
  const band = (y0, y1) => {
    let x = 0, y = y0, rowH = 0;
    /** Draw a w×h px label into the next free cell; returns a pw×ph m plane mapped to it. */
    return (w, h, pw, ph, draw) => {
      if (x + w > W) { x = 0; y += rowH + GAP; rowH = 0; }
      if (y + h > y1) throw new Error('label atlas band is full');
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
      draw(ctx, w, h);
      ctx.restore();
      const geo = new THREE.PlaneGeometry(pw, ph);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + uv.getX(i) * w) / W, 1 - (y + (1 - uv.getY(i)) * h) / H);
      x += w + GAP;
      rowH = Math.max(rowH, h);
      return geo;
    };
  };
  return { material, band };
}

/**
 * A tall wall unit with one row per category, backlit by LED strips. Built from the
 * bottom up so each row is only as tall as its biggest part (plus room for a hand).
 */
function buildPartsWall(rgb) {
  const group = new THREE.Group();
  const frame = new THREE.Group(); // everything that isn't a part: baked into a few meshes
  const labels = createAtlas(4096, 1024);
  const tagPlane = labels.band(0, 700), headerPlane = labels.band(704, 1024);
  const HEAD = 0.36, AREA = 2.16, SIDE = 0.03, D = 0.44, BOARD = 0.022, PLINTH = 0.09, STAND = 0.026, CAP = 0.14;
  const W = SIDE * 2 + HEAD + AREA;
  const areaMin = -W / 2 + SIDE + HEAD;

  const rows = WALL_ROWS.map((category) => {
    const items = PARTS[category].map((part) => {
      const obj = createShelfObject(part);
      const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
      return { part, obj, lift: onStand(part) ? STAND : 0, size };
    });
    const h = Math.max(0.17, Math.max(...items.map((it) => it.size.y + it.lift)) + 0.09);
    return { category, items, h, y: 0 };
  });
  let y = PLINTH;
  for (const row of [...rows].reverse()) {
    y += BOARD;
    row.y = y; // top of this row's shelf board
    y += row.h;
  }
  const H = y + BOARD + CAP;

  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0e13, metalness: 0.5, roughness: 0.5 });
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x1b1f27, metalness: 0.6, roughness: 0.35 });
  const standMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe9ff, roughness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5eead4).multiplyScalar(1.8), toneMapped: false });
  const add = (geo, mat, x, yy, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, yy, z);
    frame.add(m);
    return m;
  };

  // Carcass: back, sides, the divider for the row headers, plinth and top
  add(new THREE.BoxGeometry(W, H, 0.02), dark, 0, H / 2, -D / 2 + 0.01);
  for (const x of [-W / 2 + SIDE / 2, W / 2 - SIDE / 2]) add(new THREE.BoxGeometry(SIDE, H, D), shelfMat, x, H / 2, 0);
  add(new THREE.BoxGeometry(0.006, H - PLINTH - CAP, 0.006), led, areaMin - 0.003, PLINTH + (H - PLINTH - CAP) / 2, D / 2 - 0.004);
  add(new THREE.BoxGeometry(W, PLINTH, D), dark, 0, PLINTH / 2, 0);
  add(new THREE.BoxGeometry(W, BOARD, D), shelfMat, 0, H - CAP - BOARD / 2, 0);
  add(new THREE.BoxGeometry(W, CAP, D), dark, 0, H - CAP / 2, 0);
  // Vertical LED edges on the front of the sides
  for (const x of [-W / 2 + SIDE / 2, W / 2 - SIDE / 2]) add(new THREE.BoxGeometry(0.006, H - 0.04, 0.006), led, x, H / 2, D / 2 + 0.001);

  // Sign on the top cap
  const sign = add(new THREE.PlaneGeometry(W - 0.1, CAP - 0.03), new THREE.MeshBasicMaterial({
    toneMapped: false,
    map: canvasTexture(1800, 80, (ctx, w, h) => {
      ctx.fillStyle = '#0c0e13'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = TEAL; ctx.font = `700 56px ${SANS}`; ctx.fillText('PARTS WALL', 16, 60);
      ctx.fillStyle = '#8b95a7'; ctx.font = `500 32px ${MONO}`; ctx.textAlign = 'right';
      ctx.fillText('grab a part · carry it to the case · let go when the slot glows', w - 16, 56);
    }),
  }), 0, H - CAP / 2, D / 2 + 0.002);
  sign.raycast = () => {};

  // Backlight per row: a strip along the back of each shelf washing up the back panel
  const wash = glowTexture([[0, 'rgba(94,234,212,0.75)'], [0.35, 'rgba(94,234,212,0.18)'], [1, 'rgba(94,234,212,0)']]);
  const washMat = new THREE.MeshBasicMaterial({ map: wash, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const downMat = new THREE.MeshBasicMaterial({ color: 0xfff4e0, toneMapped: false });

  rows.forEach((row, index) => {
    const { y: top, h, items, category } = row;
    // shelf board with a front lip that carries the price tags
    add(new THREE.BoxGeometry(W - SIDE * 2, BOARD, D - 0.02), shelfMat, 0, top - BOARD / 2, 0);
    add(new THREE.BoxGeometry(W - SIDE * 2, 0.05, 0.014), dark, 0, top - 0.02, D / 2 - 0.007);
    add(new THREE.BoxGeometry(AREA + HEAD, 0.004, 0.004), led, 0, top + 0.003, -D / 2 + 0.024);
    const glow = add(new THREE.PlaneGeometry(AREA + HEAD, h), washMat, 0, top + h / 2, -D / 2 + 0.021);
    glow.raycast = () => {};
    // warm downlight strip under the shelf above, near the front
    add(new THREE.BoxGeometry(AREA - 0.04, 0.003, 0.012), downMat, areaMin + AREA / 2, top + h - 0.002, D / 2 - 0.05);

    // row header
    const hh = Math.min(h - 0.03, (HEAD - 0.04) * 0.75);
    const header = add(headerPlane(400, 300, hh / 0.75, hh, drawHeader(index, category, items.length)), labels.material,
      -W / 2 + SIDE + HEAD / 2, top + h / 2, D / 2 - 0.03);
    header.raycast = () => {};

    const cell = AREA / items.length;
    items.forEach(({ part, obj, lift }, i) => {
      const x = areaMin + cell * (i + 0.5);
      const z = 0.03;
      if (lift) {
        // little acrylic easel
        add(new THREE.BoxGeometry(0.075, lift, 0.07), standMat, x, top + lift / 2, z);
        const back = add(new THREE.BoxGeometry(0.06, 0.06, 0.004), standMat, x, top + lift + 0.026, z - 0.022);
        back.rotation.x = -0.45;
      }
      obj.position.set(x, top + lift, z);
      obj.userData.grab = { partId: part.id, category: part.category };
      obj.userData.interact = { kind: 'part', partId: part.id, category: part.category, label: `Inspect ${part.name}` };
      group.add(obj);
      rgb.push(...(obj.userData.rgb || []));
      const tw = Math.min(cell - 0.03, 0.38);
      const tag = add(tagPlane(Math.round(tw * 2000), 84, tw, 0.042, drawTag(part)), labels.material, x, top - 0.02, D / 2 + 0.0005);
      tag.raycast = () => {};
    });
  });

  // Soft halo on the wall around the unit, and one fill light in front of it
  const halo = add(new THREE.PlaneGeometry(W + 1.4, H + 0.9), new THREE.MeshBasicMaterial({ map: haloTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    0, H / 2, -D / 2 - 0.004);
  halo.raycast = () => {};
  for (const [x, yy] of [[-0.55, 0.72], [0.65, 0.35]]) {
    const fill = new THREE.PointLight(0xe3fbf6, 3.2, 3.2, 2);
    fill.position.set(x, H * yy, D / 2 + 0.75);
    fill.userData.vrOff = true; // the LED wash carries the look in VR
    group.add(fill);
  }
  group.add(frame);
  bakeDisplay(group, rows.flatMap((row) => row.items.map((it) => it.obj)), rgb);

  return { group, size: { W, D, H } };
}

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
  // readable as you walk in from the entrance
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

  // Workbench beacon: a sign over the desk, plus a pulsing floor ring while walking
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.32), new THREE.MeshBasicMaterial({
    toneMapped: false,
    transparent: true,
    map: canvasTexture(1040, 256, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(13,15,21,0.92)';
      ctx.beginPath(); ctx.roundRect(0, 0, w, h, 28); ctx.fill();
      ctx.strokeStyle = TEAL; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.roundRect(3, 3, w - 6, h - 6, 26); ctx.stroke();
      ctx.fillStyle = TEAL; ctx.textAlign = 'center';
      ctx.font = `700 96px ${SANS}`;
      ctx.fillText('WORKBENCH', w / 2, 120);
      ctx.fillStyle = '#c3cad6';
      ctx.font = `500 44px ${MONO}`;
      ctx.fillText('press E here to build', w / 2, 200);
    }),
  }));
  sign.position.set(0, 2.45, -0.55);
  root.add(sign);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5eead4).multiplyScalar(1.4), toneMapped: false, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 64), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.012, 1.05);
  ring.raycast = () => {};
  ring.visible = false;
  root.add(ring);
  const beam = new THREE.PointLight(0x5eead4, 0, 2.2, 2);
  beam.position.set(0, 1.4, 0.9);
  root.add(beam);

  // Parts wall left of the workbench: every component at real size, one row per
  // category in build order, ready to be picked up
  const wall = buildPartsWall(rgb);
  wall.group.position.set(WALL_X, 0, ROOM.minZ + wall.size.D / 2 + 0.01);
  root.add(wall.group);
  colliders.push({ minX: WALL_X - wall.size.W / 2, maxX: WALL_X + wall.size.W / 2, minZ: ROOM.minZ, maxZ: ROOM.minZ + wall.size.D + 0.02 });

  // Comparison kiosk in the middle of the room, facing the bench
  const kiosk = buildKiosk();
  kiosk.position.set(0, 0, 5.3);
  kiosk.rotation.y = Math.PI;
  root.add(kiosk);
  colliders.push({ minX: -0.3, maxX: 0.3, minZ: 5.1, maxZ: 5.5 });

  function update(dt, time) {
    rgb.forEach((m, i) => m.color.setHSL((time * 0.15 + i * 0.12) % 1, 0.85, 0.55).multiplyScalar(1.6));
    if (ring.visible) {
      const k = 0.5 + 0.5 * Math.sin(time * 3);
      ring.scale.setScalar(1 + k * 0.12);
      ringMat.opacity = 0.45 + 0.45 * k;
      beam.intensity = 1.5 + k * 1.5;
    }
  }

  function setBeacon(on) {
    ring.visible = on;
    if (!on) beam.intensity = 0;
  }

  return { root, colliders, posters, update, setBeacon };
}

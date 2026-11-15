import * as THREE from 'three';

// All textures are generated at runtime, so the scene ships with no image files.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

function noise(ctx, w, h, amount, alpha = 0.06) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = alpha;
}

export function floorTexture() {
  const [c, ctx] = canvas(512, 512);
  ctx.fillStyle = '#15171c';
  ctx.fillRect(0, 0, 512, 512);
  noise(ctx, 512, 512, 14);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 512, 512);
  return toTexture(c, { repeat: [10, 10] });
}

export function pegboardTexture() {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#1b1e25';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#0c0d11';
  for (let y = 16; y < 256; y += 32) {
    for (let x = 16; x < 256; x += 32) {
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return toTexture(c, { repeat: [8, 3] });
}

export function woodTexture() {
  const [c, ctx] = canvas(1024, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#3a2a1f');
  g.addColorStop(1, '#2c1f17');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 140; i++) {
    const y = Math.random() * 256;
    ctx.strokeStyle = `rgba(${Math.random() > 0.5 ? '255,220,180' : '0,0,0'},${0.03 + Math.random() * 0.05})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * 4);
    ctx.stroke();
  }
  return toTexture(c);
}

export function deskMatTexture() {
  const [c, ctx] = canvas(1024, 512);
  ctx.fillStyle = '#101218';
  ctx.fillRect(0, 0, 1024, 512);
  ctx.strokeStyle = 'rgba(94, 234, 212, 0.10)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 1024; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
  for (let y = 0; y < 512; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(94, 234, 212, 0.5)';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 1004, 492);
  ctx.fillStyle = 'rgba(94, 234, 212, 0.55)';
  ctx.font = '600 28px "JetBrains Mono", monospace';
  ctx.fillText('ESD SAFE // WORKBENCH 01', 36, 480);
  return toTexture(c);
}

const POSTERS = [
  (ctx, w, h) => {
    // Synthwave sun over a grid
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#120526');
    sky.addColorStop(0.6, '#3b0a4f');
    sky.addColorStop(1, '#0a0315');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const sunY = h * 0.48;
    const sun = ctx.createLinearGradient(0, sunY - 160, 0, sunY + 160);
    sun.addColorStop(0, '#ffd166');
    sun.addColorStop(1, '#ff3d7f');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(w / 2, sunY, 160, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b0a4f';
    for (let i = 0; i < 6; i++) ctx.fillRect(0, sunY + 20 + i * 24, w, 6 + i * 2);
    ctx.fillStyle = '#0a0315';
    ctx.fillRect(0, h * 0.62, w, h);
    ctx.strokeStyle = '#ff3d7f';
    ctx.lineWidth = 2;
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + i * 20, h * 0.62);
      ctx.lineTo(w / 2 + i * 120, h);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const y = h * 0.62 + Math.pow(i / 8, 2) * h * 0.38;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '800 64px "Space Grotesk", sans-serif';
    ctx.fillText('BUILD · BOOT · BENCH', w / 2, 110);
  },
  (ctx, w, h) => {
    // Blueprint of a chip
    ctx.fillStyle = '#0b2a4a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let x = 0; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = '#cfe8ff';
    ctx.lineWidth = 3;
    const s = 280, x0 = (w - s) / 2, y0 = h * 0.22;
    ctx.strokeRect(x0, y0, s, s);
    ctx.strokeRect(x0 + 50, y0 + 50, s - 100, s - 100);
    for (let i = 0; i < 12; i++) {
      const p = x0 + 20 + i * ((s - 40) / 11);
      [[p, y0, p, y0 - 30], [p, y0 + s, p, y0 + s + 30], [x0, p - x0 + y0, x0 - 30, p - x0 + y0], [x0 + s, p - x0 + y0, x0 + s + 30, p - x0 + y0]]
        .forEach(([a, b, c2, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c2, d); ctx.stroke(); });
    }
    ctx.fillStyle = '#cfe8ff';
    ctx.textAlign = 'center';
    ctx.font = '700 54px "Space Grotesk", sans-serif';
    ctx.fillText('SILICON', w / 2, h * 0.86);
    ctx.font = '400 22px "JetBrains Mono", monospace';
    ctx.fillText('FIG. 01 — PACKAGE, TOP VIEW', w / 2, h * 0.92);
  },
  (ctx, w, h) => {
    // Typographic
    ctx.fillStyle = '#e9e4d8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#111';
    ctx.textAlign = 'left';
    ctx.font = '800 92px "Space Grotesk", sans-serif';
    ['CABLE', 'MGMT', 'IS', 'SELF', 'CARE.'].forEach((t, i) => ctx.fillText(t, 48, 150 + i * 100));
    ctx.fillStyle = '#ff5a36';
    ctx.fillRect(48, h - 120, 120, 16);
    ctx.fillStyle = '#111';
    ctx.font = '400 22px "JetBrains Mono", monospace';
    ctx.fillText('zip ties: always', 48, h - 60);
  },
];

export function posterTexture(i) {
  const [c, ctx] = canvas(600, 800);
  POSTERS[i % POSTERS.length](ctx, 600, 800);
  return toTexture(c);
}

export function boxTexture(label, accent) {
  const [c, ctx] = canvas(512, 256);
  ctx.fillStyle = '#a07a52';
  ctx.fillRect(0, 0, 512, 256);
  noise(ctx, 512, 256, 18);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 170, 512, 86);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 170, 18, 86);
  ctx.fillStyle = '#fff';
  ctx.font = '700 48px "Space Grotesk", sans-serif';
  ctx.fillText(label, 36, 228);
  return toTexture(c);
}

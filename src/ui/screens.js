// 2D drawings for the in-world monitor.
import { CATEGORIES } from '../data/catalog.js';
import { RESOLUTIONS } from '../logic/analyze.js';

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const SANS = '"Space Grotesk", system-ui, sans-serif';
const TEAL = '#5eead4';

function bg(ctx, w, h, color = '#06080c') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

export function drawOff(ctx, w, h) {
  bg(ctx, w, h, '#020203');
  ctx.fillStyle = '#16181d';
  ctx.font = `500 22px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText('NO SIGNAL', w - 32, h - 28);
}

export function drawChecklist(ctx, w, h, build, analysis) {
  bg(ctx, w, h);
  ctx.fillStyle = TEAL;
  ctx.font = `700 34px ${SANS}`;
  ctx.fillText('RIG//BUILDER', 48, 70);
  ctx.fillStyle = '#7b8494';
  ctx.font = `400 20px ${MONO}`;
  ctx.fillText('build checklist', 48, 102);
  CATEGORIES.forEach((c, i) => {
    const y = 160 + i * 52;
    const filled = Boolean(build[c.id]) || (c.id === 'cooler' && analysis.parts.coolerIsStock);
    const optional = !analysis.missing.includes(c.id) && !filled;
    ctx.fillStyle = filled ? TEAL : optional ? '#475063' : '#2a2f3a';
    ctx.fillRect(48, y - 22, 26, 26);
    ctx.fillStyle = filled ? '#e6edf3' : '#7b8494';
    ctx.font = `500 24px ${MONO}`;
    ctx.fillText(`${c.short.padEnd(7)} ${filled ? (analysis.parts[c.id]?.name || '') : optional ? '(optional)' : '—'}`, 92, y);
  });
}

export function drawPost(ctx, w, h, lines, progress) {
  bg(ctx, w, h, '#000');
  ctx.fillStyle = '#c9d1d9';
  ctx.font = `400 22px ${MONO}`;
  lines.forEach((l, i) => {
    ctx.fillStyle = l.startsWith('!') ? '#ff4d6d' : l.startsWith('OK') ? TEAL : '#c9d1d9';
    ctx.fillText(l.replace(/^!/, ''), 40, 56 + i * 32);
  });
  if (progress != null) {
    ctx.fillStyle = '#1a1d24';
    ctx.fillRect(40, h - 60, w - 80, 10);
    ctx.fillStyle = TEAL;
    ctx.fillRect(40, h - 60, (w - 80) * progress, 10);
  }
}

export function drawBench(ctx, w, h, analysis) {
  const perf = analysis.perf;
  bg(ctx, w, h);
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, 'rgba(94,234,212,0.10)');
  grad.addColorStop(1, 'rgba(255,61,127,0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = TEAL;
  ctx.font = `700 30px ${SANS}`;
  ctx.fillText('BENCHMARK COMPLETE', 48, 66);
  ctx.fillStyle = '#e6edf3';
  ctx.font = `700 64px ${SANS}`;
  ctx.fillText(perf.rigScore.toLocaleString(), 48, 150);
  ctx.fillStyle = '#7b8494';
  ctx.font = `400 20px ${MONO}`;
  ctx.fillText('RIG SCORE', 48, 180);
  const max = Math.max(160, ...Object.values(perf.fps));
  RESOLUTIONS.forEach((r, i) => {
    const y = 250 + i * 80;
    ctx.fillStyle = '#7b8494';
    ctx.font = `500 22px ${MONO}`;
    ctx.fillText(r.label, 48, y + 28);
    ctx.fillStyle = '#1a1d24';
    ctx.fillRect(160, y, w - 340, 40);
    const v = perf.fps[r.id];
    ctx.fillStyle = v >= 60 ? TEAL : v >= 30 ? '#ffd166' : '#ff4d6d';
    ctx.fillRect(160, y, (w - 340) * Math.min(1, v / max), 40);
    ctx.fillStyle = '#e6edf3';
    ctx.font = `700 30px ${SANS}`;
    ctx.fillText(`${v} FPS`, w - 160, y + 30);
  });
}

export function drawFail(ctx, w, h, analysis) {
  bg(ctx, w, h, '#0a0002');
  ctx.fillStyle = '#ff4d6d';
  ctx.font = `700 40px ${SANS}`;
  ctx.fillText('POST FAILED', 48, 80);
  ctx.font = `400 22px ${MONO}`;
  ctx.fillStyle = '#f0c4cc';
  const items = [...analysis.missing.map((m) => analysis.missingReasons[m]?.title || `Missing: ${CATEGORIES.find((c) => c.id === m).label}`),
    ...analysis.errors.map((e) => e.title)];
  items.slice(0, 9).forEach((t, i) => ctx.fillText(`> ${t}`, 48, 140 + i * 40));
}

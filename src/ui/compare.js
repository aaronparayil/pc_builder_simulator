// Comparison charts for CPUs and GPUs: one small horizontal bar chart per metric.
// Single series per chart, so no legend; the baseline part is emphasised (accent
// bar + bold label + "baseline" tag) and every other bar is a recessive neutral.
import { PARTS } from '../data/catalog.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const METRICS = {
  cpu: [
    { id: 'gaming', label: 'Gaming', note: 'CPU frame-rate ceiling, higher is better', unit: ' fps', get: (p) => p.gaming },
    { id: 'creator', label: 'Multi-core', note: 'Creator score, higher is better', unit: ' pts', get: (p) => p.multi * 25 },
    { id: 'threads', label: 'Threads', note: 'Higher is better for rendering and multitasking', unit: '', get: (p) => p.threads },
    { id: 'watts', label: 'Peak power', note: 'Lower is better: less heat, smaller PSU', unit: ' W', get: (p) => p.watts, lowerIsBetter: true },
    { id: 'price', label: 'Price', note: 'Lower is better', unit: '', prefix: '$', get: (p) => p.price, lowerIsBetter: true },
    { id: 'value', label: 'Value', note: 'Creator points per dollar, higher is better', unit: ' pts/$', get: (p) => (p.multi * 25) / p.price, digits: 1 },
  ],
  gpu: [
    { id: 'fps1080', label: '1080p', note: 'Frames per second, higher is better', unit: ' fps', get: (p) => p.fps1080 },
    { id: 'fps1440', label: '1440p', note: 'Frames per second, higher is better', unit: ' fps', get: (p) => Math.round(p.fps1080 * 0.68) },
    { id: 'fps4k', label: '4K', note: 'Frames per second, higher is better', unit: ' fps', get: (p) => Math.round(p.fps1080 * 0.38) },
    { id: 'vram', label: 'Video memory', note: 'Higher is better for high-res textures', unit: ' GB', get: (p) => p.vram },
    { id: 'watts', label: 'Board power', note: 'Lower is better: less heat, smaller PSU', unit: ' W', get: (p) => p.watts, lowerIsBetter: true },
    { id: 'price', label: 'Price', note: 'Lower is better', unit: '', prefix: '$', get: (p) => p.price, lowerIsBetter: true },
    { id: 'value', label: 'Value', note: '1440p frames per $100, higher is better', unit: ' fps/$100', get: (p) => (p.fps1080 * 0.68 * 100) / p.price, digits: 1 },
  ],
};

const value = (m, p) => `${m.prefix || ''}${fmt(m.get(p), m.digits || 0)}${m.unit}`;

function delta(m, p, base) {
  if (p === base) return '';
  const d = (m.get(p) - m.get(base)) / m.get(base);
  if (Math.abs(d) < 0.005) return 'same';
  return `${d > 0 ? '+' : '−'}${fmt(Math.abs(d) * 100)}%`;
}

function chart(m, parts, base) {
  const max = Math.max(...parts.map((p) => m.get(p)));
  const rows = [...parts].sort((a, b) => m.get(b) - m.get(a));
  return `<section class="cmp-chart">
    <header><h3>${esc(m.label)}</h3><p>${esc(m.note)}</p></header>
    <ol>${rows.map((p) => {
      const isBase = p === base;
      const d = delta(m, p, base);
      const tip = `${p.name}: ${value(m, p)}${d ? ` (${d} vs ${base.name})` : ''}`;
      return `<li class="${isBase ? 'base' : ''}">
        <button type="button" class="cmp-row" data-baseline="${p.id}" data-tip="${esc(tip)}" aria-label="${esc(tip)}. Set as baseline">
          <span class="cmp-name"><span class="n">${esc(p.name)}</span>${isBase ? '<em>baseline</em>' : ''}</span>
          <span class="cmp-track"><i style="--w:${(m.get(p) / max) * 100}%"></i><span class="cmp-val">${esc(value(m, p))}${d && !isBase ? ` <small>${d}</small>` : ''}</span></span>
        </button></li>`;
    }).join('')}</ol>
  </section>`;
}

function table(category, parts, base) {
  const ms = METRICS[category];
  return `<div class="cmp-table-wrap"><table class="cmp-table">
    <thead><tr><th scope="col">${category === 'cpu' ? 'Processor' : 'Graphics card'}</th>${ms.map((m) => `<th scope="col">${esc(m.label)}</th>`).join('')}</tr></thead>
    <tbody>${parts.map((p) => `<tr class="${p === base ? 'base' : ''}"><th scope="row">${esc(p.name)}</th>${ms.map((m) => `<td>${esc(value(m, p))}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

/** Inner HTML of the compare dialog. */
export function renderCompare({ category, baselineId, view, installedId }) {
  const parts = PARTS[category];
  const base = parts.find((p) => p.id === baselineId) || parts.find((p) => p.id === installedId) || parts[0];
  return `<form method="dialog" class="dlg compare">
    <header class="dlg-head"><div><p class="eyebrow mono">Compare</p><h2 id="compare-title">${category === 'cpu' ? 'Processors' : 'Graphics cards'}</h2></div>
      <button class="icon-btn" value="close" aria-label="Close">✕</button></header>
    <div class="cmp-controls">
      <div class="seg" role="tablist" aria-label="Part type">
        <button type="button" role="tab" data-cmp-cat="cpu" aria-selected="${category === 'cpu'}">CPUs</button>
        <button type="button" role="tab" data-cmp-cat="gpu" aria-selected="${category === 'gpu'}">GPUs</button>
      </div>
      <label class="cmp-select">Baseline
        <select data-cmp-baseline>${parts.map((p) => `<option value="${p.id}" ${p === base ? 'selected' : ''}>${esc(p.name)}${p.id === installedId ? ' (in your build)' : ''}</option>`).join('')}</select>
      </label>
      <button type="button" class="btn small ghost" data-cmp-view="${view === 'table' ? 'chart' : 'table'}">${view === 'table' ? 'Show charts' : 'Show as table'}</button>
    </div>
    <p class="muted small cmp-hint">Percentages are relative to the baseline. Click any bar to make that part the baseline.</p>
    ${view === 'table' ? table(category, parts, base) : `<div class="cmp-grid">${METRICS[category].map((m) => chart(m, parts, base)).join('')}</div>`}
    <footer class="dlg-actions">
      ${installedId === base.id ? '' : `<button class="btn accent" value="install:${base.id}">Add ${esc(base.name)} to build</button>`}
      <button class="btn primary" value="close">Done</button>
    </footer>
  </form>`;
}

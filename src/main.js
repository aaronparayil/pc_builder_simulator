import './styles.css';
import { CATEGORIES, CATEGORY_BY_ID, PARTS, getPart } from './data/catalog.js';
import { CHALLENGES, CHALLENGE_BY_ID, scoreChallenge } from './data/challenges.js';
import { analyze, emptyBuild, previewPart, REQUIRES, RESOLUTIONS, encodeBuild, decodeBuild, isRequired } from './logic/analyze.js';
import { createWorkshop } from './three/workshop.js';
import { drawBench, drawChecklist, drawFail, drawOff, drawPost } from './ui/screens.js';
import { sfx, isMuted, setMuted } from './ui/audio.js';
import { ICONS } from './ui/icons.js';
import { renderCompare } from './ui/compare.js';

const $ = (sel, root = document) => root.querySelector(sel);
const money = (n) => `$${n.toLocaleString('en-US')}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

const state = {
  mode: null, // 'free' or a challenge id
  build: emptyBuild(),
  selected: 'motherboard',
  powered: false,
  busy: false,
  stars: store.get('rig.stars', {}),
};

let analysis = analyze(state.build);

// ---------------------------------------------------------------------------
// 3D workshop
const tooltip = $('#tooltip');
const workshop = createWorkshop($('#viewport'), {
  onHover(category, x, y) {
    if (!category) { tooltip.classList.remove('show'); return; }
    const part = analysis.parts[category];
    tooltip.innerHTML = `<span class="eyebrow mono">${esc(CATEGORY_BY_ID[category].label)}</span><strong>${esc(part?.name || '')}</strong>`;
    if (x != null) tooltip.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
    tooltip.classList.add('show');
  },
  onSelect(category) {
    sfx.click();
    selectCategory(category, { focus: true, openSheet: 'parts' });
  },
  onWalkFocus(target) {
    const p = $('#walk-prompt');
    $('#crosshair').classList.toggle('on', Boolean(target));
    if (!target) { p.classList.remove('show'); return; }
    p.innerHTML = `<kbd>E</kbd> ${esc(target.label)}`;
    p.classList.add('show');
  },
  onWalkInteract(target) {
    sfx.click();
    if (target.kind === 'bench') { exitWalk(); sfx.install(); }
    else if (target.kind === 'cabinet') openShowcase(target.category);
    else if (target.kind === 'part') openShowcase(target.category, target.partId);
    else if (target.kind === 'poster') openPoster(target.id);
    else if (target.kind === 'compare') openCompare();
  },
  onWalkLock(locked) {
    $('#app').classList.toggle('walk-locked', locked);
    $('#walk-hint').innerHTML = `${workshop.walker?.dragLook ? '<kbd>Drag</kbd> look · ' : ''}<kbd>WASD</kbd> move · <kbd>Shift</kbd> run · <kbd>E</kbd> interact · <kbd>Esc</kbd> ${workshop.walker?.dragLook ? 'menu' : 'free mouse'}`;
    if (!locked) { $('#walk-prompt').classList.remove('show'); $('#crosshair').classList.remove('on'); }
  },
});

if (import.meta.env.DEV) window.__rig = { state, workshop, openShowcase, openCompare, openPoster, enterWalk, exitWalk, get analysis() { return analysis; } };

// ---------------------------------------------------------------------------
// Rendering

function categoryState(c) {
  const id = state.build[c.id];
  const locked = REQUIRES[c.id].some((r) => !state.build[r]);
  const hasError = analysis.errors.some((e) => e.categories.includes(c.id));
  const hasWarn = analysis.warnings.some((e) => e.categories.includes(c.id));
  const optional = !isRequired(c.id, state.build);
  return { id, locked: !id && locked, hasError, hasWarn, optional };
}

function renderChecklist() {
  const list = $('#checklist');
  list.innerHTML = CATEGORIES.map((c, i) => {
    const s = categoryState(c);
    const part = s.id ? getPart(s.id) : null;
    let sub = 'Empty';
    if (part) sub = part.name;
    else if (c.id === 'cooler' && analysis.parts.coolerIsStock) sub = 'Using stock cooler';
    else if (c.id === 'gpu' && s.optional) sub = 'Optional: integrated graphics';
    else if (s.locked) sub = `Needs ${REQUIRES[c.id].filter((r) => !state.build[r]).map((r) => CATEGORY_BY_ID[r].short).join(' + ')}`;
    const status = s.hasError ? 'error' : s.hasWarn ? 'warn' : part ? 'done' : s.locked ? 'locked' : '';
    const badge = s.hasError ? ICONS.x : s.hasWarn ? ICONS.warn : part ? ICONS.check : s.locked ? ICONS.lock : `<span class="num mono">${i + 1}</span>`;
    return `<li>
      <button class="slot ${status} ${state.selected === c.id ? 'active' : ''}" data-cat="${c.id}" aria-current="${state.selected === c.id}">
        <span class="slot-icon">${ICONS[c.icon]}</span>
        <span class="slot-text"><span class="slot-label">${esc(c.label)}</span><span class="slot-sub">${esc(sub)}</span></span>
        <span class="slot-price mono">${part && part.price ? money(part.price) : ''}</span>
        <span class="slot-badge">${badge}</span>
      </button></li>`;
  }).join('');
  const filled = CATEGORIES.filter((c) => state.build[c.id] || (c.id === 'cooler' && analysis.parts.coolerIsStock) || !isRequired(c.id, state.build)).length;
  $('#build-count').textContent = `${filled}/${CATEGORIES.length}`;
}

function renderIssues() {
  const box = $('#issues');
  const items = [...analysis.errors, ...analysis.warnings];
  box.innerHTML = items.map((i) => `
    <button class="issue ${i.level}" data-cat="${i.categories[0]}">
      <span class="issue-icon">${i.level === 'error' ? ICONS.x : ICONS.warn}</span>
      <span><strong>${esc(i.title)}</strong><span class="issue-detail">${esc(i.detail)}</span></span>
    </button>`).join('');
}

function meter(label, value, max, text, tone = '') {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return `<div class="meter ${tone}">
    <div class="meter-top"><span>${label}</span><span class="mono">${text}</span></div>
    <div class="meter-track"><div class="meter-fill" style="width:${pct}%"></div></div>
  </div>`;
}

function renderMeters() {
  const challenge = CHALLENGE_BY_ID[state.mode];
  const budget = challenge?.budget;
  const { draw, capacity } = analysis.power;
  const html = [];
  if (budget) {
    html.push(meter('Budget', analysis.price, budget, `${money(analysis.price)} / ${money(budget)}`, analysis.price > budget ? 'bad' : analysis.price > budget * 0.9 ? 'warn' : ''));
  } else {
    html.push(meter('Total', analysis.price, 3500, money(analysis.price)));
  }
  const ratio = capacity ? draw / capacity : 0;
  html.push(meter('Power', draw, capacity || draw, capacity ? `${draw} W / ${capacity} W` : `${draw} W, no PSU`, !capacity ? 'muted' : ratio > 1 ? 'bad' : ratio > 0.83 ? 'warn' : ''));
  const perf = analysis.perf;
  html.push(`<div class="perf-row">${RESOLUTIONS.map((r) => `
    <div class="perf-cell"><span class="mono">${perf ? perf.fps[r.id] : '–'}</span><small>${r.label} FPS</small></div>`).join('')}</div>`);
  $('#meters').innerHTML = html.join('');
}

function renderPowerButton() {
  const btn = $('#btn-power');
  btn.classList.toggle('on', state.powered);
  btn.disabled = state.busy;
  $('.label', btn).textContent = state.powered ? 'Shut down' : 'Power on';
  btn.title = state.powered ? 'Shut down (P)' : 'Power on and benchmark (P)';
}

function partMetric(part) {
  const max = (cat, key) => Math.max(...PARTS[cat].map((p) => p[key]));
  if (part.category === 'cpu') {
    return `<div class="bars">
      <div><small>Gaming</small><span class="bar"><i style="width:${(part.gaming / max('cpu', 'gaming')) * 100}%"></i></span></div>
      <div><small>Multi-core</small><span class="bar"><i style="width:${(part.multi / max('cpu', 'multi')) * 100}%"></i></span></div></div>`;
  }
  if (part.category === 'gpu') {
    return `<div class="bars"><div><small>~${part.fps1080} FPS 1080p</small><span class="bar"><i style="width:${(part.fps1080 / max('gpu', 'fps1080')) * 100}%"></i></span></div></div>`;
  }
  return '';
}

function renderCatalog() {
  const cat = CATEGORY_BY_ID[state.selected];
  const idx = CATEGORIES.indexOf(cat);
  $('#cat-step').textContent = `Step ${idx + 1} of ${CATEGORIES.length}`;
  $('#cat-title').textContent = cat.label;
  $('#cat-hint').textContent = cat.hint;
  const s = categoryState(cat);
  const notes = [];
  if (s.locked) {
    const need = REQUIRES[cat.id].filter((r) => !state.build[r]);
    notes.push(`<div class="note locked">${ICONS.lock}<span>Install the <button class="link" data-cat="${need[0]}">${esc(CATEGORY_BY_ID[need[0]].label.toLowerCase())}</button> first.</span></div>`);
  }
  if (cat.id === 'cooler' && analysis.parts.cpu?.stockCooler) notes.push(`<div class="note">${ICONS.check}<span>Your ${esc(analysis.parts.cpu.name)} includes a stock cooler, so this step is optional.</span></div>`);
  if (cat.id === 'gpu' && analysis.parts.cpu?.igpu) notes.push(`<div class="note">${ICONS.check}<span>Your CPU has integrated graphics (${esc(analysis.parts.cpu.igpu.name)}). A GPU is optional, but needed for real gaming.</span></div>`);
  if (cat.id === 'cpu' || cat.id === 'gpu') notes.push(`<button class="btn small ghost compare-link" data-compare="${cat.id}">${ICONS.chart} Compare ${cat.id === 'cpu' ? 'processors' : 'graphics cards'} side by side</button>`);
  $('#cat-note').innerHTML = notes.join('');

  $('#cat-list').innerHTML = PARTS[cat.id].map((part) => {
    const installed = state.build[cat.id] === part.id;
    const { errors, warnings } = previewPart(part, state.build);
    let status = `<span class="status ok">${ICONS.check} Compatible</span>`;
    if (errors.length) status = `<span class="status error">${ICONS.x} ${esc(errors[0].title)}</span>`;
    else if (warnings.length) status = `<span class="status warn">${ICONS.warn} ${esc(warnings[0].title)}</span>`;
    const needsAny = REQUIRES[cat.id].some((r) => !state.build[r]);
    if (needsAny) status = `<span class="status muted">${ICONS.lock} Needs ${esc(REQUIRES[cat.id].filter((r) => !state.build[r]).map((r) => CATEGORY_BY_ID[r].short).join(' + '))}</span>`;
    const delta = state.build[cat.id] && !installed ? part.price - getPart(state.build[cat.id]).price : null;
    return `<article class="part-card ${installed ? 'installed' : ''} ${errors.length && !needsAny ? 'bad' : ''}" role="listitem" draggable="${!installed && !needsAny}" data-part="${part.id}">
      <div class="part-top">
        <h3>${esc(part.name)}</h3>
        <span class="price mono">${money(part.price)}${delta != null ? `<small class="${delta > 0 ? 'up' : 'down'}">${delta > 0 ? '+' : '−'}${money(Math.abs(delta))}</small>` : ''}</span>
      </div>
      <ul class="chips">${part.specs.map((s2) => `<li>${esc(s2)}</li>`).join('')}</ul>
      ${partMetric(part)}
      <div class="part-bottom">
        ${status}
        ${installed
          ? `<button class="btn small ghost" data-remove="${cat.id}">Remove</button>`
          : `<button class="btn small ${errors.length ? 'ghost' : 'accent'}" data-install="${part.id}" ${needsAny ? 'disabled' : ''}>${state.build[cat.id] ? 'Swap' : 'Install'}</button>`}
      </div>
    </article>`;
  }).join('');
}

function renderMode() {
  const pill = $('#mode-pill');
  const ch = CHALLENGE_BY_ID[state.mode];
  pill.hidden = !state.mode;
  pill.innerHTML = ch ? `<span class="eyebrow mono">Challenge</span> ${esc(ch.title)}${ch.budget ? ` <span class="mono muted">· ${money(ch.budget)}</span>` : ''}` : '<span class="eyebrow mono">Mode</span> Free build';
  pill.title = ch ? ch.brief : 'No budget, no rules. Just build.';
}

function renderMonitor() {
  if (state.powered) return;
  if (workshop.installedCount === 0) workshop.monitor.draw(drawOff);
  else workshop.monitor.draw((ctx, w, h) => drawChecklist(ctx, w, h, state.build, analysis));
}

function render() {
  analysis = analyze(state.build);
  renderChecklist();
  renderIssues();
  renderMeters();
  renderCatalog();
  renderPowerButton();
  renderMode();
  renderMonitor();
  workshop.showSlot(state.powered ? null : state.selected);
  store.set('rig.session', { mode: state.mode, build: state.build });
}

// ---------------------------------------------------------------------------
// Actions

let toastTimer = 0;
function toast(msg, tone = '') {
  const t = $('#toast');
  t.className = `show ${tone}`;
  // Keep text in one flex item (a leading icon stays separate) so inline badges don't split lines
  t.innerHTML = msg.startsWith('<svg') ? msg.replace('</svg>', '</svg><span>') + '</span>' : `<span>${msg}</span>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 3200);
}

function setSheet(name) {
  const app = $('#app');
  app.dataset.sheet = app.dataset.sheet === name ? '' : name || '';
  document.querySelectorAll('#mobile-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.sheet === app.dataset.sheet));
}

/** Sync the 3D case, showing the boxed cooler when the CPU ships with one. */
function syncCase(animate = true) {
  const cpu = state.build.cpu ? getPart(state.build.cpu) : null;
  const cooler = state.build.cooler || (cpu?.stockCooler ? 'stock' : null);
  workshop.sync({ ...state.build, cooler }, animate);
}

function selectCategory(category, { focus = false, openSheet = null } = {}) {
  state.selected = category;
  render();
  if (focus && !state.powered && !walking()) workshop.focusCategory(category);
  if (openSheet && window.matchMedia('(max-width: 860px)').matches) {
    $('#app').dataset.sheet = '';
    setSheet(openSheet);
  }
  $('#cat-list').scrollTop = 0;
}

function nextCategory(after) {
  const start = CATEGORIES.findIndex((c) => c.id === after);
  for (let i = 1; i <= CATEGORIES.length; i++) {
    const c = CATEGORIES[(start + i) % CATEGORIES.length];
    if (!state.build[c.id] && isRequired(c.id, state.build) && !REQUIRES[c.id].some((r) => !state.build[r])) return c.id;
  }
  return null;
}

async function ensureOff() {
  if (state.powered) await powerOff(true);
}

async function installPart(partId) {
  const part = getPart(partId);
  if (!part || state.busy) return;
  const need = REQUIRES[part.category].filter((r) => !state.build[r]);
  if (need.length) {
    sfx.error();
    toast(`Install the <strong>${esc(CATEGORY_BY_ID[need[0]].label.toLowerCase())}</strong> first.`, 'bad');
    workshop.flash([need[0]], 0xffd166);
    return;
  }
  await ensureOff();
  const wasEmpty = !state.build[part.category];
  state.build[part.category] = part.id;
  syncCase();
  sfx.install();
  const { errors } = previewPart(part, state.build);
  if (errors.length) {
    toast(`${ICONS.x} ${esc(errors[0].title)}`, 'bad');
    setTimeout(() => workshop.flash(errors[0].categories), 750);
  }
  const next = wasEmpty && !errors.length ? nextCategory(part.category) : null;
  if (next) {
    state.selected = next;
    render();
    setTimeout(() => { if (state.selected === next && !state.busy && !walking()) workshop.focusCategory(next); }, 900);
  } else {
    render();
  }
  checkFirstComplete();
}

async function removePart(category) {
  if (state.busy || !state.build[category]) return;
  await ensureOff();
  const removed = [category];
  state.build[category] = null;
  // Anything mounted on this part comes out with it.
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of CATEGORIES) {
      if (state.build[c.id] && REQUIRES[c.id].some((r) => !state.build[r])) {
        state.build[c.id] = null;
        removed.push(c.id);
        changed = true;
      }
    }
  }
  syncCase();
  sfx.remove();
  if (removed.length > 1) toast(`Removed ${removed.map((c) => CATEGORY_BY_ID[c].short).join(', ')}. Those parts were mounted on it.`);
  state.selected = category;
  render();
}

async function clearBuild() {
  if (state.busy) return;
  await ensureOff();
  state.build = emptyBuild();
  syncCase();
  sfx.remove();
  state.selected = 'motherboard';
  render();
  workshop.view('home');
}

let completeHinted = false;
function checkFirstComplete() {
  if (!completeHinted && analysis.missing.length === 0) {
    completeHinted = true;
    setTimeout(() => toast(`Every slot is filled. Hit <strong>Power on</strong> to boot and benchmark.`), 900);
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function powerOn() {
  if (state.busy) return;
  state.busy = true;
  render();
  workshop.showSlot(null);
  if (window.matchMedia('(max-width: 860px)').matches) setSheet('');
  await Promise.all([workshop.setGlass(true), workshop.view('front', 1.2)]);

  const a = analysis;
  const lines = ['RIG BIOS v2.6  (c) Rig Builder', ''];
  const post = (l) => { lines.push(l); workshop.monitor.draw((ctx, w, h) => drawPost(ctx, w, h, lines, null)); };
  workshop.monitor.glow.intensity = 0.4;
  sfx.beep();
  post('POST: checking hardware...');
  await wait(450);

  if (!a.parts.psu) {
    post('!No power. There is no PSU installed.');
    await wait(400);
    return postFailed(a);
  }
  const steps = [
    ['motherboard', () => `Board .......... ${a.parts.motherboard.name}`],
    ['cpu', () => `CPU ............ ${a.parts.cpu.name} (${a.parts.cpu.cores} cores)`],
    ['cooler', () => `Cooling ........ ${a.parts.cooler.name}`],
    ['ram', () => `Memory ......... ${a.parts.ram.gb} GB ${a.parts.ram.type}`],
    ['gpu', () => `Graphics ....... ${a.perf ? a.perf.graphics : a.parts.gpu?.name}`],
    ['storage', () => `Boot drive ..... ${a.parts.storage.name}`],
  ];
  let failed = false;
  for (const [cat, describe] of steps) {
    const err = a.errors.find((e) => e.categories[0] === cat) || a.errors.find((e) => e.categories.includes(cat));
    const missing = a.missing.includes(cat);
    if (missing || err) {
      post(`!${missing ? a.missingReasons[cat]?.title || `${CATEGORY_BY_ID[cat].label} not detected` : err.title}`);
      failed = true;
      break;
    }
    if (cat === 'cooler' && !a.parts.cooler) continue;
    if (cat === 'gpu' && !a.perf) continue;
    post(`OK  ${describe()}`);
    sfx.click();
    await wait(260);
  }
  if (!failed && a.errors.length) { post(`!${a.errors[0].title}`); failed = true; }
  if (failed) { await wait(400); return postFailed(a); }

  // Boot!
  state.powered = true;
  workshop.setPowered(true);
  sfx.fanHum(true);
  post('');
  post('All checks passed. Booting...');
  for (let p = 0; p <= 1; p += 0.05) {
    workshop.monitor.draw((ctx, w, h) => drawPost(ctx, w, h, lines, p));
    await wait(55);
  }
  sfx.chime();
  workshop.monitor.draw((ctx, w, h) => drawBench(ctx, w, h, a));
  workshop.monitor.glow.intensity = 0.8;
  state.busy = false;
  render();
  await wait(500);
  showResults(a);
}

async function postFailed(a) {
  sfx.error();
  [0, 0.25, 0.5].forEach((d) => sfx.beep(0.4 + d));
  workshop.monitor.draw((ctx, w, h) => drawFail(ctx, w, h, a));
  workshop.flash([...a.missing, ...a.errors.flatMap((e) => e.categories)]);
  state.busy = false;
  render();
  await wait(700);
  showResults(a);
}

async function powerOff(silent = false) {
  state.powered = false;
  workshop.setPowered(false);
  sfx.fanHum(false);
  workshop.monitor.glow.intensity = 0;
  if (!silent) await workshop.setGlass(false, 0.7);
  else workshop.setGlass(false, 0.5);
  render();
}

// ---------------------------------------------------------------------------
// Dialogs

function starsHtml(n, total = 3, cls = '') {
  return `<span class="stars ${cls}" aria-label="${n} of ${total} stars">${Array.from({ length: total }, (_, i) => `<span class="${i < n ? 'on' : ''}">${ICONS.star}</span>`).join('')}</span>`;
}

function showResults(a) {
  const dlg = $('#result-dialog');
  const ch = CHALLENGE_BY_ID[state.mode];
  let challengeHtml = '';
  let nextChallenge = null;
  if (ch) {
    const sc = scoreChallenge(ch, a);
    const prev = state.stars[ch.id] || 0;
    if (sc.stars > prev) { state.stars[ch.id] = sc.stars; store.set('rig.stars', state.stars); }
    const idx = CHALLENGES.indexOf(ch);
    if (sc.passed && CHALLENGES[idx + 1]) nextChallenge = CHALLENGES[idx + 1];
    challengeHtml = `<section class="challenge-result ${sc.passed ? 'pass' : 'fail'}">
      <div class="cr-head"><div><p class="eyebrow mono">${esc(ch.title)}</p><h3>${sc.passed ? 'Challenge complete' : 'Not quite yet'}</h3></div>${starsHtml(sc.stars, 3, 'big animate')}</div>
      <ul class="goals">${ch.goals.map((g, i) => `<li class="${sc.met[i] ? 'met' : ''}">${sc.met[i] ? ICONS.check : ICONS.x}<span>${esc(g.label)}</span></li>`).join('')}</ul>
    </section>`;
    if (sc.stars) for (let i = 0; i < sc.stars; i++) setTimeout(() => sfx.star(i), 350);
  }

  if (!a.canBoot) {
    const problems = [
      ...a.missing.map((m) => ({
        cat: m,
        title: a.missingReasons[m]?.title || `No ${CATEGORY_BY_ID[m].label.toLowerCase()} installed`,
        detail: a.missingReasons[m]?.detail || CATEGORY_BY_ID[m].hint,
      })),
      ...a.errors.map((e) => ({ cat: e.categories[0], title: e.title, detail: e.detail })),
    ];
    dlg.innerHTML = `<form method="dialog" class="dlg">
      <header class="dlg-head fail"><div><p class="eyebrow mono">POST failed · ${problems.length} problem${problems.length > 1 ? 's' : ''}</p><h2 id="result-title">It won't boot</h2></div>
      <button class="icon-btn" value="close" aria-label="Close">${ICONS.x}</button></header>
      <ul class="problems">${problems.map((p) => `<li><div><strong>${esc(p.title)}</strong><p>${esc(p.detail)}</p></div><button class="btn small accent" value="fix:${p.cat}">Fix</button></li>`).join('')}</ul>
      ${challengeHtml}
      <footer class="dlg-actions"><button class="btn ghost" value="close">Back to the bench</button></footer>
    </form>`;
  } else {
    const p = a.perf;
    const max = Math.max(160, ...Object.values(p.fps));
    dlg.innerHTML = `<form method="dialog" class="dlg">
      <header class="dlg-head ok"><div><p class="eyebrow mono">Booted in ${p.bootSeconds} s · ${money(a.price)}</p><h2 id="result-title">It's alive!</h2></div>
      <button class="icon-btn" value="close" aria-label="Close">${ICONS.x}</button></header>
      <div class="score-row">
        <div class="score"><span class="mono">${p.rigScore.toLocaleString()}</span><small>Rig score</small></div>
        <div class="score"><span class="mono">${p.creator.toLocaleString()}</span><small>Creator score</small></div>
        <div class="score"><span class="mono">${a.power.draw} W</span><small>of ${a.power.capacity} W</small></div>
      </div>
      <div class="fps-bars">${RESOLUTIONS.map((r) => {
        const v = p.fps[r.id];
        return `<div class="fps"><span class="mono">${r.label}</span><span class="track"><i class="${v >= 60 ? 'good' : v >= 30 ? 'ok' : 'bad'}" style="--w:${(v / max) * 100}%"></i></span><strong class="mono">${v} FPS</strong></div>`;
      }).join('')}</div>
      <p class="muted small">${p.bottleneck === 'cpu' ? 'At 1080p the CPU is the limit. A faster processor would raise frame rates.' : 'The graphics card sets your frame rate, which is what you want in a gaming build.'} Estimates come from a simplified model, not real benchmarks.</p>
      ${a.warnings.length ? `<ul class="warns">${a.warnings.map((w) => `<li>${ICONS.warn}<span><strong>${esc(w.title)}</strong> ${esc(w.detail)}</span></li>`).join('')}</ul>` : ''}
      ${challengeHtml}
      <footer class="dlg-actions">
        <button class="btn ghost" value="share">${ICONS.share} Share build</button>
        ${ch ? '<button class="btn ghost" value="menu">All challenges</button>' : ''}
        ${nextChallenge ? `<button class="btn primary" value="challenge:${nextChallenge.id}">Next: ${esc(nextChallenge.title)}</button>` : '<button class="btn primary" value="close">Keep tweaking</button>'}
      </footer>
    </form>`;
  }
  dlg.showModal();
  requestAnimationFrame(() => dlg.querySelectorAll('.track i').forEach((i) => i.classList.add('in')));
}

$('#result-dialog').addEventListener('close', (e) => {
  const v = e.target.returnValue || '';
  e.target.returnValue = '';
  if (v.startsWith('fix:')) {
    const cat = v.slice(4);
    powerOff();
    selectCategory(cat, { focus: true, openSheet: 'parts' });
  } else if (v === 'share') {
    share();
  } else if (v === 'menu') {
    openStart();
  } else if (v.startsWith('challenge:')) {
    startMode(v.slice(10), { fresh: true });
  } else if (!state.powered) {
    workshop.setGlass(false, 0.7);
  }
});

function openStart() {
  const dlg = $('#start-dialog');
  const session = store.get('rig.session', null);
  const hasSession = session && Object.values(session.build || {}).some(Boolean);
  const total = Object.values(state.stars).reduce((s, n) => s + n, 0);
  dlg.innerHTML = `<form method="dialog" class="dlg start">
    <header class="hero">
      <p class="eyebrow mono">3D PC building simulator</p>
      <h1 id="start-title">RIG<span>//</span>BUILDER</h1>
      <p class="lede">Pick real-world parts, install them in a 3D case, catch compatibility mistakes before they cost you, then power on and benchmark what you built.</p>
      <div class="hero-actions">
        ${hasSession && state.mode === null ? '<button class="btn primary" value="continue">Continue last build</button>' : ''}
        ${state.mode !== null ? '<button class="btn primary" value="close">Back to the bench</button>' : ''}
        <button class="btn ${hasSession || state.mode !== null ? 'ghost' : 'primary'}" value="free">Free build</button>
        <button class="btn ghost" value="help">How to play</button>
      </div>
    </header>
    <section>
      <div class="section-head"><h2>Challenges</h2><span class="mono muted">${starsHtml(1, 1)} ${total} / ${CHALLENGES.length * 3}</span></div>
      <div class="challenge-grid">${CHALLENGES.map((c, i) => `
        <button class="challenge-card" value="challenge:${c.id}">
          <span class="cc-top"><span class="mono muted">${String(i + 1).padStart(2, '0')}</span><span class="tag mono">${esc(c.tag)}</span></span>
          <strong>${esc(c.title)}</strong>
          <span class="muted">${esc(c.brief)}</span>
          ${starsHtml(state.stars[c.id] || 0)}
        </button>`).join('')}
      </div>
    </section>
  </form>`;
  showDialog(dlg);
}

$('#start-dialog').addEventListener('close', (e) => {
  const v = e.target.returnValue || '';
  e.target.returnValue = '';
  sfx.unlock();
  if (v === 'continue') {
    const s = store.get('rig.session', null);
    startMode(s.mode || 'free', { build: decodeBuild(encodeBuild(s.build || {})), walk: true });
  } else if (v === 'free') startMode('free', { fresh: true, walk: true });
  else if (v === 'help') { openHelp(true); }
  else if (v.startsWith('challenge:')) startMode(v.slice(10), { fresh: true, walk: true });
  else if (state.mode === null) startMode('free', { fresh: true, walk: true });
});

function startMode(mode, { fresh = false, build = null, walk = false } = {}) {
  exitWalk({ toBench: false });
  const prevMode = state.mode;
  state.mode = mode;
  if (state.powered) powerOff(true);
  if (fresh || build) {
    state.build = build || emptyBuild();
    syncCase(prevMode !== null);
  }
  completeHinted = false;
  state.selected = nextCategory('psu') || 'motherboard';
  render();
  const ch = CHALLENGE_BY_ID[mode];
  if (walk && canWalk() && workshop.walker) {
    enterWalk({ fromEntrance: true });
    toast(ch ? `<strong>${esc(ch.title)}:</strong> ${esc(ch.brief)} Head to the glowing workbench to start.`
      : 'Look around the showroom, then walk to the glowing workbench and press <kbd>E</kbd> to start building.');
    return;
  }
  workshop.view('home', 1.4).then(() => {
    if (!state.build.motherboard) workshop.focusCategory('motherboard');
  });
  if (ch) toast(`<strong>${esc(ch.title)}:</strong> ${esc(ch.brief)}`);
}

function openHelp(fromStart = false) {
  const dlg = $('#help-dialog');
  dlg.innerHTML = `<form method="dialog" class="dlg help">
    <header class="dlg-head"><div><p class="eyebrow mono">Field manual</p><h2 id="help-title">How to play</h2></div>
    <button class="icon-btn" value="close" aria-label="Close">${ICONS.x}</button></header>
    <ol class="steps">
      <li><strong>Pick a part.</strong> The checklist on the left walks you through each step. The catalog on the right shows every option, its price, and whether it works with what you already installed.</li>
      <li><strong>Install it.</strong> Click <em>Install</em> or drag a card onto the 3D case. Parts mount in order: the board first, then the CPU, then its cooler.</li>
      <li><strong>Watch the warnings.</strong> Socket mismatches, wrong memory type, a weak PSU or an under-rated cooler are all flagged before you boot.</li>
      <li><strong>Compare before you buy.</strong> The CPU and GPU steps have side-by-side charts for gaming, multi-core, power, price and value.</li>
      <li><strong>Power on.</strong> The PC runs a POST check. If it passes you get benchmark estimates. In challenge mode, you earn stars.</li>
    </ol>
    <div class="keys">
      <div><kbd>Drag</kbd> orbit camera</div><div><kbd>Right-drag</kbd> pan</div><div><kbd>Scroll</kbd> zoom</div>
      <div><kbd>Click part</kbd> select it</div><div><kbd>1</kbd>–<kbd>7</kbd> jump to step</div><div><kbd>P</kbd> power</div>
      <div><kbd>R</kbd> reset camera</div><div><kbd>C</kbd> compare parts</div><div><kbd>M</kbd> mute</div>
    </div>
    <h3 class="help-sub">Walking the showroom</h3>
    <p class="muted small">Press <kbd>F</kbd> or <em>Walk around</em> to leave the bench and explore. Display cases hold every GPU, CPU, memory kit and drive; posters on the walls explain the rules; the kiosk opens the comparison charts.</p>
    <div class="keys">
      <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</div><div><kbd>Mouse</kbd> look</div><div><kbd>Shift</kbd> run</div>
      <div><kbd>E</kbd> interact</div><div><kbd>Esc</kbd> free the mouse</div><div><kbd>E</kbd> at the desk: back to bench</div>
    </div>
    <details class="credits"><summary>Credits</summary>
      <p>Built with <a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> and Vite. The room, case, coolers, memory, power supply, drives, textures and sounds are all generated in code.</p>
      <p>3D models used under CC BY 4.0:</p>
      <ul>
        <li>CPU: "3D PBR Quantum GenX3 Processor" by <a href="https://sketchfab.com/mustafaozgen" target="_blank" rel="noopener">Mustafa Özgen</a></li>
        <li>GPU: "RTX 3080ti Graphics Card 3d Model" by <a href="https://sketchfab.com/arhamabdullahanimates" target="_blank" rel="noopener">Arham Abdullah</a></li>
        <li>Motherboard: "motherbard" by <a href="https://sketchfab.com/armanen07" target="_blank" rel="noopener">emperorsAmar</a></li>
        <li>M.2 SSD: "m2ssd_Painter" by <a href="https://sketchfab.com/Igor.Jop" target="_blank" rel="noopener">Igor.Jop</a></li>      </ul>
      <p>Part names belong to their manufacturers. Prices and performance figures are illustrative.</p>
    </details>
    <footer class="dlg-actions"><button class="btn primary" value="${fromStart ? 'start' : 'close'}">${fromStart ? 'Back' : 'Got it'}</button></footer>
  </form>`;
  showDialog(dlg);
}

$('#help-dialog').addEventListener('close', (e) => {
  if (e.target.returnValue === 'start') openStart();
  else if (state.mode === null) openStart();
  e.target.returnValue = '';
});

async function share() {
  const url = `${location.origin}${location.pathname}#build=${encodeBuild(state.build)}${state.mode && state.mode !== 'free' ? `&mode=${state.mode}` : ''}`;
  try {
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title: 'My Rig Builder PC', url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast(`${ICONS.check} Link copied. Anyone who opens it gets this exact build.`);
  } catch {
    window.prompt('Copy this link to share your build:', url);
  }
}

// ---------------------------------------------------------------------------
// Walk-around showroom

const walking = () => Boolean(workshop.walker?.active);

/** Sessions start at the showroom entrance; the bench is a walk away. */
const ENTRANCE = { position: [2.4, 1.6, 7.4], lookAt: [0, 1.2, 0] };
const canWalk = () => window.matchMedia('(pointer: fine)').matches;

function enterWalk({ fromEntrance = false } = {}) {
  if (!workshop.walker || walking() || state.busy) return;
  if (state.powered) powerOff(true);
  workshop.showSlot(null);
  tooltip.classList.remove('show');
  $('#app').classList.add('walking');
  setSheet('');
  workshop.walker.enter(fromEntrance ? {
    position: new workshop.camera.position.constructor(...ENTRANCE.position),
    lookAt: new workshop.camera.position.constructor(...ENTRANCE.lookAt),
  } : undefined);
  workshop.showroom?.setBeacon(true);
  renderWalkButton();
  sfx.click();
}

function exitWalk({ toBench = true } = {}) {
  if (!walking()) return;
  workshop.walker.exit();
  workshop.showroom?.setBeacon(false);
  $('#app').classList.remove('walking', 'walk-locked');
  renderWalkButton();
  render();
  if (toBench) {
    // Arrive at the bench: frame the case, then the next part to install
    workshop.view('home', 1.2).then(() => {
      if (!walking() && !state.powered && !state.busy) workshop.focusCategory(state.selected);
    });
  }
}

function renderWalkButton() {
  const b = $('#btn-walk');
  b.innerHTML = walking() ? `${ICONS.bench}<span>Back to bench</span>` : `${ICONS.walk}<span>Walk around</span>`;
  b.title = walking() ? 'Return to the workbench' : 'Explore the showroom on foot (WASD + mouse)';
}

/** Open a dialog, releasing the mouse first if we're walking. */
function showDialog(dlg) {
  workshop.walker?.unlock();
  if (!dlg.open) dlg.showModal();
}

function openShowcase(category, focusId = null) {
  const dlg = $('#showcase-dialog');
  const cat = CATEGORY_BY_ID[category];
  const titles = { gpu: 'Graphics cards', cpu: 'Processors', ram: 'Memory', storage: 'Storage' };
  dlg.innerHTML = `<form method="dialog" class="dlg showcase">
    <header class="dlg-head"><div><p class="eyebrow mono">Display case</p><h2 id="showcase-title">${esc(titles[category] || cat.label)}</h2></div>
      <button class="icon-btn" value="close" aria-label="Close">${ICONS.x}</button></header>
    <p class="muted">${esc(cat.hint)}</p>
    <div class="showcase-grid">${PARTS[category].map((part) => {
      const installed = state.build[category] === part.id;
      const { errors, warnings } = previewPart(part, state.build);
      const needs = REQUIRES[category].filter((r) => !state.build[r]);
      let status = `<span class="status ok">${ICONS.check} Fits your build</span>`;
      if (needs.length) status = `<span class="status muted">${ICONS.lock} Needs ${esc(needs.map((r) => CATEGORY_BY_ID[r].short).join(' + '))} first</span>`;
      else if (errors.length) status = `<span class="status error">${ICONS.x} ${esc(errors[0].title)}</span>`;
      else if (warnings.length) status = `<span class="status warn">${ICONS.warn} ${esc(warnings[0].title)}</span>`;
      return `<article class="part-card ${installed ? 'installed' : ''} ${part.id === focusId ? 'focus' : ''}" data-showcase-part="${part.id}">
        <div class="part-top"><h3>${esc(part.name)}</h3><span class="price mono">${money(part.price)}</span></div>
        <ul class="chips">${part.specs.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
        ${partMetric(part)}
        <div class="part-bottom">${status}
          ${installed ? '<span class="status ok">In your build</span>' : `<button class="btn small accent" value="install:${part.id}" ${needs.length ? 'disabled' : ''}>Add to build</button>`}
        </div>
      </article>`;
    }).join('')}</div>
    <footer class="dlg-actions">
      ${category === 'cpu' || category === 'gpu' ? `<button class="btn ghost" value="compare:${category}">${ICONS.chart} Compare ${category === 'cpu' ? 'CPUs' : 'GPUs'}</button>` : ''}
      <button class="btn primary" value="close">Keep exploring</button>
    </footer>
  </form>`;
  showDialog(dlg);
  dlg.querySelector('.focus')?.scrollIntoView({ block: 'nearest' });
}

$('#showcase-dialog').addEventListener('close', (e) => {
  const v = e.target.returnValue || '';
  e.target.returnValue = '';
  if (v.startsWith('install:')) {
    const part = getPart(v.slice(8));
    installPart(part.id).then(() => toast(`${ICONS.check} <strong>${esc(part.name)}</strong> added to the build on your workbench.`));
  } else if (v.startsWith('compare:')) openCompare(v.slice(8));
});

function openPoster(id) {
  const poster = workshop.showroom?.posters.get(id);
  if (!poster) return;
  const dlg = $('#poster-dialog');
  dlg.innerHTML = `<form method="dialog" class="dlg poster">
    <header class="dlg-head"><div><p class="eyebrow mono">${esc(poster.eyebrow)}</p><h2 id="poster-title">${esc(poster.title)}</h2></div>
      <button class="icon-btn" value="close" aria-label="Close">${ICONS.x}</button></header>
    <img src="${poster.canvas.toDataURL('image/png')}" alt="${esc(`${poster.title}. ${poster.intro}`)}" />
  </form>`;
  showDialog(dlg);
}

const compareState = { category: 'gpu', baseline: null, view: 'chart' };

function renderCompareDialog() {
  const c = compareState.category;
  $('#compare-dialog').innerHTML = renderCompare({ category: c, baselineId: compareState.baseline, view: compareState.view, installedId: state.build[c] });
}

function openCompare(category = null) {
  compareState.category = category || compareState.category;
  compareState.baseline = null;
  renderCompareDialog();
  showDialog($('#compare-dialog'));
}

const compareDlg = $('#compare-dialog');
compareDlg.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.cmpCat) { compareState.category = t.dataset.cmpCat; compareState.baseline = null; renderCompareDialog(); sfx.click(); }
  else if (t.dataset.cmpView) { compareState.view = t.dataset.cmpView; renderCompareDialog(); }
  else if (t.dataset.baseline) {
    compareState.baseline = t.dataset.baseline;
    renderCompareDialog();
    sfx.click();
    compareDlg.querySelector(`[data-baseline="${t.dataset.baseline}"]`)?.focus();
  }
});
compareDlg.addEventListener('change', (e) => {
  if (e.target.matches('[data-cmp-baseline]')) { compareState.baseline = e.target.value; renderCompareDialog(); }
});
const chartTip = (e) => {
  const row = e.target.closest?.('.cmp-row');
  if (!row) { tooltip.classList.remove('show'); return; }
  tooltip.innerHTML = `<strong>${esc(row.dataset.tip)}</strong><span class="muted small">Click to set as baseline</span>`;
  tooltip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
  tooltip.classList.add('show');
};
compareDlg.addEventListener('pointermove', chartTip);
compareDlg.addEventListener('pointerleave', () => tooltip.classList.remove('show'));
compareDlg.addEventListener('close', (e) => {
  tooltip.classList.remove('show');
  const v = e.target.returnValue || '';
  e.target.returnValue = '';
  if (v.startsWith('install:')) {
    const part = getPart(v.slice(8));
    installPart(part.id);
    if (!walking()) selectCategory(part.category);
  }
});

$('#walk-overlay').addEventListener('click', (e) => {
  if (e.target.closest('[data-exit-walk]')) { exitWalk(); return; }
  workshop.walker?.lock();
});

// ---------------------------------------------------------------------------
// Events

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.compare && !t.closest('dialog')) { openCompare(t.dataset.compare); return; }
  if (t.dataset.install) { installPart(t.dataset.install); return; }
  if (t.dataset.remove) { removePart(t.dataset.remove); return; }
  if (t.dataset.cat && !t.closest('dialog')) {
    sfx.click();
    selectCategory(t.dataset.cat, { focus: true, openSheet: t.closest('#build-panel') ? 'parts' : null });
    return;
  }
  if (t.dataset.sheet) setSheet(t.dataset.sheet);
});

$('#btn-power').addEventListener('click', () => (state.powered ? powerOff() : powerOn()));
$('#btn-share').addEventListener('click', share);
$('#btn-clear').addEventListener('click', () => {
  if (Object.values(state.build).some(Boolean) && window.confirm('Remove every part from the case?')) clearBuild();
});
$('#btn-view').addEventListener('click', () => { if (!walking()) workshop.view('home'); });
$('#btn-walk').addEventListener('click', () => (walking() ? exitWalk() : enterWalk()));
$('#btn-compare').addEventListener('click', () => openCompare(state.selected === 'cpu' ? 'cpu' : null));
$('#btn-compare').innerHTML = ICONS.chart;
$('#btn-help').addEventListener('click', () => openHelp());
$('#btn-home').addEventListener('click', openStart);
$('#btn-sound').addEventListener('click', () => { setMuted(!isMuted()); renderSoundButton(); });

function renderSoundButton() {
  $('#btn-sound').innerHTML = isMuted() ? ICONS.mute : ICONS.sound;
  $('#btn-sound').setAttribute('aria-pressed', String(!isMuted()));
}

$('#btn-view').innerHTML = ICONS.view;
$('#btn-help').innerHTML = ICONS.help;
$('#btn-power .ico').innerHTML = ICONS.power;
$('#btn-share').innerHTML = `${ICONS.share} Share`;
$('#btn-clear').innerHTML = `${ICONS.trash} Clear`;
renderSoundButton();
renderWalkButton();

// Drag a catalog card onto the 3D view to install it.
const viewport = $('#viewport');
document.addEventListener('dragstart', (e) => {
  const card = e.target.closest?.('.part-card');
  if (!card) return;
  e.dataTransfer.setData('text/plain', card.dataset.part);
  e.dataTransfer.effectAllowed = 'copy';
  $('#app').classList.add('dragging');
});
document.addEventListener('dragend', () => $('#app').classList.remove('dragging'));
viewport.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
viewport.addEventListener('drop', (e) => {
  e.preventDefault();
  $('#app').classList.remove('dragging');
  const id = e.dataTransfer.getData('text/plain');
  if (id) installPart(id);
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select') || document.querySelector('dialog[open]') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'c' || e.key === 'C') { openCompare(); return; }
  if (walking()) {
    if (e.key === 'm' || e.key === 'M') $('#btn-sound').click();
    else if (e.key === 'Escape' && !workshop.walker.locked) exitWalk();
    return;
  }
  if (e.key === 'f' || e.key === 'F') { enterWalk(); return; }
  const n = Number(e.key);
  if (n >= 1 && n <= CATEGORIES.length) selectCategory(CATEGORIES[n - 1].id, { focus: true });
  else if (e.key === 'p' || e.key === 'P') $('#btn-power').click();
  else if (e.key === 'r' || e.key === 'R') workshop.view('home');
  else if (e.key === 'm' || e.key === 'M') $('#btn-sound').click();
  else if (e.key === '?') openHelp();
});

// Optional WebXR viewing mode
if (navigator.xr?.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
    if (!ok) return;
    const btn = document.createElement('button');
    btn.className = 'icon-btn';
    btn.title = 'View in VR';
    btn.setAttribute('aria-label', 'View in VR');
    btn.innerHTML = ICONS.vr;
    $('#vr-slot').append(btn);
    const r = workshop.renderer;
    btn.addEventListener('click', async () => {
      if (r.xr.isPresenting) { r.xr.getSession().end(); return; }
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      await r.xr.setSession(session);
      const base = r.xr.getReferenceSpace();
      r.xr.setReferenceSpace(base.getOffsetReferenceSpace(new XRRigidTransform({ x: 0.1, y: 0, z: -1.0 })));
    });
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Boot

(async function init() {
  const fill = $('#loader-fill');
  await workshop.preload((p) => { fill.style.width = `${Math.round(p * 100)}%`; });
  $('#loader-text').textContent = 'Ready';
  $('#loader').classList.add('done');

  if (!loadFromHash()) {
    render();
    openStart();
  }
  window.addEventListener('hashchange', loadFromHash);
})();

function loadFromHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  if (!params.has('build')) return false;
  const mode = CHALLENGE_BY_ID[params.get('mode')] ? params.get('mode') : 'free';
  history.replaceState(null, '', location.pathname + location.search);
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  startMode(mode, { build: decodeBuild(params.get('build')) });
  toast('Loaded a shared build. Power it on to see how it does.');
  return true;
}

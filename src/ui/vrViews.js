// What the in-headset panel shows. Each view draws onto the panel canvas with the
// helpers from vrPanel.js and registers button ids; handle() routes button presses.
import { CATEGORIES, CATEGORY_BY_ID, PARTS, getPart } from '../data/catalog.js';
import { previewPart, REQUIRES, RESOLUTIONS, isRequired } from '../logic/analyze.js';
import { METRICS } from './compare.js';
import { VR_COLORS as C, VR_MONO } from '../three/vrPanel.js';

const money = (n) => `$${n.toLocaleString('en-US')}`;

export function createVRUI(panel, hooks) {
  const ui = {
    view: 'help',
    category: 'motherboard',
    highlight: null,
    cmpCat: 'gpu',
    metric: 0,
    baseline: null,
    posterId: null,
    result: null,
  };

  // --- shared bits -------------------------------------------------------------
  function header(p, eyebrow, title, eyebrowColor = C.accent) {
    p.frame();
    p.text(eyebrow.toUpperCase(), 40, 62, { size: 22, weight: 600, color: eyebrowColor, font: VR_MONO });
    p.text(title, 40, 112, { size: 46, weight: 700 });
    p.button('close', p.w - 130, 30, 94, 64, '✕', { size: 30 });
  }

  function slotState(cat) {
    const build = hooks.getBuild();
    const a = hooks.getAnalysis();
    const id = build[cat.id];
    const locked = !id && REQUIRES[cat.id].some((r) => !build[r]);
    const error = a.errors.some((e) => e.categories.includes(cat.id));
    const warn = a.warnings.some((e) => e.categories.includes(cat.id));
    let sub = id ? getPart(id).name : 'Empty';
    if (!id && cat.id === 'cooler' && a.parts.coolerIsStock) sub = 'Using stock cooler';
    else if (!id && !isRequired(cat.id, build)) sub = 'Optional';
    else if (locked) sub = `Needs ${REQUIRES[cat.id].filter((r) => !build[r]).map((r) => CATEGORY_BY_ID[r].short).join(' + ')}`;
    const dot = error ? C.bad : warn ? C.warn : id || sub === 'Using stock cooler' ? C.accent : locked ? '#3a404c' : C.muted;
    return { id, locked, sub, dot };
  }

  // --- views ---------------------------------------------------------------------
  const views = {
    help(p) {
      header(p, 'VR controls', 'Welcome to the showroom');
      const rows = [
        ['Left stick', 'Walk'],
        ['Right stick', 'Snap turn left or right'],
        ['Trigger', 'Select, or teleport to where you point on the floor'],
        ['Grip', 'Grab a part (reach out, or point and squeeze)'],
        ['A B X Y', 'Open or close the build menu'],
      ];
      rows.forEach(([k, v], i) => {
        const y = 170 + i * 86;
        p.rect(40, y, 1120, 76, C.raise);
        p.text(k, 70, y + 48, { size: 30, weight: 700, color: C.accent });
        p.text(v, 340, y + 48, { size: 28 });
      });
      p.para('Grab parts from the parts wall left of the workbench, then fit them into the open case: the slot glows green when you can let go. Pull the trigger on posters to read them, or on the challenge board to start a challenge.', 40, 640, 1120, { size: 25 });
      p.button('open:build', 40, 760, 360, 90, 'Open build menu', { variant: 'primary', size: 30 });
      p.button('close', 420, 760, 220, 90, 'Got it', { size: 30 });
    },

    build(p) {
      const build = hooks.getBuild();
      const a = hooks.getAnalysis();
      const mode = hooks.getMode();
      header(p, mode ? mode.label : 'Workbench', 'Your build');
      // categories
      CATEGORIES.forEach((cat, i) => {
        const s = slotState(cat);
        const y = 140 + i * 88;
        p.button(`cat:${cat.id}`, 36, y, 360, 80, cat.label, { variant: 'row', active: ui.category === cat.id, size: 27, sub: s.sub });
        p.ctx.fillStyle = s.dot;
        p.ctx.beginPath();
        p.ctx.arc(36 + 360 - 26, y + 40, 9, 0, Math.PI * 2);
        p.ctx.fill();
      });
      // parts in the selected category
      const cat = CATEGORY_BY_ID[ui.category];
      const x = 424, w = 740;
      p.text(cat.label, x, 176, { size: 36, weight: 700 });
      p.para(cat.hint, x, 214, w, { size: 22 });
      const needs = REQUIRES[cat.id].filter((r) => !build[r]);
      PARTS[cat.id].forEach((part, i) => {
        const y = 262 + i * 86;
        const installed = build[cat.id] === part.id;
        const { errors, warnings } = previewPart(part, build);
        if (part.id === ui.highlight || installed) {
          p.rect(x, y, w, 78, installed ? 'rgba(94,234,212,0.10)' : 'rgba(255,209,102,0.10)');
        } else p.rect(x, y, w, 78, C.raise);
        p.text(part.name, x + 20, y + 34, { size: 27, weight: 700, max: w - 330 });
        p.text(money(part.price), x + w - 210, y + 34, { size: 26, weight: 700, color: C.warn, align: 'right' });
        let status = 'Compatible', color = C.accent;
        if (needs.length) { status = `Needs ${needs.map((r) => CATEGORY_BY_ID[r].short).join(' + ')}`; color = C.muted; }
        else if (errors.length) { status = errors[0].title; color = C.bad; }
        else if (warnings.length) { status = warnings[0].title; color = C.warn; }
        p.text(`${part.specs.slice(0, 3).join(' · ')}`, x + 20, y + 66, { size: 19, color: C.muted, font: VR_MONO, max: 300 });
        p.text(status, x + w - 210, y + 66, { size: 20, color, align: 'right', max: 300 });
        if (installed) p.button(`remove:${cat.id}`, x + w - 190, y + 12, 172, 56, 'Remove', { variant: 'danger', size: 24, disabled: hooks.isBusy() });
        else p.button(`install:${part.id}`, x + w - 190, y + 12, 172, 56, build[cat.id] ? 'Swap' : 'Install', { variant: errors.length ? 'ghost' : 'primary', size: 24, disabled: needs.length > 0 || hooks.isBusy() });
      });
      // footer
      const y = 790;
      p.rect(36, y, 1128, 1, C.line);
      const budget = mode?.budget;
      const issues = a.errors.length + a.missing.length;
      p.text(a.canBoot ? 'Ready to boot' : issues ? `${a.missing.length} missing · ${a.errors.length} problem${a.errors.length === 1 ? '' : 's'}` : 'Keep building', 40, y + 42, { size: 24, weight: 600, color: a.canBoot ? C.accent : a.errors.length ? C.bad : C.muted });
      const perf = a.perf ? `${a.perf.fps['1080p']} fps @1080p` : 'no FPS yet';
      p.text(`${money(a.price)}${budget ? ` / ${money(budget)}` : ''} · ${a.power.draw} W${a.power.capacity ? ` / ${a.power.capacity} W` : ''} · ${perf}`, 40, y + 80, { size: 22, color: C.muted, font: VR_MONO, max: 640 });
      if (cat.id === 'cpu' || cat.id === 'gpu') p.button('open:compare', 700, y + 18, 200, 72, 'Compare', { size: 26 });
      const powered = hooks.isPowered();
      p.button('power', 920, y + 18, 244, 72, powered ? 'Shut down' : 'Power on', { variant: powered ? 'danger' : 'primary', size: 28, disabled: hooks.isBusy() });
    },

    challenges(p) {
      const { list, active } = hooks.getChallenges();
      const total = list.reduce((n, c) => n + c.stars, 0);
      header(p, `Challenge board · ★ ${total} / ${list.length * 3}`, 'Pick a challenge');
      list.forEach((c, i) => {
        const y = 140 + i * 104;
        const on = c.id === active;
        p.rect(40, y, 1120, 92, on ? 'rgba(94,234,212,0.12)' : C.raise);
        p.text(String(i + 1).padStart(2, '0'), 66, y + 56, { size: 28, weight: 700, color: C.accent, font: VR_MONO });
        p.text(c.title, 130, y + 42, { size: 30, weight: 700, max: 520 });
        p.text(c.brief, 130, y + 76, { size: 19, color: C.muted, max: 620 });
        p.text('★'.repeat(c.stars) + '☆'.repeat(3 - c.stars), 790, y + 58, { size: 34, color: c.stars ? C.warn : '#3a404c' });
        p.button(`challenge:${c.id}`, 960, y + 14, 180, 64, on ? 'Restart' : 'Start', { variant: on ? 'ghost' : 'primary', size: 26 });
      });
      p.button('challenge:free', 40, 784, 280, 80, 'Free build', { size: 28 });
      p.button('open:compare', 340, 784, 300, 80, 'Compare parts', { size: 28 });
      p.button('close', 660, 784, 200, 80, 'Close', { size: 28 });
    },

    compare(p) {
      const parts = PARTS[ui.cmpCat];
      const metrics = METRICS[ui.cmpCat];
      const m = metrics[((ui.metric % metrics.length) + metrics.length) % metrics.length];
      const build = hooks.getBuild();
      const base = parts.find((x) => x.id === ui.baseline) || parts.find((x) => x.id === build[ui.cmpCat]) || parts[0];
      header(p, 'Compare', ui.cmpCat === 'cpu' ? 'Processors' : 'Graphics cards');
      p.button('cmp:cpu', 640, 40, 140, 60, 'CPUs', { variant: 'tab', active: ui.cmpCat === 'cpu' });
      p.button('cmp:gpu', 790, 40, 140, 60, 'GPUs', { variant: 'tab', active: ui.cmpCat === 'gpu' });
      p.button('metric:-1', 40, 140, 80, 64, '◀', { size: 30 });
      p.text(m.label, 300, 184, { size: 34, weight: 700, align: 'center', max: 340 });
      p.button('metric:1', 480, 140, 80, 64, '▶', { size: 30 });
      p.text(m.note, 590, 182, { size: 22, color: C.muted, max: 570 });
      const max = Math.max(...parts.map((x) => m.get(x)));
      const fmt = (v) => `${m.prefix || ''}${v.toLocaleString('en-US', { maximumFractionDigits: m.digits || 0 })}${m.unit}`;
      [...parts].sort((a, b) => m.get(b) - m.get(a)).forEach((part, i) => {
        const y = 236 + i * 88;
        const isBase = part === base;
        p.button(`base:${part.id}`, 36, y, 1128, 80, '', { variant: 'row', active: isBase });
        p.text(part.name, 60, y + 50, { size: 26, weight: isBase ? 700 : 500, color: isBase ? C.text : C.muted, max: 330 });
        const bw = Math.max(6, (m.get(part) / max) * 520);
        p.ctx.fillStyle = isBase ? C.bar : C.barMuted;
        p.ctx.beginPath();
        p.ctx.roundRect(410, y + 28, bw, 24, [0, 4, 4, 0]);
        p.ctx.fill();
        const d = isBase ? 'baseline' : (() => {
          const r = (m.get(part) - m.get(base)) / m.get(base);
          return Math.abs(r) < 0.005 ? 'same' : `${r > 0 ? '+' : '−'}${Math.round(Math.abs(r) * 100)}%`;
        })();
        p.text(fmt(m.get(part)), 410 + bw + 14, y + 49, { size: 24, weight: 600 });
        p.text(d, 1140, y + 49, { size: 20, color: C.muted, align: 'right' });
      });
      p.text('Point at a row and pull the trigger to make it the baseline.', 40, 850, { size: 22, color: C.muted });
      p.button('open:build', 900, 800, 264, 72, 'Back to build', { size: 26 });
    },

    poster(p) {
      const poster = hooks.getPoster(ui.posterId);
      p.frame();
      if (poster) {
        const h = 820, w = h * (poster.canvas.width / poster.canvas.height);
        p.ctx.drawImage(poster.canvas, 40, 40, w, h);
        p.text(poster.eyebrow.toUpperCase(), 700, 120, { size: 22, weight: 600, color: C.accent, font: VR_MONO });
        p.text(poster.title, 700, 172, { size: 44, weight: 700, max: 460 });
        p.para(poster.intro, 700, 230, 460, { size: 24 });
      }
      p.button('close', 700, 770, 200, 80, 'Close', { size: 28 });
      p.button('open:build', 920, 770, 244, 80, 'Build menu', { size: 28 });
    },

    result(p) {
      const a = ui.result || hooks.getAnalysis();
      header(p, a.canBoot ? `Booted in ${a.perf.bootSeconds} s · ${money(a.price)}` : 'POST failed', a.canBoot ? "It's alive!" : "It won't boot", a.canBoot ? C.accent : C.bad);
      let y = 160;
      if (a.canBoot) {
        p.text(`${a.perf.rigScore.toLocaleString()} rig score · ${a.perf.creator.toLocaleString()} creator · ${a.power.draw} W of ${a.power.capacity} W`, 40, y + 20, { size: 26, font: VR_MONO, color: C.muted });
        const max = Math.max(160, ...Object.values(a.perf.fps));
        RESOLUTIONS.forEach((r, i) => {
          const yy = y + 70 + i * 70;
          const v = a.perf.fps[r.id];
          p.text(r.label, 40, yy + 30, { size: 26, color: C.muted, font: VR_MONO });
          p.rect(160, yy + 8, 760, 30, C.raise, 6);
          p.ctx.fillStyle = v >= 60 ? C.bar : v >= 30 ? C.warn : C.bad;
          p.ctx.beginPath();
          p.ctx.roundRect(160, yy + 8, Math.max(8, (v / max) * 760), 30, [0, 6, 6, 0]);
          p.ctx.fill();
          p.text(`${v} FPS`, 940, yy + 33, { size: 30, weight: 700 });
        });
        y += 300;
        a.warnings.slice(0, 3).forEach((wn) => { p.text(`⚠ ${wn.title}`, 40, y + 30, { size: 24, color: C.warn, max: 1100 }); y += 40; });
      } else {
        const problems = [
          ...a.missing.map((m) => ({ cat: m, title: a.missingReasons[m]?.title || `No ${CATEGORY_BY_ID[m].label.toLowerCase()} installed` })),
          ...a.errors.map((e) => ({ cat: e.categories[0], title: e.title })),
        ].slice(0, 5);
        problems.forEach((pr, i) => {
          const yy = y + i * 90;
          p.rect(40, yy, 1120, 76, 'rgba(255,77,109,0.10)');
          p.text(pr.title, 70, yy + 48, { size: 27, weight: 600, max: 820 });
          p.button(`fix:${pr.cat}`, 980, yy + 10, 160, 56, 'Fix', { variant: 'primary', size: 26 });
        });
      }
      const ch = hooks.challengeSummary?.(a);
      if (ch) p.text(`${ch.title}: ${ch.passed ? 'complete' : 'not yet'}  ${'★'.repeat(ch.stars)}${'☆'.repeat(3 - ch.stars)}`, 40, 740, { size: 30, weight: 700, color: ch.passed ? C.accent : C.muted });
      p.button('open:build', 40, 780, 300, 80, 'Back to build', { variant: 'primary', size: 28 });
      p.button('close', 360, 780, 200, 80, 'Close', { size: 28 });
    },
  };

  function show() {
    panel.show((p) => views[ui.view](p));
  }

  function open(view, params = {}) {
    Object.assign(ui, params, { view });
    if (view === 'build' && params.category === undefined && params.highlight === undefined) ui.highlight = null;
    hooks.onOpen?.();
    show();
  }

  function handle(id) {
    if (!id) return;
    hooks.click?.();
    const [cmd, arg] = id.split(':');
    if (cmd === 'close') panel.hide();
    else if (cmd === 'open') open(arg);
    else if (cmd === 'cat') { ui.category = arg; ui.highlight = null; panel.refresh(); }
    else if (cmd === 'install') hooks.install(arg);
    else if (cmd === 'remove') hooks.remove(arg);
    else if (cmd === 'power') hooks.power();
    else if (cmd === 'cmp') { ui.cmpCat = arg; ui.baseline = null; panel.refresh(); }
    else if (cmd === 'metric') { ui.metric += Number(arg); panel.refresh(); }
    else if (cmd === 'base') { ui.baseline = arg; panel.refresh(); }
    else if (cmd === 'fix') open('build', { category: arg, highlight: null });
    else if (cmd === 'challenge') { hooks.startChallenge(arg); open('build', { category: 'motherboard', highlight: null }); }
  }

  return {
    state: ui,
    open,
    handle,
    refresh: () => panel.refresh(),
    showResult(a) { open('result', { result: a }); },
  };
}

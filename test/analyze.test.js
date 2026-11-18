import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, emptyBuild, encodeBuild, decodeBuild, previewPart } from '../src/logic/analyze.js';
import { CHALLENGES, scoreChallenge } from '../src/data/challenges.js';
import { PARTS, getPart } from '../src/data/catalog.js';
import { GPU_LOOKS, BOARD_LOOKS, RAM_LOOKS } from '../src/data/looks.js';

const build = (parts) => ({ ...emptyBuild(), ...parts });

const budgetGamer = build({
  motherboard: 'b550', cpu: 'r5-5600', ram: 'd4-16', storage: 'nvme3-1t', gpu: 'rx7600', psu: 'psu450',
});

test('an empty build is missing every required part and cannot boot', () => {
  const r = analyze(emptyBuild());
  assert.equal(r.canBoot, false);
  assert.deepEqual(r.missing, ['motherboard', 'cpu', 'cooler', 'ram', 'storage', 'gpu', 'psu']);
  assert.equal(r.price, 0);
});

test('a CPU with a stock cooler does not need a separate cooler', () => {
  const r = analyze(budgetGamer);
  assert.equal(r.parts.coolerIsStock, true);
  assert.ok(!r.missing.includes('cooler'));
  assert.equal(r.canBoot, true);
});

test('socket mismatch is an error', () => {
  const r = analyze({ ...budgetGamer, motherboard: 'b650' });
  assert.ok(r.errors.some((e) => e.categories.includes('cpu') && /socket/i.test(e.title)));
  assert.equal(r.canBoot, false);
});

test('DDR5 memory on a DDR4 board is an error', () => {
  const r = analyze({ ...budgetGamer, ram: 'd5-32' });
  assert.ok(r.errors.some((e) => e.categories.includes('ram')));
});

test('a CPU without integrated graphics needs a GPU', () => {
  const r = analyze({ ...budgetGamer, gpu: null });
  assert.equal(r.missingReasons.gpu.title, 'No display output');
  assert.ok(r.missing.includes('gpu'));
  assert.equal(r.canBoot, false);
  // ...but it is a pending requirement while building, not a conflict
  assert.equal(r.errors.length, 0);
});

test('a CPU with integrated graphics can boot without a GPU', () => {
  const r = analyze(build({ motherboard: 'b760-d4', cpu: 'i5-12400', ram: 'd4-16', storage: 'nvme3-1t', psu: 'psu450' }));
  assert.equal(r.canBoot, true);
  assert.match(r.perf.graphics, /integrated/);
});

test('cooler without the right bracket is an error', () => {
  const r = analyze(build({ motherboard: 'b650', cpu: 'r7-7800x3d', cooler: 'lowpro', ram: 'd5-32', storage: 'nvme3-1t', gpu: 'rtx4060', psu: 'psu650' }));
  assert.ok(r.errors.some((e) => e.categories.includes('cooler')));
});

test('under-rated cooler is a warning and lowers performance', () => {
  const base = build({ motherboard: 'z790', cpu: 'i9-14900k', ram: 'd5-32', storage: 'nvme4-2t', gpu: 'rtx4090', psu: 'psu1000' });
  const weak = analyze({ ...base, cooler: 'tower1' });
  const strong = analyze({ ...base, cooler: 'aio240' });
  assert.ok(weak.warnings.some((w) => /throttle/.test(w.title)));
  assert.ok(weak.perf.creator < strong.perf.creator);
});

test('an overloaded PSU is an error, a tight one is a warning', () => {
  const big = build({ motherboard: 'z790', cpu: 'i9-14900k', cooler: 'aio240', ram: 'd5-32', storage: 'nvme4-2t', gpu: 'rtx4090' });
  assert.ok(analyze({ ...big, psu: 'psu650' }).errors.some((e) => e.categories.includes('psu')));
  assert.ok(analyze({ ...big, psu: 'psu850' }).warnings.some((e) => e.categories.includes('psu')));
  assert.equal(analyze({ ...big, psu: 'psu1000' }).issues.filter((i) => i.categories.includes('psu')).length, 0);
});

test('fps never exceeds what the CPU or GPU can deliver', () => {
  const r = analyze(budgetGamer);
  assert.ok(r.perf.fps['1080p'] <= getPart('rx7600').fps1080);
  assert.ok(r.perf.fps['1080p'] >= r.perf.fps['1440p']);
  assert.ok(r.perf.fps['1440p'] >= r.perf.fps['4K']);
});

test('previewPart flags only issues involving that part', () => {
  const { errors } = previewPart(getPart('b650'), { ...budgetGamer, motherboard: null });
  assert.ok(errors.length > 0);
  assert.ok(errors.every((e) => e.categories.includes('motherboard')));
});

test('builds survive a share-link round trip and junk is ignored', () => {
  assert.deepEqual(decodeBuild(encodeBuild(budgetGamer)), budgetGamer);
  assert.deepEqual(decodeBuild('cpu:not-a-part,gpu:b550,motherboard:b550'), build({ motherboard: 'b550' }));
});

test('every catalog part has a unique id, price and specs', () => {
  const ids = new Set();
  for (const list of Object.values(PARTS)) {
    for (const p of list) {
      assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
      ids.add(p.id);
      assert.ok(p.price > 0 && p.specs.length > 0, p.id);
    }
  }
});

// Brute-force the catalog: every challenge must be beatable with 3 stars.
test('every challenge has a three-star solution', () => {
  const opts = (cat, optional = false) => [...(optional ? [null] : []), ...PARTS[cat].map((p) => p.id)];
  const best = Object.fromEntries(CHALLENGES.map((c) => [c.id, 0]));
  for (const motherboard of opts('motherboard')) for (const cpu of opts('cpu')) {
    if (getPart(cpu).socket !== getPart(motherboard).socket) continue;
    for (const cooler of opts('cooler', true)) for (const ram of opts('ram')) {
      if (getPart(ram).type !== getPart(motherboard).ramType) continue;
      for (const storage of opts('storage')) for (const gpu of opts('gpu', true)) for (const psu of opts('psu')) {
        const r = analyze(build({ motherboard, cpu, cooler, ram, storage, gpu, psu }));
        if (!r.canBoot) continue;
        for (const c of CHALLENGES) best[c.id] = Math.max(best[c.id], scoreChallenge(c, r).stars);
      }
    }
  }
  for (const c of CHALLENGES) assert.equal(best[c.id], 3, `${c.title} best is ${best[c.id]} stars`);
});

test('every GPU, motherboard and memory kit has its own 3D look', () => {
  for (const p of PARTS.gpu) assert.ok(GPU_LOOKS[p.id], `no model for ${p.id}`);
  for (const p of PARTS.motherboard) {
    assert.ok(BOARD_LOOKS[p.id], `no model for ${p.id}`);
    assert.equal(BOARD_LOOKS[p.id].socket, p.socket, `${p.id} model has the wrong socket`);
  }
  for (const p of PARTS.ram) assert.ok(RAM_LOOKS[p.id], `no model for ${p.id}`);
  // GPU spec chips quote the same length the model is built to
  for (const p of PARTS.gpu) assert.ok(p.specs.includes(`${Math.round(GPU_LOOKS[p.id].length * 1000)} mm`), p.id);
});

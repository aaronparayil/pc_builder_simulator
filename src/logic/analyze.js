import { CATEGORIES, STOCK_COOLER, getPart } from '../data/catalog.js';

export const RESOLUTIONS = [
  { id: '1080p', label: '1080p', scale: 1 },
  { id: '1440p', label: '1440p', scale: 0.68 },
  { id: '4K', label: '4K', scale: 0.38 },
];

// Parts that physically mount on the motherboard (or need its headers).
export const REQUIRES = {
  cpu: ['motherboard'],
  cooler: ['motherboard', 'cpu'],
  ram: ['motherboard'],
  storage: ['motherboard'],
  gpu: ['motherboard'],
  motherboard: [],
  psu: [],
};

export function emptyBuild() {
  return Object.fromEntries(CATEGORIES.map((c) => [c.id, null]));
}

/** Resolve ids to part objects, including the implied stock cooler. */
export function resolveParts(build) {
  const parts = {};
  for (const c of CATEGORIES) parts[c.id] = build[c.id] ? getPart(build[c.id]) : null;
  parts.coolerIsStock = false;
  if (!parts.cooler && parts.cpu?.stockCooler) {
    parts.cooler = STOCK_COOLER;
    parts.coolerIsStock = true;
  }
  return parts;
}

/** Whether a category must be filled for the PC to boot, given current parts. */
export function isRequired(categoryId, build) {
  const cpu = build.cpu ? getPart(build.cpu) : null;
  if (categoryId === 'cooler') return !(cpu && cpu.stockCooler);
  if (categoryId === 'gpu') return !(cpu && cpu.igpu);
  return true;
}

export function powerDraw(parts) {
  let w = 35 + 8; // board + case fans
  if (parts.cpu) w += parts.cpu.watts;
  if (parts.gpu) w += parts.gpu.watts;
  if (parts.ram) w += 8;
  if (parts.storage) w += parts.storage.form === 'hdd' ? 8 : 5;
  if (parts.cooler) w += parts.cooler.style === 'aio' ? 12 : 4;
  return w;
}

export function analyze(build) {
  const parts = resolveParts(build);
  const { motherboard: mb, cpu, cooler, ram, storage, gpu, psu } = parts;
  const issues = [];
  const add = (level, categories, title, detail) => issues.push({ level, categories, title, detail });

  if (cpu && mb && cpu.socket !== mb.socket) {
    add('error', ['cpu', 'motherboard'], 'CPU does not fit the socket',
      `${cpu.name} uses ${cpu.socket}, but the ${mb.name} has an ${mb.socket} socket.`);
  }
  if (ram && mb && ram.type !== mb.ramType) {
    add('error', ['ram', 'motherboard'], `${ram.type} memory in a ${mb.ramType} board`,
      `DDR4 and DDR5 sticks are keyed differently. The ${mb.name} only accepts ${mb.ramType}.`);
  } else if (ram && mb && ram.speed > mb.maxRamSpeed) {
    add('warn', ['ram', 'motherboard'], 'Memory will run slower than rated',
      `The board tops out at ${mb.maxRamSpeed} MT/s, so this kit runs below its ${ram.speed} MT/s rating.`);
  }
  if (cooler && cpu && !parts.coolerIsStock && !cooler.sockets.includes(cpu.socket)) {
    add('error', ['cooler', 'cpu'], 'Cooler cannot mount on this CPU',
      `The ${cooler.name} has no ${cpu.socket} bracket (supports ${cooler.sockets.join(', ')}).`);
  }
  if (cooler && cpu && cooler.tdpRating < cpu.watts) {
    add('warn', ['cooler', 'cpu'], 'CPU will thermal-throttle',
      `${cpu.name} pulls up to ${cpu.watts} W, but the ${parts.coolerIsStock ? 'stock cooler' : cooler.name} is rated for ${cooler.tdpRating} W. Expect about 12% lower performance.`);
  }
  // Empty-but-required slots are not conflicts, but some deserve a specific explanation.
  const missingReasons = {};
  if (cpu && !cooler) {
    missingReasons.cooler = { title: 'No CPU cooler', detail: `${cpu.name} does not ship with a cooler. Without one it overheats within seconds.` };
  }
  if (cpu && !gpu && !cpu.igpu) {
    missingReasons.gpu = { title: 'No display output', detail: `${cpu.name} has no integrated graphics, so it needs a graphics card to show anything on screen.` };
  }

  const draw = powerDraw(parts);
  if (psu) {
    if (psu.watts < draw) {
      add('error', ['psu'], 'Power supply overloaded',
        `The system draws about ${draw} W at full load, more than the ${psu.watts} W PSU can deliver.`);
    } else if (psu.watts < draw * 1.2) {
      add('warn', ['psu'], 'Very little power headroom',
        `~${draw} W load on a ${psu.watts} W unit. Aim for ${Math.ceil((draw * 1.3) / 50) * 50} W or more for stability and quieter fans.`);
    }
  }

  const missing = CATEGORIES.filter((c) => !build[c.id] && isRequired(c.id, build)
    && !(c.id === 'cooler' && parts.coolerIsStock)).map((c) => c.id);

  const price = CATEGORIES.reduce((sum, c) => sum + (build[c.id] ? getPart(build[c.id]).price : 0), 0);
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warn');
  const canBoot = missing.length === 0 && errors.length === 0;

  return {
    parts, issues, errors, warnings, missing, missingReasons, price, canBoot,
    power: { draw, capacity: psu ? psu.watts : 0 },
    perf: cpu && ram && (gpu || cpu.igpu) ? estimatePerformance(parts) : null,
  };
}

export function estimatePerformance(parts) {
  const { cpu, cooler, ram, storage, gpu, motherboard: mb } = parts;
  const thermal = cooler && cooler.tdpRating < cpu.watts ? 0.88 : 1;
  const ramSpeed = mb ? Math.min(ram.speed, mb.maxRamSpeed) : ram.speed;
  const ramFactor = (ram.type === 'DDR5' ? 1.06 : 1) * (ram.gb >= 32 ? 1 : 0.94) * (ramSpeed >= 3600 ? 1.02 : 1);
  const cpuFps = cpu.gaming * ramFactor * thermal;
  const gpuBase = gpu ? gpu.fps1080 : cpu.igpu.fps1080;
  const fps = {};
  for (const r of RESOLUTIONS) fps[r.id] = Math.round(Math.min(cpuFps, gpuBase * r.scale));
  const creator = Math.round(cpu.multi * thermal * (ram.gb >= 64 ? 1.08 : ram.gb >= 32 ? 1 : 0.9) * 25);
  const bottleneck = cpuFps < gpuBase ? 'cpu' : 'gpu';
  return {
    fps,
    creator,
    bottleneck,
    graphics: gpu ? gpu.name : `${cpu.igpu.name} (integrated)`,
    bootSeconds: storage ? storage.bootSeconds : null,
    rigScore: Math.round(fps['1440p'] * 30 + creator * 0.6),
    thermalThrottle: thermal < 1,
  };
}

/** Issues the given part would cause if it were installed into the current build. */
export function previewPart(part, build) {
  const next = { ...build, [part.category]: part.id };
  const result = analyze(next);
  const mine = result.issues.filter((i) => i.categories.includes(part.category));
  return { errors: mine.filter((i) => i.level === 'error'), warnings: mine.filter((i) => i.level === 'warn') };
}

/** Encode / decode builds for shareable links. */
export function encodeBuild(build) {
  return CATEGORIES.filter((c) => build[c.id]).map((c) => `${c.id}:${build[c.id]}`).join(',');
}

export function decodeBuild(str) {
  const build = emptyBuild();
  for (const pair of (str || '').split(',')) {
    const [cat, id] = pair.split(':');
    const part = id && getPart(id);
    if (part && part.category === cat && cat in build) build[cat] = id;
  }
  return build;
}

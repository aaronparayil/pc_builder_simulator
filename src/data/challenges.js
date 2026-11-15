// Each challenge has three goals. The first is the pass condition and
// always includes the budget; each goal met earns a star.

const underBudget = (r, budget) => r.price <= budget;
const fps = (r, res) => (r.perf ? r.perf.fps[res] : 0);

export const CHALLENGES = [
  {
    id: 'first-boot',
    title: 'First Boot',
    tag: 'Tutorial',
    brief: 'Put together any PC that powers on. Start with the motherboard, then work down the checklist.',
    budget: null,
    goals: [
      { label: 'The PC boots', test: (r) => r.canBoot },
      { label: 'No warnings', test: (r) => r.canBoot && r.warnings.length === 0 },
      { label: 'Spend $900 or less', test: (r) => r.canBoot && r.price <= 900 },
    ],
  },
  {
    id: 'budget-gamer',
    title: 'Budget Gamer',
    tag: '$800',
    brief: 'A friend wants 1080p gaming at a steady 60 FPS and has $800 to spend.',
    budget: 800,
    goals: [
      { label: 'Boots, ≥ 60 FPS at 1080p, ≤ $800', test: (r) => r.canBoot && underBudget(r, 800) && fps(r, '1080p') >= 60 },
      { label: '≥ 90 FPS at 1080p', test: (r) => r.canBoot && underBudget(r, 800) && fps(r, '1080p') >= 90 },
      { label: 'Spend $700 or less', test: (r) => r.canBoot && r.price <= 700 && fps(r, '1080p') >= 60 },
    ],
  },
  {
    id: 'quiet-office',
    title: 'Quiet Office',
    tag: 'No GPU',
    brief: 'An office PC with no graphics card. Keep it cheap and frugal on power.',
    budget: 600,
    goals: [
      { label: 'Boots with no GPU, ≤ $600', test: (r) => r.canBoot && !r.parts.gpu && underBudget(r, 600) },
      { label: 'Draws under 200 W', test: (r) => r.canBoot && !r.parts.gpu && underBudget(r, 600) && r.power.draw < 200 },
      { label: 'Boots in under 10 seconds', test: (r) => r.canBoot && !r.parts.gpu && underBudget(r, 600) && r.perf?.bootSeconds < 10 },
    ],
  },
  {
    id: 'sweet-spot',
    title: '1440p Sweet Spot',
    tag: '$1,500',
    brief: 'High-refresh 1440p gaming: 100 FPS or more without blowing the budget.',
    budget: 1500,
    goals: [
      { label: 'Boots, ≥ 100 FPS at 1440p, ≤ $1,500', test: (r) => r.canBoot && underBudget(r, 1500) && fps(r, '1440p') >= 100 },
      { label: 'No warnings', test: (r) => r.canBoot && underBudget(r, 1500) && fps(r, '1440p') >= 100 && r.warnings.length === 0 },
      { label: 'Spend $1,300 or less', test: (r) => r.canBoot && r.price <= 1300 && fps(r, '1440p') >= 100 },
    ],
  },
  {
    id: 'workstation',
    title: 'Creator Workstation',
    tag: '$2,000',
    brief: 'A video editor needs serious multi-core power and lots of memory.',
    budget: 2000,
    goals: [
      { label: 'Boots, creator score ≥ 8,000, ≤ $2,000', test: (r) => r.canBoot && underBudget(r, 2000) && r.perf?.creator >= 8000 },
      { label: '64 GB of RAM', test: (r) => r.canBoot && underBudget(r, 2000) && r.perf?.creator >= 8000 && r.parts.ram?.gb >= 64 },
      { label: 'No thermal throttling', test: (r) => r.canBoot && underBudget(r, 2000) && r.perf?.creator >= 8000 && !r.perf.thermalThrottle },
    ],
  },
  {
    id: 'no-compromise',
    title: 'No Compromises',
    tag: '4K',
    brief: 'The dream machine: 4K at 60 FPS or better. Big budget, but it still has a limit.',
    budget: 3500,
    goals: [
      { label: 'Boots, ≥ 60 FPS at 4K, ≤ $3,500', test: (r) => r.canBoot && underBudget(r, 3500) && fps(r, '4K') >= 60 },
      { label: '≥ 100 FPS at 4K', test: (r) => r.canBoot && underBudget(r, 3500) && fps(r, '4K') >= 100 },
      { label: 'No warnings', test: (r) => r.canBoot && underBudget(r, 3500) && fps(r, '4K') >= 60 && r.warnings.length === 0 },
    ],
  },
];

export const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

export function scoreChallenge(challenge, result) {
  const met = challenge.goals.map((g) => Boolean(g.test(result)));
  const stars = met[0] ? met.filter(Boolean).length : 0;
  return { met, stars, passed: met[0] };
}

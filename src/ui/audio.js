// Tiny Web Audio synth: every sound is generated, nothing is downloaded.

let ctx = null;
let master = null;
let muted = false;
let hum = null;

try { muted = localStorage.getItem('rig.muted') === '1'; } catch { /* storage unavailable */ }

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq = 440, to = null, type = 'sine', dur = 0.15, vol = 0.2, delay = 0 }) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noiseBuffer(c, seconds = 1) {
  const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function whoosh({ dur = 0.35, from = 400, to = 2400, vol = 0.12 } = {}) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, dur + 0.1);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

export const sfx = {
  unlock: () => ensure(),
  click: () => tone({ freq: 1800, to: 1200, type: 'triangle', dur: 0.05, vol: 0.06 }),
  hover: () => tone({ freq: 2400, type: 'sine', dur: 0.03, vol: 0.02 }),
  install: () => {
    whoosh({ dur: 0.45, from: 300, to: 1800, vol: 0.08 });
    tone({ freq: 140, to: 70, type: 'square', dur: 0.08, vol: 0.12, delay: 0.55 });
    tone({ freq: 2600, type: 'triangle', dur: 0.04, vol: 0.06, delay: 0.56 });
  },
  remove: () => whoosh({ dur: 0.3, from: 1600, to: 300, vol: 0.07 }),
  error: () => {
    tone({ freq: 220, type: 'square', dur: 0.12, vol: 0.08 });
    tone({ freq: 160, type: 'square', dur: 0.18, vol: 0.08, delay: 0.14 });
  },
  beep: (delay = 0) => tone({ freq: 1000, type: 'square', dur: 0.12, vol: 0.06, delay }),
  chime: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.9, vol: 0.09, delay: i * 0.09 }));
  },
  star: (i = 0) => tone({ freq: 880 * Math.pow(1.26, i), type: 'triangle', dur: 0.25, vol: 0.1, delay: i * 0.18 }),
  fanHum(on) {
    const c = ensure();
    if (!c) return;
    if (on && !hum) {
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 2);
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      const g = c.createGain();
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(0.05, c.currentTime + 1.5);
      src.connect(f).connect(g).connect(master);
      src.start();
      hum = { src, g };
    } else if (!on && hum) {
      const { src, g } = hum;
      g.gain.linearRampToValueAtTime(0, c.currentTime + 0.8);
      src.stop(c.currentTime + 0.9);
      hum = null;
    }
  },
};

export function isMuted() { return muted; }

export function setMuted(v) {
  muted = v;
  try { localStorage.setItem('rig.muted', v ? '1' : '0'); } catch { /* ignore */ }
  if (master) master.gain.value = v ? 0 : 0.5;
}

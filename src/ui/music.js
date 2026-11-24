// Background music, generated like every other sound: a slow, calm loop of soft pads,
// a plucked arpeggio with an echo, and a quiet bass line. Nothing is downloaded.

const BPM = 74;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LOOKAHEAD = 2.5; // seconds of music scheduled ahead (timers slow down in background tabs)

// Two bars per chord: Am9 · Fmaj7 · Cmaj7 · Em7 (MIDI note numbers)
const CHORDS = [
  { bass: 45, notes: [57, 60, 64, 67, 71] },
  { bass: 41, notes: [53, 57, 60, 64, 69] },
  { bass: 48, notes: [55, 60, 64, 67, 71] },
  { bass: 40, notes: [55, 59, 62, 64, 67] },
];

const hz = (note) => 440 * Math.pow(2, (note - 69) / 12);

/** A small deterministic random generator, so the melody varies but never jars. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Create the music engine on an AudioContext (or OfflineAudioContext), playing into
 * `destination`. `start()` fades it in; `stop()` fades it out. Offline renders pass a
 * long `lookahead` and `timers: false` to schedule everything up front.
 */
export function createMusic(ctx, destination, { volume = 0.65, seed = 7, lookahead = LOOKAHEAD, timers = true } = {}) {
  let bus = null;
  let echo = null;
  let timer = null;
  let bar = 0;
  let next = 0;
  const random = rng(seed);

  function voice(type, freq, detune, t, attack, hold, release, gain, out) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + hold + release + 0.05);
  }

  function pad(notes, t, length) {
    // two slightly detuned triangles per note through a soft low-pass
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(700, t);
    f.frequency.linearRampToValueAtTime(1300, t + length / 2);
    f.frequency.linearRampToValueAtTime(700, t + length);
    f.Q.value = 0.4;
    f.connect(bus);
    for (const n of notes) {
      voice('triangle', hz(n), -7, t, 1.6, length - 2.4, 2.2, 0.022, f);
      voice('triangle', hz(n), 7, t, 1.6, length - 2.4, 2.2, 0.022, f);
    }
  }

  function pluck(note, t, gain) {
    const g = ctx.createGain();
    g.gain.value = 1;
    g.connect(bus);
    g.connect(echo.input);
    voice('sine', hz(note), 0, t, 0.006, 0, 1.1, gain, g);
    voice('triangle', hz(note + 12), 0, t, 0.004, 0, 0.35, gain * 0.25, g);
  }

  function bass(note, t, length, gain) {
    voice('sine', hz(note), 0, t, 0.08, length * 0.6, length * 0.5, gain, bus);
  }

  function scheduleBar(t) {
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
    if (bar % 2 === 0) pad(chord.notes, t, BAR * 2 + 0.4);
    bass(chord.bass, t, BEAT * 2.5, 0.09);
    bass(chord.bass, t + BEAT * 2.5, BEAT * 1.5, 0.06);
    // eighth-note arpeggio an octave up, with rests; a little busier every 4th bar
    const tones = chord.notes.map((n) => n + 12);
    let last = 0;
    for (let i = 0; i < 8; i++) {
      const busy = bar % 4 === 3 ? 0.75 : 0.5;
      if (i !== 0 && random() > busy) continue;
      // mostly step to a neighbouring chord tone, so the line stays smooth
      last = Math.max(0, Math.min(tones.length - 1, last + Math.round((random() - 0.5) * 3)));
      const swing = i % 2 ? BEAT * 0.06 : 0;
      pluck(tones[last], t + i * (BEAT / 2) + swing, i === 0 ? 0.05 : 0.03 + random() * 0.02);
    }
    bar++;
  }

  function pump() {
    while (next < ctx.currentTime + lookahead) {
      scheduleBar(next);
      next += BAR;
    }
  }

  function start() {
    if (bus) return;
    const t = ctx.currentTime;
    bus = ctx.createGain();
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(volume, t + 5);
    bus.connect(destination);
    // a dotted-eighth echo with a darkening feedback loop
    const input = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = BEAT * 0.75;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 1800;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    input.connect(delay).connect(damp).connect(feedback).connect(delay);
    damp.connect(wet).connect(bus);
    echo = { input };
    bar = 0;
    next = t + 0.1;
    pump();
    if (timers) timer = setInterval(pump, 300);
  }

  function stop(fade = 1.5) {
    if (!bus) return;
    clearInterval(timer);
    timer = null;
    const old = bus;
    const t = ctx.currentTime;
    old.gain.cancelScheduledValues(t);
    old.gain.setValueAtTime(old.gain.value, t);
    old.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => old.disconnect(), (fade + 0.2) * 1000);
    bus = null;
    echo = null;
  }

  return { start, stop, get playing() { return Boolean(bus); } };
}

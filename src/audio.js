// Tiny synthesized sound effects via WebAudio — no audio assets needed.

let ctx = null;
let master = null;

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
}

function env(node, t0, attack, decay, peak = 1) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + attack + decay);
  node.connect(g);
  g.connect(master);
  return g;
}

function noiseBuffer(seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export const sfx = {
  laser() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    env(o, t, 0.005, 0.12, 0.5);
    o.start(t); o.stop(t + 0.15);
  },
  missile() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.4);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2500, t + 0.35);
    src.connect(f);
    env(f, t, 0.01, 0.4, 0.7);
    src.start(t);
  },
  explosion(big = false) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(big ? 1.2 : 0.5);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(big ? 900 : 1400, t);
    f.frequency.exponentialRampToValueAtTime(60, t + (big ? 1.1 : 0.45));
    src.connect(f);
    env(f, t, 0.005, big ? 1.1 : 0.45, big ? 1.2 : 0.8);
    src.start(t);
  },
  hit() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    env(o, t, 0.002, 0.15, 0.6);
    o.start(t); o.stop(t + 0.18);
  },
  pickup() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [523, 659, 784].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      env(o, t + i * 0.06, 0.005, 0.12, 0.4);
      o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.14);
    });
  },
  enemyShot() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(700, t + 0.1);
    env(o, t, 0.005, 0.1, 0.25);
    o.start(t); o.stop(t + 0.12);
  },
};

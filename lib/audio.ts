/** Tiny synthesised sound effects — no audio files needed. */
let ac: AudioContext | null = null;
let enabled = true;

export function setSound(v: boolean) {
  enabled = v;
}
export function soundOn() {
  return enabled;
}

function ctx() {
  if (!enabled) return null;
  if (!ac) {
    try {
      ac = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ac.state === "suspended") ac.resume();
  return ac;
}

function noise(a: AudioContext, dur: number) {
  const b = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource();
  s.buffer = b;
  return s;
}

/** parchment rustle */
export function rustle(len = 0.5, vol = 0.18) {
  const a = ctx();
  if (!a) return;
  const n = noise(a, len);
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1800 + Math.random() * 1400;
  bp.Q.value = 0.7;
  const g = a.createGain();
  const t = a.currentTime;
  g.gain.setValueAtTime(0, t);
  for (let i = 0; i < 6; i++) g.gain.linearRampToValueAtTime(vol * (0.4 + Math.random() * 0.6), t + (len * (i + 0.5)) / 6);
  g.gain.linearRampToValueAtTime(0, t + len);
  n.connect(bp).connect(g).connect(a.destination);
  n.start();
}

/** quill scratch */
export function scratch(vol = 0.05) {
  const a = ctx();
  if (!a) return;
  const n = noise(a, 0.06);
  const hp = a.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 4200;
  const g = a.createGain();
  const t = a.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  n.connect(hp).connect(g).connect(a.destination);
  n.start();
}

/** a soft harp phrase — for a certain three-headed dog */
export function harp() {
  const a = ctx();
  if (!a) return;
  const notes = [392, 440, 494, 587, 523, 494, 440, 392, 330, 392];
  notes.forEach((f, i) => {
    const o = a.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const g = a.createGain();
    const t = a.currentTime + i * 0.32;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 1.5);
  });
}

/** wand tap */
export function tap() {
  const a = ctx();
  if (!a) return;
  const o = a.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(880, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(1760, a.currentTime + 0.25);
  const g = a.createGain();
  g.gain.setValueAtTime(0.07, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.6);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.6);
}

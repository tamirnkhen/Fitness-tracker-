/**
 * Sound effects, synthesised in code (no downloads):
 * a brass fanfare and steel sword clashes, rendered to 16-bit WAV.
 * Pure functions: testable without a browser.
 */
export const RATE = 32000;

type Buf = Float32Array;

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function alloc(seconds: number): Buf {
  return new Float32Array(Math.ceil(seconds * RATE));
}

/**
 * One brass note. Brightness follows loudness (the defining trait of brass):
 * harmonics fade in during the attack, with a small pitch "scoop", breath
 * noise at the start and a gentle vibrato on long notes.
 */
export function brass(out: Buf, t0: number, freq: number, dur: number, gain = 0.5, seed = 1): void {
  const rnd = seeded(seed);
  const start = Math.floor(t0 * RATE);
  const n = Math.floor((dur + 0.08) * RATE);
  const attack = 0.035;
  const release = 0.07;
  const harmonics = 14;
  let phase = 0;
  let noiseLp = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE;
    // envelope
    let env: number;
    if (t < attack) env = Math.pow(t / attack, 1.6);
    else if (t < dur) env = 0.88 + 0.12 * Math.exp(-(t - attack) * 6);
    else env = Math.max(0, 0.88 * (1 - (t - dur) / release));
    if (env <= 0 && t > dur) break;
    // pitch: scoop up from -35 cents, vibrato after 180 ms on long notes
    const scoop = t < 0.04 ? -0.02 * (1 - t / 0.04) : 0;
    const vib = dur > 0.4 && t > 0.18 ? 0.0045 * Math.sin(2 * Math.PI * 5.4 * t) * Math.min(1, (t - 0.18) / 0.2) : 0;
    const f = freq * (1 + scoop + vib);
    phase += (2 * Math.PI * f) / RATE;
    const bright = 1.2 + 5.2 * env; // brighter when louder
    let s = 0;
    let norm = 0;
    for (let k = 1; k <= harmonics; k++) {
      if (f * k > RATE / 2 - 500) break;
      const a = Math.exp(-(k - 1) / bright) * (k === 1 ? 0.8 : 1);
      s += a * Math.sin(k * phase + k * 0.3);
      norm += a;
    }
    s /= norm;
    // breath noise on the attack
    const noise = rnd() * 2 - 1;
    noiseLp += 0.25 * (noise - noiseLp);
    const breath = t < 0.06 ? noiseLp * 0.18 * (1 - t / 0.06) : noiseLp * 0.012;
    out[start + i]! += gain * env * (s + breath);
  }
}

/** Steel on steel: inharmonic ringing partials + a bright noise transient. */
export function clash(out: Buf, t0: number, gain = 0.6, seed = 7): void {
  const rnd = seeded(seed);
  const start = Math.floor(t0 * RATE);
  const partials = [1873, 2711, 3604, 4385, 5213, 6127, 7349, 8902, 10211].map((f) => ({
    f: f * (0.97 + rnd() * 0.06),
    a: 0.4 + rnd() * 0.6,
    tau: 0.12 + rnd() * 0.5,
    ph: rnd() * Math.PI * 2,
  }));
  const n = Math.floor(1.1 * RATE);
  let prev = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE;
    let s = 0;
    for (const p of partials) s += p.a * Math.exp(-t / p.tau) * Math.sin(2 * Math.PI * p.f * t + p.ph);
    s /= partials.length;
    // impact: high-passed noise burst
    const w = rnd() * 2 - 1;
    const hp = w - prev;
    prev = w;
    const impact = t < 0.03 ? hp * (1 - t / 0.03) * 0.9 : 0;
    // short scrape after the hit
    const scrape = t > 0.01 && t < 0.12 ? hp * 0.12 * Math.sin((Math.PI * (t - 0.01)) / 0.11) : 0;
    const env = t < 0.002 ? t / 0.002 : 1;
    out[start + i]! += gain * env * (s * 1.4 + impact + scrape);
  }
}

/** Low drum hit for the peak of the fanfare. */
export function boom(out: Buf, t0: number, gain = 0.5): void {
  const start = Math.floor(t0 * RATE);
  const n = Math.floor(0.9 * RATE);
  let ph = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE;
    const f = 55 + 70 * Math.exp(-t * 18);
    ph += (2 * Math.PI * f) / RATE;
    out[start + i]! += gain * Math.exp(-t * 4.5) * Math.sin(ph) * (t < 0.004 ? t / 0.004 : 1);
  }
}

function bell(out: Buf, t0: number, f: number, gain: number) {
  const start = Math.floor(t0 * RATE);
  const n = Math.floor(0.5 * RATE);
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE;
    const env = Math.exp(-t * 9) * (t < 0.003 ? t / 0.003 : 1);
    out[start + i]! += gain * env * (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * t));
  }
}

/** Simple feedback-delay "hall" so it doesn't sound dry. */
function reverb(buf: Buf, mix = 0.18): Buf {
  const taps = [0.029, 0.037, 0.043, 0.051].map((s) => Math.floor(s * RATE));
  const out = new Float32Array(buf.length);
  const lines = taps.map((d) => ({ d, b: new Float32Array(d), i: 0 }));
  for (let n = 0; n < buf.length; n++) {
    let wet = 0;
    for (const l of lines) {
      const y = l.b[l.i]!;
      l.b[l.i] = buf[n]! + y * 0.72;
      l.i = (l.i + 1) % l.d;
      wet += y;
    }
    out[n] = buf[n]! * (1 - mix) + (wet / lines.length) * mix;
  }
  return out;
}

function finish(buf: Buf, peak = 0.89): Buf {
  const r = reverb(buf);
  let m = 0;
  for (const v of r) m = Math.max(m, Math.abs(v));
  const g = m > 0 ? peak / m : 1;
  for (let i = 0; i < r.length; i++) {
    let v = r[i]! * g;
    // soft fade-out at the very end
    const tail = r.length - i;
    if (tail < 800) v *= tail / 800;
    r[i] = v;
  }
  return r;
}

const NOTE = { G4: 392.0, C5: 523.25, E5: 659.25, G5: 783.99, C4: 261.63, E4: 329.63 };

/** Level up: two clashes, G4-G4-G4-C5, then E5-G5 long, with a clash at the peak. */
export function renderLevelUp(): Buf {
  const out = alloc(3.0);
  clash(out, 0.0, 0.55, 11);
  clash(out, 0.19, 0.5, 23);
  const s = 0.42;
  const tri = 0.125;
  brass(out, s, NOTE.G4, 0.1, 0.45, 1);
  brass(out, s + tri, NOTE.G4, 0.1, 0.45, 2);
  brass(out, s + 2 * tri, NOTE.G4, 0.1, 0.45, 3);
  brass(out, s + 3 * tri, NOTE.C5, 0.32, 0.5, 4);
  const p = s + 3 * tri + 0.38;
  brass(out, p, NOTE.E5, 0.16, 0.48, 5);
  const peak = p + 0.2;
  brass(out, peak, NOTE.G5, 1.05, 0.55, 6);
  // a second and third horn join on the final chord
  brass(out, peak, NOTE.E5, 1.05, 0.26, 7);
  brass(out, peak, NOTE.C5, 1.05, 0.22, 8);
  clash(out, peak, 0.6, 37);
  boom(out, peak, 0.45);
  return finish(out);
}

/** Boss defeated: a double sword clash with a low hit. */
export function renderBoss(): Buf {
  const out = alloc(1.6);
  clash(out, 0.0, 0.65, 41);
  clash(out, 0.21, 0.7, 53);
  boom(out, 0.21, 0.35);
  return finish(out);
}

/** Quest done: a small bright bell. */
export function renderTick(): Buf {
  const out = alloc(0.6);
  bell(out, 0, 1318.5, 0.4);
  bell(out, 0.07, 1975.5, 0.3);
  return finish(out, 0.5);
}

export function toWav(buf: Buf): ArrayBuffer {
  const data = buf.length * 2;
  const ab = new ArrayBuffer(44 + data);
  const v = new DataView(ab);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + data, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, data, true);
  for (let i = 0; i < buf.length; i++) {
    const s = Math.max(-1, Math.min(1, buf[i]!));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return ab;
}

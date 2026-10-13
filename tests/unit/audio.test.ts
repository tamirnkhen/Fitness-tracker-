import { describe, expect, it } from 'vitest';
import { renderLevelUp, renderBoss, renderTick, toWav, RATE } from '../../src/audio/synth';

describe('synthesised sounds', () => {
  it('level-up fanfare is ~3s, loud, not clipped, deterministic', () => {
    const a = renderLevelUp();
    expect(a.length / RATE).toBeCloseTo(3, 0);
    let peak = 0;
    for (const v of a) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeGreaterThan(0.8);
    expect(peak).toBeLessThanOrEqual(0.9);
    expect(renderLevelUp()).toEqual(a);
  });
  it('the fanfare has energy where the notes are (G4 triplet around 0.42s, peak ~1.25s)', () => {
    const a = renderLevelUp();
    const rms = (t0: number, t1: number) => {
      let s = 0;
      const i0 = Math.floor(t0 * RATE);
      const i1 = Math.floor(t1 * RATE);
      for (let i = i0; i < i1; i++) s += a[i]! ** 2;
      return Math.sqrt(s / (i1 - i0));
    };
    expect(rms(0.43, 0.5)).toBeGreaterThan(0.05);
    expect(rms(1.3, 1.9)).toBeGreaterThan(0.05);
    expect(rms(2.85, 3.0)).toBeLessThan(rms(1.3, 1.9));
  });
  it('boss and tick render', () => {
    expect(renderBoss().length).toBeGreaterThan(RATE);
    expect(renderTick().length).toBeGreaterThan(RATE * 0.5);
  });
  it('writes a valid 16-bit PCM WAV', () => {
    const buf = toWav(renderTick());
    const v = new DataView(buf);
    const tag = (o: number) => String.fromCharCode(...new Uint8Array(buf, o, 4));
    expect(tag(0)).toBe('RIFF');
    expect(tag(8)).toBe('WAVE');
    expect(v.getUint32(24, true)).toBe(RATE);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(buf.byteLength - 44);
  });
});

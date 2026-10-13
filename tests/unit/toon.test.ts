import { describe, expect, it } from 'vitest';
import { toon, ovalMask, kuwahara, boxBlur, isSkin } from '../../src/character/toon';

function synthetic(w: number, h: number) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  const mask = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const inFace = (x - w / 2) ** 2 / (w * 0.2) ** 2 + (y - h * 0.4) ** 2 / (h * 0.27) ** 2 < 1;
      const body = y > h * 0.62 && Math.abs(x - w / 2) < w * 0.35;
      mask[i] = inFace || body ? 1 : 0;
      const [r, g, b] = inFace ? [224, 172, 140] : body ? [200, 80, 40] : [240, 240, 240];
      const eye = inFace && Math.abs(y - h * 0.38) < 3 && (Math.abs(x - w * 0.42) < 4 || Math.abs(x - w * 0.58) < 4);
      rgba[i * 4] = eye ? 30 : r;
      rgba[i * 4 + 1] = eye ? 20 : g;
      rgba[i * 4 + 2] = eye ? 20 : b;
      rgba[i * 4 + 3] = 255;
    }
  return { w, h, rgba, mask };
}

describe('toon engine', () => {
  it('produces a transparent cut-out with the person opaque', () => {
    const inp = synthetic(128, 128);
    const out = toon(inp);
    expect(out.rgba.length).toBe(128 * 128 * 4);
    expect(out.rgba[3]).toBe(0); // corner: background removed
    const c = (64 * 128 + 50) * 4;
    expect(out.rgba[c + 3]).toBe(255);
    expect(out.coverage).toBeGreaterThan(0.1);
    expect(out.coverage).toBeLessThan(0.8);
  });
  it('finds the face from skin', () => {
    const out = toon(synthetic(128, 128));
    expect(out.face).not.toBeNull();
    const [fx, fy, fw] = out.face!;
    expect(fx).toBeGreaterThan(0.2);
    expect(fy).toBeLessThan(0.3);
    expect(fw).toBeGreaterThan(0.2);
  });
  it('keeps eyes dark (detail preserved)', () => {
    const inp = synthetic(128, 128);
    const out = toon(inp);
    const i = (Math.round(128 * 0.38) * 128 + Math.round(128 * 0.42)) * 4;
    expect(out.rgba[i]! + out.rgba[i + 1]! + out.rgba[i + 2]!).toBeLessThan(300);
  });
  it('helpers behave', () => {
    expect(isSkin(224 / 255, 172 / 255, 140 / 255)).toBe(true);
    expect(isSkin(0.2, 0.4, 0.9)).toBe(false);
    const flat = new Float32Array(100).fill(0.5);
    expect(Array.from(boxBlur(flat, 10, 10, 2)).every((v) => Math.abs(v - 0.5) < 1e-6)).toBe(true);
    const [r] = kuwahara(flat, flat, flat, 10, 10, 2);
    expect(Math.abs(r[55]! - 0.5)).toBeLessThan(1e-6);
    const m = ovalMask(64, 64);
    expect(m[32 * 64 + 32]).toBe(1);
    expect(m[0]).toBe(0);
  });
});

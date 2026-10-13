/**
 * The character drawing engine. Pure pixel math (no DOM), runs in a Worker.
 *
 *   photo + person mask
 *     → auto exposure
 *     → Kuwahara (2 passes, summed-area tables: O(pixels))  … painterly flat areas
 *     → even skin tone (YCbCr skin detection, chroma pulled to the median)
 *     → cel shading (luminance in soft steps, cool shadows, warm lights)
 *     → detail kept in eyes / brows / mouth (non-skin pixels inside the face)
 *     → ink outlines (Sobel on the smoothed image) + silhouette contour
 *     → transparent cut-out (alpha from the mask)
 *
 * The backdrop is NOT baked in: it is drawn at display time by rank.
 */

export interface ToonInput {
  w: number;
  h: number;
  rgba: Uint8ClampedArray;
  /** person confidence 0..1, same size */
  mask: Float32Array;
}

export interface ToonOutput {
  rgba: Uint8ClampedArray;
  coverage: number;
  face: [number, number, number, number] | null;
  meanLuma: number;
}

export const STYLE_VERSION = 2;
const INK = [27, 18, 48];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Box blur of a single channel (separable, edge-clamped). */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return src.slice();
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const d = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    const row = y * w;
    for (let i = -r; i <= r; i++) acc += src[row + Math.min(w - 1, Math.max(0, i))]!;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / d;
      acc += src[row + Math.min(w - 1, x + r + 1)]! - src[row + Math.max(0, x - r)]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += tmp[Math.min(h - 1, Math.max(0, i)) * w + x]!;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / d;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x]! - tmp[Math.max(0, y - r) * w + x]!;
    }
  }
  return out;
}

/** Summed-area table, (w+1)×(h+1). */
function sat(src: Float32Array, w: number, h: number): Float64Array {
  const W = w + 1;
  const s = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[y * w + x]!;
      s[(y + 1) * W + x + 1] = s[y * W + x + 1]! + row;
    }
  }
  return s;
}

function rect(s: Float64Array, w: number, x0: number, y0: number, x1: number, y1: number): number {
  const W = w + 1;
  return s[(y1 + 1) * W + x1 + 1]! - s[y0 * W + x1 + 1]! - s[(y1 + 1) * W + x0]! + s[y0 * W + x0]!;
}

/** Classic 4-quadrant Kuwahara on planar RGB, using SATs. */
export function kuwahara(r: Float32Array, g: Float32Array, b: Float32Array, w: number, h: number, rad: number) {
  const L = new Float32Array(w * h);
  const L2 = new Float32Array(w * h);
  for (let i = 0; i < L.length; i++) {
    const l = 0.299 * r[i]! + 0.587 * g[i]! + 0.114 * b[i]!;
    L[i] = l;
    L2[i] = l * l;
  }
  const sR = sat(r, w, h);
  const sG = sat(g, w, h);
  const sB = sat(b, w, h);
  const sL = sat(L, w, h);
  const sL2 = sat(L2, w, h);
  const oR = new Float32Array(w * h);
  const oG = new Float32Array(w * h);
  const oB = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = Infinity;
      let br = 0;
      let bg = 0;
      let bb = 0;
      for (let q = 0; q < 4; q++) {
        const x0 = Math.max(0, q & 1 ? x : x - rad);
        const x1 = Math.min(w - 1, q & 1 ? x + rad : x);
        const y0 = Math.max(0, q & 2 ? y : y - rad);
        const y1 = Math.min(h - 1, q & 2 ? y + rad : y);
        const n = (x1 - x0 + 1) * (y1 - y0 + 1);
        const m = rect(sL, w, x0, y0, x1, y1) / n;
        const v = rect(sL2, w, x0, y0, x1, y1) / n - m * m;
        if (v < best) {
          best = v;
          br = rect(sR, w, x0, y0, x1, y1) / n;
          bg = rect(sG, w, x0, y0, x1, y1) / n;
          bb = rect(sB, w, x0, y0, x1, y1) / n;
        }
      }
      const i = y * w + x;
      oR[i] = br;
      oG[i] = bg;
      oB[i] = bb;
    }
  }
  return [oR, oG, oB] as const;
}

export function isSkin(r: number, g: number, b: number): boolean {
  // r,g,b in 0..1 → YCbCr in 0..255
  const R = r * 255;
  const G = g * 255;
  const B = b * 255;
  const Y = 0.299 * R + 0.587 * G + 0.114 * B;
  const cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B;
  const cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B;
  return Y > 35 && cb >= 77 && cb <= 130 && cr >= 133 && cr <= 177;
}

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)]!;
}

export function toon(inp: ToonInput): ToonOutput {
  const { w, h, rgba, mask } = inp;
  const N = w * h;
  const scale = w / 512;

  // ---- alpha from the mask: crisp but anti-aliased, slight inset to kill halos
  const rawA = new Float32Array(N);
  for (let i = 0; i < N; i++) rawA[i] = smooth(0.42, 0.68, mask[i]!);
  const alpha = boxBlur(rawA, w, h, Math.max(1, Math.round(1.2 * scale)));
  let coverage = 0;
  for (let i = 0; i < N; i++) coverage += alpha[i]!;
  coverage /= N;

  // ---- planar RGB 0..1
  let R = new Float32Array(N);
  let G = new Float32Array(N);
  let B = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    R[i] = rgba[i * 4]! / 255;
    G[i] = rgba[i * 4 + 1]! / 255;
    B[i] = rgba[i * 4 + 2]! / 255;
  }

  // ---- auto exposure inside the person (percentile stretch + gamma lift)
  const lum: number[] = [];
  for (let i = 0; i < N; i += 3) if (alpha[i]! > 0.5) lum.push(0.299 * R[i]! + 0.587 * G[i]! + 0.114 * B[i]!);
  lum.sort((a, b) => a - b);
  const meanLuma = lum.length ? lum.reduce((a, b) => a + b, 0) / lum.length : 0;
  if (lum.length > 50) {
    const lo = lum[Math.floor(lum.length * 0.02)]!;
    const hi = lum[Math.floor(lum.length * 0.985)]!;
    const span = Math.max(0.2, hi - lo);
    const med = lum[Math.floor(lum.length / 2)]!;
    const normMed = clamp01((med - lo) / span);
    const gamma = normMed > 0.01 ? Math.min(1.25, Math.max(0.75, Math.log(0.48) / Math.log(normMed))) : 1;
    // only half-way: correct dull/dark photos without blowing out good ones
    const k = 0.5;
    for (let i = 0; i < N; i++) {
      R[i] = R[i]! * (1 - k) + Math.pow(clamp01((R[i]! - lo) / span), gamma) * k;
      G[i] = G[i]! * (1 - k) + Math.pow(clamp01((G[i]! - lo) / span), gamma) * k;
      B[i] = B[i]! * (1 - k) + Math.pow(clamp01((B[i]! - lo) / span), gamma) * k;
    }
  }
  // edge decontamination: colours near the silhouette come from inside the
  // person, never from the old background (no light halo around hair)
  {
    const inner = new Float32Array(N);
    for (let i = 0; i < N; i++) inner[i] = smooth(0.75, 0.95, mask[i]!);
    const rad = Math.max(2, Math.round(4 * scale));
    const wR = new Float32Array(N);
    const wG = new Float32Array(N);
    const wB = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      wR[i] = R[i]! * inner[i]!;
      wG[i] = G[i]! * inner[i]!;
      wB[i] = B[i]! * inner[i]!;
    }
    const bw = boxBlur(inner, w, h, rad);
    const bR = boxBlur(wR, w, h, rad);
    const bG = boxBlur(wG, w, h, rad);
    const bB = boxBlur(wB, w, h, rad);
    for (let i = 0; i < N; i++) {
      const t = 1 - inner[i]!;
      if (t <= 0 || bw[i]! < 1e-4) continue;
      R[i] = R[i]! * (1 - t) + (bR[i]! / bw[i]!) * t;
      G[i] = G[i]! * (1 - t) + (bG[i]! / bw[i]!) * t;
      B[i] = B[i]! * (1 - t) + (bB[i]! / bw[i]!) * t;
    }
  }
  const origR = R.slice();
  const origG = G.slice();
  const origB = B.slice();

  // ---- painterly smoothing
  [R, G, B] = kuwahara(R, G, B, w, h, Math.max(2, Math.round(3 * scale))) as unknown as [Float32Array, Float32Array, Float32Array];
  [R, G, B] = kuwahara(R, G, B, w, h, Math.max(1, Math.round(2 * scale))) as unknown as [Float32Array, Float32Array, Float32Array];

  // ---- skin: detect, find the face, even out the tone
  const skin = new Uint8Array(N);
  const cbs: number[] = [];
  const crs: number[] = [];
  let fx0 = w;
  let fy0 = h;
  let fx1 = 0;
  let fy1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (alpha[i]! < 0.5) continue;
      if (isSkin(R[i]!, G[i]!, B[i]!)) {
        skin[i] = 1;
        const r = R[i]! * 255;
        const g = G[i]! * 255;
        const b = B[i]! * 255;
        if ((x + y) % 3 === 0) {
          cbs.push(128 - 0.168736 * r - 0.331264 * g + 0.5 * b);
          crs.push(128 + 0.5 * r - 0.418688 * g - 0.081312 * b);
        }
        if (y < h * 0.75) {
          if (x < fx0) fx0 = x;
          if (x > fx1) fx1 = x;
          if (y < fy0) fy0 = y;
          if (y > fy1) fy1 = y;
        }
      }
    }
  }
  const mCb = median(cbs);
  const mCr = median(crs);
  const face: ToonOutput['face'] = fx1 > fx0 && fy1 > fy0 && cbs.length > 40 ? [fx0 / w, fy0 / h, (fx1 - fx0) / w, (fy1 - fy0) / h] : null;
  // skin mask softened so the tone change has no hard borders
  const skinF = boxBlur(Float32Array.from(skin), w, h, Math.max(1, Math.round(2 * scale)));

  // ---- luminance for shading and edges
  const Ls = new Float32Array(N);
  for (let i = 0; i < N; i++) Ls[i] = 0.299 * R[i]! + 0.587 * G[i]! + 0.114 * B[i]!;
  const Lb = boxBlur(Ls, w, h, 1);

  // XDoG ink lines from the (exposure-corrected) photo: anime-style strokes
  const Lo = new Float32Array(N);
  for (let i = 0; i < N; i++) Lo[i] = 0.299 * origR[i]! + 0.587 * origG[i]! + 0.114 * origB[i]!;
  const g1 = boxBlur(boxBlur(Lo, w, h, Math.max(1, Math.round(scale))), w, h, Math.max(1, Math.round(scale)));
  const g2 = boxBlur(boxBlur(Lo, w, h, Math.max(2, Math.round(2 * scale))), w, h, Math.max(2, Math.round(2 * scale)));
  const edge = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const d = g1[i]! - 0.985 * g2[i]!;
    edge[i] = d < -0.012 ? Math.min(1, (-0.012 - d) * 26) : 0;
  }
  void Lb;

  // silhouette contour: a ring just outside the alpha edge
  const ringR = Math.max(1, Math.round(2 * scale));
  const dil = boxBlur(rawA, w, h, ringR);

  const out = new Uint8ClampedArray(N * 4);
  const BANDS = [0.06, 0.26, 0.44, 0.6, 0.76, 0.9];
  const band = (l: number) => {
    // soft cel steps: snap to band centres with a narrow blend
    let q = BANDS[0]!;
    for (let k = 1; k < BANDS.length; k++) {
      const edgeK = (BANDS[k - 1]! + BANDS[k]!) / 2;
      q += (BANDS[k]! - BANDS[k - 1]!) * smooth(edgeK - 0.045, edgeK + 0.045, l);
    }
    return q;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let r = R[i]!;
      let g = G[i]!;
      let b = B[i]!;
      const s = skinF[i]!;
      const inFace = !!face && x >= face[0] * w && x <= (face[0] + face[2]) * w && y >= face[1] * h && y <= (face[1] + face[3]) * h;

      // even skin: keep luma, pull chroma to the median skin chroma
      if (s > 0.05) {
        const Y = 0.299 * r + 0.587 * g + 0.114 * b;
        const t = 0.45 * s;
        const cb = (128 - 0.168736 * r * 255 - 0.331264 * g * 255 + 0.5 * b * 255) * (1 - t) + mCb * t;
        const cr = (128 + 0.5 * r * 255 - 0.418688 * g * 255 - 0.081312 * b * 255) * (1 - t) + mCr * t;
        const Y255 = Y * 255;
        r = clamp01((Y255 + 1.402 * (cr - 128)) / 255);
        g = clamp01((Y255 - 0.344136 * (cb - 128) - 0.714136 * (cr - 128)) / 255);
        b = clamp01((Y255 + 1.772 * (cb - 128)) / 255);
      }

      // eyes/brows/mouth: non-skin, inside the face → keep the photo's detail
      const detail = Math.abs(Lo[i]! - Ls[i]!);
      const feature = inFace && alpha[i]! > 0.6 && (s < 0.35 || detail > 0.07);
      if (feature) {
        const k = 0.65;
        // unsharp: original + (original - smoothed)
        r = clamp01(origR[i]! * k + r * (1 - k) + (origR[i]! - R[i]!) * 0.5);
        g = clamp01(origG[i]! * k + g * (1 - k) + (origG[i]! - G[i]!) * 0.5);
        b = clamp01(origB[i]! * k + b * (1 - k) + (origB[i]! - B[i]!) * 0.5);
      }

      // cel shading on luminance
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      // quantised, with a little of the smooth tone kept so faces keep their form
      const lq = feature ? l * 0.6 + band(l) * 0.4 : band(l) * 0.78 + l * 0.22;
      const f = l > 0.001 ? lq / l : 0;
      r = clamp01(r * f);
      g = clamp01(g * f);
      b = clamp01(b * f);
      // anime palette: cool shadows, warm lights, a touch more saturation
      if (lq < 0.35) {
        const t = (0.35 - lq) * 0.35;
        r = r * (1 - t) + 0.22 * t;
        g = g * (1 - t) + 0.16 * t;
        b = b * (1 - t) + 0.42 * t;
      } else if (lq > 0.8) {
        const t = (lq - 0.8) * 0.3;
        r = r + (1 - r) * t;
        g = g + (0.95 - g) * t * 0.8;
      }
      const m = (r + g + b) / 3;
      r = clamp01(m + (r - m) * 1.18);
      g = clamp01(m + (g - m) * 1.18);
      b = clamp01(m + (b - m) * 1.18);

      // ink lines
      const e = clamp01(edge[i]! * (inFace ? 1.15 : 0.9)) * 0.92;
      r = r * (1 - e) + (INK[0]! / 255) * e;
      g = g * (1 - e) + (INK[1]! / 255) * e;
      b = b * (1 - e) + (INK[2]! / 255) * e;

      let a = alpha[i]!;
      // inner rim: the outline hugs the silhouette
      if (a > 0.02 && a < 0.97) {
        const t = 0.75 * (1 - Math.abs(a - 0.5) * 2) + 0.25;
        r = r * (1 - t) + (INK[0]! / 255) * t;
        g = g * (1 - t) + (INK[1]! / 255) * t;
        b = b * (1 - t) + (INK[2]! / 255) * t;
      }
      // contour ring outside the body
      const ring = clamp01(dil[i]! * 3) * (1 - a);
      if (ring > 0.02) {
        const t = ring / Math.max(0.0001, a + ring);
        r = r * (1 - t) + (INK[0]! / 255) * t;
        g = g * (1 - t) + (INK[1]! / 255) * t;
        b = b * (1 - t) + (INK[2]! / 255) * t;
        a = clamp01(a + ring);
      }
      out[i * 4] = Math.round(r * 255);
      out[i * 4 + 1] = Math.round(g * 255);
      out[i * 4 + 2] = Math.round(b * 255);
      out[i * 4 + 3] = Math.round(a * 255);
    }
  }
  return { rgba: out, coverage, face, meanLuma };
}

/** Fallback when segmentation is unavailable: a soft portrait oval. */
export function ovalMask(w: number, h: number): Float32Array {
  const m = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / (w * 0.36);
      const dy = (y - h * 0.48) / (h * 0.46);
      const d = Math.sqrt(dx * dx + dy * dy);
      m[y * w + x] = y > h * 0.7 ? clamp01(1 - Math.abs(dx) * 0.7) : clamp01((1.08 - d) * 4);
    }
  }
  return m;
}

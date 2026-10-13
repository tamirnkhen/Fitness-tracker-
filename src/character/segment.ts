/**
 * Person segmentation with MediaPipe, entirely on the device.
 * The library chunk and the wasm/model files (served from /seg) load
 * only when the character creator opens.
 */
import type { ImageSegmenter } from '@mediapipe/tasks-vision';

let segmenter: Promise<ImageSegmenter> | null = null;

async function create(delegate: 'GPU' | 'CPU'): Promise<ImageSegmenter> {
  const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(`${location.origin}/seg`);
  return ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${location.origin}/seg/selfie_segmenter.tflite`, delegate },
    runningMode: 'IMAGE',
    outputCategoryMask: false,
    outputConfidenceMasks: true,
  });
}

export function preloadSegmenter(): Promise<ImageSegmenter> {
  if (!segmenter) {
    segmenter = create('GPU').catch(() => create('CPU'));
    segmenter.catch(() => {
      segmenter = null;
    });
  }
  return segmenter;
}

/** Returns a person-confidence mask (0..1) at the canvas size. */
export async function segment(canvas: HTMLCanvasElement): Promise<Float32Array> {
  const s = await preloadSegmenter();
  const res = s.segment(canvas);
  try {
    const m = res.confidenceMasks?.[0];
    if (!m) throw new Error('no mask');
    const mw = m.width;
    const mh = m.height;
    const data = m.getAsFloat32Array();
    const w = canvas.width;
    const h = canvas.height;
    if (mw === w && mh === h) return data.slice();
    // bilinear resample to the canvas size
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const fy = ((y + 0.5) * mh) / h - 0.5;
      const y0 = Math.max(0, Math.floor(fy));
      const y1 = Math.min(mh - 1, y0 + 1);
      const ty = fy - y0;
      for (let x = 0; x < w; x++) {
        const fx = ((x + 0.5) * mw) / w - 0.5;
        const x0 = Math.max(0, Math.floor(fx));
        const x1 = Math.min(mw - 1, x0 + 1);
        const tx = fx - x0;
        const a = data[y0 * mw + x0]! * (1 - tx) + data[y0 * mw + x1]! * tx;
        const b = data[y1 * mw + x0]! * (1 - tx) + data[y1 * mw + x1]! * tx;
        out[y * w + x] = a * (1 - ty) + b * ty;
      }
    }
    return out;
  } finally {
    res.close();
  }
}

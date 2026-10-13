import { backdropFor, type Backdrop } from '../game/backdrop';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

/** Paints the rank backdrop (radial gradient + vignette) like backdropCss(). */
export function paintBackdrop(g: CanvasRenderingContext2D, w: number, h: number, b: Backdrop) {
  const cx = w / 2;
  const grad = g.createRadialGradient(cx, h * 0.38, 0, cx, h * 0.38, Math.hypot(w, h) * 0.62);
  grad.addColorStop(0, b.light);
  grad.addColorStop(0.46, b.base);
  grad.addColorStop(1, b.dark);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  const vig = g.createRadialGradient(cx, h * 1.2, 0, cx, h * 1.2, h * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0.55)');
  vig.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);
}

/**
 * Small square portrait for the HUD and the party table, rebuilt on the
 * device with the backdrop of the current rank. Legacy images (with a
 * baked-in background) are drawn as they are.
 */
export async function makeThumb(src: string, level: number, legacy = false, size = 96): Promise<string | null> {
  try {
    const img = await loadImage(src);
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    if (!g) return null;
    if (!legacy) paintBackdrop(g, size, size, backdropFor(level));
    // head-and-shoulders crop: top 80% of the square cut-out
    const s = Math.min(img.width, img.height);
    const crop = s * (legacy ? 1 : 0.8);
    const sx = (img.width - crop) / 2;
    const sy = legacy ? (img.height - crop) / 2 : Math.max(0, img.height * 0.04);
    g.drawImage(img, sx, sy, crop, crop, 0, 0, size, size);
    // gold ring
    g.lineWidth = Math.max(2, size * 0.04);
    g.strokeStyle = '#E8B04B';
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, size - g.lineWidth, size - g.lineWidth);
    const out = c.toDataURL('image/jpeg', 0.82);
    return out.startsWith('data:image/jpeg') ? out : null;
  } catch {
    return null;
  }
}

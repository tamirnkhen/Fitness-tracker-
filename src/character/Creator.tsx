import { useEffect, useRef, useState } from 'preact/hooks';
import { Button, Avatar } from '../ui/components/common';
import { IconCamera, IconImage } from '../ui/components/icons';
import { useApp } from '../app/store';
import { saveCharacter } from '../app/actions';
import { levelOf } from '../game/level';
import { BACKDROPS } from '../game/backdrop';
import { preloadSegmenter, segment } from './segment';
import { ovalMask, toon, STYLE_VERSION, type ToonOutput } from './toon';

const SIZE = 512;
const MAX_BYTES = 680 * 1024;

type Step = 'pick' | 'crop' | 'work' | 'result' | 'error';
type ErrKind = 'decode' | 'noperson' | 'canvas' | 'failed';

const ERR: Record<ErrKind, string> = {
  decode: 'לא הצלחנו לפתוח את התמונה. אפשר לנסות תמונה אחרת (JPG או PNG).',
  noperson: 'לא מצאנו דמות בתמונה. הכי טוב: פנים במרכז, אור טוב, רקע לא עמוס.',
  canvas: 'הדפדפן הזה לא תומך בעיבוד תמונה. אפשר לדלג ולנסות אחר כך בדפדפן אחר.',
  failed: 'משהו השתבש בעיבוד. אפשר לנסות שוב או לדלג.',
};

interface View {
  scale: number;
  x: number;
  y: number;
}

function Cropper({ img, view, setView }: { img: ImageBitmap | HTMLImageElement; view: View; setView: (v: View) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const start = useRef<{ view: View; dist: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    c.width = SIZE;
    c.height = SIZE;
    g.fillStyle = '#0f0c24';
    g.fillRect(0, 0, SIZE, SIZE);
    const w = img.width * view.scale;
    const h = img.height * view.scale;
    g.drawImage(img, SIZE / 2 - w / 2 + view.x, SIZE / 2 - h / 2 + view.y, w, h);
  }, [img, view]);

  const minScale = Math.max(SIZE / img.width, SIZE / img.height);
  const clampView = (v: View): View => {
    const scale = Math.min(minScale * 5, Math.max(minScale, v.scale));
    const mx = Math.max(0, (img.width * scale - SIZE) / 2);
    const my = Math.max(0, (img.height * scale - SIZE) / 2);
    return { scale, x: Math.max(-mx, Math.min(mx, v.x)), y: Math.max(-my, Math.min(my, v.y)) };
  };

  const toCanvas = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };
  const snapshot = () => {
    const p = [...pts.current.values()];
    const a = p[0]!;
    const b = p[1] ?? a;
    start.current = { view, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };

  return (
    <div class="cropper">
      <canvas
        ref={ref}
        aria-label="תצוגת חיתוך: גוררים להזזה, צובטים או גוללים להגדלה"
        role="img"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          pts.current.set(e.pointerId, toCanvas(e));
          snapshot();
        }}
        onPointerMove={(e) => {
          if (!pts.current.has(e.pointerId) || !start.current) return;
          pts.current.set(e.pointerId, toCanvas(e));
          const p = [...pts.current.values()];
          const a = p[0]!;
          const b = p[1] ?? a;
          const s = start.current;
          const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
          const cx = (a.x + b.x) / 2;
          const cy = (a.y + b.y) / 2;
          const k = p.length > 1 ? dist / s.dist : 1;
          setView(clampView({ scale: s.view.scale * k, x: s.view.x * k + (cx - s.cx), y: s.view.y * k + (cy - s.cy) }));
        }}
        onPointerUp={(e) => {
          pts.current.delete(e.pointerId);
          if (pts.current.size) snapshot();
          else start.current = null;
        }}
        onPointerCancel={(e) => {
          pts.current.delete(e.pointerId);
          start.current = null;
        }}
        onWheel={(e) => {
          e.preventDefault();
          const k = Math.exp(-e.deltaY * 0.0015);
          setView(clampView({ scale: view.scale * k, x: view.x * k, y: view.y * k }));
        }}
      />
      <div class="guide" aria-hidden="true" />
      <label class="sr-only" for="zoom">
        הגדלה
      </label>
      <input
        id="zoom"
        class="range"
        type="range"
        min={minScale}
        max={minScale * 5}
        step={0.001}
        value={view.scale}
        style={{ position: 'absolute', bottom: '6px', left: '10%', width: '80%' }}
        onInput={(e) => {
          const s = Number(e.currentTarget.value);
          const k = s / view.scale;
          setView(clampView({ scale: s, x: view.x * k, y: view.y * k }));
        }}
      />
    </div>
  );
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* fall back */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function runToon(w: number, h: number, rgba: Uint8ClampedArray, mask: Float32Array): Promise<ToonOutput> {
  return new Promise((resolve, reject) => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('./toon.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      worker = null;
    }
    if (!worker) {
      try {
        resolve(toon({ w, h, rgba, mask }));
      } catch (e) {
        reject(e);
      }
      return;
    }
    const wk = worker;
    const t = setTimeout(() => {
      wk.terminate();
      reject(new Error('timeout'));
    }, 60000);
    wk.onmessage = (e: MessageEvent<{ ok: boolean; error?: string } & ToonOutput>) => {
      clearTimeout(t);
      wk.terminate();
      if (e.data.ok) resolve(e.data);
      else reject(new Error(e.data.error));
    };
    wk.onerror = (e) => {
      clearTimeout(t);
      wk.terminate();
      // e.g. module workers unsupported: run on the main thread
      e.preventDefault();
      reject(new Error('worker'));
    };
    wk.postMessage({ w, h, rgba, mask });
  });
}

/** Encode the cut-out with alpha, small enough for the 700KB cap. */
function encode(out: ToonOutput, size: number): string {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  g.putImageData(new ImageData(new Uint8ClampedArray(out.rgba), size, size), 0, 0);
  const tryEncode = (canvas: HTMLCanvasElement) => {
    const webp = canvas.toDataURL('image/webp', 0.88);
    return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
  };
  let url = tryEncode(c);
  let s = size;
  while (url.length > MAX_BYTES && s > 256) {
    s = Math.round(s * 0.85);
    const d = document.createElement('canvas');
    d.width = s;
    d.height = s;
    const dg = d.getContext('2d')!;
    dg.imageSmoothingQuality = 'high';
    dg.drawImage(c, 0, 0, s, s);
    url = tryEncode(d);
  }
  return url;
}

export function CharacterCreator({ onDone }: { onDone: () => void }) {
  const level = useApp((s) => (s.game ? levelOf(s.game.xp) : 1));
  const [step, setStep] = useState<Step>('pick');
  const [img, setImg] = useState<ImageBitmap | HTMLImageElement | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [err, setErr] = useState<ErrKind>('failed');
  const [phase, setPhase] = useState(0);
  const [result, setResult] = useState<{ url: string; out: ToonOutput; oval: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastMask, setLastMask] = useState<'seg' | 'oval'>('seg');
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headRef.current?.focus();
  }, [step]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/') && f.type !== '') {
      setErr('decode');
      setStep('error');
      return;
    }
    try {
      const b = await decode(f);
      if (!b.width || !b.height) throw new Error('empty');
      setImg(b);
      const s = Math.max(SIZE / b.width, SIZE / b.height);
      setView({ scale: s, x: 0, y: 0 });
      setStep('crop');
      void preloadSegmenter().catch(() => {});
    } catch {
      setErr('decode');
      setStep('error');
    }
  };

  const process = async (useOval = false) => {
    if (!img) return;
    setStep('work');
    setPhase(0);
    const c = document.createElement('canvas');
    c.width = SIZE;
    c.height = SIZE;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) {
      setErr('canvas');
      setStep('error');
      return;
    }
    g.fillStyle = '#808080';
    g.fillRect(0, 0, SIZE, SIZE);
    const w = img.width * view.scale;
    const h = img.height * view.scale;
    g.drawImage(img, SIZE / 2 - w / 2 + view.x, SIZE / 2 - h / 2 + view.y, w, h);
    let mask: Float32Array;
    let oval = useOval;
    try {
      mask = useOval ? ovalMask(SIZE, SIZE) : await segment(c);
    } catch {
      mask = ovalMask(SIZE, SIZE);
      oval = true;
    }
    setLastMask(oval ? 'oval' : 'seg');
    setPhase(1);
    try {
      const rgba = g.getImageData(0, 0, SIZE, SIZE).data;
      const out = await runToon(SIZE, SIZE, new Uint8ClampedArray(rgba), mask);
      if (!oval && out.coverage < 0.04) {
        setErr('noperson');
        setStep('error');
        return;
      }
      setPhase(2);
      const url = encode(out, SIZE);
      setResult({ url, out, oval });
      setStep('result');
    } catch {
      setErr('failed');
      setStep('error');
    }
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    await saveCharacter(result.url, { w: SIZE, h: SIZE, v: STYLE_VERSION, ...(result.out.face ? { face: result.out.face } : {}) });
    setSaving(false);
    // drop the photo from memory
    if (img && 'close' in img) (img as ImageBitmap).close();
    setImg(null);
    onDone();
  };

  const reset = () => {
    setResult(null);
    setImg(null);
    setStep('pick');
  };

  return (
    <main class="screen plain" aria-labelledby="cc-h">
      <h1 id="cc-h" tabIndex={-1} ref={headRef}>
        {step === 'result' ? 'הגיבור שלך' : 'יצירת הדמות'}
      </h1>
      {step === 'pick' ? (
        <div class="card stack">
          <p>תמונה של הפנים שלך הופכת לדמות מצוירת. הכי טוב: פנים במרכז, אור טוב.</p>
          <p class="notice small">🔒 התמונה לא יוצאת מהמכשיר. כל העיבוד נעשה כאן, בדפדפן. נשמרת רק הדמות המצוירת.</p>
          <input
            ref={camRef}
            type="file"
            accept="image/*"
            capture="user"
            class="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => void onFile(e.currentTarget.files?.[0])}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/*"
            class="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="photo-input"
            onChange={(e) => void onFile(e.currentTarget.files?.[0])}
          />
          <Button class="primary block" onClick={() => camRef.current?.click()}>
            <IconCamera width={22} height={22} /> צילום סלפי
          </Button>
          <Button class="block" onClick={() => fileRef.current?.click()}>
            <IconImage width={22} height={22} /> בחירת תמונה
          </Button>
          <Button class="ghost block" onClick={onDone}>
            דילוג, אעשה את זה אחר כך
          </Button>
        </div>
      ) : null}

      {step === 'crop' && img ? (
        <div class="stack">
          <p class="muted">מזיזים ומגדילים כך שהפנים בתוך המסגרת.</p>
          <Cropper img={img} view={view} setView={setView} />
          <Button class="primary block" onClick={() => void process()}>
            יצירת הדמות
          </Button>
          <Button class="ghost block" onClick={reset}>
            תמונה אחרת
          </Button>
        </div>
      ) : null}

      {step === 'work' ? (
        <div class="card" role="status" aria-live="polite">
          <ul class="progress-steps">
            {['מפרידים את הדמות מהרקע…', 'מציירים בסגנון קומיקס…', 'מסיימים…'].map((t, i) => (
              <li key={t} class={i < phase ? 'done' : i === phase ? 'on' : ''}>
                {i < phase ? '✓ ' : i === phase ? '⏳ ' : '• '}
                {t}
              </li>
            ))}
          </ul>
          <p class="hint">בפעם הראשונה זה לוקח כמה שניות: מנוע הציור נטען למכשיר.</p>
        </div>
      ) : null}

      {step === 'result' && result ? (
        <div class="stack center">
          <div style={{ display: 'grid', placeItems: 'center', margin: '8px 0' }}>
            <Avatar cut={result.url} level={level} size={240} big label="תצוגה מקדימה של הדמות" />
          </div>
          {result.oval || lastMask === 'oval' ? <p class="notice small">הפרדת הרקע לא הייתה זמינה, אז הדמות נחתכה בצורה אליפטית.</p> : null}
          {result.out.meanLuma < 0.16 ? (
            <p class="notice small">התמונה כהה מאוד. אם התוצאה לא מוצאת חן, כדאי לנסות תמונה באור טוב יותר.</p>
          ) : null}
          <p class="small muted">הרקע משתנה כשעולים בדרגות:</p>
          <div class="row" style={{ justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {BACKDROPS.map((b) => (
              <div key={b.id} style={{ textAlign: 'center' }}>
                <Avatar cut={result.url} level={b.from} size={52} label={`${b.name}, מדרגה ${b.from}`} />
                <div class="num" style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                  {b.from}+
                </div>
              </div>
            ))}
          </div>
          <Button class="primary block" busy={saving} onClick={() => void save()}>
            שמירת הדמות
          </Button>
          <Button class="block" onClick={reset}>
            ניסיון עם תמונה אחרת
          </Button>
          <Button class="ghost block" onClick={onDone}>
            דילוג
          </Button>
        </div>
      ) : null}

      {step === 'error' ? (
        <div class="card stack">
          <p class="error" role="alert">
            {ERR[err]}
          </p>
          {err === 'noperson' ? (
            <Button class="block" onClick={() => void process(true)}>
              להמשיך בכל זאת (חיתוך אליפטי)
            </Button>
          ) : null}
          <Button class="primary block" onClick={reset}>
            ניסיון נוסף
          </Button>
          <Button class="ghost block" onClick={onDone}>
            דילוג
          </Button>
        </div>
      ) : null}
    </main>
  );
}

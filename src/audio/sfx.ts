import { renderBoss, renderLevelUp, renderTick, toWav } from './synth';

export type SfxName = 'levelUp' | 'boss' | 'tick';

const render: Record<SfxName, () => Float32Array> = { levelUp: renderLevelUp, boss: renderBoss, tick: renderTick };
const VIBRATE: Record<SfxName, number[]> = { levelUp: [70, 40, 70, 40, 220], boss: [60, 50, 120], tick: [12] };

let muted = false;
let unlocked = false;
const urls = new Map<SfxName, string>();
const els = new Map<SfxName, HTMLAudioElement>();
const wavs = new Map<SfxName, ArrayBuffer>();
let ctx: AudioContext | null = null;
const decoded = new Map<SfxName, AudioBuffer>();

function wav(name: SfxName): ArrayBuffer {
  let w = wavs.get(name);
  if (!w) {
    w = toWav(render[name]());
    wavs.set(name, w);
  }
  return w;
}

function element(name: SfxName): HTMLAudioElement {
  let el = els.get(name);
  if (!el) {
    let url = urls.get(name);
    if (!url) {
      url = URL.createObjectURL(new Blob([wav(name)], { type: 'audio/wav' }));
      urls.set(name, url);
    }
    el = new Audio();
    el.preload = 'auto';
    el.src = url;
    el.dataset.sfx = name;
    els.set(name, el);
  }
  return el;
}

export function setMuted(m: boolean) {
  muted = m;
}
export const isMuted = () => muted;

/**
 * Must run inside the first user gesture: iOS only lets audio start from
 * one. Primes the audio elements silently and resumes an AudioContext.
 */
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      ctx = new AC();
      void ctx.resume().catch(() => {});
    }
  } catch {
    ctx = null;
  }
  for (const name of Object.keys(render) as SfxName[]) {
    try {
      const el = element(name);
      el.muted = true;
      const p = el.play();
      void p
        ?.then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = false;
        })
        .catch(() => {
          el.muted = false;
        });
    } catch {
      /* ignore */
    }
  }
}

async function playCtx(name: SfxName): Promise<boolean> {
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    let b = decoded.get(name);
    if (!b) {
      b = await ctx.decodeAudioData(wav(name).slice(0));
      decoded.set(name, b);
    }
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(ctx.destination);
    src.start();
    return true;
  } catch {
    return false;
  }
}

/** Play an effect: HTMLAudioElement first, AudioContext as fallback, plus vibration. */
export async function play(name: SfxName): Promise<void> {
  if (muted) return;
  try {
    navigator.vibrate?.(VIBRATE[name]);
  } catch {
    /* ignore */
  }
  try {
    const el = element(name);
    el.muted = false;
    el.currentTime = 0;
    await el.play();
    return;
  } catch {
    await playCtx(name);
  }
}

/** Pre-render in idle time so the first level-up plays instantly. */
export function warmUp() {
  const run = () => {
    for (const n of ['tick', 'levelUp', 'boss'] as SfxName[]) element(n);
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(run);
  else setTimeout(run, 1500);
}

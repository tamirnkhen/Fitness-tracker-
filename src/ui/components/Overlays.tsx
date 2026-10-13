import { useEffect, useRef } from 'preact/hooks';
import { T } from '../../i18n/he';
import { useApp, type Overlay } from '../../app/store';
import { dismissOverlay } from '../../app/actions';
import { BACKDROPS } from '../../game/backdrop';
import { BOSSES } from '../../content/bosses';
import { LEVEL_LINES, pick } from '../../content/messages';
import { Avatar, Button } from './common';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Gold particle burst on a canvas (skipped with reduced motion). */
function Particles({ colors }: { colors: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || reduced()) return;
    const g = c.getContext('2d');
    if (!g) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = (c.width = innerWidth * dpr);
    const h = (c.height = innerHeight * dpr);
    const parts = Array.from({ length: 140 }, () => {
      const a = Math.random() * Math.PI * 2;
      const v = (2 + Math.random() * 7) * dpr;
      return {
        x: w / 2,
        y: h * 0.42,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 3 * dpr,
        r: (1.5 + Math.random() * 3.5) * dpr,
        c: colors[Math.floor(Math.random() * colors.length)]!,
        life: 1,
      };
    });
    let raf = 0;
    const step = () => {
      g.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of parts) {
        if (p.life <= 0) continue;
        alive++;
        p.vy += 0.12 * dpr;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.009;
        g.globalAlpha = Math.max(0, p.life);
        g.fillStyle = p.c;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fill();
      }
      if (alive) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas class="particles" ref={ref} aria-hidden="true" style={{ width: '100%', height: '100%' }} />;
}

function LevelUp({ o }: { o: Extract<Overlay, { kind: 'levelUp' }> }) {
  const imgs = useApp((s) => s.imgs);
  const nb = o.backdrop ? BACKDROPS.find((b) => b.id === o.backdrop!.to) : null;
  return (
    <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="lu-h" data-overlay="levelUp">
      <div class="rings" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <Particles colors={['#FFD27A', '#E8B04B', '#FFF3C9', nb?.light ?? '#7FB2FF']} />
      <div class="inner">
        <div class="big" aria-hidden="true">
          {o.to}
        </div>
        <h2 id="lu-h">
          {T.levelUp.title} <span class="sr-only">{`${T.levelUp.level} ${o.to}`}</span>
        </h2>
        <p class="muted">{pick(LEVEL_LINES, o.to)}</p>
        {nb ? (
          <div data-backdrop-change={nb.id}>
            <Avatar
              cut={imgs?.cut}
              legacy={imgs?.legacy}
              level={o.to}
              prevLevel={o.from}
              size={150}
              big
              label={`${T.levelUp.newBackdrop} ${nb.name}`}
            />
            <p style={{ marginTop: '14px' }}>
              {T.levelUp.newBackdrop} <b style={{ color: nb.light }}>{nb.name}</b>
            </p>
          </div>
        ) : null}
        <Button class="primary" onClick={dismissOverlay} autoFocus>
          {T.levelUp.cont}
        </Button>
      </div>
    </div>
  );
}

function BossDown({ o }: { o: Extract<Overlay, { kind: 'boss' }> }) {
  const b = BOSSES.find((x) => x.id === o.bossId);
  return (
    <div
      class="overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bd-h"
      data-overlay="boss"
      style={{ background: 'radial-gradient(circle at 50% 40%, rgba(92,16,32,0.9), rgba(5,4,14,0.97))' }}
    >
      <div class="rings" aria-hidden="true">
        <i style={{ borderColor: 'rgba(255,94,122,0.7)' }} />
        <i style={{ borderColor: 'rgba(255,94,122,0.5)' }} />
      </div>
      <Particles colors={['#FF5E7A', '#FFD27A', '#B03A55']} />
      <div class="inner">
        <div class="big" aria-hidden="true" style={{ fontSize: '4rem' }}>
          ⚔
        </div>
        <h2 id="bd-h">{T.boss.defeated}</h2>
        <p>
          <b>{b?.name}</b>, {b?.epithet}
        </p>
        <p class="xp-tag" style={{ fontSize: '1.2rem' }}>
          {T.boss.reward(o.reward)}
        </p>
        <p class="muted small">{T.boss.next}</p>
        <Button class="primary" onClick={dismissOverlay} autoFocus>
          {T.boss.cont}
        </Button>
      </div>
    </div>
  );
}

export function Overlays() {
  const o = useApp((s) => s.overlays[0] ?? null);
  useEffect(() => {
    if (!o) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismissOverlay();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [o]);
  if (!o) return null;
  return o.kind === 'levelUp' ? <LevelUp key={`l${o.to}`} o={o} /> : <BossDown key={`b${o.bossId}`} o={o} />;
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} class={`toast ${t.tone ?? ''}`}>
          {t.icon ? <span aria-hidden="true">{t.icon}</span> : null}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

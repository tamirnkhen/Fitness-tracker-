import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef, useId } from 'preact/hooks';
import { IconClose } from './icons';
import { T } from '../../i18n/he';
import { backdropCss, backdropFor } from '../../game/backdrop';
import { safeImg } from '../../api/types';

export function Button({
  busy,
  children,
  class: cls = '',
  ...p
}: JSX.HTMLAttributes<HTMLButtonElement> & { busy?: boolean; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button type="button" {...p} class={`btn ${cls}`} disabled={p.disabled || busy} aria-busy={busy ? 'true' : undefined}>
      {busy ? <span class="spin" aria-hidden="true" /> : null}
      {busy ? T.auth.busy : children}
    </button>
  );
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Bottom sheet dialog: focus trap, Escape to close, focus returns to opener. */
export function Sheet({
  title,
  onClose,
  children,
  closable = true,
}: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  closable?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[autofocus]') ?? el?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable) {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab' && el) {
        const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!items.length) return;
        const a = items[0]!;
        const b = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const body = document.body;
    const overflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, []);
  return (
    <div class="backdrop-dim" onClick={(e) => closable && e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <div class="grab" aria-hidden="true" />
        <div class="sheet-head">
          <h2 id={id}>{title}</h2>
          {closable ? (
            <button type="button" class="iconbtn" onClick={onClose} aria-label={T.common.close}>
              <IconClose width={22} height={22} />
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function XpBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div class="xpbar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
      <div style={{ width: `${Math.max(2, pct * 100)}%` }} />
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      class="switch"
      aria-checked={checked ? 'true' : 'false'}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  );
}

const Silhouette = () => (
  <svg class="sil" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="36" r="20" fill="rgba(255,255,255,0.35)" />
    <path d="M10 100c4-24 20-36 40-36s36 12 40 36z" fill="rgba(255,255,255,0.35)" />
  </svg>
);

/**
 * The hero portrait: the rank backdrop is a CSS layer *behind* the
 * transparent cut-out, so a level-up changes it instantly.
 */
export function Avatar({
  cut,
  legacy,
  level,
  size,
  big,
  label,
  prevLevel,
}: {
  cut?: string | null | undefined;
  legacy?: string | null | undefined;
  level: number;
  size: number;
  big?: boolean;
  label: string;
  prevLevel?: number;
}) {
  const src = safeImg(cut ?? null);
  const old = safeImg(legacy ?? null);
  const bd = backdropFor(level);
  const prev = prevLevel !== undefined ? backdropFor(prevLevel) : null;
  return (
    <div
      class={`avatar${big ? ' big' : ''}${prev ? ' bd-swap' : ''}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      role="img"
      aria-label={label}
      data-backdrop={bd.id}
    >
      {src || !old ? (
        <>
          {prev ? <div class="bdlayer" style={{ background: backdropCss(prev) }} /> : null}
          <div class={`bdlayer${prev ? ' new' : ''}`} style={{ background: backdropCss(bd) }} />
        </>
      ) : null}
      {src ? <img src={src} alt="" draggable={false} /> : old ? <img src={old} alt="" draggable={false} /> : <Silhouette />}
    </div>
  );
}

/** Party member portrait: thumbnail data URL or initial. */
export function Thumb({ src, name, size = 44 }: { src: string | null; name: string; size?: number }) {
  const ok = safeImg(src);
  return (
    <div class="avatar" style={{ width: `${size}px`, height: `${size}px`, borderRadius: '12px', background: '#241f47' }} aria-hidden="true">
      {ok ? (
        <img src={ok} alt="" />
      ) : (
        <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 700, color: '#ffd27a' }}>
          {[...name][0] ?? '?'}
        </span>
      )}
    </div>
  );
}

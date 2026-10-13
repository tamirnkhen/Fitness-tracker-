export type BackdropId = 'blue' | 'deepblue' | 'purple' | 'deeppurple' | 'bordeaux' | 'darkbordeaux';

export interface Backdrop {
  id: BackdropId;
  /** first level of this tier */
  from: number;
  name: string;
  /** centre / edge colours of the radial gradient */
  light: string;
  base: string;
  dark: string;
}

/** Rank backdrops. The character cut-out is drawn on top at display time. */
export const BACKDROPS: Backdrop[] = [
  { id: 'blue', from: 1, name: 'כחול השחר', light: '#5AAEDB', base: '#2B7FB0', dark: '#123A57' },
  { id: 'deepblue', from: 10, name: 'כחול העומק', light: '#2F6C96', base: '#14405F', dark: '#081B2B' },
  { id: 'purple', from: 20, name: 'סגול המסדר', light: '#9469CC', base: '#6B3FA0', dark: '#2D1650' },
  { id: 'deeppurple', from: 30, name: 'סגול הלילה', light: '#6440A0', base: '#3D1F66', dark: '#170A2C' },
  { id: 'bordeaux', from: 40, name: 'ארגמן האלופים', light: '#D9667F', base: '#B03A55', dark: '#4E1222' },
  { id: 'darkbordeaux', from: 50, name: 'בורדו האגדה', light: '#8E2A3E', base: '#5C1020', dark: '#22040B' },
];

export function backdropFor(level: number): Backdrop {
  const l = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  let b = BACKDROPS[0] as Backdrop;
  for (const x of BACKDROPS) if (l >= x.from) b = x;
  return b;
}

/** CSS background for a backdrop: soft radial gradient + vignette. */
export function backdropCss(b: Backdrop): string {
  return [
    `radial-gradient(ellipse at 50% 120%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 55%)`,
    `radial-gradient(circle at 50% 38%, ${b.light} 0%, ${b.base} 46%, ${b.dark} 100%)`,
  ].join(', ');
}

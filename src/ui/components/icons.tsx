import type { JSX } from 'preact';
import type { RealmId } from '../../game/types';

type P = JSX.SVGAttributes<SVGSVGElement>;
const base = (p: P) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.8,
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
  'aria-hidden': true,
  focusable: 'false',
  ...p,
});

export const IconCheck = (p: P) => (
  <svg {...base(p)} stroke-width={3}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconSword = (p: P) => (
  <svg {...base(p)}>
    <path d="M14.5 3.5H20v5.5L9 20l-5-5L14.5 3.5z" />
    <path d="M6 13l5 5M3 21l3-3" />
  </svg>
);
export const IconMap = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" />
    <path d="M9 4v13M15 6.5v13" />
  </svg>
);
export const IconShield = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    <circle cx="12" cy="10" r="2.5" />
    <path d="M8 16c1-2 2.4-3 4-3s3 1 4 3" />
  </svg>
);
export const IconFlame = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3c1 4 5 5.5 5 10a5 5 0 01-10 0c0-2.5 1.5-3.5 2-5 .8 1.2 1.5 1.7 2.3 1.9C11 7.5 11 5.5 12 3z" />
  </svg>
);
export const IconPlus = (p: P) => (
  <svg {...base(p)} stroke-width={2.4}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconMinus = (p: P) => (
  <svg {...base(p)} stroke-width={2.4}>
    <path d="M5 12h14" />
  </svg>
);
export const IconFocus = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
  </svg>
);
export const IconShare = (p: P) => (
  <svg {...base(p)}>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
  </svg>
);
export const IconCamera = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);
export const IconImage = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 16l-5-5-9 9" />
  </svg>
);
export const IconChevron = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

/** Three chevrons over an XP bar: the brand mark. */
export const Logo = (p: P) => (
  <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" {...p}>
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#FFD27A" />
        <stop offset="1" stop-color="#E8B04B" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="16" fill="#1a1636" stroke="#8c6a2c" stroke-width="2" />
    <g fill="none" stroke="url(#lg)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 24l14-9 14 9" opacity="0.55" />
      <path d="M18 33l14-9 14 9" opacity="0.8" />
      <path d="M18 42l14-9 14 9" />
    </g>
    <rect x="14" y="48" width="36" height="5" rx="2.5" fill="#0f0c24" />
    <rect x="14" y="48" width="24" height="5" rx="2.5" fill="url(#lg)" />
  </svg>
);

const REALM_PATHS: Record<RealmId, JSX.Element> = {
  mind: (
    <>
      <path d="M12 4a6 6 0 00-6 6c0 2.2 1.2 3.5 2 4.5V18h8v-3.5c.8-1 2-2.3 2-4.5a6 6 0 00-6-6z" />
      <path d="M10 21h4M12 8v4M10 10h4" />
    </>
  ),
  body: (
    <>
      <path d="M6 9v6M18 9v6M3 10.5v3M21 10.5v3M6 12h12" />
    </>
  ),
  career: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5h6v2M3 13h18" />
    </>
  ),
  relationships: (
    <>
      <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" />
    </>
  ),
  discipline: (
    <>
      <path d="M4 20V9l8-5 8 5v11" />
      <path d="M9 20v-6h6v6M4 9h16" />
    </>
  ),
  adventure: (
    <>
      <path d="M3 20l6-11 4 6 3-4 5 9z" />
      <circle cx="17" cy="6" r="2" />
    </>
  ),
};

export const RealmIcon = ({ realm, ...p }: P & { realm: RealmId }) => <svg {...base(p)}>{REALM_PATHS[realm]}</svg>;

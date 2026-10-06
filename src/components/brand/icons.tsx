import type { Domain, TaskKind } from "@/lib/game/domains";

// Icon system from the Brand Book. Rule: a dashed stroke always means
// "not fixed / personal" — the random bonus and the personal-domain icons.

const GOLD = "#D9A441";
type IconProps = { size?: number; className?: string; title?: string };

function Svg({ size = 24, className, title, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {children}
    </svg>
  );
}

/* ---------- Task types ---------- */

export function DailyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="24" cy="24" r="17" fill="none" stroke={GOLD} strokeWidth="3" />
      <circle cx="24" cy="24" r="6.5" fill={GOLD} />
    </Svg>
  );
}

export function WeeklyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="13" y="6" width="3" height="36" fill={GOLD} />
      <path d="M16 7 H37 L30 15 L37 23 H16 Z" fill={GOLD} />
    </Svg>
  );
}

export function BonusIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M24 3 L45 24 L24 45 L3 24 Z" fill="none" stroke={GOLD} strokeWidth="2.5" strokeDasharray="5 3.5" />
      <text x="24" y="31" textAnchor="middle" fontFamily="var(--font-poppins), sans-serif" fontWeight="800" fontSize="20" fill={GOLD}>
        ?
      </text>
    </Svg>
  );
}

export function MilestoneIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M24 4 L29.5 18 L44 18.5 L32.5 27.5 L36.5 42 L24 33.5 L11.5 42 L15.5 27.5 L4 18.5 L18.5 18 Z" fill={GOLD} />
    </Svg>
  );
}

export function TaskKindIcon({ kind, ...p }: IconProps & { kind: TaskKind }) {
  switch (kind) {
    case "daily":
      return <DailyIcon {...p} />;
    case "weekly":
      return <WeeklyIcon {...p} />;
    case "bonus":
      return <BonusIcon {...p} />;
    case "manual":
      return <PersonalIcon {...p} />;
  }
}

/* ---------- Domains ---------- */

export function SubconsciousIcon(p: IconProps) {
  // Iceberg: a small visible tip above the waterline, a large dim mass below.
  return (
    <Svg {...p}>
      <path d="M24 5 L30 19 H18 Z" fill={GOLD} />
      <path d="M8 19 H40 L24 44 Z" fill={GOLD} opacity="0.35" />
      <line x1="4" y1="19" x2="44" y2="19" stroke="#8A8890" strokeWidth="1.2" />
    </Svg>
  );
}

export function HealthIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="15" width="10" height="18" rx="2.5" fill={GOLD} />
      <rect x="34" y="15" width="10" height="18" rx="2.5" fill={GOLD} />
      <rect x="14" y="22" width="20" height="4" fill={GOLD} />
    </Svg>
  );
}

export function DisciplineIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M24 4 L37 10 V26 L24 44 L11 26 V10 Z" fill="none" stroke={GOLD} strokeWidth="2.6" strokeLinejoin="round" />
    </Svg>
  );
}

export function DirectionIcon(p: IconProps) {
  // Pen — writing, journaling, reflection.
  return (
    <Svg {...p}>
      <line x1="38" y1="5" x2="14" y2="36" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
      <path d="M14 36 L11 42 L17 39 Z" fill={GOLD} />
      <line x1="9" y1="45" x2="22" y2="45" stroke={GOLD} strokeWidth="2.4" />
    </Svg>
  );
}

export function PersonalIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="24" cy="24" r="19" fill="none" stroke={GOLD} strokeWidth="2.6" strokeDasharray="5 4" />
      <rect x="22.5" y="13" width="3" height="22" fill={GOLD} />
      <rect x="13" y="22.5" width="22" height="3" fill={GOLD} />
    </Svg>
  );
}

export function DomainIcon({ domain, ...p }: IconProps & { domain: Domain }) {
  switch (domain) {
    case "health":
      return <HealthIcon {...p} />;
    case "direction":
      return <DirectionIcon {...p} />;
    case "subconscious":
      return <SubconsciousIcon {...p} />;
    case "discipline":
      return <DisciplineIcon {...p} />;
    case "personal":
      return <PersonalIcon {...p} />;
  }
}

// The four pillars + personal domains, as defined in the brand book.
export const DOMAINS = ["health", "direction", "subconscious", "discipline", "personal"] as const;
export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_INFO: Record<Domain, { label: string; hint: string }> = {
  health: { label: "בריאות", hint: "אימון, תזונה, שינה" },
  direction: { label: "כיוון", hint: "כתיבה, יומן, תוכן, רפלקציה" },
  subconscious: { label: "תת מודע", hint: "מדיטציה, ויזואליזציה" },
  discipline: { label: "משמעת עצמית", hint: "הרגלים, עמידה ביעד" },
  personal: { label: "תחום אישי", hint: "תחומים שמוסיפים לבד" },
};

export function isDomain(value: unknown): value is Domain {
  return typeof value === "string" && (DOMAINS as readonly string[]).includes(value);
}

export function domainLabel(domain: Domain, customLabel?: string | null): string {
  return domain === "personal" && customLabel ? customLabel : DOMAIN_INFO[domain].label;
}

export const TASK_KINDS = ["daily", "weekly", "bonus", "manual"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_KIND_INFO: Record<TaskKind, { label: string; range: string }> = {
  daily: { label: "יומית", range: "‎+2 עד ‎+10" },
  weekly: { label: "שבועית", range: "‎+15 עד ‎+30" },
  bonus: { label: "בונוס אקראית", range: "עד ‎+50 · Risk" },
  manual: { label: "משימה אישית", range: "‎+2 עד ‎+10" },
};

// XP ranges per task kind. Mirrors the CHECK constraints in the database.
export const XP_RANGE = {
  daily: { min: 2, max: 10 },
  weekly: { min: 15, max: 30 },
  bonus: { min: 10, max: 50 },
  manual: { min: 2, max: 10 },
} as const satisfies Record<TaskKind, { min: number; max: number }>;

export function clampXp(kind: TaskKind, xp: number): number {
  const { min, max } = XP_RANGE[kind];
  if (!Number.isFinite(xp)) return min;
  return Math.min(max, Math.max(min, Math.round(xp)));
}

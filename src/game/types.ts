export const REALM_IDS = ['mind', 'body', 'career', 'relationships', 'discipline', 'adventure'] as const;
export type RealmId = (typeof REALM_IDS)[number];

export const STRUGGLE_IDS = ['procrastination', 'energy', 'time', 'focus', 'consistency', 'fear', 'mood'] as const;
export type StruggleId = (typeof STRUGGLE_IDS)[number];

/** YYYY-MM-DD in the player's local calendar. */
export type DayKey = string;

export type QuestKind = 'check' | 'text' | 'count';
export type QuestSource = 'track' | 'side' | 'wild' | 'creator' | 'micro';

export interface QuestTemplate {
  id: string;
  realm: RealmId;
  kind: QuestKind;
  title: string;
  desc?: string;
  xp: number;
  /** count quests */
  target?: number;
  unit?: string;
  /** text quests: placeholder / question */
  prompt?: string;
  /** text answers also go to the journal */
  journal?: boolean;
  minLevel?: number;
}

export interface Quest {
  id: string;
  tpl: string;
  source: QuestSource;
  realm: RealmId;
  kind: QuestKind;
  title: string;
  desc?: string;
  xp: number;
  target?: number;
  unit?: string;
  prompt?: string;
  journal?: boolean;
  tier?: number;
  progress?: number;
  /** text answer / creator mission */
  text?: string;
  /** hits the current boss's weak point (double damage) */
  weak?: boolean;
  eased?: boolean;
  done: boolean;
  doneAt?: number;
  gained?: number;
}

export interface DayRecord {
  xp: number;
  done: number;
  total: number;
}

export interface Adapt {
  tier: number;
  hits: number;
  misses: number;
}

export interface BossState {
  id: string;
  hp: number;
  max: number;
  since: DayKey;
}

export interface Profile {
  heroName: string;
  focus: RealmId[];
  struggles: StruggleId[];
  minutes: 10 | 20 | 40;
  goal: string;
  block: string;
  onboarded: boolean;
}

export interface Reminders {
  on: boolean;
  morning: string; // HH:MM
  evening: string; // HH:MM
}

export interface CharMeta {
  imgV: number;
  /** true when only a legacy image with a baked-in background exists */
  legacy: boolean;
  style: number;
}

export interface GameState {
  v: 2;
  seed: string;
  createdAt: number;
  updatedAt: number;
  profile: Profile;
  xp: number;
  realmXp: Record<RealmId, number>;
  streak: { count: number; best: number; last: DayKey | null; shields: number };
  day: { key: DayKey; quests: Quest[]; returning: boolean; perfect: boolean } | null;
  history: Record<DayKey, DayRecord>;
  adapt: Record<RealmId, Adapt>;
  boss: BossState | null;
  bossesDefeated: string[];
  ach: Record<string, number>;
  title: string;
  journal: { day: DayKey; text: string; at: number; q?: string }[];
  counters: {
    quests: number;
    text: number;
    creator: number;
    wild: number;
    micro: number;
    eased: number;
    perfectDays: number;
    comebacks: number;
    perRealm: Record<RealmId, number>;
  };
  settings: { mute: boolean; reminders: Reminders | null; focusMode: boolean };
  char: CharMeta | null;
  seenBroadcast: string;
}

export type GameEvent =
  | { type: 'xp'; amount: number; questId?: string }
  | { type: 'levelUp'; from: number; to: number }
  | { type: 'backdrop'; from: string; to: string }
  | { type: 'bossHit'; damage: number; weak: boolean }
  | { type: 'bossDefeated'; bossId: string; reward: number }
  | { type: 'newBoss'; bossId: string }
  | { type: 'achievement'; id: string }
  | { type: 'title'; id: string }
  | { type: 'perfectDay'; bonus: number }
  | { type: 'streak'; count: number }
  | { type: 'shieldEarned' }
  | { type: 'shieldUsed'; days: number }
  | { type: 'streakLost'; was: number }
  | { type: 'returning' };

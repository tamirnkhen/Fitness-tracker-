import type { RealmId } from '../game/types';

/** Snapshot of the numbers titles and achievements are judged on. */
export interface Stats {
  level: number;
  xp: number;
  streak: number;
  streakBest: number;
  quests: number;
  text: number;
  creator: number;
  wild: number;
  micro: number;
  eased: number;
  perfectDays: number;
  comebacks: number;
  bosses: number;
  journal: number;
  perRealm: Record<RealmId, number>;
  maxTier: number;
  realmsTouched: number;
  hasCharacter: boolean;
  inParty: boolean;
}

export interface Title {
  id: string;
  name: string;
  how: string;
  test: (s: Stats) => boolean;
}

export const TITLES: Title[] = [
  { id: 'wanderer', name: 'נווד', how: 'כל מסע מתחיל כאן', test: () => true },
  { id: 'apprentice', name: 'חניך', how: 'דרגה 3', test: (s) => s.level >= 3 },
  { id: 'seeker', name: 'מחפש דרך', how: 'דרגה 5', test: (s) => s.level >= 5 },
  { id: 'adventurer', name: 'הרפתקן', how: 'דרגה 10', test: (s) => s.level >= 10 },
  { id: 'knight', name: 'אביר', how: 'דרגה 15', test: (s) => s.level >= 15 },
  { id: 'champion', name: 'אלוף', how: 'דרגה 20', test: (s) => s.level >= 20 },
  { id: 'warden', name: 'שומר הממלכה', how: 'דרגה 30', test: (s) => s.level >= 30 },
  { id: 'archon', name: 'ארכון', how: 'דרגה 40', test: (s) => s.level >= 40 },
  { id: 'legend', name: 'אגדה חיה', how: 'דרגה 50', test: (s) => s.level >= 50 },
  { id: 'flame', name: 'נושא הלהבה', how: 'רצף של 7 ימים', test: (s) => s.streakBest >= 7 },
  { id: 'unbroken', name: 'הבלתי נשבר', how: 'רצף של 30 ימים', test: (s) => s.streakBest >= 30 },
  { id: 'eternal', name: 'האש הנצחית', how: 'רצף של 100 ימים', test: (s) => s.streakBest >= 100 },
  { id: 'ironbody', name: 'גוף של ברזל', how: '30 משימות גוף', test: (s) => s.perRealm.body >= 30 },
  { id: 'sage', name: 'חכם המגדל', how: '30 משימות תודעה', test: (s) => s.perRealm.mind >= 30 },
  { id: 'builder', name: 'בונה העתיד', how: '30 משימות קריירה', test: (s) => s.perRealm.career >= 30 },
  { id: 'heart', name: 'לב זהב', how: '30 משימות קשרים', test: (s) => s.perRealm.relationships >= 30 },
  { id: 'monk', name: 'נזיר ההרגלים', how: '30 משימות משמעת', test: (s) => s.perRealm.discipline >= 30 },
  { id: 'explorer', name: 'חוקר ההרים', how: '30 משימות הרפתקה', test: (s) => s.perRealm.adventure >= 30 },
  { id: 'slayer', name: 'קוטל המפלצות', how: 'לנצח 3 בוסים', test: (s) => s.bosses >= 3 },
  { id: 'scribe', name: 'כותב הכרוניקות', how: '20 רשומות ביומן', test: (s) => s.journal >= 20 },
  { id: 'creator', name: 'היוצר', how: '10 משימות יוצר', test: (s) => s.creator >= 10 },
  { id: 'phoenix', name: 'עוף החול', how: 'לחזור למסע 3 פעמים', test: (s) => s.comebacks >= 3 },
  { id: 'perfectionist', name: 'מושלם', how: '10 ימים מושלמים', test: (s) => s.perfectDays >= 10 },
  { id: 'balanced', name: 'שומר האיזון', how: '10 משימות בכל תחום', test: (s) => Object.values(s.perRealm).every((n) => n >= 10) },
];

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  xp: number;
  test: (s: Stats) => boolean;
}

export const ACH: Achievement[] = [
  { id: 'first', name: 'הצעד הראשון', desc: 'להשלים משימה ראשונה', icon: '👣', xp: 10, test: (s) => s.quests >= 1 },
  { id: 'ten', name: 'עשר', desc: '10 משימות', icon: '🔟', xp: 15, test: (s) => s.quests >= 10 },
  { id: 'fifty', name: 'חמישים', desc: '50 משימות', icon: '🏅', xp: 30, test: (s) => s.quests >= 50 },
  { id: 'hundred', name: 'מאה', desc: '100 משימות', icon: '💯', xp: 50, test: (s) => s.quests >= 100 },
  { id: 'fivehundred', name: 'חמש מאות', desc: '500 משימות', icon: '👑', xp: 100, test: (s) => s.quests >= 500 },
  { id: 'streak3', name: 'ניצוץ', desc: 'רצף של 3 ימים', icon: '✨', xp: 15, test: (s) => s.streakBest >= 3 },
  { id: 'streak7', name: 'שבוע של אש', desc: 'רצף של 7 ימים', icon: '🔥', xp: 30, test: (s) => s.streakBest >= 7 },
  { id: 'streak30', name: 'חודש של ברזל', desc: 'רצף של 30 ימים', icon: '⚔️', xp: 80, test: (s) => s.streakBest >= 30 },
  { id: 'perfect', name: 'יום מושלם', desc: 'להשלים את כל משימות היום', icon: '🌟', xp: 15, test: (s) => s.perfectDays >= 1 },
  { id: 'perfect7', name: 'שבוע מושלם', desc: '7 ימים מושלמים', icon: '💎', xp: 40, test: (s) => s.perfectDays >= 7 },
  { id: 'boss1', name: 'קוטל ראשון', desc: 'לנצח בוס', icon: '🗡️', xp: 25, test: (s) => s.bosses >= 1 },
  { id: 'boss5', name: 'צייד בוסים', desc: 'לנצח 5 בוסים', icon: '🐉', xp: 60, test: (s) => s.bosses >= 5 },
  { id: 'journal1', name: 'הדף הראשון', desc: 'רשומה ראשונה ביומן', icon: '📜', xp: 10, test: (s) => s.journal >= 1 },
  { id: 'journal30', name: 'כרוניקה', desc: '30 רשומות ביומן', icon: '📚', xp: 40, test: (s) => s.journal >= 30 },
  { id: 'wild', name: 'קלף פרא', desc: 'להשלים קלף פרא', icon: '🃏', xp: 15, test: (s) => s.wild >= 1 },
  { id: 'creator', name: 'היוצר', desc: 'משימת יוצר ראשונה', icon: '🛠️', xp: 15, test: (s) => s.creator >= 1 },
  { id: 'comeback', name: 'חזרה גדולה', desc: 'לחזור אחרי הפסקה ולהשלים משימה', icon: '🦅', xp: 20, test: (s) => s.comebacks >= 1 },
  { id: 'honest', name: 'כנות', desc: 'להקטין משימה במקום לוותר', icon: '🤝', xp: 10, test: (s) => s.eased >= 1 },
  { id: 'tier3', name: 'מדורה', desc: 'להגיע לשלב 4 במסלול', icon: '🏔️', xp: 30, test: (s) => s.maxTier >= 3 },
  { id: 'allrealms', name: 'שש ממלכות', desc: 'משימה בכל אחד מששת התחומים', icon: '🗺️', xp: 25, test: (s) => s.realmsTouched >= 6 },
  { id: 'hero', name: 'יש לי פנים', desc: 'ליצור את הדמות', icon: '🎨', xp: 10, test: (s) => s.hasCharacter },
  { id: 'party', name: 'חבורה', desc: 'להצטרף לקבוצה', icon: '🛡️', xp: 10, test: (s) => s.inParty },
  { id: 'level10', name: 'דו-ספרתי', desc: 'דרגה 10', icon: '🔷', xp: 0, test: (s) => s.level >= 10 },
  { id: 'level25', name: 'רבע מאה', desc: 'דרגה 25', icon: '🔮', xp: 0, test: (s) => s.level >= 25 },
  { id: 'level50', name: 'הפסגה', desc: 'דרגה 50', icon: '🏆', xp: 0, test: (s) => s.level >= 50 },
];

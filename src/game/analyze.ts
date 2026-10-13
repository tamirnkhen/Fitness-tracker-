import type { RealmId, StruggleId } from './types';
import { REALM_IDS } from './types';
import { REALMS } from '../content/realms';

const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };

/** Lower-case, strip niqqud/punctuation, normalise Hebrew final letters. */
export function normalizeHe(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINALS[c] ?? c)
    .replace(/[^\p{L}\p{N}\s"']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PREFIXES = ['ו', 'ה', 'ב', 'ל', 'מ', 'ש', 'כ'];

/** A token and its forms with up to two Hebrew prefix letters removed. */
function forms(tok: string): string[] {
  const out = [tok];
  let t = tok;
  for (let i = 0; i < 2; i++) {
    if (t.length > 3 && PREFIXES.includes(t[0]!)) {
      t = t.slice(1);
      out.push(t);
    } else break;
  }
  return out;
}

export function matchKeyword(text: string, keyword: string): boolean {
  const k = normalizeHe(keyword);
  if (!k) return false;
  const t = normalizeHe(text);
  if (k.includes(' ')) return (' ' + t + ' ').includes(' ' + k);
  // Short stems are noisy ("הר" in "הרבה", "אח" in "אחרי"): be stricter with them.
  const hit = (f: string) =>
    k.length <= 2 ? f === k : k.length === 3 ? f === k || (f.startsWith(k) && f.length <= k.length + 2) : f.startsWith(k);
  return t.split(' ').some((tok) => forms(tok).some(hit));
}

export const STRUGGLE_KEYWORDS: Record<StruggleId, string[]> = {
  procrastination: ['דחיינ', 'דוחה', 'לדחות', 'דחייה', 'מחר', 'אחר כך', 'מתעצל', 'עצל', 'עצלנ', 'להתחיל', 'מתחיל', 'procrast', 'lazy'],
  energy: ['כוח', 'עייף', 'עייפות', 'אנרגי', 'מותש', 'תשוש', 'ישנוני', 'שינה', 'לישון', 'גמור', 'tired', 'energy'],
  time: ['זמן', 'עסוק', 'עמוס', 'לחץ', 'לחוץ', 'ילדים', 'משמרות', 'שעות', 'busy', 'time'],
  focus: [
    'טלפון',
    'מסך',
    'מסכים',
    'נייד',
    'רשתות',
    'אינסטגרם',
    'טיקטוק',
    'יוטיוב',
    'נטפליקס',
    'ריכוז',
    'פוקוס',
    'מתפזר',
    'מוסח',
    'הסח',
    'גלילה',
    'phone',
    'focus',
    'scroll',
  ],
  consistency: ['התמד', 'להתמיד', 'עקבי', 'עקביות', 'נשבר', 'מפסיק', 'מוותר', 'לוותר', 'שגרה', 'רצף', 'מתלהב', 'נמאס', 'consisten', 'quit'],
  fear: [
    'פחד',
    'מפחד',
    'פוחד',
    'חושש',
    'חשש',
    'ביטחון',
    'בטחון',
    'בושה',
    'מתבייש',
    'כישלון',
    'להיכשל',
    'מושלם',
    'פרפקציוניז',
    'ספק',
    'fear',
    'afraid',
  ],
  mood: ['עצוב', 'עצב', 'דיכאון', 'מדוכא', 'מצב רוח', 'בדידות', 'בודד', 'חרדה', 'חרד', 'רע לי', 'ריקנות', 'אפור', 'sad', 'depress', 'anxi'],
};

export interface Analysis {
  realms: RealmId[];
  scores: Record<RealmId, number>;
  struggles: StruggleId[];
  minutes: 10 | 20 | 40 | null;
  hints: string[];
}

/** Topic hints the summary can speak back to the player. */
const HINTS: { id: string; words: string[] }[] = [
  { id: 'sleep', words: ['שינה', 'לישון', 'ישן', 'להירדם', 'sleep'] },
  { id: 'phone', words: ['טלפון', 'מסך', 'מסכים', 'רשתות', 'טיקטוק', 'אינסטגרם', 'גלילה'] },
  { id: 'reading', words: ['ספר', 'ספרים', 'לקרוא', 'קריאה'] },
  { id: 'fitness', words: ['כושר', 'להתאמן', 'אימונ', 'ספורט', 'לרוץ', 'ריצה', 'חדר כושר'] },
  { id: 'weight', words: ['משקל', 'לרזות', 'דיאט', 'לרדת'] },
  { id: 'money', words: ['כסף', 'לחסוך', 'חיסכון', 'חובות', 'משכורת'] },
  { id: 'job', words: ['עבודה חדשה', 'ראיון', 'קורות חיים', 'קידום', 'משרה'] },
  { id: 'study', words: ['מבחן', 'בחינ', 'תואר', 'ללמוד', 'לימודים'] },
  { id: 'lonely', words: ['בודד', 'בדידות', 'חברים', 'להכיר'] },
  { id: 'family', words: ['משפחה', 'הורים', 'ילדים', 'אמא', 'אבא'] },
  { id: 'anxiety', words: ['חרדה', 'לחץ', 'לחוץ', 'מתח', 'שקט'] },
];

export function localAnalyze(text: string): Analysis {
  const scores = Object.fromEntries(REALM_IDS.map((r) => [r, 0])) as Record<RealmId, number>;
  for (const r of REALM_IDS) {
    for (const k of REALMS[r].keywords) if (matchKeyword(text, k)) scores[r] += k.length >= 5 ? 2 : 1;
  }
  const realms = REALM_IDS.filter((r) => scores[r] > 0).sort((a, b) => scores[b] - scores[a]);
  const sScores: [StruggleId, number][] = (Object.keys(STRUGGLE_KEYWORDS) as StruggleId[]).map((id) => [
    id,
    STRUGGLE_KEYWORDS[id].filter((k) => matchKeyword(text, k)).length,
  ]);
  const struggles = sScores
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  const t = normalizeHe(text);
  let minutes: Analysis['minutes'] = null;
  const m = t.match(/(\d{1,3})\s*דק/);
  if (m) {
    const n = Number(m[1]);
    minutes = n <= 12 ? 10 : n < 35 ? 20 : 40;
  } else if (/חצי שעה/.test(t)) minutes = 20;
  else if (/שעה|שעתיים/.test(t)) minutes = 40;
  const hints = HINTS.filter((h) => h.words.some((w) => matchKeyword(text, w))).map((h) => h.id);
  return { realms, scores, struggles, minutes, hints };
}

/** Words that mark an input as a sentence/answer rather than a name. */
const NOT_NAME = new Set(
  [
    'אין',
    'לי',
    'לא',
    'יודע',
    'יודעת',
    'רוצה',
    'רוצים',
    'כוח',
    'אני',
    'שלי',
    'זה',
    'זאת',
    'מה',
    'כי',
    'אבל',
    'גם',
    'עם',
    'של',
    'את',
    'יש',
    'היה',
    'הייתי',
    'צריך',
    'צריכה',
    'קשה',
    'בעיה',
    'זמן',
    'עייף',
    'עייפה',
    'מרגיש',
    'מרגישה',
    'תמיד',
    'אף',
    'פעם',
    'כן',
    'אולי',
    'סתם',
    'בסדר',
    'טוב',
    'רע',
    'מאוד',
    'הכי',
    'להיות',
    'לעשות',
    'שאני',
    'אותי',
    'כלום',
    'משהו',
    'עוד',
    'רק',
    'הרבה',
    'קצת',
    'יותר',
    'פחות',
    'עכשיו',
    'היום',
    'מחר',
    'אתמול',
    'לשפר',
    'לשנות',
    'שלום',
    'היי',
    'הי',
    'תודה',
    'אוקיי',
    'אוקי',
    'נו',
    'אז',
    'למה',
    'איך',
    'מתי',
    'איפה',
    'שם',
    'השם',
    'קוראים',
    'נכון',
  ].map(normalizeHe),
);

export type NameCheck = { ok: true; name: string } | { ok: false; reason: 'empty' | 'short' | 'long' | 'chars' | 'words' | 'sentence' };

/**
 * validateHeroName: the hero's name must look like a name. Answers such as
 * "אין לי כוח" are rejected, so another question's answer never becomes the name.
 */
export function validateHeroName(input: string): NameCheck {
  const name = (input || '').replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, reason: 'empty' };
  if ([...name].length < 2) return { ok: false, reason: 'short' };
  if ([...name].length > 20) return { ok: false, reason: 'long' };
  if (!/^[\p{L}\s'"׳״\-.]+$/u.test(name)) return { ok: false, reason: 'chars' };
  const words = name.split(' ');
  if (words.length > 3) return { ok: false, reason: 'words' };
  if (words.some((w) => NOT_NAME.has(normalizeHe(w)))) return { ok: false, reason: 'sentence' };
  return { ok: true, name };
}

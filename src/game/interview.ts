import type { RealmId, StruggleId } from './types';
import { REALM_IDS, STRUGGLE_IDS } from './types';
import { localAnalyze, validateHeroName, type NameCheck } from './analyze';
import { REALMS } from '../content/realms';
import { BOSSES } from '../content/bosses';
import { questCount } from './day';

/**
 * The onboarding interview with the Quest Master. A pure state machine:
 * no network, no AI. Every step accepts only its own kind of answer;
 * the hero's name is asked explicitly and validated, so an answer to
 * another question can never become the name.
 */
export type Step = 'name' | 'goal' | 'goalRealm' | 'block' | 'blockPick' | 'time' | 'done';

export interface Chip {
  id: string;
  label: string;
}

export interface BotMsg {
  text: string;
  tone?: 'normal' | 'summary' | 'boss';
}

export interface Prompt {
  input: 'text' | 'chips' | 'both' | 'none';
  placeholder?: string;
  chips?: Chip[];
  multi?: boolean;
  maxLen?: number;
}

export interface Interview {
  step: Step;
  name: string;
  goal: string;
  block: string;
  focus: RealmId[];
  struggles: StruggleId[];
  minutes: 10 | 20 | 40;
  hints: string[];
  suggestedMinutes: 10 | 20 | 40 | null;
  tries: number;
}

export interface Answer {
  text?: string;
  chips?: string[];
}

export interface Turn {
  iv: Interview;
  msgs: BotMsg[];
  prompt: Prompt;
}

export const STRUGGLE_LABELS: Record<StruggleId, string> = {
  procrastination: 'דחיינות',
  energy: 'חוסר אנרגיה',
  time: 'אין זמן',
  focus: 'טלפון ומסכים',
  consistency: 'קשה להתמיד',
  fear: 'פחד / חוסר ביטחון',
  mood: 'מצב רוח',
};

const realmChips = (): Chip[] => REALM_IDS.map((r) => ({ id: r, label: REALMS[r].name }));
const struggleChips = (): Chip[] => STRUGGLE_IDS.map((s) => ({ id: s, label: STRUGGLE_LABELS[s] }));
const timeChips = (): Chip[] => [
  { id: '10', label: '10 דקות' },
  { id: '20', label: '20 דקות' },
  { id: '40', label: '40 דקות ומעלה' },
];

const NAME_REASON: Record<Exclude<NameCheck, { ok: true }>['reason'], string> = {
  empty: 'צריך שם. אפשר גם כינוי.',
  short: 'קצר מדי. לפחות שתי אותיות.',
  long: 'ארוך מדי. עד 20 תווים.',
  chars: 'רק אותיות ורווחים, בלי מספרים וסימנים.',
  words: 'עד שלוש מילים, בבקשה.',
  sentence: 'זה נשמע לי כמו משפט ולא כמו שם. איך יקראו לגיבור? למשל: נועה, אלון, או כינוי כמו "הנשר".',
};

export function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return items.slice(0, -1).join(', ') + ' ו' + items[items.length - 1];
}

function snippet(s: string, n = 60): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

function namePrompt(accountName?: string): Prompt {
  const v = accountName ? validateHeroName(accountName) : null;
  return {
    input: 'both',
    placeholder: 'שם הגיבור',
    maxLen: 20,
    chips: v && v.ok ? [{ id: 'account', label: v.name }] : [],
  };
}

export function startInterview(accountName?: string): Turn {
  const iv: Interview = {
    step: 'name',
    name: '',
    goal: '',
    block: '',
    focus: [],
    struggles: [],
    minutes: 20,
    hints: [],
    suggestedMinutes: null,
    tries: 0,
  };
  return {
    iv,
    msgs: [
      { text: 'ברוכים הבאים לממלכה. אני ה-Quest Master.' },
      { text: 'מהיום, החיים שלך הם המשחק: משימות אמיתיות, XP אמיתי, ובוסים שהם ההרגלים שעוצרים אותך.' },
      { text: 'קודם כל, איך יקראו לגיבור שלך?' },
    ],
    prompt: namePrompt(accountName),
  };
}

const goalPrompt = (): Prompt => ({
  input: 'both',
  placeholder: 'למשל: לחזור לכושר ולישון יותר טוב',
  chips: realmChips(),
  multi: true,
  maxLen: 400,
});
const blockPrompt = (): Prompt => ({
  input: 'both',
  placeholder: 'למשל: אין לי כוח בערב, ואני נתקע בטלפון',
  chips: struggleChips(),
  multi: true,
  maxLen: 400,
});
const timePrompt = (): Prompt => ({ input: 'chips', chips: timeChips() });

export function answerInterview(iv0: Interview, ans: Answer, accountName?: string): Turn {
  const iv: Interview = { ...iv0, focus: [...iv0.focus], struggles: [...iv0.struggles], hints: [...iv0.hints] };
  const text = (ans.text ?? '').trim();
  const chips = ans.chips ?? [];

  switch (iv.step) {
    case 'name': {
      const raw = chips.includes('account') && accountName ? accountName : text;
      const v = validateHeroName(raw);
      if (!v.ok) {
        iv.tries++;
        return { iv, msgs: [{ text: NAME_REASON[v.reason] }], prompt: namePrompt(accountName) };
      }
      iv.name = v.name;
      iv.step = 'goal';
      return {
        iv,
        msgs: [
          { text: `${v.name}. שם של מישהו שעומד לעשות דברים גדולים.` },
          { text: 'ועכשיו לעניין: מה הדבר שהכי היית רוצה לשנות או לשפר בחודשים הקרובים? אפשר לכתוב חופשי, לבחור תחומים, או גם וגם.' },
        ],
        prompt: goalPrompt(),
      };
    }
    case 'goal':
    case 'goalRealm': {
      const picked = chips.filter((c): c is RealmId => (REALM_IDS as readonly string[]).includes(c));
      if (text) iv.goal = (iv.goal ? iv.goal + ' ' : '') + text.slice(0, 400);
      const a = localAnalyze(text);
      iv.hints = [...new Set([...iv.hints, ...a.hints])];
      if (a.minutes) iv.suggestedMinutes = a.minutes;
      for (const s of a.struggles) if (!iv.struggles.includes(s)) iv.struggles.push(s);
      iv.focus = [...new Set([...picked, ...a.realms])].slice(0, 3);
      if (!iv.focus.length) {
        iv.step = 'goalRealm';
        return {
          iv,
          msgs: [{ text: text ? 'הבנתי. כדי לדייק את המסע: לאיזה תחום זה הכי קשור? אפשר לבחור עד שלושה.' : 'צריך לפחות תחום אחד. אפשר לבחור או לכתוב במילים שלך.' }],
          prompt: { input: 'both', chips: realmChips(), multi: true, placeholder: 'או לכתוב במילים שלך', maxLen: 400 },
        };
      }
      iv.step = 'block';
      const names = iv.focus.map((r) => REALMS[r].name);
      const msgs: BotMsg[] = [];
      if (text) msgs.push({ text: `"${snippet(text)}". זו מטרה ששווה מסע.` });
      msgs.push({
        text:
          iv.focus.length === 1
            ? `המסע שלך יתחיל ב${REALMS[iv.focus[0]!].land}, ממלכת ה${names[0]}.`
            : `אז נבנה את המסע סביב ${list(names)}.`,
      });
      msgs.push({ text: 'שאלה כנה: מה בדרך כלל עוצר אותך? מה קורה כשזה לא מצליח?' });
      return { iv, msgs, prompt: blockPrompt() };
    }
    case 'block':
    case 'blockPick': {
      const picked = chips.filter((c): c is StruggleId => (STRUGGLE_IDS as readonly string[]).includes(c));
      if (text) iv.block = (iv.block ? iv.block + ' ' : '') + text.slice(0, 400);
      const a = localAnalyze(text);
      iv.hints = [...new Set([...iv.hints, ...a.hints])];
      if (a.minutes) iv.suggestedMinutes = a.minutes;
      const found = [...new Set([...picked, ...a.struggles])];
      // answers here only refine the plan; they never touch the name
      if (!found.length && !iv.struggles.length) {
        iv.step = 'blockPick';
        return {
          iv,
          msgs: [{ text: 'תודה על הכנות. מה מכל אלה הכי קרוב למה שקורה לך?' }],
          prompt: { input: 'both', chips: struggleChips(), multi: true, placeholder: 'או במילים שלך', maxLen: 400 },
        };
      }
      iv.struggles = [...new Set([...found, ...iv.struggles])].slice(0, 3);
      // a struggle can also hint at a realm the player didn't name
      if (iv.focus.length < 3) for (const r of a.realms) if (!iv.focus.includes(r) && iv.focus.length < 3) iv.focus.push(r);
      iv.step = 'time';
      const boss = BOSSES.find((b) => b.struggle === iv.struggles[0])!;
      return {
        iv,
        msgs: [
          { text: `${STRUGGLE_LABELS[iv.struggles[0]!]}. אני מכיר אותו. יש לו אפילו שם.` },
          { text: `${boss.name}, ${boss.epithet}. ${boss.desc}`, tone: 'boss' },
          { text: 'שאלה אחרונה: כמה זמן ביום אפשר לתת למסע? עדיף להתחיל קטן ולגדול.' },
        ],
        prompt: timePrompt(),
      };
    }
    case 'time': {
      const c = chips[0] ?? (text.match(/\d+/)?.[0] ?? '');
      const n = Number(c);
      iv.minutes = n >= 40 ? 40 : n > 0 && n <= 10 ? 10 : n > 0 ? 20 : (iv.suggestedMinutes ?? 20);
      iv.step = 'done';
      return { iv, msgs: summary(iv), prompt: { input: 'none' } };
    }
    default:
      return { iv, msgs: [], prompt: { input: 'none' } };
  }
}

const HINT_LINES: Record<string, string> = {
  sleep: 'שמתי לב שהשינה חשובה לך, אז חלק מהמשימות הן לערב.',
  phone: 'הטלפון הוא שדה קרב. יהיו לך משימות של זמן בלי מסך.',
  reading: 'הזכרת קריאה. במגדל החכמה יחכו לך עמודים, מעט בכל יום.',
  fitness: 'הגוף שלך עומד לקבל שדרוג. נתחיל בעדינות, כדי לבנות ולא להישבר.',
  weight: 'בלי דיאטות קיצוניות: תנועה קטנה כל יום ובחירות טובות באוכל.',
  money: 'הכסף יקבל תשומת לב. משימות קטנות של סדר ותכנון.',
  job: 'מטרה מקצועית ברורה. נפרק אותה לצעדים קטנים.',
  study: 'למידה דורשת פוקוס. יהיו לך בלוקים קצרים של ריכוז.',
  lonely: 'קשרים נבנים מצעדים קטנים. כל יום הודעה, שיחה, מפגש.',
  family: 'המשפחה חשובה לך. יהיו משימות שמקרבות.',
  anxiety: 'נוסיף רגעים של שקט ונשימה. גם זה כוח.',
};

export function summary(iv: Interview): BotMsg[] {
  const names = iv.focus.map((r) => `${REALMS[r].name} (${REALMS[r].land})`);
  const boss = BOSSES.find((b) => b.struggle === iv.struggles[0]) ?? BOSSES[0]!;
  const n = questCount(iv.minutes);
  const msgs: BotMsg[] = [
    { text: `הנה המפה שלך, ${iv.name}:`, tone: 'summary' },
    { text: `תחומי המסע: ${list(names)}.`, tone: 'summary' },
    { text: `הבוס הראשון: ${boss.name}. נקודות התורפה שלו: ${list(boss.weak.map((r) => REALMS[r].name))}. כל משימה בתחומים האלה פוגעת בו כפול.`, tone: 'summary' },
    { text: `בכל יום יחכו לך ${n} משימות, בערך ${iv.minutes} דקות. הן מתאימות את עצמן: אם משהו קשה מדי, הוא יקטן. אם קל מדי, הוא יגדל.`, tone: 'summary' },
  ];
  for (const h of iv.hints.slice(0, 2)) if (HINT_LINES[h]) msgs.push({ text: HINT_LINES[h]!, tone: 'summary' });
  msgs.push({ text: 'עוד דבר: מה שסיפרת לי נשמר רק במשחק (במכשיר שלך ובשרת של המשחק) ולא מועבר לאף אחד אחר.' });
  msgs.push({ text: 'ועכשיו, הגיבור צריך פנים.' });
  return msgs;
}

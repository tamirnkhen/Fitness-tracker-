import type { QuestTemplate, RealmId } from '../game/types';

/**
 * TRACKS: the self-adjusting main path of each realm.
 * Tier 0 is tiny on purpose. The adapt system climbs a tier after 3
 * completions in a row and drops one after 2 misses in a row.
 * Each tier has variants so days don't repeat.
 */
type T = Omit<QuestTemplate, 'realm'>;
const t = (realm: RealmId, tiers: T[][]): QuestTemplate[][] => tiers.map((v) => v.map((q) => ({ ...q, realm })));

export const TRACKS: Record<RealmId, QuestTemplate[][]> = {
  body: t('body', [
    [
      { id: 'b0a', kind: 'check', title: '10 דקות הליכה', desc: 'בקצב נוח. אפשר גם בבית או במרפסת.', xp: 15 },
      { id: 'b0b', kind: 'check', title: '5 דקות מתיחות', desc: 'צוואר, כתפיים, גב וירכיים.', xp: 15 },
    ],
    [
      { id: 'b1a', kind: 'check', title: '20 דקות הליכה מהירה', xp: 20 },
      { id: 'b1b', kind: 'count', title: '30 סקוואטים במהלך היום', xp: 20, target: 3, unit: 'סטים של 10' },
    ],
    [
      { id: 'b2a', kind: 'check', title: '30 דקות פעילות שמעלה דופק', desc: 'הליכה, ריקוד, אופניים, מה שכיף.', xp: 25 },
      { id: 'b2b', kind: 'check', title: 'אימון גוף קצר: 3 סבבים', desc: '10 סקוואטים, 8 שכיבות סמיכה, 20 שניות פלאנק.', xp: 25 },
    ],
    [
      { id: 'b3a', kind: 'check', title: 'אימון של 40 דקות', xp: 30 },
      { id: 'b3b', kind: 'check', title: 'ריצה או הליכה של 4 ק"מ', xp: 30 },
    ],
    [
      { id: 'b4a', kind: 'check', title: 'אימון כוח של 45 דקות', xp: 35 },
      { id: 'b4b', kind: 'check', title: 'אימון אינטרוולים של 30 דקות', desc: 'דקה מאמץ, דקה מנוחה.', xp: 35 },
    ],
    [
      { id: 'b5a', kind: 'check', title: 'אימון של שעה', xp: 40 },
      { id: 'b5b', kind: 'check', title: 'ריצה של 5 ק"מ או שחייה של 30 דקות', xp: 40 },
    ],
  ]),
  mind: t('mind', [
    [
      { id: 'm0a', kind: 'count', title: 'לקרוא 5 עמודים', xp: 15, target: 5, unit: 'עמודים' },
      { id: 'm0b', kind: 'check', title: '3 דקות נשימה שקטה', desc: '4 שניות שאיפה, 6 שניות נשיפה.', xp: 15 },
    ],
    [
      { id: 'm1a', kind: 'count', title: 'לקרוא 10 עמודים', xp: 20, target: 10, unit: 'עמודים' },
      { id: 'm1b', kind: 'check', title: '10 דקות למידה של משהו חדש', xp: 20 },
    ],
    [
      { id: 'm2a', kind: 'count', title: 'לקרוא 20 עמודים', xp: 25, target: 20, unit: 'עמודים' },
      { id: 'm2b', kind: 'check', title: '10 דקות מדיטציה', xp: 25 },
    ],
    [
      { id: 'm3a', kind: 'count', title: 'לקרוא 30 עמודים', xp: 30, target: 30, unit: 'עמודים' },
      { id: 'm3b', kind: 'check', title: '30 דקות של קורס או שפה', xp: 30 },
    ],
    [
      { id: 'm4a', kind: 'count', title: 'לקרוא 40 עמודים', xp: 35, target: 40, unit: 'עמודים' },
      { id: 'm4b', kind: 'text', title: 'לסכם במשפט אחד רעיון שלמדת היום', xp: 35, prompt: 'הרעיון שלמדתי…', journal: true },
    ],
    [
      { id: 'm5a', kind: 'count', title: 'לקרוא 50 עמודים', xp: 40, target: 50, unit: 'עמודים' },
      { id: 'm5b', kind: 'check', title: 'שעה של למידה עמוקה בלי הפרעות', xp: 40 },
    ],
  ]),
  career: t('career', [
    [
      { id: 'c0a', kind: 'check', title: '10 דקות על המשימה החשובה ביותר', desc: 'רק להתחיל. זה כל הקסם.', xp: 15 },
      { id: 'c0b', kind: 'text', title: 'לכתוב מה הצעד הבא בפרויקט שלך', xp: 15, prompt: 'הצעד הבא שלי הוא…' },
    ],
    [
      { id: 'c1a', kind: 'check', title: 'פומודורו אחד: 25 דקות פוקוס', xp: 20 },
      { id: 'c1b', kind: 'check', title: 'לסגור משימה אחת שתקועה', xp: 20 },
    ],
    [
      { id: 'c2a', kind: 'count', title: '2 פומודורו של פוקוס', xp: 25, target: 2, unit: 'סבבים' },
      { id: 'c2b', kind: 'check', title: '45 דקות עבודה עמוקה', xp: 25 },
    ],
    [
      { id: 'c3a', kind: 'count', title: '3 פומודורו של פוקוס', xp: 30, target: 3, unit: 'סבבים' },
      { id: 'c3b', kind: 'check', title: 'להתקדם בפרויקט שמקדם אותך שנה קדימה', xp: 30 },
    ],
    [
      { id: 'c4a', kind: 'check', title: '90 דקות עבודה עמוקה', desc: 'טלפון בחדר אחר.', xp: 35 },
      { id: 'c4b', kind: 'check', title: 'לשלוח את הדבר שמתעכב אצלך', xp: 35 },
    ],
    [
      { id: 'c5a', kind: 'check', title: 'שעתיים של עבודה עמוקה', xp: 40 },
      { id: 'c5b', kind: 'check', title: 'לסיים אבן דרך בפרויקט', xp: 40 },
    ],
  ]),
  relationships: t('relationships', [
    [
      { id: 'r0a', kind: 'check', title: 'לשלוח הודעה חמה למישהו', desc: 'בלי סיבה. רק כי.', xp: 15 },
      { id: 'r0b', kind: 'check', title: 'להגיד תודה למישהו בקול', xp: 15 },
    ],
    [
      { id: 'r1a', kind: 'check', title: 'שיחת טלפון של 5 דקות עם מישהו יקר', xp: 20 },
      { id: 'r1b', kind: 'check', title: 'לשאול מישהו "מה שלומך באמת?" ולהקשיב', xp: 20 },
    ],
    [
      { id: 'r2a', kind: 'check', title: 'שיחה של 15 דקות בלי טלפון ביד', xp: 25 },
      { id: 'r2b', kind: 'check', title: 'לקבוע מפגש עם חבר', xp: 25 },
    ],
    [
      { id: 'r3a', kind: 'check', title: 'זמן איכות של חצי שעה עם מישהו קרוב', xp: 30 },
      { id: 'r3b', kind: 'check', title: 'לחדש קשר עם מישהו שלא דיברת איתו מזמן', xp: 30 },
    ],
    [
      { id: 'r4a', kind: 'check', title: 'לעשות משהו טוב בשביל מישהו בלי שביקש', xp: 35 },
      { id: 'r4b', kind: 'check', title: 'לארגן ערב / ארוחה עם אנשים אהובים', xp: 35 },
    ],
    [
      { id: 'r5a', kind: 'check', title: 'שיחה עמוקה וכנה שדחית', xp: 40 },
      { id: 'r5b', kind: 'check', title: 'לתת שעה מזמנך לקהילה או להתנדבות', xp: 40 },
    ],
  ]),
  discipline: t('discipline', [
    [
      { id: 'd0a', kind: 'check', title: 'לסדר את המיטה', xp: 15 },
      { id: 'd0b', kind: 'check', title: 'לבחור 3 משימות להיום ולכתוב אותן', xp: 15 },
    ],
    [
      { id: 'd1a', kind: 'check', title: '30 דקות בלי טלפון לפני השינה', xp: 20 },
      { id: 'd1b', kind: 'check', title: '10 דקות סידור של פינה אחת', xp: 20 },
    ],
    [
      { id: 'd2a', kind: 'check', title: 'לקום בשעה שתכננת', xp: 25 },
      { id: 'd2b', kind: 'check', title: 'שעה בלי רשתות חברתיות', xp: 25 },
    ],
    [
      { id: 'd3a', kind: 'check', title: 'בוקר בלי טלפון בחצי השעה הראשונה', xp: 30 },
      { id: 'd3b', kind: 'check', title: 'לתכנן את מחר לפני השינה', xp: 30 },
    ],
    [
      { id: 'd4a', kind: 'check', title: 'יום עם זמן מסך מתחת לשעתיים (לא עבודה)', xp: 35 },
      { id: 'd4b', kind: 'check', title: 'לבצע את כל 3 המשימות שבחרת בבוקר', xp: 35 },
    ],
    [
      { id: 'd5a', kind: 'check', title: 'שגרת בוקר מלאה: השכמה, תנועה, תכנון', xp: 40 },
      { id: 'd5b', kind: 'check', title: 'ערב דיגיטלי שקט: מסכים כבויים מ-21:00', xp: 40 },
    ],
  ]),
  adventure: t('adventure', [
    [
      { id: 'a0a', kind: 'text', title: 'לצאת החוצה ל-10 דקות ולמצוא 3 דברים שלא שמת לב אליהם', xp: 15, prompt: 'מה ראיתי…', journal: true },
      { id: 'a0b', kind: 'check', title: 'לשמוע שיר או אלבום שלא הכרת', xp: 15 },
    ],
    [
      { id: 'a1a', kind: 'check', title: 'ללכת בדרך שונה מהרגיל', xp: 20 },
      { id: 'a1b', kind: 'check', title: 'לטעום או לבשל משהו שלא ניסית', xp: 20 },
    ],
    [
      { id: 'a2a', kind: 'check', title: 'לבקר במקום חדש בעיר', xp: 25 },
      { id: 'a2b', kind: 'check', title: '30 דקות של תחביב יצירתי', desc: 'ציור, נגינה, צילום, כתיבה.', xp: 25 },
    ],
    [
      { id: 'a3a', kind: 'check', title: 'שעה בטבע', xp: 30 },
      { id: 'a3b', kind: 'check', title: 'לעשות משהו קטן שמפחיד אותך', xp: 30 },
    ],
    [
      { id: 'a4a', kind: 'check', title: 'לנסות פעילות שמעולם לא עשית', xp: 35 },
      { id: 'a4b', kind: 'check', title: 'להזמין מישהו להרפתקה ספונטנית', xp: 35 },
    ],
    [
      { id: 'a5a', kind: 'check', title: 'יום טיול או מסע קצר', xp: 40 },
      { id: 'a5b', kind: 'check', title: 'להירשם לחוויה שחלמת עליה', xp: 40 },
    ],
  ]),
};

export const TIER_NAMES = ['ניצוץ', 'גחלת', 'להבה', 'מדורה', 'שריפה', 'שמש'];
export const MAX_TIER = 5;

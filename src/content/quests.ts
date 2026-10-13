import type { QuestTemplate, RealmId } from '../game/types';

type T = Omit<QuestTemplate, 'realm'>;
const r = (realm: RealmId, qs: T[]): QuestTemplate[] => qs.map((q) => ({ ...q, realm }));

/** QB: side quests. Mixed kinds keep the day interesting. */
export const QB: QuestTemplate[] = [
  ...r('body', [
    { id: 'qb-b1', kind: 'count', title: 'לשתות 8 כוסות מים', xp: 10, target: 8, unit: 'כוסות' },
    { id: 'qb-b2', kind: 'check', title: 'לעלות במדרגות במקום במעלית', xp: 8 },
    { id: 'qb-b3', kind: 'check', title: 'ארוחה עם ירק אחד לפחות בכל צלחת', xp: 10 },
    { id: 'qb-b4', kind: 'check', title: 'ללכת לישון חצי שעה מוקדם יותר', xp: 12 },
    { id: 'qb-b5', kind: 'count', title: 'לקום מהכיסא כל שעה ולהזיז את הגוף', xp: 10, target: 5, unit: 'פעמים' },
    { id: 'qb-b6', kind: 'check', title: 'יום בלי משקה ממותק', xp: 10 },
    { id: 'qb-b7', kind: 'check', title: '5 דקות של מתיחות לפני השינה', xp: 8 },
    { id: 'qb-b8', kind: 'text', title: 'לדרג את האנרגיה שלך היום מ-1 עד 10 ולכתוב למה', xp: 8, prompt: 'האנרגיה שלי היום…', journal: true },
  ]),
  ...r('mind', [
    { id: 'qb-m1', kind: 'text', title: 'לכתוב 3 דברים שאני מודה עליהם היום', xp: 12, prompt: '1… 2… 3…', journal: true },
    { id: 'qb-m2', kind: 'check', title: '15 דקות של פודקאסט או הרצאה מעניינת', xp: 10 },
    { id: 'qb-m3', kind: 'text', title: 'מה מעסיק אותי עכשיו? לכתוב 3 שורות', xp: 10, prompt: 'מה שמעסיק אותי…', journal: true },
    { id: 'qb-m4', kind: 'check', title: 'ללמוד 5 מילים בשפה חדשה', xp: 10 },
    { id: 'qb-m5', kind: 'check', title: '5 דקות בלי כלום: בלי טלפון, בלי מוזיקה', xp: 8 },
    { id: 'qb-m6', kind: 'text', title: 'שאלה שהייתי רוצה לדעת עליה את התשובה', xp: 8, prompt: 'הייתי רוצה לדעת…', journal: true },
    { id: 'qb-m7', kind: 'check', title: 'לפתור חידה, תשבץ או סודוקו', xp: 8 },
  ]),
  ...r('career', [
    { id: 'qb-c1', kind: 'check', title: 'לנקות את תיבת הדואר ל-10 דקות', xp: 8 },
    { id: 'qb-c2', kind: 'text', title: 'לכתוב יעד אחד לשבוע הזה', xp: 10, prompt: 'עד סוף השבוע אני…', journal: true },
    { id: 'qb-c3', kind: 'check', title: 'לבדוק לאן הלך הכסף השבוע', xp: 12 },
    { id: 'qb-c4', kind: 'check', title: 'ללמוד 15 דקות כישור מקצועי', xp: 12 },
    { id: 'qb-c5', kind: 'check', title: 'לשלוח הודעה למישהו שיכול לעזור לך להתקדם', xp: 12 },
    { id: 'qb-c6', kind: 'check', title: 'לסדר את שולחן העבודה', xp: 8 },
    { id: 'qb-c7', kind: 'text', title: 'מה ההישג המקצועי הקטן של היום?', xp: 8, prompt: 'היום הצלחתי…', journal: true },
  ]),
  ...r('relationships', [
    { id: 'qb-r1', kind: 'check', title: 'לשלוח תמונה או זיכרון משותף לחבר', xp: 8 },
    { id: 'qb-r2', kind: 'check', title: 'ארוחה אחת בלי טלפון על השולחן', xp: 10 },
    { id: 'qb-r3', kind: 'check', title: 'לפרגן למישהו בפומבי', xp: 10 },
    { id: 'qb-r4', kind: 'text', title: 'למי אני רוצה להיות קרוב יותר? ומה הצעד הראשון?', xp: 10, prompt: 'אני רוצה להתקרב ל…', journal: true },
    { id: 'qb-r5', kind: 'check', title: 'להתקשר להורה, סבא או סבתא', xp: 12 },
    { id: 'qb-r6', kind: 'check', title: 'לעזור למישהו במשהו קטן', xp: 10 },
    { id: 'qb-r7', kind: 'check', title: 'להקשיב בלי לתת עצות', xp: 8 },
  ]),
  ...r('discipline', [
    { id: 'qb-d1', kind: 'check', title: 'לכבות התראות מאפליקציה אחת שמסיחה', xp: 10 },
    { id: 'qb-d2', kind: 'check', title: '"כלל 2 הדקות": לעשות עכשיו כל דבר שלוקח פחות מ-2 דקות', xp: 8 },
    { id: 'qb-d3', kind: 'check', title: 'להכין בגדים ותיק למחר', xp: 8 },
    { id: 'qb-d4', kind: 'check', title: 'לשטוף כלים מיד אחרי האוכל', xp: 8 },
    { id: 'qb-d5', kind: 'count', title: '3 בלוקים של 20 דקות בלי טלפון', xp: 12, target: 3, unit: 'בלוקים' },
    { id: 'qb-d6', kind: 'check', title: 'למחוק 20 תמונות או קבצים מיותרים', xp: 8 },
    { id: 'qb-d7', kind: 'text', title: 'מה הדבר האחד שאם אעשה היום, היום יצליח?', xp: 10, prompt: 'הדבר האחד…', journal: true },
  ]),
  ...r('adventure', [
    { id: 'qb-a1', kind: 'check', title: 'לצלם תמונה יפה של משהו רגיל', xp: 8 },
    { id: 'qb-a2', kind: 'check', title: 'לשבת 10 דקות בחוץ ולהסתכל על השמיים', xp: 8 },
    { id: 'qb-a3', kind: 'check', title: 'לרקוד לשיר אחד שלם', xp: 10 },
    { id: 'qb-a4', kind: 'text', title: 'לכתוב 3 חוויות שהייתי רוצה לעשות השנה', xp: 10, prompt: 'השנה אני רוצה…', journal: true },
    { id: 'qb-a5', kind: 'check', title: 'לדבר עם אדם חדש', xp: 12 },
    { id: 'qb-a6', kind: 'check', title: 'לצחצח שיניים ביד השנייה', xp: 6 },
    { id: 'qb-a7', kind: 'check', title: 'לתכנן הרפתקה לסוף השבוע', xp: 10 },
  ]),
];

/** WILD: rare surprise bonuses. */
export const WILD: QuestTemplate[] = [
  { id: 'w1', realm: 'adventure', kind: 'check', title: 'קלף פרא: לעשות היום משהו שיצחיק אותך באמת', xp: 25 },
  { id: 'w2', realm: 'relationships', kind: 'check', title: 'קלף פרא: לשלוח הודעת הוקרה ל-3 אנשים', xp: 25 },
  { id: 'w3', realm: 'body', kind: 'check', title: 'קלף פרא: 50 קפיצות במקום', xp: 20 },
  { id: 'w4', realm: 'mind', kind: 'text', title: 'קלף פרא: מכתב קצר לעצמך בעוד שנה', xp: 30, prompt: 'שלום לי מהעתיד…', journal: true },
  { id: 'w5', realm: 'discipline', kind: 'check', title: 'קלף פרא: שעתיים בלי טלפון בכלל', xp: 30 },
  { id: 'w6', realm: 'career', kind: 'check', title: 'קלף פרא: לבקש משהו שתמיד חששת לבקש', xp: 30 },
  { id: 'w7', realm: 'adventure', kind: 'check', title: 'קלף פרא: לצאת לשקיעה', xp: 20 },
  { id: 'w8', realm: 'mind', kind: 'check', title: 'קלף פרא: 20 דקות בלי שום מסך, רק מחשבות', xp: 20 },
];

/** MICRO: tiny quests for comeback days and low-energy moments. */
export const MICRO: QuestTemplate[] = [
  { id: 'mi1', realm: 'body', kind: 'check', title: 'לשתות כוס מים אחת עכשיו', xp: 5 },
  { id: 'mi2', realm: 'mind', kind: 'check', title: '5 נשימות עמוקות', xp: 5 },
  { id: 'mi3', realm: 'discipline', kind: 'check', title: 'לסדר דבר אחד שנמצא מולך', xp: 5 },
  { id: 'mi4', realm: 'relationships', kind: 'check', title: 'לשלוח אימוג\'י לב למישהו', xp: 5 },
  { id: 'mi5', realm: 'body', kind: 'check', title: 'לעמוד ולמתוח את הידיים למעלה', xp: 5 },
  { id: 'mi6', realm: 'adventure', kind: 'check', title: 'לפתוח חלון ולהסתכל החוצה דקה', xp: 5 },
  { id: 'mi7', realm: 'mind', kind: 'text', title: 'מילה אחת שמתארת את ההרגשה שלי עכשיו', xp: 5, prompt: 'מילה אחת…', journal: true },
  { id: 'mi8', realm: 'career', kind: 'check', title: 'לפתוח את הקובץ. רק לפתוח.', xp: 5 },
];

/** CREATOR: from level 5 the hero writes their own mission. */
export const CREATOR: { id: string; realm: RealmId; title: string; prompt: string; xp: number }[] = [
  { id: 'cr1', realm: 'adventure', title: 'משימת יוצר: להמציא אתגר שמפחיד אותך קצת', prompt: 'האתגר שלי היום…', xp: 30 },
  { id: 'cr2', realm: 'career', title: 'משימת יוצר: לבחור צעד אחד שיקדם את החלום הגדול', prompt: 'הצעד שלי…', xp: 30 },
  { id: 'cr3', realm: 'relationships', title: 'משימת יוצר: לתכנן הפתעה קטנה למישהו', prompt: 'ההפתעה שתכננתי…', xp: 30 },
  { id: 'cr4', realm: 'body', title: 'משימת יוצר: להמציא אימון משלך', prompt: 'האימון שלי…', xp: 30 },
  { id: 'cr5', realm: 'mind', title: 'משימת יוצר: לבחור משהו ללמוד היום ולהגדיר איך', prompt: 'אני אלמד…', xp: 30 },
  { id: 'cr6', realm: 'discipline', title: 'משימת יוצר: לבחור הרגל אחד לשבור היום', prompt: 'ההרגל שאשבור היום…', xp: 30 },
];

export const PERFECT_DAY_BONUS = 20;

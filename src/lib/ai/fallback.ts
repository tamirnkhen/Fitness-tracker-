import type { Domain } from "@/lib/game/domains";
import type { GoalDraft, PlannedTemplate } from "./quest";

// Deterministic starter plan used when the AI is unavailable (no key, outage,
// refusal). Keeps onboarding unblocked; the user still gets a real quest.

type Seed = { daily: [string, string, number][]; weekly: [string, string, number, number][]; bonus: [string, string, number][] };

const SEEDS: Record<Domain, Seed> = {
  health: {
    daily: [
      ["הליכה של 20 דקות", "צא להליכה בקצב נוח", 5],
      ["8 כוסות מים", "שתה לפחות 8 כוסות מים לאורך היום", 3],
      ["10 דקות מתיחות", "מתיחות לכל הגוף לפני השינה", 4],
      ["לישון לפני חצות", "כבה מסכים חצי שעה לפני השינה", 6],
    ],
    weekly: [
      ["3 אימונים השבוע", "כל אימון של 30 דקות לפחות", 3, 25],
      ["2 ארוחות בישול ביתי", "הכן בעצמך ארוחה בריאה", 2, 15],
    ],
    bonus: [["אימון כפול", "הוסף היום אימון נוסף מעבר לתוכנית", 35], ["יום בלי סוכר", "יום שלם בלי סוכר מוסף", 40]],
  },
  direction: {
    daily: [
      ["10 דקות כתיבת יומן", "כתוב מה למדת היום ומה הצעד הבא", 5],
      ["צעד אחד לעבר המטרה", "בצע פעולה אחת קטנה שמקדמת את המטרה", 6],
      ["קריאה של 15 דקות", "קרא משהו שקשור לתחום שאתה רוצה לגדול בו", 4],
    ],
    weekly: [["סיכום שבועי", "כתוב רפלקציה על השבוע ותכנן את הבא", 1, 20], ["3 שעות עבודה עמוקה", "שלושה בלוקים של שעה בלי הסחות", 3, 25]],
    bonus: [["פנייה לאדם מעורר השראה", "שלח הודעה למישהו שאתה רוצה ללמוד ממנו", 45], ["לפרסם משהו שיצרת", "שתף בפומבי תוכן שיצרת", 40]],
  },
  subconscious: {
    daily: [
      ["5 דקות מדיטציה", "שב בשקט והתמקד בנשימה", 4],
      ["ויזואליזציה של המטרה", "דמיין 3 דקות את עצמך אחרי שהשגת את המטרה", 3],
      ["3 דברים טובים", "רשום שלושה דברים שאתה מכיר להם תודה", 3],
    ],
    weekly: [["4 מדיטציות השבוע", "לפחות 10 דקות כל אחת", 4, 20]],
    bonus: [["30 דקות בלי טלפון", "חצי שעה בטבע או בשקט, בלי מסכים", 30]],
  },
  discipline: {
    daily: [
      ["לסדר את המיטה", "התחל את הבוקר בניצחון קטן", 2],
      ["המשימה הקשה ראשונה", "בצע את המשימה הכי קשה של היום לפני הצהריים", 7],
      ["לתכנן את מחר", "כתוב 3 משימות עיקריות למחר", 3],
    ],
    weekly: [["5 בקרים בזמן", "קום בשעה שקבעת חמישה ימים השבוע", 5, 25]],
    bonus: [["מקלחת קרה", "סיים את המקלחת עם דקה של מים קרים", 25], ["יום בלי רשתות חברתיות", "24 שעות בלי פיד", 45]],
  },
  personal: {
    daily: [
      ["20 דקות על התחום", "הקדש זמן ממוקד לתחום האישי שלך", 6],
      ["צעד קטן קדימה", "עשה פעולה אחת שמקרבת אותך למטרה", 4],
    ],
    weekly: [["3 מפגשים עם התחום", "שלוש פעמים השבוע לפחות 30 דקות", 3, 20]],
    bonus: [["אתגר מחוץ לאזור הנוחות", "עשה משהו בתחום שמפחיד אותך קצת", 40]],
  },
};

export function fallbackPlan(goals: GoalDraft[]): PlannedTemplate[] {
  return goals.flatMap((goal, goal_index) => {
    const seed = SEEDS[goal.domain];
    return [
      ...seed.daily.map(([title, description, xp]) => ({ goal_index, kind: "daily" as const, title, description, xp, target_count: 1 })),
      ...seed.weekly.map(([title, description, target_count, xp]) => ({ goal_index, kind: "weekly" as const, title, description, xp, target_count })),
      ...seed.bonus.map(([title, description, xp]) => ({ goal_index, kind: "bonus" as const, title, description, xp, target_count: 1 })),
    ];
  });
}

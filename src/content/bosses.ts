import type { RealmId, StruggleId } from '../game/types';

export interface Boss {
  id: string;
  name: string;
  epithet: string;
  struggle: StruggleId;
  desc: string;
  /** realms whose quests deal double damage */
  weak: RealmId[];
  hp: number;
  reward: number;
  taunts: string[];
}

export const BOSSES: Boss[] = [
  {
    id: 'procrastinator',
    name: 'מחרון',
    epithet: 'אדון הדחייה',
    struggle: 'procrastination',
    desc: 'לוחש "מחר" בכל פעם שמשהו חשוב מתחיל. נחלש מכל צעד קטן שנעשה היום.',
    weak: ['career', 'discipline'],
    hp: 300,
    reward: 120,
    taunts: ['"יש עוד זמן…"', '"עוד חמש דקות."', '"זה לא הרגע המתאים."'],
  },
  {
    id: 'exhaustion',
    name: 'עייפון',
    epithet: 'שד האנרגיה הגנובה',
    struggle: 'energy',
    desc: 'מוצץ כוח מהגוף והראש. שונא תנועה, מים ושינה טובה.',
    weak: ['body', 'mind'],
    hp: 300,
    reward: 120,
    taunts: ['"עוד קצת במיטה."', '"אין לך כוח לזה."', '"מחר יהיה יותר כוח."'],
  },
  {
    id: 'timethief',
    name: 'גוזל השעות',
    epithet: 'גנב הזמן',
    struggle: 'time',
    desc: 'מפזר את היום לאלף פירורים. נחלש מתכנון ומפוקוס.',
    weak: ['discipline', 'career'],
    hp: 320,
    reward: 130,
    taunts: ['"אין לך זמן לזה."', '"אחרי כל השאר."', '"יום עמוס, שוב."'],
  },
  {
    id: 'screenwizard',
    name: 'מכשף המסכים',
    epithet: 'שליט הגלילה האינסופית',
    struggle: 'focus',
    desc: 'כישוף הגלילה שלו גונב שעות. כל רגע בלי מסך פוגע בו.',
    weak: ['discipline', 'adventure'],
    hp: 320,
    reward: 130,
    taunts: ['"רק עוד סרטון אחד."', '"שווה לבדוק מה חדש."', '"זה ייקח שנייה."'],
  },
  {
    id: 'quitter',
    name: 'רוח הוויתור',
    epithet: 'מכבה הניצוצות',
    struggle: 'consistency',
    desc: 'מופיעה ביום השלישי, ממש כשהתלהבות נגמרת. נחלשת מכל יום ברצף.',
    weak: ['discipline', 'body'],
    hp: 340,
    reward: 140,
    taunts: ['"גם ככה זה לא יחזיק."', '"פספסת אתמול, אז מה הטעם?"', '"נתחיל מחדש ביום ראשון."'],
  },
  {
    id: 'doubtshadow',
    name: 'צל הספק',
    epithet: 'השומר של אזור הנוחות',
    struggle: 'fear',
    desc: 'גדל בכל פעם שמוותרים מפחד. נמס מאומץ קטן ומקשרים.',
    weak: ['adventure', 'relationships'],
    hp: 340,
    reward: 140,
    taunts: ['"מה יגידו?"', '"זה גדול עליך."', '"יותר בטוח לא לנסות."'],
  },
  {
    id: 'greycloud',
    name: 'הענן האפור',
    epithet: 'מצייר הימים בגווני אפור',
    struggle: 'mood',
    desc: 'מכסה את השמש ומרחיק אנשים. נחלש מאור, תנועה וחיבור.',
    weak: ['relationships', 'body'],
    hp: 300,
    reward: 130,
    taunts: ['"עדיף להישאר בבית."', '"אף אחד לא יבין."', '"זה לא ישתנה."'],
  },
];

export const BOSS_HP_GROWTH = 60;

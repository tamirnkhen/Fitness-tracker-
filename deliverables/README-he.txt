The Quest: הוראות העלאה (בערך 10 דקות)
==========================================

מה יש בתיקייה:
  the-quest-site.zip         האתר המוכן (לגרירה ל-Netlify)
  supabase-quest-setup.sql   בסיס הנתונים (להדבקה ב-Supabase)
  SECURITY.md, DECISIONS.md, REPORT.md   מסמכים


(א) יצירת בסיס הנתונים ב-Supabase
---------------------------------
 1. נכנסים ל-https://supabase.com ויוצרים פרויקט חדש (Free).
 2. חשוב: בשדה Region בוחרים  Central EU (Frankfurt).
    (בתנאי השימוש כתוב שהנתונים בפרנקפורט. אם בוחרים אזור אחר, צריך לעדכן את התנאים.)
 3. בתפריט השמאלי: SQL Editor  ←  New query.
 4. פותחים את הקובץ supabase-quest-setup.sql בעורך טקסט, מעתיקים את כל התוכן, מדביקים, ולוחצים Run.
    אמור להופיע "Success". מותר להריץ שוב בעתיד (למשל אחרי עדכון): זה לא מוחק נתונים.


(ב) מילוי config.js
-------------------
 5. ב-Supabase: Project Settings  ←  API Keys (או Data API).
    מעתיקים שני דברים:
      - Project URL        (נראה כך: https://abcdxyz.supabase.co)
      - Publishable key    (מתחיל ב-sb_publishable_ ...)
        בפרויקטים ישנים: המפתח "anon public".
    אסור להשתמש במפתח secret / service_role! האתר יסרב לעבוד איתו.
 6. מחלצים (Extract / "חילוץ הכול") את the-quest-site.zip לתיקייה.
 7. פותחים את הקובץ config.js שבתוך התיקייה בעורך טקסט (Notepad / TextEdit) וממלאים:

      window.QUEST_CONFIG = {
        SUPABASE_URL: 'https://abcdxyz.supabase.co',
        SUPABASE_KEY: 'sb_publishable_xxxxxxxx',
        CONTACT: '',
      };

    CONTACT לא חובה: אימייל או טלפון ליצירת קשר שיופיע בתנאי השימוש.
    אם משאירים ריק, כתוב שם "פנו למי ששלח לכם את הקישור".
    שומרים את הקובץ.


(ג) העלאה ל-Netlify
-------------------
 8. נכנסים ל-https://app.netlify.com/drop
 9. גוררים את **התיקייה** (אחרי שמילאתם את config.js) לחלון.
10. אחרי כמה שניות מתקבל קישור. זה האתר. אפשר לשנות שם ב-Site settings.
    אם נפתח מסך "חסרים פרטי חיבור", config.js לא מולא נכון: בודקים את הכתובת והמפתח, וגוררים שוב.
    (אפשר גם לגרור את ה-zip עצמו, אבל אז צריך לערוך את config.js אחר כך: Deploys ← גרירה מחדש של התיקייה.)


(ד) שליפת מפתח הניהול
---------------------
11. ב-Supabase  ←  SQL Editor, מריצים:

      select v from q_config where k = 'admin_key';

12. פאנל הניהול נמצא בכתובת האתר עם ‎#admin בסוף, למשל:
      https://your-site.netlify.app/#admin
    מדביקים את המפתח. רואים: מספר שחקנים, פעילים, רמות, רצפים ופעילות אחרונה.
    (בלי תשובות, בלי תמונות, הטלפון מוסתר חלקית.)
    החלפת מפתח:  update q_config set v = encode(extensions.gen_random_bytes(18),'hex') where k = 'admin_key';


(ה) עדכון גרסה
--------------
13. גרסה חדשה של האתר: ב-Netlify  ←  Deploys  ←  גוררים את התיקייה החדשה (עם אותו config.js).
    שחקנים שהאתר פתוח אצלם יראו תוך כ-5 דקות פס "יש גרסה חדשה · רענון".
14. אם חייבים שכולם יעברו לגרסה החדשה: בפאנל הניהול  ←  "גרסה מינימלית" (למשל 2.0.0).
    או ב-SQL:  update q_config set v = '2.0.0' where k = 'min_version';
15. אם התנאים השתנו מהותית: מעלים קודם את הגרסה עם הטקסט החדש, ואז:
      update q_config set v = '2' where k = 'terms_ver';
    כל שחקן יתבקש לאשר מחדש לפני שימשיך.


(ו) הודעה לכל השחקנים
---------------------
16. בפאנל הניהול  ←  "הודעה לכל השחקנים"  ←  כותבים  ←  שליחה.
    ההודעה מופיעה כפס למעלה אצל כולם (עד שכל אחד סוגר אותה). מחיקה: שולחים הודעה ריקה.
    או ב-SQL:  select q_admin_set((select v from q_config where k='admin_key'), 'broadcast', 'שלום לכולם!');


בעיות נפוצות
------------
 * "חסרים פרטי חיבור": config.js ריק או שגוי.
 * "תקלה בשרת" אחרי הרשמה: ה-SQL לא הורץ, או הורץ בפרויקט אחר.
 * אין צליל באייפון: המתג הצדדי במצב שקט. זה בכוונה של אפל.
 * שכחתי קוד: אין שחזור (אין אימייל). אפשר למחוק את השחקן ב-SQL:
     delete from q_users where phone = '9725XXXXXXXX';

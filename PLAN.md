# The Quest v2: תוכנית עבודה

## מצב פתיחה

שלושת קבצי הייחוס (`the-quest.html`, `supabase-quest-setup.sql`, `the-quest-site.zip`) **לא נמצאו** במאגר או במכונה.
לכן התוכן, הלוגיקה והסכמה נכתבו מחדש לפי המפרט. השמות (REALMS, TRACKS, QB, CREATOR, BOSSES, TITLES, ACH, MICRO, MORN/EVE)
נשמרו כדי שאפשר יהיה להחליף/להשלים את התוכן מהמקור המקורי בקלות (`src/content/`). ראה `DECISIONS.md` (D-01).

## ארכיטקטורה

```
public/config.js   ← קונפיגורציה בזמן ריצה (SUPABASE_URL, SUPABASE_KEY, CONTACT)
src/
  content/   נתוני המשחק (עברית)          — טהור
  game/      לוגיקה טהורה (genDay, rollover, completeQuest, addXp, boss, adapt, merge, analyze)
  i18n/      כל המחרוזות של ה-UI
  api/       RPC קטן ל-Supabase (fetch בלבד, בלי supabase-js)
  sync/      IndexedDB + localStorage, דחיפה מדובנסת, קונפליקטים
  character/ חיתוך, הפרדת רקע (MediaPipe lazy מ-/seg), ציור (Worker), רקע לפי דרגה
  audio/     סינתזת WAV (חצוצרה + חרבות)
  calendar/  קישורי Google Calendar + ‎.ics
  ui/        Preact: מסכים, overlays, רכיבים
supabase/    הסכמה (מקור יחיד) → deploy/ + deliverables/
tests/       unit (Vitest), sql (PGlite + Postgres אמיתי), e2e (Playwright מול שרת RPC על PGlite)
```

* השרת: Supabase Postgres, גישה רק דרך פונקציות `security definer`. RLS פעיל בלי policies.
* זהות: טלפון + קוד 4 ספרות (bcrypt) → session token אקראי (נשמר כ-SHA-256 בשרת). הקוד לא נשמר במכשיר.
* סנכרון: אופטימיסטי עם גרסת שרת (`savedAt`) כבסיס; קונפליקט → מיזוג מקומי (`mergeStates`) → ניסיון חוזר.
* דמות: חיתוך שקוף בלבד נשמר; הרקע מצויר בזמן תצוגה לפי `backdropFor(level)`.

## שלבים

1. SQL + בדיקות (PGlite + Postgres 16 אמיתי).
2. ליבת משחק + תוכן + בדיקות יחידה.
3. API + סנכרון.
4. UI.
5. דמות.
6. סאונד, תזכורות, PWA, CSP.
7. E2E (רשת, CSP, פרטיות, מכשיר שני, offline, מחיקה, דרגות), Lighthouse, אריזה, תיעוד.

## סיכונים

* אין קבצי ייחוס ← תוכן/מראה חדשים; מתועד.
* MediaPipe wasm כבד (~13MB) ← נטען רק במסך יצירת הדמות.
* אין גישה לחשבון Supabase/Netlify אמיתי ← נבדק מול שרת מדומה עם Postgres אמיתי; החיבור החי לא נבדק.
* צליל ו-iOS ← נבדק רק ב-Chromium headless (ש-`play()` נקרא לא מושתק).

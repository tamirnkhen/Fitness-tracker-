# The Quest

משחק RPG שהופך את החיים האמיתיים למסע: משימות יומיות, XP, דרגות, רצפים, בוסים וקבוצות חברים.
PWA סטטי (Netlify) + Supabase Postgres. עברית, RTL, מותאם לנייד. **שום נתון לא יוצא לצד שלישי.**

## הפעלה מקומית
```bash
npm install
npm run dev          # http://localhost:5173 (צריך config.js מלא ב-public/ כדי להתחבר)
```

## בדיקות
```bash
npm run check        # lint + prettier + typecheck + unit + SQL + build + E2E
npm test             # Vitest: לוגיקת משחק, ראיון, סנכרון, יומן, צליל, ציור + SQL על PGlite
npm run test:sql:pg  # אותן בדיקות SQL מול Postgres 16 אמיתי (initdb זמני)
npm run test:e2e     # Playwright מול הבנייה, עם שרת RPC על Postgres (PGlite) והסכמה האמיתית
```

## פריסה
```bash
npm run package      # בונה ומייצר deliverables/ (zip לאתר, SQL, הוראות)
```
ההוראות המלאות בעברית פשוטה: [`deploy/README-he.txt`](deploy/README-he.txt).
בקצרה: (1) Supabase, אזור Frankfurt ← SQL Editor ← להריץ `supabase-quest-setup.sql`. (2) למלא `config.js` ב-URL וב-publishable key. (3) לגרור ל-Netlify Drop.

## מבנה
```
src/
  content/    תוכן המשחק (REALMS, TRACKS, QB, WILD, MICRO, CREATOR, BOSSES, TITLES, ACH, MORN/EVE)
  game/       לוגיקה טהורה: genDay, rollover, completeQuest, addXp, newBoss, adapt, merge, analyze, interview
  i18n/       מחרוזות UI ותנאי השימוש
  api/        RPC ל-Supabase (fetch בלבד)
  sync/       IndexedDB/localStorage + סנכרון offline-first
  character/  חיתוך, הפרדת רקע (MediaPipe, lazy), ציור (Worker), thumb לפי דרגה
  audio/      סינתזת חצוצרה וחרבות
  calendar/   Google Calendar + ‎.ics
  app/        מצב האפליקציה ופעולות
  ui/         מסכים ורכיבים (Preact)
  sw/         service worker
supabase/     הסכמה
tests/        unit, sql, e2e
deploy/       הוראות העלאה
```

מסמכים: [`PLAN.md`](PLAN.md) · [`DECISIONS.md`](DECISIONS.md) · [`SECURITY.md`](SECURITY.md) · [`THIRD_PARTY.md`](THIRD_PARTY.md) · [`REPORT.md`](REPORT.md)

## הוספת Web Push בעתיד (תכנון)
1. טבלה `q_push(user_id, endpoint, p256dh, auth)` + פונקציות `q_push_sub/unsub`.
2. VAPID keys כ-secret ב-Supabase; Edge Function מתוזמנת (pg_cron) ששולחת לפי שעות התזכורת.
3. ב-`sw.js`: מאזינים ל-`push` ו-`notificationclick`. ב-CSP אין צורך בשינוי (השליחה מהשרת).
4. לעדכן את תנאי השימוש (ספק ה-push של הדפדפן רואה את ההתראה) ולהעלות `terms_ver`.

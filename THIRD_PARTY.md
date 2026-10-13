# THIRD_PARTY: תלויות ורישיונות

## נארז לאתר (runtime)
| רכיב | גרסה | רישיון | שימוש |
|---|---|---|---|
| [Preact](https://preactjs.com) | 10.x | MIT | רינדור ה-UI (נארז ל-bundle) |
| [@mediapipe/tasks-vision](https://github.com/google-ai-edge/mediapipe) | 1.1.0 | Apache-2.0 | הפרדת רקע במכשיר. ה-JS נארז; קבצי ה-wasm מוגשים מ-`/seg` |
| MediaPipe `selfie_segmenter.tflite` (float16) | latest (2026-10) | Apache-2.0 | מודל הפרדת הרקע, `assets/seg/` ← `/seg` |
| [Rubik](https://github.com/googlefonts/rubik) דרך [Fontsource](https://fontsource.org) | 5.x | SIL OFL 1.1 | גופן ראשי (עברית + לטינית, 400/500/700), `/fonts` |
| [Poppins](https://github.com/itfoundry/Poppins) דרך Fontsource | 5.x | SIL OFL 1.1 | ספרות וכותרות לטיניות (600/800), `/fonts` |

קבצי הרישיון של הגופנים מועתקים ל-`/licenses`. אין CDN: הכול מוגש מהאתר עצמו.

## כלי פיתוח בלבד (לא באתר)
Vite, TypeScript, Vitest, Playwright, @axe-core/playwright, ESLint + typescript-eslint, Prettier, @electric-sql/pglite (Postgres ב-wasm לבדיקות), pg (בדיקות מול Postgres אמיתי). כולם MIT / Apache-2.0 / ISC.

## קבצי בדיקה
`tests/fixtures/astronaut.jpg`: תמונה של NASA (Eileen Collins), ברשות הציבור, מתוך הנתונים של scikit-image.

## צלילים
מסונתזים בקוד (`src/audio/synth.ts`). אין קבצי צליל של צד שלישי.

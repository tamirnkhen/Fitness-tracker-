# The Quest

> Life is a game. Are you going to play?

A gamified personal-growth web app. Users set life goals in a conversation with an AI guide, get daily, weekly and surprise bonus quests, earn XP (every 1000 XP is a level), and grow a personal illustrated character that unlocks gear as they level up.

Hebrew-first (RTL), mobile-first. Built to the approved brand book: the indigo-black / amber-gold / cream / muted palette, three chevrons over an XP bar, Poppins + Rubik, and the task and domain icon system, where a dashed stroke always means "not fixed / personal".

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, `proxy.ts`), TypeScript, Tailwind CSS v4 |
| Auth, DB, storage | Supabase: Postgres with RLS, Auth (email/password + Google), private Storage bucket |
| Goal conversation and task scoring | Anthropic API (Claude) via structured outputs, called from the server only |
| Character | OpenAI Images (`gpt-image-1`, edit from photo) + `omni-moderation-latest` scan, called from the server only |
| Hosting | Vercel |

## Getting started

```bash
npm install
cp .env.example .env.local      # fill in the values
npm run dev
```

### 1. Supabase project

1. Create a project. Run the migration in `supabase/migrations/` with the Supabase CLI (`supabase db push`) or paste it into the SQL editor. It creates every table, the RLS policies, the SQL functions and the private `character-private` bucket.
2. **Auth → Providers**: enable Email (keep "Confirm email" on) and Google (add the Google OAuth client ID/secret).
3. **Auth → URL configuration**: set Site URL to your domain and add `https://YOUR-DOMAIN/auth/callback` (plus `http://localhost:3000/auth/callback` for development) to the redirect allow-list.
4. **Auth → Password policy**: minimum length 8 or more. Turn on leaked-password protection.
5. **Make yourself an admin.** The role can't be set from the app, by design:
   ```sql
   update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
   ```
6. **Backups**: enable Point-in-Time Recovery (Pro plan) or at least confirm the daily backups, and test a restore before launch.

### 2. Vercel

Add the variables from `.env.example` in Project → Settings → Environment Variables. Only the two `NEXT_PUBLIC_*` Supabase values (plus `NEXT_PUBLIC_SITE_URL`) are exposed to the browser. Every API key stays on the server.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route types + `tsc` |
| `npm test` | Unit tests (game logic, XP clamping, upload validation, redirect safety) |
| `scripts/test-db.sh` | Applies the migration to a throwaway local Postgres (with a small Supabase shim) and runs the security tests in `supabase/tests/db_test.sql` |

## How it works

**Onboarding (target: under 3 minutes to the first completed quest)**
1. Name, birth date (**18+ enforced**: an underage signup's account is deleted on the spot), and acceptance of the Terms and Privacy Policy.
2. A short guided visualization, then a chat with the AI guide that turns the vision into 1–4 goals. Each goal gets a domain, a baseline and a target. The transcript is stored server-side so the client can't forge assistant turns. There's a "quick setup" form if the AI is unavailable or the user prefers not to chat.
3. Optional: photo upload to create the character. Skippable.

**Quest engine.** Claude turns the goals into a pool of task templates:
- daily (+2 to +10 XP)
- weekly with a cumulative target (+15 to +30 XP)
- bonus "risk/reward" challenges (up to +50 XP)

Each day `syncQuests` deterministically rotates up to 6 daily and 3 weekly tasks out of the pool, and rolls a 35% chance of a surprise bonus. It's idempotent: a unique `(template_id, period_key)` key makes repeat runs no-ops. Users can also add up to 5 personal tasks a day as free text. Claude scores them +2 to +10 and rejects point-farming. If the AI is down, a deterministic starter plan keeps everything working.

**XP.** XP is awarded *only* by the `complete_task` Postgres function. It runs as the signed-in user and checks ownership, open status and that the task belongs to the current local day/week, all in one transaction. Users have no write access to XP, tasks, templates or their role.

**Character.** The flow is: separate explicit photo consent → upload → validation → moderation scan → private storage → AI generation. Gear unlocks by level or by number of completed tasks, and equipping is re-validated on the server. Withdrawing consent deletes the photo and every avatar.

**Admin (`/admin`).**
- Metrics: DAU, WAU, MAU, weekly churn, average tasks per active user, onboarding completion.
- User list with search, and a read-only user detail view. Admins never see photos.
- Every view is written to an append-only audit log *before* any data is returned. A database trigger blocks updates and deletes on that log, even from the service role.
- Non-admins get a 404. The role is re-read from the database on every request, never from the UI.

## Security checklist

- [x] Auth via Supabase Auth only. No hand-rolled password storage.
- [x] Anthropic and OpenAI keys and the service-role key are server-only (`server-only` imports). All AI calls go through route handlers.
- [x] RLS on every user table, read-own-rows only. Column-level grants: a user can change only their display name.
- [x] Admin role checked server-side on every admin page and data call, and every view is audited.
- [x] Postgres-backed rate limits per user per AI endpoint. The limiter fails closed.
- [x] Image uploads:
  - type checked by magic bytes, 5MB limit, minimum dimensions;
  - decoded and re-encoded with sharp, which strips EXIF/GPS and any trailing data;
  - moderation scan;
  - private bucket with owner-only read policy, served through 10-minute signed URLs.
- [x] Per-request nonce CSP with `strict-dynamic`, `frame-ancestors 'none'`, HSTS, `nosniff`, Referrer-Policy and Permissions-Policy. Supabase handles secure, httpOnly session cookies.
- [x] No open redirects (`safeNextPath`). Auth redirects use `NEXT_PUBLIC_SITE_URL`, not the Host header.
- [x] Right to erasure: Settings → delete account. This removes the storage images, then the auth user. Everything else cascades.
- [ ] **Before launch:** turn on DB backups/PITR, set up CAPTCHA on signup (Supabase Auth → Bot protection), add error monitoring, and run a pentest.

## ⚠️ Legal — required before real users

`/privacy` and `/terms` are **auto-generated drafts, marked "not legally reviewed" on the page**. Face photos may count as sensitive or biometric data under:
- Israel's Privacy Protection Law (Amendment 13)
- GDPR, if there are EU users
- some US state biometric laws

Have a lawyer review the drafts, fill the `[placeholders]` (operator, contact, retention periods, AI-provider data terms, cross-border transfers), and bump `TERMS_VERSION` in `src/lib/env.ts`. Bumping it makes every user re-accept. Do this before anyone beyond friendly testers signs up.

import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import {
  test,
  expect,
  newPhone,
  register,
  login,
  onboard,
  interview,
  sql,
  local,
  waitSaved,
  setServerXp,
  completeFirstOpenCheck,
  plays,
  cspOf,
} from './helpers';
import type { Page } from '@playwright/test';

const PHOTO = 'tests/fixtures/astronaut.jpg';
const xpForLevel = (l: number) => 100 * (l - 1) + 10 * (l - 1) * (l - 2);

async function a11y(page: Page, label: string) {
  // let entry animations finish so contrast is measured on the final colours
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  const r = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
}

test('empty config.js shows a clear setup screen and does not crash', async ({ page, w }) => {
  await page.route('**/config.js', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: "window.QUEST_CONFIG = { SUPABASE_URL: '', SUPABASE_KEY: '' };" }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'חסרים פרטי חיבור' })).toBeVisible();
  expect(w.rpcBodies).toEqual([]);
});

test('a secret key in config.js is refused', async ({ page }) => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.sig';
  await page.route('**/config.js', (r) =>
    r.fulfill({
      contentType: 'text/javascript',
      body: `window.QUEST_CONFIG = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_KEY: '${jwt}' };`,
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('מפתח סודי');
});

test('registration is blocked without accepting the terms; consent is stored on the server', async ({ page, w }) => {
  const phone = newPhone();
  await page.goto('/');
  await a11y(page, 'auth');
  await page.fill('input[name=name]', 'דנה');
  await page.fill('input[name=username]', phone);
  await page.fill('input[name=password]', '4826');
  await page.getByRole('button', { name: 'יצירת גיבור' }).click();
  await expect(page.getByRole('alert')).toContainText('לאשר את התנאים');
  expect(w.rpcBodies.filter((b) => b.fn === 'q_register')).toEqual([]);
  // terms sheet opens and is readable
  await page.getByRole('button', { name: 'תנאי השימוש והפרטיות' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('פרנקפורט');
  await page.keyboard.press('Escape');
  await page.check('input[name=terms]');
  await page.getByRole('button', { name: 'יצירת גיבור' }).click();
  await expect(page.locator('.chat')).toBeVisible();
  const row = await sql<{ consent_ver: number; consent_at: string }>(page, 'select consent_ver, consent_at from q_users where phone=$1', [
    local(phone),
  ]);
  expect(row[0]!.consent_ver).toBe(1);
  expect(row[0]!.consent_at).toBeTruthy();
});

test('wrong code: clear Hebrew error, no hint whether the phone exists', async ({ page }) => {
  await login(page, newPhone(), '7777');
  await expect(page.getByRole('alert')).toHaveText('הטלפון או הקוד לא נכונים.');
});

test('full journey: interview, quests, level-up sound, mute, a11y, no PIN on the device', async ({ page, w }) => {
  const phone = newPhone();
  await register(page, phone);
  await interview(page);
  // a sentence was never taken as the name
  await expect(page.locator('.chat')).toContainText('נועה. שם של מישהו');
  await a11y(page, 'onboarding');
  await page.getByRole('button', { name: 'דילוג' }).click();
  await expect(page.locator('.hud .name')).toHaveText('נועה');
  await a11y(page, 'quests');

  // the PIN is never stored on the device
  const stored = await page.evaluate(async () => {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) out.push(localStorage.getItem(localStorage.key(i)!) ?? '');
    return out.join('\n');
  });
  expect(stored).not.toContain('"4826"');
  expect(stored).toMatch(/"token":"[0-9a-f]{64}"/);

  await completeFirstOpenCheck(page);
  await expect(page.locator('.quest.done')).toHaveCount(1);
  await waitSaved(page);

  // level up: the fanfare plays, unmuted
  await setServerXp(page, phone, xpForLevel(2) - 1);
  await completeFirstOpenCheck(page);
  await expect(page.locator('[data-overlay=levelUp]')).toBeVisible();
  await expect(page.locator('[data-overlay=levelUp] .big')).toHaveText('2');
  await expect.poll(async () => (await plays(page)).map((p) => p.sfx)).toContain('levelUp');
  await a11y(page, 'level-up overlay');
  await page.getByRole('button', { name: 'ממשיכים' }).click();

  // mute: no sound on the next level-up
  await page.locator('nav').getByRole('button', { name: 'גיבור' }).click();
  await page.getByRole('switch', { name: 'צלילים' }).click();
  await expect(page.getByRole('switch', { name: 'צלילים' })).toHaveAttribute('aria-checked', 'false');
  await a11y(page, 'hero');
  await page.locator('nav').getByRole('button', { name: 'עולם' }).click();
  await a11y(page, 'world');
  await page.locator('nav').getByRole('button', { name: 'משימות' }).click();
  await waitSaved(page);
  await setServerXp(page, phone, xpForLevel(4) - 1);
  const before = (await plays(page)).length;
  await completeFirstOpenCheck(page);
  await expect(page.locator('[data-overlay=levelUp]')).toBeVisible();
  await page.waitForTimeout(500);
  expect((await plays(page)).length).toBe(before);
  expect(await cspOf(page)).toEqual([]);
  expect(w.foreign).toEqual([]);
});

test('character: the photo never leaves the device; backdrop changes at 10 and 20 for me and my party', async ({ page, browser, w }) => {
  const phone = newPhone();
  await onboard(page, phone, { hero: 'אלון' });
  await page.locator('nav').getByRole('button', { name: 'גיבור' }).click();
  await page.getByRole('button', { name: 'יצירת דמות מתמונה' }).click();
  await page.setInputFiles('[data-testid=photo-input]', PHOTO);
  await page.getByRole('button', { name: 'יצירת הדמות' }).click();
  await page.getByRole('button', { name: 'שמירת הדמות' }).click({ timeout: 60000 });
  await expect(page.getByRole('heading', { name: 'הגיבור שלך' })).toBeHidden({ timeout: 20000 });
  await waitSaved(page);

  // what the server has: a transparent cut-out + frame, no original
  const row = (
    await sql<{ imgs: Record<string, unknown>; pub: { thumb: string } }>(page, 'select imgs, pub from q_users where phone=$1', [
      local(phone),
    ])
  )[0]!;
  expect(Object.keys(row.imgs).sort()).toEqual(['cut', 'frame', 'style']);
  expect(String(row.imgs.cut)).toMatch(/^data:image\/(webp|png);base64,/);
  expect(String(row.imgs.cut).length).toBeLessThan(700 * 1024);
  expect(row.pub.thumb).toMatch(/^data:image\/jpeg;base64,/);
  // the original photo is in no request body
  const original = readFileSync(PHOTO).toString('base64');
  for (const b of w.rpcBodies) {
    expect(b.body.includes(original.slice(1000, 1400))).toBe(false);
    expect(b.body).not.toMatch(/data:image\/jpeg;base64,[A-Za-z0-9+/]{40000,}/);
  }
  expect(w.requests.filter((r) => r.method() !== 'GET' && !r.url().includes('/rest/v1/rpc/'))).toEqual([]);

  // a friend in the same party
  const c = await page.evaluate(async () => {
    const s = JSON.parse(localStorage.getItem('tq:session') ?? '{}') as { token: string };
    const r = await fetch('/rest/v1/rpc/q_party_create', {
      method: 'POST',
      headers: { apikey: 'x', 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: s.token, p_name: 'החבורה' }),
    });
    return (await r.json()) as { code: string };
  });
  const friendCtx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'he-IL' });
  const friend = await friendCtx.newPage();
  await onboard(friend, newPhone(), { name: 'רון', hero: 'רון' });
  await friend.locator('nav').getByRole('button', { name: 'גיבור' }).click();
  await friend.fill('input[maxlength="6"]', c.code);
  await friend.getByRole('button', { name: 'הצטרפות', exact: true }).click();
  await expect(friend.locator('.board li')).toHaveCount(2);
  const thumbOf = async () => friend.locator('.board li:not(.me) img').getAttribute('src');
  const t1 = await thumbOf();
  expect(t1).toBe(row.pub.thumb);

  const thumbs: string[] = [row.pub.thumb];
  for (const lvl of [10, 20]) {
    await page.locator('nav').getByRole('button', { name: 'משימות' }).click();
    await setServerXp(page, phone, xpForLevel(lvl) - 1);
    await completeFirstOpenCheck(page);
    await expect(page.locator('[data-overlay=levelUp] [data-backdrop-change]')).toHaveAttribute(
      'data-backdrop-change',
      lvl === 10 ? 'deepblue' : 'purple',
    );
    await page.getByRole('button', { name: 'ממשיכים' }).click();
    await expect(page.locator('.hud .avatar img')).toBeVisible();
    await expect
      .poll(async () => (await sql<{ t: string }>(page, `select pub->>'thumb' t from q_users where phone=$1`, [local(phone)]))[0]!.t, {
        timeout: 20000,
      })
      .not.toBe(thumbs[thumbs.length - 1]);
    const t = (await sql<{ t: string }>(page, `select pub->>'thumb' t from q_users where phone=$1`, [local(phone)]))[0]!.t;
    thumbs.push(t);
    // the friend's board refreshes (polling) and shows the new backdrop
    await expect.poll(thumbOf, { timeout: 25000 }).toBe(t);
  }
  expect(new Set(thumbs).size).toBe(3);
  await page.locator('nav').getByRole('button', { name: 'גיבור' }).click();
  await expect(page.locator('.hero-card .avatar')).toHaveAttribute('data-backdrop', 'purple');
  await friendCtx.close();
});

test('party: invite link, private data stays private, malicious names stay text', async ({ page, browser }) => {
  const a = newPhone();
  await onboard(page, a, { hero: 'אביר' });
  await page.locator('nav').getByRole('button', { name: 'גיבור' }).click();
  await page.getByRole('button', { name: 'יצירת קבוצה' }).click();
  const code = (await page.locator('.code-box').first().innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  // a non-existent code
  await page.fill('input[maxlength="6"]', 'ZZZZZ2');
  await page.getByRole('button', { name: 'הצטרפות', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('לא מצאנו קבוצה');

  // a hostile name injected straight into the database (bypassing the server checks)
  const evil = '<img src=x onerror="window.__xss=1">';
  await sql(
    page,
    `update q_users set pub = jsonb_set(pub, '{name}', to_jsonb($2::text)), state = jsonb_set(state, '{secret}', '"תשובה סודית"') where phone=$1`,
    [local(a), evil],
  );

  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'he-IL' });
  const b = await ctx.newPage();
  const responses: string[] = [];
  b.on('response', async (r) => {
    if (r.url().includes('/rpc/q_party')) responses.push(await r.text());
  });
  await b.goto(`/#join=${code}`);
  await expect(b.locator('.banner')).toContainText(code);
  const phoneB = newPhone();
  await register(b, phoneB, 'בת');
  await interview(b, 'בת');
  await b.getByRole('button', { name: 'דילוג' }).click();
  await expect(b.getByRole('dialog')).toContainText(code);
  await b.getByRole('dialog').getByRole('button', { name: 'הצטרפות' }).click();
  await expect(b.locator('.board li')).toHaveCount(2);
  await expect(b.locator('.board')).toContainText(evil);
  expect(await b.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  expect(await b.locator('.board img[src="x"]').count()).toBe(0);
  const raw = responses.join('\n');
  expect(raw).not.toContain(local(a));
  expect(raw).not.toContain(a.replace(/\D/g, '').slice(1));
  expect(raw).not.toContain('תשובה סודית');
  expect(raw).not.toContain('4826');
  await ctx.close();
});

test('second device restores progress, character and party; offline changes sync later', async ({ page, browser, context }) => {
  const phone = newPhone();
  await onboard(page, phone, { hero: 'מאיה' });
  await page.locator('nav').getByRole('button', { name: 'גיבור' }).click();
  await page.getByRole('button', { name: 'יצירת דמות מתמונה' }).click();
  await page.setInputFiles('[data-testid=photo-input]', PHOTO);
  await page.getByRole('button', { name: 'יצירת הדמות' }).click();
  await page.getByRole('button', { name: 'שמירת הדמות' }).click({ timeout: 60000 });
  await expect(page.getByRole('heading', { name: 'הגיבור שלך' })).toBeHidden({ timeout: 20000 });
  await page.getByRole('button', { name: 'יצירת קבוצה' }).click();
  const code = (await page.locator('.code-box').first().innerText()).trim();
  await page.locator('nav').getByRole('button', { name: 'משימות' }).click();
  await completeFirstOpenCheck(page);
  await waitSaved(page);

  // offline: play on, then reconnect
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await completeFirstOpenCheck(page);
  await expect(page.locator('.sync-dot')).toHaveAttribute('data-s', 'offline');
  await expect(page.getByRole('status').filter({ hasText: 'אין חיבור לאינטרנט' })).toBeVisible();
  await page.waitForTimeout(600); // local write is batched (250ms)
  const xpOffline = await page.evaluate(() => JSON.parse(localStorage.getItem('tq:state')!).xp as number);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await waitSaved(page);
  const srv = await sql<{ xp: number }>(page, `select (state->>'xp')::int xp from q_users where phone=$1`, [local(phone)]);
  expect(srv[0]!.xp).toBe(xpOffline);

  const ctx2 = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'he-IL' });
  const p2 = await ctx2.newPage();
  await login(p2, phone);
  await expect(p2.locator('.hud .name')).toHaveText('מאיה');
  await expect(p2.locator('.quest.done')).toHaveCount(2);
  await p2.locator('nav').getByRole('button', { name: 'גיבור' }).click();
  await expect(p2.locator('.hero-card .avatar img')).toHaveAttribute('src', /^data:image\/(webp|png)/);
  await expect(p2.locator('.code-box').first()).toHaveText(code);
  await ctx2.close();
});

test('reminders: chosen times appear in the Google links and the downloaded .ics', async ({ page }) => {
  await onboard(page, newPhone());
  await page.locator('nav').getByRole('button', { name: 'גיבור' }).click();
  await page.fill('input[type=time] >> nth=0', '07:15');
  await page.fill('input[type=time] >> nth=1', '21:40');
  await page.getByRole('button', { name: 'אישור', exact: true }).click();
  const m = await page.locator('a[data-reminder=morning]').getAttribute('href');
  const e = await page.locator('a[data-reminder=evening]').getAttribute('href');
  expect(new URL(m!).searchParams.get('dates')).toMatch(/T071500\/\d{8}T073000$/);
  expect(new URL(e!).searchParams.get('dates')).toMatch(/T214000\/\d{8}T215500$/);
  expect(new URL(m!).searchParams.get('recur')).toBe('RRULE:FREQ=DAILY;COUNT=30');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /הורדת קובץ יומן/ }).click()]);
  const ics = readFileSync((await dl.path())!, 'utf8');
  expect(ics).toMatch(/DTSTART:\d{8}T071500/);
  expect(ics).toMatch(/DTSTART:\d{8}T214000/);
  expect(ics).toContain('BEGIN:VALARM');
  await page.getByRole('button', { name: 'כיבוי' }).click();
  await expect(page.locator('.notice')).toContainText('למחוק אותם שם');
});

test('delete account wipes server row and device; party mate stops seeing me', async ({ page, browser }) => {
  const a = newPhone();
  await onboard(page, a, { hero: 'גל' });
  await page.locator('nav').getByRole('button', { name: 'גיבור' }).click();
  await page.getByRole('button', { name: 'יצירת קבוצה' }).click();
  const code = (await page.locator('.code-box').first().innerText()).trim();

  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'he-IL' });
  const b = await ctx.newPage();
  const phoneB = newPhone();
  await onboard(b, phoneB, { hero: 'שי' });
  await b.locator('nav').getByRole('button', { name: 'גיבור' }).click();
  await b.fill('input[maxlength="6"]', code);
  await b.getByRole('button', { name: 'הצטרפות', exact: true }).click();
  await expect(b.locator('.board li')).toHaveCount(2);
  await expect(page.locator('.board li')).toHaveCount(2, { timeout: 25000 });

  await b.getByRole('button', { name: 'מחיקת חשבון' }).click();
  await b.fill('.sheet input', '4826');
  await b.getByRole('button', { name: 'למחוק הכול' }).click();
  await expect(b.getByRole('tab', { name: 'הרשמה' })).toBeVisible();
  expect(await sql(b, 'select 1 from q_users where phone=$1', [local(phoneB)])).toEqual([]);
  const leftovers = await b.evaluate(async () => {
    const ls = Object.keys(localStorage).filter((k) => k.startsWith('tq:'));
    const dbs = (await indexedDB.databases?.()) ?? [];
    let idb = 0;
    if (dbs.some((d) => d.name === 'the-quest')) {
      idb = await new Promise<number>((res) => {
        const r = indexedDB.open('the-quest');
        r.onsuccess = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('kv')) return res(0);
          const c = db.transaction('kv').objectStore('kv').count();
          c.onsuccess = () => res(c.result);
        };
        r.onerror = () => res(0);
      });
    }
    return { ls, idb };
  });
  expect(leftovers).toEqual({ ls: [], idb: 0 });
  await expect(page.locator('.board li')).toHaveCount(1, { timeout: 25000 });
  await ctx.close();
});

test('terms re-acceptance: saves are blocked until the player accepts again', async ({ page }) => {
  const phone = newPhone();
  await onboard(page, phone);
  await waitSaved(page);
  await sql(page, 'update q_users set consent_ver = 0 where phone=$1', [local(phone)]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'התנאים עודכנו' })).toBeVisible();
  await page.getByRole('button', { name: 'קראתי ואני מאשר/ת' }).click();
  await expect(page.locator('.hud')).toBeVisible();
  const r = await sql<{ consent_ver: number }>(page, 'select consent_ver from q_users where phone=$1', [local(phone)]);
  expect(r[0]!.consent_ver).toBe(1);

  // a newer server version than this build: never accept unseen text, ask to refresh
  await sql(page, `update q_config set v='2' where k='terms_ver'`);
  try {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'התנאים עודכנו' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'רענון' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'קראתי ואני מאשר/ת' })).toBeHidden();
  } finally {
    await sql(page, `update q_config set v='1' where k='terms_ver'`);
  }
});

test('admin panel: progress only, and a broadcast reaches players', async ({ page, browser }) => {
  const phone = newPhone();
  await onboard(page, phone, { hero: 'אדמה' });
  await waitSaved(page);
  const key = (await sql<{ v: string }>(page, `select v from q_config where k='admin_key'`))[0]!.v;
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: 'he-IL' });
  const admin = await ctx.newPage();
  await admin.goto('/#admin');
  await admin.fill('input[type=password]', 'wrong-key-wrong-key');
  await admin.getByRole('button', { name: 'כניסה' }).click();
  await expect(admin.getByRole('alert')).toHaveText('מפתח שגוי.');
  await admin.fill('input[type=password]', key);
  await admin.getByRole('button', { name: 'כניסה' }).click();
  await expect(admin.locator('table')).toContainText('אדמה');
  await expect(admin.locator('table')).not.toContainText(local(phone));
  await admin.fill('textarea', 'אירוע מיוחד הערב!');
  await admin.getByRole('button', { name: 'שליחה' }).click();
  await expect(admin.locator('p.notice')).toHaveText('נשמר');
  await page.reload();
  await expect(page.locator('.banner')).toContainText('אירוע מיוחד הערב!');
  await page.locator('.banner').getByRole('button', { name: 'סגירה' }).click();
  await expect(page.locator('.banner', { hasText: 'אירוע מיוחד' })).toHaveCount(0);
  await sql(page, `update q_config set v='' where k='broadcast'`);
  await ctx.close();
});

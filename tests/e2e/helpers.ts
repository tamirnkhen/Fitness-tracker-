import { test as base, expect, type Page, type BrowserContext, type Request } from '@playwright/test';

export const ORIGIN = 'http://localhost:4173';

export interface Watch {
  requests: Request[];
  foreign: string[];
  csp: string[];
  rpcBodies: { fn: string; body: string }[];
}

/** Every page is watched: any request off-site or any CSP violation fails the test. */
export async function watch(ctx: BrowserContext): Promise<Watch> {
  const w: Watch = { requests: [], foreign: [], csp: [], rpcBodies: [] };
  await ctx.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
    // record audio playback (which effect, and whether it was muted)
    (window as unknown as { __plays: { sfx: string; muted: boolean }[] }).__plays = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (!this.muted)
        (window as unknown as { __plays: { sfx: string; muted: boolean }[] }).__plays.push({
          sfx: this.dataset.sfx ?? '',
          muted: this.muted,
        });
      return orig.call(this);
    };
  });
  ctx.on('request', (r) => {
    w.requests.push(r);
    const u = r.url();
    if (u.startsWith('data:') || u.startsWith('blob:')) return;
    if (!u.startsWith(ORIGIN + '/')) w.foreign.push(u);
    if (u.startsWith(ORIGIN + '/rest/v1/rpc/')) w.rpcBodies.push({ fn: u.split('/').pop()!, body: r.postData() ?? '' });
  });
  ctx.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) w.csp.push(m.text());
  });
  return w;
}

export async function cspOf(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __csp: string[] }).__csp ?? []);
}

export async function plays(page: Page): Promise<{ sfx: string; muted: boolean }[]> {
  return page.evaluate(() => (window as unknown as { __plays: { sfx: string; muted: boolean }[] }).__plays ?? []);
}

export const test = base.extend<{ w: Watch }>({
  w: async ({ context }, use) => {
    const w = await watch(context);
    await use(w);
    expect(w.foreign, 'requests outside the site / Supabase').toEqual([]);
    expect(w.csp, 'CSP violations').toEqual([]);
  },
});
export { expect };

let seq = Math.floor(Math.random() * 1e6);
export const newPhone = () => `054${String(1000000 + (++seq % 8999999)).padStart(7, '0')}`;

export async function sql<T = Record<string, unknown>>(page: Page, q: string, params: unknown[] = []): Promise<T[]> {
  const r = await page.request.post(`${ORIGIN}/__test/sql`, { data: { sql: q, params } });
  return (await r.json()) as T[];
}

export const local = (phone: string) => '972' + phone.replace(/\D/g, '').slice(1);

export async function register(page: Page, phone: string, name = 'דנה', pin = '4826') {
  await page.goto('/');
  await page.getByRole('tab', { name: 'הרשמה' }).click();
  await page.fill('input[name=name]', name);
  await page.fill('input[name=username]', phone);
  await page.fill('input[name=password]', pin);
  await page.check('input[name=terms]');
  await page.getByRole('button', { name: 'יצירת גיבור' }).click();
  await expect(page.locator('.chat')).toBeVisible();
}

export async function login(page: Page, phone: string, pin = '4826') {
  await page.goto('/');
  await page.getByRole('tab', { name: 'כניסה' }).click();
  await page.fill('input[name=username]', phone);
  await page.fill('input[name=password]', pin);
  await page.getByRole('button', { name: 'כניסה למסע' }).click();
}

async function say(page: Page, text: string) {
  const input = page.locator('.composer input');
  await expect(input).toBeVisible();
  await input.fill(text);
  await input.press('Enter');
}

/** Runs the interview; the first answer is a sentence that must not become the name. */
export async function interview(page: Page, hero = 'נועה') {
  await say(page, 'אין לי כוח');
  await expect(page.locator('.bubble.bot').last()).toContainText('משפט');
  await say(page, hero);
  await say(page, 'לחזור לכושר ולקרוא יותר ספרים');
  await say(page, 'אין לי כוח בערב ואני נתקעת בטלפון');
  await page.locator('.choice', { hasText: '20 דקות' }).click();
  await expect(page.getByRole('button', { name: 'דילוג' })).toBeVisible();
}

export async function onboard(page: Page, phone: string, opts: { name?: string; hero?: string } = {}) {
  await register(page, phone, opts.name ?? 'דנה');
  await interview(page, opts.hero ?? 'נועה');
  await page.getByRole('button', { name: 'דילוג' }).click();
  await expect(page.locator('.hud')).toBeVisible();
}

export async function waitSaved(page: Page) {
  await expect(page.locator('.sync-dot')).toHaveAttribute('data-s', 'saved', { timeout: 15000 });
}

/** Moves the server copy of a player's XP and makes the device pull it (a real sync path). */
export async function setServerXp(page: Page, phone: string, xp: number) {
  await waitSaved(page);
  await sql(page, `update q_users set state = jsonb_set(state, '{xp}', to_jsonb($2::int)), saved_at = saved_at + 1 where phone = $1`, [
    local(phone),
    xp,
  ]);
  await page.reload();
  await expect(page.locator('.hud')).toBeVisible();
  await waitSaved(page);
}

export async function completeFirstOpenCheck(page: Page) {
  const tick = page.locator('.quest:not(.done) button.tick').first();
  await tick.click();
}

import { test, expect, newPhone, onboard, waitSaved } from './helpers';

test.use({ serviceWorkers: 'allow' });

test('PWA: installable, works offline, never caches Supabase calls', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await context.newCDPSession(page);
  const inst = await cdp.send('Page.getInstallabilityErrors');
  expect(inst.installabilityErrors).toEqual([]);
  const man = await cdp.send('Page.getAppManifest');
  expect(man.errors).toEqual([]);
  await page.reload();
  await onboard(page, newPhone());
  await waitSaved(page);
  const cached = await page.evaluate(async () => {
    const out: string[] = [];
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url);
    return out;
  });
  expect(cached.length).toBeGreaterThan(3);
  expect(cached.filter((u) => u.includes('/rest/v1/') || u.includes('version.json'))).toEqual([]);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.hud')).toBeVisible();
  await context.setOffline(false);
});

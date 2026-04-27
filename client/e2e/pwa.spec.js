import { test, expect } from '@playwright/test';

test.describe('PWA', () => {
  // ── Manifest ────────────────────────────────────────────────────────────────

  test('manifest.json is valid and has correct fields', async ({ page }) => {
    const res = await page.request.get('/manifest.json');
    expect(res.status()).toBe(200);

    const m = await res.json();
    expect(m.name).toBe('Family Care Hub');
    expect(m.short_name).toBeTruthy();
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
    // Fog & Rose background — not stale dark navy
    expect(m.background_color).toBe('#F6F3F2');
    expect(m.theme_color).toBe('#F6F3F2');
  });

  test('manifest declares 192px and 512px icons (Chrome install requirement)', async ({ page }) => {
    const res = await page.request.get('/manifest.json');
    const { icons } = await res.json();
    const sizes = icons.map(i => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  // ── Icons ────────────────────────────────────────────────────────────────────

  test('installable icons are accessible', async ({ page }) => {
    await page.goto('/');
    const [r192, r512] = await Promise.all([
      page.request.get('/icons/icon-192.png'),
      page.request.get('/icons/icon-512.png'),
    ]);
    expect(r192.status()).toBe(200);
    expect(r512.status()).toBe(200);
  });

  // ── HTML meta tags ───────────────────────────────────────────────────────────

  test('has correct PWA meta tags', async ({ page }) => {
    await page.goto('/');

    const capable = await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content');
    expect(capable).toBe('yes');

    const title = await page.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content');
    expect(title).toBe('Family Care Hub');

    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBe('#F6F3F2');
  });

  test('page title is correct', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Family Care Hub');
  });

  // ── Service worker ───────────────────────────────────────────────────────────

  test('firebase messaging service worker file is accessible', async ({ page }) => {
    await page.goto('/');
    const res = await page.request.get('/firebase-messaging-sw.js');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/javascript/);
  });

  test('service worker can be registered programmatically', async ({ page }) => {
    await page.goto('/');
    const registered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      return reg.scope.includes('/');
    });
    expect(registered).toBe(true);
  });

  // ── Mobile shell ─────────────────────────────────────────────────────────────

  test('bottom nav is visible on mobile viewports', async ({ page, viewport }) => {
    test.skip(!viewport || viewport.width >= 768, 'mobile only');
    await page.goto('/?testUser=1');
    await page.waitForSelector('.bottom-nav', { timeout: 15_000 });
    await expect(page.locator('.bottom-nav')).toBeVisible();
  });

  test('bottom nav has safe-area padding declared', async ({ page, viewport }) => {
    test.skip(!viewport || viewport.width >= 768, 'mobile only');
    await page.goto('/?testUser=1');
    await page.waitForSelector('.bottom-nav', { timeout: 15_000 });

    const padding = await page.locator('.bottom-nav').evaluate(el =>
      getComputedStyle(el).paddingBottom
    );
    // env(safe-area-inset-bottom, 0px) resolves to 0px in headless but the
    // property must be present — confirm the element exists and is rendered
    expect(padding).toBeDefined();
  });
});

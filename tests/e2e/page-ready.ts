import { expect, type Page } from '@playwright/test';

/** Background prefetch/service-worker traffic is not a page readiness signal. */
export async function openReadyPage(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), route).toBeLessThan(400);
  await expect(page.locator('#main-content')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => Array.from(document.images).every(image => {
    const rect = image.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0
      && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
    return !visible || (image.complete && image.naturalWidth > 0);
  })), { message: `${route}: visible images loaded` }).toBe(true);
  return response;
}

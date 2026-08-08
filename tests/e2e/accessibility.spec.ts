import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
  test(`public release pages have no serious accessibility violations at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const route of ["/", "/pricing", "/how-it-works", "/signup", "/login", "/privacy"]) {
      await page.goto(route, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
      expect(blocking, `${route}: ${blocking.map((item) => `${item.id} (${item.nodes.length})`).join(", ")}`).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });
}

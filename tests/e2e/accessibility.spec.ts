import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
  test(`public release pages have no serious accessibility violations at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const route of [
      "/",
      "/pricing",
      "/how-it-works",
      "/use-cases",
      "/use-cases/community-events",
      "/use-cases/nonprofit-events",
      "/use-cases/clubs-associations",
      "/use-cases/professional-gatherings",
      "/signup",
      "/login",
      "/privacy",
    ]) {
      await page.goto(route, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
      expect(blocking, `${route}: ${blocking.map((item) => `${item.id} (${item.nodes.length})`).join(", ")}`).toEqual([]);
      const overflow = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const offenders = Array.from(document.querySelectorAll("body *"))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              element: `${element.tagName.toLowerCase()}.${Array.from(element.classList).slice(0, 4).join(".")}`,
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            };
          })
          .filter((rect) => rect.left < -1 || rect.right > viewportWidth + 1)
          .slice(0, 10);
        return {
          amount: document.documentElement.scrollWidth - viewportWidth,
          viewportWidth,
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          offenders,
        };
      });
      expect(overflow.amount, `${route}: horizontal overflow ${JSON.stringify(overflow)}`).toBeLessThanOrEqual(1);
    }
  });
}

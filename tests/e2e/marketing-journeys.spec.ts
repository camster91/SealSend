import { expect, test } from "@playwright/test";
import { openReadyPage } from "./page-ready";

const publicRoutes = [
  "/rsvp-tracking",
  "/qr-event-check-in",
  "/",
  "/how-it-works",
  "/pricing",
  "/use-cases",
  "/use-cases/event-planners",
  "/use-cases/weddings",
  "/use-cases/birthday-parties",
  "/use-cases/community-events",
  "/use-cases/nonprofit-events",
  "/use-cases/clubs-associations",
  "/use-cases/professional-gatherings",
  "/support",
  "/install",
  "/terms",
  "/privacy",
] as const;

const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
] as const;

test("every internal marketing link and CTA has a working destination", async ({ page }) => {
  test.setTimeout(120_000);
  const destinations = new Set<string>();
  for (const route of publicRoutes) {
    await openReadyPage(page, route);
    const origin = new URL(page.url()).origin;
    const links = await page.locator("a[href]").evaluateAll(elements => elements.map(element => (element as HTMLAnchorElement).href));
    for (const href of links) {
      const url = new URL(href);
      if (url.origin !== origin) continue;
      if (url.pathname === route && url.hash) {
        await expect(page.locator(`[id="${decodeURIComponent(url.hash.slice(1))}"]`), `${route}: anchor ${url.hash}`).toHaveCount(1);
      }
      url.hash = "";
      destinations.add(url.href);
    }
  }
  for (const href of destinations) {
    const response = await page.request.get(href);
    expect(response.status(), `working destination: ${href}`).toBe(200);
  }
});

async function assertMarketingPage(page: Parameters<typeof openReadyPage>[0], route: string) {
  await openReadyPage(page, route);
  await expect(page.locator("main"), `${route}: one main landmark`).toHaveCount(1);
  await expect(page.locator("#main-content"), `${route}: unique skip-link target`).toHaveCount(1);
  await expect(page.locator("h1"), `${route}: exactly one h1`).toHaveCount(1);

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical, `${route}: canonical link`).toHaveCount(1);
  const canonicalHref = await canonical.getAttribute("href");
  expect(canonicalHref, `${route}: canonical href`).toBeTruthy();
  expect(new URL(canonicalHref!, page.url()).pathname, `${route}: canonical path`).toBe(route);

  // Visit each image in turn so intersection-based lazy loading has a chance
  // to start before checking its natural dimensions.
  const images = page.locator("img");
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index);
    if (!(await image.isVisible())) continue;
    await image.scrollIntoViewIfNeeded();
    await expect.poll(
      () => image.evaluate((element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0),
      { message: `${route}: image ${index + 1} should load` },
    ).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  if (route === "/") {
    for (const href of ["/signup", "/how-it-works"]) {
      await expect(page.locator("main").locator(`a[href="${href}"]`).first(), `/: visible CTA ${href}`).toBeVisible();
    }
  }

  const overflow = await page.evaluate(() => ({
    amount: document.documentElement.scrollWidth - window.innerWidth,
    offenders: Array.from(document.querySelectorAll("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName.toLowerCase(), left: Math.round(rect.left), right: Math.round(rect.right) };
      })
      .filter((rect) => rect.left < -1 || rect.right > window.innerWidth + 1)
      .slice(0, 8),
  }));
  expect(overflow.amount, `${route}: horizontal overflow ${JSON.stringify(overflow)}`).toBeLessThanOrEqual(1);
}

for (const viewport of viewports) {
  test(`public marketing routes are healthy at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const route of publicRoutes) {
      await assertMarketingPage(page, route);
    }
  });
}

test("the invitation example changes theme and resets its response state", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openReadyPage(page, "/");

  const demo = page.getByRole("region", { name: "Try an invitation", exact: true });
  await expect(demo).toBeVisible();

  const examples = [
    ["Birthday", "A birthday worth celebrating"],
    ["Potluck", "A little potluck, a lot of good company"],
    ["Book club", "One more chapter, together"],
  ] as const;

  for (const [label, title] of examples) {
    await demo.getByRole("button", { name: label, exact: true }).click();
    await expect(demo.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(demo.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(demo.getByRole("status")).toHaveText("");

    await demo.getByRole("button", { name: "Try an RSVP", exact: true }).click();
    await expect(demo.getByRole("status")).toHaveText("You’re on the example guest list. No RSVP was sent.");

    await demo.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(demo.getByRole("status")).toHaveText("");
  }
  await demo.getByRole("button", { name: "Try an RSVP", exact: true }).click();
  await demo.getByRole("button", { name: "Birthday", exact: true }).click();
  await expect(demo.getByRole("status")).toHaveText("");
  await expect(demo.getByRole("button", { name: "Try an RSVP", exact: true })).toBeVisible();
});


test("marketing navigation reaches the beta entry and organizer pages", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openReadyPage(page, "/");
  const nav = page.getByRole("navigation", { name: "Main", exact: true });
  const menu = nav.getByRole("button", { name: "Use cases", exact: true });
  await expect(menu).toBeEnabled();
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  const planner = page.locator("#desktop-use-cases-menu").getByRole("link", { name: "Event planners", exact: true });
  await planner.click();
  await expect(page).toHaveURL(/\/use-cases\/event-planners$/);
  await expect(page.locator("main h1")).toBeVisible();
  await page.locator("main").getByRole("link", { name: "Create a free event" }).first().click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.locator("main")).toContainText(/beta/i);
});

test("navbar controls wait for hydration before accepting input", async ({ page }) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 375, height: 812 });

  let heldScripts = 0;
  let releaseScripts!: () => void;
  const scriptsReleased = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  const staticRoute = "**/_next/static/**";
  await page.route(staticRoute, async (route) => {
    if (route.request().resourceType() === "script") {
      heldScripts += 1;
      await scriptsReleased;
    }
    await route.continue();
  });
  const navigation = page.goto("/", { waitUntil: "commit" });

  try {
    const nav = page.getByRole("navigation", { name: "Main", exact: true });
    const desktopMenu = nav.locator('button').filter({ hasText: "Use cases" });
    const mobileToggle = nav.locator('button[aria-label="Toggle mobile navigation menu"]');

    await expect.poll(() => heldScripts, { message: "Next client scripts should be held before hydration" }).toBeGreaterThan(0);
    await expect(mobileToggle).toBeVisible();
    await expect(desktopMenu).toBeDisabled();
    await expect(mobileToggle).toBeDisabled();

    releaseScripts();
    await navigation;
    await expect(desktopMenu).toBeEnabled();
    await expect(mobileToggle).toBeEnabled();

    await page.setViewportSize({ width: 1440, height: 1000 });
    await desktopMenu.focus();
    await page.keyboard.press("Enter");
    await expect(desktopMenu).toHaveAttribute("aria-expanded", "true");
  } finally {
    releaseScripts();
    await navigation.catch(() => undefined);
    await page.unroute(staticRoute);
  }
});

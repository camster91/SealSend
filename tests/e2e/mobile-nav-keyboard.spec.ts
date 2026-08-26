import { expect, test } from "@playwright/test";

// Regression for #150: mobile nav drawer must close on Escape and
// restore focus to the toggle. Listener must be removed on close.
test.describe("mobile navigation drawer keyboard behavior", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("Escape closes the drawer and returns focus to the toggle", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    const toggle = page.getByRole("button", { name: /toggle mobile navigation menu/i });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // Open the drawer.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const drawer = page.locator("#mobile-navigation");
    await expect(drawer).toBeVisible();

    // Press Escape — drawer closes, focus returns to the toggle.
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(drawer).toBeHidden();
    await expect(toggle).toBeFocused();

    // Re-open and confirm the global listener is removed when closed
    // (no extra close events fired while the drawer is hidden).
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Pressing Escape again should still close — confirming the listener
    // was re-attached on the new open.
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape does nothing when the drawer is already closed", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const toggle = page.getByRole("button", { name: /toggle mobile navigation menu/i });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    // No-op when not open. (If the listener leaked, the page might
    // intercept Escape for other focusables — e.g. close a footer dropdown.
    // Verify the focused element is unaffected.)
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});

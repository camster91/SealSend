import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openSqliteDb } from "../../src/lib/db/sqlite-local";

const email = process.env.SEALSEND_ACCOUNT_QA_EMAIL;
const password = process.env.SEALSEND_ACCOUNT_QA_PASSWORD;

test.skip(!email || !password, "Disposable account-privacy QA credentials are required");

test("host can export data, schedule deletion, and cancel during cooling off", async ({ page }) => {
  await page.goto("/login");
  const origin = new URL(page.url()).origin;
  await page.context().setExtraHTTPHeaders({ Origin: origin });
  const login = await page.context().request.post("/api/auth/login-password", { data: { email, password } });
  expect(login.status()).toBe(200);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);

  const initialDeletion = await page.context().request.get("/api/account/deletion");
  if ((await initialDeletion.json()).request?.status === "pending") {
    expect((await page.context().request.delete("/api/account/deletion")).status()).toBe(200);
  }

  const exportResponse = await page.context().request.get("/api/account/export");
  expect(exportResponse.status()).toBe(200);
  expect(exportResponse.headers()["cache-control"]).toContain("no-store");
  expect(exportResponse.headers()["content-disposition"]).toContain("sealsend-account-export-");
  const exported = await exportResponse.json();
  expect(exported.account.email).toBe(email);
  expect(Array.isArray(exported.events)).toBe(true);
  expect(JSON.stringify(exported)).not.toContain("password");
  expect(JSON.stringify(exported)).not.toContain("session_token");

  await page.goto("/settings");
  await expect(page.getByRole("link", { name: "Download account export" })).toBeVisible();
  await page.getByLabel('Type "DELETE" to confirm').fill("DELETE");
  await page.getByRole("button", { name: "Schedule account deletion" }).click();
  await expect(page.getByText(/Deletion is scheduled for/)).toBeVisible();
  const pending = await page.context().request.get("/api/account/deletion");
  expect((await pending.json()).request.status).toBe("pending");

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);

  await page.getByRole("button", { name: "Cancel deletion" }).click();
  await expect(page.getByText("Account deletion cancelled.")).toBeVisible();
  const cancelled = await page.context().request.get("/api/account/deletion");
  expect((await cancelled.json()).request.status).toBe("cancelled");

  if (process.env.SEALSEND_ACCOUNT_QA_EXECUTE === "true") {
    const scheduled = await page.context().request.post("/api/account/deletion");
    expect(scheduled.status()).toBe(202);
    // The same local SQLite file the app under test uses.
    const db = openSqliteDb(process.env.SQLITE_PATH ?? ".data/sealsend.db");
    try {
      await db.query("UPDATE account_deletion_requests SET scheduled_for = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 minutes') WHERE user_id = $1", [exported.account.id]);
    } finally {
      db.handle.close();
    }
    const execute = await page.context().request.post("/api/cron/delete-accounts", {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(execute.status()).toBe(200);
    expect((await execute.json()).deleted).toBe(1);
    expect((await page.context().request.get("/api/account/export")).status()).toBe(401);
  }
});

/**
 * Native PostgreSQL checks for anonymous marketing measurement and growth
 * reporting. This file is deliberately standalone: it starts the existing
 * loopback-only synthetic QA database and never contacts a provider or a
 * production endpoint.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request as nodeHttpRequest } from "node:http";
import { startSocialQa } from "./start-social-qa";

const DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:55432/postgres";
const OPERATIONS_SECRET = "local-native-growth-secret";
const SESSION_SECRET = "local-native-session-secret-for-auth-code-qa-only";
const DAY_MS = 24 * 60 * 60 * 1000;

type QaDb = {
  query: <T = Record<string, unknown>>(sql: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};

type NativeHarness = Awaited<ReturnType<typeof startSocialQa>>;

function ago(days: number, minutes = 0): Date {
  return new Date(Date.now() - days * DAY_MS - minutes * 60 * 1000);
}

async function queryRows<T>(db: QaDb, sql: string, values?: unknown[]): Promise<T[]> {
  return (await db.query<T>(sql, values)).rows;
}

async function waitForHttp(url: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      await response.arrayBuffer();
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Native HTTP server did not become ready: ${String(lastError ?? url)}`);
}

async function waitForCount(
  readCount: () => Promise<number>,
  expected: number,
  description: string,
): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await readCount() === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.equal(await readCount(), expected, description);
}

async function rawHttpRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = nodeHttpRequest(url, {
      method: options.method ?? "GET",
      headers: options.headers,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode ?? 0,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    request.on("error", reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

async function runHttpProxyCollectionCheck(db: QaDb): Promise<void> {
  // Use a separate port so this check can run while the browser QA process is
  // using its normal 3100/3101 pair. The standalone server is already built.
  const port = "3120";
  const origin = `http://127.0.0.1:${port}`;
  const app = spawn(process.execPath, [".next/standalone/server.js"], {
    cwd: process.cwd(),
    stdio: "ignore",
    env: {
      ...process.env,
      DATABASE_URL,
      HOSTNAME: "127.0.0.1",
      PORT: port,
      NEXT_PUBLIC_SITE_URL: origin,
      AI_PROVIDER: "fake",
      PAYMENTS_TEST_ONLY: "true",
      COMMUNICATIONS_TEST_ONLY: "true",
      OPERATIONS_SECRET,
      SESSION_SECRET,
    },
  });
  try {
    await waitForHttp(`${origin}/api/health`);
    const count = async (path: string, channel: string): Promise<number> => {
      const rows = await queryRows<{ views: string }>(
        db,
        `SELECT COALESCE(SUM(views), 0)::text AS views
         FROM marketing_pageviews WHERE day = CURRENT_DATE AND path = $1 AND channel = $2`,
        [path, channel],
      );
      return Number(rows[0]?.views ?? 0);
    };
    const documentHeaders = (extra: Record<string, string> = {}) => ({
      accept: "text/html,application/xhtml+xml",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      referer: "https://www.google.com/search?q=sealsend",
      "user-agent": "SealSend-native-marketing-qa/1.0",
      ...extra,
    });

    const searchBaseline = await count("/how-it-works", "organic_search");
    // Use node:http rather than fetch: undici may rewrite Sec-Fetch-Mode to
    // `cors`, which would make a navigation fixture look like an API call.
    const measured = await rawHttpRequest(`${origin}/how-it-works`, {
      headers: documentHeaders(),
    });
    assert.equal(measured.status, 200, "local HTML request should render through the proxy");
    await waitForCount(
      () => count("/how-it-works", "organic_search"),
      searchBaseline + 1,
      "real HTTP marketing request should increment the organic-search counter",
    );

    const dntBaseline = await count("/pricing", "organic_search");
    const optedOut = await rawHttpRequest(`${origin}/pricing`, {
      headers: documentHeaders({ dnt: "1" }),
    });
    assert.equal(optedOut.status, 200, "DNT request should still render the page");
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(
      await count("/pricing", "organic_search"),
      dntBaseline,
      "DNT request must not increment the marketing counter",
    );

    const bot = await rawHttpRequest(`${origin}/pricing`, {
      headers: documentHeaders({
        "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
      }),
    });
    assert.equal(bot.status, 200, "bot request should still render the page");
    const rsc = await rawHttpRequest(`${origin}/pricing?_rsc=native-marketing-qa`, {
      headers: {
        accept: "text/x-component",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "user-agent": "SealSend-native-marketing-qa/1.0",
        rsc: "1",
      },
    });
    assert.ok(rsc.status >= 200 && rsc.status < 400, "RSC request should remain a handled response");
    const prefetch = await rawHttpRequest(`${origin}/pricing`, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        purpose: "prefetch",
        "sec-purpose": "prefetch",
        "user-agent": "SealSend-native-marketing-qa/1.0",
      },
    });
    assert.equal(prefetch.status, 200, "prefetch request should still render the page");
    const gpc = await rawHttpRequest(`${origin}/pricing?utm_medium=organic`, {
      headers: documentHeaders({ "sec-gpc": "1" }),
    });
    assert.equal(gpc.status, 200, "GPC request should still render the page");
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(
      await count("/pricing", "organic_search"),
      dntBaseline,
      "bot, RSC, prefetch, and GPC requests must not count",
    );

    const privatePage = await rawHttpRequest(`${origin}/dashboard`, {
      headers: documentHeaders(),
    });
    assert.equal(privatePage.status, 307, "private page should retain its auth redirect");
    const privateRows = await queryRows<{ count: string }>(
      db,
      "SELECT COUNT(*)::text AS count FROM marketing_pageviews WHERE path = '/dashboard'",
    );
    assert.equal(Number(privateRows[0]?.count), 0, "private paths must not create marketing rows");

    const { hashAuthCode } = await import("../../src/lib/auth/code-hash");
    const verifySignup = async (email: string, code: string, dnt: boolean) => {
      await db.query(
        `INSERT INTO auth_codes (email, code_hash, role, event_id, expires_at)
         VALUES ($1, $2, 'admin', NULL, NOW() + INTERVAL '10 minutes')`,
        [email, hashAuthCode({ code, recipient: email, role: "admin" })],
      );
      const response = await fetch(`${origin}/api/auth/verify-code`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          origin,
          referer: `${origin}/signup`,
          ...(dnt ? { dnt: "1" } : {}),
        },
        body: JSON.stringify({ method: "email", email, code, channel: "email" }),
      });
      assert.equal(response.status, 200, `synthetic ${dnt ? "DNT" : "attributed"} OTP should verify`);
      await response.arrayBuffer();
    };
    await verifySignup("native-attributed@example.test", "482913", false);
    await verifySignup("native-dnt@example.test", "593824", true);
    const signupChannels = await queryRows<{ email: string; channel: string | null; has_channel: boolean }>(
      db,
      `SELECT owner.email, ae.metadata->>'channel' AS channel, ae.metadata ? 'channel' AS has_channel
       FROM activation_events ae
       JOIN admin_users owner ON owner.id = ae.user_id
       WHERE ae.event_name = 'account_created'
         AND owner.email IN ('native-attributed@example.test', 'native-dnt@example.test')
       ORDER BY owner.email`,
    );
    assert.deepEqual(signupChannels, [
      { email: "native-attributed@example.test", channel: "email", has_channel: true },
      { email: "native-dnt@example.test", channel: null, has_channel: false },
    ], "OTP signup attribution should persist and DNT should omit the channel");
  } finally {
    app.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (app.exitCode !== null) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        app.kill("SIGKILL");
        resolve();
      }, 3000);
      app.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

async function seedGrowthFixtures(db: QaDb): Promise<void> {
  const social = "00000000-0000-4000-8000-000000000101";
  const unknown = "00000000-0000-4000-8000-000000000102";
  const recent = "00000000-0000-4000-8000-000000000103";
  const accountCreatedAt = {
    social: ago(10, 5),
    unknown: ago(9, 5),
    recent: ago(2, 5),
  };

  await db.query(
    `INSERT INTO admin_users (id, email, password, name, created_at)
     VALUES ($1, $2, 'native-fixture-password', 'Native Social', $3),
            ($4, $5, 'native-fixture-password', 'Native Unknown', $6),
            ($7, $8, 'native-fixture-password', 'Native Recent', $9)`,
    [
      social, "native-social@example.test", accountCreatedAt.social,
      unknown, "native-unknown@example.test", accountCreatedAt.unknown,
      recent, "native-recent@example.test", accountCreatedAt.recent,
    ],
  );

  const activation = async (
    eventName: string,
    userId: string | null,
    createdAt: Date,
    channel?: string,
  ) => db.query(
    `INSERT INTO activation_events (event_name, user_id, metadata, created_at)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [eventName, userId, JSON.stringify(channel === undefined ? {} : { channel }), createdAt],
  );

  await activation("account_created", social, accountCreatedAt.social, "social");
  await activation("account_created", unknown, accountCreatedAt.unknown, "legacy_campaign");
  await activation("account_created", recent, accountCreatedAt.recent, "email");
  await activation("account_created", null, ago(1), "direct");

  // The valid milestones should count, while pre-account and future milestones
  // must be excluded by both the SQL scope and the shaping guard.
  await activation("event_published", social, ago(9));
  await activation("first_rsvp_received", social, ago(8));
  await activation("event_published", unknown, ago(10));
  await activation("first_rsvp_received", recent, ago(1));
  await activation("event_published", recent, ago(1));
  await activation("event_published", unknown, new Date(Date.now() + 60 * 60 * 1000));
  await activation("event_published", social, new Date(Date.now() + 60 * 60 * 1000));
}

export async function runMarketingMeasurementNativeQa({ db }: { db: QaDb }): Promise<void> {
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.OPERATIONS_SECRET = OPERATIONS_SECRET;

  const { recordMarketingViewSafely } = await import("../../src/lib/analytics/marketing-views");
  const { GET } = await import("../../src/app/api/operations/growth/route");

  const execute = async (sql: string, values?: unknown[]) => queryRows(db, sql, values);

  // An expired row is removed on the same write that increments today's row.
  await db.query(
    `INSERT INTO marketing_pageviews (day, path, channel, views)
     VALUES (CURRENT_DATE - 181, '/', 'direct', 4)`,
  );
  const concurrentWrites = await Promise.all(
    Array.from({ length: 16 }, () => recordMarketingViewSafely("/", "social", execute)),
  );
  assert.deepEqual(concurrentWrites, Array(16).fill(true), "all native counter writes should succeed");

  const todaySocial = await queryRows<{ views: string }>(
    db,
    `SELECT views::text FROM marketing_pageviews
     WHERE day = CURRENT_DATE AND path = '/' AND channel = 'social'`,
  );
  assert.equal(Number(todaySocial[0]?.views), 16, "concurrent upserts must not lose increments");
  const expiredRows = await queryRows<{ count: string }>(
    db,
    `SELECT COUNT(*)::text AS count FROM marketing_pageviews WHERE day < CURRENT_DATE - 180`,
  );
  assert.equal(Number(expiredRows[0]?.count), 0, "retention should remove rows older than 180 days");
  assert.equal(await recordMarketingViewSafely("/private", "social", execute), false);
  assert.equal(await recordMarketingViewSafely("/pricing", "legacy_campaign", execute), true);
  const unknownChannel = await queryRows<{ views: string }>(
    db,
    `SELECT views::text FROM marketing_pageviews
     WHERE day = CURRENT_DATE AND path = '/pricing' AND channel = 'unknown'`,
  );
  assert.equal(Number(unknownChannel[0]?.views), 1, "legacy channels should bucket into unknown");

  await seedGrowthFixtures(db);

  const { NextRequest } = await import("next/server");
  const unauthorized = await GET(new NextRequest("http://127.0.0.1/api/operations/growth", {
    headers: { authorization: "Bearer wrong-secret" },
  }));
  assert.equal(unauthorized.status, 404, "growth report must stay hidden without the operations secret");

  const authorized = await GET(new NextRequest("http://127.0.0.1/api/operations/growth", {
    headers: { authorization: `Bearer ${OPERATIONS_SECRET}` },
  }));
  assert.equal(authorized.status, 200, "authorized growth report should be available");
  assert.equal(authorized.headers.get("cache-control"), "private, no-store");
  const report = await authorized.json() as {
    landingPageviews: { total: number; byChannel: Record<string, number> };
    signupCohorts: { total: number; byChannel: Record<string, number> };
    ownerActivations: {
      eventPublished: { numerator: number; denominator: number };
      firstRsvpReceived: { numerator: number; denominator: number };
    };
    sevenDayMatureCohort: {
      eventPublished: { numerator: number; denominator: number };
      firstRsvpReceived: { numerator: number; denominator: number };
    };
  };

  assert.equal(report.landingPageviews.byChannel.social, 16);
  assert.equal(report.landingPageviews.byChannel.unknown, 1);
  assert.equal(report.landingPageviews.total, 17);
  assert.equal(report.signupCohorts.total, 3, "only joined, recent account-created events should form cohorts");
  assert.equal(report.signupCohorts.byChannel.social, 1);
  assert.equal(report.signupCohorts.byChannel.unknown, 1);
  assert.equal(report.signupCohorts.byChannel.email, 1);
  assert.deepEqual(report.ownerActivations.eventPublished, { numerator: 2, denominator: 3, rate: 2 / 3 });
  assert.deepEqual(report.ownerActivations.firstRsvpReceived, { numerator: 2, denominator: 3, rate: 2 / 3 });
  assert.deepEqual(report.sevenDayMatureCohort.eventPublished, { numerator: 1, denominator: 2, rate: 1 / 2 });
  assert.deepEqual(report.sevenDayMatureCohort.firstRsvpReceived, { numerator: 1, denominator: 2, rate: 1 / 2 });

  const serialized = JSON.stringify(report);
  for (const privateValue of [
    "native-social@example.test",
    "native-unknown@example.test",
    "native-recent@example.test",
    "00000000-0000-4000-8000-000000000101",
  ]) {
    assert.equal(serialized.includes(privateValue), false, "report must not expose raw identity values");
  }
  assert.equal(serialized.includes("user_id"), false, "report must not expose raw identity fields");

  await runHttpProxyCollectionCheck(db);
}

async function main(): Promise<void> {
  process.env.SEALSEND_QA_USE_POSTGRES = "true";
  process.env.SESSION_SECRET = SESSION_SECRET;
  let harness: NativeHarness | undefined;
  try {
    harness = await startSocialQa();
    await runMarketingMeasurementNativeQa({ db: harness.db });
    console.log("PASS native PostgreSQL marketing counters, retention, protected growth report, and signup milestones");
  } finally {
    if (harness) {
      await harness.server.stop();
      await harness.db.close();
    }
  }
}

if (process.argv[1]?.endsWith("marketing-measurement-native.ts")) {
  void main().catch((error) => {
    console.error("Native marketing measurement QA failure:", error);
    process.exitCode = 1;
  });
}

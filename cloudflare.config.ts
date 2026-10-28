import { bindings, defineConfig, defineWorker, triggers } from "cf/config";

// Only names declared here reach the app's process.env on Workers.
// Set each with `cf secret put <NAME>` (see docs/cloudflare-migration.md).
const SECRET_NAMES = [
  "SESSION_SECRET",
  "CRON_SECRET",
  "OPERATIONS_SECRET",
  "UNSUBSCRIBE_SECRET",
  "MONITORING_TEST_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_YEARLY_PRICE_ID",
  "MAILGUN_API_KEY",
  "MAILGUN_DOMAIN",
  "MAILGUN_WEBHOOK_SIGNING_KEY",
  "FROM_EMAIL",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_API_KEY_SID",
  "TWILIO_API_KEY_SECRET",
  "TWILIO_MESSAGING_SERVICE_SID",
  "TWILIO_FROM_NUMBER",
  "TWILIO_WEBHOOK_URL",
  "COMMUNICATIONS_ALLOWED_RECIPIENTS",
  "OPENAI_API_KEY",
  "AI_PROVIDER",
  "AI_MODEL",
  "AI_IMAGE_MODEL",
  "ERROR_ALERT_WEBHOOK_URL",
] as const;

// Safe defaults that match the controlled beta (see CLAUDE.md and DEPLOYMENT_READINESS.md).
// Payments and outbound messages stay test-only and every automation stays off until you change them here.
const PLAIN_VALUES = {
  // Override with NEXT_PUBLIC_SITE_URL at build time for a workers.dev rehearsal, so links don't point at production.
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "https://sealsend.app",
  PAYMENTS_TEST_ONLY: "true",
  COMMUNICATIONS_TEST_ONLY: "true",
  ENABLE_STALE_DRAFT_CLEANUP: "false",
  ENABLE_ORPHAN_UPLOAD_CLEANUP: "false",
  ENABLE_HOST_LIFECYCLE_EMAILS: "false",
  ENABLE_NATIVE_MOBILE_API: "false",
  // Cloudflare overwrites CF-Connecting-IP, so rate limits can trust it (src/lib/rate-limit.ts).
  TRUST_CF_CONNECTING_IP: "true",
} as const;

export default defineConfig({
  worker: defineWorker({
    name: "sealsend",
    entrypoint: "./worker/index.ts",
    compatibilityDate: "2026-10-28",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      // Uploaded covers, logos and private album photos (replaces the VPS uploads/ folder).
      UPLOADS: bindings.r2({ name: "sealsend-uploads" }),
      // Image resizing (replaces sharp).
      IMAGES: bindings.images(),
      // The database (replaces PostgreSQL). Create it once and export D1_DATABASE_ID; see docs/d1-port.md.
      DB: bindings.d1({ name: "sealsend-db", id: process.env.D1_DATABASE_ID }),
      ...Object.fromEntries(SECRET_NAMES.map((name) => [name, bindings.secret()])),
      ...Object.fromEntries(Object.entries(PLAIN_VALUES).map(([name, value]) => [name, bindings.text(value)])),
    },
    // Keep in sync with CRON_ROUTES in worker/index.ts.
    triggers: [
      triggers.scheduled({ schedule: "* * * * *" }),
      triggers.scheduled({ schedule: "10 3 * * *" }),
      triggers.scheduled({ schedule: "15 3 * * *" }),
    ],
  }),
});

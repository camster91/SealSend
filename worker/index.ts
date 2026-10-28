import handler from "vinext/server/fetch-handler";
import { runWithDbScope } from "@/lib/db/client.cloudflare";

type WorkerEnv = { CRON_SECRET?: string; NEXT_PUBLIC_SITE_URL?: string } & Record<string, unknown>;
type ExecutionContextLike = { waitUntil(promise: Promise<unknown>): void };
type FetchHandler = { fetch(request: Request, env: unknown, ctx: ExecutionContextLike): Promise<Response> | Response };

/**
 * Maps each Cron Trigger schedule (see cloudflare.config.ts) to the route that
 * the VPS crontab used to call. Reminders, announcements, host lifecycle and
 * draft cleanup stay off until their provider/retention gates pass, as in
 * ops/sealsend-maintenance.cron.
 */
export const CRON_ROUTES: Record<string, string> = {
  "* * * * *": "/api/cron/deliver-webhooks",
  "10 3 * * *": "/api/cron/delete-accounts",
  "15 3 * * *": "/api/cron/cleanup-uploads",
};

const app = handler as unknown as FetchHandler;

/**
 * next.config.ts rewrites /uploads/* to /api/uploads/*. Doing it here keeps the
 * route's long-lived Cache-Control header, which the generic rewrite path drops.
 */
function rewriteUploads(request: Request): Request {
  const url = new URL(request.url);
  if (request.method !== "GET" || !url.pathname.startsWith("/uploads/")) return request;
  url.pathname = `/api${url.pathname}`;
  return new Request(url, request);
}

const worker = {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContextLike) {
    return runWithDbScope(() => app.fetch(rewriteUploads(request), env, ctx));
  },

  async scheduled(controller: { cron: string }, env: WorkerEnv, ctx: ExecutionContextLike) {
    const route = CRON_ROUTES[controller.cron];
    if (!route || !env.CRON_SECRET) return;
    const origin = env.NEXT_PUBLIC_SITE_URL ?? "https://sealsend.app";
    const request = new Request(`${origin}${route}`, { method: "POST", headers: { Authorization: `Bearer ${env.CRON_SECRET}` } });
    const response = await runWithDbScope(() => app.fetch(request, env, ctx));
    if (!response.ok) console.error(`[cron] ${route} returned ${response.status}`);
  },
};

export default worker;

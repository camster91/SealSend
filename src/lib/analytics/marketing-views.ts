import { query } from "@/lib/db/client";
import { MARKETING_PATHS, normalizeMarketingChannel } from "./marketing-attribution";

type Execute = (sql: string, params?: unknown[]) => Promise<unknown[]>;

// Only daily counters are retained. No request headers, query strings or IDs are persisted.
export async function recordMarketingViewSafely(path: string, channel: unknown, execute: Execute = query): Promise<boolean> {
  if (!MARKETING_PATHS.includes(path as typeof MARKETING_PATHS[number])) return false;
  try {
    await execute(`WITH expired AS (
      DELETE FROM marketing_pageviews WHERE day <= ((NOW() AT TIME ZONE 'UTC')::date - 180)
    ) INSERT INTO marketing_pageviews (day, path, channel, views)
      VALUES ((NOW() AT TIME ZONE 'UTC')::date, $1, $2, 1)
      ON CONFLICT (day, path, channel) DO UPDATE SET views = marketing_pageviews.views + 1`,
    [path, normalizeMarketingChannel(channel)]);
    return true;
  } catch { return false; } // Measurement must never break navigation.
}

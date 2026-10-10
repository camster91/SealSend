export const MARKETING_CHANNELS = ["direct", "organic_search", "social", "email", "referral", "unknown"] as const;
export type MarketingChannel = typeof MARKETING_CHANNELS[number];

export const MARKETING_PATHS = [
  "/", "/how-it-works", "/pricing", "/rsvp-tracking", "/qr-event-check-in", "/use-cases",
  "/use-cases/event-planners", "/use-cases/weddings", "/use-cases/birthday-parties",
  "/use-cases/community-events", "/use-cases/nonprofit-events", "/use-cases/clubs-associations",
  "/use-cases/professional-gatherings",
] as const;

export function normalizeMarketingChannel(value: unknown): MarketingChannel {
  return MARKETING_CHANNELS.includes(value as MarketingChannel) ? value as MarketingChannel : "unknown";
}

export function measurementOptedOut(headers: Pick<Headers, "get">): boolean {
  return headers.get("dnt") === "1" || headers.get("sec-gpc") === "1";
}

export function classifyMarketingChannel(url: URL, referrer: string | null): MarketingChannel {
  const explicit = url.searchParams.get("source");
  if (explicit !== null) return normalizeMarketingChannel(explicit);
  const medium = url.searchParams.get("utm_medium")?.toLowerCase();
  if (medium === "email" || medium === "newsletter") return "email";
  if (medium === "social" || medium === "social-organic") return "social";
  if (medium === "organic") return "organic_search";
  if (medium === "referral") return "referral";
  if ([...url.searchParams.keys()].some(key => key.startsWith("utm_") || key === "gclid")) return "unknown";
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host === url.hostname.toLowerCase()) return "direct";
    const matches = (domains: string[]) => domains.some(domain => host === domain || host.endsWith(`.${domain}`));
    if (matches(["google.com", "google.ca", "google.co.uk", "google.com.au", "bing.com", "duckduckgo.com", "search.yahoo.com"])) return "organic_search";
    if (matches(["facebook.com", "instagram.com", "linkedin.com", "reddit.com", "x.com", "twitter.com", "tiktok.com", "youtube.com"])) return "social";
    return "referral";
  } catch { return "unknown"; }
}

export function marketingSignupHref(channel: MarketingChannel): string {
  return channel === "direct" ? "/signup" : `/signup?source=${normalizeMarketingChannel(channel)}`;
}

export function marketingMeasurement(request: { url: string; method: string; headers: Headers; hasSession: boolean }): { path: string; channel: MarketingChannel } | null {
  const url = new URL(request.url);
  const h = request.headers;
  const agent = h.get("user-agent") ?? "";
  if (request.method !== "GET" || request.hasSession || measurementOptedOut(h)
    || !MARKETING_PATHS.includes(url.pathname as typeof MARKETING_PATHS[number])
    || !h.get("accept")?.includes("text/html")
    || h.get("sec-fetch-dest") !== "document" || h.get("sec-fetch-mode") !== "navigate"
    || !agent || /bot|crawl|spider|headless|playwright|lighthouse|preview|slurp/i.test(agent)
    || h.has("rsc") || h.has("next-router-prefetch") || h.has("next-router-state-tree")
    || /prefetch/i.test(`${h.get("purpose") ?? ""} ${h.get("sec-purpose") ?? ""}`)
    || url.searchParams.has("_rsc") || url.searchParams.has("__next_router_prefetch")) return null;
  return { path: url.pathname, channel: classifyMarketingChannel(url, h.get("referer")) };
}

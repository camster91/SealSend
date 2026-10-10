import { query } from "@/lib/db/client";

export const GROWTH_CHANNELS = [
  "direct",
  "organic_search",
  "social",
  "email",
  "referral",
  "unknown",
] as const;

export type GrowthChannel = (typeof GROWTH_CHANNELS)[number];

export type GrowthRate = {
  numerator: number;
  denominator: number;
  rate: number | null;
};

export type ChannelBreakdown<T> = Record<GrowthChannel, T>;

export type GrowthReport = {
  asOf: string;
  window: {
    days: 30;
    fromDay: string;
    throughDay: string;
  };
  landingPageviews: {
    total: number;
    byChannel: ChannelBreakdown<number>;
  };
  signupCohorts: {
    total: number;
    byChannel: ChannelBreakdown<number>;
    byDay: Array<{
      day: string;
      total: number;
      byChannel: ChannelBreakdown<number>;
    }>;
  };
  ownerActivations: {
    eventPublished: GrowthRate;
    firstRsvpReceived: GrowthRate;
  };
  sevenDayMatureCohort: {
    matureShare: GrowthRate;
    eventPublished: GrowthRate;
    firstRsvpReceived: GrowthRate;
    byChannel: ChannelBreakdown<{
      matureShare: GrowthRate;
      eventPublished: GrowthRate;
      firstRsvpReceived: GrowthRate;
    }>;
  };
  limitations: readonly string[];
};

export type GrowthPageviewRow = {
  day?: unknown;
  channel?: unknown;
  views?: unknown;
};

export type GrowthSignupRow = {
  user_id?: unknown;
  account_created_at?: unknown;
  channel?: unknown;
  event_published_at?: unknown;
  first_rsvp_received_at?: unknown;
};

export type GrowthReportQueryExecutor = (
  sql: string,
  params?: unknown[],
) => Promise<unknown[]>;

export type GrowthReportOptions = {
  now?: Date;
  execute?: GrowthReportQueryExecutor;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const COHORT_DAYS = 30;
const MATURITY_DAYS = 7;

export const GROWTH_REPORT_LIMITATIONS = [
  "Landing-pageview totals are anonymous counts and must not be compared with unique visitors or signup counts as if they represented the same people.",
  "Activation events are recorded telemetry; raw production data may include historical QA activity and is not customer proof.",
  "The seven-day mature cohort requires an account to be at least seven days old; its milestone counts run through the report as-of time and are not limited to the first seven days.",
  "A missing activation event is treated as unobserved progress, not proof that a host did not complete the action.",
] as const;

/**
 * Keep acquisition dimensions deliberately small. Legacy, malformed, and
 * future channel values remain visible in the aggregate without creating new
 * reporting dimensions or exposing source data.
 */
export function normalizeGrowthChannel(value: unknown): GrowthChannel {
  if (typeof value !== "string") return "unknown";
  const channel = value.trim().toLowerCase();
  return (GROWTH_CHANNELS as readonly string[]).includes(channel)
    ? channel as GrowthChannel
    : "unknown";
}

function emptyChannelBreakdown<T>(value: T): ChannelBreakdown<T> {
  return Object.fromEntries(GROWTH_CHANNELS.map((channel) => [channel, value])) as ChannelBreakdown<T>;
}

function parseCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Number.isSafeInteger(count) ? count : Math.floor(count);
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateAtUtcStart(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

function rate(numerator: number, denominator: number): GrowthRate {
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? null : numerator / denominator,
  };
}

function cloneZeroChannelCounts(): ChannelBreakdown<number> {
  return emptyChannelBreakdown(0);
}

type NormalizedSignup = {
  userId: string;
  accountCreatedAt: Date;
  channel: GrowthChannel;
  eventPublishedAt: Date | null;
  firstRsvpReceivedAt: Date | null;
};

function normalizeSignupRows(rows: readonly GrowthSignupRow[], now: Date, from: Date): NormalizedSignup[] {
  const byUser = new Map<string, NormalizedSignup>();

  for (const row of rows) {
    if (typeof row.user_id !== "string" || row.user_id.length === 0) continue;
    const accountCreatedAt = parseDate(row.account_created_at);
    if (!accountCreatedAt || accountCreatedAt < from || accountCreatedAt > now) continue;

    const candidate: NormalizedSignup = {
      userId: row.user_id,
      accountCreatedAt,
      channel: normalizeGrowthChannel(row.channel),
      eventPublishedAt: parseDate(row.event_published_at),
      firstRsvpReceivedAt: parseDate(row.first_rsvp_received_at),
    };
    const existing = byUser.get(candidate.userId);
    if (!existing || candidate.accountCreatedAt < existing.accountCreatedAt) {
      byUser.set(candidate.userId, candidate);
    }
  }

  return [...byUser.values()].map((signup) => ({
    ...signup,
    eventPublishedAt: signup.eventPublishedAt
      && signup.eventPublishedAt >= signup.accountCreatedAt
      && signup.eventPublishedAt <= now
      ? signup.eventPublishedAt
      : null,
    firstRsvpReceivedAt: signup.firstRsvpReceivedAt
      && signup.firstRsvpReceivedAt >= signup.accountCreatedAt
      && signup.firstRsvpReceivedAt <= now
      ? signup.firstRsvpReceivedAt
      : null,
  }));
}

function buildMatureMetrics(signups: readonly NormalizedSignup[], now: Date) {
  const matureCutoff = new Date(now.getTime() - MATURITY_DAYS * DAY_MS);
  const mature = signups.filter((signup) => signup.accountCreatedAt <= matureCutoff);
  const published = mature.filter((signup) => signup.eventPublishedAt !== null).length;
  const rsvped = mature.filter((signup) => signup.firstRsvpReceivedAt !== null).length;

  const metrics = Object.fromEntries(GROWTH_CHANNELS.map((channel) => [channel, {
    mature: [] as NormalizedSignup[],
    published: 0,
    rsvped: 0,
  }])) as Record<GrowthChannel, {
    mature: NormalizedSignup[];
    published: number;
    rsvped: number;
  }>;
  for (const signup of mature) {
    metrics[signup.channel].mature.push(signup);
    if (signup.eventPublishedAt) metrics[signup.channel].published += 1;
    if (signup.firstRsvpReceivedAt) metrics[signup.channel].rsvped += 1;
  }

  return {
    mature,
    overall: {
      matureShare: rate(mature.length, signups.length),
      eventPublished: rate(published, mature.length),
      firstRsvpReceived: rate(rsvped, mature.length),
    },
    byChannel: Object.fromEntries(GROWTH_CHANNELS.map((channel) => {
      const channelMetrics = metrics[channel];
      return [channel, {
        matureShare: rate(channelMetrics.mature.length, signups.filter((signup) => signup.channel === channel).length),
        eventPublished: rate(channelMetrics.published, channelMetrics.mature.length),
        firstRsvpReceived: rate(channelMetrics.rsvped, channelMetrics.mature.length),
      }];
    })) as GrowthReport["sevenDayMatureCohort"]["byChannel"],
  };
}

export function shapeGrowthReport(
  pageviewRows: readonly GrowthPageviewRow[],
  signupRows: readonly GrowthSignupRow[],
  now = new Date(),
): GrowthReport {
  const asOf = parseDate(now);
  if (!asOf) throw new Error("Growth report requires a valid as-of date");
  const throughDay = dayKey(asOf);
  const fromDay = dayKey(new Date(dateAtUtcStart(throughDay).getTime() - (COHORT_DAYS - 1) * DAY_MS));
  const from = dateAtUtcStart(fromDay);

  const pageviewsByChannel = cloneZeroChannelCounts();
  for (const row of pageviewRows) {
    const day = parseDate(row.day);
    if (!day || dayKey(day) < fromDay || dayKey(day) > throughDay) continue;
    const channel = normalizeGrowthChannel(row.channel);
    pageviewsByChannel[channel] += parseCount(row.views);
  }

  const signups = normalizeSignupRows(signupRows, asOf, from);
  const signupByChannel = cloneZeroChannelCounts();
  const byDay = new Map<string, { total: number; byChannel: ChannelBreakdown<number> }>();
  for (const signup of signups) {
    signupByChannel[signup.channel] += 1;
    const day = dayKey(signup.accountCreatedAt);
    const cohort = byDay.get(day) ?? { total: 0, byChannel: cloneZeroChannelCounts() };
    cohort.total += 1;
    cohort.byChannel[signup.channel] += 1;
    byDay.set(day, cohort);
  }

  const mature = buildMatureMetrics(signups, asOf);
  const eventPublished = signups.filter((signup) => signup.eventPublishedAt !== null).length;
  const firstRsvpReceived = signups.filter((signup) => signup.firstRsvpReceivedAt !== null).length;
  return {
    asOf: asOf.toISOString(),
    window: { days: COHORT_DAYS, fromDay, throughDay },
    landingPageviews: {
      total: Object.values(pageviewsByChannel).reduce((total, views) => total + views, 0),
      byChannel: pageviewsByChannel,
    },
    signupCohorts: {
      total: signups.length,
      byChannel: signupByChannel,
      byDay: [...byDay.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([day, cohort]) => ({ day, ...cohort })),
    },
    ownerActivations: {
      eventPublished: rate(eventPublished, signups.length),
      firstRsvpReceived: rate(firstRsvpReceived, signups.length),
    },
    sevenDayMatureCohort: {
      matureShare: mature.overall.matureShare,
      eventPublished: mature.overall.eventPublished,
      firstRsvpReceived: mature.overall.firstRsvpReceived,
      byChannel: mature.byChannel,
    },
    limitations: GROWTH_REPORT_LIMITATIONS,
  };
}

const PAGEVIEW_SQL = `
  SELECT day::text AS day, channel, SUM(views)::text AS views
  FROM marketing_pageviews
  WHERE day >= $1::date AND day <= $2::date
  GROUP BY day, channel
`;

const SIGNUP_SQL = `
  WITH created_events AS (
    SELECT ae.user_id, ae.created_at, ae.metadata->>'channel' AS channel
    FROM activation_events ae
    JOIN admin_users owner ON owner.id = ae.user_id
    WHERE ae.event_name = 'account_created'
      AND ae.user_id IS NOT NULL
      AND ae.created_at >= $1::timestamptz
      AND ae.created_at <= $2::timestamptz
  ),
  accounts AS (
    SELECT DISTINCT ON (user_id)
      user_id,
      created_at AS account_created_at,
      CASE
        WHEN channel IN ('direct', 'organic_search', 'social', 'email', 'referral') THEN channel
        ELSE 'unknown'
      END AS channel
    FROM created_events
    ORDER BY user_id, created_at ASC
  ),
  milestones AS (
    SELECT
      ae.user_id,
      MIN(ae.created_at) FILTER (WHERE ae.event_name = 'event_published') AS event_published_at,
      MIN(ae.created_at) FILTER (WHERE ae.event_name = 'first_rsvp_received') AS first_rsvp_received_at
    FROM activation_events ae
    JOIN accounts ON accounts.user_id = ae.user_id
    WHERE ae.event_name IN ('event_published', 'first_rsvp_received')
      AND ae.created_at >= accounts.account_created_at
      AND ae.created_at <= $2::timestamptz
    GROUP BY ae.user_id
  )
  SELECT
    accounts.user_id,
    accounts.account_created_at,
    accounts.channel,
    milestones.event_published_at,
    milestones.first_rsvp_received_at
  FROM accounts
  LEFT JOIN milestones ON milestones.user_id = accounts.user_id
`;

export async function buildGrowthReport({ now = new Date(), execute = query }: GrowthReportOptions = {}): Promise<GrowthReport> {
  const asOf = parseDate(now);
  if (!asOf) throw new Error("Growth report requires a valid as-of date");
  const throughDay = dayKey(asOf);
  const fromDay = dayKey(new Date(dateAtUtcStart(throughDay).getTime() - (COHORT_DAYS - 1) * DAY_MS));
  const from = dateAtUtcStart(fromDay);

  const [pageviewRows, signupRows] = await Promise.all([
    execute(PAGEVIEW_SQL, [fromDay, throughDay]),
    execute(SIGNUP_SQL, [from.toISOString(), asOf.toISOString()]),
  ]);
  return shapeGrowthReport(
    pageviewRows as GrowthPageviewRow[],
    signupRows as GrowthSignupRow[],
    asOf,
  );
}

export const growthReportSql = {
  pageviews: PAGEVIEW_SQL,
  signups: SIGNUP_SQL,
} as const;

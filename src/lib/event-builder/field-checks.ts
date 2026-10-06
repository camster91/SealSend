import { isSafeHttpUrl } from "@/lib/validations";
import type { BuilderData } from "./schema";

/**
 * Client-side copies of the caps in eventCreateSchema (src/lib/validations.ts).
 * A value that fails one of these is kept on screen and never sent, so one bad
 * field can't make every later autosave fail.
 */
export const TEXT_LIMITS = {
  title: 200,
  description: 2000,
  location_name: 200,
  location_address: 500,
  host_name: 200,
  dress_code: 100,
  invitation_headline: 200,
  invitation_body: 2000,
} as const satisfies Partial<Record<keyof BuilderData, number>>;

export const MAX_REGISTRIES = 10;
export const REGISTRY_LABEL_MAX = 100;
export const LINK_MAX = 500;

export const DRAFT_NAME_ERROR = "Add a name for your event.";
export const LINK_ERROR = "Use a full web address that starts with https://";
export const LINK_TOO_LONG = "That link is too long. Use a shorter one.";

export type FieldErrors = Partial<Record<keyof BuilderData, string>>;

/** Text fields longer than the server allows. */
export function textLimitErrors(d: Partial<BuilderData>): FieldErrors {
  const errors: FieldErrors = {};
  for (const [key, max] of Object.entries(TEXT_LIMITS) as Array<[keyof typeof TEXT_LIMITS, number]>) {
    const value = d[key];
    if (typeof value === "string" && value.length > max) errors[key] = `Keep this to ${max} characters or fewer.`;
  }
  return errors;
}

/** An image or media link: blank is fine, otherwise https:// or one of our /uploads/ paths. */
export function checkLink(url: string): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > LINK_MAX) return LINK_TOO_LONG;
  return isSafeHttpUrl(trimmed) ? undefined : LINK_ERROR;
}

/** Checks a gift registry link before it is added to a list that already has `count` links. */
export function checkRegistryLink(label: string, url: string, count: number): string | undefined {
  if (count >= MAX_REGISTRIES) return `You can add up to ${MAX_REGISTRIES} gift registry links.`;
  if (!label.trim()) return "Add a name for the link.";
  if (label.trim().length > REGISTRY_LABEL_MAX) return `Keep the link name to ${REGISTRY_LABEL_MAX} characters or fewer.`;
  if (!url.trim()) return "Add a full web address, starting with https://";
  const problem = checkLink(url);
  return problem === LINK_ERROR ? "Add a full web address, starting with https://" : problem;
}

export const STORED_LINK_ERROR = "This link needs to start with https://";

/** A whitespace-only link is an empty one; anything else is returned as typed. */
export function normalizeLink(url: string): string {
  return url.trim() === "" ? "" : url;
}

/** Old events can hold http:// links saved before https-only. Only the scheme changes. */
export function upgradeHttp(url: string): string {
  return /^http:\/\//i.test(url) ? `https://${url.slice(7)}` : url;
}

/** What to show under a link that is already stored on the event, or undefined if it is fine. */
export function storedLinkProblem(url: string): string | undefined {
  const problem = checkLink(url);
  return problem === LINK_ERROR ? STORED_LINK_ERROR : problem;
}

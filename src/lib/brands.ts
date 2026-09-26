import { z } from "zod";
import { queryOne } from "@/lib/db/client";
import { sanitizeFontFamily, sanitizeUrl } from "@/lib/sanitize";
import { ORGANIZER_PLANS } from "@/lib/constants";
import { DEFAULT_SMS_SIGNATURE } from "@/lib/sms-templates";
import type { EmailBrand } from "@/lib/email-templates";

export type Brand = {
  id: string;
  organization_id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  background_color: string | null;
  font_family: string | null;
  sender_name: string | null;
  reply_to_email: string | null;
  sms_signature: string | null;
  white_label: boolean;
};

/** A brand as it applies to one event, with white-labelling already resolved against the plan. */
export type EventBranding = {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  backgroundColor: string | null;
  fontFamily: string | null;
  senderName: string | null;
  replyToEmail: string | null;
  smsSignature: string | null;
  whiteLabel: boolean;
};

const WHITE_LABEL_PLANS: ReadonlySet<string> = new Set(Object.keys(ORGANIZER_PLANS));

/** Only paid organizer workspaces may hide SealSend entirely. */
export function canWhiteLabel(organizationPlan: string | null | undefined): boolean {
  return Boolean(organizationPlan && WHITE_LABEL_PLANS.has(organizationPlan));
}

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a 6-digit hex colour like #7c3aed");
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable().optional();

export const brandInputSchema = z.object({
  name: z.string().trim().min(1, "Brand name is required").max(80),
  logoUrl: z.string().trim().max(500).nullable().optional(),
  primaryColor: hexColor.nullable().optional(),
  backgroundColor: hexColor.nullable().optional(),
  fontFamily: z.string().trim().max(60).nullable().optional(),
  senderName: optionalText(60),
  replyToEmail: z.string().trim().email("Enter a valid reply-to email").max(254).nullable().optional().or(z.literal("").transform(() => null)),
  smsSignature: optionalText(40),
  whiteLabel: z.boolean().optional(),
});
export type BrandInput = z.infer<typeof brandInputSchema>;

/** Normalizes validated input into column values, dropping unsafe logo URLs and unknown fonts. */
export function toBrandColumns(input: BrandInput) {
  return {
    name: input.name,
    logo_url: input.logoUrl ? sanitizeUrl(input.logoUrl) : null,
    primary_color: input.primaryColor ?? null,
    background_color: input.backgroundColor ?? null,
    font_family: input.fontFamily ? sanitizeFontFamily(input.fontFamily) : null,
    sender_name: input.senderName ?? null,
    reply_to_email: input.replyToEmail ?? null,
    sms_signature: input.smsSignature ?? null,
    white_label: Boolean(input.whiteLabel),
  };
}

export function toEventBranding(brand: Brand | null, organizationPlan: string | null | undefined): EventBranding | null {
  if (!brand) return null;
  return {
    name: brand.name,
    logoUrl: sanitizeUrl(brand.logo_url),
    primaryColor: brand.primary_color,
    backgroundColor: brand.background_color,
    fontFamily: brand.font_family,
    senderName: brand.sender_name,
    replyToEmail: brand.reply_to_email,
    smsSignature: brand.sms_signature,
    whiteLabel: brand.white_label && canWhiteLabel(organizationPlan),
  };
}

/**
 * Event customization wins; brand values fill whatever the event left unset.
 * Works on the raw stored customization so defaults applied by
 * sanitizeCustomization() never mask the brand.
 */
export function mergeBrandIntoCustomization(
  raw: Record<string, unknown> | null | undefined,
  branding: EventBranding | null,
): Record<string, unknown> {
  const customization = { ...(raw ?? {}) };
  if (!branding) return customization;
  const fill = (key: string, value: string | null) => {
    if (value && (customization[key] === undefined || customization[key] === null || customization[key] === "")) {
      customization[key] = value;
    }
  };
  fill("primaryColor", branding.primaryColor);
  fill("backgroundColor", branding.backgroundColor);
  fill("fontFamily", branding.fontFamily);
  fill("logoUrl", branding.logoUrl);
  return customization;
}

export function smsSignature(branding: EventBranding | null): string {
  if (!branding) return DEFAULT_SMS_SIGNATURE;
  const label = branding.smsSignature || branding.name;
  return branding.whiteLabel ? `- ${label}` : `- ${label} via Seal and Send`;
}

/** Display name for the From header; the address itself stays SealSend's verified sender. */
export function emailFromHeader(branding: EventBranding | null, fromAddress: string): string {
  if (!branding) return fromAddress;
  const display = (branding.senderName || branding.name).replace(/["<>\r\n]/g, "").trim();
  if (!display) return fromAddress;
  const address = fromAddress.match(/<([^>]+)>/)?.[1] ?? fromAddress;
  return branding.whiteLabel ? `"${display}" <${address}>` : `"${display} via SealSend" <${address}>`;
}

export function emailBrand(branding: EventBranding | null): EmailBrand | null {
  return branding ? { name: branding.name, logoUrl: branding.logoUrl, whiteLabel: branding.whiteLabel } : null;
}

/** From/Reply-To overrides for sendEmail(); empty when the event has no brand. */
export function emailSendOptions(branding: EventBranding | null, fromAddress = process.env.FROM_EMAIL): { from?: string; replyTo?: string } {
  if (!branding) return {};
  return {
    ...(fromAddress ? { from: emailFromHeader(branding, fromAddress) } : {}),
    ...(branding.replyToEmail ? { replyTo: branding.replyToEmail } : {}),
  };
}

export async function getEventBranding(eventId: string): Promise<EventBranding | null> {
  const row = await queryOne<Brand & { organization_plan: string | null }>(
    `SELECT b.*, o.plan AS organization_plan
       FROM events e
       JOIN organizations o ON o.id = e.organization_id
       JOIN brands b ON b.id = COALESCE(e.brand_id, (
         SELECT id FROM brands WHERE organization_id = e.organization_id AND is_default
       ))
      WHERE e.id = $1`,
    [eventId],
  );
  return row ? toEventBranding(row, row.organization_plan) : null;
}

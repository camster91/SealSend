/**
 * Email client.
 *
 * Two providers, tried in this order:
 * 1. Mailgun, when MAILGUN_API_KEY and MAILGUN_DOMAIN are set.
 * 2. Cloudflare Email Service, through the Worker's `EMAIL` send_email binding,
 *    when that binding exists and FROM_EMAIL is set to an address on a domain
 *    that is onboarded to Email Sending (see docs/cloudflare-migration.md).
 *
 * With neither configured, email is off: isEmailConfigured() is false and
 * sendEmail() throws, so callers that need email can say so up front.
 */

import { sendEmail as sendMailgunEmail, isMailgunConfigured } from './mailgun';
import { assertApprovedRecipient } from './communications-safety';
import { getBinding } from './runtime-bindings';

export { isMailgunConfigured };

type CloudflareEmailBinding = {
  send(message: {
    to: string | string[];
    from: string | { email: string; name?: string };
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
    headers?: Record<string, string>;
  }): Promise<{ messageId?: string } | undefined>;
};

function cloudflareEmailBinding(): CloudflareEmailBinding | undefined {
  const binding = getBinding<CloudflareEmailBinding>('EMAIL');
  return binding && typeof binding.send === 'function' ? binding : undefined;
}

export function isCloudflareEmailConfigured(): boolean {
  return !!cloudflareEmailBinding() && !!process.env.FROM_EMAIL;
}

export function isEmailConfigured(): boolean {
  return isMailgunConfigured() || isCloudflareEmailConfigured();
}

/**
 * Email + password sign-up is only open while no email provider is configured,
 * because then a host can't receive a sign-in code.
 */
export function isPasswordSignupEnabled(): boolean {
  return !isEmailConfigured();
}

interface SendEmailParams {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Extra MIME headers, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
}

/** "SealSend <hello@sealsend.app>" -> { name, email }; a bare address stays a string. */
function parseFrom(from: string): string | { email: string; name?: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) return from.trim();
  const name = match[1].replace(/^"|"$/g, '').trim();
  return name ? { email: match[2].trim(), name } : match[2].trim();
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function sendEmail(params: SendEmailParams): Promise<{ id: string }> {
  for (const recipient of Array.isArray(params.to) ? params.to : [params.to]) {
    assertApprovedRecipient(recipient);
  }

  const fromEmail = params.from || process.env.FROM_EMAIL;

  if (isMailgunConfigured()) {
    if (!fromEmail) throw new Error('FROM_EMAIL not configured');
    const result = await sendMailgunEmail({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
      headers: params.headers,
    });
    return { id: result.id };
  }

  const binding = cloudflareEmailBinding();
  if (binding && fromEmail) {
    const result = await binding.send({
      from: parseFrom(fromEmail),
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text ?? htmlToText(params.html),
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
      ...(params.headers ? { headers: params.headers } : {}),
    });
    return { id: result?.messageId ?? crypto.randomUUID() };
  }

  throw new Error(
    'Email is not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN, or set FROM_EMAIL with the Cloudflare EMAIL binding.'
  );
}

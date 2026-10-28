/**
 * Mailgun email client
 * Calls the Mailgun REST API with fetch, so it runs on Node and on Cloudflare Workers.
 */

// US endpoint, as before. (MAILGUN_URL in .env.example has never been read.)
const MAILGUN_API_BASE = 'https://api.mailgun.net';

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export function getMailgunApiKey(): string {
  const apiKey = process.env.MAILGUN_API_KEY;
  if (!apiKey || apiKey === 'your-mailgun-api-key') {
    throw new Error(
      'MAILGUN_API_KEY is not configured. Please set a valid Mailgun API key in your environment variables. Get one at https://mailgun.com'
    );
  }
  return apiKey;
}

export function getMailgunDomain(): string {
  const domain = process.env.MAILGUN_DOMAIN;
  if (!domain) {
    throw new Error('MAILGUN_DOMAIN is not configured');
  }
  return domain;
}

export function isMailgunConfigured(): boolean {
  const hasApiKey = !!process.env.MAILGUN_API_KEY && 
                    process.env.MAILGUN_API_KEY !== 'your-mailgun-api-key';
  const hasDomain = !!process.env.MAILGUN_DOMAIN;
  return hasApiKey && hasDomain;
}

interface SendEmailParams {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  bcc?: string | string[];
  cc?: string | string[];
  replyTo?: string;
  /** Extra MIME headers, sent to Mailgun as h:<Name> fields. */
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    data: Buffer | string;
    contentType?: string;
  }>;
}

interface MailgunResponse {
  id: string;
  message: string;
}

export async function sendEmail(params: SendEmailParams, fetchImpl: FetchLike = fetch): Promise<MailgunResponse> {
  const apiKey = getMailgunApiKey();
  const domain = getMailgunDomain();

  const form = new FormData();
  const append = (name: string, value: string | string[]) => {
    for (const item of Array.isArray(value) ? value : [value]) form.append(name, item);
  };
  append('from', params.from);
  append('to', params.to);
  append('subject', params.subject);
  append('html', params.html);
  if (params.text) append('text', params.text);
  if (params.cc) append('cc', params.cc);
  if (params.bcc) append('bcc', params.bcc);
  if (params.replyTo) append('h:Reply-To', params.replyTo);

  for (const [name, value] of Object.entries(params.headers ?? {})) {
    // Refuse header injection: names are tokens, values are single lines.
    if (!/^[A-Za-z0-9-]+$/.test(name) || /[\r\n]/.test(value)) {
      throw new Error(`Invalid email header: ${name}`);
    }
    append(`h:${name}`, value);
  }

  for (const attachment of params.attachments ?? []) {
    const blob = new Blob([typeof attachment.data === 'string' ? attachment.data : new Uint8Array(attachment.data)], {
      type: attachment.contentType || 'application/octet-stream',
    });
    form.append('attachment', blob, attachment.filename);
  }

  try {
    const response = await fetchImpl(`${MAILGUN_API_BASE}/v3/${encodeURIComponent(domain)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`api:${apiKey}`)}` },
      body: form,
    });
    const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) {
      throw Object.assign(new Error(payload.message || `Mailgun request failed with HTTP ${response.status}`), { status: response.status });
    }
    return {
      id: payload.id || '',
      message: payload.message || '',
    };
  } catch (error) {
    console.error('Mailgun send error:', error);
    throw error;
  }
}

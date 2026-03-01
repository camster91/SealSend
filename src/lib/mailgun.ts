/**
 * Mailgun email client
 * Uses mailgun.js for sending emails
 */

import Mailgun from 'mailgun.js';
import FormData from 'form-data';

// Mailgun.js requires FormData
const mailgun = new Mailgun(FormData);

let client: ReturnType<typeof mailgun.client> | null = null;

export function getMailgunClient() {
  if (!client) {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;

    if (!apiKey || apiKey === 'your-mailgun-api-key') {
      throw new Error(
        'MAILGUN_API_KEY is not configured. Please set a valid Mailgun API key in your environment variables. Get one at https://mailgun.com'
      );
    }

    if (!domain) {
      throw new Error(
        'MAILGUN_DOMAIN is not configured. Please set your Mailgun domain (e.g., mg.yourdomain.com)'
      );
    }

    client = mailgun.client({
      username: 'api',
      key: apiKey,
      url: process.env.MAILGUN_URL || 'https://api.mailgun.net', // Use https://api.eu.mailgun.net for EU region
    });
  }

  return client;
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

export async function sendEmail(params: SendEmailParams): Promise<MailgunResponse> {
  const client = getMailgunClient();
  const domain = getMailgunDomain();

  const messageData: Record<string, unknown> = {
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  };

  if (params.text) {
    messageData.text = params.text;
  }

  if (params.cc) {
    messageData.cc = params.cc;
  }

  if (params.bcc) {
    messageData.bcc = params.bcc;
  }

  if (params.replyTo) {
    messageData['h:Reply-To'] = params.replyTo;
  }

  if (params.attachments && params.attachments.length > 0) {
    // Mailgun uses multipart/form-data for attachments
    // This is handled automatically by the SDK
    messageData.attachment = params.attachments.map(att => ({
      filename: att.filename,
      data: att.data,
      contentType: att.contentType || 'application/octet-stream',
    }));
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await client.messages.create(domain, messageData as any);
    return {
      id: response.id || '',
      message: response.message || '',
    };
  } catch (error) {
    console.error('Mailgun send error:', error);
    throw error;
  }
}

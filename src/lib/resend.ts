/**
 * Resend email client
 * Uses resend SDK for sending emails
 */

import { Resend } from 'resend';

let client: Resend | null = null;

export function getResendClient() {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey || apiKey === 'your-resend-api-key') {
      throw new Error(
        'RESEND_API_KEY is not configured. Please set a valid Resend API key in your environment variables. Get one at https://resend.com'
      );
    }

    client = new Resend(apiKey);
  }

  return client;
}

export function isResendConfigured(): boolean {
  const hasApiKey = !!process.env.RESEND_API_KEY && 
                    process.env.RESEND_API_KEY !== 'your-resend-api-key' &&
                    process.env.RESEND_API_KEY.length > 0;
  return hasApiKey;
}

interface SendEmailParams {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  bcc?: string | string[];
  cc?: string | string[];
  attachments?: Array<{
    filename: string;
    data: Buffer | string;
    contentType?: string;
  }>;
}

interface ResendResponse {
  id: string;
}

export async function sendEmail(params: SendEmailParams): Promise<ResendResponse> {
  const client = getResendClient();

  const { data, error } = await client.emails.send({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo,
    bcc: params.bcc,
    cc: params.cc,
    attachments: params.attachments,
  });

  if (error) {
    console.error('Resend send error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error('Failed to send email: No ID returned');
  }

  return {
    id: data.id,
  };
}

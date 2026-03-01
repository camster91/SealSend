/**
 * Email client using Mailgun
 * All email functionality goes through Mailgun
 */

import { sendEmail as sendMailgunEmail, isMailgunConfigured } from './mailgun';

export { isMailgunConfigured };

export function isEmailConfigured(): boolean {
  return isMailgunConfigured();
}

interface SendEmailParams {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ id: string }> {
  if (!isMailgunConfigured()) {
    throw new Error(
      'Mailgun not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN environment variables.'
    );
  }

  const fromEmail = params.from || process.env.FROM_EMAIL;
  
  if (!fromEmail) {
    throw new Error('FROM_EMAIL not configured');
  }

  const result = await sendMailgunEmail({
    from: fromEmail,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
  
  return {
    id: result.id,
  };
}

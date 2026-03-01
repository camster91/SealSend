/**
 * Email client using Resend
 * All email functionality goes through Resend
 */

import { sendEmail as sendResendEmail, isResendConfigured } from './resend';

export { isResendConfigured } from './resend';

export function isEmailConfigured(): boolean {
  return isResendConfigured();
}

interface SendEmailParams {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ id: string }> {
  if (!isResendConfigured()) {
    throw new Error(
      'Resend not configured. Set RESEND_API_KEY environment variable.'
    );
  }

  const fromEmail = params.from || process.env.FROM_EMAIL;
  
  if (!fromEmail) {
    throw new Error('FROM_EMAIL not configured');
  }

  const result = await sendResendEmail({
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

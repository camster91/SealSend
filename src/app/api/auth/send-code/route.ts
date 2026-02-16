import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { Resend } from 'resend';
import twilio from 'twilio';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

function getTwilioClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY_SECRET,
    { accountSid: process.env.TWILIO_ACCOUNT_SID }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { method, email, phone, eventId } = body;

    if (!method || (!email && !phone)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Determine role
    let role = 'guest';
    if (method === 'email' && email) {
      // Check if this is an admin email
      const { data: admin } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', email)
        .single();
      
      if (admin) {
        role = 'admin';
      }
    }

    // Store code in database
    const { error: dbError } = await supabase
      .from('auth_codes')
      .upsert({
        email: email || null,
        phone: phone || null,
        code,
        role,
        event_id: eventId,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to generate code' },
        { status: 500 }
      );
    }

    // Send code via appropriate channel
    if (method === 'email' && email) {
      const { error: emailError } = await getResend().emails.send({
        from: 'Seal and Send <noreply@ashbi.ca>',
        to: email,
        subject: role === 'admin' ? 'Your Admin Login Code' : 'Your Guest Access Code',
        html: generateEmailTemplate(code, role as 'admin' | 'guest', eventId)
      });

      if (emailError) {
        console.error('Email error:', emailError);
        return NextResponse.json(
          { error: 'Failed to send email' },
          { status: 500 }
        );
      }
    } else if (method === 'phone' && phone) {
      try {
        await getTwilioClient().messages.create({
          body: `Your Seal and Send ${role} access code: ${code}. This code expires in 15 minutes.`,
          from: process.env.TWILIO_MESSAGING_SERVICE_SID!,
          to: phone
        });
      } catch (error) {
        console.error('SMS error:', error);
        return NextResponse.json(
          { error: 'Failed to send SMS' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Code sent to your ${method === 'email' ? 'email' : 'phone'}`,
      role
    });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateEmailTemplate(code: string, role: 'admin' | 'guest', eventId?: string): string {
  const isAdmin = role === 'admin';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sealsend.app';
  const loginUrl = isAdmin ? `${siteUrl}/login` : eventId ? `${siteUrl}/events/${eventId}/guest` : `${siteUrl}/login`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Top accent bar -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr><td style="height:4px;background:linear-gradient(to right,#7c3aed,#ec4899,#3b82f6);border-radius:16px 16px 0 0;"></td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:0 0 16px 16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#6366f1 50%,#3b82f6 100%);padding:40px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:32px;">${isAdmin ? '&#128272;' : '&#127881;'}</p>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">
                ${isAdmin ? 'Admin Login Code' : 'Guest Access Code'}
              </h1>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">
                <span style="font-weight:600;">Seal</span><span style="color:#c4b5fd;">Send</span>
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 24px 16px;">
              <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">
                ${isAdmin
                  ? 'Enter the code below on the login page to access your admin dashboard.'
                  : 'Enter the code below to access your event as a guest.'}
              </p>
            </td>
          </tr>

          <!-- Code Block -->
          <tr>
            <td style="padding:0 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ff;border-radius:16px;border:2px dashed #c4b5fd;overflow:hidden;">
                <tr>
                  <td style="padding:28px 20px;text-align:center;">
                    <p style="margin:0 0 8px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Your verification code</p>
                    <p style="margin:0;font-size:40px;font-weight:800;letter-spacing:12px;color:#7c3aed;font-family:'Courier New',Courier,monospace;">
                      ${code}
                    </p>
                    <p style="margin:12px 0 0;font-size:13px;color:#9ca3af;">
                      &#9200; Expires in 15 minutes
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:24px 24px 12px;" align="center">
              <a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:12px;font-size:16px;font-weight:600;box-shadow:0 4px 14px rgba(99,102,241,0.35);">
                ${isAdmin ? 'Go to Login' : 'Access Event'}
              </a>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding:12px 24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border-radius:10px;overflow:hidden;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:13px;color:#854d0e;line-height:1.5;">
                      &#128274; <strong>Security tip:</strong> Never share this code with anyone. Seal and Send will never ask for your code via phone or chat.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;border-top:1px solid #f3f4f6;text-align:center;background:#fafafa;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">
                If you didn't request this code, you can safely ignore this email.
              </p>
              <p style="margin:8px 0 0;font-size:13px;font-weight:600;">
                <span style="color:#374151;">Seal</span><span style="color:#7c3aed;">Send</span>
              </p>
              <p style="margin:4px 0 0;font-size:11px;color:#d1d5db;">
                Beautiful Digital Invitations &amp; RSVP Management
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
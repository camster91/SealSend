// supabase/functions/send-invitation/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "https://cdn.nodemailer.com/packages/nodemailer/live.nodemailer.js";

interface InvitationRequest {
  guestEmail: string;
  guestName: string;
  eventTitle: string;
  eventDate?: string;
  location?: string;
  rsvpUrl: string;
  designUrl?: string;
  hostName?: string;
  dressCode?: string;
  rsvpDeadline?: string;
}

serve(async (req: Request): Promise<Response> => {
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers }
    );
  }

  try {
    const smtpHost = Deno.env.get("TITAN_SMTP_HOST") || "smtp.titan.email";
    const smtpPort = parseInt(Deno.env.get("TITAN_SMTP_PORT") || "465");
    const smtpUser = Deno.env.get("TITAN_SMTP_USER") || "contact@sealsend.app";
    const smtpPass = Deno.env.get("TITAN_SMTP_PASSWORD");

    if (!smtpPass) {
      throw new Error("TITAN_SMTP_PASSWORD not configured");
    }

    const data: InvitationRequest = await req.json();

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    // Build HTML email
    const eventDetails = `
      ${data.eventDate ? `<p><strong>Date:</strong> ${new Date(data.eventDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>` : ''}
      ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ''}
      ${data.hostName ? `<p><strong>Hosted by:</strong> ${data.hostName}</p>` : ''}
      ${data.dressCode ? `<p><strong>Dress Code:</strong> ${data.dressCode}</p>` : ''}
      ${data.rsvpDeadline ? `<p><strong>RSVP By:</strong> ${new Date(data.rsvpDeadline).toLocaleDateString()}</p>` : ''}
    `;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr><td style="height:4px;background:linear-gradient(to right,#7c3aed,#ec4899,#3b82f6);border-radius:16px 16px 0 0;"></td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:0 0 16px 16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          ${data.designUrl ? `
          <tr>
            <td style="padding:0;">
              <a href="${data.rsvpUrl}">
                <img src="${data.designUrl}" alt="${data.eventTitle}" style="display:block;width:100%;height:auto;border:0;max-height:400px;object-fit:cover;" />
              </a>
            </td>
          </tr>
          ` : `
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#6366f1 50%,#3b82f6 100%);padding:40px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:14px;color:rgba(255,255,255,0.8);letter-spacing:1px;text-transform:uppercase;font-weight:500;">You're Invited</p>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;line-height:1.3;">${data.eventTitle}</h1>
            </td>
          </tr>
          `}
          <tr>
            <td style="padding:32px 24px 16px;">
              <p style="margin:0 0 6px;font-size:16px;color:#374151;">
                Hi <strong>${data.guestName}</strong>,
              </p>
              <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">
                You've been invited to <strong style="color:#374151;">${data.eventTitle}</strong>. We'd love to see you there!
              </p>
            </td>
          </tr>
          ${eventDetails ? `
          <tr>
            <td style="padding:0 24px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:12px;overflow:hidden;">
                ${eventDetails}
              </table>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding:16px 24px 32px;" align="center">
              <a href="${data.rsvpUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:12px;font-size:16px;font-weight:600;box-shadow:0 4px 14px rgba(99,102,241,0.35);">
                RSVP Now
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;border-top:1px solid #f3f4f6;text-align:center;background:#fafafa;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Sent with</p>
              <p style="margin:0;font-size:13px;font-weight:600;">
                <span style="color:#374151;">Seal</span><span style="color:#7c3aed;">& Send</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const info = await transporter.sendMail({
      from: "Seal & Send <contact@sealsend.app>",
      to: data.guestEmail,
      subject: `You're Invited: ${data.eventTitle}`,
      html,
    });

    console.log("Invitation sent:", info.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: info.messageId,
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Invitation error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers }
    );
  }
});

console.log("Invitation function ready");
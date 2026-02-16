import { formatDateTime, escapeHtml } from "@/lib/utils";

interface InvitationEmailParams {
  guestName: string;
  eventTitle: string;
  eventDate: string | null;
  locationName: string | null;
  rsvpUrl: string;
  designUrl?: string | null;
  hostName?: string;
  dressCode?: string | null;
  rsvpDeadline?: string | null;
}

export function buildInvitationEmail(params: InvitationEmailParams): {
  subject: string;
  html: string;
} {
  const { guestName, eventTitle, eventDate, locationName, rsvpUrl, designUrl, hostName, dressCode, rsvpDeadline } = params;

  const safeGuestName = escapeHtml(guestName);
  const safeEventTitle = escapeHtml(eventTitle);
  const safeLocationName = locationName ? escapeHtml(locationName) : null;
  const safeHostName = hostName ? escapeHtml(hostName) : null;
  const safeDressCode = dressCode ? escapeHtml(dressCode) : null;

  const subject = `You're Invited: ${eventTitle}`;

  const detailRows: string[] = [];
  if (eventDate) {
    detailRows.push(`
      <tr>
        <td style="padding:10px 16px;vertical-align:top;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:#eef2ff;border-radius:8px;text-align:center;vertical-align:middle;">
              <img src="https://api.iconify.design/lucide/calendar.svg?color=%236366f1" width="18" height="18" alt="" style="display:inline-block;" />
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">When</p>
              <p style="margin:2px 0 0;font-size:14px;color:#1f2937;font-weight:500;">${escapeHtml(formatDateTime(eventDate))}</p>
            </td>
          </tr></table>
        </td>
      </tr>`);
  }
  if (safeLocationName) {
    detailRows.push(`
      <tr>
        <td style="padding:10px 16px;vertical-align:top;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:#ecfdf5;border-radius:8px;text-align:center;vertical-align:middle;">
              <img src="https://api.iconify.design/lucide/map-pin.svg?color=%2310b981" width="18" height="18" alt="" style="display:inline-block;" />
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Where</p>
              <p style="margin:2px 0 0;font-size:14px;color:#1f2937;font-weight:500;">${safeLocationName}</p>
            </td>
          </tr></table>
        </td>
      </tr>`);
  }
  if (safeHostName) {
    detailRows.push(`
      <tr>
        <td style="padding:10px 16px;vertical-align:top;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:#faf5ff;border-radius:8px;text-align:center;vertical-align:middle;">
              <img src="https://api.iconify.design/lucide/user.svg?color=%238b5cf6" width="18" height="18" alt="" style="display:inline-block;" />
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Hosted By</p>
              <p style="margin:2px 0 0;font-size:14px;color:#1f2937;font-weight:500;">${safeHostName}</p>
            </td>
          </tr></table>
        </td>
      </tr>`);
  }
  if (safeDressCode) {
    detailRows.push(`
      <tr>
        <td style="padding:10px 16px;vertical-align:top;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:#fff7ed;border-radius:8px;text-align:center;vertical-align:middle;">
              <img src="https://api.iconify.design/lucide/shirt.svg?color=%23f59e0b" width="18" height="18" alt="" style="display:inline-block;" />
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Dress Code</p>
              <p style="margin:2px 0 0;font-size:14px;color:#1f2937;font-weight:500;">${safeDressCode}</p>
            </td>
          </tr></table>
        </td>
      </tr>`);
  }
  if (rsvpDeadline) {
    detailRows.push(`
      <tr>
        <td style="padding:10px 16px;vertical-align:top;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:#fef2f2;border-radius:8px;text-align:center;vertical-align:middle;">
              <img src="https://api.iconify.design/lucide/clock.svg?color=%23ef4444" width="18" height="18" alt="" style="display:inline-block;" />
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">RSVP By</p>
              <p style="margin:2px 0 0;font-size:14px;color:#1f2937;font-weight:500;">${escapeHtml(formatDateTime(rsvpDeadline))}</p>
            </td>
          </tr></table>
        </td>
      </tr>`);
  }

  const detailsBlock = detailRows.length > 0
    ? `<tr><td style="padding:0 24px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:12px;overflow:hidden;">
          ${detailRows.join('')}
        </table>
      </td></tr>`
    : '';

  const designBlock = designUrl
    ? `<tr>
        <td style="padding:0;">
          <a href="${rsvpUrl}" style="display:block;">
            <img src="${escapeHtml(designUrl)}" alt="${safeEventTitle}" style="display:block;width:100%;height:auto;border:0;" />
          </a>
        </td>
      </tr>`
    : '';

  const headerBlock = designUrl
    ? ''
    : `<tr>
        <td style="background:linear-gradient(135deg,#7c3aed 0%,#6366f1 50%,#3b82f6 100%);padding:40px 32px;text-align:center;">
          <p style="margin:0 0 8px;font-size:14px;color:rgba(255,255,255,0.8);letter-spacing:1px;text-transform:uppercase;font-weight:500;">You're Invited</p>
          <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;line-height:1.3;">${safeEventTitle}</h1>
        </td>
      </tr>`;

  const html = `<!DOCTYPE html>
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
          ${designBlock}
          ${headerBlock}
          <!-- Body -->
          <tr>
            <td style="padding:32px 24px 16px;">
              <p style="margin:0 0 6px;font-size:16px;color:#374151;">
                Hi <strong>${safeGuestName}</strong>,
              </p>
              <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">
                You've been invited to <strong style="color:#374151;">${safeEventTitle}</strong>. We'd love to see you there!
              </p>
            </td>
          </tr>

          ${detailsBlock}

          <!-- CTA Button -->
          <tr>
            <td style="padding:16px 24px 32px;" align="center">
              <a href="${rsvpUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:12px;font-size:16px;font-weight:600;box-shadow:0 4px 14px rgba(99,102,241,0.35);">
                RSVP Now
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;border-top:1px solid #f3f4f6;text-align:center;background:#fafafa;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">
                Sent with
              </p>
              <p style="margin:0;font-size:13px;font-weight:600;">
                <span style="color:#374151;">Seal</span><span style="color:#7c3aed;">Send</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

interface ReminderEmailParams {
  guestName: string;
  eventTitle: string;
  eventDate: string | null;
  locationName: string | null;
  rsvpUrl: string;
}

export function buildReminderEmail(params: ReminderEmailParams): {
  subject: string;
  html: string;
} {
  const { guestName, eventTitle, eventDate, locationName, rsvpUrl } = params;

  const safeGuestName = escapeHtml(guestName);
  const safeEventTitle = escapeHtml(eventTitle);

  const subject = `Reminder: ${eventTitle}`;

  const detailRows: string[] = [];
  if (eventDate) {
    detailRows.push(`
      <tr>
        <td style="padding:10px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:#fef3c7;border-radius:8px;text-align:center;vertical-align:middle;">
              <img src="https://api.iconify.design/lucide/calendar.svg?color=%23d97706" width="18" height="18" alt="" style="display:inline-block;" />
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">When</p>
              <p style="margin:2px 0 0;font-size:14px;color:#1f2937;font-weight:500;">${escapeHtml(formatDateTime(eventDate))}</p>
            </td>
          </tr></table>
        </td>
      </tr>`);
  }
  if (locationName) {
    detailRows.push(`
      <tr>
        <td style="padding:10px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:36px;height:36px;background:#fef3c7;border-radius:8px;text-align:center;vertical-align:middle;">
              <img src="https://api.iconify.design/lucide/map-pin.svg?color=%23d97706" width="18" height="18" alt="" style="display:inline-block;" />
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Where</p>
              <p style="margin:2px 0 0;font-size:14px;color:#1f2937;font-weight:500;">${escapeHtml(locationName)}</p>
            </td>
          </tr></table>
        </td>
      </tr>`);
  }

  const detailsBlock = detailRows.length > 0
    ? `<tr><td style="padding:0 24px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-radius:12px;overflow:hidden;">
          ${detailRows.join('')}
        </table>
      </td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr><td style="height:4px;background:linear-gradient(to right,#f59e0b,#d97706,#b45309);border-radius:16px 16px 0 0;"></td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:0 0 16px 16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:40px 32px;text-align:center;">
              <p style="margin:0 0 4px;font-size:32px;">&#9200;</p>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Don't Forget!</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 24px 16px;">
              <p style="margin:0 0 6px;font-size:16px;color:#374151;">
                Hi <strong>${safeGuestName}</strong>,
              </p>
              <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">
                Just a friendly reminder about <strong style="color:#374151;">${safeEventTitle}</strong>. We hope to see you there!
              </p>
            </td>
          </tr>

          ${detailsBlock}

          <!-- CTA -->
          <tr>
            <td style="padding:16px 24px 32px;" align="center">
              <a href="${rsvpUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:12px;font-size:16px;font-weight:600;box-shadow:0 4px 14px rgba(217,119,6,0.35);">
                View Event
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;border-top:1px solid #f3f4f6;text-align:center;background:#fafafa;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Sent with</p>
              <p style="margin:0;font-size:13px;font-weight:600;">
                <span style="color:#374151;">Seal</span><span style="color:#7c3aed;">Send</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

interface AnnouncementEmailParams {
  guestName: string;
  eventTitle: string;
  announcementSubject: string;
  announcementMessage: string;
  rsvpUrl: string;
}

export function buildAnnouncementEmail(params: AnnouncementEmailParams): {
  subject: string;
  html: string;
} {
  const { guestName, eventTitle, announcementSubject, announcementMessage, rsvpUrl } = params;

  const safeGuestName = escapeHtml(guestName);
  const safeEventTitle = escapeHtml(eventTitle);
  const safeSubject = escapeHtml(announcementSubject);
  const safeMessage = escapeHtml(announcementMessage).replace(/\n/g, '<br>');

  const subject = `Event Update: ${announcementSubject}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr><td style="height:4px;background:linear-gradient(to right,#10b981,#059669,#047857);border-radius:16px 16px 0 0;"></td></tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:0 0 16px 16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:40px 32px;text-align:center;">
              <p style="margin:0 0 4px;font-size:32px;">&#128227;</p>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Event Update</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 24px 16px;">
              <p style="margin:0 0 6px;font-size:16px;color:#374151;">
                Hi <strong>${safeGuestName}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.6;">
                Update regarding <strong style="color:#374151;">${safeEventTitle}</strong>:
              </p>
              <div style="padding:20px;background:#ecfdf5;border-radius:12px;border-left:4px solid #10b981;">
                <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#065f46;">${safeSubject}</p>
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">${safeMessage}</p>
              </div>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:16px 24px 32px;" align="center">
              <a href="${rsvpUrl}" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:12px;font-size:16px;font-weight:600;box-shadow:0 4px 14px rgba(5,150,105,0.35);">
                View Event
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 24px;border-top:1px solid #f3f4f6;text-align:center;background:#fafafa;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">Sent with</p>
              <p style="margin:0;font-size:13px;font-weight:600;">
                <span style="color:#374151;">Seal</span><span style="color:#7c3aed;">Send</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

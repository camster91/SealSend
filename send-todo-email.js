const https = require('https');

const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;">
        <tr><td style="height:4px;background:linear-gradient(to right,#7c3aed,#ec4899,#3b82f6);border-radius:16px 16px 0 0;"></td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:0 0 16px 16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#7c3aed 0%,#6366f1 50%,#3b82f6 100%);padding:32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">&#9881;&#65039; Supabase Settings TODO</h1>
          <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Fix magic link URLs &amp; brand email templates</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px 24px 16px;">
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">Hey Cameron, here are the 3 Supabase Dashboard changes needed to fix the magic link emails pointing to localhost.</p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>

          <!-- Step 1 -->
          <h2 style="margin:0 0 12px;font-size:18px;color:#7c3aed;">Step 1: Fix Site URL</h2>
          <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Go to <a href="https://supabase.com/dashboard/project/vtbreowxqfcvwegpfnwn/auth/url-configuration" style="color:#7c3aed;font-weight:600;">Auth &rarr; URL Configuration</a></p>
          <div style="background:#f8f5ff;border-radius:8px;padding:12px 16px;margin:0 0 20px;">
            <p style="margin:0;font-size:13px;color:#374151;"><strong>Site URL:</strong> Change from <code style="background:#fee2e2;padding:2px 6px;border-radius:4px;color:#dc2626;">http://localhost:3000</code> to:</p>
            <p style="margin:8px 0 0;"><code style="background:#dcfce7;padding:4px 10px;border-radius:4px;font-size:14px;color:#16a34a;font-weight:600;">https://ecard.ashbi.ca</code></p>
          </div>

          <!-- Step 2 -->
          <h2 style="margin:0 0 12px;font-size:18px;color:#7c3aed;">Step 2: Fix Redirect URLs</h2>
          <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Same page &mdash; under <strong>Redirect URLs</strong>:</p>
          <div style="background:#f8f5ff;border-radius:8px;padding:12px 16px;margin:0 0 20px;">
            <p style="margin:0;font-size:13px;color:#374151;"><strong>Add:</strong> <code style="background:#dcfce7;padding:4px 10px;border-radius:4px;font-size:14px;color:#16a34a;font-weight:600;">https://ecard.ashbi.ca/**</code></p>
            <p style="margin:8px 0 0;font-size:13px;color:#374151;"><strong>Remove</strong> any <code style="background:#fee2e2;padding:2px 6px;border-radius:4px;color:#dc2626;">http://localhost</code> entries</p>
          </div>

          <!-- Step 3 -->
          <h2 style="margin:0 0 12px;font-size:18px;color:#7c3aed;">Step 3: Brand Email Templates</h2>
          <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Go to <a href="https://supabase.com/dashboard/project/vtbreowxqfcvwegpfnwn/auth/templates" style="color:#7c3aed;font-weight:600;">Auth &rarr; Email Templates</a></p>
          <p style="margin:0 0 12px;font-size:14px;color:#6b7280;">Update the <strong>Magic Link</strong> and <strong>Confirm Signup</strong> templates:</p>

          <div style="background:#fefce8;border-radius:8px;padding:12px 16px;margin:0 0 16px;border-left:4px solid #f59e0b;">
            <p style="margin:0 0 8px;font-size:13px;color:#854d0e;"><strong>Magic Link subject:</strong> Your ECardApp Login Link</p>
            <p style="margin:0;font-size:13px;color:#854d0e;"><strong>Confirm Signup subject:</strong> Welcome to ECardApp</p>
          </div>

          <p style="margin:0 0 8px;font-size:14px;color:#374151;font-weight:600;">Paste this HTML into both templates:</p>
          <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">(For Confirm Signup, change heading to "Welcome to ECardApp" and button to "Confirm Email")</p>

          <div style="background:#1f2937;border-radius:8px;padding:16px;margin:12px 0 20px;overflow-x:auto;">
            <pre style="margin:0;font-size:10.5px;color:#e5e7eb;white-space:pre-wrap;word-break:break-all;font-family:'Courier New',monospace;line-height:1.5;">&lt;!DOCTYPE html&gt;
&lt;html lang="en"&gt;
&lt;head&gt;&lt;meta charset="utf-8" /&gt;&lt;meta name="viewport" content="width=device-width,initial-scale=1" /&gt;&lt;/head&gt;
&lt;body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;"&gt;
  &lt;table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;"&gt;
    &lt;tr&gt;&lt;td align="center"&gt;
      &lt;table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;"&gt;
        &lt;tr&gt;&lt;td style="height:4px;background:linear-gradient(to right,#7c3aed,#ec4899,#3b82f6);border-radius:16px 16px 0 0;"&gt;&lt;/td&gt;&lt;/tr&gt;
      &lt;/table&gt;
      &lt;table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:0 0 16px 16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);"&gt;
        &lt;tr&gt;&lt;td style="background:linear-gradient(135deg,#7c3aed 0%,#6366f1 50%,#3b82f6 100%);padding:40px 32px;text-align:center;"&gt;
          &lt;h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;"&gt;Sign In to ECardApp&lt;/h1&gt;
          &lt;p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8);"&gt;&lt;span style="font-weight:600;"&gt;ECard&lt;/span&gt;&lt;span style="color:#c4b5fd;"&gt;App&lt;/span&gt;&lt;/p&gt;
        &lt;/td&gt;&lt;/tr&gt;
        &lt;tr&gt;&lt;td style="padding:32px 24px 16px;"&gt;
          &lt;p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;"&gt;Click the button below to sign in. This link expires in 24 hours.&lt;/p&gt;
        &lt;/td&gt;&lt;/tr&gt;
        &lt;tr&gt;&lt;td style="padding:0 24px;"&gt;
          &lt;table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f5ff;border-radius:16px;border:2px dashed #c4b5fd;"&gt;
            &lt;tr&gt;&lt;td style="padding:24px 20px;text-align:center;"&gt;
              &lt;p style="margin:0 0 8px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;"&gt;Your verification code&lt;/p&gt;
              &lt;p style="margin:0;font-size:36px;font-weight:800;letter-spacing:10px;color:#7c3aed;font-family:'Courier New',Courier,monospace;"&gt;{{ .Token }}&lt;/p&gt;
            &lt;/td&gt;&lt;/tr&gt;
          &lt;/table&gt;
        &lt;/td&gt;&lt;/tr&gt;
        &lt;tr&gt;&lt;td style="padding:24px 24px 12px;" align="center"&gt;
          &lt;a href="{{ .ConfirmationURL }}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:12px;font-size:16px;font-weight:600;box-shadow:0 4px 14px rgba(99,102,241,0.35);"&gt;Sign In&lt;/a&gt;
        &lt;/td&gt;&lt;/tr&gt;
        &lt;tr&gt;&lt;td style="padding:12px 24px 28px;"&gt;
          &lt;table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border-radius:10px;"&gt;
            &lt;tr&gt;&lt;td style="padding:14px 16px;"&gt;
              &lt;p style="margin:0;font-size:13px;color:#854d0e;line-height:1.5;"&gt;&amp;#128274; If you didn't request this, you can safely ignore it.&lt;/p&gt;
            &lt;/td&gt;&lt;/tr&gt;
          &lt;/table&gt;
        &lt;/td&gt;&lt;/tr&gt;
        &lt;tr&gt;&lt;td style="padding:20px 24px;border-top:1px solid #f3f4f6;text-align:center;background:#fafafa;"&gt;
          &lt;p style="margin:0;font-size:13px;font-weight:600;"&gt;&lt;span style="color:#374151;"&gt;ECard&lt;/span&gt;&lt;span style="color:#7c3aed;"&gt;App&lt;/span&gt;&lt;/p&gt;
          &lt;p style="margin:4px 0 0;font-size:11px;color:#d1d5db;"&gt;Beautiful Digital Invitations &amp;amp; RSVP Management&lt;/p&gt;
        &lt;/td&gt;&lt;/tr&gt;
      &lt;/table&gt;
    &lt;/td&gt;&lt;/tr&gt;
  &lt;/table&gt;
&lt;/body&gt;
&lt;/html&gt;</pre>
          </div>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">All code-side fixes are already deployed. These 3 dashboard changes are the final step to fix magic link emails.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 24px;border-top:1px solid #f3f4f6;text-align:center;background:#fafafa;">
          <p style="margin:0;font-size:13px;font-weight:600;"><span style="color:#374151;">ECard</span><span style="color:#7c3aed;">App</span></p>
          <p style="margin:4px 0 0;font-size:11px;color:#d1d5db;">Beautiful Digital Invitations &amp; RSVP Management</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const data = JSON.stringify({
  from: 'ECardApp <onboarding@resend.dev>',
  to: 'cameron@ashbi.ca',
  subject: 'TODO: Supabase Dashboard Settings to Fix Magic Links',
  html: emailHtml,
});

const options = {
  hostname: 'api.resend.com',
  path: '/emails',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer re_L7r2QCFZ_N7NoXPYtp15hNjqqGH9cpr6U',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(body);
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();

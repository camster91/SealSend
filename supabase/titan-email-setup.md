# Supabase + Titan Email Configuration

## Prerequisites
- Titan account with `contact@sealsend.app` created
- Titan app password (generate from Titan settings)

## 1. Supabase Edge Function Setup

Create a Supabase Edge Function for sending emails via Titan SMTP.

### Using Supabase CLI:
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Initialize (if not already done)
supabase init

# Create new Edge Function for emails
supabase functions new send-email --project-id vtbreowxqfcvwegpfnwn
```

### Deploy Edge Function:
```bash
# Set secrets
supabase secrets set TITAN_IMAP_HOST=imap.titan.email
supabase secrets set TITAN_IMAP_USER=contact@sealsend.app
supabase secrets set TITAN_IMAP_PASSWORD=your_titan_app_password
supabase secrets set TITAN_SMTP_HOST=smtp.titan.email
supabase secrets set TITAN_SMTP_USER=contact@sealsend.app
supabase secrets set TITAN_SMTP_PASSWORD=your_titan_app_password
supabase secrets set TITAN_SMTP_PORT=465

# Deploy function
supabase functions deploy send-email --project-id vtbreowxqfcvwegpfnwn
```

## 2. Configure Supabase Auth Email (Dashboard)

Go to: https://supabase.com/dashboard/project/vtbreowxqfcvwegpfnwn/auth/templates

### Magic Link Template:
```
Subject: Your Seal & Send Login Link

<h1>Welcome to Seal & Send</h1>
<p>Click the link below to sign in to your account:</p>
<p><a href="{{ .ConfirmationURL }}">Sign In to Seal & Send</a></p>
<p>This link expires in 24 hours.</p>
<p>If you didn't request this, ignore this email.</p>
```

### Confirm Signup Template:
```
Subject: Confirm Your Email - Seal & Send

<h1>Welcome to Seal & Send</h1>
<p>Thanks for signing up! Click below to confirm your email:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
```

## 3. Environment Variables

Add these to Supabase project (.env.local):

```env
# Titan Email
TITAN_IMAP_HOST=imap.titan.email
TITAN_IMAP_USER=contact@sealsend.app
TITAN_IMAP_PASSWORD=your_titan_app_password_here
TITAN_SMTP_HOST=smtp.titan.email
TITAN_SMTP_PORT=465
TITAN_SMTP_USER=contact@sealsend.app
TITAN_SMTP_PASSWORD=your_titan_app_password_here

# App URLs
NEXT_PUBLIC_SITE_URL=https://sealsend.ai
NEXT_PUBLIC_SUPABASE_URL=https://vtbreowxqfcvwegpfnwn.supabase.co
```

## 4. Email Sending API

Use the Edge Function URL to send emails:

```javascript
// Example: Send invitation email
const response = await fetch(
  'https://vtbreowxqfcvwegpfnwn.supabase.co/functions/v1/send-email',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: 'guest@example.com',
      subject: "You're Invited!",
      html: '<h1>Welcome to my event!</h1>',
      template: 'invitation',
    }),
  }
);
```

## 5. IMAP Setup for Reading Replies

For reading guest replies via IMAP:

```javascript
const Imap = require('imap');

const imap = new Imap({
  user: 'contact@sealsend.app',
  password: process.env.TITAN_IMAP_PASSWORD,
  host: 'imap.titan.email',
  port: 993,
  tls: true,
});

function checkInbox() {
  imap.connect();
  imap.on('ready', () => {
    imap.openBox('INBOX', false, (err, box) => {
      // Search for new emails
      // Parse replies and update database
    });
  });
}
```

## 6. Supabase Dashboard Email Configuration

For Supabase Auth emails, go to:
**Authentication → URL Configuration**

- Site URL: `https://sealsend.ai`
- Redirect URLs:
  - `https://sealsend.ai/*`
  - `http://localhost:3000/*` (for development)

## 7. Test the Setup

```bash
# Send test email via Edge Function
curl -X POST 'https://vtbreowxqfcvwegpfnwn.supabase.co/functions/v1/send-email' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<h1>Test</h1><p>This is a test email.</p>"
  }'
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| TLS errors | Ensure port 993/465 with SSL/TLS |
| Auth failures | Generate app password in Titan settings |
| Rate limiting | Wait 1 minute between sends |
| Spam folder | Check spam and whitelist sender |
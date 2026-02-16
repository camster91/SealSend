# Supabase + Titan Email Setup Guide

## Quick Start

### 1. Configure Titan Email

First, generate an **app password** in your Titan account settings:
- Go to Titan Settings → Security → App Passwords
- Create a new password for SMTP/IMAP access
- Copy it securely (you'll need it for Supabase)

### 2. Set Environment Variables

```bash
# In Supabase Dashboard → Settings → Edge Functions → Secrets
TITAN_SMTP_HOST=smtp.titan.email
TITAN_SMTP_PORT=465
TITAN_SMTP_USER=contact@sealsend.app
TITAN_SMTP_PASSWORD=your_titan_app_password
TITAN_DEFAULT_FROM=Seal & Send <contact@sealsend.app>
```

### 3. Deploy Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Set secrets
supabase secrets set TITAN_SMTP_HOST=smtp.titan.email
supabase secrets set TITAN_SMTP_PORT=465
supabase secrets set TITAN_SMTP_USER=contact@sealsend.app
supabase secrets set TITAN_SMTP_PASSWORD=your_app_password
supabase secrets set TITAN_DEFAULT_FROM="Seal & Send <contact@sealsend.app>"

# Deploy functions
supabase functions deploy --project-id vtbreowxqfcvwegpfnwn
```

### 4. Configure Supabase Auth (Dashboard)

Go to **Authentication → URL Configuration**:

| Setting | Value |
|---------|-------|
| Site URL | `https://sealsend.ai` |
| Redirect URLs | `https://sealsend.ai/*` |

Go to **Authentication → Email Templates**:

**Magic Link Template:**
```
Subject: Your Seal & Send Login Link

<h1>Welcome to Seal & Send</h1>
<p>Click below to sign in to your account:</p>
<a href="{{ .ConfirmationURL }}">Sign In</a>
<p>This link expires in 24 hours.</p>
```

**Confirm Signup Template:**
```
Subject: Welcome to Seal & Send

<h1>Welcome aboard!</h1>
<p>Please confirm your email to get started:</p>
<a href="{{ .ConfirmationURL }}">Confirm Email</a>
```

### 5. Run Database Setup

Execute `supabase/schema-email-queue.sql` in Supabase SQL Editor to create:
- Email queue table
- Email logs table
- Helper functions
- Statistics views

## Email API Usage

### Send a Basic Email

```bash
curl -X POST 'https://vtbreowxqfcvwegpfnwn.supabase.co/functions/v1/send-email' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "to": "guest@example.com",
    "subject": "Test Email",
    "html": "<h1>Hello!</h1><p>This is a test email.</p>"
  }'
```

### Send Invitation

```bash
curl -X POST 'https://vtbreowxqfcvwegpfnwn.supabase.co/functions/v1/send-invitation' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "guestEmail": "guest@example.com",
    "guestName": "John Doe",
    "eventTitle": "Birthday Party",
    "eventDate": "2024-12-25T14:00:00Z",
    "location": "123 Main St",
    "rsvpUrl": "https://sealsend.ai/e/birthday-party"
  }'
```

## Database Functions

### Queue an Email

```sql
SELECT queue_email(
    p_to_email => 'guest@example.com',
    p_subject => 'You are invited!',
    p_html_content => '<h1>Hello!</h1>',
    p_email_type => 'invitation',
    p_event_id => 'uuid-of-event',
    p_guest_id => 'uuid-of-guest'
);
```

### View Pending Emails

```sql
SELECT * FROM pending_emails;
```

### View Email Stats

```sql
SELECT * FROM email_stats;
```

## Testing

### Verify IMAP Connection

```bash
# Test IMAP connection (replace password)
openssl s_client -connect imap.titan.email:993 -starttls imap

# Or use telnet
telnet imap.titan.email 993
```

### Verify SMTP Connection

```bash
# Test SMTP connection
openssl s_client -connect smtp.titan.email:465 -starttls smtp
```

### Send Test Email

```javascript
// Using nodemailer in Node.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.titan.email',
  port: 465,
  secure: true,
  auth: {
    user: 'contact@sealsend.app',
    pass: 'your_titan_app_password'
  }
});

await transporter.sendMail({
  from: 'Seal & Send <contact@sealsend.app>',
  to: 'test@example.com',
  subject: 'Test',
  html: '<h1>Test email</h1>'
});
```

## Troubleshooting

### "Authentication failed"
- Generate a new app password in Titan settings
- Ensure no special characters in password are being escaped incorrectly

### "Connection refused"
- Check that ports 993 (IMAP) and 465 (SMTP) are not blocked by firewall
- Verify Titan account status

### Emails going to spam
- Add `contact@sealsend.app` to your contacts
- Set up DKIM/SPF records for sealsend.app domain

### Rate limiting
- Titan may limit emails per hour
- Use the email queue for batch sending

## Security Best Practices

1. **Never commit `.env.local`** - Add to `.gitignore`
2. **Use app passwords** - Not your main Titan password
3. **Rotate credentials** - Periodically regenerate app passwords
4. **Monitor logs** - Check `email_logs` table for delivery issues
5. **Use SSL/TLS** - Always use encrypted connections

## Related Documentation

- [Titan Email Setup](https://www.titan.email/help)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Nodemailer](https://nodemailer.com/)
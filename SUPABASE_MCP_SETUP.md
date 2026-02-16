# Supabase MCP Setup for Seal & Send

This guide sets up Titan Email integration with Supabase using Model Context Protocol patterns.

## Project Info

| Setting | Value |
|---------|-------|
| **Supabase URL** | https://vtbreowxqfcvwegpfnwn.supabase.co |
| **Project Ref** | vtbreowxqfcvwegpfnwn |
| **Site URL** | https://sealsend.ai |
| **Email** | contact@sealsend.app |

## Setup Steps

### 1. Run SQL Migration

Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/vtbreowxqfcvwegpfnwn/sql) and run:

```sql
-- Copy contents of supabase/migrations/001_titan_email_setup.sql
```

This creates:
- `email_queue` table
- `email_logs` table
- Helper functions (`queue_email`, `mark_email_sent`, `mark_email_failed`)
- Views for monitoring (`pending_emails`, `email_stats_by_type`)
- RLS policies

### 2. Configure Titan App Password

1. Log into Titan at https://titan.email
2. Go to **Settings → Security → App Passwords**
3. Generate a password for "Email Client"
4. Copy the password

### 3. Set Supabase Edge Function Secrets

```bash
# Using Supabase CLI
supabase login

supabase secrets set TITAN_SMTP_HOST=smtp.titan.email --project-ref vtbreowxqfcvwegpfnwn
supabase secrets set TITAN_SMTP_PORT=465 --project-ref vtbreowxqfcvwegpfnwn
supabase secrets set TITAN_SMTP_USER=contact@sealsend.app --project-ref vtbreowxqfcvwegpfnwn
supabase secrets set TITAN_SMTP_PASSWORD=YOUR_APP_PASSWORD_HERE --project-ref vtbreowxqfcvwegpfnwn
supabase secrets set TITAN_DEFAULT_FROM="Seal & Send <contact@sealsend.app>" --project-ref vtbreowxqfcvwegpfnwn

# Also set Supabase keys for internal communication
supabase secrets set SUPABASE_URL=https://vtbreowxqfcvwegpfnwn.supabase.co --project-ref vtbreowxqfcvwegpfnwn
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY --project-ref vtbreowxqfcvwegpfnwn
supabase secrets set SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0YnJlb3d4cWZjdndlZ3BmbnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDA4NTMsImV4cCI6MjA4NjQxNjg1M30.eFcnSP-sNXJq7TOsnu2bQ-hI0_-IibQZsruRNugQV3E --project-ref vtbreowxqfcvwegpfnwn
```

### 4. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy titan-sender --project-ref vtbreowxqfcvwegpfnwn
supabase functions deploy email-webhook --project-ref vtbreowxqfcvwegpfnwn
```

### 5. Configure Supabase Auth

Go to [Authentication → URL Configuration](https://supabase.com/dashboard/project/vtbreowxqfcvwegpfnwn/auth/url-configuration):

| Setting | Value |
|---------|-------|
| Site URL | `https://sealsend.ai` |
| Redirect URLs | `https://sealsend.ai/*`, `http://localhost:3000/*` |

Go to [Authentication → Email Templates](https://supabase.com/dashboard/project/vtbreowxqfcvwegpfnwn/auth/templates) and update:

1. **Magic Link** - Subject: `Your Seal & Send Login Link`
2. **Confirm Signup** - Subject: `Welcome to Seal & Send`

### 6. Test the Setup

```bash
# Test via curl
curl -X POST 'https://vtbreowxqfcvwegpfnwn.supabase.co/functions/v1/titan-sender' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0YnJlb3d4cWZjdndlZ3BmbnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDA4NTMsImV4cCI6MjA4NjQxNjg1M30.eFcnSP-sNXJq7TOsnu2bQ-hI0_-IibQZsruRNugQV3E' \
  -H 'Content-Type: application/json' \
  -d '{
    "to": "test@example.com",
    "subject": "Test from Seal & Send",
    "html": "<h1>Hello!</h1><p>This is a test email via Titan.</p>"
  }'
```

### 7. Queue via SQL

```sql
-- Queue an email directly
SELECT queue_email(
    'guest@example.com',
    'You are invited!',
    '<h1>Welcome!</h1>',
    'invitation',
    'Seal & Send <contact@sealsend.app>'
);

-- View pending
SELECT * FROM pending_emails;

-- View stats
SELECT * FROM email_stats_by_type;
```

## MCP Integration

### Query Email Queue
```javascript
// Using Supabase client
const { data, error } = await supabase
  .from('email_queue')
  .select('*')
  .eq('status', 'pending')
  .order('created_at', { ascending: true });
```

### Mark as Sent
```javascript
await supabase.rpc('mark_email_sent', {
  p_id: 'email-queue-uuid',
  p_message_id: 'titan-message-id'
});
```

### Get Stats
```javascript
const { data } = await supabase
  .from('email_stats_by_type')
  .select('*');
```

## Monitoring

### Dashboard URLs

| Dashboard | URL |
|-----------|-----|
| SQL Editor | https://supabase.com/dashboard/project/vtbreowxqfcvwegpfnwn/sql |
| Auth Settings | https://supabase.com/dashboard/project/vtbreowxqfcvwegpfnwn/auth/url-configuration |
| Email Templates | https://supabase.com/dashboard/project/vtbreowxqfcvfnwn/auth/templates |
| Edge Functions | https://supabase.com/dashboard/project/vtbreowxqfcvwegpfnwn/functions |
| Table Editor | https://supabase.com/dashboard/project/vtbreowxqfcvwegpfnwn/editor |

### Troubleshooting

| Issue | Solution |
|-------|----------|
| `TITAN_SMTP_PASSWORD not configured` | Set secret via CLI |
| `Connection refused` | Check port 465 is open |
| `Authentication failed` | Regenerate Titan app password |
| Emails in spam | Add `contact@sealsend.app` to contacts |

## API Reference

### Titan Sender Endpoint

```
POST https://vtbreowxqfcvwegpfnwn.supabase.co/functions/v1/titan-sender
Authorization: Bearer <anon-key>
Content-Type: application/json

{
  "to": "recipient@example.com",
  "from": "Seal & Send <contact@sealsend.app>",
  "subject": "Email Subject",
  "html": "<h1>HTML Content</h1>",
  "text": "Plain text fallback"
}
```

### Database Functions

- `queue_email()` - Add email to queue
- `mark_email_sent()` - Mark as sent
- `mark_email_failed()` - Mark as failed
- `queue_invitation_email()` - Queue invitation for guest

### Views

- `pending_emails` - Emails waiting to be sent
- `email_stats_by_type` - Statistics by email type
- `email_stats_by_date` - Statistics by date
- `event_email_summary` - Emails per event
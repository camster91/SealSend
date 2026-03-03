# Automatic Reminders System

This document describes the automatic email/SMS reminder system for SealSend events.

## Overview

The automatic reminders system sends reminder emails and SMS messages to guests 24-48 hours before an event. Only guests who:
1. Haven't received a reminder yet
2. Haven't declined the invitation (no response or attending/maybe)

will receive reminders.

## API Endpoint

### GET /api/cron/send-reminders

This endpoint is designed to be called by a cron job service (Coolify, cron-job.org, GitHub Actions, etc.).

#### Query Parameters

- `secret` (required): The CRON_SECRET environment variable value for authentication
- `dryRun` (optional): If `true`, returns what would be sent without actually sending

#### Example Usage

```bash
# Production call
curl "https://sealsend.app/api/cron/send-reminders?secret=your-cron-secret"

# Dry run to test
curl "https://sealsend.app/api/cron/send-reminders?secret=your-cron-secret&dryRun=true"
```

#### Response

```json
{
  "success": true,
  "dryRun": false,
  "eventsChecked": 3,
  "remindersSent": 15,
  "emailsSent": 12,
  "smsSent": 3,
  "window": {
    "start": "2025-03-03T08:00:00.000Z",
    "end": "2025-03-04T08:00:00.000Z",
    "hoursBefore": 48,
    "checkWindowHours": 24
  },
  "results": [
    {
      "eventId": "uuid",
      "eventTitle": "Birthday Party",
      "guestsNotified": 10,
      "emailsSent": 8,
      "smsSent": 2,
      "errors": []
    }
  ]
}
```

## Environment Variables

Add these to your `.env` file or Coolify environment variables:

```bash
# Required: Secret key for authenticating cron requests
CRON_SECRET=your-secure-cron-secret-min-32-chars-long

# Optional: Hours before event to send reminders (default: 48)
REMINDER_HOURS_BEFORE=48

# Optional: Window to check for events (default: 24)
# This means: check events happening between (hoursBefore - checkWindow) and hoursBefore from now
# Default checks events happening in next 24-48 hours
REMINDER_CHECK_WINDOW_HOURS=24
```

## Coolify Cron Setup

1. Go to your Coolify dashboard
2. Select the SealSend application
3. Navigate to **Settings** → **Cron Jobs**
4. Add a new cron job:
   - **Schedule**: `0 */6 * * *` (every 6 hours) or `0 9 * * *` (daily at 9 AM)
   - **Command**: `curl -s "https://sealsend.app/api/cron/send-reminders?secret=${CRON_SECRET}"`
   - Make sure `CRON_SECRET` is set in your environment variables

## Database Schema

### events table

Added column:
- `auto_reminders` (boolean, default: false): Whether to automatically send reminders for this event

### guests table

Existing columns used:
- `reminder_sent_at` (timestamptz): When the reminder was sent
- `invite_token` (text): For generating RSVP links

## UI Toggle

Event hosts can enable/disable automatic reminders from the event detail page. The toggle:
- Only appears for published events with a set date
- Shows a warning if the event is less than 48 hours away
- Updates the `auto_reminders` column in the database

## How It Works

1. **Cron job triggers** the `/api/cron/send-reminders` endpoint
2. **Authentication** via `secret` query parameter
3. **Find events** that:
   - Are published
   - Have `auto_reminders = true`
   - Have an event date between `now + (hoursBefore - checkWindow)` and `now + hoursBefore`
4. **For each event**, find guests who:
   - Haven't received a reminder yet (`reminder_sent_at IS NULL`)
   - Have email or phone
   - Haven't declined (no RSVP response or status != 'not_attending')
5. **Send reminders** via email (Mailgun) and/or SMS (Twilio)
6. **Update** `reminder_sent_at` for successfully notified guests

## Testing

To test the system:

1. Set `CRON_SECRET` in your environment
2. Create an event with a date 24-48 hours in the future
3. Enable "Automatic Reminders" toggle on the event page
4. Add guests with email/phone
5. Call the endpoint with dryRun:
   ```bash
   curl "http://localhost:3000/api/cron/send-reminders?secret=your-secret&dryRun=true"
   ```
6. Check the response to see what would be sent
7. Run without dryRun to actually send reminders

## Logs

All sends are logged to the `send_logs` table with:
- Event ID
- Guest ID
- Send type (email/SMS)
- Status (success/failure)
- Provider (mailgun/twilio)
- Source (cron_reminder)
- Error messages (if any)

-- Production security/performance indexes (idempotent)
-- Apply with: psql "$DATABASE_URL" -f apply-security-indexes.sql

CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, event_date);
CREATE INDEX IF NOT EXISTS idx_events_auto_reminders ON events(status, auto_reminders, event_date)
  WHERE auto_reminders = TRUE;

CREATE INDEX IF NOT EXISTS idx_guests_event_reminder ON guests(event_id, reminder_sent_at);

CREATE INDEX IF NOT EXISTS idx_signup_items_event ON event_signup_items(event_id);
CREATE INDEX IF NOT EXISTS idx_signup_claims_item ON event_signup_claims(signup_item_id);

CREATE INDEX IF NOT EXISTS idx_send_logs_provider_message_id ON send_logs(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

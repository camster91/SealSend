-- Production schema compatibility and security/performance indexes (idempotent)
-- Apply with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apply-security-indexes.sql

ALTER TABLE events ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS payment_id TEXT;

ALTER TABLE guests ADD COLUMN IF NOT EXISTS phone_invalid_at TIMESTAMPTZ;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';
ALTER TABLE guests ALTER COLUMN invite_status SET DEFAULT 'not_sent';
ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_invite_status_check;
ALTER TABLE guests ADD CONSTRAINT guests_invite_status_check
  CHECK (invite_status IN ('not_sent', 'pending', 'sent', 'delivered', 'bounced', 'failed', 'accepted'));
UPDATE guests SET invite_status = 'not_sent' WHERE invite_status = 'pending';

ALTER TABLE events ADD COLUMN IF NOT EXISTS event_timezone TEXT NOT NULL DEFAULT 'UTC';

ALTER TABLE guest_tags ADD COLUMN IF NOT EXISTS tag_name TEXT;
ALTER TABLE rsvp_responses ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE plus_ones ADD COLUMN IF NOT EXISTS guest_id UUID REFERENCES guests(id) ON DELETE SET NULL;
ALTER TABLE plus_ones ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE plus_ones ADD COLUMN IF NOT EXISTS invite_status TEXT DEFAULT 'not_sent';
ALTER TABLE plus_ones ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ;
ALTER TABLE plus_ones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE event_comments ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE event_announcements ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE event_announcements ADD COLUMN IF NOT EXISTS sent_to_count INTEGER DEFAULT 0;
ALTER TABLE event_signup_items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE event_signup_items ADD COLUMN IF NOT EXISTS slots INTEGER DEFAULT 1;
ALTER TABLE event_signup_claims ADD COLUMN IF NOT EXISTS item_id UUID;
ALTER TABLE event_signup_claims ADD COLUMN IF NOT EXISTS event_id UUID;
ALTER TABLE event_signup_claims ADD COLUMN IF NOT EXISTS claimant_name TEXT;
ALTER TABLE event_signup_claims ADD COLUMN IF NOT EXISTS claimant_email TEXT;
ALTER TABLE event_signup_claims ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE guest_magic_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE guest_magic_tokens ADD COLUMN IF NOT EXISTS token_preview TEXT;
ALTER TABLE guest_magic_tokens ADD COLUMN IF NOT EXISTS created_by UUID;

-- Backfill columns renamed as the product model evolved.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'guest_tags' AND column_name = 'name') THEN
    UPDATE guest_tags SET tag_name = name WHERE tag_name IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'event_comments' AND column_name = 'content') THEN
    UPDATE event_comments SET message = content WHERE message IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'event_announcements' AND column_name = 'title') THEN
    UPDATE event_announcements SET subject = COALESCE(title, 'Announcement') WHERE subject IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'event_announcements' AND column_name = 'sent_count') THEN
    UPDATE event_announcements SET sent_to_count = sent_count WHERE sent_to_count = 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'event_signup_items' AND column_name = 'quantity') THEN
    UPDATE event_signup_items SET slots = GREATEST(quantity, 1);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'event_signup_claims' AND column_name = 'signup_item_id') THEN
    UPDATE event_signup_claims c
    SET item_id = c.signup_item_id,
        event_id = i.event_id,
        claimant_name = c.claimer_name,
        claimant_email = c.claimer_email,
        created_at = c.claimed_at
    FROM event_signup_items i
    WHERE i.id = c.signup_item_id AND c.item_id IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'guest_magic_tokens' AND column_name = 'token') THEN
    UPDATE guest_magic_tokens t
    SET token_hash = encode(digest(t.token, 'sha256'), 'hex'),
        token_preview = RIGHT(t.token, 4),
        created_by = e.user_id
    FROM events e
    WHERE e.id = t.event_id AND t.token_hash IS NULL;
  END IF;
END $$;

UPDATE rsvp_responses SET submitted_at = created_at WHERE submitted_at IS NULL;

ALTER TABLE guest_tags ALTER COLUMN tag_name SET NOT NULL;
ALTER TABLE event_comments ALTER COLUMN message SET NOT NULL;
ALTER TABLE event_announcements ALTER COLUMN subject SET NOT NULL;
ALTER TABLE event_signup_claims ALTER COLUMN item_id SET NOT NULL;
ALTER TABLE event_signup_claims ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE event_signup_claims ALTER COLUMN claimant_name SET NOT NULL;

-- Keep existing installations compatible with the send logger and Twilio webhook.
ALTER TABLE send_logs ADD COLUMN IF NOT EXISTS send_type TEXT;
ALTER TABLE send_logs ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE send_logs ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE send_logs ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
ALTER TABLE send_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE send_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE send_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'send_logs' AND column_name = 'channel') THEN
    UPDATE send_logs SET send_type = channel WHERE send_type IS NULL;
  END IF;
END $$;

ALTER TABLE send_logs ALTER COLUMN send_type SET NOT NULL;
ALTER TABLE send_logs DROP CONSTRAINT IF EXISTS send_logs_status_check;
ALTER TABLE send_logs ADD CONSTRAINT send_logs_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'delivered'));

CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, event_date);
CREATE INDEX IF NOT EXISTS idx_events_auto_reminders ON events(status, auto_reminders, event_date) WHERE auto_reminders = TRUE;
CREATE INDEX IF NOT EXISTS idx_guests_event_reminder ON guests(event_id, reminder_sent_at);
CREATE INDEX IF NOT EXISTS idx_signup_items_event ON event_signup_items(event_id);
CREATE INDEX IF NOT EXISTS idx_signup_claims_item ON event_signup_claims(item_id);
CREATE INDEX IF NOT EXISTS idx_send_logs_provider_message_id ON send_logs(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_magic_tokens_token_hash ON guest_magic_tokens(token_hash) WHERE token_hash IS NOT NULL;

-- Align existing installations with the annual account entitlement used by
-- checkout and the Stripe webhook. Legacy `pro` rows represent the same plan.
UPDATE user_subscriptions SET tier = 'pro_annual' WHERE tier = 'pro';
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_tier_check;
ALTER TABLE user_subscriptions ADD CONSTRAINT user_subscriptions_tier_check
  CHECK (tier IN ('free', 'pro_annual'));

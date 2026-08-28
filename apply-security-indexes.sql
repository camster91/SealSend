-- Production schema compatibility and security/performance indexes (idempotent)
-- Apply with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apply-security-indexes.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS code_hash TEXT;
-- Existing plaintext OTPs are intentionally invalidated during this security upgrade.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'auth_codes' AND column_name = 'code') THEN
    UPDATE auth_codes SET code_hash = encode(digest(code, 'sha256'), 'hex') WHERE code_hash IS NULL AND code IS NOT NULL;
    ALTER TABLE auth_codes ALTER COLUMN code DROP NOT NULL;
  END IF;
END $$;
DROP INDEX IF EXISTS idx_auth_codes_email_code;
DROP INDEX IF EXISTS idx_auth_codes_phone_code;
CREATE INDEX IF NOT EXISTS idx_auth_codes_email_context ON auth_codes(email, role, event_id) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_codes_phone_context ON auth_codes(phone, role, event_id) WHERE phone IS NOT NULL;

ALTER TABLE events ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS payment_id TEXT;

ALTER TABLE guests ADD COLUMN IF NOT EXISTS phone_invalid_at TIMESTAMPTZ;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';
CREATE TABLE IF NOT EXISTS communication_suppressions (
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient_hash TEXT NOT NULL CHECK (recipient_hash ~ '^[a-f0-9]{64}$'),
  reason TEXT NOT NULL CHECK (reason IN ('unsubscribed', 'complained', 'bounced', 'manual')),
  provider TEXT NOT NULL CHECK (provider IN ('mailgun', 'twilio', 'manual')),
  source_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, channel, recipient_hash)
);
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

CREATE TABLE IF NOT EXISTS activation_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'account_created',
    'event_draft_started',
    'ai_generation_started',
    'ai_generation_completed',
    'ai_generation_accepted',
    'event_published',
    'first_guest_added',
    'first_invitation_sent',
    'first_rsvp_received',
    'checkout_started',
    'checkout_completed',
    'account_exported',
    'event_repeated',
    'guest_import_completed',
    'announcement_approved',
    'calendar_exported',
    'first_guest_checked_in'
  )),
  user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activation_events_name_created
  ON activation_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_activation_events_user_created
  ON activation_events(user_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activation_events_event_created
  ON activation_events(event_id, created_at) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_user
  ON activation_events(event_name, user_id)
  WHERE user_id IS NOT NULL AND event_name IN ('account_created', 'event_draft_started', 'account_exported');
CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_event
  ON activation_events(event_name, event_id)
  WHERE event_id IS NOT NULL AND event_name IN (
    'event_published', 'first_guest_added', 'first_invitation_sent', 'first_rsvp_received', 'checkout_completed',
    'event_repeated', 'guest_import_completed', 'announcement_approved', 'calendar_exported', 'first_guest_checked_in'
  );
ALTER TABLE activation_events DROP CONSTRAINT IF EXISTS activation_events_event_name_check;
ALTER TABLE activation_events ADD CONSTRAINT activation_events_event_name_check CHECK (event_name IN (
  'account_created','event_draft_started','ai_generation_started','ai_generation_completed','ai_generation_accepted',
  'event_published','first_guest_added','first_invitation_sent','first_rsvp_received',
  'checkout_started','checkout_completed','account_exported','event_repeated','guest_import_completed',
  'announcement_approved','calendar_exported','first_guest_checked_in'
));
DROP INDEX IF EXISTS idx_activation_first_user;
DROP INDEX IF EXISTS idx_activation_first_event;
CREATE UNIQUE INDEX idx_activation_first_user
  ON activation_events(event_name, user_id)
  WHERE user_id IS NOT NULL AND event_name IN ('account_created', 'event_draft_started', 'account_exported');
CREATE UNIQUE INDEX idx_activation_first_event
  ON activation_events(event_name, event_id)
  WHERE event_id IS NOT NULL AND event_name IN (
    'event_published', 'first_guest_added', 'first_invitation_sent', 'first_rsvp_received', 'checkout_completed',
    'event_repeated', 'guest_import_completed', 'announcement_approved', 'calendar_exported', 'first_guest_checked_in'
  );
CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_account_checkout
  ON activation_events(event_name, user_id)
  WHERE event_name = 'checkout_completed' AND user_id IS NOT NULL AND event_id IS NULL;
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'completed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_account_deletion_due
  ON account_deletion_requests(status, scheduled_for) WHERE status = 'pending';
CREATE TABLE IF NOT EXISTS deleted_account_upload_cleanup (
  user_directory UUID PRIMARY KEY,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempt_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS upload_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  path TEXT UNIQUE NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_upload_assets_user ON upload_assets(user_id, created_at);
CREATE TABLE IF NOT EXISTS host_lifecycle_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('getting_started', 'finish_draft', 'event_approaching')),
  scope_key TEXT UNIQUE NOT NULL,
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_host_lifecycle_user ON host_lifecycle_notifications(user_id, sent_at);

CREATE TABLE IF NOT EXISTS event_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'check_in', 'viewer')),
  invited_by UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_member_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'check_in', 'viewer')),
  token_hash TEXT UNIQUE NOT NULL,
  token_preview TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_members_user ON event_members(user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_event_member_invites_event ON event_member_invites(event_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_member_invites_pending_email
  ON event_member_invites(event_id, LOWER(email)) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_event_audit_event_created ON event_audit_log(event_id, created_at DESC);

ALTER TABLE guests ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES admin_users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_guests_event_check_in ON guests(event_id, checked_in_at);

ALTER TABLE event_announcements ADD COLUMN IF NOT EXISTS status TEXT;
UPDATE event_announcements SET status = 'sent' WHERE status IS NULL;
ALTER TABLE event_announcements ALTER COLUMN status SET DEFAULT 'queued';
ALTER TABLE event_announcements ALTER COLUMN status SET NOT NULL;
ALTER TABLE event_announcements DROP CONSTRAINT IF EXISTS event_announcements_status_check;
ALTER TABLE event_announcements ADD CONSTRAINT event_announcements_status_check CHECK (status IN ('queued', 'processing', 'sent', 'partially_failed', 'failed', 'cancelled'));
ALTER TABLE event_announcements ADD COLUMN IF NOT EXISTS audience JSONB NOT NULL DEFAULT '{"rsvpStatuses":[],"invitationStatuses":[],"tagIds":[],"unansweredOnly":false}';
ALTER TABLE event_announcements ADD COLUMN IF NOT EXISTS channels TEXT[] NOT NULL DEFAULT ARRAY['email']::TEXT[];
ALTER TABLE event_announcements ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
UPDATE event_announcements SET scheduled_at = COALESCE(created_at, NOW()) WHERE scheduled_at IS NULL;
ALTER TABLE event_announcements ALTER COLUMN scheduled_at SET DEFAULT NOW();
ALTER TABLE event_announcements ALTER COLUMN scheduled_at SET NOT NULL;
ALTER TABLE event_announcements ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
UPDATE event_announcements SET approved_at = COALESCE(created_at, NOW()) WHERE approved_at IS NULL;
ALTER TABLE event_announcements ALTER COLUMN approved_at SET DEFAULT NOW();
ALTER TABLE event_announcements ALTER COLUMN approved_at SET NOT NULL;
ALTER TABLE event_announcements ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE event_announcements ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
ALTER TABLE event_announcements ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE event_announcements ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_announcements_due ON event_announcements(status, scheduled_at) WHERE status = 'queued';

CREATE TABLE IF NOT EXISTS announcement_deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES event_announcements(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'accepted', 'delivered', 'failed', 'bounced', 'opted_out')),
  provider_message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (announcement_id, guest_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_announcement_deliveries_status ON announcement_deliveries(announcement_id, status);
ALTER TABLE events ADD COLUMN IF NOT EXISTS invitation_headline TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS invitation_body TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_sequence JSONB NOT NULL DEFAULT '[]';
ALTER TABLE events ADD COLUMN IF NOT EXISTS ai_generation_id UUID;
CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  prompt_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'fallback', 'failed')),
  latency_ms INTEGER NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_micros INTEGER,
  outcome TEXT NOT NULL DEFAULT 'generated' CHECK (outcome IN ('generated', 'accepted', 'rejected')),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_created ON ai_generations(user_id, created_at DESC);
ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS edit_count INTEGER CHECK (edit_count IS NULL OR edit_count >= 0);
CREATE TABLE IF NOT EXISTS ai_message_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  prompt_hash TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed','fallback','failed')),
  tone TEXT NOT NULL, length TEXT NOT NULL, urgency TEXT NOT NULL, channel TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'generated' CHECK (outcome IN ('generated','accepted','rejected')),
  helpful BOOLEAN, accepted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_message_generations_user_created ON ai_message_generations(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS webhook_receipts (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, event_id)
);
CREATE TABLE IF NOT EXISTS server_error_events (
  id BIGSERIAL PRIMARY KEY, fingerprint TEXT NOT NULL, error_name TEXT NOT NULL,
  route TEXT NOT NULL, method TEXT NOT NULL, router_kind TEXT NOT NULL, route_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_server_error_events_created ON server_error_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_error_events_fingerprint ON server_error_events(fingerprint, created_at DESC);
CREATE TABLE IF NOT EXISTS monitoring_alert_deliveries (
  fingerprint TEXT PRIMARY KEY,
  last_attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_delivered_at TIMESTAMPTZ,
  last_delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (last_delivery_status IN ('pending', 'delivered', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count > 0)
);
CREATE INDEX IF NOT EXISTS idx_monitoring_alert_deliveries_attempted
  ON monitoring_alert_deliveries(last_attempted_at DESC);
CREATE TABLE IF NOT EXISTS beta_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('setup','ai_draft','guest_management','communications','check_in','other')),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), message TEXT NOT NULL,
  may_contact BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created ON beta_feedback(created_at DESC);
CREATE TABLE IF NOT EXISTS beta_enrollment_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  token_preview TEXT NOT NULL CHECK (char_length(token_preview) = 4),
  participant_label TEXT UNIQUE NOT NULL CHECK (participant_label ~ '^host-[a-f0-9]{12}$'),
  segment TEXT NOT NULL CHECK (segment IN ('club_association','volunteer_nonprofit','creative_community','alumni_professional','repeat_planner')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (accepted_at IS NULL OR revoked_at IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_beta_enrollment_invites_available
  ON beta_enrollment_invites(expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS beta_participants (
  user_id UUID PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
  participant_label TEXT UNIQUE NOT NULL CHECK (participant_label ~ '^host-[a-f0-9]{12}$'),
  segment TEXT NOT NULL CHECK (segment IN ('club_association','volunteer_nonprofit','creative_community','alumni_professional','repeat_planner','legacy_out_of_scope')),
  consent_version TEXT NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$
BEGIN
  ALTER TABLE beta_participants DROP CONSTRAINT IF EXISTS beta_participants_segment_check;
  UPDATE beta_participants
     SET segment = 'legacy_out_of_scope',
         withdrawn_at = COALESCE(withdrawn_at, NOW()),
         updated_at = NOW()
   WHERE segment IN ('private_celebration','wedding','community_nonprofit','corporate_team');
  ALTER TABLE beta_participants
    ADD CONSTRAINT beta_participants_segment_check
    CHECK (segment IN ('club_association','volunteer_nonprofit','creative_community','alumni_professional','repeat_planner','legacy_out_of_scope'));
END $$;
CREATE INDEX IF NOT EXISTS idx_beta_participants_active_segment
  ON beta_participants(segment) WHERE withdrawn_at IS NULL;
CREATE TABLE IF NOT EXISTS beta_outcomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES beta_participants(user_id) ON DELETE CASCADE,
  consented_at TIMESTAMPTZ NOT NULL,
  consent_version TEXT NOT NULL,
  willingness_to_pay TEXT NOT NULL CHECK (willingness_to_pay IN ('annual_pro','per_event','free_only','unsure')),
  repeat_intent INTEGER NOT NULL CHECK (repeat_intent BETWEEN 1 AND 5),
  self_reported_support_minutes INTEGER NOT NULL CHECK (self_reported_support_minutes BETWEEN 0 AND 600),
  price_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, consented_at)
);
CREATE INDEX IF NOT EXISTS idx_beta_outcomes_created ON beta_outcomes(created_at DESC);

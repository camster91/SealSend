-- SealSend Clean PostgreSQL Schema
-- No Supabase RLS, no cron extension, no pg_cron

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================
-- AUTH TABLES
-- =====================

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,
  phone TEXT,
  code_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'guest')),
  event_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT email_or_phone CHECK (
    (email IS NOT NULL AND phone IS NULL) OR
    (email IS NULL AND phone IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_email_context ON auth_codes(email, role, event_id) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_codes_phone_context ON auth_codes(phone, role, event_id) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON auth_codes(expires_at);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('admin', 'guest')),
  session_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

-- =====================
-- EVENTS
-- =====================

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  invitation_headline TEXT,
  invitation_body TEXT,
  reminder_sequence JSONB NOT NULL DEFAULT '[]',
  event_brief JSONB,
  ai_generation_id UUID,
  repeated_from_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  event_date TIMESTAMPTZ,
  event_end_date TIMESTAMPTZ,
  event_timezone TEXT NOT NULL DEFAULT 'UTC',
  location_name TEXT,
  location_address TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  host_name TEXT,
  dress_code TEXT,
  rsvp_deadline TIMESTAMPTZ,
  registry_links JSONB DEFAULT '[]',
  max_attendees INTEGER,
  allow_plus_ones BOOLEAN DEFAULT TRUE,
  max_guests_per_rsvp INTEGER DEFAULT 10,
  design_url TEXT,
  design_type TEXT DEFAULT 'upload',
  customization JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'event_pass', 'silver', 'gold', 'platinum', 'diamond', 'standard', 'premium')),
  max_responses INTEGER DEFAULT 15,
  auto_reminders BOOLEAN DEFAULT FALSE,
  reminder_days_before INTEGER DEFAULT 2,
  reminder_sent_at TIMESTAMPTZ,
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, event_date);
CREATE INDEX IF NOT EXISTS idx_events_repeated_from ON events(repeated_from_event_id) WHERE repeated_from_event_id IS NOT NULL;

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
  edit_count INTEGER CHECK (edit_count IS NULL OR edit_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_created ON ai_generations(user_id, created_at DESC);
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
CREATE INDEX IF NOT EXISTS idx_events_auto_reminders ON events(status, auto_reminders, event_date)
  WHERE auto_reminders = TRUE;

-- =====================
-- EVENT TEAM ACCESS
-- =====================

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

-- =====================
-- RSVP FIELDS
-- =====================

CREATE TABLE IF NOT EXISTS rsvp_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  field_label TEXT NOT NULL,
  is_required BOOLEAN DEFAULT FALSE,
  is_enabled BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  options JSONB,
  placeholder TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rsvp_fields_event ON rsvp_fields(event_id);

-- =====================
-- GUESTS
-- =====================

CREATE TABLE IF NOT EXISTS guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  invite_token TEXT UNIQUE,
  invite_sent BOOLEAN DEFAULT FALSE,
  invite_sent_at TIMESTAMPTZ,
  invite_status TEXT DEFAULT 'not_sent' CHECK (invite_status IN ('not_sent', 'pending', 'sent', 'delivered', 'bounced', 'failed', 'accepted')),
  invite_error TEXT,
  rsvp_status TEXT DEFAULT 'pending',
  notes TEXT,
  is_plus_one BOOLEAN DEFAULT FALSE,
  parent_guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  magic_token TEXT UNIQUE,
  magic_token_expires_at TIMESTAMPTZ,
  phone_invalid_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  tags JSONB DEFAULT '[]',
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guests_event_id ON guests(event_id);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);
CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests(phone);
CREATE INDEX IF NOT EXISTS idx_guests_invite_token ON guests(invite_token);
CREATE INDEX IF NOT EXISTS idx_guests_magic_token ON guests(magic_token);
CREATE INDEX IF NOT EXISTS idx_guests_event_reminder ON guests(event_id, reminder_sent_at);
CREATE INDEX IF NOT EXISTS idx_guests_event_check_in ON guests(event_id, checked_in_at);

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

-- =====================
-- GUEST TAGS
-- =====================

CREATE TABLE IF NOT EXISTS guest_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guest_tag_assignments (
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES guest_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (guest_id, tag_id)
);

-- =====================
-- RSVP RESPONSES
-- =====================

CREATE TABLE IF NOT EXISTS rsvp_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  respondent_name TEXT NOT NULL,
  respondent_email TEXT,
  status TEXT NOT NULL CHECK (status IN ('attending', 'not_attending', 'maybe')),
  headcount INTEGER DEFAULT 1,
  response_data JSONB DEFAULT '{}',
  plus_ones_data JSONB DEFAULT '[]',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rsvp_responses_event ON rsvp_responses(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_guest ON rsvp_responses(guest_id);

-- =====================
-- PLUS ONES
-- =====================

CREATE TABLE IF NOT EXISTS plus_ones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rsvp_response_id UUID REFERENCES rsvp_responses(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'attending',
  invite_token TEXT UNIQUE,
  invite_status TEXT DEFAULT 'not_sent',
  invite_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plus_ones_event ON plus_ones(event_id);
CREATE INDEX IF NOT EXISTS idx_plus_ones_rsvp ON plus_ones(rsvp_response_id);

-- =====================
-- COMMENTS
-- =====================

CREATE TABLE IF NOT EXISTS event_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_comments_event ON event_comments(event_id);

-- =====================
-- ANNOUNCEMENTS
-- =====================

CREATE TABLE IF NOT EXISTS event_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_to_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'partially_failed', 'failed', 'cancelled')),
  audience JSONB NOT NULL DEFAULT '{"rsvpStatuses":[],"invitationStatuses":[],"tagIds":[],"unansweredOnly":false}',
  channels TEXT[] NOT NULL DEFAULT ARRAY['email']::TEXT[],
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  dispatched_at TIMESTAMPTZ,
  last_error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_event ON event_announcements(event_id);
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

CREATE TABLE IF NOT EXISTS webhook_receipts (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, event_id)
);

-- =====================
-- REMINDERS
-- =====================

CREATE TABLE IF NOT EXISTS event_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL DEFAULT 'auto',
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- SIGNUP BOARD
-- =====================

CREATE TABLE IF NOT EXISTS event_signup_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  slots INTEGER DEFAULT 1 CHECK (slots > 0),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_items_event ON event_signup_items(event_id);

CREATE TABLE IF NOT EXISTS event_signup_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES event_signup_items(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  claimant_name TEXT NOT NULL,
  claimant_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_claims_item ON event_signup_claims(item_id);

-- =====================
-- SEND LOGS
-- =====================

CREATE TABLE IF NOT EXISTS send_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  send_type TEXT NOT NULL CHECK (send_type IN ('email', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'delivered')),
  recipient TEXT NOT NULL,
  subject TEXT,
  error_message TEXT,
  provider TEXT,
  provider_message_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_send_logs_event ON send_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_send_logs_guest ON send_logs(guest_id);
CREATE INDEX IF NOT EXISTS idx_send_logs_status ON send_logs(status);
CREATE INDEX IF NOT EXISTS idx_send_logs_created ON send_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_send_logs_provider_message_id ON send_logs(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- =====================
-- GUEST MAGIC TOKENS
-- =====================

CREATE TABLE IF NOT EXISTS guest_magic_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  token_preview TEXT NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_magic_tokens_token_hash ON guest_magic_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_guest ON guest_magic_tokens(guest_id);

-- =====================
-- RATE LIMITING
-- =====================

CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key_time ON rate_limit_attempts(key, created_at);

-- =====================
-- SUBSCRIPTIONS
-- =====================

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro_annual')),
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe ON user_subscriptions(stripe_subscription_id);

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
  notification_type TEXT NOT NULL CONSTRAINT host_lifecycle_notifications_notification_type_check
    CHECK (notification_type IN ('getting_started', 'finish_draft', 'event_approaching', 'post_event_repeat', 'stale_draft_warning')),
  scope_key TEXT UNIQUE NOT NULL,
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE host_lifecycle_notifications
  DROP CONSTRAINT IF EXISTS host_lifecycle_notifications_notification_type_check;
ALTER TABLE host_lifecycle_notifications
  ADD CONSTRAINT host_lifecycle_notifications_notification_type_check
  CHECK (notification_type IN ('getting_started', 'finish_draft', 'event_approaching', 'post_event_repeat', 'stale_draft_warning'));
CREATE INDEX IF NOT EXISTS idx_host_lifecycle_user ON host_lifecycle_notifications(user_id, sent_at);

-- =====================
-- PRIVACY-LIMITED PRODUCT ACTIVATION ANALYTICS
-- =====================

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
ALTER TABLE activation_events DROP CONSTRAINT IF EXISTS activation_events_event_name_check;
ALTER TABLE activation_events ADD CONSTRAINT activation_events_event_name_check CHECK (event_name IN (
  'account_created','event_draft_started','ai_generation_started','ai_generation_completed','ai_generation_accepted',
  'event_published','first_guest_added','first_invitation_sent','first_rsvp_received',
  'checkout_started','checkout_completed','account_exported','event_repeated','guest_import_completed',
  'announcement_approved','calendar_exported','first_guest_checked_in'
));
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
  cohort_version TEXT NOT NULL CHECK (cohort_version ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (accepted_at IS NULL OR revoked_at IS NULL)
);
CREATE INDEX IF NOT EXISTS idx_beta_enrollment_invites_available
  ON beta_enrollment_invites(expires_at) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_invites_open_cohort_segment
  ON beta_enrollment_invites(cohort_version, segment)
  WHERE accepted_at IS NULL AND revoked_at IS NULL AND cohort_version <> 'legacy-unassigned';
CREATE TABLE IF NOT EXISTS beta_participants (
  user_id UUID PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
  participant_label TEXT UNIQUE NOT NULL CHECK (participant_label ~ '^host-[a-f0-9]{12}$'),
  segment TEXT NOT NULL CHECK (segment IN ('club_association','volunteer_nonprofit','creative_community','alumni_professional','repeat_planner','legacy_out_of_scope')),
  cohort_version TEXT NOT NULL CHECK (cohort_version ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  consent_version TEXT NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_beta_participants_active_segment
  ON beta_participants(segment) WHERE withdrawn_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_participants_active_cohort_segment
  ON beta_participants(cohort_version, segment)
  WHERE withdrawn_at IS NULL AND cohort_version <> 'legacy-unassigned';
CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_participants_user_consent
  ON beta_participants(user_id, consented_at);
CREATE TABLE IF NOT EXISTS beta_outcomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL,
  consent_version TEXT NOT NULL,
  willingness_to_pay TEXT NOT NULL CHECK (willingness_to_pay IN ('annual_pro','per_event','free_only','unsure')),
  repeat_intent INTEGER NOT NULL CHECK (repeat_intent BETWEEN 1 AND 5),
  self_reported_support_minutes INTEGER NOT NULL CHECK (self_reported_support_minutes BETWEEN 0 AND 600),
  price_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, consented_at),
  FOREIGN KEY (user_id, consented_at) REFERENCES beta_participants(user_id, consented_at) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_beta_outcomes_created ON beta_outcomes(created_at DESC);
CREATE TABLE IF NOT EXISTS beta_defect_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL,
  reviewer_name TEXT NOT NULL CHECK (char_length(reviewer_name) BETWEEN 2 AND 100),
  review_version TEXT NOT NULL,
  unresolved_severity_1 INTEGER NOT NULL CHECK (unresolved_severity_1 BETWEEN 0 AND 100),
  unresolved_severity_2 INTEGER NOT NULL CHECK (unresolved_severity_2 BETWEEN 0 AND 100),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, consented_at),
  FOREIGN KEY (user_id, consented_at) REFERENCES beta_participants(user_id, consented_at) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_beta_defect_reviews_reviewed ON beta_defect_reviews(reviewed_at DESC);
CREATE TABLE IF NOT EXISTS beta_support_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL,
  reviewer_name TEXT NOT NULL CHECK (char_length(reviewer_name) BETWEEN 2 AND 100),
  review_version TEXT NOT NULL,
  operator_recorded_support_minutes INTEGER NOT NULL CHECK (operator_recorded_support_minutes BETWEEN 0 AND 600),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, consented_at),
  FOREIGN KEY (user_id, consented_at) REFERENCES beta_participants(user_id, consented_at) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_beta_support_reviews_reviewed ON beta_support_reviews(reviewed_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_user
  ON activation_events(event_name, user_id)
  WHERE user_id IS NOT NULL AND event_name IN ('account_created', 'event_draft_started', 'account_exported');
DROP INDEX IF EXISTS idx_activation_first_event;
CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_event
  ON activation_events(event_name, event_id)
  WHERE event_id IS NOT NULL AND event_name IN (
    'event_published', 'first_guest_added', 'first_invitation_sent', 'first_rsvp_received', 'checkout_completed',
    'event_repeated', 'guest_import_completed', 'announcement_approved', 'calendar_exported', 'first_guest_checked_in'
  );
CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_account_checkout
  ON activation_events(event_name, user_id)
  WHERE event_name = 'checkout_completed' AND user_id IS NOT NULL AND event_id IS NULL;

-- =====================
-- PRO WAITLIST (public capture while annual Pro checkout is unavailable)
-- =====================

CREATE TABLE IF NOT EXISTS waitlist_signups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  plan_interest TEXT NOT NULL DEFAULT 'pro_annual',
  source TEXT NOT NULL DEFAULT 'pricing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- One signup per email per plan interest; re-submitting is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_signups_email_plan
  ON waitlist_signups (LOWER(email), plan_interest);

-- =====================
-- EVENT PASS SMS ALLOWANCE (credits from purchases, debits per sent segment)
-- =====================

CREATE TABLE IF NOT EXISTS event_sms_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  delta_segments INTEGER NOT NULL CHECK (delta_segments <> 0),
  reason TEXT NOT NULL CHECK (reason IN ('event_pass', 'sms_top_up', 'sms_sent')),
  reference TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_sms_ledger_event ON event_sms_ledger(event_id);

-- =====================
-- ORGANIZATIONS (workspaces that own events; every host has a personal one)
-- =====================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'personal' CHECK (plan IN ('personal', 'solo', 'studio', 'agency')),
  is_personal BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- One personal workspace per host.
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_personal_owner ON organizations(created_by) WHERE is_personal;
CREATE TABLE IF NOT EXISTS organization_members (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'planner', 'check_in')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_events_organization ON events(organization_id);

-- Returns the host's personal workspace, creating it (and the owner membership) on first use.
CREATE OR REPLACE FUNCTION sealsend_personal_organization(owner_id UUID) RETURNS UUID AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT id INTO org_id FROM organizations WHERE created_by = owner_id AND is_personal;
  IF org_id IS NULL THEN
    INSERT INTO organizations (name, slug, is_personal, created_by)
    SELECT COALESCE(NULLIF(TRIM(u.name), ''), 'My events'), 'personal-' || REPLACE(u.id::text, '-', ''), TRUE, u.id
      FROM admin_users u WHERE u.id = owner_id
    ON CONFLICT DO NOTHING;
    SELECT id INTO org_id FROM organizations WHERE created_by = owner_id AND is_personal;
  END IF;
  IF org_id IS NOT NULL THEN
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (org_id, owner_id, 'owner') ON CONFLICT DO NOTHING;
  END IF;
  RETURN org_id;
END;
$$ LANGUAGE plpgsql;

-- New events default to the owner's personal workspace unless a workspace is given.
CREATE OR REPLACE FUNCTION sealsend_events_default_organization() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := sealsend_personal_organization(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS events_default_organization ON events;
CREATE TRIGGER events_default_organization BEFORE INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION sealsend_events_default_organization();

-- Backfill: every existing event joins its owner's personal workspace.
UPDATE events SET organization_id = sealsend_personal_organization(user_id) WHERE organization_id IS NULL;

-- =====================
-- BRANDS (workspace brand kit applied to event pages, emails and SMS)
-- =====================

CREATE TABLE IF NOT EXISTS brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  logo_url TEXT,
  primary_color TEXT CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_color TEXT CHECK (background_color IS NULL OR background_color ~ '^#[0-9A-Fa-f]{6}$'),
  font_family TEXT,
  sender_name TEXT CHECK (sender_name IS NULL OR char_length(sender_name) BETWEEN 1 AND 60),
  reply_to_email TEXT,
  sms_signature TEXT CHECK (sms_signature IS NULL OR char_length(sms_signature) BETWEEN 1 AND 40),
  white_label BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- One default brand per workspace; events use it unless they pick another.
CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_default_per_organization ON brands(organization_id) WHERE is_default;
ALTER TABLE events ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

-- =====================
-- AUTH CODES FK (after events table exists)
-- =====================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'auth_codes_event_id_fkey'
  ) THEN
    ALTER TABLE auth_codes ADD CONSTRAINT auth_codes_event_id_fkey 
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
  END IF;
END $$;

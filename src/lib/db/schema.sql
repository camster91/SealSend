-- SealSend schema for Cloudflare D1 (SQLite). Idempotent: safe to re-run.
--
-- Storage conventions (src/lib/db/sqlite-dialect.ts turns values back into the JS types the app expects):
--   ids         TEXT (UUID strings; the default makes a random v4 UUID)
--   timestamps  TIMESTAMP_TEXT, ISO-8601 UTC like 2026-10-28T14:00:00.000Z (same as Date.toISOString())
--   booleans    BOOLEAN, stored as 0/1
--   JSON        JSON_TEXT, JSON text (also used for the former TEXT[] columns)
--   dates       DATE_TEXT, YYYY-MM-DD
-- Every declared type above keeps TEXT or NUMERIC affinity, so SQLite never rewrites stored values.

-- =====================
-- AUTH TABLES
-- =====================
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS auth_codes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  email TEXT,
  phone TEXT,
  code_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  event_id TEXT,
  expires_at TIMESTAMP_TEXT NOT NULL,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((role IN ('admin', 'guest'))),
  CONSTRAINT email_or_phone CHECK ((((email IS NOT NULL) AND (phone IS NULL)) OR ((email IS NULL) AND (phone IS NOT NULL)))),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_email_context ON auth_codes (email, role, event_id) WHERE (email IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON auth_codes (expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_codes_phone_context ON auth_codes (phone, role, event_id) WHERE (phone IS NOT NULL);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL,
  user_role TEXT NOT NULL,
  session_token TEXT NOT NULL,
  expires_at TIMESTAMP_TEXT NOT NULL,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((user_role IN ('admin', 'guest'))),
  UNIQUE (session_token)
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);

-- =====================
-- EVENTS
-- =====================
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  invitation_headline TEXT,
  invitation_body TEXT,
  reminder_sequence JSON_TEXT NOT NULL DEFAULT '[]',
  event_brief JSON_TEXT,
  ai_generation_id TEXT,
  repeated_from_event_id TEXT,
  event_date TIMESTAMP_TEXT,
  event_end_date TIMESTAMP_TEXT,
  event_timezone TEXT NOT NULL DEFAULT 'UTC',
  location_name TEXT,
  location_address TEXT,
  location_lat REAL,
  location_lng REAL,
  host_name TEXT,
  dress_code TEXT,
  rsvp_deadline TIMESTAMP_TEXT,
  registry_links JSON_TEXT DEFAULT '[]',
  max_attendees INTEGER,
  allow_plus_ones BOOLEAN DEFAULT 1,
  max_guests_per_rsvp INTEGER DEFAULT 10,
  design_url TEXT,
  design_type TEXT DEFAULT 'upload',
  customization JSON_TEXT DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  tier TEXT DEFAULT 'free',
  max_responses INTEGER DEFAULT 15,
  auto_reminders BOOLEAN DEFAULT 0,
  reminder_days_before INTEGER DEFAULT 2,
  reminder_sent_at TIMESTAMP_TEXT,
  payment_id TEXT,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  organization_id TEXT,
  brand_id TEXT,
  client_id TEXT,
  CHECK ((status IN ('draft', 'published', 'archived'))),
  CHECK ((tier IN ('free', 'event_pass', 'silver', 'gold', 'platinum', 'diamond', 'standard', 'premium'))),
  FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
  FOREIGN KEY (repeated_from_event_id) REFERENCES events(id) ON DELETE SET NULL,
  UNIQUE (slug)
);
CREATE INDEX IF NOT EXISTS idx_events_auto_reminders ON events (status, auto_reminders, event_date) WHERE (auto_reminders = 1);
CREATE INDEX IF NOT EXISTS idx_events_client ON events (client_id);
CREATE INDEX IF NOT EXISTS idx_events_organization ON events (organization_id);
CREATE INDEX IF NOT EXISTS idx_events_repeated_from ON events (repeated_from_event_id) WHERE (repeated_from_event_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events (slug);
CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);
CREATE INDEX IF NOT EXISTS idx_events_status_date ON events (status, event_date);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events (user_id);

CREATE TABLE IF NOT EXISTS ai_generations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  status TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_micros INTEGER,
  outcome TEXT NOT NULL DEFAULT 'generated',
  accepted_at TIMESTAMP_TEXT,
  edit_count INTEGER,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (((edit_count IS NULL) OR (edit_count >= 0))),
  CHECK ((outcome IN ('generated', 'accepted', 'rejected'))),
  CHECK ((status IN ('completed', 'fallback', 'failed'))),
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_created ON ai_generations (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_message_generations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  tone TEXT NOT NULL,
  length TEXT NOT NULL,
  urgency TEXT NOT NULL,
  channel TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'generated',
  helpful BOOLEAN,
  accepted_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((outcome IN ('generated', 'accepted', 'rejected'))),
  CHECK ((status IN ('completed', 'fallback', 'failed'))),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_message_generations_user_created ON ai_message_generations (user_id, created_at DESC);

-- =====================
-- EVENT TEAM ACCESS
-- =====================
CREATE TABLE IF NOT EXISTS event_members (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((role IN ('manager', 'check_in', 'viewer'))),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES admin_users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_members_user ON event_members (user_id, event_id);

CREATE TABLE IF NOT EXISTS event_member_invites (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_preview TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  expires_at TIMESTAMP_TEXT NOT NULL,
  accepted_at TIMESTAMP_TEXT,
  accepted_by TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((role IN ('manager', 'check_in', 'viewer'))),
  FOREIGN KEY (accepted_by) REFERENCES admin_users(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES admin_users(id) ON DELETE CASCADE,
  UNIQUE (token_hash)
);
CREATE INDEX IF NOT EXISTS idx_event_member_invites_event ON event_member_invites (event_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_member_invites_pending_email ON event_member_invites (event_id, lower(email)) WHERE (accepted_at IS NULL);

CREATE TABLE IF NOT EXISTS event_audit_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  target_user_id TEXT,
  metadata JSON_TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (actor_user_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_event_audit_event_created ON event_audit_log (event_id, created_at DESC);

-- =====================
-- RSVP FIELDS
-- =====================
CREATE TABLE IF NOT EXISTS rsvp_fields (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL,
  field_label TEXT NOT NULL,
  is_required BOOLEAN DEFAULT 0,
  is_enabled BOOLEAN DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  options JSON_TEXT,
  placeholder TEXT,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_rsvp_fields_event ON rsvp_fields (event_id);

-- =====================
-- GUESTS
-- =====================
CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  invite_token TEXT,
  invite_sent BOOLEAN DEFAULT 0,
  invite_sent_at TIMESTAMP_TEXT,
  invite_status TEXT DEFAULT 'not_sent',
  invite_error TEXT,
  rsvp_status TEXT DEFAULT 'pending',
  notes TEXT,
  is_plus_one BOOLEAN DEFAULT 0,
  parent_guest_id TEXT,
  magic_token TEXT,
  magic_token_expires_at TIMESTAMP_TEXT,
  phone_invalid_at TIMESTAMP_TEXT,
  reminder_sent_at TIMESTAMP_TEXT,
  checked_in_at TIMESTAMP_TEXT,
  checked_in_by TEXT,
  tags JSON_TEXT DEFAULT '[]',
  last_login_at TIMESTAMP_TEXT,
  login_count INTEGER DEFAULT 0,
  user_id TEXT,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((invite_status IN ('not_sent', 'pending', 'sent', 'delivered', 'bounced', 'failed', 'accepted'))),
  FOREIGN KEY (checked_in_by) REFERENCES admin_users(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_guest_id) REFERENCES guests(id) ON DELETE CASCADE,
  UNIQUE (invite_token),
  UNIQUE (magic_token)
);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests (email);
CREATE INDEX IF NOT EXISTS idx_guests_event_check_in ON guests (event_id, checked_in_at);
CREATE INDEX IF NOT EXISTS idx_guests_event_id ON guests (event_id);
CREATE INDEX IF NOT EXISTS idx_guests_event_reminder ON guests (event_id, reminder_sent_at);
CREATE INDEX IF NOT EXISTS idx_guests_invite_token ON guests (invite_token);
CREATE INDEX IF NOT EXISTS idx_guests_magic_token ON guests (magic_token);
CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests (phone);

CREATE TABLE IF NOT EXISTS communication_suppressions (
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient_hash TEXT NOT NULL,
  reason TEXT NOT NULL,
  provider TEXT NOT NULL,
  source_event_id TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, channel, recipient_hash),
  CHECK ((channel IN ('email', 'sms'))),
  CHECK ((provider IN ('mailgun', 'twilio', 'manual'))),
  CHECK ((reason IN ('unsubscribed', 'complained', 'bounced', 'manual'))),
  CHECK (((length(recipient_hash) = 64 AND recipient_hash NOT GLOB '*[^a-f0-9]*'))),
  FOREIGN KEY (source_event_id) REFERENCES events(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

-- =====================
-- GUEST TAGS
-- =====================
CREATE TABLE IF NOT EXISTS guest_tags (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS guest_tag_assignments (
  guest_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (guest_id, tag_id),
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES guest_tags(id) ON DELETE CASCADE
);

-- =====================
-- RSVP RESPONSES
-- =====================
CREATE TABLE IF NOT EXISTS rsvp_responses (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  guest_id TEXT,
  respondent_name TEXT NOT NULL,
  respondent_email TEXT,
  status TEXT NOT NULL,
  headcount INTEGER DEFAULT 1,
  response_data JSON_TEXT DEFAULT '{}',
  plus_ones_data JSON_TEXT DEFAULT '[]',
  edit_token_hash TEXT,
  checked_in_at TIMESTAMP_TEXT,
  checked_in_by TEXT,
  submitted_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (((length(edit_token_hash) = 64 AND edit_token_hash NOT GLOB '*[^a-f0-9]*'))),
  CHECK ((status IN ('attending', 'not_attending', 'maybe'))),
  FOREIGN KEY (checked_in_by) REFERENCES admin_users(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvp_edit_token ON rsvp_responses (edit_token_hash) WHERE (edit_token_hash IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_event ON rsvp_responses (event_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_guest ON rsvp_responses (guest_id);

-- =====================
-- PLUS ONES
-- =====================
CREATE TABLE IF NOT EXISTS plus_ones (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  rsvp_response_id TEXT,
  guest_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'attending',
  invite_token TEXT,
  invite_status TEXT DEFAULT 'not_sent',
  invite_sent_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL,
  FOREIGN KEY (rsvp_response_id) REFERENCES rsvp_responses(id) ON DELETE CASCADE,
  UNIQUE (invite_token)
);
CREATE INDEX IF NOT EXISTS idx_plus_ones_event ON plus_ones (event_id);
CREATE INDEX IF NOT EXISTS idx_plus_ones_rsvp ON plus_ones (rsvp_response_id);

-- =====================
-- COMMENTS
-- =====================
CREATE TABLE IF NOT EXISTS event_comments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  guest_id TEXT,
  author_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_private BOOLEAN DEFAULT 0,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_event_comments_event ON event_comments (event_id);

-- =====================
-- ANNOUNCEMENTS
-- =====================
CREATE TABLE IF NOT EXISTS event_announcements (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_to_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  audience JSON_TEXT NOT NULL DEFAULT '{"tagIds": [], "rsvpStatuses": [], "unansweredOnly": false, "invitationStatuses": []}',
  channels JSON_TEXT NOT NULL DEFAULT '["email"]',
  scheduled_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  approved_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_by TEXT,
  dispatched_at TIMESTAMP_TEXT,
  last_error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((status IN ('queued', 'processing', 'sent', 'partially_failed', 'failed', 'cancelled'))),
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_announcements_due ON event_announcements (status, scheduled_at) WHERE (status = 'queued');
CREATE INDEX IF NOT EXISTS idx_announcements_event ON event_announcements (event_id);

CREATE TABLE IF NOT EXISTS announcement_deliveries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  announcement_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  provider_message_id TEXT,
  error TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((channel IN ('email', 'sms'))),
  CHECK ((status IN ('queued', 'sending', 'accepted', 'delivered', 'failed', 'bounced', 'opted_out'))),
  FOREIGN KEY (announcement_id) REFERENCES event_announcements(id) ON DELETE CASCADE,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
  UNIQUE (announcement_id, guest_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_announcement_deliveries_status ON announcement_deliveries (announcement_id, status);

CREATE TABLE IF NOT EXISTS webhook_receipts (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (provider, event_id)
);

-- =====================
-- REMINDERS
-- =====================
CREATE TABLE IF NOT EXISTS event_reminders (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  reminder_type TEXT NOT NULL DEFAULT 'auto',
  sent_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- =====================
-- SIGNUP BOARD
-- =====================
CREATE TABLE IF NOT EXISTS event_signup_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  slots INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((slots > 0)),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_signup_items_event ON event_signup_items (event_id);

CREATE TABLE IF NOT EXISTS event_signup_claims (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  item_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  claimant_name TEXT NOT NULL,
  claimant_email TEXT,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES event_signup_items(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_signup_claims_item ON event_signup_claims (item_id);

-- =====================
-- SEND LOGS
-- =====================
CREATE TABLE IF NOT EXISTS send_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  guest_id TEXT,
  send_type TEXT NOT NULL,
  status TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  error_message TEXT,
  provider TEXT,
  provider_message_id TEXT,
  metadata JSON_TEXT,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((send_type IN ('email', 'sms'))),
  CHECK ((status IN ('pending', 'sent', 'failed', 'bounced', 'delivered'))),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_send_logs_created ON send_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_send_logs_event ON send_logs (event_id);
CREATE INDEX IF NOT EXISTS idx_send_logs_guest ON send_logs (guest_id);
CREATE INDEX IF NOT EXISTS idx_send_logs_provider_message_id ON send_logs (provider_message_id) WHERE (provider_message_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_send_logs_status ON send_logs (status);

-- =====================
-- GUEST MAGIC TOKENS
-- =====================
CREATE TABLE IF NOT EXISTS guest_magic_tokens (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  guest_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_preview TEXT NOT NULL,
  event_id TEXT,
  expires_at TIMESTAMP_TEXT NOT NULL,
  used_at TIMESTAMP_TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
  UNIQUE (token_hash)
);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_guest ON guest_magic_tokens (guest_id);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_token_hash ON guest_magic_tokens (token_hash);

-- =====================
-- RATE LIMITING
-- =====================
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  key TEXT NOT NULL,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_key_time ON rate_limit_attempts (key, created_at);

-- =====================
-- SUBSCRIPTIONS
-- =====================
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  tier TEXT NOT NULL DEFAULT 'free',
  billing_cycle TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((billing_cycle IN ('monthly', 'yearly'))),
  CHECK ((status IN ('active', 'past_due', 'canceled', 'trialing'))),
  CHECK ((tier IN ('free', 'pro_annual'))),
  UNIQUE (stripe_subscription_id)
);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe ON user_subscriptions (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  scheduled_for TIMESTAMP_TEXT NOT NULL,
  cancelled_at TIMESTAMP_TEXT,
  completed_at TIMESTAMP_TEXT,
  CHECK ((status IN ('pending', 'cancelled', 'completed'))),
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_account_deletion_due ON account_deletion_requests (status, scheduled_for) WHERE (status = 'pending');

CREATE TABLE IF NOT EXISTS deleted_account_upload_cleanup (
  user_directory TEXT PRIMARY KEY,
  queued_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  attempt_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS upload_assets (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL,
  path TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((byte_size > 0)),
  CHECK ((media_type IN ('image', 'video', 'audio'))),
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  UNIQUE (path)
);
CREATE INDEX IF NOT EXISTS idx_upload_assets_user ON upload_assets (user_id, created_at);

CREATE TABLE IF NOT EXISTS host_lifecycle_notifications (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL,
  event_id TEXT,
  notification_type TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  provider_message_id TEXT,
  sent_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT host_lifecycle_notifications_notification_type_check CHECK ((notification_type IN ('getting_started', 'finish_draft', 'event_approaching', 'post_event_repeat', 'stale_draft_warning'))),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  UNIQUE (scope_key)
);
CREATE INDEX IF NOT EXISTS idx_host_lifecycle_user ON host_lifecycle_notifications (user_id, sent_at);

-- =====================
-- PRIVACY-LIMITED PRODUCT ACTIVATION ANALYTICS
-- =====================
CREATE TABLE IF NOT EXISTS activation_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_name TEXT NOT NULL,
  user_id TEXT,
  event_id TEXT,
  metadata JSON_TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT activation_events_event_name_check CHECK ((event_name IN ('account_created', 'event_draft_started', 'ai_generation_started', 'ai_generation_completed', 'ai_generation_accepted', 'event_published', 'first_guest_added', 'first_invitation_sent', 'first_rsvp_received', 'checkout_started', 'checkout_completed', 'account_exported', 'event_repeated', 'guest_import_completed', 'announcement_approved', 'calendar_exported', 'first_guest_checked_in'))),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_activation_events_event_created ON activation_events (event_id, created_at) WHERE (event_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_activation_events_name_created ON activation_events (event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_activation_events_user_created ON activation_events (user_id, created_at) WHERE (user_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_account_checkout ON activation_events (event_name, user_id) WHERE ((event_name = 'checkout_completed') AND (user_id IS NOT NULL) AND (event_id IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_event ON activation_events (event_name, event_id) WHERE ((event_id IS NOT NULL) AND (event_name IN ('event_published', 'first_guest_added', 'first_invitation_sent', 'first_rsvp_received', 'checkout_completed', 'event_repeated', 'guest_import_completed', 'announcement_approved', 'calendar_exported', 'first_guest_checked_in')));
CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_first_user ON activation_events (event_name, user_id) WHERE ((user_id IS NOT NULL) AND (event_name IN ('account_created', 'event_draft_started', 'account_exported')));

CREATE TABLE IF NOT EXISTS server_error_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL,
  error_name TEXT NOT NULL,
  route TEXT NOT NULL,
  method TEXT NOT NULL,
  router_kind TEXT NOT NULL,
  route_type TEXT NOT NULL,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_server_error_events_created ON server_error_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_error_events_fingerprint ON server_error_events (fingerprint, created_at DESC);

CREATE TABLE IF NOT EXISTS monitoring_alert_deliveries (
  fingerprint TEXT PRIMARY KEY,
  last_attempted_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_delivered_at TIMESTAMP_TEXT,
  last_delivery_status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 1,
  CHECK ((attempt_count > 0)),
  CHECK ((last_delivery_status IN ('pending', 'delivered', 'failed')))
);
CREATE INDEX IF NOT EXISTS idx_monitoring_alert_deliveries_attempted ON monitoring_alert_deliveries (last_attempted_at DESC);

CREATE TABLE IF NOT EXISTS beta_feedback (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  rating INTEGER NOT NULL,
  message TEXT NOT NULL,
  may_contact BOOLEAN NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((category IN ('setup', 'ai_draft', 'guest_management', 'communications', 'check_in', 'other'))),
  CHECK (((rating >= 1) AND (rating <= 5))),
  CHECK ((status IN ('new', 'reviewing', 'closed'))),
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created ON beta_feedback (created_at DESC);

CREATE TABLE IF NOT EXISTS beta_enrollment_invites (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  token_hash TEXT NOT NULL,
  token_preview TEXT NOT NULL,
  participant_label TEXT NOT NULL,
  segment TEXT NOT NULL,
  cohort_version TEXT NOT NULL,
  expires_at TIMESTAMP_TEXT NOT NULL,
  accepted_by TEXT,
  accepted_at TIMESTAMP_TEXT,
  revoked_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (((accepted_at IS NULL) OR (revoked_at IS NULL))),
  CHECK (((length(cohort_version) BETWEEN 3 AND 64 AND cohort_version GLOB '[a-z0-9]*' AND cohort_version NOT GLOB '*[^a-z0-9-]*'))),
  CHECK (((length(participant_label) = 17 AND participant_label GLOB 'host-*' AND substr(participant_label, 6) NOT GLOB '*[^a-f0-9]*'))),
  CHECK ((segment IN ('club_association', 'volunteer_nonprofit', 'creative_community', 'alumni_professional', 'repeat_planner'))),
  CHECK (((length(token_hash) = 64 AND token_hash NOT GLOB '*[^a-f0-9]*'))),
  CHECK ((length(token_preview) = 4)),
  FOREIGN KEY (accepted_by) REFERENCES admin_users(id) ON DELETE SET NULL,
  UNIQUE (participant_label),
  UNIQUE (token_hash)
);
CREATE INDEX IF NOT EXISTS idx_beta_enrollment_invites_available ON beta_enrollment_invites (expires_at) WHERE ((accepted_at IS NULL) AND (revoked_at IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_invites_open_cohort_segment ON beta_enrollment_invites (cohort_version, segment) WHERE ((accepted_at IS NULL) AND (revoked_at IS NULL) AND (cohort_version <> 'legacy-unassigned'));

CREATE TABLE IF NOT EXISTS beta_participants (
  user_id TEXT PRIMARY KEY,
  participant_label TEXT NOT NULL,
  segment TEXT NOT NULL,
  cohort_version TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consented_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  withdrawn_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (((length(cohort_version) BETWEEN 3 AND 64 AND cohort_version GLOB '[a-z0-9]*' AND cohort_version NOT GLOB '*[^a-z0-9-]*'))),
  CHECK (((length(participant_label) = 17 AND participant_label GLOB 'host-*' AND substr(participant_label, 6) NOT GLOB '*[^a-f0-9]*'))),
  CHECK ((segment IN ('club_association', 'volunteer_nonprofit', 'creative_community', 'alumni_professional', 'repeat_planner', 'legacy_out_of_scope'))),
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  UNIQUE (participant_label)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_participants_active_cohort_segment ON beta_participants (cohort_version, segment) WHERE ((withdrawn_at IS NULL) AND (cohort_version <> 'legacy-unassigned'));
CREATE INDEX IF NOT EXISTS idx_beta_participants_active_segment ON beta_participants (segment) WHERE (withdrawn_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_beta_participants_user_consent ON beta_participants (user_id, consented_at);

CREATE TABLE IF NOT EXISTS beta_outcomes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL,
  consented_at TIMESTAMP_TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  willingness_to_pay TEXT NOT NULL,
  repeat_intent INTEGER NOT NULL,
  self_reported_support_minutes INTEGER NOT NULL,
  price_version TEXT NOT NULL,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (((repeat_intent >= 1) AND (repeat_intent <= 5))),
  CHECK (((self_reported_support_minutes >= 0) AND (self_reported_support_minutes <= 600))),
  CHECK ((willingness_to_pay IN ('annual_pro', 'per_event', 'free_only', 'unsure'))),
  FOREIGN KEY (user_id, consented_at) REFERENCES beta_participants(user_id, consented_at) ON DELETE CASCADE,
  UNIQUE (user_id, consented_at)
);
CREATE INDEX IF NOT EXISTS idx_beta_outcomes_created ON beta_outcomes (created_at DESC);

CREATE TABLE IF NOT EXISTS beta_defect_reviews (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL,
  consented_at TIMESTAMP_TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  review_version TEXT NOT NULL,
  unresolved_severity_1 INTEGER NOT NULL,
  unresolved_severity_2 INTEGER NOT NULL,
  reviewed_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (((length(reviewer_name) >= 2) AND (length(reviewer_name) <= 100))),
  CHECK (((unresolved_severity_1 >= 0) AND (unresolved_severity_1 <= 100))),
  CHECK (((unresolved_severity_2 >= 0) AND (unresolved_severity_2 <= 100))),
  FOREIGN KEY (user_id, consented_at) REFERENCES beta_participants(user_id, consented_at) ON DELETE CASCADE,
  UNIQUE (user_id, consented_at)
);
CREATE INDEX IF NOT EXISTS idx_beta_defect_reviews_reviewed ON beta_defect_reviews (reviewed_at DESC);

CREATE TABLE IF NOT EXISTS beta_support_reviews (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  user_id TEXT NOT NULL,
  consented_at TIMESTAMP_TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  review_version TEXT NOT NULL,
  operator_recorded_support_minutes INTEGER NOT NULL,
  reviewed_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (((operator_recorded_support_minutes >= 0) AND (operator_recorded_support_minutes <= 600))),
  CHECK (((length(reviewer_name) >= 2) AND (length(reviewer_name) <= 100))),
  FOREIGN KEY (user_id, consented_at) REFERENCES beta_participants(user_id, consented_at) ON DELETE CASCADE,
  UNIQUE (user_id, consented_at)
);
CREATE INDEX IF NOT EXISTS idx_beta_support_reviews_reviewed ON beta_support_reviews (reviewed_at DESC);

-- =====================
-- PRO WAITLIST (public capture while annual Pro checkout is unavailable)
-- =====================
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  email TEXT NOT NULL,
  plan_interest TEXT NOT NULL DEFAULT 'pro_annual',
  source TEXT NOT NULL DEFAULT 'pricing',
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_signups_email_plan ON waitlist_signups (lower(email), plan_interest);

-- =====================
-- EVENT PASS SMS ALLOWANCE (credits from purchases, debits per sent segment)
-- =====================
CREATE TABLE IF NOT EXISTS event_sms_ledger (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  delta_segments INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((delta_segments <> 0)),
  CHECK ((reason IN ('event_pass', 'sms_top_up', 'sms_sent'))),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE (reference)
);
CREATE INDEX IF NOT EXISTS idx_event_sms_ledger_event ON event_sms_ledger (event_id);

-- =====================
-- ORGANIZATIONS (workspaces that own events; every host has a personal one)
-- =====================
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'personal',
  is_personal BOOLEAN NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (((length(name) >= 1) AND (length(name) <= 120))),
  CHECK ((plan IN ('personal', 'solo', 'studio', 'agency'))),
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL,
  UNIQUE (slug)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_personal_owner ON organizations (created_by) WHERE is_personal;

CREATE TABLE IF NOT EXISTS organization_members (
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (organization_id, user_id),
  CHECK ((role IN ('owner', 'admin', 'planner', 'check_in'))),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members (user_id);

-- =====================
-- BRANDS (workspace brand kit applied to event pages, emails and SMS)
-- =====================
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT,
  background_color TEXT,
  font_family TEXT,
  sender_name TEXT,
  reply_to_email TEXT,
  sms_signature TEXT,
  white_label BOOLEAN NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT 1,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (((background_color IS NULL) OR ((length(background_color) = 7 AND background_color GLOB '#*' AND substr(background_color, 2) NOT GLOB '*[^0-9A-Fa-f]*')))),
  CHECK (((length(name) >= 1) AND (length(name) <= 80))),
  CHECK (((primary_color IS NULL) OR ((length(primary_color) = 7 AND primary_color GLOB '#*' AND substr(primary_color, 2) NOT GLOB '*[^0-9A-Fa-f]*')))),
  CHECK (((sender_name IS NULL) OR ((length(sender_name) >= 1) AND (length(sender_name) <= 60)))),
  CHECK (((sms_signature IS NULL) OR ((length(sms_signature) >= 1) AND (length(sms_signature) <= 40)))),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_default_per_organization ON brands (organization_id) WHERE is_default;

-- =====================
-- WORKSPACE INVITES (hashed one-time tokens, like event_member_invites)
-- =====================
CREATE TABLE IF NOT EXISTS organization_invites (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_preview TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  expires_at TIMESTAMP_TEXT NOT NULL,
  accepted_at TIMESTAMP_TEXT,
  accepted_by TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((role IN ('admin', 'planner', 'check_in'))),
  FOREIGN KEY (accepted_by) REFERENCES admin_users(id) ON DELETE SET NULL,
  FOREIGN KEY (invited_by) REFERENCES admin_users(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE (token_hash)
);
CREATE INDEX IF NOT EXISTS idx_organization_invites_pending ON organization_invites (organization_id) WHERE (accepted_at IS NULL);

-- =====================
-- CLIENTS (who a workspace runs events for) AND CLIENT REVIEW LINKS
-- =====================
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (((length(name) >= 1) AND (length(name) <= 120))),
  CHECK (((notes IS NULL) OR (length(notes) <= 2000))),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_clients_organization ON clients (organization_id, name);

-- Read-only client review links (hashed tokens). Approval is recorded on the link and in event_audit_log.
CREATE TABLE IF NOT EXISTS event_client_shares (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_preview TEXT NOT NULL,
  created_by TEXT,
  expires_at TIMESTAMP_TEXT NOT NULL,
  revoked_at TIMESTAMP_TEXT,
  approved_at TIMESTAMP_TEXT,
  approver_name TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (((approver_name IS NULL) OR ((length(approver_name) >= 1) AND (length(approver_name) <= 120)))),
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE (token_hash)
);
CREATE INDEX IF NOT EXISTS idx_event_client_shares_event ON event_client_shares (event_id);

-- Outbound workspace webhooks: signed POSTs to an organizer's endpoint, delivered by /api/cron/deliver-webhooks.
CREATE TABLE IF NOT EXISTS organization_webhooks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  organization_id TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events JSON_TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT 1,
  created_by TEXT,
  last_success_at TIMESTAMP_TEXT,
  last_failure_at TIMESTAMP_TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (((description IS NULL) OR (length(description) <= 120))),
  CHECK ((json_array_length(events) >= 1)),
  CHECK (((length(url) >= 1) AND (length(url) <= 500))),
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_organization_webhooks_organization ON organization_webhooks (organization_id);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSON_TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_status_code INTEGER,
  last_error TEXT,
  delivered_at TIMESTAMP_TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((status IN ('pending', 'delivered', 'failed'))),
  FOREIGN KEY (webhook_id) REFERENCES organization_webhooks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due ON webhook_deliveries (next_attempt_at) WHERE (status = 'pending');
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries (webhook_id, created_at DESC);

-- Stripe subscriptions for organizer plans (one per team workspace). The Stripe webhook keeps
-- organizations.plan in sync: only active/trialing subscriptions unlock solo/studio/agency.
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  organization_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end TIMESTAMP_TEXT,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT 0,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((plan IN ('solo', 'studio', 'agency'))),
  CHECK ((status IN ('active', 'past_due', 'canceled', 'trialing'))),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE (stripe_subscription_id)
);

-- Verified-guest social features (additive, idempotent)
CREATE TABLE IF NOT EXISTS event_social_settings (
  event_id TEXT PRIMARY KEY,
  guests_enabled BOOLEAN NOT NULL DEFAULT 0,
  reactions_enabled BOOLEAN NOT NULL DEFAULT 0,
  polls_enabled BOOLEAN NOT NULL DEFAULT 0,
  photos_enabled BOOLEAN NOT NULL DEFAULT 0,
  countdown_enabled BOOLEAN NOT NULL DEFAULT 0,
  photo_approval BOOLEAN NOT NULL DEFAULT 1,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_social_guests (
  event_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  show_name BOOLEAN NOT NULL DEFAULT 0,
  reaction TEXT,
  PRIMARY KEY (event_id, guest_id),
  CHECK ((reaction IN ('excited', 'love', 'celebrate'))),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_social_polls (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSON_TEXT NOT NULL,
  closed BOOLEAN NOT NULL DEFAULT 0,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (((json_array_length(options) >= 2) AND (json_array_length(options) <= 6))),
  CHECK (((length(question) >= 1) AND (length(question) <= 200))),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_social_polls_event ON event_social_polls (event_id);

CREATE TABLE IF NOT EXISTS event_social_votes (
  poll_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  option_index INTEGER NOT NULL,
  PRIMARY KEY (poll_id, guest_id),
  CHECK (((option_index >= 0) AND (option_index <= 5))),
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
  FOREIGN KEY (poll_id) REFERENCES event_social_polls(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_social_photos (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  approved BOOLEAN NOT NULL DEFAULT 0,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((length(caption) <= 200)),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
  UNIQUE (storage_path)
);
CREATE INDEX IF NOT EXISTS idx_social_photos_event ON event_social_photos (event_id);

-- Keep deleted file paths through cascades and retry explicit photo erasure.
CREATE TABLE IF NOT EXISTS event_social_file_cleanup (
  storage_path TEXT PRIMARY KEY,
  queued_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Additive, idempotent migration. Rolling back the application leaves anonymous counters intact.
CREATE TABLE IF NOT EXISTS marketing_pageviews (
  day DATE_TEXT NOT NULL,
  path TEXT NOT NULL,
  channel TEXT NOT NULL,
  views INTEGER NOT NULL,
  PRIMARY KEY (day, path, channel),
  CHECK ((channel IN ('direct', 'organic_search', 'social', 'email', 'referral', 'unknown'))),
  CHECK ((length(path) <= 200)),
  CHECK ((views > 0))
);

-- Native draft retries survive lost responses and process/device restarts.
-- Keep the key after event deletion to prevent a delayed replay recreating it.
CREATE TABLE IF NOT EXISTS mobile_event_mutations (
  user_id TEXT NOT NULL,
  mutation_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  event_id TEXT,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, mutation_key),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

-- New events default to the owner's personal workspace (created with the owner membership on first use).
-- SQLite can't change NEW in a BEFORE trigger, so this runs AFTER INSERT. An INSERT ... RETURNING
-- organization_id therefore still returns NULL; read the row again when you need it.
CREATE TRIGGER IF NOT EXISTS events_default_organization AFTER INSERT ON events
WHEN NEW.organization_id IS NULL
BEGIN
  INSERT OR IGNORE INTO organizations (name, slug, is_personal, created_by)
    SELECT COALESCE(NULLIF(TRIM(u.name), ''), 'My events'), 'personal-' || REPLACE(u.id, '-', ''), 1, u.id
    FROM admin_users u WHERE u.id = NEW.user_id;
  INSERT OR IGNORE INTO organization_members (organization_id, user_id, role)
    SELECT id, NEW.user_id, 'owner' FROM organizations WHERE created_by = NEW.user_id AND is_personal = 1;
  UPDATE events SET organization_id = (SELECT id FROM organizations WHERE created_by = NEW.user_id AND is_personal = 1)
    WHERE id = NEW.id;
END;

-- Keep deleted file paths through cascades and retry explicit photo erasure.
CREATE TRIGGER IF NOT EXISTS queue_deleted_social_photo AFTER DELETE ON event_social_photos
BEGIN
  INSERT OR IGNORE INTO event_social_file_cleanup (storage_path) VALUES (OLD.storage_path);
END;

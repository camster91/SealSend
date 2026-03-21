-- SealSend consolidated schema (migrated from Supabase)
-- Generated from supabase/migrations/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- Enums
-- ============================================

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE event_tier AS ENUM ('free', 'standard', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rsvp_field_type AS ENUM (
    'attendance', 'text', 'select', 'multiselect', 'number', 'email', 'phone'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rsvp_status AS ENUM ('attending', 'not_attending', 'maybe', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Functions
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Core Tables
-- ============================================

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ,
  event_end_date TIMESTAMPTZ,
  location_name TEXT,
  location_address TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  design_url TEXT,
  design_type TEXT DEFAULT 'image',
  customization JSONB DEFAULT '{
    "primaryColor": "#7c3aed",
    "backgroundColor": "#ffffff",
    "backgroundImage": null,
    "fontFamily": "Inter",
    "buttonStyle": "rounded",
    "showCountdown": true
  }'::jsonb,
  slug TEXT UNIQUE NOT NULL,
  status event_status DEFAULT 'draft' NOT NULL,
  tier event_tier DEFAULT 'free' NOT NULL,
  max_responses INTEGER DEFAULT 15,
  payment_id TEXT,
  host_name TEXT,
  dress_code TEXT,
  rsvp_deadline TIMESTAMPTZ,
  registry_links JSONB DEFAULT '[]'::jsonb,
  max_attendees INTEGER,
  allow_plus_ones BOOLEAN DEFAULT true NOT NULL,
  max_guests_per_rsvp INTEGER DEFAULT 10 NOT NULL,
  auto_reminders BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS events_slug_idx ON events(slug);
CREATE INDEX IF NOT EXISTS events_user_id_idx ON events(user_id);
CREATE INDEX IF NOT EXISTS events_auto_reminders_idx
  ON events(status, auto_reminders, event_date)
  WHERE status = 'published' AND auto_reminders = true;

DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RSVP Fields
-- ============================================

CREATE TABLE IF NOT EXISTS rsvp_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type rsvp_field_type NOT NULL,
  options JSONB,
  placeholder TEXT,
  is_required BOOLEAN DEFAULT false,
  is_enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS rsvp_fields_event_id_idx ON rsvp_fields(event_id);

-- ============================================
-- Guests
-- ============================================

CREATE TABLE IF NOT EXISTS guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  invite_status TEXT NOT NULL DEFAULT 'not_sent'
    CHECK (invite_status IN ('not_sent','pending','sent','delivered','bounced','failed')),
  invite_sent_at TIMESTAMPTZ,
  invite_token TEXT UNIQUE,
  invite_error TEXT,
  reminder_sent_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  email_bounced_at TIMESTAMPTZ,
  email_complained_at TIMESTAMPTZ,
  phone_invalid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT valid_guest_email
    CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS guests_event_id_idx ON guests(event_id);
CREATE INDEX IF NOT EXISTS idx_guests_invite_token ON guests(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guests_email_bounced ON guests(email_bounced_at) WHERE email_bounced_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guests_email_complained ON guests(email_complained_at) WHERE email_complained_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guests_phone_invalid ON guests(phone_invalid_at) WHERE phone_invalid_at IS NOT NULL;

DROP TRIGGER IF EXISTS guests_updated_at ON guests;
CREATE TRIGGER guests_updated_at
  BEFORE UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Guest Tags
-- ============================================

CREATE TABLE IF NOT EXISTS guest_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  tag_name TEXT NOT NULL,
  color TEXT DEFAULT '#7c3aed',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS guest_tags_event_id_idx ON guest_tags(event_id);

CREATE TABLE IF NOT EXISTS guest_tag_assignments (
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES guest_tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (guest_id, tag_id)
);

-- ============================================
-- RSVP Responses
-- ============================================

CREATE TABLE IF NOT EXISTS rsvp_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  respondent_name TEXT NOT NULL,
  respondent_email TEXT,
  status rsvp_status DEFAULT 'pending' NOT NULL,
  response_data JSONB DEFAULT '{}'::jsonb,
  headcount INTEGER DEFAULT 1,
  plus_ones_data JSONB DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS rsvp_responses_event_id_idx ON rsvp_responses(event_id);
CREATE INDEX IF NOT EXISTS rsvp_responses_status_idx ON rsvp_responses(event_id, status);

-- ============================================
-- Plus Ones
-- ============================================

CREATE TABLE IF NOT EXISTS plus_ones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  rsvp_response_id UUID REFERENCES rsvp_responses(id) ON DELETE CASCADE NOT NULL,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  status rsvp_status DEFAULT 'pending' NOT NULL,
  invite_token TEXT UNIQUE,
  invite_status TEXT DEFAULT 'not_sent' NOT NULL,
  invite_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS plus_ones_event_id_idx ON plus_ones(event_id);
CREATE INDEX IF NOT EXISTS plus_ones_rsvp_response_id_idx ON plus_ones(rsvp_response_id);
CREATE INDEX IF NOT EXISTS plus_ones_guest_id_idx ON plus_ones(guest_id);
CREATE INDEX IF NOT EXISTS plus_ones_invite_token_idx ON plus_ones(invite_token);

DROP TRIGGER IF EXISTS plus_ones_updated_at ON plus_ones;
CREATE TRIGGER plus_ones_updated_at
  BEFORE UPDATE ON plus_ones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments & Announcements
-- ============================================

CREATE TABLE IF NOT EXISTS event_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  author_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS event_comments_event_id_idx ON event_comments(event_id);

CREATE TABLE IF NOT EXISTS event_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_to_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS event_announcements_event_id_idx ON event_announcements(event_id);

-- ============================================
-- Signups
-- ============================================

CREATE TABLE IF NOT EXISTS event_signup_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  slots INTEGER DEFAULT 1 NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS signup_items_event_id_idx ON event_signup_items(event_id);

CREATE TABLE IF NOT EXISTS event_signup_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES event_signup_items(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  claimant_name TEXT NOT NULL,
  claimant_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS signup_claims_item_id_idx ON event_signup_claims(item_id);
CREATE INDEX IF NOT EXISTS signup_claims_event_id_idx ON event_signup_claims(event_id);

-- ============================================
-- Auth Tables
-- ============================================

CREATE TABLE IF NOT EXISTS auth_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,
  phone TEXT,
  code TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'guest')),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT email_or_phone CHECK (
    (email IS NOT NULL AND phone IS NULL) OR
    (email IS NULL AND phone IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_email_code ON auth_codes(email, code) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_codes_phone_code ON auth_codes(phone, code) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON auth_codes(expires_at);

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- ============================================
-- Guest Magic Tokens
-- ============================================

CREATE TABLE IF NOT EXISTS guest_magic_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  token_hash TEXT NOT NULL,
  token_preview TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_guest_magic_tokens_guest_id ON guest_magic_tokens(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_magic_tokens_event_id ON guest_magic_tokens(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_magic_tokens_token_hash ON guest_magic_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_guest_magic_tokens_expires_at ON guest_magic_tokens(expires_at) WHERE used_at IS NULL;

CREATE OR REPLACE FUNCTION cleanup_expired_magic_tokens()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM guest_magic_tokens
  WHERE expires_at < now() - interval '1 day';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================
-- Email Infrastructure
-- ============================================

CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  to_email TEXT NOT NULL,
  from_email TEXT DEFAULT 'Seal & Send <contact@sealsend.app>',
  reply_to TEXT,
  subject TEXT NOT NULL,
  html_content TEXT,
  text_content TEXT,
  email_type TEXT CHECK (email_type IN ('invitation', 'reminder', 'announcement', 'magic_link', 'confirmation', 'notification', 'other')),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  user_id UUID,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  message_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT valid_email CHECK (to_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_email_queue_created ON email_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_type ON email_queue(email_type);
CREATE INDEX IF NOT EXISTS idx_email_queue_event ON email_queue(event_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_user ON email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_guest ON email_queue(guest_id);

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  to_email TEXT NOT NULL,
  from_email TEXT,
  subject TEXT,
  email_type TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'complained', 'unsubscribed')),
  event_id UUID,
  guest_id UUID,
  user_id UUID,
  queue_id UUID REFERENCES email_queue(id) ON DELETE SET NULL,
  message_id TEXT,
  provider TEXT DEFAULT 'titan',
  error_message TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  clicked_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_event ON email_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON email_logs(to_email);

-- ============================================
-- Send Logs
-- ============================================

CREATE TABLE IF NOT EXISTS send_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  send_type TEXT NOT NULL CHECK (send_type IN ('email', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'bounced')),
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
CREATE INDEX IF NOT EXISTS idx_send_logs_type ON send_logs(send_type);
CREATE INDEX IF NOT EXISTS idx_send_logs_created ON send_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_send_logs_provider_msg ON send_logs(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- ============================================
-- Rate Limiting
-- ============================================

CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key_time ON rate_limit_attempts(key, created_at);

-- ============================================
-- Subscriptions
-- ============================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro','business')),
  billing_cycle TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Helper Functions
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_auth_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM auth_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

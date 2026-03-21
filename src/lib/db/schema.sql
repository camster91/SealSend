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
  code TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'guest')),
  event_id UUID,
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
  event_date TIMESTAMPTZ,
  event_end_date TIMESTAMPTZ,
  location_name TEXT,
  location_address TEXT,
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
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'standard', 'premium')),
  max_responses INTEGER DEFAULT 15,
  auto_reminders BOOLEAN DEFAULT FALSE,
  reminder_days_before INTEGER DEFAULT 2,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

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
  invite_status TEXT DEFAULT 'pending' CHECK (invite_status IN ('pending', 'sent', 'delivered', 'bounced', 'failed')),
  invite_error TEXT,
  rsvp_status TEXT DEFAULT 'pending',
  notes TEXT,
  is_plus_one BOOLEAN DEFAULT FALSE,
  parent_guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  magic_token TEXT UNIQUE,
  magic_token_expires_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guests_event_id ON guests(event_id);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);
CREATE INDEX IF NOT EXISTS idx_guests_invite_token ON guests(invite_token);
CREATE INDEX IF NOT EXISTS idx_guests_magic_token ON guests(magic_token);

-- =====================
-- GUEST TAGS
-- =====================

CREATE TABLE IF NOT EXISTS guest_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
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
  name TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'attending',
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  content TEXT NOT NULL,
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
  title TEXT,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_event ON event_announcements(event_id);

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
  quantity INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_signup_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  signup_item_id UUID NOT NULL REFERENCES event_signup_items(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  claimer_name TEXT NOT NULL,
  claimer_email TEXT,
  claimed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- SEND LOGS
-- =====================

CREATE TABLE IF NOT EXISTS send_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced', 'delivered')),
  recipient TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_send_logs_event ON send_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_send_logs_guest ON send_logs(guest_id);

-- =====================
-- GUEST MAGIC TOKENS
-- =====================

CREATE TABLE IF NOT EXISTS guest_magic_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_magic_tokens_token ON guest_magic_tokens(token);
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
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'business')),
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe ON user_subscriptions(stripe_subscription_id);

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

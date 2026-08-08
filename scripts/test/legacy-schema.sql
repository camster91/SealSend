\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT,
  event_date TIMESTAMPTZ,
  auto_reminders BOOLEAN DEFAULT FALSE
);
CREATE TABLE guests (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL,
  invite_status TEXT DEFAULT 'pending' CHECK (invite_status IN ('pending', 'sent', 'delivered', 'bounced', 'failed'))
);
CREATE TABLE guest_tags (id UUID PRIMARY KEY, event_id UUID NOT NULL, name TEXT NOT NULL);
CREATE TABLE rsvp_responses (id UUID PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE plus_ones (id UUID PRIMARY KEY);
CREATE TABLE event_comments (id UUID PRIMARY KEY, content TEXT NOT NULL);
CREATE TABLE event_announcements (id UUID PRIMARY KEY, title TEXT, message TEXT NOT NULL, sent_count INTEGER DEFAULT 0);
CREATE TABLE event_signup_items (id UUID PRIMARY KEY, event_id UUID NOT NULL, quantity INTEGER DEFAULT 1);
CREATE TABLE event_signup_claims (
  id UUID PRIMARY KEY,
  signup_item_id UUID NOT NULL,
  claimer_name TEXT NOT NULL,
  claimer_email TEXT,
  claimed_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE guest_magic_tokens (
  id UUID PRIMARY KEY,
  guest_id UUID NOT NULL,
  token TEXT UNIQUE NOT NULL,
  event_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE send_logs (
  id UUID PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced', 'delivered')),
  recipient TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO events VALUES (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000010',
  'published', NOW(), TRUE
);
INSERT INTO guests (id, event_id) VALUES (
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001'
);
INSERT INTO guest_tags VALUES (
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  'VIP'
);
INSERT INTO rsvp_responses (id) VALUES ('10000000-0000-4000-8000-000000000004');
INSERT INTO plus_ones VALUES ('10000000-0000-4000-8000-000000000005');
INSERT INTO event_comments VALUES ('10000000-0000-4000-8000-000000000006', 'Legacy comment');
INSERT INTO event_announcements VALUES ('10000000-0000-4000-8000-000000000007', 'Legacy subject', 'Legacy message', 4);
INSERT INTO event_signup_items VALUES (
  '10000000-0000-4000-8000-000000000008',
  '10000000-0000-4000-8000-000000000001',
  3
);
INSERT INTO event_signup_claims VALUES (
  '10000000-0000-4000-8000-000000000009',
  '10000000-0000-4000-8000-000000000008',
  'Legacy Claimer',
  'legacy@example.com',
  NOW()
);
INSERT INTO guest_magic_tokens VALUES (
  '10000000-0000-4000-8000-000000000011',
  '10000000-0000-4000-8000-000000000002',
  repeat('Z', 43),
  '10000000-0000-4000-8000-000000000001',
  NOW() + INTERVAL '1 day',
  NULL,
  NOW()
);
INSERT INTO send_logs VALUES (
  '10000000-0000-4000-8000-000000000012',
  'email', 'sent', 'legacy@example.com', NOW()
);

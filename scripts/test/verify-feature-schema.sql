\set ON_ERROR_STOP on
BEGIN;

INSERT INTO admin_users (id, email, password, name)
VALUES ('00000000-0000-4000-8000-000000000001', 'schema@sealsend.test', 'unused', 'Schema Test');

INSERT INTO events (
  id, user_id, title, slug, location_lat, location_lng, payment_id, status
) VALUES (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Schema Contract Event',
  'schema-contract-event',
  43.6532,
  -79.3832,
  'cs_test_schema',
  'published'
);

INSERT INTO guests (id, event_id, name, email, tags, reminder_sent_at)
VALUES (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  'Schema Guest',
  'guest@sealsend.test',
  '["vip"]',
  NULL
);

INSERT INTO guest_tags (event_id, tag_name, color)
VALUES ('00000000-0000-4000-8000-000000000002', 'VIP', '#6366f1');

INSERT INTO rsvp_responses (
  id, event_id, guest_id, respondent_name, status, submitted_at
) VALUES (
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  'Schema Guest',
  'attending',
  NOW()
);

INSERT INTO event_comments (event_id, author_name, message, is_private)
VALUES ('00000000-0000-4000-8000-000000000002', 'Schema Guest', 'Looks good', FALSE);

INSERT INTO event_announcements (event_id, subject, message, sent_to_count)
VALUES ('00000000-0000-4000-8000-000000000002', 'Update', 'Doors open at six.', 1);

INSERT INTO event_signup_items (id, event_id, title, category, slots)
VALUES (
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000002',
  'Bring dessert',
  'Food',
  2
);

INSERT INTO event_signup_claims (item_id, event_id, claimant_name, claimant_email)
VALUES (
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000002',
  'Schema Guest',
  'guest@sealsend.test'
);

INSERT INTO guest_magic_tokens (
  guest_id, event_id, token_hash, token_preview, expires_at, created_by
) VALUES (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  repeat('a', 64),
  'aaaa',
  NOW() + INTERVAL '7 days',
  '00000000-0000-4000-8000-000000000001'
);

INSERT INTO send_logs (
  guest_id, event_id, send_type, status, recipient, provider_message_id, metadata
) VALUES (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  'email',
  'sent',
  'guest@sealsend.test',
  'provider-schema-test',
  '{"source":"schema-test"}'
);

SELECT * FROM rsvp_responses
WHERE event_id = '00000000-0000-4000-8000-000000000002'
ORDER BY submitted_at DESC;

ROLLBACK;

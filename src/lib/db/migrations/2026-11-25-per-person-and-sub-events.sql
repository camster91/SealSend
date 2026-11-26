-- D1 migration: per-person RSVP answers (Stage 2.2) + optional sub-events (Stage 2.3).
-- Apply to existing D1 databases before deploying the new application code:
--   npx wrangler d1 execute sealsend-db --remote --file=src/lib/db/migrations/2026-11-25-per-person-and-sub-events.sql

ALTER TABLE rsvp_fields ADD COLUMN per_person BOOLEAN DEFAULT 0;
ALTER TABLE plus_ones ADD COLUMN answers JSON_TEXT NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS event_sub_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMP_TEXT,
  ends_at TIMESTAMP_TEXT,
  location_name TEXT,
  location_address TEXT,
  visibility TEXT NOT NULL DEFAULT 'all',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((visibility IN ('all', 'invited_only'))),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_event_sub_events_event ON event_sub_events (event_id, sort_order);

CREATE TABLE IF NOT EXISTS sub_event_guests (
  sub_event_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  PRIMARY KEY (sub_event_id, guest_id),
  FOREIGN KEY (sub_event_id) REFERENCES event_sub_events(id) ON DELETE CASCADE,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sub_event_guests_guest ON sub_event_guests (guest_id);

CREATE TABLE IF NOT EXISTS sub_event_rsvps (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  sub_event_id TEXT NOT NULL,
  rsvp_response_id TEXT NOT NULL,
  guest_id TEXT,
  status TEXT NOT NULL,
  headcount INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP_TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((status IN ('attending', 'not_attending', 'maybe'))),
  CHECK ((headcount >= 1 AND headcount <= 50)),
  UNIQUE (sub_event_id, rsvp_response_id),
  FOREIGN KEY (sub_event_id) REFERENCES event_sub_events(id) ON DELETE CASCADE,
  FOREIGN KEY (rsvp_response_id) REFERENCES rsvp_responses(id) ON DELETE CASCADE,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sub_event_rsvps_response ON sub_event_rsvps (rsvp_response_id);

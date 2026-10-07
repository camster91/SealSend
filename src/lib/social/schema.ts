/** Additive, idempotent schema; no existing records are modified. */
export const SOCIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS event_social_settings (
  event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  guests_enabled BOOLEAN NOT NULL DEFAULT false,
  reactions_enabled BOOLEAN NOT NULL DEFAULT false,
  polls_enabled BOOLEAN NOT NULL DEFAULT false,
  photos_enabled BOOLEAN NOT NULL DEFAULT false,
  countdown_enabled BOOLEAN NOT NULL DEFAULT false,
  photo_approval BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS event_social_guests (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  show_name BOOLEAN NOT NULL DEFAULT false,
  reaction TEXT CHECK (reaction IN ('excited','love','celebrate')),
  PRIMARY KEY (event_id, guest_id)
);
CREATE TABLE IF NOT EXISTS event_social_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (char_length(question) BETWEEN 1 AND 200),
  options JSONB NOT NULL CHECK (jsonb_array_length(options) BETWEEN 2 AND 6),
  closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_social_polls_event ON event_social_polls(event_id);
CREATE TABLE IF NOT EXISTS event_social_votes (
  poll_id UUID NOT NULL REFERENCES event_social_polls(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL CHECK (option_index BETWEEN 0 AND 5),
  PRIMARY KEY (poll_id, guest_id)
);
CREATE TABLE IF NOT EXISTS event_social_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  caption TEXT NOT NULL DEFAULT '' CHECK (char_length(caption) <= 200),
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_social_photos_event ON event_social_photos(event_id);
`;

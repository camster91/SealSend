-- Additive migration. Back up the database before an approved beta deployment.
BEGIN;
CREATE TABLE IF NOT EXISTS mobile_event_mutations (
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  mutation_key UUID NOT NULL,
  request_hash TEXT NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, mutation_key)
);
COMMIT;

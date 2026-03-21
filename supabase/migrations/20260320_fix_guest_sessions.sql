ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS fk_admin_user;
ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS valid_session;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

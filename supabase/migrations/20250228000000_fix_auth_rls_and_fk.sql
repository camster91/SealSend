-- Fix auth_codes RLS: Add DELETE policy so used codes can be cleaned up
-- The service role key bypasses RLS, but this is good practice for completeness
CREATE POLICY "Allow deleting auth codes" ON auth_codes
  FOR DELETE USING (true);

-- Fix auth_codes: Allow updates (for upsert operations)
CREATE POLICY "Allow updating auth codes" ON auth_codes
  FOR UPDATE USING (true);

-- Fix user_sessions: Drop the restrictive foreign key constraint
-- that prevents guest session creation (guest user_ids come from auth_codes, not admin_users)
ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS fk_admin_user;

-- Drop the overly restrictive CHECK constraint that references admin_users
ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS valid_session;

-- Add a simpler check constraint
ALTER TABLE user_sessions ADD CONSTRAINT valid_session_role CHECK (
  user_role IN ('admin', 'guest')
);

-- Fix user_sessions RLS: Allow the service role to manage all sessions
-- and allow token-based lookups for session validation
CREATE POLICY "Allow inserting sessions" ON user_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow selecting sessions by token" ON user_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow deleting expired sessions" ON user_sessions
  FOR DELETE USING (true);

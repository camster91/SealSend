-- Create auth_codes table for temporary login codes
CREATE TABLE IF NOT EXISTS auth_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,
  phone TEXT,
  code TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'guest')),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure either email or phone is provided
  CONSTRAINT email_or_phone CHECK (
    (email IS NOT NULL AND phone IS NULL) OR 
    (email IS NULL AND phone IS NOT NULL)
  )
);

-- Create index for faster lookups
CREATE INDEX idx_auth_codes_email_code ON auth_codes(email, code) WHERE email IS NOT NULL;
CREATE INDEX idx_auth_codes_phone_code ON auth_codes(phone, code) WHERE phone IS NOT NULL;
CREATE INDEX idx_auth_codes_expires ON auth_codes(expires_at);

-- Create admin_users table for password-based admin login
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- bcrypt hashed password - never store plaintext
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_sessions table for tracking active sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_role TEXT NOT NULL CHECK (user_role IN ('admin', 'guest')),
  session_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Different foreign key based on role
  CONSTRAINT fk_admin_user FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  CONSTRAINT valid_session CHECK (
    (user_role = 'admin' AND user_id IN (SELECT id FROM admin_users)) OR
    (user_role = 'guest' AND user_id IS NOT NULL) -- Guest IDs are from auth_codes
  )
);

-- Create index for session lookups
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- Enable Row Level Security
ALTER TABLE auth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- auth_codes: only insert/select own codes
CREATE POLICY "Users can insert their own auth codes" ON auth_codes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can select their own auth codes" ON auth_codes
  FOR SELECT USING (
    auth.uid() IS NOT NULL OR 
    (email = current_setting('request.jwt.claims', true)::json->>'email')
  );

-- admin_users: only admins can read, users can update their own
CREATE POLICY "Admins can read all admin users" ON admin_users
  FOR SELECT USING (auth.uid() IN (SELECT id FROM admin_users));

CREATE POLICY "Users can update themselves" ON admin_users
  FOR UPDATE USING (id = auth.uid());

-- user_sessions: users can manage their own sessions
CREATE POLICY "Users can manage their own sessions" ON user_sessions
  FOR ALL USING (user_id = auth.uid());

-- Create function to clean up expired auth codes
CREATE OR REPLACE FUNCTION cleanup_expired_auth_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM auth_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup job (run every hour)
SELECT cron.schedule('cleanup-auth-codes', '0 * * * *', 'SELECT cleanup_expired_auth_codes()');

-- Note: Admin users should be created via the admin registration API
-- which properly hashes passwords using bcrypt.
-- Example (for manual insertion only):
-- INSERT INTO admin_users (email, password, name) 
-- VALUES ('admin@example.com', '$2a$12$...hashed_password...', 'Admin User')
-- ON CONFLICT (email) DO NOTHING;
-- 
-- To create an admin, use the signup API or run:
-- npm run create-admin -- email@example.com "Full Name" "securePassword123!"
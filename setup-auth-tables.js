// Script to setup auth tables in Supabase
// REQUIREMENTS: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const sqlStatements = [
  `CREATE TABLE IF NOT EXISTS auth_codes (
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
  );`,
  `CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    user_role TEXT NOT NULL CHECK (user_role IN ('admin', 'guest')),
    session_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`
];

// Insert admin user via env var — DO NOT hardcode credentials
// Run with: ADMIN_EMAIL=your@email.com ADMIN_TEMP_PASS=temp_pass node setup-auth-tables.js
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_TEMP_PASS = process.env.ADMIN_TEMP_PASS;
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';

if (ADMIN_EMAIL && ADMIN_TEMP_PASS) {
  sqlStatements.push(
    `INSERT INTO admin_users (email, password, name) 
     VALUES ('${ADMIN_EMAIL}', '${ADMIN_TEMP_PASS}', '${ADMIN_NAME}')
     ON CONFLICT (email) DO NOTHING;`
  );
}

async function runSQL(sql) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });
    if (!res.ok) throw new Error(await res.text());
    console.log('✅ Executed:', sql.substring(0, 50) + '...');
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
}

(async () => {
  for (const sql of sqlStatements) {
    await runSQL(sql);
  }
  console.log('Done.');
})();

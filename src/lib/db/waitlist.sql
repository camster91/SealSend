// Waitlist signups — public capture when annual Pro checkout is unavailable.
// Created for issue #149 (replace the disabled "Test billing setup pending" CTA).

CREATE TABLE IF NOT EXISTS waitlist_signups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  plan_interest TEXT NOT NULL DEFAULT 'pro_annual',
  source TEXT NOT NULL DEFAULT 'pricing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One signup per email per plan interest; re-submitting is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_signups_email_plan
  ON waitlist_signups (LOWER(email), plan_interest);

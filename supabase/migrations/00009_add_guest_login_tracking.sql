-- Add guest login tracking for seamless invite acceptance
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add 'accepted' to invite_status check constraint if not already present
-- First, drop the existing constraint
ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_invite_status_check;

-- Add the new constraint with 'accepted' included
ALTER TABLE guests ADD CONSTRAINT guests_invite_status_check 
  CHECK (invite_status IN ('not_sent', 'sent', 'failed', 'accepted'));

-- Expand invite_status values and add error tracking columns
-- Drop the existing check constraint first, then re-add with expanded values
ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_invite_status_check;
ALTER TABLE guests ADD CONSTRAINT guests_invite_status_check
  CHECK (invite_status IN ('not_sent','pending','sent','delivered','bounced','failed'));

-- Add invite_error column for tracking failure reasons
ALTER TABLE guests ADD COLUMN IF NOT EXISTS invite_error TEXT;

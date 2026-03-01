-- Add columns to guests table for email delivery tracking
ALTER TABLE guests
ADD COLUMN IF NOT EXISTS email_bounced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_complained_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS phone_invalid_at TIMESTAMPTZ;

-- Create index for efficient filtering
CREATE INDEX idx_guests_email_bounced ON guests(email_bounced_at) WHERE email_bounced_at IS NOT NULL;
CREATE INDEX idx_guests_email_complained ON guests(email_complained_at) WHERE email_complained_at IS NOT NULL;
CREATE INDEX idx_guests_phone_invalid ON guests(phone_invalid_at) WHERE phone_invalid_at IS NOT NULL;

-- Add check constraint for valid email status
ALTER TABLE guests ADD CONSTRAINT valid_guest_email 
  CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

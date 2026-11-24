-- Run once on D1 BEFORE deploying the code that reads email_verified_at.
ALTER TABLE admin_users ADD COLUMN email_verified_at TIMESTAMP_TEXT;

-- Password sign-up first shipped on 2026-11-11. Accounts made before that came from
-- one-time codes or the operator CLI, so their address is already proven.
UPDATE admin_users SET email_verified_at = created_at WHERE created_at < '2026-11-11T00:00:00.000Z';

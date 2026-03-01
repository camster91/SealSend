-- Migration: Add guest login tracking for seamless invite acceptance
-- Run this in your Supabase SQL Editor or via psql

-- Add last_login_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'guests' AND column_name = 'last_login_at'
    ) THEN
        ALTER TABLE guests ADD COLUMN last_login_at TIMESTAMPTZ;
    END IF;
END $$;

-- Update invite_status constraint to include 'accepted'
-- First check current constraint
DO $$
BEGIN
    -- Drop existing constraint if it exists
    ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_invite_status_check;
    
    -- Add new constraint with all values including 'accepted'
    ALTER TABLE guests ADD CONSTRAINT guests_invite_status_check 
        CHECK (invite_status IN ('not_sent', 'sent', 'failed', 'accepted'));
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Constraint update skipped: %', SQLERRM;
END $$;

-- Update any NULL invite_status values
UPDATE guests SET invite_status = 'not_sent' WHERE invite_status IS NULL;

-- Verify the changes
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'guests' 
AND column_name IN ('last_login_at', 'invite_status');

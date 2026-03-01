-- SealSend Database Migration Verification
-- Run this in Supabase SQL Editor to verify deployment

-- ========================================
-- 1. Check if last_login_at column exists
-- ========================================
SELECT 
    'last_login_at column' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'guests' 
            AND column_name = 'last_login_at'
        ) THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status;

-- ========================================
-- 2. Check invite_status constraint
-- ========================================
SELECT 
    'invite_status constraint' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'guests_invite_status_check'
            AND pg_get_constraintdef(oid) LIKE '%accepted%'
        ) THEN '✓ INCLUDES ACCEPTED'
        ELSE '✗ MISSING ACCEPTED'
    END as status;

-- ========================================
-- 3. Show current constraint definition
-- ========================================
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname = 'guests_invite_status_check';

-- ========================================
-- 4. Apply migration if needed
-- ========================================
-- Uncomment and run these if checks above show MISSING:

-- Add last_login_at column
-- ALTER TABLE guests ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Update invite_status constraint
-- ALTER TABLE guests DROP CONSTRAINT IF EXISTS guests_invite_status_check;
-- ALTER TABLE guests ADD CONSTRAINT guests_invite_status_check 
--     CHECK (invite_status IN ('not_sent', 'sent', 'failed', 'accepted'));

-- ========================================
-- 5. Verify user_sessions table exists
-- ========================================
SELECT 
    'user_sessions table' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'user_sessions'
        ) THEN '✓ EXISTS'
        ELSE '✗ MISSING'
    END as status;

-- ========================================
-- 6. Show guests table structure
-- ========================================
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'guests'
ORDER BY ordinal_position;

-- ========================================
-- 7. Test: Count guests by invite status
-- ========================================
SELECT 
    invite_status,
    COUNT(*) as count
FROM guests
GROUP BY invite_status
ORDER BY invite_status;

-- ========================================
-- Summary
-- ========================================
-- All checks should show ✓ for deployment to be complete
-- If any show ✗, run the migration commands above

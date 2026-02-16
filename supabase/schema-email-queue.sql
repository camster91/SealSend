-- Email Queue Schema for Supabase
-- Run this in Supabase SQL Editor

-- 1. Email Queue Table
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    to_email TEXT NOT NULL,
    from_email TEXT DEFAULT 'Seal & Send <contact@sealsend.app>',
    subject TEXT NOT NULL,
    html_content TEXT,
    text_content TEXT,
    reply_to TEXT,
    event_id UUID,
    guest_id UUID,
    email_type TEXT CHECK (email_type IN ('invitation', 'reminder', 'announcement', 'auth', 'other')),
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    sent_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Email Logs Table (for tracking)
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    to_email TEXT NOT NULL,
    from_email TEXT,
    subject TEXT,
    email_type TEXT,
    status TEXT NOT NULL CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'complained')),
    event_id UUID,
    guest_id UUID,
    message_id TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_email_queue_created ON email_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_queue_type ON email_queue(email_type);
CREATE INDEX IF NOT EXISTS idx_email_queue_event ON email_queue(event_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_event ON email_logs(event_id);

-- 4. Functions for managing email queue

-- Add email to queue
CREATE OR REPLACE FUNCTION queue_email(
    p_to_email TEXT,
    p_subject TEXT,
    p_html_content TEXT,
    p_email_type TEXT DEFAULT 'other',
    p_from_email TEXT DEFAULT 'Seal & Send <contact@sealsend.app>',
    p_text_content TEXT DEFAULT NULL,
    p_reply_to TEXT DEFAULT NULL,
    p_event_id UUID DEFAULT NULL,
    p_guest_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO email_queue (
        to_email, subject, html_content, email_type, from_email,
        text_content, reply_to, event_id, guest_id, metadata
    ) VALUES (
        p_to_email, p_subject, p_html_content, p_email_type, p_from_email,
        p_text_content, p_reply_to, p_event_id, p_guest_id, p_metadata
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark email as sent
CREATE OR REPLACE FUNCTION mark_email_sent(
    p_id UUID,
    p_message_id TEXT
) RETURNS void AS $$
BEGIN
    UPDATE email_queue
    SET status = 'sent',
        sent_at = NOW(),
        last_error = NULL,
        updated_at = NOW()
    WHERE id = p_id;

    INSERT INTO email_logs (to_email, subject, email_type, status, message_id, event_id, guest_id)
    SELECT to_email, subject, email_type, 'sent', p_message_id, event_id, guest_id
    FROM email_queue WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark email as failed
CREATE OR REPLACE FUNCTION mark_email_failed(
    p_id UUID,
    p_error TEXT
) RETURNS void AS $$
BEGIN
    UPDATE email_queue
    SET status = 'failed',
        last_error = p_error,
        retry_count = retry_count + 1,
        updated_at = NOW()
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Database trigger to call Edge Function (optional)
-- This requires pg_webhook extension or external worker

-- 6. Grant permissions
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email queue" ON email_queue
    FOR SELECT USING (auth.uid()::TEXT = (SELECT id::TEXT FROM events WHERE user_id = auth.uid()));

-- 7. View for pending emails
CREATE OR REPLACE VIEW pending_emails AS
SELECT *
FROM email_queue
WHERE status = 'pending'
ORDER BY created_at ASC;

-- 8. Statistics view
CREATE OR REPLACE VIEW email_stats AS
SELECT
    DATE(created_at) as date,
    email_type,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM email_queue
GROUP BY DATE(created_at), email_type
ORDER BY date DESC;

-- 9. Helper: Queue invitation email
CREATE OR REPLACE FUNCTION queue_invitation(
    p_guest_id UUID,
    p_event_id UUID
) RETURNS UUID AS $$
DECLARE
    v_queue_id UUID;
BEGIN
    -- Get guest and event details
    INSERT INTO email_queue (to_email, subject, html_content, email_type, event_id, guest_id, from_email)
    SELECT
        g.email,
        'You''re Invited: ' || e.title,
        'Invitation template', -- Would be replaced with actual template
        'invitation',
        e.id,
        g.id,
        'Seal & Send <contact@sealsend.app>'
    FROM guests g
    CROSS JOIN events e
    WHERE g.id = p_guest_id AND e.id = p_event_id
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_queue_id;

    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
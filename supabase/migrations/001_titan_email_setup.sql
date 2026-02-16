-- Titan Email Setup for Supabase
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/vtbreowxqfcvwegpfnwn/sql

-- ============================================
-- 1. Email Queue Table
-- ============================================
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    
    -- Email fields
    to_email TEXT NOT NULL,
    from_email TEXT DEFAULT 'Seal & Send <contact@sealsend.app>',
    reply_to TEXT,
    subject TEXT NOT NULL,
    html_content TEXT,
    text_content TEXT,
    
    -- Context
    email_type TEXT CHECK (email_type IN ('invitation', 'reminder', 'announcement', 'magic_link', 'confirmation', 'notification', 'other')),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Tracking
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error TEXT,
    sent_at TIMESTAMPTZ,
    message_id TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Constraints
    CONSTRAINT valid_email CHECK (to_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Enable RLS
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. Email Logs Table (for analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Email info
    to_email TEXT NOT NULL,
    from_email TEXT,
    subject TEXT,
    email_type TEXT,
    
    -- Status
    status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'complained', 'unsubscribed')),
    
    -- Context
    event_id UUID,
    guest_id UUID,
    user_id UUID,
    queue_id UUID REFERENCES email_queue(id) ON DELETE SET NULL,
    
    -- Tracking
    message_id TEXT,
    provider TEXT DEFAULT 'titan',
    error_message TEXT,
    
    -- Engagement (updated via webhooks)
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    clicked_url TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_email_queue_created ON email_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_email_queue_type ON email_queue(email_type);
CREATE INDEX IF NOT EXISTS idx_email_queue_event ON email_queue(event_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_user ON email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_guest ON email_queue(guest_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_event ON email_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON email_logs(to_email);

-- ============================================
-- 4. Helper Functions
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_queue_timestamp
    BEFORE UPDATE ON email_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Queue an email
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
    p_user_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO email_queue (
        to_email, subject, html_content, email_type, from_email,
        text_content, reply_to, event_id, guest_id, user_id, metadata
    ) VALUES (
        p_to_email, p_subject, p_html_content, p_email_type, p_from_email,
        p_text_content, p_reply_to, p_event_id, p_guest_id, p_user_id, p_metadata
    )
    RETURNING id INTO v_id;
    
    -- Log the queue action
    INSERT INTO email_logs (to_email, subject, email_type, status, queue_id, event_id, guest_id, user_id)
    VALUES (p_to_email, p_subject, p_email_type, 'queued', v_id, p_event_id, p_guest_id, p_user_id);

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark email as sent
CREATE OR REPLACE FUNCTION mark_email_sent(
    p_id UUID,
    p_message_id TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
    UPDATE email_queue
    SET status = 'sent',
        sent_at = NOW(),
        message_id = p_message_id,
        last_error = NULL,
        updated_at = NOW()
    WHERE id = p_id;

    -- Update log
    UPDATE email_logs
    SET status = 'sent',
        message_id = p_message_id
    WHERE queue_id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark email as failed
CREATE OR REPLACE FUNCTION mark_email_failed(
    p_id UUID,
    p_error TEXT DEFAULT 'Unknown error'
) RETURNS void AS $$
BEGIN
    UPDATE email_queue
    SET status = CASE 
        WHEN retry_count >= max_retries THEN 'failed'
        ELSE 'pending'
    END,
        last_error = p_error,
        retry_count = retry_count + 1,
        updated_at = NOW()
    WHERE id = p_id;

    -- Update log
    UPDATE email_logs
    SET status = 'failed',
        error_message = p_error
    WHERE queue_id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancel email
CREATE OR REPLACE FUNCTION cancel_email(p_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE email_queue
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_id AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Views
-- ============================================

-- Pending emails (for processing)
CREATE OR REPLACE VIEW pending_emails AS
SELECT *
FROM email_queue
WHERE status = 'pending'
  AND retry_count < max_retries
ORDER BY created_at ASC;

-- Failed emails
CREATE OR REPLACE VIEW failed_emails AS
SELECT *
FROM email_queue
WHERE status = 'failed'
ORDER BY updated_at DESC;

-- Email statistics by type
CREATE OR REPLACE VIEW email_stats_by_type AS
SELECT
    email_type,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
    ROUND(AVG(CASE WHEN sent_at IS NOT NULL AND created_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (sent_at - created_at)) 
        END), 2) as avg_send_time_seconds
FROM email_queue
GROUP BY email_type;

-- Email statistics by date
CREATE OR REPLACE VIEW email_stats_by_date AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM email_queue
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Event email summary
CREATE OR REPLACE VIEW event_email_summary AS
SELECT
    e.id as event_id,
    e.title as event_title,
    COUNT(DISTINCT eq.id) as total_emails,
    COUNT(DISTINCT CASE WHEN eq.status = 'sent' THEN eq.id END) as sent_emails,
    COUNT(DISTINCT CASE WHEN eq.status = 'failed' THEN eq.id END) as failed_emails
FROM events e
LEFT JOIN email_queue eq ON eq.event_id = e.id
GROUP BY e.id, e.title;

-- ============================================
-- 6. RLS Policies
-- ============================================

-- Users can see their own emails
CREATE POLICY "Users view own email_queue" ON email_queue
    FOR SELECT USING (user_id = auth.uid());

-- Users can see emails for their events
CREATE POLICY "Users view event emails" ON email_queue
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM events e 
            WHERE e.id = email_queue.event_id 
            AND e.user_id = auth.uid()
        )
    );

-- Service role can do everything (Edge Functions use this)
CREATE POLICY "Service role full access" ON email_queue
    FOR ALL USING (auth.role() = 'service_role');

-- Email logs policies
CREATE POLICY "Users view own email_logs" ON email_logs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users view event email_logs" ON email_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM events e 
            WHERE e.id = email_logs.event_id 
            AND e.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access logs" ON email_logs
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 7. Queue Invitation Email Helper
-- ============================================

CREATE OR REPLACE FUNCTION queue_invitation_email(
    p_guest_id UUID,
    p_event_id UUID
) RETURNS UUID AS $$
DECLARE
    v_guest RECORD;
    v_event RECORD;
    v_queue_id UUID;
    v_html TEXT;
    v_rsvp_url TEXT;
BEGIN
    -- Get guest info
    SELECT * INTO v_guest FROM guests WHERE id = p_guest_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Guest not found';
    END IF;
    
    -- Get event info
    SELECT * INTO v_event FROM events WHERE id = p_event_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event not found';
    END IF;
    
    -- Build RSVP URL
    v_rsvp_url := 'https://sealsend.ai/e/' || v_event.slug;
    IF v_guest.invite_token IS NOT NULL THEN
        v_rsvp_url := v_rsvp_url || '?t=' || v_guest.invite_token;
    END IF;
    
    -- Build HTML
    v_html := format(
        '<h1>You''re Invited: %s</h1>
        <p>Hi %s,</p>
        <p>You''ve been invited to <strong>%s</strong>.</p>
        %s
        %s
        <p><a href="%s" style="padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;">RSVP Now</a></p>
        <p>Sent with Seal & Send</p>',
        v_event.title,
        v_guest.name,
        v_event.title,
        CASE WHEN v_event.event_date IS NOT NULL 
            THEN '<p><strong>Date:</strong> ' || v_event.event_date::TEXT || '</p>' 
            ELSE '' END,
        CASE WHEN v_event.location_name IS NOT NULL 
            THEN '<p><strong>Location:</strong> ' || v_event.location_name || '</p>' 
            ELSE '' END,
        v_rsvp_url
    );
    
    -- Queue the email
    INSERT INTO email_queue (
        to_email,
        subject,
        html_content,
        email_type,
        from_email,
        event_id,
        guest_id,
        user_id,
        metadata
    ) VALUES (
        v_guest.email,
        'You''re Invited: ' || v_event.title,
        v_html,
        'invitation',
        'Seal & Send <contact@sealsend.app>',
        p_event_id,
        p_guest_id,
        v_event.user_id,
        jsonb_build_object(
            'rsvp_url', v_rsvp_url,
            'guest_name', v_guest.name,
            'event_title', v_event.title
        )
    )
    RETURNING id INTO v_queue_id;
    
    -- Update guest status
    UPDATE guests 
    SET invite_status = 'queued', 
        invite_queued_at = NOW()
    WHERE id = p_guest_id;
    
    RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. Trigger to auto-queue on guest add
-- ============================================

-- Optional: Auto-queue invitation when guest is added with status 'pending'
-- Uncomment if you want automatic queuing

/*
CREATE OR REPLACE FUNCTION auto_queue_invitation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS NOT NULL AND NEW.invite_status = 'pending' THEN
        PERFORM queue_invitation_email(NEW.id, NEW.event_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER queue_invitation_on_guest_add
    AFTER INSERT ON guests
    FOR EACH ROW
    WHEN (NEW.email IS NOT NULL)
    EXECUTE FUNCTION auto_queue_invitation();
*/

-- ============================================
-- 9. Test the Setup
-- ============================================

-- Test queue function (run after events/guests exist)
-- SELECT queue_email(
--     'test@example.com',
--     'Test from Seal & Send',
--     '<h1>Hello!</h1><p>This is a test email.</p>',
--     'notification'
-- );

-- View pending
-- SELECT * FROM pending_emails;

-- View stats
-- SELECT * FROM email_stats_by_type;

COMMENT ON TABLE email_queue IS 'Queue for outgoing emails via Titan SMTP';
COMMENT ON TABLE email_logs IS 'Audit log of all email activities';
COMMENT ON FUNCTION queue_email IS 'Add an email to the queue for processing';
COMMENT ON FUNCTION queue_invitation_email IS 'Queue invitation email for a specific guest';
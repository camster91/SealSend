-- Create send_logs table for tracking email and SMS deliveries
CREATE TABLE IF NOT EXISTS send_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  send_type TEXT NOT NULL CHECK (send_type IN ('email', 'sms')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'bounced')),
  recipient TEXT NOT NULL, -- email or phone
  subject TEXT,
  error_message TEXT,
  provider TEXT, -- 'resend' or 'twilio'
  provider_message_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_send_logs_event ON send_logs(event_id);
CREATE INDEX idx_send_logs_guest ON send_logs(guest_id);
CREATE INDEX idx_send_logs_status ON send_logs(status);
CREATE INDEX idx_send_logs_type ON send_logs(send_type);
CREATE INDEX idx_send_logs_created ON send_logs(created_at);
CREATE INDEX idx_send_logs_provider_msg ON send_logs(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE send_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view send logs for their own events
CREATE POLICY "Users can view own event send logs" ON send_logs
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE user_id = auth.uid())
  );

-- RLS Policy: Service role can manage all send logs
CREATE POLICY "Service role can manage send logs" ON send_logs
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_send_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_send_logs_updated_at
  BEFORE UPDATE ON send_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_send_logs_updated_at();

-- Create view for send statistics per event
CREATE OR REPLACE VIEW event_send_stats AS
SELECT 
  event_id,
  send_type,
  status,
  COUNT(*) as count,
  MAX(created_at) as last_sent_at
FROM send_logs
GROUP BY event_id, send_type, status;

-- Function to clean up old send logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_send_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM send_logs WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup job (run daily at 3 AM)
SELECT cron.schedule('cleanup-send-logs', '0 3 * * *', 'SELECT cleanup_old_send_logs()');

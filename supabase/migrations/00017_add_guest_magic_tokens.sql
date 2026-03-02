-- Add magic link tokens table for secure guest self-service
-- Tokens are hashed in DB for security, with 7-day expiration

CREATE TABLE IF NOT EXISTS public.guest_magic_tokens (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  guest_id uuid REFERENCES public.guests(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  token_hash text NOT NULL, -- SHA-256 hash of the token (token itself is never stored)
  token_preview text, -- Last 4 chars of token for display purposes only
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guest_magic_tokens_guest_id ON public.guest_magic_tokens(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_magic_tokens_event_id ON public.guest_magic_tokens(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_magic_tokens_token_hash ON public.guest_magic_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_guest_magic_tokens_expires_at ON public.guest_magic_tokens(expires_at) WHERE used_at IS NULL;

-- Enable RLS
ALTER TABLE public.guest_magic_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view magic tokens for their events" 
  ON public.guest_magic_tokens 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = guest_magic_tokens.event_id 
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create magic tokens for their events" 
  ON public.guest_magic_tokens 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = guest_magic_tokens.event_id 
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete magic tokens for their events" 
  ON public.guest_magic_tokens 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = guest_magic_tokens.event_id 
      AND events.user_id = auth.uid()
    )
  );

-- Allow public read access for token validation (used by the update page)
CREATE POLICY "Public can validate magic tokens" 
  ON public.guest_magic_tokens 
  FOR SELECT 
  USING (true);

-- Function to clean up expired tokens (can be called by a cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_magic_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.guest_magic_tokens 
  WHERE expires_at < now() - interval '1 day'; -- Keep expired tokens for 1 day for audit
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

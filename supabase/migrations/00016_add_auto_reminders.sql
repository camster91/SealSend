-- Add auto_reminders setting to events table
-- This controls whether automatic reminders are sent for the event

ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS auto_reminders BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.events.auto_reminders IS 'Whether to automatically send reminder emails/SMS 24-48 hours before the event';

-- Create index for efficient cron job queries
CREATE INDEX IF NOT EXISTS events_auto_reminders_idx 
  ON public.events(status, auto_reminders, event_date) 
  WHERE status = 'published' AND auto_reminders = true;

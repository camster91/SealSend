\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM guests WHERE invite_status = 'not_sent' AND tags = '[]'::jsonb) THEN
    RAISE EXCEPTION 'guest backfill failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM guest_tags WHERE tag_name = 'VIP') THEN
    RAISE EXCEPTION 'tag backfill failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM event_comments WHERE message = 'Legacy comment') THEN
    RAISE EXCEPTION 'comment backfill failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM event_announcements WHERE subject = 'Legacy subject' AND sent_to_count = 4) THEN
    RAISE EXCEPTION 'announcement backfill failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM event_signup_items WHERE slots = 3) THEN
    RAISE EXCEPTION 'signup item backfill failed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM event_signup_claims
    WHERE item_id = '10000000-0000-4000-8000-000000000008'
      AND event_id = '10000000-0000-4000-8000-000000000001'
      AND claimant_name = 'Legacy Claimer'
  ) THEN
    RAISE EXCEPTION 'signup claim backfill failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM guest_magic_tokens WHERE token_hash IS NOT NULL AND token_preview = 'ZZZZ') THEN
    RAISE EXCEPTION 'magic token backfill failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM send_logs WHERE send_type = 'email') THEN
    RAISE EXCEPTION 'send log backfill failed';
  END IF;
END $$;

-- Expand event tier CHECK constraint to include all per-event tier names
-- Old: ('free', 'standard', 'premium')
-- New: adds silver, gold, platinum, diamond (unified naming)

-- Drop the old constraint (may be enum or CHECK depending on migration history)
DO $$
BEGIN
  -- Try dropping CHECK constraint
  ALTER TABLE events DROP CONSTRAINT IF EXISTS events_tier_check;

  -- Also try dropping any enum-based constraint
  ALTER TABLE events ALTER COLUMN tier TYPE TEXT;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Add new CHECK constraint with all valid tier names
ALTER TABLE events ADD CONSTRAINT events_tier_check
  CHECK (tier IN ('free', 'silver', 'gold', 'platinum', 'diamond', 'standard', 'premium'));

-- Migrate legacy tier names to new names (optional - run if needed)
-- UPDATE events SET tier = 'silver' WHERE tier = 'standard';
-- UPDATE events SET tier = 'gold' WHERE tier = 'premium';

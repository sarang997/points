-- 1. Enable Realtime for the 'events' and 'people' tables
-- This adds the tables to the 'supabase_realtime' publication
-- which is required for Postgres Changes to be broadcast.

BEGIN;
  -- Remove any existing publication if needed (not strictly necessary but safe)
  -- ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS events, people;
  
  -- Add tables to the publication
  ALTER PUBLICATION supabase_realtime ADD TABLE events;
  ALTER PUBLICATION supabase_realtime ADD TABLE people;
COMMIT;

-- 2. Verify settings
-- You can run 'SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';'
-- to confirm the tables are listed.

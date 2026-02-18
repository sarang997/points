-- Migration: Add Vouch System columns to events table

-- 1. Add status column with default 'pending'
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 2. Add approvals and denials as JSONB arrays
ALTER TABLE events ADD COLUMN IF NOT EXISTS approvals JSONB DEFAULT '[]';
ALTER TABLE events ADD COLUMN IF NOT EXISTS denials JSONB DEFAULT '[]';

-- 3. Add fingerprint column for the proposer
ALTER TABLE events ADD COLUMN IF NOT EXISTS fingerprint TEXT;

-- 4. Update existing events to 'live' so they don't disappear
UPDATE events SET status = 'live' WHERE status IS NULL OR status = 'pending';

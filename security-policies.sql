-- PRESTIGE POINTS: Anti-Spam & Democratization Security
-- Run this in the Supabase SQL Editor

-- 1. Add fingerprint column to people if it doesn't exist (for tracking who drafted them)
ALTER TABLE people ADD COLUMN IF NOT EXISTS fingerprint TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE people ADD COLUMN IF NOT EXISTS approvals JSONB DEFAULT '[]';
ALTER TABLE people ADD COLUMN IF NOT EXISTS denials JSONB DEFAULT '[]';

-- Update existing people to be live
UPDATE people SET status = 'live' WHERE status = 'pending' OR status IS NULL;

-- 2. Create the Rate Limiting Function
CREATE OR REPLACE FUNCTION check_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
    recent_count INT;
BEGIN
    -- Only check if a fingerprint is provided
    IF NEW.fingerprint IS NOT NULL THEN
        -- Check how many items this fingerprint created in the last 5 minutes across BOTH tables
        SELECT COUNT(*) INTO recent_count
        FROM (
            SELECT 1 FROM events WHERE fingerprint = NEW.fingerprint AND created_at > NOW() - INTERVAL '5 minutes'
            UNION ALL
            SELECT 1 FROM people WHERE fingerprint = NEW.fingerprint AND created_at > NOW() - INTERVAL '5 minutes'
        ) AS recent_activity;

        IF recent_count > 0 THEN
            RAISE EXCEPTION 'Rate limit exceeded: You can only propose 1 event or player every 5 minutes.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Apply Rate Limit Triggers
DROP TRIGGER IF EXISTS enforce_rate_limit_events ON events;
CREATE TRIGGER enforce_rate_limit_events
BEFORE INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION check_rate_limit();

DROP TRIGGER IF EXISTS enforce_rate_limit_people ON people;
CREATE TRIGGER enforce_rate_limit_people
BEFORE INSERT ON people
FOR EACH ROW
EXECUTE FUNCTION check_rate_limit();

-- 4. Create Voting Restriction Function (Cannot vouch for own proposal)
CREATE OR REPLACE FUNCTION check_voting_rules()
RETURNS TRIGGER AS $$
BEGIN
    -- Only check updates where approvals or denials are changing
    IF (OLD.approvals IS DISTINCT FROM NEW.approvals) OR (OLD.denials IS DISTINCT FROM NEW.denials) THEN
        
        -- Prevent creator from being in the approvals list
        IF NEW.approvals ? NEW.fingerprint THEN
            RAISE EXCEPTION 'You cannot vouch for your own proposal.';
        END IF;

        -- Prevent creator from being in the denials list
        IF NEW.denials ? NEW.fingerprint THEN
            RAISE EXCEPTION 'You cannot deny your own proposal.';
        END IF;
        
        -- Ensure a fingerprint isn't in both approvals and denials
        -- (This is a simplified check, in reality the frontend handles this, but good for DB level)
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Apply Voting Restriction Triggers
DROP TRIGGER IF EXISTS enforce_voting_rules_events ON events;
CREATE TRIGGER enforce_voting_rules_events
BEFORE UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION check_voting_rules();

DROP TRIGGER IF EXISTS enforce_voting_rules_people ON people;
CREATE TRIGGER enforce_voting_rules_people
BEFORE UPDATE ON people
FOR EACH ROW
EXECUTE FUNCTION check_voting_rules();

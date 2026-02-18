/**
 * PRESTIGE POINTS — Supabase Migration Script
 * 
 * Usage:
 * SUPABASE_URL=your_url SUPABASE_KEY=your_key node migrate.js
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_KEY environment variables are required.');
    console.log('Usage: SUPABASE_URL=... SUPABASE_KEY=... node migrate.js');
    process.exit(1);
}

const DATA_FILE = path.join(__dirname, 'data', 'points.json');

async function migrate() {
    try {
        console.log('🔄 Loading local data...');
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

        const people = Object.entries(data.people).map(([id, p]) => ({
            id,
            name: p.name,
            avatar: p.avatar
        }));

        const events = data.events.map(e => ({
            person_id: e.id,
            points: e.points,
            reason: e.reason,
            date: e.date
        }));

        console.log(`📦 Migrating ${people.length} people...`);
        const peopleRes = await fetch(`${SUPABASE_URL}/rest/v1/people`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(people)
        });

        if (!peopleRes.ok) {
            const err = await peopleRes.text();
            throw new Error(`Failed to migrate people: ${err}`);
        }
        console.log('✅ People migrated.');

        console.log(`📦 Migrating ${events.length} events...`);
        const eventsRes = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(events)
        });

        if (!eventsRes.ok) {
            const err = await eventsRes.text();
            throw new Error(`Failed to migrate events: ${err}`);
        }
        console.log('✅ Events migrated.');
        console.log('\n✨ Migration complete! Your data is now in Supabase.');

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    }
}

migrate();

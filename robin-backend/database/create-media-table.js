// Create media_outlets table via Supabase SQL API
// The Supabase Dashboard SQL editor is at /rest/v1/rpc
// But since exec_sql doesn't exist, we'll use the pg endpoint

import 'dotenv/config';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract project ref from URL
const projectRef = SUPA_URL.replace('https://', '').replace('.supabase.co', '');

const sql = `
CREATE TABLE IF NOT EXISTS media_outlets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    country_id TEXT NOT NULL,
    country_name TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    outlet_name TEXT NOT NULL,
    primary_domain TEXT,
    format TEXT,
    ownership_type TEXT,
    political_alignment TEXT,
    factual_reliability TEXT,
    primary_audience TEXT,
    language_primary TEXT,
    established_year TEXT,
    last_updated TEXT,
    verified_by TEXT,
    notes TEXT,
    tags_economic TEXT,
    tags_sociocultural TEXT,
    tags_governance TEXT,
    tags_foreign TEXT,
    tags_other TEXT,
    reliability_score REAL DEFAULT 0.5,
    is_scrapeable BOOLEAN DEFAULT false,
    rss_feed_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT media_outlets_outlet_id_key UNIQUE (outlet_id)
);

ALTER TABLE media_outlets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS media_outlets_read_all ON media_outlets;
CREATE POLICY media_outlets_read_all ON media_outlets FOR SELECT USING (true);
DROP POLICY IF EXISTS media_outlets_admin_all ON media_outlets;
CREATE POLICY media_outlets_admin_all ON media_outlets FOR ALL USING (true);
`;

// First, create a temporary stored procedure, then call it, then drop it
const wrappedSql = `
DO $$ 
BEGIN
    EXECUTE '${sql.replace(/'/g, "''")}';
END $$;
`;

// Actually, let's try creating the table through a simpler SQL function approach
// Create a stored function that just runs the DDL
const createFuncSql = `
CREATE OR REPLACE FUNCTION create_media_outlets_table() 
RETURNS void AS $$
BEGIN
    CREATE TABLE IF NOT EXISTS media_outlets (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        country_id TEXT NOT NULL,
        country_name TEXT NOT NULL,
        outlet_id TEXT NOT NULL,
        outlet_name TEXT NOT NULL,
        primary_domain TEXT,
        format TEXT,
        ownership_type TEXT,
        political_alignment TEXT,
        factual_reliability TEXT,
        primary_audience TEXT,
        language_primary TEXT,
        established_year TEXT,
        last_updated TEXT,
        verified_by TEXT,
        notes TEXT,
        tags_economic TEXT,
        tags_sociocultural TEXT,
        tags_governance TEXT,
        tags_foreign TEXT,
        tags_other TEXT,
        reliability_score REAL DEFAULT 0.5,
        is_scrapeable BOOLEAN DEFAULT false,
        rss_feed_url TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT media_outlets_outlet_id_key UNIQUE (outlet_id)
    );
    
    ALTER TABLE media_outlets ENABLE ROW LEVEL SECURITY;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function main() {
    const headers = {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
    };

    // Method 1: Try the Supabase Management API
    console.log('Trying Supabase Management API...');
    const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    const mgmtRes = await fetch(mgmtUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SUPA_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
    });

    if (mgmtRes.ok) {
        console.log('✅ Table created via Management API!');
        return;
    }

    console.log(`  Management API ${mgmtRes.status}: ${(await mgmtRes.text()).substring(0, 200)}`);

    // Method 2: Create function via PostgREST, then call it
    console.log('\nTrying PostgREST function approach...');

    // First check if we can use the pg_net or dblink extension
    const extensionRes = await fetch(`${SUPA_URL}/rest/v1/rpc/create_media_outlets_table`, {
        method: 'POST',
        headers,
        body: '{}',
    });

    if (extensionRes.ok) {
        console.log('✅ Function already exists and executed');
        return;
    }

    console.log(`  Function call ${extensionRes.status}: ${(await extensionRes.text()).substring(0, 200)}`);

    // Print instructions for manual creation
    console.log('\n═══════════════════════════════════════════════');
    console.log('Please create the table manually:');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Open SQL Editor');
    console.log('3. Paste and run the content from:');
    console.log('   database/migration-006-media-outlets.sql');
    console.log('4. Then run: node database/setup-media-outlets.js');
    console.log('═══════════════════════════════════════════════');
}

main().catch(console.error);

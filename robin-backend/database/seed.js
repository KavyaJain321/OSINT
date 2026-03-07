// ============================================================
// ROBIN OSINT — Database Seed Script
// Populates test data for development and demos
// Usage: node database/seed.js
// ============================================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function seed() {
    console.log('[Seed] Starting...');

    // 1. Create test clients
    const { data: clients, error: clientError } = await supabase
        .from('clients')
        .insert([
            { name: 'National Bank of Pakistan', industry: 'Banking & Finance' },
            { name: 'Pakistan Telecom Corp', industry: 'Telecommunications' },
        ])
        .select();

    if (clientError) {
        console.error('[Seed] Failed to create clients:', clientError.message);
        return;
    }

    const nbpId = clients[0].id;
    const ptcId = clients[1].id;
    console.log(`[Seed] Clients created: NBP=${nbpId}, PTC=${ptcId}`);

    // 2. Add RSS news sources for NBP
    const { data: sources, error: sourceError } = await supabase
        .from('sources')
        .insert([
            { client_id: nbpId, name: 'Dawn Business', url: 'https://www.dawn.com/feeds/business', source_type: 'rss' },
            { client_id: nbpId, name: 'The News International', url: 'https://www.thenews.com.pk/rss/1/8', source_type: 'rss' },
            { client_id: nbpId, name: 'Business Recorder', url: 'https://www.brecorder.com/feeds', source_type: 'rss' },
            { client_id: nbpId, name: 'Reuters Pakistan', url: 'https://feeds.reuters.com/reuters/PKTopNews', source_type: 'rss' },
            { client_id: nbpId, name: 'Tribune Business', url: 'https://tribune.com.pk/feed', source_type: 'rss' },
        ])
        .select();

    if (sourceError) console.error('[Seed] Source error:', sourceError.message);
    else console.log(`[Seed] ${sources.length} sources created`);

    // 3. Add watch keywords for NBP
    const { data: keywords, error: kwError } = await supabase
        .from('watch_keywords')
        .insert([
            { client_id: nbpId, keyword: 'National Bank' },
            { client_id: nbpId, keyword: 'NBP' },
            { client_id: nbpId, keyword: 'banking sector' },
            { client_id: nbpId, keyword: 'SBP' },
            { client_id: nbpId, keyword: 'interest rate' },
            { client_id: nbpId, keyword: 'IMF Pakistan' },
            { client_id: nbpId, keyword: 'FATF' },
            { client_id: nbpId, keyword: 'financial fraud' },
        ])
        .select();

    if (kwError) console.error('[Seed] Keyword error:', kwError.message);
    else console.log(`[Seed] ${keywords.length} keywords created`);

    // 4. Create Super Admin user (UPDATE the UUID and email below!)
    // NOTE: You must log in via Google OAuth first to create the auth user,
    // then get your UUID from Supabase → Authentication → Users
    /*
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: 'YOUR_AUTH_UUID_HERE',          // ← Replace with your auth.users UUID
        email: 'your@email.com',             // ← Replace with your email
        full_name: 'Your Name',              // ← Replace with your name
        role: 'SUPER_ADMIN',
        client_id: null,                     // SUPER_ADMIN has no client_id
      });
  
    if (userError) console.error('[Seed] User error:', userError.message);
    else console.log('[Seed] Super Admin user created');
    */

    console.log('[Seed] ✓ Complete!');
    console.log('[Seed] Next: Uncomment the Super Admin section and add your UUID');
}

seed()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[Seed] Fatal:', err.message);
        process.exit(1);
    });

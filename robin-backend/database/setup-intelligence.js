// ============================================================
// ROBIN OSINT — Intelligence Schema Setup
// Creates tables for the Palantir-grade intelligence engine
// Usage: node database/setup-intelligence.js
// ============================================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function createTableIfNotExists(tableName, createFn) {
    const { error } = await supabase.from(tableName).select('id').limit(0);
    if (!error) {
        console.log(`  ✅ ${tableName} already exists`);
        return true;
    }
    console.log(`  ⏳ ${tableName} needs creation...`);
    return false;
}

async function setupViaPgQuery(sql) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await fetch(url + '/pg/query', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': key,
            'Authorization': 'Bearer ' + key,
        },
        body: JSON.stringify({ query: sql }),
        signal: AbortSignal.timeout(15000),
    });

    return response;
}

async function main() {
    console.log('ROBIN OSINT — Intelligence Schema Setup\n');

    const tables = ['threat_assessments', 'entity_profiles', 'intelligence_signals', 'source_reliability'];
    const missing = [];

    for (const t of tables) {
        const exists = await createTableIfNotExists(t);
        if (!exists) missing.push(t);
    }

    if (missing.length === 0) {
        console.log('\n✅ All intelligence tables exist. Ready to go!');
        return;
    }

    console.log('\n⚠️  Missing tables: ' + missing.join(', '));
    console.log('Attempting to create via pg/query endpoint...\n');

    const sql = readFileSync(join(__dirname, 'intelligence-schema.sql'), 'utf8');

    try {
        const r = await setupViaPgQuery(sql);
        if (r.ok) {
            console.log('✅ Tables created successfully!');
        } else {
            const text = await r.text();
            console.log('pg/query failed (status ' + r.status + ')');
            console.log('\n========================================');
            console.log('MANUAL STEP REQUIRED:');
            console.log('========================================');
            console.log('Copy the contents of database/intelligence-schema.sql');
            console.log('and paste into Supabase SQL Editor at:');
            console.log(process.env.SUPABASE_URL.replace('.supabase.co', '.supabase.co').replace('https://', 'https://supabase.com/dashboard/project/') + '/sql/new');
            console.log('========================================\n');
        }
    } catch (err) {
        console.log('Connection error: ' + err.message);
        console.log('\n========================================');
        console.log('MANUAL STEP REQUIRED:');
        console.log('========================================');
        console.log('Copy the contents of database/intelligence-schema.sql');
        console.log('and paste into Supabase SQL Editor.');
        console.log('========================================\n');
    }
}

main().catch(console.error);

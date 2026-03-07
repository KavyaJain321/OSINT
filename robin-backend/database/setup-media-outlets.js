// ============================================================
// Create media_outlets table and import CSV data
// Usage: node database/setup-media-outlets.js
// ============================================================

import 'dotenv/config';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA_URL || !SUPA_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const db = createClient(SUPA_URL, SUPA_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const headers = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
};

// ── Step 1: Create table via direct SQL ──────────────────────
async function createTable() {
    console.log('Step 1: Creating media_outlets table...');

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
    `;

    // Try via Supabase RPC
    try {
        const { error } = await db.rpc('exec_sql', { sql });
        if (error) console.log('  RPC error:', error.message);
    } catch (e) {
        console.log('  RPC not available, trying REST check...');
    }


    // Check if table exists
    const checkRes = await fetch(`${SUPA_URL}/rest/v1/media_outlets?limit=1&select=id`, { headers });
    if (checkRes.ok) {
        console.log('  ✅ Table exists');
        return true;
    }

    console.log('  ❌ Table does not exist. Creating via Supabase SQL...');
    // Use the Supabase Management API if available
    // Extract project ref from URL
    const projectRef = SUPA_URL.replace('https://', '').replace('.supabase.co', '');
    console.log(`  Project ref: ${projectRef}`);

    // Alternative: try direct PostgreSQL connection via Supabase's pg endpoint
    const sqlRes = await fetch(`${SUPA_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: sql }),
    });

    if (!sqlRes.ok) {
        console.log('  Cannot create table via API. Run this SQL in Supabase SQL Editor:');
        console.log('  File: database/migration-006-media-outlets.sql');
        console.log('');
        console.log('  Or run:');
        console.log(`  psql "${SUPA_URL.replace('https://', 'postgresql://postgres:YOUR_DB_PASSWORD@').replace('.supabase.co', '.supabase.co:5432/postgres')}" -f database/migration-006-media-outlets.sql`);
        return false;
    }

    console.log('  ✅ Table created');
    return true;
}

// ── CSV Parser ──────────────────────────────────────────────
function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') { field += '"'; i++; }
            else if (ch === '"') { inQuotes = false; }
            else { field += ch; }
        } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { row.push(field.trim()); field = ''; }
            else if (ch === '\n' || (ch === '\r' && next === '\n')) {
                row.push(field.trim());
                if (row.some(f => f.length > 0)) rows.push(row);
                row = []; field = '';
                if (ch === '\r') i++;
            } else { field += ch; }
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field.trim());
        if (row.some(f => f.length > 0)) rows.push(row);
    }
    return rows;
}

// ── Reliability Scoring ─────────────────────────────────────
function reliabilityScore(rating) {
    if (!rating) return 0.5;
    const lower = rating.toLowerCase().trim();
    if (lower.includes('high')) return 1.0;
    if (lower.includes('generally reliable')) return 0.8;
    if (lower.includes('factual')) return 0.7;
    if (lower === 'mixed' || lower === 'in flux') return 0.5;
    if (lower.includes('mixed')) return 0.4;
    if (lower.includes('low') && !lower.includes('very')) return 0.3;
    if (lower.includes('very low')) return 0.1;
    return 0.5;
}

function isScrapeable(domain) {
    if (!domain) return false;
    if (domain.includes('(') || domain.includes('Broadcast') || domain.includes('Print')) return false;
    return domain.includes('.');
}

// ── Step 2: Parse and import ────────────────────────────────
async function importData() {
    console.log('\nStep 2: Parsing CSV...');
    const raw = fs.readFileSync('database/media-outlets-raw.csv', 'utf-8');
    const allRows = parseCSV(raw);
    console.log(`  Parsed ${allRows.length} total rows`);

    const outletIdRegex = /^[A-Z]{3}\d{3}$/;
    const outlets = [];

    for (const row of allRows) {
        // Find the outlet_id — typically at index 2
        let outletIdx = -1;
        for (let i = 0; i < Math.min(row.length, 5); i++) {
            if (outletIdRegex.test(row[i])) { outletIdx = i; break; }
        }
        if (outletIdx === -1) continue;

        const base = outletIdx - 2; // normalize so country_id is at 0
        const get = (idx) => (row[base + idx] || '').trim();

        const record = {
            country_id: get(0),
            country_name: get(1),
            outlet_id: get(2),
            outlet_name: get(3),
            primary_domain: get(4) || null,
            format: get(5) || null,
            ownership_type: get(6) || null,
            political_alignment: get(7) || null,
            factual_reliability: get(8) || null,
            primary_audience: get(9) || null,
            language_primary: get(10) || null,
            established_year: get(11) || null,
            last_updated: get(12) || null,
            verified_by: get(13) || null,
            notes: get(14) || null,
            tags_economic: get(15) || null,
            tags_sociocultural: get(16) || null,
            tags_governance: get(17) || null,
            tags_foreign: get(18) || null,
            tags_other: get(19) || null,
            reliability_score: reliabilityScore(get(8)),
            is_scrapeable: isScrapeable(get(4)),
        };

        if (!record.outlet_name || record.outlet_name === 'outlet_name') continue;
        if (!record.country_id || record.country_id === 'country_id') continue;
        outlets.push(record);
    }

    console.log(`  Prepared ${outlets.length} outlets`);

    // Stats
    const countries = {};
    outlets.forEach(o => { countries[o.country_id] = (countries[o.country_id] || 0) + 1; });
    console.log(`  Countries: ${Object.keys(countries).length}`);

    const scrapeable = outlets.filter(o => o.is_scrapeable).length;
    console.log(`  Scrapeable: ${scrapeable}/${outlets.length}`);

    // Clear existing data
    console.log('\n  Clearing old data...');
    await fetch(`${SUPA_URL}/rest/v1/media_outlets?id=not.is.null`, {
        method: 'DELETE', headers,
    });

    // Insert in batches
    console.log('  Inserting...');
    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < outlets.length; i += 30) {
        const batch = outlets.slice(i, i + 30);
        const res = await fetch(`${SUPA_URL}/rest/v1/media_outlets`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify(batch),
        });
        if (res.ok) {
            inserted += batch.length;
        } else {
            const err = await res.text();
            // Try one by one
            for (const outlet of batch) {
                const sr = await fetch(`${SUPA_URL}/rest/v1/media_outlets`, {
                    method: 'POST',
                    headers: { ...headers, 'Prefer': 'return=minimal' },
                    body: JSON.stringify(outlet),
                });
                if (sr.ok) { inserted++; }
                else {
                    failed++;
                    if (failed <= 5) console.error(`    ✗ ${outlet.outlet_id}: ${(await sr.text()).substring(0, 80)}`);
                }
            }
        }
        process.stdout.write(`\r  Progress: ${inserted}/${outlets.length} (${failed} failed)`);
    }

    console.log(`\n\n✅ Done! Imported ${inserted} outlets, ${failed} failed.`);

    // Verify
    const { count } = await db.from('media_outlets').select('id', { count: 'exact', head: true });
    console.log(`  Verified in DB: ${count} rows`);
}

async function main() {
    const tableOk = await createTable();
    if (!tableOk) {
        console.log('\n⚠️  Table creation failed. Trying import anyway...');
    }
    await importData();
}

main().catch(console.error);

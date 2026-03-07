// ============================================================
// Import Media Outlets CSV into Supabase
// Usage: node database/import-media-outlets.js
// ============================================================

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config.js';

const db = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// Parse CSV with proper quote handling
function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (ch === '"' && next === '"') {
                field += '"';
                i++; // skip escaped quote
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                field += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                row.push(field.trim());
                field = '';
            } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
                row.push(field.trim());
                if (row.some(f => f.length > 0)) rows.push(row);
                row = [];
                field = '';
                if (ch === '\r') i++; // skip \n after \r
            } else {
                field += ch;
            }
        }
    }
    // Last row
    if (field.length > 0 || row.length > 0) {
        row.push(field.trim());
        if (row.some(f => f.length > 0)) rows.push(row);
    }

    return rows;
}

// Map factual_reliability to numeric score
function reliabilityScore(rating) {
    const map = {
        'high': 1.0,
        'generally reliable': 0.8,
        'mixed': 0.5,
        'low': 0.3,
        'very low': 0.1,
        'in flux': 0.5,
        'n/a for hard news': 0.3,
        'factual (official)': 0.7,
        'mixed (pro-govt slant)': 0.4,
        'mixed (sensationalist)': 0.3,
        'mixed (pro-govt propaganda)': 0.3,
        'mixed (partisan)': 0.3,
        'mixed (activist)': 0.4,
    };
    if (!rating) return 0.5;
    const lower = rating.toLowerCase().trim();
    return map[lower] ?? 0.5;
}

// Check if domain looks like a valid URL
function isScrapeable(domain) {
    if (!domain) return false;
    // Skip broadcast-only, print-only, social media descriptions
    if (domain.includes('(') || domain.includes('Broadcast') || domain.includes('Print')) return false;
    // Must contain a dot (domain-like)
    return domain.includes('.');
}

async function main() {
    console.log('Reading CSV...');
    const raw = fs.readFileSync('database/media-outlets-raw.csv', 'utf-8');
    const allRows = parseCSV(raw);
    console.log(`Parsed ${allRows.length} rows`);

    // Expected header columns
    const HEADER_KEYS = [
        'country_id', 'country_name', 'outlet_id', 'outlet_name', 'primary_domain',
        'format', 'ownership_type', 'political_alignment', 'factual_reliability',
        'primary_audience', 'language_primary', 'established_year', 'last_updated',
        'verified_by', 'notes', 'tags_economic', 'tags_sociocultural', 'tags_governance',
        'tags_foreign', 'tags_other',
    ];

    // Filter data rows: must have a valid outlet_id pattern (3 uppercase letters + 3 digits)
    const outletIdRegex = /^[A-Z]{3}\d{3}$/;
    const dataRows = allRows.filter(row => {
        // Find outlet_id column — it's at index 2 in data rows
        // But some rows have it at index 0 (when no country section header)
        const possibleId = row[2] || row[0];
        return outletIdRegex.test(possibleId);
    });

    console.log(`Found ${dataRows.length} outlet records`);

    const outlets = [];
    for (const row of dataRows) {
        // Determine if outlet_id is at index 2 (standard) or index 0
        let offset = 0;
        if (outletIdRegex.test(row[2])) offset = 0;
        else if (outletIdRegex.test(row[0])) offset = -2;
        else continue;

        const get = (idx) => (row[idx + offset] || '').trim();

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

        // Skip if no outlet_name
        if (!record.outlet_name || record.outlet_name === 'outlet_name') continue;
        outlets.push(record);
    }

    console.log(`Prepared ${outlets.length} outlets for import`);

    // Show country distribution
    const countries = {};
    outlets.forEach(o => { countries[o.country_id] = (countries[o.country_id] || 0) + 1; });
    console.log(`Countries: ${Object.keys(countries).length}`);
    Object.entries(countries).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
        console.log(`  ${k}: ${v} outlets`);
    });

    // Reliability distribution
    const reliabilities = {};
    outlets.forEach(o => { reliabilities[o.factual_reliability || 'N/A'] = (reliabilities[o.factual_reliability || 'N/A'] || 0) + 1; });
    console.log('\nReliability distribution:');
    Object.entries(reliabilities).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
        console.log(`  ${k}: ${v}`);
    });

    // Scrapeable count
    const scrapeable = outlets.filter(o => o.is_scrapeable);
    console.log(`\nScrapeable outlets (valid domain): ${scrapeable.length}/${outlets.length}`);

    // Create table first
    console.log('\nCreating media_outlets table...');
    const migrationSQL = fs.readFileSync('database/migration-006-media-outlets.sql', 'utf-8');
    const { error: migErr } = await db.rpc('exec_sql', { sql: migrationSQL }).catch(() => ({ error: 'rpc not available' }));

    // Try direct REST API approach for schema creation
    const SUPA_URL = config.supabaseUrl;
    const SUPA_KEY = config.supabaseServiceKey;
    const headers = {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    };

    // Check if table exists by trying a select
    const checkRes = await fetch(`${SUPA_URL}/rest/v1/media_outlets?limit=1`, { headers });
    if (!checkRes.ok) {
        console.log('Table does not exist yet. Please run the migration SQL manually:');
        console.log('  psql or Supabase SQL Editor: database/migration-006-media-outlets.sql');
        console.log('Then re-run this script.');
        // Try to create via Supabase SQL API
        const sqlRes = await fetch(`${SUPA_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ sql: migrationSQL }),
        });
        if (sqlRes.ok) {
            console.log('Table created via RPC!');
        } else {
            console.log('Will try to insert anyway (table may have been created externally)...');
        }
    } else {
        console.log('Table exists, clearing old data...');
        await fetch(`${SUPA_URL}/rest/v1/media_outlets?id=not.is.null`, {
            method: 'DELETE',
            headers: { ...headers, 'Prefer': 'return=minimal' },
        });
    }

    // Insert in batches of 50
    let inserted = 0;
    let errors = 0;
    for (let i = 0; i < outlets.length; i += 50) {
        const batch = outlets.slice(i, i + 50);
        const res = await fetch(`${SUPA_URL}/rest/v1/media_outlets`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=minimal,resolution=merge-duplicates' },
            body: JSON.stringify(batch),
        });
        if (res.ok) {
            inserted += batch.length;
            process.stdout.write(`\rInserted: ${inserted}/${outlets.length}`);
        } else {
            const err = await res.text();
            console.error(`\nBatch error at ${i}: ${err.substring(0, 200)}`);
            errors++;
            // Try one by one for failed batch
            for (const outlet of batch) {
                const singleRes = await fetch(`${SUPA_URL}/rest/v1/media_outlets`, {
                    method: 'POST',
                    headers: { ...headers, 'Prefer': 'return=minimal,resolution=merge-duplicates' },
                    body: JSON.stringify(outlet),
                });
                if (singleRes.ok) {
                    inserted++;
                } else {
                    const sErr = await singleRes.text();
                    console.error(`  Failed: ${outlet.outlet_id} ${outlet.outlet_name} — ${sErr.substring(0, 100)}`);
                }
            }
        }
    }

    console.log(`\n\nDone! Inserted ${inserted} outlets, ${errors} batch errors.`);
}

main().catch(console.error);

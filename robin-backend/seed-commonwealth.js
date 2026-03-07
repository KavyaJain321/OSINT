// ==============================================================
// ROBIN OSINT — Commonwealth Countries Client Setup
// Creates: Client → Auth User → DB User → Sources from Excel
// Reads sources from: OSI Perspectives.xlsx (Sheet1)
// ==============================================================

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'fs';

// xlsx is CommonJS — use createRequire for ES module compat
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

// ─────────────────────────────────────────────────────────────
// 1. CLIENT CONFIGURATION
// ─────────────────────────────────────────────────────────────
const COMMONWEALTH_CLIENT = {
    name: 'Commonwealth Countries',
    industry: 'International Relations & Governance',
};

const ADMIN_EMAIL = 'commonwealth@robin.ai';
const ADMIN_PASSWORD = 'Commonwealth123!';

// ─────────────────────────────────────────────────────────────
// 2. EXCEL SOURCE PARSING
// ─────────────────────────────────────────────────────────────
function parseExcelSources(filePath) {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets['Sheet1'];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const sources = [];
    const seen = new Set();

    for (let r = 1; r < raw.length; r++) {
        const row = raw[r];
        const country = String(row[1] || '').trim();
        const outletName = String(row[3] || '').trim();
        const domain = String(row[4] || '').trim();
        const format = String(row[5] || '').trim().toLowerCase();

        // Skip header rows that repeat within the sheet and empty rows
        if (!domain || domain === 'primary_domain' || !outletName || outletName === 'outlet_name') continue;
        if (seen.has(domain)) continue;
        seen.add(domain);

        // Determine source type from format or domain
        let sourceType = 'html';
        if (format.includes('rss') || domain.includes('rss') || domain.includes('feed')) {
            sourceType = 'rss';
        } else if (format.includes('youtube') || domain.includes('youtube.com')) {
            sourceType = 'youtube';
        } else if (format.includes('pdf')) {
            sourceType = 'pdf';
        }

        // Build full URL from domain
        let url = domain;
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }
        // Ensure trailing slash for root domains
        if (url.match(/^https?:\/\/[^\/]+$/)) {
            url += '/';
        }

        sources.push({
            name: outletName,
            url,
            source_type: sourceType,
            country,
            is_mandatory: true,
        });
    }

    return sources;
}

// ─────────────────────────────────────────────────────────────
// MAIN SETUP
// ─────────────────────────────────────────────────────────────
async function main() {
    const results = {
        client_id: null,
        admin_user: null,
        sources_added: 0,
        sources_total: 0,
        countries: [],
        errors: [],
    };

    // ── Parse Excel ──
    const excelPath = 'c:\\Users\\Jain\\Downloads\\OSINT\\OSI Perspectives.xlsx';
    log(`Parsing Excel file: ${excelPath}`);

    let sources;
    try {
        sources = parseExcelSources(excelPath);
        results.sources_total = sources.length;
        const countries = [...new Set(sources.map(s => s.country).filter(Boolean))];
        results.countries = countries;
        log(`✅ Parsed ${sources.length} unique sources across ${countries.length} countries`);
    } catch (e) {
        log(`FATAL: Failed to parse Excel: ${e.message}`);
        return;
    }

    // ── Step 1: Create Client ──
    log('STEP 1: Creating Commonwealth Countries client...');
    const { data: client, error: clientErr } = await supabase
        .from('clients')
        .insert(COMMONWEALTH_CLIENT)
        .select()
        .single();

    if (clientErr) {
        log(`ERROR creating client: ${clientErr.message}`);
        results.errors.push({ step: 'create_client', error: clientErr.message });
        fs.writeFileSync('commonwealth-setup-results.json', JSON.stringify(results, null, 2));
        return;
    }

    results.client_id = client.id;
    log(`✅ Client created: ${client.name} (ID: ${client.id})`);

    // ── Step 2: Create Admin Auth User ──
    log('STEP 2: Creating admin auth user...');
    const { data: adminAuth, error: adminAuthErr } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
            client_id: client.id,
            role: 'ADMIN',
            full_name: 'Commonwealth Admin',
        },
    });

    if (adminAuthErr) {
        log(`ERROR creating admin auth: ${adminAuthErr.message}`);
        results.errors.push({ step: 'create_admin_auth', error: adminAuthErr.message });
    } else {
        const adminAuthId = adminAuth.user.id;
        // Insert into users table
        const { error: adminUserErr } = await supabase.from('users').insert({
            id: adminAuthId,
            email: ADMIN_EMAIL,
            full_name: 'Commonwealth Admin',
            role: 'ADMIN',
            client_id: client.id,
        });

        if (adminUserErr) {
            log(`WARN: admin users row: ${adminUserErr.message}`);
            results.errors.push({ step: 'admin_users_row', error: adminUserErr.message });
        }

        results.admin_user = { id: adminAuthId, email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
        log(`✅ Admin user created: ${ADMIN_EMAIL} (ID: ${adminAuthId})`);
    }

    // ── Step 3: Insert Active Sources (mandatory, for scraper) ──
    log(`STEP 3: Inserting ${sources.length} mandatory sources into sources table...`);
    let srcAdded = 0;
    let srcFailed = 0;

    // Insert in batches of 50 to avoid timeout
    const BATCH_SIZE = 50;
    for (let i = 0; i < sources.length; i += BATCH_SIZE) {
        const batch = sources.slice(i, i + BATCH_SIZE).map(s => ({
            client_id: client.id,
            name: s.name,
            url: s.url,
            source_type: s.source_type,
            is_active: true,
        }));

        const { data: inserted, error: batchErr } = await supabase
            .from('sources')
            .insert(batch)
            .select('id');

        if (batchErr) {
            log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${batchErr.message}`);
            // Fall back to individual inserts for this batch
            for (const s of batch) {
                const { error: srcErr } = await supabase.from('sources').insert(s);
                if (srcErr) {
                    if (!srcErr.message.includes('duplicate') && !srcErr.message.includes('unique')) {
                        results.errors.push({ step: 'insert_source', url: s.url, error: srcErr.message });
                    }
                    srcFailed++;
                } else {
                    srcAdded++;
                }
            }
        } else {
            srcAdded += (inserted || []).length;
            log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${(inserted || []).length} sources inserted`);
        }
    }

    results.sources_added = srcAdded;
    log(`✅ ${srcAdded}/${sources.length} sources added (${srcFailed} failed)`);

    // ── Step 4: Write summary ──
    log('\n========================================');
    log('  COMMONWEALTH COUNTRIES — SETUP COMPLETE');
    log('========================================');
    log(`  Client ID  : ${results.client_id}`);
    log(`  Admin Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    log(`  Sources    : ${results.sources_added}/${results.sources_total}`);
    log(`  Countries  : ${results.countries.length}`);
    log(`  Errors     : ${results.errors.length}`);
    if (results.errors.length > 0) {
        log('\n  ERRORS:');
        results.errors.forEach(e => log(`    - [${e.step}] ${e.error}`));
    }
    log('\n  Country list: ' + results.countries.join(', '));

    fs.writeFileSync('commonwealth-setup-results.json', JSON.stringify(results, null, 2));
    log('\n  Full results saved to: commonwealth-setup-results.json');
    log('\n  NEXT: Login at http://localhost:3000 with');
    log(`        Email:    ${ADMIN_EMAIL}`);
    log(`        Password: ${ADMIN_PASSWORD}`);
    log('        Then create an Intelligence Brief about Commonwealth topics.');
    log('        The system will use these 556 mandatory sources + auto-discover more.');
}

main().catch(e => {
    console.error('FATAL:', e.message);
    process.exit(1);
});

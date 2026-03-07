// Migration: Add title_hash and cross_source_duplicate_of columns to articles table
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrate() {
    // Try inserting a test row with the new columns to see if they exist
    // If columns don't exist, we'll use the workaround of inserting via the API

    // Step 1: Check current columns
    const { data: sample } = await sb.from('articles').select('*').limit(1);
    const existingCols = sample && sample.length > 0 ? Object.keys(sample[0]) : [];
    console.log('Existing columns:', existingCols.join(', '));

    const hasTitleHash = existingCols.includes('title_hash');
    const hasCrossDup = existingCols.includes('cross_source_duplicate_of');

    console.log('title_hash exists:', hasTitleHash);
    console.log('cross_source_duplicate_of exists:', hasCrossDup);

    if (hasTitleHash && hasCrossDup) {
        console.log('All columns already exist. No migration needed.');
        return;
    }

    console.log('\nPlease run the following SQL in the Supabase SQL Editor:');
    console.log('='.repeat(60));
    if (!hasTitleHash) {
        console.log('ALTER TABLE articles ADD COLUMN title_hash TEXT;');
        console.log('CREATE INDEX idx_articles_title_hash ON articles(title_hash);');
    }
    if (!hasCrossDup) {
        console.log('ALTER TABLE articles ADD COLUMN cross_source_duplicate_of UUID REFERENCES articles(id) ON DELETE SET NULL;');
    }
    console.log('='.repeat(60));
}

migrate().catch(console.error);

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Check if chat_history table exists by trying to select
const { data, error } = await supabase.from('chat_history').select('id').limit(1);

if (error && error.message.includes('does not exist')) {
    console.log('Table does not exist. Creating via SQL migration...');

    // Use Supabase REST API to execute SQL
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const sql = `
        CREATE TABLE IF NOT EXISTS chat_history (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            client_id UUID REFERENCES clients(id),
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            referenced_article_ids UUID[] DEFAULT '{}',
            model_used VARCHAR(100) DEFAULT 'llama-3.3-70b-versatile',
            tokens_used INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_chat_history_client ON chat_history(client_id);
        CREATE INDEX IF NOT EXISTS idx_chat_history_created ON chat_history(created_at DESC);
    `;

    // Use the Supabase SQL endpoint
    const resp = await fetch(`${url}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ query: sql })
    });
    console.log('SQL via RPC status:', resp.status);
    if (resp.status !== 200) {
        console.log('RPC not available. Please run this SQL in Supabase SQL Editor:');
        console.log(sql);
    }
} else if (error) {
    console.log('Error checking table:', error.message);
    console.log('Table likely does not exist. Please run this SQL in Supabase SQL Editor:');
    console.log(`
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES clients(id),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    referenced_article_ids UUID[] DEFAULT '{}',
    model_used VARCHAR(100) DEFAULT 'llama-3.3-70b-versatile',
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_history_client ON chat_history(client_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created ON chat_history(created_at DESC);
    `);
} else {
    console.log('chat_history table EXISTS. Rows:', data?.length ?? 0);

    // Test insert
    const testClient = await supabase.from('clients').select('id').limit(1).single();
    if (testClient.data) {
        const { error: insertErr } = await supabase.from('chat_history').insert({
            client_id: testClient.data.id,
            question: '__connection_test__',
            answer: '__connection_test__',
            referenced_article_ids: [],
        });
        console.log('Insert test:', insertErr ? 'FAIL: ' + insertErr.message : 'OK');
        await supabase.from('chat_history').delete().eq('question', '__connection_test__');
        console.log('Cleanup done');
    }
}

// Run from robin-backend directory: node seed-client.js
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seed() {
    // Check if a client already exists
    const { data: existing } = await supabase.from('clients').select('id, name').limit(1).single();
    if (existing) {
        console.log('Client already exists:', JSON.stringify(existing));
        return;
    }

    // Create a test client
    const { data: client, error } = await supabase
        .from('clients')
        .insert({
            name: 'ROBIN Test Client',
            industry: 'Intelligence & Security',
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating client:', error.message);
        return;
    }

    console.log('Test client created:', JSON.stringify(client));

    // Also ensure system_state has scraper_running key
    const { error: stateErr } = await supabase
        .from('system_state')
        .upsert({ key: 'scraper_running', value: 'false' }, { onConflict: 'key' });

    if (stateErr) console.warn('system_state upsert note:', stateErr.message);
    else console.log('system_state initialized');
}

seed().catch(console.error);

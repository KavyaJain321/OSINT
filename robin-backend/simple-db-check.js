// simple-db-check.js
import { createClient } from '@supabase/supabase-js';
import { config } from './src/config.js';
import fs from 'fs';

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const CLIENT_ID = '7b5390a0-0d5b-419e-84b4-533fd9c44d36';

const { data: filtered, error: e1 } = await supabase
    .from('client_briefs')
    .select('id, title, client_id, status')
    .eq('client_id', CLIENT_ID);

const { data: all, error: e2 } = await supabase
    .from('client_briefs')
    .select('id, title, client_id, status');

const result = {
    filtered: { data: filtered, error: e1?.message },
    all: { data: all, error: e2?.message }
};

fs.writeFileSync('db-check-result.json', JSON.stringify(result, null, 2));
console.log('Written to db-check-result.json');
console.log('Filtered count:', filtered?.length);
console.log('All count:', all?.length);

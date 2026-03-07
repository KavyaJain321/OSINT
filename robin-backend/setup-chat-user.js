import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 1. Get the auth user
const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1 });
const authUser = authData?.users?.[0];
if (!authUser) { console.error('No auth user found!'); process.exit(1); }
console.log('Auth user:', authUser.id, authUser.email);

// 2. Get the client
const { data: client } = await supabase.from('clients').select('id, name').limit(1).single();
if (!client) { console.error('No client found!'); process.exit(1); }
console.log('Client:', client.id, client.name);

// 3. Create user row in public.users table
const { data: userRow, error: userErr } = await supabase.from('users').upsert({
    id: authUser.id,
    email: authUser.email || 'system@robin-osint.dev',
    full_name: 'ROBIN System',
    role: 'ADMIN',
    client_id: client.id,
}, { onConflict: 'id' }).select().single();

if (userErr) {
    console.error('Failed to create user:', userErr.message);
    process.exit(1);
}
console.log('User row created:', userRow.id, userRow.email);

// 4. Test chat_history insert
const { data: chatRow, error: chatErr } = await supabase.from('chat_history').insert({
    user_id: userRow.id,
    client_id: client.id,
    question: '__system_test__',
    answer: 'Chat history persistence is working.',
    articles_referenced: [],
}).select().single();

if (chatErr) {
    console.error('Chat insert failed:', chatErr.message);
} else {
    console.log('Chat insert SUCCESS! Columns:', Object.keys(chatRow).join(', '));
    console.log('Row:', JSON.stringify(chatRow, null, 2));
    // Clean up test row
    await supabase.from('chat_history').delete().eq('id', chatRow.id);
    console.log('Test row cleaned up');
}

console.log('\n=== SYSTEM USER ID ===');
console.log(userRow.id);
console.log('Use this as the default user_id in chat-rag.js');

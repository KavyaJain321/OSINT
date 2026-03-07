// ============================================================
// ROBIN OSINT — Supabase Client (Singleton)
// Backend always uses SERVICE ROLE KEY. Never expose to frontend.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
    global: {
        headers: {
            'apikey': config.supabaseServiceKey,
            'Authorization': `Bearer ${config.supabaseServiceKey}`,
        },
    },
    db: {
        schema: 'public',
    },
});

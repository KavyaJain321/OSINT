import 'dotenv/config';
import { runBatchIntelligence } from './src/ai/batch-intelligence.js';

console.log('Running batch intelligence...');
try {
    await runBatchIntelligence();
    console.log('Done!');
} catch(e) {
    console.log('Error:', e.message);
}

// Now check signals
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: signals } = await supabase.from('intelligence_signals')
    .select('signal_type, confidence, title, severity')
    .order('created_at', { ascending: false })
    .limit(20);

console.log('\n=== SIGNAL CONFIDENCE SCORES ===\n');
const confidences = new Set();
for (const s of signals || []) {
    const conf = s.confidence ?? 'null';
    confidences.add(typeof conf === 'number' ? conf : 0);
    console.log('  [' + String(conf).padStart(4) + '] ' + s.severity.padEnd(8) + ' ' + s.signal_type.padEnd(26) + s.title.substring(0, 55));
}

const values = [...confidences].filter(v => typeof v === 'number');
if (values.length > 0) {
    console.log('\n=== SUMMARY ===');
    console.log('Unique confidence values:', values.length);
    console.log('Range:', Math.min(...values).toFixed(2), '—', Math.max(...values).toFixed(2));
    console.log('Spread:', (Math.max(...values) - Math.min(...values)).toFixed(2));
    console.log('All 0.85?', values.every(v => v === 0.85) ? 'YES (FAIL)' : 'NO (PASS)');
} else {
    console.log('No signals found');
}

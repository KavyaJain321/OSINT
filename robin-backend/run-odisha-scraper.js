// run-odisha-scraper.js — trigger scraper for Odisha client only
import { supabase } from './src/lib/supabase.js';
import { runScraperCycle } from './src/scrapers/orchestrator.js';

const ODISHA_CLIENT_ID = '7b5390a0-0d5b-419e-84b4-533fd9c44d36';

// Verify sources exist
const { data: sources } = await supabase
    .from('sources')
    .select('id, name, source_type, is_active')
    .eq('client_id', ODISHA_CLIENT_ID)
    .eq('is_active', true);

console.log(`Found ${sources?.length ?? 0} active sources for Odisha client`);
console.log('Sample sources:', sources?.slice(0, 3).map(s => s.name));

// Release any stuck scraper lock first
await supabase.from('system_state').upsert({
    key: 'scraper_running',
    value: 'false',
    updated_at: new Date().toISOString(),
});
console.log('Scraper lock released. Starting scrape cycle...');

// Run scraper
await runScraperCycle();
console.log('Scrape cycle completed!');

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { runScraperCycle } from './src/scrapers/orchestrator.js';
import { log } from './src/lib/logger.js';

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugBackend() {
    console.log("==========================================");
    console.log("       ROBIN BACKEND DEBUG SCRIPT         ");
    console.log("==========================================");

    // 1. Force release any stuck locks so the scraper is guaranteed to try running
    console.log("\n[1] Checking and releasing any stuck scraper locks...");
    await supabase.from('system_state').upsert({
        key: 'scraper_running',
        value: 'false',
        updated_at: new Date().toISOString()
    });
    console.log("✅ Scraper lock released.");

    // 2. Override the logger to force ALL logs (especially errors) to print to the console
    console.log("\n[2] Overriding internal loggers to capture all errors to console...");
    const originalErrorLog = log.scraper.error;
    const originalWarnLog = log.scraper.warn;

    log.scraper.error = (msg, meta) => {
        console.error("❌ [SCRAPER ERROR]:", msg);
        if (meta) console.error("   Details:", JSON.stringify(meta, null, 2));
        originalErrorLog.call(log.scraper, msg, meta);
    };

    log.scraper.warn = (msg, meta) => {
        console.warn("⚠️ [SCRAPER WARN]:", msg);
        if (meta) console.warn("   Details:", JSON.stringify(meta, null, 2));
        originalWarnLog.call(log.scraper, msg, meta);
    };

    log.ai.error = (msg, meta) => {
        console.error("❌ [AI ERROR]:", msg);
        if (meta) console.error("   Details:", JSON.stringify(meta, null, 2));
    };

    // 3. Run the scraper cycle within a massive try/catch
    console.log("\n[3] Starting manual scraper cycle...\n");
    try {
        await runScraperCycle();
        console.log("\n✅ [SUCCESS] Scraper cycle completed normally.");
    } catch (e) {
        console.error("\n❌❌ [FATAL ERROR] The scraper crashed completely ❌❌");
        console.error(e);
        console.error(e.stack);
    }
}

// Execute the debugger
debugBackend().then(() => {
    console.log("\nDebug script finished. You can press Ctrl+C to exit.");
}).catch(e => {
    console.error("Critical failure running debug script:", e);
});

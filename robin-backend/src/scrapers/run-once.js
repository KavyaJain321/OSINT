// ============================================================
// ROBIN OSINT — Manual Scraper Runner
// Usage: node src/scrapers/run-once.js
// ============================================================

import '../config.js';
import { runScraperCycle } from './orchestrator.js';
import { log } from '../lib/logger.js';

log.scraper.info('Starting manual scraper run...');

runScraperCycle()
    .then(() => {
        log.scraper.info('Manual scraper run complete');
        process.exit(0);
    })
    .catch((error) => {
        log.scraper.error('Manual scraper run failed', { error: error.message });
        process.exit(1);
    });

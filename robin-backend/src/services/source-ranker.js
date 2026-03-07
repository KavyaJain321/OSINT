// ============================================================
// Source Ranker — Updates source_reliability scores post-scrape
// Tracks hit rate, uniqueness, and reliability per source
// Flags degraded sources and marks premium ones
// ============================================================

import { supabase } from '../lib/supabase.js';
import { log } from '../lib/logger.js';

const DEGRADED_THRESHOLD = 0.08;  // below this reliability = degraded
const PREMIUM_UNIQUENESS = 0.75;  // above this uniqueness = premium
const CYCLES_FOR_DEGRADED = 3;     // consecutive low-performance cycles

/**
 * Update source reliability scores after a scrape cycle.
 * Called by the orchestrator after processing each source.
 *
 * @param {string} sourceId
 * @param {string} clientId
 * @param {Object} scrapeResult - { fetched, matched, errors, duration_ms }
 */
export async function updateSourceReliability(sourceId, clientId, scrapeResult) {
    const { fetched = 0, matched = 0, errors = 0, duration_ms = 0 } = scrapeResult;

    try {
        // Fetch current reliability record
        const { data: current } = await supabase
            .from('source_reliability')
            .select('*')
            .eq('source_id', sourceId)
            .eq('client_id', clientId)
            .single();

        const cycleHitRate = fetched > 0 ? matched / fetched : 0;
        const cycleErrorRate = errors > 0 ? 1 : 0;

        // Running averages (exponential moving average, alpha=0.3)
        const alpha = 0.3;
        const prevHitRate = current?.hit_rate ?? cycleHitRate;
        const prevErrorRate = current?.error_rate ?? cycleErrorRate;
        const prevReliability = current?.reliability_score ?? 0.5;
        const articleCount = (current?.article_count ?? 0) + matched;

        const newHitRate = alpha * cycleHitRate + (1 - alpha) * prevHitRate;
        const newErrorRate = alpha * cycleErrorRate + (1 - alpha) * prevErrorRate;

        // Reliability = weighted combo of hit rate, error rate, and stability
        const newReliability = ((newHitRate * 0.5) + ((1 - newErrorRate) * 0.5));
        const degradedCycles = newReliability < DEGRADED_THRESHOLD
            ? (current?.degraded_cycles ?? 0) + 1
            : 0;

        // Determine health status
        let status = 'healthy';
        if (degradedCycles >= CYCLES_FOR_DEGRADED) status = 'degraded';
        else if (newHitRate > PREMIUM_UNIQUENESS) status = 'premium';
        else if (newReliability < DEGRADED_THRESHOLD) status = 'watch';

        const updates = {
            source_id: sourceId,
            client_id: clientId,
            hit_rate: parseFloat(newHitRate.toFixed(4)),
            error_rate: parseFloat(newErrorRate.toFixed(4)),
            reliability_score: parseFloat(newReliability.toFixed(4)),
            article_count: articleCount,
            degraded_cycles: degradedCycles,
            status,
            last_checked: new Date().toISOString(),
        };

        await supabase.from('source_reliability').upsert(updates, { onConflict: 'source_id,client_id' });

        if (status === 'degraded') {
            log.scraper.warn('Source marked degraded', { sourceId, reliability: newReliability.toFixed(3), cycles: degradedCycles });
        }

        return { status, reliability: newReliability, hitRate: newHitRate };
    } catch (err) {
        log.scraper.error('Source reliability update failed', { sourceId, error: err.message });
    }
}

/**
 * Get ranked list of sources by reliability for a client.
 * Used in admin dashboard and source quality endpoint.
 *
 * @param {string} clientId
 * @returns {Promise<Array>}
 */
export async function getSourceQualityReport(clientId) {
    const { data, error } = await supabase
        .from('source_reliability')
        .select('*, sources!inner(name, url, source_type, is_active)')
        .eq('client_id', clientId)
        .order('reliability_score', { ascending: false });

    if (error) throw error;
    return (data || []).map(r => ({
        source_id: r.source_id,
        name: r.sources?.name,
        url: r.sources?.url,
        type: r.sources?.source_type,
        is_active: r.sources?.is_active,
        reliability: r.reliability_score,
        hit_rate: r.hit_rate,
        error_rate: r.error_rate,
        status: r.status,
        article_count: r.article_count,
        last_checked: r.last_checked,
    }));
}

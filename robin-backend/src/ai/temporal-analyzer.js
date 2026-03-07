// ============================================================
// Temporal Analyzer — 5-analysis engine running post-scrape
// Detects velocity spikes, sentiment drift, source divergence,
// silence anomalies, and entity emergence from article time series
// ============================================================

import { supabase } from '../lib/supabase.js';
import { log } from '../lib/logger.js';

const WINDOW_2H = 2 * 60 * 60 * 1000;
const WINDOW_48H = 48 * 60 * 60 * 1000;
const WINDOW_7D = 7 * 24 * 60 * 60 * 1000;

// ── Helpers ────────────────────────────────────────────────

function avgSentiment(articles) {
    const map = { positive: 1, neutral: 0, negative: -1 };
    if (!articles.length) return 0;
    return articles.reduce((sum, a) => sum + (map[a.sentiment] ?? 0), 0) / articles.length;
}

async function savePattern(clientId, type, title, description, evidence, confidence, severity, entities) {
    const expires = new Date(Date.now() + WINDOW_7D).toISOString(); // patterns expire in 7d
    const { error } = await supabase.from('intelligence_patterns').insert({
        client_id: clientId,
        pattern_type: type,
        title,
        description,
        evidence: evidence || [],
        confidence,
        severity,
        entities_involved: entities || [],
        expires_at: expires,
    });
    if (error) log.ai.warn('Pattern save error', { error: error.message, type });
}

// ── Analysis 1: Velocity Tracking ─────────────────────────
// Compares keyword/entity article volume in current 48h vs prior 48h
async function analyzeVelocity(clientId, keywords) {
    const now = Date.now();
    const cur_end = new Date(now).toISOString();
    const cur_start = new Date(now - WINDOW_48H).toISOString();
    const prv_start = new Date(now - 2 * WINDOW_48H).toISOString();

    let detected = 0;
    for (const kw of keywords.slice(0, 20)) { // cap at 20 to avoid rate limits
        const [curRes, prvRes] = await Promise.all([
            supabase.from('articles')
                .select('id', { count: 'exact', head: true })
                .eq('client_id', clientId)
                .contains('matched_keywords', [kw.keyword])
                .gte('published_at', cur_start).lte('published_at', cur_end),
            supabase.from('articles')
                .select('id', { count: 'exact', head: true })
                .eq('client_id', clientId)
                .contains('matched_keywords', [kw.keyword])
                .gte('published_at', prv_start).lt('published_at', cur_start),
        ]);

        const cur = curRes.count || 0;
        const prv = prvRes.count || 0;

        // Velocity spike: 2x increase and at least 3 articles
        if (prv > 0 && cur >= prv * 2 && cur >= 3) {
            const velocity = ((cur - prv) / prv * 100).toFixed(0);
            await savePattern(
                clientId,
                'velocity_spike',
                `Velocity spike: "${kw.keyword}" +${velocity}%`,
                `Coverage of "${kw.keyword}" doubled in the last 48 hours (${prv} → ${cur} articles), indicating accelerating media attention.`,
                [],
                Math.min(0.95, 0.6 + (cur / 20)),
                cur >= 10 ? 'high' : 'medium',
                [kw.keyword],
            );
            detected++;
        }

        // Velocity drop: 80% decrease (possible suppression)
        if (prv >= 5 && cur <= prv * 0.2) {
            await savePattern(
                clientId,
                'silence_anomaly',
                `Coverage drop: "${kw.keyword}" fell ${prv} → ${cur} articles`,
                `"${kw.keyword}" was covered heavily 48h ago but has nearly disappeared from media. This silence may indicate topic suppression, resolution, or precedes a major event.`,
                [],
                0.65,
                'medium',
                [kw.keyword],
            );
            detected++;
        }
    }

    log.ai.info('Velocity analysis complete', { clientId, keywords: keywords.length, detected });
}

// ── Analysis 2: Sentiment Drift ────────────────────────────
// Detects significant sentiment shifts for tracked entities
async function analyzeSentimentDrift(clientId, entities) {
    const now = Date.now();
    const cutoff = new Date(now - WINDOW_48H).toISOString();
    const cutoff2 = new Date(now - WINDOW_7D).toISOString();

    // article_analysis has NO client_id — must get article ids for this client first
    const [recentArtRes, olderArtRes] = await Promise.all([
        supabase.from('articles').select('id').eq('client_id', clientId).gte('published_at', cutoff).limit(500),
        supabase.from('articles').select('id').eq('client_id', clientId).gte('published_at', cutoff2).lt('published_at', cutoff).limit(500),
    ]);
    const recentIds = (recentArtRes.data || []).map(a => a.id);
    const olderIds = (olderArtRes.data || []).map(a => a.id);

    let detected = 0;
    for (const entity of entities.slice(0, 15)) {
        const name = entity.entity_name;
        if (!recentIds.length && !olderIds.length) continue;

        const [recentRes, olderRes] = await Promise.all([
            recentIds.length
                ? supabase.from('article_analysis').select('sentiment').in('article_id', recentIds).not('entities', 'is', null)
                : { data: [] },
            olderIds.length
                ? supabase.from('article_analysis').select('sentiment').in('article_id', olderIds).not('entities', 'is', null)
                : { data: [] },
        ]);

        const recentData = recentRes.data || [];
        const olderData = olderRes.data || [];

        if (recentData.length < 3 || olderData.length < 3) continue;

        const recentScore = avgSentiment(recentData);
        const olderScore = avgSentiment(olderData);
        const drift = recentScore - olderScore;

        if (Math.abs(drift) >= 0.3) {
            const dir = drift < 0 ? 'negative' : 'positive';
            const severity = Math.abs(drift) >= 0.6 ? 'high' : 'medium';

            await savePattern(
                clientId,
                'sentiment_shift',
                `Sentiment shift for "${name}": turning ${dir}`,
                `Media sentiment around "${name}" has shifted ${dir}ly by ${(Math.abs(drift) * 100).toFixed(0)}% in the last 48 hours vs the prior week. Score moved from ${olderScore.toFixed(2)} to ${recentScore.toFixed(2)}.`,
                [],
                0.75,
                severity,
                [name],
            );
            detected++;
        }
    }

    log.ai.info('Sentiment drift analysis complete', { clientId, entities: entities.length, detected });
}

// ── Analysis 3: Source Divergence ─────────────────────────
// Detects when multiple sources cover the same story with very different framing
async function analyzeSourceDivergence(clientId) {
    const since = new Date(Date.now() - WINDOW_48H).toISOString();

    // Get articles grouped by keyword overlap (rough proxy for "same story")
    const { data: articles } = await supabase
        .from('articles')
        .select('id, source_id, matched_keywords, published_at')
        .eq('client_id', clientId)
        .gte('published_at', since)
        .limit(200);

    if (!articles?.length) return;

    const { data: analyses } = await supabase
        .from('article_analysis')
        .select('article_id, sentiment, narrative_frame')
        .in('article_id', articles.map(a => a.id));

    const analysisMap = new Map((analyses || []).map(a => [a.article_id, a]));

    // Group by primary keyword
    const kwGroups = new Map();
    for (const article of articles) {
        const kws = article.matched_keywords || [];
        const key = kws[0]; // group by first keyword
        if (!key) continue;
        if (!kwGroups.has(key)) kwGroups.set(key, []);
        kwGroups.get(key).push({ ...article, analysis: analysisMap.get(article.id) });
    }

    let detected = 0;
    for (const [kw, group] of kwGroups) {
        if (group.length < 3) continue; // need at least 3 sources

        const sentiments = group
            .filter(a => a.analysis?.sentiment)
            .map(a => ({ positive: 1, neutral: 0, negative: -1 })[a.analysis.sentiment] ?? 0);

        if (sentiments.length < 3) continue;

        const max = Math.max(...sentiments);
        const min = Math.min(...sentiments);
        const spread = max - min;

        if (spread >= 1.5) { // positive AND negative in the same story
            await savePattern(
                clientId,
                'narrative_divergence',
                `Framing divergence on "${kw}" across ${group.length} sources`,
                `Multiple news sources are covering "${kw}" with opposing sentiment (spread: ${spread.toFixed(1)}). This divergence itself is intelligence — different outlets may have different information or agendas regarding this topic.`,
                group.slice(0, 3).map(a => ({ article_id: a.id, source_id: a.source_id })),
                0.80,
                'medium',
                [kw],
            );
            detected++;
        }
    }

    log.ai.info('Source divergence analysis complete', { clientId, groups: kwGroups.size, detected });
}

// ── Analysis 4: Entity Emergence ──────────────────────────
// Detects new entities entering the narrative that weren't prominent before
async function analyzeEntityEmergence(clientId, currentEntities) {
    const now = Date.now();
    const since48 = new Date(now - WINDOW_48H).toISOString();
    const since7d = new Date(now - WINDOW_7D).toISOString();

    // Compare entity_profiles: entities that appeared recently but not in older week
    const { data: recentProfiles } = await supabase
        .from('entity_profiles')
        .select('entity_name, entity_type, mention_count, first_seen')
        .eq('client_id', clientId)
        .gte('first_seen', since48)
        .gte('mention_count', 3); // only entities with meaningful volume

    for (const entity of (recentProfiles || [])) {
        await savePattern(
            clientId,
            'entity_emergence',
            `New actor: "${entity.entity_name}" entered coverage`,
            `"${entity.entity_name}" (${entity.entity_type}) has appeared ${entity.mention_count} times in the last 48 hours but was not in the narrative before. A new actor entering the story is a key intelligence signal.`,
            [],
            0.70,
            'medium',
            [entity.entity_name],
        );
    }

    if ((recentProfiles || []).length > 0) {
        log.ai.info('Entity emergence detected', { clientId, count: recentProfiles.length });
    }
}

// ── Analysis 5: Silence Anomaly ───────────────────────────
// Detects when coverage of a previously active keyword suddenly drops 80%+
// This is one of the most valuable OSINT signals: sudden silence is often
// more meaningful than a surge (topic suppression, resolution, or editorial shift)
async function analyzeSilenceAnomaly(clientId, keywords) {
    const now = Date.now();
    const cutoff48h = new Date(now - WINDOW_48H);
    const cutoff96h = new Date(now - WINDOW_48H * 2);

    // Fetch articles from last 96 hours for comparison
    const { data: articles } = await supabase
        .from('articles')
        .select('id, title, published_at, matched_keywords')
        .eq('client_id', clientId)
        .gte('published_at', cutoff96h.toISOString())
        .order('published_at', { ascending: false })
        .limit(1000);

    if (!articles || articles.length === 0) return;

    const watchKeywords = keywords.map(k => k.keyword || k);
    let patternsFound = 0;

    for (const keyword of watchKeywords) {
        const kw = keyword.toLowerCase();

        // Count articles mentioning this keyword in the prior window (48-96h ago)
        const priorArticles = articles.filter(a => {
            const pub = new Date(a.published_at);
            return pub >= cutoff96h && pub < cutoff48h &&
                (a.title?.toLowerCase().includes(kw) ||
                    (a.matched_keywords || []).some(mk => mk.toLowerCase().includes(kw)));
        });

        // Count articles in the recent window (last 48h)
        const recentArticles = articles.filter(a => {
            const pub = new Date(a.published_at);
            return pub >= cutoff48h &&
                (a.title?.toLowerCase().includes(kw) ||
                    (a.matched_keywords || []).some(mk => mk.toLowerCase().includes(kw)));
        });

        // Complete silence: was active, now zero
        if (priorArticles.length >= 3 && recentArticles.length === 0) {
            await savePattern(
                clientId,
                'silence_anomaly',
                `Coverage silence: "${keyword}"`,
                `Topic "${keyword}" had ${priorArticles.length} articles in the prior 48h window but ZERO articles in the last 48h. Possible suppression, resolution, or coordinated editorial shift.`,
                priorArticles.slice(0, 5).map(a => a.id),
                Math.min(0.5 + (priorArticles.length * 0.05), 0.9),
                priorArticles.length >= 8 ? 'high' : 'medium',
                [keyword],
            );
            patternsFound++;
        }
        // Partial silence: 80%+ drop but not complete
        else if (priorArticles.length >= 5 && recentArticles.length > 0) {
            const dropPercent = 1 - (recentArticles.length / priorArticles.length);
            if (dropPercent >= 0.8) {
                await savePattern(
                    clientId,
                    'silence_anomaly',
                    `Coverage drop: "${keyword}" (-${Math.round(dropPercent * 100)}%)`,
                    `Topic "${keyword}" coverage dropped from ${priorArticles.length} to ${recentArticles.length} articles (-${Math.round(dropPercent * 100)}%). Significant coverage reduction detected.`,
                    [...priorArticles.slice(0, 3), ...recentArticles.slice(0, 2)].map(a => a.id),
                    0.6,
                    'medium',
                    [keyword],
                );
                patternsFound++;
            }
        }
    }

    if (patternsFound > 0) {
        log.ai.info('[TEMPORAL] Silence anomaly detected', { clientId, patterns: patternsFound });
    }
}

// ── Public API ─────────────────────────────────────────────

/**
 * Run all temporal analyses for a client after a scrape cycle.
 * Called by the orchestrator after each successful scrape run.
 *
 * @param {string} clientId
 */
export async function runTemporalAnalysis(clientId) {
    const startTime = Date.now();
    log.ai.info('Temporal analysis starting', { clientId });

    try {
        // Expire old patterns first
        await supabase.from('intelligence_patterns')
            .delete()
            .eq('client_id', clientId)
            .lt('expires_at', new Date().toISOString());

        // Fetch keywords and entities for this client in parallel
        // Get active brief for keywords
        const { data: activeBrief } = await supabase.from('client_briefs')
            .select('id').eq('client_id', clientId).eq('status', 'active').limit(1).single();
        const [kwRes, entityRes] = await Promise.all([
            activeBrief
                ? supabase.from('brief_generated_keywords').select('keyword, category').eq('brief_id', activeBrief.id)
                : { data: [] },
            supabase.from('entity_profiles').select('entity_name, entity_type, influence_score').eq('client_id', clientId).order('influence_score', { ascending: false }).limit(30),
        ]);

        const keywords = kwRes.data || [];
        const entities = entityRes.data || [];

        // Run all 5 analyses
        await analyzeVelocity(clientId, keywords);
        await analyzeSentimentDrift(clientId, entities);
        await analyzeSourceDivergence(clientId);
        await analyzeEntityEmergence(clientId, entities);
        await analyzeSilenceAnomaly(clientId, keywords);

        log.ai.info('Temporal analysis complete (5 passes)', { clientId, ms: Date.now() - startTime });
    } catch (err) {
        log.ai.error('Temporal analysis failed', { clientId, error: err.message });
    }
}

// ============================================================
// Competitive Analyzer — Weekly benchmark of client vs competitors
// Compares sentiment, coverage volume, and top themes
// Runs weekly (not every cycle) for token efficiency
// ============================================================

import Groq from 'groq-sdk';
import { supabase } from '../lib/supabase.js';
import { config } from '../config.js';
import { log } from '../lib/logger.js';

const groq = new Groq({ apiKey: config.groqApiKey });
const MODEL = 'llama-3.3-70b-versatile';

// ── Fetch competitor articles from within the client's pool ───
// Uses matched_keywords to find competitor mentions in existing articles
async function fetchCompetitorData(clientId, competitors, weekStart) {
    const weekEnd = new Date(new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const weekStartISO = new Date(weekStart).toISOString();

    const result = {};
    for (const competitor of competitors) {
        // Search articles where competitor name appears in title or analysis entities
        const { data: articles } = await supabase
            .from('articles')
            .select('id, title')
            .eq('client_id', clientId)
            .gte('published_at', weekStartISO)
            .lt('published_at', weekEnd)
            .ilike('title', `%${competitor}%`);

        const ids = (articles || []).map(a => a.id);
        let sentiment = 0;

        if (ids.length > 0) {
            const { data: analyses } = await supabase
                .from('article_analysis')
                .select('sentiment')
                .in('article_id', ids);

            const map = { positive: 1, neutral: 0, negative: -1 };
            if (analyses?.length) {
                sentiment = analyses.reduce((s, a) => s + (map[a.sentiment] || 0), 0) / analyses.length;
            }
        }

        result[competitor] = {
            article_count: (articles || []).length,
            sentiment: parseFloat(sentiment.toFixed(3)),
        };
    }

    return result;
}

// ── Get client article metrics for a week ─────────────────
async function fetchClientMetrics(clientId, weekStart) {
    const weekEnd = new Date(new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const weekStartI = new Date(weekStart).toISOString();

    const { data: articles } = await supabase
        .from('articles')
        .select('id')
        .eq('client_id', clientId)
        .gte('published_at', weekStartI)
        .lt('published_at', weekEnd);

    const ids = (articles || []).map(a => a.id);
    let sentiment = 0;

    if (ids.length > 0) {
        const { data: analyses } = await supabase
            .from('article_analysis')
            .select('sentiment')
            .in('article_id', ids);

        const map = { positive: 1, neutral: 0, negative: -1 };
        if (analyses?.length) {
            sentiment = analyses.reduce((s, a) => s + (map[a.sentiment] || 0), 0) / analyses.length;
        }
    }

    return { article_count: ids.length, sentiment: parseFloat(sentiment.toFixed(3)) };
}

// ── LLM strategic implications ─────────────────────────────
async function generateStrategicImplications(clientName, clientMetrics, competitorData) {
    const comparison = Object.entries(competitorData).map(([name, d]) =>
        `${name}: ${d.article_count} articles, sentiment:${d.sentiment.toFixed(2)}`
    ).join(' | ');

    const prompt = `You are a strategic analyst. Write ONE paragraph (3-4 sentences) of strategic implications.

CLIENT: ${clientName}
Client this week: ${clientMetrics.article_count} articles, sentiment:${clientMetrics.sentiment.toFixed(2)}
Competitors: ${comparison}

Focus on:
- Who has more coverage share and what that means
- Sentiment differential (who is viewed more positively and why it matters)
- One concrete strategic implication for the client

Be specific, not generic. No "monitor the situation" type advice.`;

    const resp = await groq.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 300,
    });

    return resp.choices[0].message.content.trim();
}

// ── Public API ─────────────────────────────────────────────

/**
 * Run weekly competitive analysis for a client.
 * Called by the weekly scheduled job (not every 2h cycle).
 *
 * @param {string} clientId
 * @param {string} clientName
 * @param {string[]} competitors - Array of competitor names
 */
export async function runCompetitiveAnalysis(clientId, clientName, competitors) {
    if (!competitors || competitors.length === 0) {
        log.ai.info('Competitive analysis skipped — no competitors configured', { clientId });
        return;
    }

    const startTime = Date.now();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Monday of this week
    weekStart.setHours(0, 0, 0, 0);

    log.ai.info('Competitive analysis starting', { clientId, competitors: competitors.length });

    try {
        // Check if benchmark already exists for this week
        const { data: existing } = await supabase
            .from('competitive_benchmarks')
            .select('id')
            .eq('client_id', clientId)
            .eq('week_start', weekStart.toISOString().split('T')[0])
            .single();

        if (existing) {
            log.ai.info('Competitive analysis already ran this week', { clientId });
            return;
        }

        const [clientMetrics, competitorData] = await Promise.all([
            fetchClientMetrics(clientId, weekStart),
            fetchCompetitorData(clientId, competitors.slice(0, 5), weekStart), // max 5 competitors
        ]);

        const implications = await generateStrategicImplications(clientName, clientMetrics, competitorData);

        await supabase.from('competitive_benchmarks').upsert({
            client_id: clientId,
            week_start: weekStart.toISOString().split('T')[0],
            client_sentiment: clientMetrics.sentiment,
            client_article_count: clientMetrics.article_count,
            competitor_data: competitorData,
            strategic_implications: implications,
        });

        log.ai.info('Competitive analysis complete', {
            clientId,
            competitors: Object.keys(competitorData).length,
            ms: Date.now() - startTime,
        });
    } catch (err) {
        log.ai.error('Competitive analysis failed', { clientId, error: err.message });
    }
}

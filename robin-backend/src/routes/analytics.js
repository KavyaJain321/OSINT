// ============================================================
// ROBIN OSINT — Analytics API Routes
// Sentiment, volume, keywords, sources, patterns, summary
// ============================================================

import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { log } from '../lib/logger.js';

const router = Router();
router.use(authenticate);

// GET /sentiment — Sentiment breakdown + trend + week comparison
router.get('/sentiment', async (req, res) => {
    try {
        const clientId = req.user.clientId;
        const days = parseInt(req.query.days) || 30;

        const { data: trend } = await supabase.rpc('get_sentiment_trend', {
            p_client_id: clientId,
            p_days: days,
        });

        // Calculate breakdown from trend data
        const totals = { positive: 0, negative: 0, neutral: 0, total: 0 };
        for (const row of (trend || [])) {
            totals.positive += parseInt(row.positive_count) || 0;
            totals.negative += parseInt(row.negative_count) || 0;
            totals.neutral += parseInt(row.neutral_count) || 0;
            totals.total += parseInt(row.total) || 0;
        }

        const pct = (n) => totals.total ? Math.round((n / totals.total) * 100) : 0;

        // This week vs last week comparison
        const thisWeek = (trend || []).slice(-7);
        const lastWeek = (trend || []).slice(-14, -7);
        const thisWeekPos = thisWeek.reduce((s, r) => s + (parseInt(r.positive_count) || 0), 0);
        const thisWeekTotal = thisWeek.reduce((s, r) => s + (parseInt(r.total) || 0), 0);
        const lastWeekPos = lastWeek.reduce((s, r) => s + (parseInt(r.positive_count) || 0), 0);
        const lastWeekTotal = lastWeek.reduce((s, r) => s + (parseInt(r.total) || 0), 0);
        const thisWeekPct = thisWeekTotal ? Math.round((thisWeekPos / thisWeekTotal) * 100) : 0;
        const lastWeekPct = lastWeekTotal ? Math.round((lastWeekPos / lastWeekTotal) * 100) : 0;

        res.json({
            breakdown: { ...totals, percentages: { positive: pct(totals.positive), negative: pct(totals.negative), neutral: pct(totals.neutral) } },
            trend: trend || [],
            comparison: { this_week_positive_pct: thisWeekPct, last_week_positive_pct: lastWeekPct, change: thisWeekPct - lastWeekPct },
        });
    } catch (error) {
        log.api.error('GET /analytics/sentiment failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch sentiment data' });
    }
});

// GET /volume — Daily article volume stats
router.get('/volume', async (req, res) => {
    try {
        const clientId = req.user.clientId;
        const days = parseInt(req.query.days) || 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const { data: articles } = await supabase
            .from('articles')
            .select('published_at')
            .eq('client_id', clientId)
            .gte('published_at', since)
            .limit(5000);

        const daily = {};
        for (const a of (articles || [])) {
            const date = new Date(a.published_at).toISOString().split('T')[0];
            daily[date] = (daily[date] || 0) + 1;
        }

        const dailyArray = Object.entries(daily).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
        const total = dailyArray.reduce((s, d) => s + d.count, 0);
        const today = new Date().toISOString().split('T')[0];

        res.json({
            daily: dailyArray,
            total,
            average_per_day: dailyArray.length ? Math.round(total / dailyArray.length) : 0,
            peak_day: dailyArray.length ? dailyArray.reduce((max, d) => d.count > max.count ? d : max) : null,
            today: daily[today] || 0,
        });
    } catch (error) {
        log.api.error('GET /analytics/volume failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch volume data' });
    }
});

// GET /keywords — Per-keyword article stats
router.get('/keywords', async (req, res) => {
    try {
        const clientId = req.user.clientId;
        // Get keywords from active brief
        const { data: activeBrief } = await supabase.from('client_briefs').select('id').eq('client_id', clientId).eq('status', 'active').limit(1).single();
        const { data: keywords } = activeBrief
            ? await supabase.from('brief_generated_keywords').select('keyword').eq('brief_id', activeBrief.id).limit(100)
            : { data: [] };

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

        const results = [];
        for (const { keyword } of (keywords || [])) {
            const { count: total } = await supabase.from('articles').select('id', { count: 'exact', head: true }).eq('client_id', clientId).contains('matched_keywords', [keyword]);
            const { count: thisWeek } = await supabase.from('articles').select('id', { count: 'exact', head: true }).eq('client_id', clientId).contains('matched_keywords', [keyword]).gte('published_at', sevenDaysAgo);
            const { count: lastWeek } = await supabase.from('articles').select('id', { count: 'exact', head: true }).eq('client_id', clientId).contains('matched_keywords', [keyword]).gte('published_at', fourteenDaysAgo).lt('published_at', sevenDaysAgo);

            results.push({
                keyword,
                total_articles: total || 0,
                this_week: thisWeek || 0,
                last_week: lastWeek || 0,
                trend: (thisWeek || 0) > (lastWeek || 0) ? 'up' : (thisWeek || 0) < (lastWeek || 0) ? 'down' : 'stable',
            });
        }

        res.json(results);
    } catch (error) {
        log.api.error('GET /analytics/keywords failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch keyword analytics' });
    }
});

// GET /sources — Per-source stats
router.get('/sources', async (req, res) => {
    try {
        const clientId = req.user.clientId;
        const { data: sources } = await supabase.from('sources').select('id, name, last_scraped_at, scrape_success_count, scrape_fail_count').eq('client_id', clientId).limit(100);

        const results = [];
        for (const source of (sources || [])) {
            const { count } = await supabase.from('articles').select('id', { count: 'exact', head: true }).eq('source_id', source.id);
            results.push({ ...source, total_articles: count || 0 });
        }

        res.json(results);
    } catch (error) {
        log.api.error('GET /analytics/sources failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch source analytics' });
    }
});

// GET /patterns — Latest narrative patterns
router.get('/patterns', async (req, res) => {
    try {
        const { data: pattern } = await supabase.from('narrative_patterns').select('*').eq('client_id', req.user.clientId).order('pattern_date', { ascending: false }).limit(1).single();
        res.json(pattern || { message: 'Intelligence patterns not yet generated.' });
    } catch (error) {
        res.json({ message: 'Intelligence patterns not yet generated.' });
    }
});

// GET /summary — Dashboard header stats
router.get('/summary', async (req, res) => {
    try {
        const clientId = req.user.clientId;
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { count: articlesToday } = await supabase.from('articles').select('id', { count: 'exact', head: true }).eq('client_id', clientId).gte('published_at', today);
        const { count: articlesWeek } = await supabase.from('articles').select('id', { count: 'exact', head: true }).eq('client_id', clientId).gte('published_at', weekAgo);

        // High importance unread count
        const { data: highImp } = await supabase.from('articles').select('id').eq('client_id', clientId).eq('is_tagged', false).eq('analysis_status', 'complete').limit(200);
        const highImpIds = (highImp || []).map((a) => a.id);
        let highImportanceCount = 0;
        if (highImpIds.length > 0) {
            const { count } = await supabase.from('article_analysis').select('id', { count: 'exact', head: true }).in('article_id', highImpIds).gte('importance_score', 7);
            highImportanceCount = count || 0;
        }

        // Risk level
        const { data: pattern } = await supabase.from('narrative_patterns').select('risk_level').eq('client_id', clientId).order('pattern_date', { ascending: false }).limit(1).single();

        res.json({
            articles_today: articlesToday || 0,
            articles_this_week: articlesWeek || 0,
            high_importance_unread: highImportanceCount,
            risk_level: pattern?.risk_level || 'low',
        });
    } catch (error) {
        log.api.error('GET /analytics/summary failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});

export default router;

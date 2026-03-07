// ============================================================
// ROBIN OSINT — Articles API Routes
// Paginated feed, article detail, tagging, manual scrape trigger
// ============================================================

import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import { scrapeSourceById } from '../scrapers/orchestrator.js';
import { log } from '../lib/logger.js';

const router = Router();
router.use(authenticate);

// GET / — Paginated article feed with filters
router.get('/', async (req, res) => {
    try {
        const clientId = req.user.role === 'SUPER_ADMIN' ? req.query.clientId || null : req.user.clientId;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const offset = (page - 1) * limit;

        let query = supabase
            .from('articles')
            .select('id, title, url, published_at, matched_keywords, is_tagged, analysis_status, source_id, client_id, created_at', { count: 'exact' });

        if (clientId) query = query.eq('client_id', clientId);
        if (req.query.source_id) query = query.eq('source_id', req.query.source_id);
        if (req.query.from_date) query = query.gte('published_at', req.query.from_date);
        if (req.query.to_date) query = query.lte('published_at', req.query.to_date);
        if (req.query.tagged_only === 'true') query = query.eq('is_tagged', true);
        if (req.query.keyword) query = query.contains('matched_keywords', [req.query.keyword]);

        query = query.order('published_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data: articles, error, count } = await query;
        if (error) throw error;

        // Fetch analysis for each article
        const articleIds = articles.map((a) => a.id);
        const { data: analyses } = await supabase
            .from('article_analysis')
            .select('article_id, summary, sentiment, importance_score, importance_reason, narrative_frame, entities')
            .in('article_id', articleIds);

        const analysisMap = {};
        for (const a of (analyses || [])) {
            analysisMap[a.article_id] = a;
        }

        // Filter by sentiment or min_score if needed
        let enriched = articles.map((article) => ({
            ...article,
            analysis: analysisMap[article.id] || null,
        }));

        if (req.query.sentiment) {
            enriched = enriched.filter((a) => a.analysis?.sentiment === req.query.sentiment);
        }
        if (req.query.min_score) {
            const minScore = parseInt(req.query.min_score);
            enriched = enriched.filter((a) => (a.analysis?.importance_score || 0) >= minScore);
        }

        res.json({
            data: enriched,
            pagination: { total: count, page, limit, total_pages: Math.ceil((count || 0) / limit) },
        });
    } catch (error) {
        log.api.error('GET /articles failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});

// GET /:id — Single article detail
router.get('/:id', async (req, res) => {
    try {
        const { data: article, error } = await supabase
            .from('articles')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error || !article) return res.status(404).json({ error: 'Article not found' });
        if (req.user.role !== 'SUPER_ADMIN' && article.client_id !== req.user.clientId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { data: analysis } = await supabase
            .from('article_analysis')
            .select('*')
            .eq('article_id', article.id)
            .single();

        res.json({ ...article, analysis: analysis || null });
    } catch (error) {
        log.api.error('GET /articles/:id failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch article' });
    }
});

// PATCH /:id/tag — Toggle tagged status
router.patch('/:id/tag', async (req, res) => {
    try {
        const { is_tagged } = req.body;
        if (typeof is_tagged !== 'boolean') {
            return res.status(400).json({ error: 'is_tagged must be a boolean' });
        }

        const { data, error } = await supabase
            .from('articles')
            .update({ is_tagged })
            .eq('id', req.params.id)
            .eq('client_id', req.user.clientId)
            .select('id, is_tagged')
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        log.api.error('PATCH /articles/:id/tag failed', { error: error.message });
        res.status(500).json({ error: 'Failed to update tag' });
    }
});

// POST /trigger-scrape/:sourceId — Manual scrape trigger
router.post('/trigger-scrape/:sourceId', requireRole('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { sourceId } = req.params;

        // Verify source belongs to user's client
        if (req.user.role !== 'SUPER_ADMIN') {
            const { data: source } = await supabase
                .from('sources')
                .select('client_id')
                .eq('id', sourceId)
                .single();

            if (!source || source.client_id !== req.user.clientId) {
                return res.status(403).json({ error: 'Source not found or access denied' });
            }
        }

        // Trigger async scrape
        scrapeSourceById(sourceId).catch((err) => {
            log.scraper.error('Manual scrape failed', { sourceId, error: err.message });
        });

        res.json({ message: 'Scrape triggered', sourceId });
    } catch (error) {
        log.api.error('POST /trigger-scrape failed', { error: error.message });
        res.status(500).json({ error: 'Failed to trigger scrape' });
    }
});

export default router;

// ============================================================
// Admin Routes — SUPER_ADMIN only
// Brief review + approval, client management, system health
// ============================================================

import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { log } from '../lib/logger.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import { runScraperCycle } from '../scrapers/orchestrator.js';

const router = Router();

// All admin routes require SUPER_ADMIN
router.use(authenticate, requireRole('SUPER_ADMIN'));

// ── Clients ────────────────────────────────────────────────

// GET /api/admin/clients — all clients with article/signal counts
router.get('/clients', async (req, res) => {
    try {
        const { data: clients, error } = await supabase
            .from('clients')
            .select('id, name, industry, is_active, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Enrich with counts
        const enriched = await Promise.all((clients || []).map(async (c) => {
            const [artRes, signalRes, briefRes] = await Promise.all([
                supabase.from('articles').select('id', { count: 'exact', head: true }).eq('client_id', c.id),
                supabase.from('intelligence_signals').select('id', { count: 'exact', head: true }).eq('client_id', c.id).eq('is_acknowledged', false),
                supabase.from('client_briefs').select('status').eq('client_id', c.id).order('created_at', { ascending: false }).limit(1).single(),
            ]);
            return {
                ...c,
                total_articles: artRes.count || 0,
                active_signals: signalRes.count || 0,
                brief_status: briefRes.data?.status || 'none',
            };
        }));

        res.json({ data: enriched });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/clients — create a new client
router.post('/clients', async (req, res) => {
    try {
        const { name, industry } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });

        const { data, error } = await supabase
            .from('clients')
            .insert({ name, industry, is_active: true })
            .select().single();

        if (error) throw error;
        log.system.info('Admin created client', { clientId: data.id, name });
        res.json({ data, message: 'Client created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Brief Review ───────────────────────────────────────────

// GET /api/admin/briefs — all briefs pending review
router.get('/briefs', async (req, res) => {
    try {
        const { status } = req.query; // optional filter: pending_review|approved|active
        let q = supabase
            .from('client_briefs')
            .select('id, title, client_id, status, industry, risk_domains, created_at')
            .order('created_at', { ascending: false });

        if (status) q = q.eq('status', status);

        const { data, error } = await q;
        if (error) throw error;
        res.json({ data: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/admin/briefs/:id/keywords — bulk approve/reject keywords
router.patch('/briefs/:id/keywords', async (req, res) => {
    try {
        const { id } = req.params;
        const { approved_ids = [], rejected_ids = [] } = req.body;

        const ops = [];
        if (approved_ids.length) {
            ops.push(supabase.from('brief_generated_keywords')
                .update({ approved: true, rejected: false })
                .in('id', approved_ids).eq('brief_id', id));
        }
        if (rejected_ids.length) {
            ops.push(supabase.from('brief_generated_keywords')
                .update({ rejected: true, approved: false })
                .in('id', rejected_ids).eq('brief_id', id));
        }

        await Promise.all(ops);
        log.system.info('Admin reviewed keywords', { briefId: id, approved: approved_ids.length, rejected: rejected_ids.length });
        res.json({ message: `${approved_ids.length} keywords approved, ${rejected_ids.length} rejected` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/admin/briefs/:id/sources — bulk approve/reject sources
router.patch('/briefs/:id/sources', async (req, res) => {
    try {
        const { id } = req.params;
        const { approved_ids = [], rejected_ids = [] } = req.body;

        const ops = [];
        if (approved_ids.length) {
            ops.push(supabase.from('brief_recommended_sources')
                .update({ approved: true, rejected: false })
                .in('id', approved_ids).eq('brief_id', id));
        }
        if (rejected_ids.length) {
            ops.push(supabase.from('brief_recommended_sources')
                .update({ rejected: true, approved: false })
                .in('id', rejected_ids).eq('brief_id', id));
        }

        await Promise.all(ops);
        res.json({ message: `${approved_ids.length} sources approved, ${rejected_ids.length} rejected` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/admin/briefs/:id/activate — push approved items to active client
router.post('/briefs/:id/activate', async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch the brief and check for approved items
        const { data: brief, error: briefErr } = await supabase
            .from('client_briefs').select('*').eq('id', id).single();
        if (briefErr || !brief) return res.status(404).json({ error: 'Brief not found' });

        const [kwRes, srcRes] = await Promise.all([
            supabase.from('brief_generated_keywords').select('*').eq('brief_id', id).eq('approved', true),
            supabase.from('brief_recommended_sources').select('*').eq('brief_id', id).eq('approved', true),
        ]);

        const approvedKws = kwRes.data || [];
        const approvedSrcs = srcRes.data || [];

        if (approvedKws.length === 0 && approvedSrcs.length === 0) {
            return res.status(400).json({ error: 'No approved keywords or sources to activate' });
        }

        // Keywords are already in brief_generated_keywords — scraper reads from there directly
        // No need to copy to watch_keywords anymore

        // Insert approved sources into sources table
        if (approvedSrcs.length > 0) {
            await supabase.from('sources').insert(
                approvedSrcs.map(s => ({
                    client_id: brief.client_id,
                    name: s.name,
                    url: s.url,
                    source_type: s.source_type,
                    is_active: true,
                }))
            );
        }

        // Mark brief as active
        await supabase.from('client_briefs').update({
            status: 'active',
            activated_at: new Date().toISOString(),
        }).eq('id', id);

        log.system.info('Brief activated', {
            briefId: id,
            clientId: brief.client_id,
            keywords: approvedKws.length,
            sources: approvedSrcs.length,
        });

        res.json({
            message: 'Brief activated. Keywords and sources are now live.',
            keywords_added: approvedKws.length,
            sources_added: approvedSrcs.length,
        });
    } catch (err) {
        log.system.error('Brief activation failed', { error: err.message });
        res.status(500).json({ error: err.message });
    }
});

// ── Source Quality ─────────────────────────────────────────

// GET /api/admin/source-quality — ranked source reliability scores
router.get('/source-quality', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('source_reliability')
            .select('*, sources!inner(name, url, source_type, client_id, is_active)')
            .order('reliability_score', { ascending: false });

        if (error) throw error;
        res.json({ data: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Manual Scraper Trigger ─────────────────────────────────

// POST /api/admin/scrape/:clientId — manual trigger for specific client
router.post('/scrape/:clientId', async (req, res) => {
    try {
        res.json({ message: 'Scraper triggered', client_id: req.params.clientId });
        runScraperCycle().catch(e => log.scraper.error('Admin-triggered scrape failed', { error: e.message }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

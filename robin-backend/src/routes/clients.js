// ============================================================
// ROBIN OSINT — Clients Routes (SUPER_ADMIN only)
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleCheck.js';
import { log } from '../lib/logger.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('SUPER_ADMIN'));

const ClientSchema = z.object({
    name: z.string().min(1).max(200),
    industry: z.string().max(100).optional(),
});

// GET / — List all clients
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        log.api.error('GET /clients failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});

// POST / — Create a new client
router.post('/', async (req, res) => {
    try {
        const parsed = ClientSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });

        const { data, error } = await supabase
            .from('clients')
            .insert(parsed.data)
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        log.api.error('POST /clients failed', { error: error.message });
        res.status(500).json({ error: 'Failed to create client' });
    }
});

// GET /:id — Client details with counts
router.get('/:id', async (req, res) => {
    try {
        const { data: client, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error || !client) return res.status(404).json({ error: 'Client not found' });

        const { count: userCount } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('client_id', client.id);
        const { count: articleCount } = await supabase.from('articles').select('id', { count: 'exact', head: true }).eq('client_id', client.id);
        const { count: sourceCount } = await supabase.from('sources').select('id', { count: 'exact', head: true }).eq('client_id', client.id);

        res.json({ ...client, user_count: userCount || 0, article_count: articleCount || 0, source_count: sourceCount || 0 });
    } catch (error) {
        log.api.error('GET /clients/:id failed', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch client' });
    }
});

// PATCH /:id — Update client
router.patch('/:id', async (req, res) => {
    try {
        const { name, industry, custom_prompt } = req.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (industry !== undefined) updates.industry = industry;
        if (custom_prompt !== undefined) updates.custom_prompt = custom_prompt;

        const { data, error } = await supabase.from('clients').update(updates).eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (error) {
        log.api.error('PATCH /clients/:id failed', { error: error.message });
        res.status(500).json({ error: 'Failed to update client' });
    }
});

export default router;

// Generate embeddings for all articles that don't have them
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { generateLocalEmbedding } from './src/services/local-embeddings.js';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    // Get all articles
    const { data: articles, error } = await s
        .from('articles')
        .select('id, title, content')
        .order('created_at', { ascending: true });

    if (error) { console.log('Error:', error.message); return; }

    console.log(`Processing ${articles.length} articles for embeddings...\n`);

    let success = 0, failed = 0;

    for (const article of articles) {
        const text = `${article.title || ''} ${(article.content || '').substring(0, 1200)}`;
        const embedding = generateLocalEmbedding(text);

        if (!embedding) {
            console.log(`❌ [${article.id.substring(0, 8)}] No embedding (text too short)`);
            failed++;
            continue;
        }

        const { error: updateErr } = await s
            .from('articles')
            .update({
                embedding: JSON.stringify(embedding),
                analysis_status: 'complete'
            })
            .eq('id', article.id);

        if (updateErr) {
            console.log(`❌ [${article.id.substring(0, 8)}] ${updateErr.message}`);
            failed++;
        } else {
            success++;
            process.stdout.write(`✅ [${success}/${articles.length}] ${(article.title || '').substring(0, 50)}...\n`);
        }
    }

    console.log(`\n=== Done: ${success} embedded, ${failed} failed ===`);

    // Verify
    const { data: check } = await s
        .from('articles')
        .select('id')
        .not('embedding', 'is', null);

    console.log(`Articles with embeddings: ${check?.length || 0}/${articles.length}`);
}

run();

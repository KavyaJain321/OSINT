// ============================================================
// ROBIN OSINT — Embedding Service
// Converts text to 768-dim vectors for semantic search
// Priority: LLM-enhanced semantic → Local hash-based fallback
// ============================================================

import { groqChat } from '../lib/groq.js';
import { generateEmbedding as localEmbed, generateLocalEmbedding } from './local-embeddings.js';
import { supabase } from '../lib/supabase.js';
import { log } from '../lib/logger.js';

/**
 * Use Groq LLM to extract semantic concepts from text.
 * These concepts capture meaning beyond keywords — e.g. "banking crisis" 
 * matches "financial instability" because the LLM understands they're related.
 * @param {string} text - Article text (up to ~1000 chars)
 * @returns {Promise<string|null>} Expanded semantic text for embedding
 */
async function extractSemanticConcepts(text) {
    try {
        const response = await groqChat([
            {
                role: 'system',
                content: 'You are a concept extractor. Given article text, output a dense list of semantic concepts, themes, related topics, entities, and categories. Output ONLY the concepts as comma-separated words/phrases. No explanations. Max 150 words.'
            },
            {
                role: 'user',
                content: text.substring(0, 800)
            }
        ], { temperature: 0, max_tokens: 200 });

        const concepts = response.choices[0]?.message?.content?.trim();
        return concepts || null;
    } catch (err) {
        log.ai.debug('[EMBED] LLM concept extraction failed', { error: err.message });
        return null;
    }
}

/**
 * Generate embedding for text.
 * Enhanced path: LLM extracts semantic concepts → those concepts + original text are hashed together.
 * This creates embeddings where "ASEAN tensions" matches "Southeast Asian conflict" because 
 * the LLM expands both into overlapping concept spaces.
 * 
 * @param {string} text - Text to embed
 * @returns {Promise<{ embedding: number[]|null, source: string }>}
 */
export async function generateEmbedding(text) {
    try {
        const cleaned = text.replace(/\s+/g, ' ').trim().substring(0, 2000);
        if (cleaned.length < 10) return { embedding: null, source: 'none' };

        // Try LLM-enhanced embedding
        try {
            const concepts = await extractSemanticConcepts(cleaned);
            if (concepts) {
                // Combine original text + semantic concepts for richer embedding
                const enriched = `${cleaned} ${concepts}`;
                const embedding = generateLocalEmbedding(enriched);
                if (embedding && embedding.length === 768) {
                    log.ai.debug('[EMBED] LLM-enhanced embedding generated', {
                        origLen: cleaned.length,
                        conceptLen: concepts.length
                    });
                    return { embedding, source: 'llm-enhanced' };
                }
            }
        } catch (err) {
            log.ai.warn('[EMBED] LLM-enhanced embedding failed, falling back to local', { error: err.message });
        }

        // Fallback: plain local hash-based embedding
        const embedding = await localEmbed(cleaned);
        return { embedding, source: 'local' };
    } catch (error) {
        log.ai.warn('[EMBED] Embedding generation failed completely', { error: error.message });
        return { embedding: null, source: 'error' };
    }
}

/**
 * Generate embedding for an article and store it in the database.
 * @param {string} articleId - Article UUID
 * @returns {Promise<boolean>} true if successfully stored
 */
export async function generateAndStoreEmbedding(articleId) {
    try {
        const { data: article, error: fetchError } = await supabase
            .from('articles')
            .select('title, content')
            .eq('id', articleId)
            .single();

        if (fetchError || !article) {
            log.ai.warn('Article not found for embedding', { articleId });
            return false;
        }

        const textToEmbed = `${article.title || ''} ${article.content || ''}`;
        const { embedding, source } = await generateEmbedding(textToEmbed);

        if (!embedding) {
            log.ai.warn('Embedding generation returned null', { articleId });
            return false;
        }

        // Store embedding
        const { error: updateError } = await supabase
            .from('articles')
            .update({ embedding: JSON.stringify(embedding) })
            .eq('id', articleId);

        if (updateError) {
            log.ai.error('Failed to store embedding', { articleId, error: updateError.message });
            return false;
        }

        log.ai.info('[EMBED] Stored embedding', { articleId, source });
        return true;
    } catch (error) {
        log.ai.error('generateAndStoreEmbedding failed', { articleId, error: error.message });
        return false;
    }
}

/**
 * Generate embedding for a search query (used by RAG chat).
 * @param {string} query - Search query
 * @returns {Promise<number[]|null>}
 */
export async function generateEmbeddingForQuery(query) {
    const { embedding, source } = await generateEmbedding(query);
    log.ai.info('[EMBED] Query embedding', { source, queryLen: query.length });
    return embedding;
}

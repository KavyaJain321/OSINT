// ============================================================
// ROBIN OSINT — Deduplication Checker
// Three-layer: URL uniqueness + content fingerprint + cross-source title match
// ============================================================

import { createHash } from 'crypto';
import { supabase } from '../lib/supabase.js';
import { log } from '../lib/logger.js';

// Common English stop words removed during title normalization
const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'it', 'its', 'this', 'that',
    'these', 'those', 'he', 'she', 'they', 'we', 'you', 'i', 'me', 'him',
    'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'not', 'no',
    'as', 'if', 'than', 'so', 'up', 'out', 'about', 'into', 'over', 'after',
    'says', 'said', 'new', 'also', 'more', 'just', 'how', 'what', 'when',
    'where', 'who', 'which', 'why', 'all', 'each', 'every', 'both', 'few',
    'some', 'any', 'most', 'other', 'over', 'such',
]);

/**
 * Generate MD5 hash of normalized content (first 600 chars).
 * @param {string} content - Article content
 * @returns {string} MD5 hex hash
 */
export function generateContentHash(content) {
    const normalized = content
        .substring(0, 600)
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return createHash('md5').update(normalized).digest('hex');
}

/**
 * Generate a normalized title hash for cross-source dedup.
 * Removes stop words, punctuation, lowercases, sorts words → MD5.
 * Two articles about the same story will produce the same hash
 * even if headlines differ slightly (e.g., "Trump Tariffs Hit EU" vs "EU Hit by Trump Tariffs").
 * @param {string} title - Article title
 * @returns {string} MD5 hex hash of normalized title
 */
export function generateTitleHash(title) {
    const words = title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')       // remove punctuation
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
        .sort();                        // sort so word order doesn't matter

    const normalized = words.join(' ');
    return createHash('md5').update(normalized).digest('hex');
}

/**
 * Check if an article is a duplicate by URL or content hash.
 * This blocks the article from being saved (same-source dedup).
 * @param {string} url - Article URL (already normalized)
 * @param {string} content - Article content
 * @param {string} clientId - Client UUID
 * @returns {Promise<{ isDuplicate: boolean, reason: string|null }>}
 */
export async function isDuplicate(url, content, clientId) {
    try {
        // Layer 1: URL check
        const { data: urlMatch } = await supabase
            .from('articles')
            .select('id')
            .eq('url', url)
            .eq('client_id', clientId)
            .limit(1)
            .single();

        if (urlMatch) {
            return { isDuplicate: true, reason: 'url_exists' };
        }

        // Layer 2: Content hash check
        const hash = generateContentHash(content);
        const { data: hashMatch } = await supabase
            .from('articles')
            .select('id')
            .eq('content_hash', hash)
            .eq('client_id', clientId)
            .limit(1)
            .single();

        if (hashMatch) {
            return { isDuplicate: true, reason: 'content_exists' };
        }

        return { isDuplicate: false, reason: null };
    } catch (error) {
        // On DB error, allow the article through
        // Better to store a potential duplicate than miss a real article
        log.scraper.warn('Dedup check failed, allowing article', { error: error.message });
        return { isDuplicate: false, reason: null };
    }
}

/**
 * Find a cross-source duplicate: same story from a different source within 48 hours.
 * Unlike isDuplicate(), this does NOT block saving — it returns the original article ID
 * so we can link them. Having the same story from 5 sources = high-confidence signal.
 * @param {string} title - Article title
 * @param {string} sourceId - Current source UUID (excluded from search)
 * @param {string} clientId - Client UUID
 * @returns {Promise<string|null>} Original article ID if cross-source match found, null otherwise
 */
export async function findCrossSourceDuplicate(title, sourceId, clientId) {
    try {
        const titleHash = generateTitleHash(title);
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

        const { data: match } = await supabase
            .from('articles')
            .select('id, source_id, title')
            .eq('title_hash', titleHash)
            .eq('client_id', clientId)
            .neq('source_id', sourceId)        // different source only
            .gte('created_at', cutoff)          // within 48 hours
            .limit(1)
            .single();

        if (match) {
            log.scraper.info('Cross-source duplicate found', {
                newTitle: title.substring(0, 60),
                existingId: match.id,
                existingTitle: match.title?.substring(0, 60),
            });
            return match.id;
        }

        return null;
    } catch (error) {
        // Non-critical — if this fails, article is still saved without linking
        return null;
    }
}

/**
 * Normalize URL for consistent dedup checking.
 * Removes trailing slashes, UTM parameters, lowercases domain.
 * @param {string} url - Raw URL
 * @returns {string} Normalized URL
 */
export function normalizeUrl(url) {
    try {
        const parsed = new URL(url);

        // Lowercase the host
        parsed.hostname = parsed.hostname.toLowerCase();

        // Remove UTM and tracking params
        const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'fbclid', 'gclid'];
        trackingParams.forEach((param) => parsed.searchParams.delete(param));

        // Remove trailing slash from pathname
        if (parsed.pathname.endsWith('/') && parsed.pathname !== '/') {
            parsed.pathname = parsed.pathname.slice(0, -1);
        }

        return parsed.toString();
    } catch {
        // If URL parsing fails, return as-is
        return url;
    }
}

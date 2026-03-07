// ============================================================
// ROBIN OSINT — Source Validator
// Probes URLs to detect source type, validate accessibility,
// and auto-detect RSS feeds
// ============================================================

import { log } from '../lib/logger.js';

const TIMEOUT_MS = 8000;

/**
 * Probe a URL to determine its type and accessibility.
 *
 * @param {string} url - URL to validate
 * @returns {Promise<{ valid: boolean, sourceType: string, rssUrl?: string, error?: string }>}
 */
export async function validateSourceUrl(url) {
    try {
        const parsed = new URL(url);

        // Quick type detection from URL pattern
        if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
            return { valid: true, sourceType: 'youtube' };
        }
        if (parsed.hostname.includes('reddit.com')) {
            return { valid: true, sourceType: 'reddit' };
        }
        if (parsed.hostname.includes('twitter.com') || parsed.hostname.includes('x.com')) {
            return { valid: true, sourceType: 'twitter' };
        }
        if (url.endsWith('.pdf')) {
            return { valid: true, sourceType: 'pdf' };
        }
        if (parsed.hostname.includes('news.google.com')) {
            return { valid: true, sourceType: 'google_news' };
        }

        // Try RSS feed detection
        const rssUrl = await tryDetectRss(url);
        if (rssUrl) {
            return { valid: true, sourceType: 'rss', rssUrl };
        }

        // Default: try HTTP GET to verify accessibility
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const resp = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
                headers: { 'User-Agent': 'ROBIN-OSINT-Validator/1.0' },
                redirect: 'follow',
            });
            clearTimeout(timeout);

            if (resp.ok) {
                const contentType = resp.headers.get('content-type') || '';
                if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')) {
                    return { valid: true, sourceType: 'rss', rssUrl: url };
                }
                return { valid: true, sourceType: 'html' };
            }
            return { valid: false, sourceType: 'html', error: `HTTP ${resp.status}` };
        } catch (fetchErr) {
            clearTimeout(timeout);
            // If HEAD fails, try GET (some servers block HEAD)
            try {
                const resp2 = await fetch(url, {
                    method: 'GET',
                    signal: AbortSignal.timeout(TIMEOUT_MS),
                    headers: { 'User-Agent': 'ROBIN-OSINT-Validator/1.0' },
                    redirect: 'follow',
                });
                if (resp2.ok) {
                    return { valid: true, sourceType: 'html' };
                }
            } catch {
                // Both methods failed
            }
            return { valid: false, sourceType: 'html', error: fetchErr.message };
        }
    } catch (urlErr) {
        return { valid: false, sourceType: 'unknown', error: `Invalid URL: ${urlErr.message}` };
    }
}

/**
 * Try common RSS feed URL patterns for a domain.
 *
 * @param {string} url - Base URL
 * @returns {Promise<string|null>} RSS feed URL or null
 */
async function tryDetectRss(url) {
    const parsed = new URL(url);
    const baseUrl = `${parsed.protocol}//${parsed.hostname}`;

    const rssPaths = [
        '/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml',
        '/feeds/posts/default', '/blog/feed', '/news/feed',
        '/index.xml', '/rss/news',
    ];

    for (const path of rssPaths) {
        try {
            const resp = await fetch(`${baseUrl}${path}`, {
                method: 'HEAD',
                signal: AbortSignal.timeout(4000),
                headers: { 'User-Agent': 'ROBIN-OSINT-Validator/1.0' },
                redirect: 'follow',
            });
            if (resp.ok) {
                const ct = resp.headers.get('content-type') || '';
                if (ct.includes('xml') || ct.includes('rss') || ct.includes('atom') || ct.includes('text')) {
                    return `${baseUrl}${path}`;
                }
            }
        } catch {
            // Continue trying other paths
        }
    }

    return null;
}

/**
 * Detect the most appropriate source type for a URL.
 *
 * @param {string} url - URL to classify
 * @returns {string} Source type string
 */
export function detectSourceType(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();

        if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
        if (host.includes('reddit.com')) return 'reddit';
        if (host.includes('twitter.com') || host.includes('x.com')) return 'twitter';
        if (host.includes('news.google.com')) return 'google_news';
        if (host.includes('gov.in') || host.includes('.gov') || host.includes('pib.gov')) return 'govt_portal';
        if (url.endsWith('.pdf')) return 'pdf';
        if (url.includes('/feed') || url.includes('/rss') || url.endsWith('.xml')) return 'rss';
        return 'html';
    } catch {
        return 'html';
    }
}

/**
 * Validate multiple source URLs in parallel (max 5 concurrent).
 *
 * @param {{ name: string, url: string }[]} sources
 * @returns {Promise<{ name: string, url: string, valid: boolean, sourceType: string }[]>}
 */
export async function validateSourceBatch(sources) {
    const CONCURRENCY = 5;
    const results = [];

    for (let i = 0; i < sources.length; i += CONCURRENCY) {
        const batch = sources.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(
            batch.map(async (s) => {
                const result = await validateSourceUrl(s.url);
                return {
                    name: s.name,
                    url: s.url,
                    valid: result.valid,
                    sourceType: result.sourceType,
                    rssUrl: result.rssUrl,
                    error: result.error,
                };
            })
        );
        results.push(...batchResults);
    }

    const validCount = results.filter(r => r.valid).length;
    log.scraper.info('Source batch validation complete', {
        total: sources.length,
        valid: validCount,
        invalid: sources.length - validCount,
    });

    return results;
}

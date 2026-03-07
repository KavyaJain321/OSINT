// ============================================================
// ROBIN OSINT — Curated Source Matcher
// Selects relevant media outlets from the media_outlets database
// based on a brief's geographic focus, keywords, and topic.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { log } from '../lib/logger.js';

const mkAdmin = () => createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// Country name → ISO code mapping for geographic matching
const COUNTRY_MAP = {
    // Common names
    'uk': 'GBR', 'united kingdom': 'GBR', 'britain': 'GBR', 'england': 'GBR',
    'india': 'IND', 'pakistan': 'PAK', 'bangladesh': 'BGD',
    'kenya': 'KEN', 'ghana': 'GHA', 'tanzania': 'TZA', 'uganda': 'UGA',
    'rwanda': 'RWA', 'nigeria': 'NGA', 'south africa': 'ZAF',
    'zimbabwe': 'ZWE', 'zambia': 'ZMB', 'namibia': 'NAM', 'angola': 'AGO',
    'malaysia': 'MYS', 'maldives': 'MDV', 'brunei': 'BRN',
    'canada': 'CAN', 'trinidad': 'TTO', 'trinidad and tobago': 'TTO',
    'dominica': 'DMA', 'grenada': 'GRD', 'cyprus': 'CYP',
    'eswatini': 'SWZ', 'swaziland': 'SWZ', 'lesotho': 'LSO',
    'togo': 'TGO', 'vanuatu': 'VUT', 'kiribati': 'KIR', 'nauru': 'NRU',
    'solomon islands': 'SLB',
    // Also match ISO codes directly
    'gbr': 'GBR', 'ind': 'IND', 'pak': 'PAK', 'bgd': 'BGD',
    'ken': 'KEN', 'gha': 'GHA', 'tza': 'TZA', 'uga': 'UGA',
    'rwa': 'RWA', 'zaf': 'ZAF', 'zwe': 'ZWE', 'zmb': 'ZMB',
    'mys': 'MYS', 'can': 'CAN', 'cyp': 'CYP', 'tto': 'TTO',
    // Regions map to multiple countries
    'africa': ['KEN', 'GHA', 'TZA', 'UGA', 'RWA', 'ZAF', 'ZWE', 'ZMB', 'NAM', 'AGO', 'TGO', 'SWZ', 'LSO'],
    'south asia': ['IND', 'PAK', 'BGD', 'MDV'],
    'southeast asia': ['MYS', 'BRN'],
    'europe': ['GBR', 'CYP'],
    'caribbean': ['TTO', 'DMA', 'GRD'],
    'pacific': ['VUT', 'SLB', 'KIR', 'NRU'],
    'global': ['GBR', 'IND', 'PAK', 'KEN', 'GHA', 'CAN', 'ZAF', 'MYS'],
    'worldwide': ['GBR', 'IND', 'PAK', 'KEN', 'GHA', 'CAN', 'ZAF', 'MYS'],
};

/**
 * Match curated sources from media_outlets based on brief context.
 * 
 * @param {Object} context - Brief context from keyword generation
 * @param {string} context.industry - Industry focus
 * @param {string[]} context.geographic_focus - Geographic regions/countries
 * @param {string[]} context.entities_of_interest - Key entities
 * @param {string[]} context.risk_domains - Risk domains
 * @param {string} problemStatement - The brief's problem statement
 * @returns {Promise<Object[]>} Matched media outlets with relevance scores
 */
export async function matchCuratedSources(context, problemStatement) {
    const db = mkAdmin();
    const geoFocus = context.geographic_focus || [];
    const industry = (context.industry || '').toLowerCase();
    const entities = (context.entities_of_interest || []).map(e => e.toLowerCase());
    const riskDomains = (context.risk_domains || []).map(r => r.toLowerCase());
    const statement = problemStatement.toLowerCase();

    // Step 1: Determine target country codes from geographic focus
    const targetCodes = new Set();

    for (const geo of geoFocus) {
        const lower = geo.toLowerCase().trim();
        const mapped = COUNTRY_MAP[lower];
        if (Array.isArray(mapped)) {
            mapped.forEach(c => targetCodes.add(c));
        } else if (mapped) {
            targetCodes.add(mapped);
        }
    }

    // Also scan the problem statement for country mentions
    for (const [name, code] of Object.entries(COUNTRY_MAP)) {
        if (name.length >= 4 && statement.includes(name)) {
            if (Array.isArray(code)) {
                code.forEach(c => targetCodes.add(c));
            } else {
                targetCodes.add(code);
            }
        }
    }

    // If no specific geography, use global major sources
    if (targetCodes.size === 0) {
        ['GBR', 'IND', 'CAN', 'KEN', 'GHA', 'ZAF'].forEach(c => targetCodes.add(c));
    }

    log.ai.info('Curated source matching', {
        geoFocus,
        targetCodes: [...targetCodes],
        industry,
    });

    // Step 2: Fetch outlets from target countries
    const { data: outlets, error } = await db
        .from('media_outlets')
        .select('*')
        .in('country_id', [...targetCodes])
        .eq('is_scrapeable', true)
        .order('reliability_score', { ascending: false });

    if (error) {
        log.ai.error('Curated source query failed', { error: error.message });
        return [];
    }

    if (!outlets || outlets.length === 0) {
        log.ai.info('No curated sources found for target countries');
        return [];
    }

    // Step 3: Score each outlet for relevance
    const scored = outlets.map(outlet => {
        let score = outlet.reliability_score || 0.5;
        const tags = [
            outlet.tags_economic, outlet.tags_sociocultural,
            outlet.tags_governance, outlet.tags_foreign, outlet.tags_other,
            outlet.notes, outlet.political_alignment
        ].filter(Boolean).join(' ').toLowerCase();

        // Boost for topic relevance
        if (industry && tags.includes(industry)) score += 0.2;
        if (riskDomains.some(r => tags.includes(r))) score += 0.15;
        if (entities.some(e => tags.includes(e))) score += 0.1;

        // Boost investigative sources for intelligence briefs
        if (tags.includes('investigative')) score += 0.1;
        if (tags.includes('anti-corruption')) score += 0.05;

        // Penalize state propaganda
        if (tags.includes('propaganda') || tags.includes('state propaganda')) score -= 0.2;
        if (tags.includes('sensationalist') || tags.includes('clickbait')) score -= 0.15;
        if (outlet.factual_reliability === 'Very Low') score -= 0.3;
        if (outlet.factual_reliability === 'Low') score -= 0.15;

        // Boost English sources (easier to scrape)
        if (outlet.language_primary?.includes('en')) score += 0.05;

        // Boost well-known formats
        if (outlet.format?.includes('Newspaper-Legacy') || outlet.format?.includes('Digital-Native')) score += 0.05;

        return { ...outlet, relevance_score: Math.max(0, Math.min(1, score)) };
    });

    // Step 4: Sort by relevance and pick top sources
    scored.sort((a, b) => b.relevance_score - a.relevance_score);

    // Select top outlets: max 5 per country, max 30 total
    const selected = [];
    const perCountry = {};
    const MAX_PER_COUNTRY = 5;
    const MAX_TOTAL = 30;

    for (const outlet of scored) {
        if (selected.length >= MAX_TOTAL) break;
        const cc = outlet.country_id;
        perCountry[cc] = (perCountry[cc] || 0) + 1;
        if (perCountry[cc] > MAX_PER_COUNTRY) continue;
        // Only include if reliability is acceptable
        if (outlet.reliability_score < 0.3) continue;
        selected.push(outlet);
    }

    log.ai.info('Curated sources selected', {
        total: selected.length,
        countries: [...new Set(selected.map(s => s.country_id))],
        avgReliability: (selected.reduce((s, o) => s + o.reliability_score, 0) / selected.length).toFixed(2),
    });

    // Step 5: Format for source insertion
    return selected.map(outlet => ({
        name: outlet.outlet_name,
        url: normalizeUrl(outlet.primary_domain),
        source_type: guessSourceType(outlet),
        expected_hit_rate: outlet.reliability_score >= 0.8 ? 'high' : outlet.reliability_score >= 0.5 ? 'medium' : 'low',
        rationale: `${outlet.country_name} | ${outlet.factual_reliability} reliability | ${outlet.political_alignment || 'Neutral'} | Verified by ${outlet.verified_by || 'N/A'}`,
        reliability_score: outlet.reliability_score,
        country_id: outlet.country_id,
        outlet_id: outlet.outlet_id,
    }));
}

// Normalize domain to full URL
function normalizeUrl(domain) {
    if (!domain) return '';
    if (domain.startsWith('http')) return domain;
    return `https://${domain}`;
}

// Guess source type from outlet format
function guessSourceType(outlet) {
    const format = (outlet.format || '').toLowerCase();
    if (format.includes('radio') || format.includes('podcast')) return 'rss';
    if (format.includes('tv') || format.includes('broadcast')) return 'html';
    if (format.includes('digital')) return 'rss';
    if (format.includes('newspaper')) return 'rss';
    if (format.includes('magazine')) return 'rss';
    if (format.includes('youtube')) return 'youtube';
    return 'rss'; // default to RSS — most news sites have feeds
}

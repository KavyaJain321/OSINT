// ============================================================
// ROBIN OSINT — Local Rule-Based Analyzer (No LLM Fallback)
// Provides sentiment, entities, importance scoring without AI
// Uses NLP heuristics: keyword matching, NER patterns, scoring
// ============================================================

import { log } from '../lib/logger.js';

// ─── Sentiment Lexicons ─────────────────────────────────────
const POSITIVE_WORDS = new Set([
    'growth', 'rise', 'rising', 'profit', 'gain', 'gains', 'improve', 'improved', 'improvement',
    'success', 'successful', 'boost', 'positive', 'strong', 'stronger', 'recovery', 'recover',
    'agreement', 'peace', 'deal', 'progress', 'win', 'winning', 'award', 'benefit', 'benefits',
    'opportunity', 'advance', 'advancing', 'surge', 'record', 'high', 'upgrade', 'optimistic',
    'stable', 'stability', 'cooperation', 'support', 'approve', 'approved', 'innovation',
    'breakthrough', 'achievement', 'celebrate', 'relief', 'resolve', 'resolved', 'prosper',
]);

const NEGATIVE_WORDS = new Set([
    'fall', 'falling', 'decline', 'loss', 'losses', 'crash', 'crisis', 'risk', 'threat', 'threats',
    'failure', 'failed', 'fail', 'weak', 'weaker', 'drop', 'dropping', 'recession', 'inflation',
    'conflict', 'war', 'attack', 'attacked', 'kill', 'killed', 'death', 'deaths', 'destroy',
    'destroyed', 'damage', 'damaged', 'fraud', 'scandal', 'corruption', 'arrest', 'arrested',
    'protest', 'protests', 'strike', 'strikes', 'collapse', 'collapsed', 'violated', 'violation',
    'sanctions', 'sanction', 'penalty', 'penalties', 'ban', 'banned', 'warning', 'danger', 'fear',
    'concern', 'concerns', 'shortage', 'debt', 'deficit', 'unemployment', 'poverty', 'violence',
    'bomb', 'bombing', 'terror', 'terrorist', 'extremist', 'casualties', 'wounded', 'flee',
    'displaced', 'refugee', 'famine', 'drought', 'flood', 'earthquake', 'disaster', 'epidemic',
]);

// ─── Named Entity Patterns ──────────────────────────────────
const TITLE_PREFIXES = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Gen.', 'Lt.', 'Col.', 'Sgt.',
    'President', 'Prime Minister', 'PM', 'Minister', 'Sen.', 'Senator', 'Rep.', 'Governor',
    'King', 'Queen', 'Prince', 'Princess', 'Chairman', 'CEO', 'Chief', 'Secretary', 'Director'];

const ORG_KEYWORDS = ['United Nations', 'UN', 'NATO', 'EU', 'European Union', 'IMF', 'World Bank',
    'WHO', 'UNICEF', 'FATF', 'FBI', 'CIA', 'NSA', 'Pentagon', 'Congress', 'Parliament', 'Senate',
    'Supreme Court', 'Federal Reserve', 'Fed', 'SEC', 'Reuters', 'Associated Press', 'AP',
    'Al Jazeera', 'BBC', 'CNN', 'NYT', 'AFP', 'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta',
    'Tesla', 'OpenAI', 'Bank', 'Corporation', 'Corp', 'Inc', 'Ltd', 'Group', 'Authority', 'Ministry',
    'Department', 'Commission', 'Committee', 'Organization', 'Organisation', 'Agency', 'Institute',
    'Foundation', 'Association', 'Council', 'Board', 'Fund', 'Court', 'Embassy'];

const LOCATION_KEYWORDS = ['Afghanistan', 'Africa', 'Argentina', 'Asia', 'Australia', 'Bangladesh',
    'Beijing', 'Berlin', 'Brazil', 'Britain', 'Brussels', 'Cairo', 'California', 'Canada', 'China',
    'Colombia', 'Delhi', 'Dubai', 'Egypt', 'England', 'Europe', 'France', 'Gaza', 'Germany', 'Greece',
    'Hong Kong', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jakarta',
    'Japan', 'Jerusalem', 'Kabul', 'Karachi', 'Kenya', 'Korea', 'Kyiv', 'Lahore', 'Lebanon', 'Libya',
    'London', 'Malaysia', 'Mexico', 'Middle East', 'Moscow', 'Mumbai', 'Myanmar', 'Netherlands',
    'New York', 'Nigeria', 'North Korea', 'Pakistan', 'Palestine', 'Paris', 'Philippines', 'Poland',
    'Punjab', 'Qatar', 'Russia', 'Saudi Arabia', 'Seoul', 'Singapore', 'South Africa', 'Spain',
    'Sudan', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tehran', 'Thailand', 'Tokyo', 'Turkey',
    'UAE', 'UK', 'Ukraine', 'United Kingdom', 'United States', 'US', 'USA', 'Vietnam', 'Washington',
    'West Bank', 'Yemen', 'Islamabad', 'Peshawar', 'Quetta', 'Rawalpindi', 'Sindh', 'Balochistan', 'KPK'];

// ─── Narrative Frame Detection ──────────────────────────────
const FRAME_PATTERNS = {
    crisis: ['crisis', 'emergency', 'disaster', 'catastrophe', 'devastating', 'urgent', 'critical', 'outbreak', 'pandemic'],
    conflict: ['war', 'conflict', 'battle', 'fight', 'attack', 'military', 'troops', 'forces', 'invasion', 'strike', 'clash'],
    accountability: ['investigation', 'probe', 'inquiry', 'trial', 'court', 'charged', 'accused', 'alleged', 'corruption', 'scandal', 'fraud'],
    recovery: ['recovery', 'recover', 'rebuild', 'restore', 'stabilize', 'improvement', 'rebound', 'turnaround', 'resumption'],
    economic: ['economy', 'economic', 'inflation', 'GDP', 'market', 'trade', 'fiscal', 'monetary', 'budget', 'investment', 'stock', 'price', 'cost'],
    human_interest: ['family', 'families', 'children', 'community', 'survivor', 'survivor', 'refugee', 'displaced', 'personal', 'story', 'lived'],
};

// ─── Core Analysis Functions ────────────────────────────────

/**
 * Compute sentiment score from text.
 * Returns { sentiment: 'positive'|'negative'|'neutral', score: -1..+1 }
 */
function analyzeSentiment(text) {
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    let pos = 0, neg = 0;

    for (const word of words) {
        if (POSITIVE_WORDS.has(word)) pos++;
        if (NEGATIVE_WORDS.has(word)) neg++;
    }

    const total = pos + neg;
    if (total === 0) return { sentiment: 'neutral', score: 0 };

    const score = (pos - neg) / total;
    const sentiment = score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral';
    return { sentiment, score: Math.round(score * 100) / 100 };
}

/**
 * Extract named entities using pattern matching.
 */
function extractEntities(text) {
    const people = new Set();
    const orgs = new Set();
    const locations = new Set();

    // Extract locations
    for (const loc of LOCATION_KEYWORDS) {
        if (text.includes(loc)) locations.add(loc);
    }

    // Extract organizations
    for (const org of ORG_KEYWORDS) {
        if (text.includes(org)) orgs.add(org);
    }

    // Extract people — look for Title + Capitalized Name patterns
    for (const prefix of TITLE_PREFIXES) {
        const regex = new RegExp(prefix.replace('.', '\\.') + '\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){0,2})', 'g');
        let match;
        while ((match = regex.exec(text)) !== null) {
            people.add(prefix + ' ' + match[1]);
        }
    }

    // Also extract Capitalized Name patterns (First Last)
    const nameRegex = /\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/g;
    let match;
    while ((match = nameRegex.exec(text)) !== null) {
        const name = match[1];
        // Filter out common non-names
        if (!locations.has(name) && !orgs.has(name) && !name.match(/^(The |In |On |At |By |For |And |With )/i)) {
            people.add(name);
        }
    }

    return {
        people: [...people].slice(0, 8),
        orgs: [...orgs].slice(0, 8),
        locations: [...locations].slice(0, 8),
        figures: [],
    };
}

/**
 * Detect narrative frame from text.
 */
function detectNarrativeFrame(text) {
    const lower = text.toLowerCase();
    const scores = {};

    for (const [frame, keywords] of Object.entries(FRAME_PATTERNS)) {
        scores[frame] = keywords.filter(kw => lower.includes(kw)).length;
    }

    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return best[1] > 0 ? best[0] : 'none';
}

/**
 * Calculate importance score (1-10) based on article signals.
 */
function calculateImportance(article, entities) {
    let score = 3; // baseline

    const text = ((article.title || '') + ' ' + (article.content || '')).toLowerCase();
    const keywords = article.matched_keywords || [];

    // Boost for multiple keyword matches
    if (keywords.length >= 3) score += 2;
    else if (keywords.length >= 2) score += 1;

    // Boost for named entities
    if (entities.people.length > 3) score += 1;
    if (entities.orgs.length > 2) score += 1;

    // Boost for high-impact topics
    const highImpact = ['scandal', 'arrest', 'fraud', 'investigation', 'sanction', 'ban', 'attack', 'crisis', 'emergency'];
    if (highImpact.some(w => text.includes(w))) score += 2;

    // Boost for financial terms
    const finTerms = ['billion', 'million', 'percent', 'gdp', 'inflation', 'interest rate', 'stock'];
    if (finTerms.some(w => text.includes(w))) score += 1;

    return Math.min(10, Math.max(1, score));
}

/**
 * Generate a summary from the first few sentences of the article.
 */
function generateSummary(title, content, maxSentences = 3) {
    if (!content) return title || 'No content available for analysis.';

    // Split into sentences and take the first few
    const sentences = content
        .replace(/\s+/g, ' ')
        .match(/[^.!?]+[.!?]+/g) || [];

    const meaningful = sentences
        .map(s => s.trim())
        .filter(s => s.length > 30 && s.length < 300)
        .slice(0, maxSentences);

    return meaningful.length > 0
        ? meaningful.join(' ')
        : (content.substring(0, 250).trim() + '...');
}

// ─── Main Export ─────────────────────────────────────────────

/**
 * Perform full article analysis without any LLM.
 * Returns the same shape as the Groq LLM response.
 *
 * @param {Object} article - { title, content, matched_keywords, published_at, source_name }
 * @param {string} clientName
 * @param {string} industry
 * @returns {Object} Analysis result matching LLM output schema
 */
export function analyzeLocally(article, clientName, industry) {
    const text = (article.title || '') + ' ' + (article.content || '');
    const { sentiment } = analyzeSentiment(text);
    const entities = extractEntities(text);
    const narrativeFrame = detectNarrativeFrame(text);
    const importanceScore = calculateImportance(article, entities);
    const summary = generateSummary(article.title, article.content);

    log.ai.info('Local analysis used (fallback)', { articleId: article.id, sentiment, importanceScore });

    return {
        summary,
        sentiment,
        importance_score: importanceScore,
        importance_reason: `Matched ${(article.matched_keywords || []).length} keywords for ${clientName} (${industry}). Local rule-based analysis.`,
        narrative_frame: narrativeFrame,
        entities,
        claims: [],
    };
}

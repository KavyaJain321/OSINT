// ============================================================
// ROBIN OSINT — Local Embedding Generator (No External API)
// Generates 768-dim vectors using dense feature hashing
// Powers vector search via pgvector cosine similarity
// ============================================================

import { log } from '../lib/logger.js';

const VECTOR_DIM = 768;

// ─── Stop Words ──────────────────────────────────────────────
const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'is', 'it', 'its', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall',
    'can', 'this', 'that', 'these', 'those', 'there', 'here', 'where', 'when', 'while',
    'which', 'who', 'whom', 'whose', 'what', 'how', 'than', 'then', 'so', 'if', 'not', 'no',
    'nor', 'very', 'just', 'about', 'above', 'after', 'before', 'between', 'into', 'through',
    'during', 'out', 'up', 'down', 'over', 'under', 'again', 'further', 'once', 'also',
    'more', 'most', 'some', 'such', 'only', 'other', 'each', 'every', 'all', 'both', 'few',
    'many', 'any', 'own', 'same', 'too', 'as', 'until', 'because', 'since', 'said', 'says',
]);

// ─── Domain Term Weights ─────────────────────────────────────
const TERM_WEIGHTS = new Map();
const DOMAIN_TERMS = {
    finance: 'bank,banking,fiscal,monetary,inflation,gdp,deficit,debt,budget,revenue,stock,market,investment,fund,loan,credit,profit,loss,financial,economic,economy,trade,tariff,subsidy,tax,interest,rate,billion,million,percent,imf,fatf,forex,currency,rupee,dollar,treasury,bond,equity,asset,dividend',
    geopolitical: 'war,conflict,peace,treaty,sanctions,diplomatic,ambassador,embassy,nato,sovereignty,territory,border,military,army,navy,intelligence,nuclear,missile,weapons,ceasefire,invasion,occupation,alliance,defense,security',
    crisis: 'crisis,emergency,disaster,catastrophe,flood,earthquake,epidemic,pandemic,famine,drought,refugee,displaced,casualties,killed,injured,wounded,attack,bombing,terror,explosion,crash,collapse',
    governance: 'government,parliament,senate,congress,president,minister,election,vote,legislation,law,court,supreme,judge,verdict,arrest,prosecution,corruption,scandal,investigation,probe,inquiry,reform,policy,regulation',
};
for (const terms of Object.values(DOMAIN_TERMS)) {
    for (const t of terms.split(',')) TERM_WEIGHTS.set(t.trim(), 2.0);
}

/**
 * FNV-1a hash: string → uint32.
 */
function fnv1a(str, seed = 0) {
    let hash = 2166136261 ^ seed;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0; // ensure unsigned
}

/**
 * Tokenize text into clean words.
 */
function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * Get character trigrams from a word (captures morphology).
 * e.g., "banking" → ["ban","ank","nki","kin","ing"]
 */
function charTrigrams(word) {
    const trigrams = [];
    const padded = `#${word}#`;
    for (let i = 0; i < padded.length - 2; i++) {
        trigrams.push(padded.substring(i, i + 3));
    }
    return trigrams;
}

/**
 * Add a feature to the vector using multiple hash seeds.
 * 12 seeds per feature → each token activates ~60 dimensions → dense vectors.
 */
function addFeature(vec, feature, weight) {
    for (let seed = 0; seed < 12; seed++) {
        const idx = fnv1a(feature, seed * 997) % VECTOR_DIM;
        const sign = (fnv1a(feature, seed * 997 + 499) % 2 === 0) ? 1 : -1;
        vec[idx] += sign * weight;
    }
}

/**
 * Generate a dense 768-dimensional embedding vector from text.
 * Uses multi-level feature hashing: unigrams, bigrams, char-trigrams.
 *
 * @param {string} text - Text to embed
 * @returns {number[]|null} 768-dim L2-normalized vector
 */
export function generateLocalEmbedding(text) {
    if (!text || text.trim().length < 10) return null;

    const vec = new Float64Array(VECTOR_DIM);
    const tokens = tokenize(text);
    if (tokens.length === 0) return null;

    // ── 1. Unigram TF features ───────────────────────────
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);

    for (const [token, count] of tf) {
        const termFreq = 1 + Math.log(count);
        const idfWeight = TERM_WEIGHTS.get(token) || 1.0;
        addFeature(vec, `w:${token}`, termFreq * idfWeight);
    }

    // ── 2. Bigram features (word order) ──────────────────
    for (let i = 0; i < tokens.length - 1; i++) {
        const bigram = `b:${tokens[i]}_${tokens[i + 1]}`;
        addFeature(vec, bigram, 0.7);
    }

    // ── 3. Character trigram features (morphology) ───────
    for (const [token, count] of tf) {
        const triWeight = (0.3 * (1 + Math.log(count))) / Math.max(1, charTrigrams(token).length);
        for (const tri of charTrigrams(token)) {
            addFeature(vec, `c:${tri}`, triWeight);
        }
    }

    // ── 4. Title boost (first 15 tokens) ─────────────────
    for (let i = 0; i < Math.min(15, tokens.length); i++) {
        addFeature(vec, `t:${tokens[i]}`, 0.4);
    }

    // ── L2 Normalize ─────────────────────────────────────
    let norm = 0;
    for (let i = 0; i < VECTOR_DIM; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm === 0) return null;

    const result = new Array(VECTOR_DIM);
    for (let i = 0; i < VECTOR_DIM; i++) {
        result[i] = Math.round((vec[i] / norm) * 1e6) / 1e6;
    }

    return result;
}

/**
 * Generate embedding (async wrapper for compatibility).
 */
export async function generateEmbedding(text) {
    try {
        return generateLocalEmbedding(text);
    } catch (error) {
        log.ai.error('Local embedding failed', { error: error.message });
        return null;
    }
}

/**
 * Cosine similarity between two vectors (for testing).
 */
export function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

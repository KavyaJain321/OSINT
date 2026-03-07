// ============================================================
// ROBIN OSINT — Groq AI Client with Key Rotation + Fallback
// Rotates through multiple API keys; falls back to local analysis
// ============================================================

import Groq from 'groq-sdk';
import { config } from '../config.js';
import { log } from './logger.js';

// ─── API Keys (loaded from environment variables) ────────────
const API_KEYS = [];
for (let i = 1; i <= 20; i++) {
    const key = process.env[`GROQ_API_KEY_${i}`];
    if (key) API_KEYS.push(key);
}

// ─── Startup validation ─────────────────────────────────────
if (API_KEYS.length === 0) {
    console.error('[GROQ] CRITICAL: No API keys found in environment. Set GROQ_API_KEY_1 through GROQ_API_KEY_6 in .env');
    process.exit(1);
}
console.log(`[GROQ] Loaded ${API_KEYS.length} API key(s) from environment`);

let currentKeyIndex = 0;
let clients = API_KEYS.map(k => new Groq({ apiKey: k }));

function getClient() {
    return clients[currentKeyIndex % clients.length];
}

function rotateKey(reason) {
    const oldIdx = currentKeyIndex;
    currentKeyIndex = (currentKeyIndex + 1) % clients.length;
    log.ai.warn(`Rotating Groq key ${oldIdx} → ${currentKeyIndex} (${reason})`);
}

// ─── Models (ordered by preference) ─────────────────────────
const MODELS = [
    'llama-3.3-70b-versatile',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.1-8b-instant',
];

export const ANALYSIS_MODEL = MODELS[0];

/**
 * Groq chat with automatic key rotation and model fallback.
 * Tries each key, and if all keys fail for a model, tries the next model.
 */
export async function groqChat(messages, options = {}) {
    const errors = [];

    for (const model of MODELS) {
        // Try each key for this model
        for (let attempt = 0; attempt < clients.length; attempt++) {
            try {
                const client = getClient();
                const response = await client.chat.completions.create({
                    model,
                    temperature: 0.1,
                    max_tokens: 1500,
                    ...options,
                    messages,
                });
                return response;
            } catch (error) {
                const status = error.status || error.statusCode || 0;
                const msg = error.message || '';
                errors.push(`[key${currentKeyIndex}/${model}] ${status}: ${msg.substring(0, 80)}`);

                // Rotate key on rate limit (429), auth (401), or server errors (500+)
                if (status === 429 || status === 401 || status === 413 || status >= 500) {
                    rotateKey(`${status} on ${model}`);
                } else if (msg.includes('model_not_found') || msg.includes('does not exist')) {
                    // Skip to next model
                    break;
                } else {
                    rotateKey(msg.substring(0, 40));
                }

                // Small backoff
                await new Promise(r => setTimeout(r, 300 + attempt * 200));
            }
        }
    }

    // All keys and models exhausted
    const errSummary = errors.slice(-3).join(' | ');
    throw new Error(`All Groq keys/models exhausted. Last errors: ${errSummary}`);
}

/**
 * Generate embeddings via Groq (if available) — fails gracefully.
 */
export async function groqEmbed(text) {
    for (let attempt = 0; attempt < clients.length; attempt++) {
        try {
            const client = getClient();
            const response = await client.embeddings.create({
                model: 'nomic-embed-text',
                input: text,
            });
            return response.data[0].embedding;
        } catch (error) {
            rotateKey('embed-' + (error.status || 'err'));
            if (attempt === clients.length - 1) {
                log.ai.warn('Embedding unavailable, skipping');
                return null; // Don't block analysis if embeddings fail
            }
        }
    }
    return null;
}

/**
 * Get the current Groq client for streaming (with rotation support).
 */
export function getStreamClient() {
    return getClient();
}

export { MODELS };

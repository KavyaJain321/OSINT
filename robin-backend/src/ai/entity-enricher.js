// ============================================================
// ROBIN OSINT — Entity Auto-Enrichment
// LLM-powered research on named entities to build richer
// keyword seeds and monitoring context
// ============================================================

import Groq from 'groq-sdk';
import { config } from '../config.js';
import { log } from '../lib/logger.js';

const groq = new Groq({ apiKey: config.groqApiKey });
const MODEL = 'llama-3.3-70b-versatile';

/**
 * Research a named entity and return enriched context for keyword generation.
 *
 * @param {string} entityName - Company, org, or person name
 * @param {{ industry?: string, geography?: string[], briefContext?: string }} context
 * @returns {Promise<Object>} Enriched entity profile
 */
export async function enrichEntity(entityName, context = {}) {
    const startTime = Date.now();
    log.ai.info('Entity enrichment started', { entity: entityName });

    const prompt = `You are an intelligence researcher. Research this entity and provide comprehensive monitoring context.

ENTITY: ${entityName}
${context.industry ? `Industry: ${context.industry}` : ''}
${context.geography?.length ? `Geography: ${context.geography.join(', ')}` : ''}
${context.briefContext ? `Monitoring Context: ${context.briefContext.substring(0, 300)}` : ''}

Return ONLY valid JSON:
{
  "entity_type": "company|government|ngo|person|regulatory_body|media|other",
  "full_name": "official full name of the entity",
  "aliases": ["abbreviations", "alternate names", "stock tickers"],
  "description": "1-2 sentence description of what this entity does",
  
  "key_people": [
    { "name": "person name", "role": "CEO/Minister/Director etc", "relevance": "why they matter" }
  ],
  
  "subsidiaries_or_units": ["sub-organizations", "departments", "brands"],
  
  "competitors_or_peers": [
    { "name": "competitor name", "relationship": "direct competitor|peer|regulator|partner" }
  ],
  
  "recent_themes": [
    "recent controversy or news theme 1",
    "recent controversy or news theme 2",
    "ongoing initiative or project"
  ],
  
  "regulatory_context": {
    "regulators": ["regulatory body names"],
    "key_regulations": ["relevant laws or frameworks"],
    "compliance_risks": ["potential risk areas"]
  },
  
  "monitoring_keywords": [
    "entity-specific keyword 1",
    "entity-specific keyword 2"
  ],
  
  "risk_indicators": [
    "what would indicate trouble for this entity",
    "what signals should we watch for"
  ],
  
  "media_landscape": {
    "friendly_outlets": ["media outlets that cover this entity favorably"],
    "critical_outlets": ["media outlets that are critical"],
    "beat_reporters": ["journalists who cover this entity regularly"]
  }
}

Be factual. If you're unsure about specific details, mark them as approximate.
Return ONLY JSON, no explanation.`;

    try {
        const resp = await groq.chat.completions.create({
            model: MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 2000,
            response_format: { type: 'json_object' },
        });

        const enriched = JSON.parse(resp.choices[0].message.content);

        const elapsed = Date.now() - startTime;
        log.ai.info('Entity enrichment complete', {
            entity: entityName,
            type: enriched.entity_type,
            keyPeople: enriched.key_people?.length || 0,
            keywords: enriched.monitoring_keywords?.length || 0,
            ms: elapsed,
        });

        return enriched;
    } catch (err) {
        log.ai.error('Entity enrichment failed', { entity: entityName, error: err.message });
        // Return minimal profile on failure
        return {
            entity_type: 'other',
            full_name: entityName,
            aliases: [],
            description: '',
            key_people: [],
            subsidiaries_or_units: [],
            competitors_or_peers: [],
            recent_themes: [],
            regulatory_context: { regulators: [], key_regulations: [], compliance_risks: [] },
            monitoring_keywords: [],
            risk_indicators: [],
            media_landscape: { friendly_outlets: [], critical_outlets: [], beat_reporters: [] },
        };
    }
}

/**
 * Enrich multiple entities and merge their keywords into the brief's keyword set.
 *
 * @param {string[]} entityNames - List of entity names to enrich
 * @param {{ industry?: string, geography?: string[], briefContext?: string }} context
 * @returns {Promise<{ profiles: Object[], mergedKeywords: string[] }>}
 */
export async function enrichEntitiesForBrief(entityNames, context = {}) {
    const profiles = [];
    const mergedKeywords = new Set();

    for (const name of entityNames.slice(0, 5)) { // max 5 entities to avoid LLM overload
        const profile = await enrichEntity(name, context);
        profiles.push({ name, ...profile });

        // Merge monitoring keywords
        for (const kw of (profile.monitoring_keywords || [])) {
            mergedKeywords.add(kw);
        }

        // Add key people names as keywords
        for (const person of (profile.key_people || [])) {
            if (person.name) mergedKeywords.add(person.name);
        }

        // Add aliases
        for (const alias of (profile.aliases || [])) {
            mergedKeywords.add(alias);
        }

        // Add competitor names
        for (const comp of (profile.competitors_or_peers || [])) {
            if (comp.name) mergedKeywords.add(comp.name);
        }

        // Add regulator names
        for (const reg of (profile.regulatory_context?.regulators || [])) {
            mergedKeywords.add(reg);
        }
    }

    log.ai.info('Entity enrichment batch complete', {
        entities: entityNames.length,
        profiles: profiles.length,
        mergedKeywords: mergedKeywords.size,
    });

    return {
        profiles,
        mergedKeywords: [...mergedKeywords],
    };
}

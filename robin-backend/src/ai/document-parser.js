// ============================================================
// ROBIN OSINT — Document Parser
// Classifies and extracts intelligence from pasted documents:
// URLs, entity names, keywords, source metadata
// ============================================================

import Groq from 'groq-sdk';
import { config } from '../config.js';
import { log } from '../lib/logger.js';

const groq = new Groq({ apiKey: config.groqApiKey });
const MODEL = 'llama-3.3-70b-versatile';

/**
 * Parse a pasted document text to extract monitoring-relevant data.
 *
 * @param {string} documentText - The raw document text
 * @returns {Promise<Object>} Parsed document with extracted entities, URLs, and metadata
 */
export async function parseDocument(documentText) {
    const startTime = Date.now();
    log.ai.info('Document parsing started', { length: documentText.length });

    // Step 1: Extract URLs from the text (regex-based, fast)
    const urls = extractUrls(documentText);

    // Step 2: LLM-based document classification and entity extraction
    const prompt = `You are a document intelligence analyst. Analyze this document and extract monitoring-relevant data.

DOCUMENT TEXT (first 3000 chars):
${documentText.substring(0, 3000)}

EXTRACTED URLS: ${urls.length > 0 ? urls.slice(0, 20).join(', ') : 'None found'}

Analyze and return ONLY valid JSON:
{
  "document_type": "media_list|threat_brief|policy_document|research_report|press_release|directory|general",
  "document_summary": "2-3 sentence summary of what this document is about",
  
  "entities": [
    { "name": "entity name", "type": "person|org|location|media_outlet", "context": "role in document" }
  ],
  
  "sources": [
    { "name": "source name", "url": "https://...", "type": "rss|html|youtube|pdf", "tier": 1 }
  ],
  
  "keywords": ["extracted keyword 1", "keyword 2"],
  
  "topics": ["main topic 1", "topic 2"],
  
  "geographic_focus": ["country or region"],
  
  "monitoring_recommendations": [
    "recommendation for how to use this document for monitoring"
  ]
}

RULES:
- For media lists: extract every outlet with URL if available, suggest tiers based on circulation
- For threat briefs: extract threat indicators, entities at risk, suggested monitoring keywords
- For policy documents: extract regulatory bodies, compliance requirements, key dates
- Be specific — extract actual names, URLs, and data from the document`;

    try {
        const resp = await groq.chat.completions.create({
            model: MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 2000,
            response_format: { type: 'json_object' },
        });

        const parsed = JSON.parse(resp.choices[0].message.content);
        const elapsed = Date.now() - startTime;

        // Merge regex-extracted URLs with LLM-extracted sources
        const allUrls = new Set(urls);
        for (const source of (parsed.sources || [])) {
            if (source.url) allUrls.add(source.url);
        }

        log.ai.info('Document parsed', {
            type: parsed.document_type,
            entities: parsed.entities?.length || 0,
            sources: parsed.sources?.length || 0,
            urls: allUrls.size,
            keywords: parsed.keywords?.length || 0,
            ms: elapsed,
        });

        return {
            ...parsed,
            extracted_urls: [...allUrls],
            raw_url_count: urls.length,
        };
    } catch (err) {
        log.ai.error('Document parsing failed', { error: err.message });
        return {
            document_type: 'general',
            document_summary: 'Failed to parse document',
            entities: [],
            sources: [],
            keywords: [],
            topics: [],
            geographic_focus: [],
            monitoring_recommendations: [],
            extracted_urls: urls,
            raw_url_count: urls.length,
        };
    }
}

/**
 * Extract URLs from text using regex.
 */
function extractUrls(text) {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    const matches = text.match(urlRegex) || [];
    // Deduplicate and clean
    const cleaned = [...new Set(matches.map(url => {
        // Remove trailing punctuation
        return url.replace(/[.,;:!?)]+$/, '');
    }))];
    return cleaned;
}

/**
 * Generate a problem statement from a parsed document.
 * Used when intake_mode is 'document'.
 *
 * @param {Object} parsedDoc - Output from parseDocument
 * @returns {string} Generated problem statement
 */
export function generateProblemFromDocument(parsedDoc) {
    const parts = [];

    if (parsedDoc.document_summary) {
        parts.push(parsedDoc.document_summary);
    }

    if (parsedDoc.topics?.length > 0) {
        parts.push(`Key topics: ${parsedDoc.topics.join(', ')}.`);
    }

    if (parsedDoc.entities?.length > 0) {
        const entityNames = parsedDoc.entities.slice(0, 5).map(e => e.name);
        parts.push(`Key entities: ${entityNames.join(', ')}.`);
    }

    if (parsedDoc.geographic_focus?.length > 0) {
        parts.push(`Geographic focus: ${parsedDoc.geographic_focus.join(', ')}.`);
    }

    if (parsedDoc.monitoring_recommendations?.length > 0) {
        parts.push(`Monitoring focus: ${parsedDoc.monitoring_recommendations[0]}`);
    }

    return parts.join(' ') || 'Document-based monitoring brief';
}

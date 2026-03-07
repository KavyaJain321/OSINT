// ============================================================
// ROBIN OSINT — Watch Expression Matcher
// Evaluates watch expressions against analyzed content items
// to catch intelligence that keywords miss.
//
// Expression types:
// - semantic: embedding similarity match (future — needs vectors)
// - entity_sentiment: entity + sentiment condition
// - pattern_rule: field-based matching (importance, narrative_frame)
// - keyword_combo: multiple keywords co-occurring
// ============================================================

import { supabase } from '../lib/supabase.js';
import { log } from '../lib/logger.js';

/**
 * Evaluate all active watch expressions for a client against an analyzed content item.
 *
 * @param {Object} contentItem - The content item with analysis data
 * @param {string} contentItem.id
 * @param {string} contentItem.client_id
 * @param {string} contentItem.title
 * @param {string} contentItem.content
 * @param {Object} contentItem.analysis - article_analysis data
 * @param {string[]} [expressions] - Optional pre-fetched expressions (avoids extra query)
 * @returns {Promise<{ matched: Object[], total: number }>}
 */
export async function matchExpressions(contentItem, expressions = null) {
    // Fetch active expressions for this client if not provided
    if (!expressions) {
        const { data, error } = await supabase
            .from('watch_expressions')
            .select('*')
            .eq('client_id', contentItem.client_id)
            .eq('is_active', true);

        if (error) {
            log.ai.warn('Failed to fetch watch expressions', { error: error.message });
            return { matched: [], total: 0 };
        }
        expressions = data || [];
    }

    if (expressions.length === 0) {
        return { matched: [], total: 0 };
    }

    const matched = [];
    const analysis = contentItem.analysis || {};
    const fullText = `${contentItem.title || ''} ${contentItem.content || ''}`.toLowerCase();

    for (const expr of expressions) {
        let isMatch = false;

        try {
            switch (expr.expression_type) {
                case 'entity_sentiment':
                    isMatch = matchEntitySentiment(expr.expression, analysis, contentItem);
                    break;

                case 'pattern_rule':
                    isMatch = matchPatternRule(expr.expression, analysis);
                    break;

                case 'keyword_combo':
                    isMatch = matchKeywordCombo(expr.expression, fullText);
                    break;

                case 'semantic':
                    // Semantic matching requires embeddings — skip for now
                    // Future: compare contentItem.embedding against expr.expression.query_embedding
                    isMatch = false;
                    break;

                default:
                    break;
            }
        } catch (evalErr) {
            log.ai.warn('Expression evaluation error', {
                expressionId: expr.id,
                type: expr.expression_type,
                error: evalErr.message,
            });
        }

        if (isMatch) {
            matched.push({
                expression_id: expr.id,
                label: expr.label,
                expression_type: expr.expression_type,
                content_item_id: contentItem.id,
            });

            // Update match count (non-blocking)
            supabase
                .from('watch_expressions')
                .update({
                    match_count: (expr.match_count || 0) + 1,
                    last_matched_at: new Date().toISOString(),
                })
                .eq('id', expr.id)
                .then(() => { })
                .catch(() => { });
        }
    }

    if (matched.length > 0) {
        log.ai.info('Watch expressions matched', {
            contentId: contentItem.id,
            matches: matched.length,
            labels: matched.map(m => m.label),
        });
    }

    return { matched, total: expressions.length };
}

// ── Matcher implementations ────────────────────────────────

/**
 * Match entity + sentiment conditions.
 * Expression: { entity: "Opposition Party", sentiment: "negative", min_importance: 6 }
 */
function matchEntitySentiment(expression, analysis, contentItem) {
    const { entity, sentiment, min_importance } = expression;

    // Check if entity appears in the analysis entities
    const allEntities = [];
    const entities = analysis.entities || {};
    for (const names of Object.values(entities)) {
        if (Array.isArray(names)) allEntities.push(...names.map(n => n.toLowerCase()));
    }

    // Also check title/content for entity mention
    const text = `${contentItem.title || ''} ${contentItem.content || ''}`.toLowerCase();
    const entityMatch = entity
        ? (allEntities.includes(entity.toLowerCase()) || text.includes(entity.toLowerCase()))
        : true; // no entity filter = match all

    const sentimentMatch = sentiment
        ? analysis.sentiment === sentiment
        : true;

    const importanceMatch = min_importance
        ? (analysis.importance_score || 0) >= min_importance
        : true;

    return entityMatch && sentimentMatch && importanceMatch;
}

/**
 * Match field-based pattern rules.
 * Expression: { min_importance: 8, narrative_frame: "crisis", sentiment: "negative" }
 */
function matchPatternRule(expression, analysis) {
    const { min_importance, max_importance, narrative_frame, sentiment } = expression;

    if (min_importance && (analysis.importance_score || 0) < min_importance) return false;
    if (max_importance && (analysis.importance_score || 0) > max_importance) return false;
    if (narrative_frame && analysis.narrative_frame !== narrative_frame) return false;
    if (sentiment && analysis.sentiment !== sentiment) return false;

    return true;
}

/**
 * Match keyword co-occurrence.
 * Expression: { all: ["corruption", "minister"], any: ["arrested", "FIR", "probe"] }
 * "all" keywords must ALL appear. "any" keywords: at least ONE must appear.
 */
function matchKeywordCombo(expression, fullText) {
    const { all, any } = expression;

    // All keywords must appear
    if (all && Array.isArray(all)) {
        for (const kw of all) {
            if (!fullText.includes(kw.toLowerCase())) return false;
        }
    }

    // At least one of "any" keywords must appear
    if (any && Array.isArray(any)) {
        const anyMatch = any.some(kw => fullText.includes(kw.toLowerCase()));
        if (!anyMatch) return false;
    }

    return true;
}

/**
 * Generate watch expressions from keyword context using LLM.
 * Called by keyword-generator after keyword generation.
 *
 * @param {Object} context - Extracted brief context
 * @param {Object[]} keywords - Generated keywords
 * @returns {Object[]} Array of watch expression objects ready for DB insert
 */
export function generateWatchExpressions(context, keywords) {
    const expressions = [];

    // Auto-generate pattern rules for high-importance content
    expressions.push({
        expression_type: 'pattern_rule',
        label: 'Crisis Alert — High Importance Crisis Content',
        expression: { min_importance: 8, narrative_frame: 'crisis' },
    });

    expressions.push({
        expression_type: 'pattern_rule',
        label: 'Negative High-Impact Content',
        expression: { min_importance: 7, sentiment: 'negative' },
    });

    // Auto-generate entity+sentiment watches for key entities
    const entities = context.entities_of_interest || [];
    for (const entity of entities.slice(0, 5)) {
        expressions.push({
            expression_type: 'entity_sentiment',
            label: `Negative coverage: ${entity}`,
            expression: { entity, sentiment: 'negative', min_importance: 5 },
        });
    }

    // Auto-generate keyword combo watches from narrative triggers
    const narrativeKws = keywords
        .filter(k => k.category === 'narrative' || k.category === 'narrative_triggers')
        .map(k => k.keyword);

    if (narrativeKws.length >= 2) {
        // For each pair of narrative keywords, create a combo watch
        for (const entity of entities.slice(0, 3)) {
            expressions.push({
                expression_type: 'keyword_combo',
                label: `Narrative trigger: ${entity} + crisis language`,
                expression: {
                    all: [entity.toLowerCase()],
                    any: narrativeKws.slice(0, 5).map(k => k.toLowerCase()),
                },
            });
        }
    }

    // Generic crisis combo for the topic
    const coreKws = keywords
        .filter(k => k.category === 'core_entity' || k.category === 'primary')
        .slice(0, 3)
        .map(k => k.keyword.toLowerCase());

    if (coreKws.length > 0) {
        expressions.push({
            expression_type: 'keyword_combo',
            label: 'Core topic + crisis indicators',
            expression: {
                all: coreKws.slice(0, 2),
                any: ['scandal', 'investigation', 'probe', 'arrested', 'lawsuit', 'violation'],
            },
        });
    }

    log.ai.info('Watch expressions generated', { count: expressions.length });
    return expressions;
}

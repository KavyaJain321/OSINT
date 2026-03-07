// ============================================================
// Inference Engine — LLM-powered causal chain deduction
// Runs when pattern count > 3 OR on weekly schedule
// Makes non-obvious connections across articles and patterns
// ============================================================

import { supabase } from '../lib/supabase.js';
import { groqChat } from '../lib/groq.js';
import { log } from '../lib/logger.js';

// ── Gather context for inference ───────────────────────────
async function gatherInferenceContext(clientId) {
    const since72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const [artRes, patternRes, entityRes, threatRes] = await Promise.all([
        // Recent articles with analysis
        supabase.from('articles')
            .select('id, title, url, published_at, matched_keywords, source_id')
            .eq('client_id', clientId)
            .gte('published_at', since72h)
            .order('published_at', { ascending: false })
            .limit(40),

        // Active unacknowledged patterns
        supabase.from('intelligence_patterns')
            .select('pattern_type, title, description, confidence, severity, entities_involved')
            .eq('client_id', clientId)
            .eq('is_acknowledged', false)
            .order('detected_at', { ascending: false })
            .limit(15),

        // Top entity profiles
        supabase.from('entity_profiles')
            .select('entity_name, entity_type, mention_count, influence_score, risk_tags, relationships')
            .eq('client_id', clientId)
            .order('influence_score', { ascending: false })
            .limit(15),

        // Latest threat assessment
        supabase.from('threat_assessments')
            .select('overall_risk, risk_level, financial_risk, regulatory_risk, reputational_risk')
            .eq('client_id', clientId)
            .order('assessment_date', { ascending: false })
            .limit(1).single(),
    ]);

    // Get analyses for articles
    const articleIds = (artRes.data || []).map(a => a.id);
    const { data: analyses } = await supabase
        .from('article_analysis')
        .select('article_id, summary, sentiment, importance_score, entities, narrative_frame')
        .in('article_id', articleIds);

    const analysisMap = new Map((analyses || []).map(a => [a.article_id, a]));
    const articlesWithAnalysis = (artRes.data || []).map(a => ({
        ...a,
        analysis: analysisMap.get(a.id),
    })).filter(a => a.analysis); // only analyzed articles

    return {
        articles: articlesWithAnalysis,
        patterns: patternRes.data || [],
        entities: entityRes.data || [],
        threat: threatRes.data || null,
    };
}

// ── LLM inference call ─────────────────────────────────────
async function runInferenceLLM(context, clientName) {
    const articlesSummary = context.articles.slice(0, 25).map((a, i) =>
        `[A${i + 1}] "${a.title}" (${new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}) — sentiment:${a.analysis?.sentiment}, importance:${a.analysis?.importance_score}/10, keywords:[${(a.matched_keywords || []).join(', ')}]\n    Summary: ${a.analysis?.summary?.substring(0, 150)}`
    ).join('\n');

    const patternsSummary = context.patterns.map(p =>
        `[PATTERN] ${p.severity?.toUpperCase()}: ${p.title} — ${p.description?.substring(0, 120)}`
    ).join('\n');

    const entitiesSummary = context.entities.slice(0, 10).map(e =>
        `${e.entity_name} (${e.entity_type}): ${e.mention_count} mentions, influence:${e.influence_score?.toFixed(1)}, risk:[${(e.risk_tags || []).join(', ')}]`
    ).join('\n');

    const prompt = `You are a senior intelligence analyst conducting a structured inference analysis for ${clientName}.
Your task: examine the provided articles and patterns, then produce RIGOROUS causal reasoning.

Current threat level: ${context.threat?.risk_level || 'unknown'} (${context.threat?.overall_risk?.toFixed(0) || '?'}/100)

ARTICLES FROM LAST 72 HOURS:
${articlesSummary}

DETECTED PATTERNS:
${patternsSummary || 'None detected'}

ENTITY INTELLIGENCE:
${entitiesSummary}

ANALYSIS REQUIREMENTS — YOU MUST PRODUCE ALL OF THE FOLLOWING:

1. CAUSAL CHAIN DEDUCTIONS (minimum 2, maximum 5)
   Format each as: "[Entity/Event A] → [Because/which caused] → [Entity/Event B] → [Therefore likely] → [Conclusion]"
   Evidence requirement: each link in the chain must cite a specific article by [A#] number
   Strength rating: HIGH (3+ corroborating articles), MEDIUM (2 articles), LOW (1 article or inference)

2. ABSENCE ANALYSIS — What is NOT being covered?
   Identify 2-3 topics that SHOULD be generating coverage given current events but are conspicuously absent.
   Explain WHY the absence may be significant (suppression? resolution? oversight?).

3. 14-DAY SCENARIO PROJECTIONS (exactly 3 scenarios: base case, upside, downside)
   Each scenario must include:
   - Probability estimate (must sum to approximately 1.0 across all 3)
   - Specific trigger event that would confirm this scenario
   - Recommended action if this scenario materializes

4. PRIORITY ACTION
   ONE specific action the intelligence consumer should take in the next 48 hours.
   Format: "[Action verb] [specific entity/topic] [because] [evidence] [by] [deadline]"

Respond ONLY with valid JSON matching this schema:
{
  "causal_chains": [
    {
      "chain": "A → B → C → Conclusion",
      "evidence_articles": ["A1", "A3"],
      "strength": "HIGH|MEDIUM|LOW",
      "confidence": 0.0-1.0
    }
  ],
  "absence_signals": [
    {
      "missing_topic": "description",
      "why_expected": "reason it should be covered",
      "significance": "what the absence might mean"
    }
  ],
  "scenarios": [
    {
      "label": "Base Case|Upside|Downside",
      "description": "what happens",
      "probability": 0.0-1.0,
      "trigger_indicator": "what to watch for",
      "recommended_action": "what to do"
    }
  ],
  "priority_action": {
    "action": "specific action statement",
    "urgency": "immediate|24h|48h|this_week",
    "evidence_basis": "why this action is warranted"
  }
}`;

    const resp = await groqChat(
        [{ role: 'user', content: prompt }],
        { temperature: 0.35, max_tokens: 2500, response_format: { type: 'json_object' } }
    );

    return JSON.parse(resp.choices[0].message.content);
}

// ── Persist inference results ──────────────────────────────
async function saveInferenceChains(clientId, result) {
    const {
        causal_chains = [],
        absence_signals = [],
        scenarios = [],
        priority_action = null,
    } = result;

    // Save each causal chain as an inference_chain row
    for (const chain of causal_chains) {
        await supabase.from('inference_chains').insert({
            client_id: clientId,
            title: chain.chain?.substring(0, 200) || 'Untitled chain',
            chain_steps: [{ chain: chain.chain, articles: chain.evidence_articles }],
            conclusion: chain.chain,
            conclusion_confidence: chain.confidence || 0.5,
            severity: chain.strength === 'HIGH' ? 'high' : chain.strength === 'LOW' ? 'low' : 'medium',
            scenario_7d: scenarios,
            priority_action,
            absence_signals,
        });
    }

    // If no causal chains but we have other data, save a summary row
    if (causal_chains.length === 0 && (scenarios.length > 0 || priority_action)) {
        await supabase.from('inference_chains').insert({
            client_id: clientId,
            title: 'Intelligence Assessment Summary',
            chain_steps: [],
            conclusion: priority_action?.action || 'No causal chains identified',
            conclusion_confidence: 0.5,
            severity: 'medium',
            scenario_7d: scenarios,
            priority_action,
            absence_signals,
        });
    }

    log.ai.info('Inference chains saved', {
        clientId,
        chains: causal_chains.length,
        absences: absence_signals.length,
        scenarios: scenarios.length,
        hasAction: !!priority_action,
    });
}

// ── Public API ─────────────────────────────────────────────

/**
 * Run inference engine for a client.
 * Should only be called when pattern count >= 3 or on weekly schedule.
 *
 * @param {string} clientId
 * @param {string} clientName
 */
export async function runInferenceEngine(clientId, clientName) {
    const startTime = Date.now();
    log.ai.info('Inference engine starting', { clientId, clientName });

    try {
        // Check if we have enough data to be useful
        const { count: patternCount } = await supabase
            .from('intelligence_patterns')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', clientId)
            .eq('is_acknowledged', false);

        if ((patternCount || 0) < 1) {
            log.ai.info('Inference skipped — insufficient patterns', { clientId, patterns: patternCount });
            return;
        }

        const context = await gatherInferenceContext(clientId);
        if (context.articles.length < 5) {
            log.ai.info('Inference skipped — insufficient articles', { clientId, articles: context.articles.length });
            return;
        }

        const result = await runInferenceLLM(context, clientName);
        await saveInferenceChains(clientId, result);

        log.ai.info('Inference engine complete', {
            clientId,
            deductions: result.deductions?.length || 0,
            ms: Date.now() - startTime,
        });

        return result;
    } catch (err) {
        log.ai.error('Inference engine failed', { clientId, error: err.message });
    }
}

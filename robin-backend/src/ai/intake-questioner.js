// ============================================================
// ROBIN OSINT — Smart Follow-Up Questions
// Generates context-specific follow-up questions after
// understanding the initial intake input.
// ============================================================

import Groq from 'groq-sdk';
import { config } from '../config.js';
import { log } from '../lib/logger.js';

const groq = new Groq({ apiKey: config.groqApiKey });
const MODEL = 'llama-3.3-70b-versatile';

/**
 * Generate context-specific follow-up questions based on the intake input.
 *
 * @param {string} input - The raw input text (problem description, entity names, or document text)
 * @param {'describe'|'entity'|'document'} intakeMode - Which intake mode was used
 * @param {{ title?: string, industry?: string }} context - Additional context
 * @returns {Promise<{ questions: Object[], inputSummary: string }>}
 */
export async function generateFollowUps(input, intakeMode = 'describe', context = {}) {
    const startTime = Date.now();
    log.ai.info('Generating follow-up questions', { mode: intakeMode });

    const modeInstructions = {
        describe: `The user described their monitoring need as:
"${input.substring(0, 500)}"

Generate questions to help refine the scope, identify key entities, geography, competitors, and alert sensitivity.`,

        entity: `The user wants to monitor these entities: ${input}
${context.title ? `Context: ${context.title}` : ''}

Generate questions about what ASPECTS of these entities to monitor (financial health? PR crises? regulatory issues? competitive moves?), geographic focus, and related entities to also track.`,

        document: `The user pasted a document. Summary of document content:
"${input.substring(0, 800)}"

Classify the document type (media list, threat brief, policy document, etc.) and generate questions about what to extract from it, monitoring goals, and priority areas.`,
    };

    const prompt = `You are an OSINT intake specialist helping configure an intelligence monitoring system.

${modeInstructions[intakeMode] || modeInstructions.describe}

Generate 3-5 follow-up questions that will help the system better understand what to monitor.

RULES:
- Questions should be specific and actionable, not generic
- Each question should have 2-3 suggested answers (so the user can just click)
- Questions should help identify: entities, geography, competitors, risk domains, alert sensitivity
- Order from most important to least important

Return ONLY valid JSON:
{
  "input_summary": "1-2 sentence summary of what the user wants to monitor",
  "document_type": "media_list|threat_brief|policy_doc|report|general|null",
  "questions": [
    {
      "id": "q1",
      "question": "What specific aspects of [entity] concern you most?",
      "type": "single_choice|multi_choice|text",
      "suggested_answers": [
        "Financial health & market position",
        "Regulatory & compliance risks",
        "PR crises & reputation",
        "Competitive landscape"
      ],
      "importance": "high|medium|low"
    }
  ]
}`;

    try {
        const resp = await groq.chat.completions.create({
            model: MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.4,
            max_tokens: 1500,
            response_format: { type: 'json_object' },
        });

        const parsed = JSON.parse(resp.choices[0].message.content);
        const elapsed = Date.now() - startTime;

        log.ai.info('Follow-up questions generated', {
            mode: intakeMode,
            questions: parsed.questions?.length || 0,
            ms: elapsed,
        });

        return {
            questions: parsed.questions || [],
            inputSummary: parsed.input_summary || '',
            documentType: parsed.document_type || null,
        };
    } catch (err) {
        log.ai.error('Follow-up generation failed', { error: err.message });
        // Return sensible defaults
        return {
            questions: getDefaultQuestions(intakeMode),
            inputSummary: '',
            documentType: null,
        };
    }
}

/**
 * Default questions if LLM fails.
 */
function getDefaultQuestions(intakeMode) {
    const defaults = {
        describe: [
            {
                id: 'q1', question: 'What is your primary geographic focus?',
                type: 'single_choice', importance: 'high',
                suggested_answers: ['India', 'United States', 'Middle East', 'Europe', 'Global'],
            },
            {
                id: 'q2', question: 'What type of risks are you most concerned about?',
                type: 'multi_choice', importance: 'high',
                suggested_answers: ['Regulatory/Legal', 'Reputational', 'Financial', 'Competitive', 'Geopolitical'],
            },
            {
                id: 'q3', question: 'How sensitive should alerts be?',
                type: 'single_choice', importance: 'medium',
                suggested_answers: ['High (notify on any mention)', 'Medium (significant developments only)', 'Low (only critical/crisis events)'],
            },
        ],
        entity: [
            {
                id: 'q1', question: 'What aspects of this entity concern you most?',
                type: 'multi_choice', importance: 'high',
                suggested_answers: ['Financial performance', 'Regulatory issues', 'Leadership changes', 'Competitive moves', 'Crisis/PR issues'],
            },
            {
                id: 'q2', question: 'Should we also track competitors?',
                type: 'single_choice', importance: 'medium',
                suggested_answers: ['Yes, auto-detect competitors', 'Yes, I\'ll specify them', 'No, focus only on the named entity'],
            },
        ],
        document: [
            {
                id: 'q1', question: 'What is the primary purpose of this document?',
                type: 'single_choice', importance: 'high',
                suggested_answers: ['Media/source list', 'Threat briefing', 'Policy document', 'Research report', 'Other'],
            },
            {
                id: 'q2', question: 'What should we extract from it?',
                type: 'multi_choice', importance: 'high',
                suggested_answers: ['Source URLs for monitoring', 'Entity names', 'Keywords/topics', 'Geographic context'],
            },
        ],
    };
    return defaults[intakeMode] || defaults.describe;
}

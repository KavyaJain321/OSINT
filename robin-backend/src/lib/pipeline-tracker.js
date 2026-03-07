// ============================================================
// ROBIN OSINT — Pipeline Progress Tracker
// Tracks the status of the brief→scrape→analyze→intelligence pipeline
// Uses in-memory state + system_state DB for persistence
// ============================================================

import { supabase } from './supabase.js';
import { log } from './logger.js';

const PIPELINE_KEY = 'pipeline_progress';

// Stage definitions with labels and order
const STAGES = [
    { id: 'idle', number: 0, total: 6, label: 'Idle' },
    { id: 'keywords', number: 1, total: 6, label: 'Generating Keywords' },
    { id: 'sources', number: 2, total: 6, label: 'Discovering Sources' },
    { id: 'scraping', number: 3, total: 6, label: 'Scraping Sources' },
    { id: 'analysis', number: 4, total: 6, label: 'AI Article Analysis' },
    { id: 'intelligence', number: 5, total: 6, label: 'Intelligence Engine' },
    { id: 'complete', number: 6, total: 6, label: 'Pipeline Complete' },
];

// In-memory progress state (fast reads, no DB round-trip)
let currentProgress = {
    stage: 'idle',
    stageNumber: 0,
    totalStages: 6,
    label: 'Idle',
    message: '',
    startedAt: null,
    completedAt: null,
    details: {},
};

/**
 * Update the pipeline stage.
 * @param {string} stage - Stage ID (keywords, sources, scraping, analysis, intelligence, complete)
 * @param {string} message - Human-readable status message
 * @param {Object} details - Extra details (e.g. { sourcesScraped: 10, totalSources: 85 })
 */
export async function updatePipelineStage(stage, message = '', details = {}) {
    const stageInfo = STAGES.find(s => s.id === stage);
    if (!stageInfo) {
        log.system.warn('Unknown pipeline stage: ' + stage);
        return;
    }

    const now = new Date().toISOString();

    currentProgress = {
        stage: stageInfo.id,
        stageNumber: stageInfo.number,
        totalStages: stageInfo.total,
        label: stageInfo.label,
        message: message || stageInfo.label,
        startedAt: currentProgress.stage === 'idle' ? now : currentProgress.startedAt,
        completedAt: stage === 'complete' ? now : null,
        details: { ...details },
    };

    log.system.info('[PIPELINE] ' + stageInfo.label + ' — ' + (message || ''), details);

    // Persist to DB (fire-and-forget for speed)
    try {
        await supabase.from('system_state').upsert({
            key: PIPELINE_KEY,
            value: JSON.stringify(currentProgress),
            updated_at: now,
        });
    } catch {
        // Non-critical — in-memory state is the primary source
    }
}

/**
 * Get current pipeline progress.
 * @returns {Object} Progress state
 */
export function getPipelineProgress() {
    return { ...currentProgress };
}

/**
 * Reset pipeline to idle state.
 */
export async function resetPipeline() {
    currentProgress = {
        stage: 'idle',
        stageNumber: 0,
        totalStages: 6,
        label: 'Idle',
        message: '',
        startedAt: null,
        completedAt: null,
        details: {},
    };

    try {
        await supabase.from('system_state').upsert({
            key: PIPELINE_KEY,
            value: JSON.stringify(currentProgress),
            updated_at: new Date().toISOString(),
        });
    } catch { /* non-critical */ }
}

/**
 * Load pipeline progress from DB on server start (in case of restart mid-pipeline).
 */
export async function loadPipelineProgress() {
    try {
        const { data } = await supabase
            .from('system_state')
            .select('value')
            .eq('key', PIPELINE_KEY)
            .single();

        if (data?.value) {
            const parsed = JSON.parse(data.value);
            // If pipeline was running when server crashed, mark as idle
            if (parsed.stage !== 'complete' && parsed.stage !== 'idle') {
                parsed.stage = 'idle';
                parsed.stageNumber = 0;
                parsed.label = 'Idle';
                parsed.message = 'Pipeline was interrupted — submit a new brief to restart';
            }
            currentProgress = parsed;
        }
    } catch {
        // system_state may not exist yet — that's fine
    }
}

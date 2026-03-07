// ============================================================
// ROBIN OSINT — Structured Logger
// JSON in production (Railway log parsing), colored in dev
// ============================================================

import { config } from '../config.js';

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const COLORS = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';

function formatMessage(level, prefix, message, data = {}) {
    const timestamp = new Date().toISOString();

    if (config.isProduction) {
        // JSON format for Railway log parsing
        const logEntry = { timestamp, level, prefix, message, ...data };
        return JSON.stringify(logEntry);
    }

    // Human-readable colored format for development
    const color = COLORS[level] || '';
    const dataStr = Object.keys(data).length > 0
        ? ' | ' + Object.entries(data).map(([k, v]) => `${k}=${v}`).join(' ')
        : '';
    return `${color}[${timestamp}] [${level.toUpperCase()}] [${prefix}]${RESET} ${message}${dataStr}`;
}

function createLogger(prefix) {
    return {
        debug: (msg, data) => console.debug(formatMessage('debug', prefix, msg, data)),
        info: (msg, data) => console.log(formatMessage('info', prefix, msg, data)),
        warn: (msg, data) => console.warn(formatMessage('warn', prefix, msg, data)),
        error: (msg, data) => console.error(formatMessage('error', prefix, msg, data)),
    };
}

// Pre-built loggers for each subsystem
export const log = {
    scraper: createLogger('Scraper'),
    ai: createLogger('AI'),
    chat: createLogger('Chat'),
    auth: createLogger('Auth'),
    api: createLogger('API'),
    cron: createLogger('Cron'),
    system: createLogger('System'),
};

// Generic logger factory for custom prefixes
export { createLogger };

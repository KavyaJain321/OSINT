// ============================================================
// ROBIN OSINT — Rate Limiters
// ============================================================

import rateLimit from 'express-rate-limit';

// General API: 100 requests per 15 minutes per IP
export const defaultLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
});

// Auth endpoints: 10 requests per 15 minutes
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please wait.' },
});

// Chat endpoint: 20 requests per hour per IP
export const chatLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Chat rate limit reached. Please wait before sending more messages.' },
});

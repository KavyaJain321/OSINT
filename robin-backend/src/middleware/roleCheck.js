// ============================================================
// ROBIN OSINT — Role & Client Isolation Middleware
// ============================================================

/**
 * Require one of the specified roles.
 * @param  {...string} allowedRoles - e.g. 'SUPER_ADMIN', 'ADMIN'
 */
export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

/**
 * Ensure user can only access their own client's resources.
 * SUPER_ADMIN bypasses this check.
 * Checks clientId from params, body, or query.
 */
export function requireSameClient() {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        // SUPER_ADMIN can access any client
        if (req.user.role === 'SUPER_ADMIN') {
            return next();
        }

        // Extract clientId from request
        const requestClientId = req.params.clientId || req.body?.clientId || req.query?.clientId;

        // If a specific clientId is requested, verify it matches
        if (requestClientId && requestClientId !== req.user.clientId) {
            return res.status(403).json({ error: 'Access denied to this client\'s resources' });
        }

        next();
    };
}

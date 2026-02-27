const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

// Verify JWT access token
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Check user role
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

// Check project access (ADMIN bypasses)
async function checkProjectAccess(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    // ADMIN has access to all projects
    if (req.user.role === 'ADMIN') {
        return next();
    }

    const projectId = req.params.id || req.params.projectId || req.body.project_id || req.query.project;
    if (!projectId) {
        return next(); // No project context, let route handler decide
    }

    try {
        const result = await pool.query(
            'SELECT id FROM project_users WHERE user_id = $1 AND project_id = $2',
            [req.user.id, projectId]
        );
        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'No access to this project' });
        }
        next();
    } catch (err) {
        next(err);
    }
}

module.exports = { authenticate, authorize, checkProjectAccess };

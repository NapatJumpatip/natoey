const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/users - List all users (Admin only)
router.get('/', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.name, u.email, u.role, u.created_at,
        ARRAY_AGG(DISTINCT p.name) FILTER (WHERE p.name IS NOT NULL) as projects
       FROM users u
       LEFT JOIN project_users pu ON pu.user_id = u.id
       LEFT JOIN projects p ON p.id = pu.project_id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/users - Create user (Admin only)
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const password_hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);
        const result = await pool.query(
            'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, created_at',
            [name, email, password_hash, role || 'VIEWER']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Email already exists' });
        }
        console.error('Create user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/users/:id - Update user (Admin only)
router.put('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const { name, email, role, password } = req.body;
        let query, params;
        if (password) {
            const password_hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);
            query = 'UPDATE users SET name=$1, email=$2, role=$3, password_hash=$4 WHERE id=$5 RETURNING id, name, email, role, created_at';
            params = [name, email, role, password_hash, req.params.id];
        } else {
            query = 'UPDATE users SET name=$1, email=$2, role=$3 WHERE id=$4 RETURNING id, name, email, role, created_at';
            params = [name, email, role, req.params.id];
        }
        const result = await pool.query(query, params);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/users/:id - Delete user (Admin only)
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        // Prevent self-deletion
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User deleted' });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

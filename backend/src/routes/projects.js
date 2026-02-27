const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, authorize, checkProjectAccess } = require('../middleware/auth');

// GET /api/projects
router.get('/', authenticate, async (req, res) => {
    try {
        let query, params;
        if (req.user.role === 'ADMIN') {
            query = `SELECT p.*, 
        (SELECT COUNT(*) FROM documents d WHERE d.project_id = p.id) as doc_count,
        (SELECT COALESCE(SUM(d.net_total), 0) FROM documents d WHERE d.project_id = p.id AND d.doc_type IN ('INVOICE', 'TAX_INVOICE', 'RECEIPT')) as total_income,
        (SELECT COALESCE(SUM(d.net_total), 0) FROM documents d WHERE d.project_id = p.id AND d.doc_type IN ('PO', 'VENDOR_PAYMENT')) as total_expense
        FROM projects p ORDER BY p.created_at DESC`;
            params = [];
        } else {
            query = `SELECT p.*,
        (SELECT COUNT(*) FROM documents d WHERE d.project_id = p.id) as doc_count,
        (SELECT COALESCE(SUM(d.net_total), 0) FROM documents d WHERE d.project_id = p.id AND d.doc_type IN ('INVOICE', 'TAX_INVOICE', 'RECEIPT')) as total_income,
        (SELECT COALESCE(SUM(d.net_total), 0) FROM documents d WHERE d.project_id = p.id AND d.doc_type IN ('PO', 'VENDOR_PAYMENT')) as total_expense
        FROM projects p
        JOIN project_users pu ON pu.project_id = p.id
        WHERE pu.user_id = $1
        ORDER BY p.created_at DESC`;
            params = [req.user.id];
        }
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Get projects error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/projects/:id
router.get('/:id', authenticate, checkProjectAccess, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*,
        (SELECT COUNT(*) FROM documents d WHERE d.project_id = p.id) as doc_count,
        (SELECT COALESCE(SUM(d.net_total), 0) FROM documents d WHERE d.project_id = p.id AND d.doc_type IN ('INVOICE', 'TAX_INVOICE', 'RECEIPT')) as total_income,
        (SELECT COALESCE(SUM(d.net_total), 0) FROM documents d WHERE d.project_id = p.id AND d.doc_type IN ('PO', 'VENDOR_PAYMENT')) as total_expense
       FROM projects p WHERE p.id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get assigned users
        const users = await pool.query(
            `SELECT u.id, u.name, u.email, u.role FROM users u
       JOIN project_users pu ON pu.user_id = u.id
       WHERE pu.project_id = $1`,
            [req.params.id]
        );

        // Get recent documents
        const docs = await pool.query(
            `SELECT id, doc_type, doc_number, subtotal, net_total, status, due_date, created_at
       FROM documents WHERE project_id = $1 ORDER BY created_at DESC LIMIT 10`,
            [req.params.id]
        );

        res.json({ ...result.rows[0], users: users.rows, recent_documents: docs.rows });
    } catch (err) {
        console.error('Get project error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/projects
router.post('/', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const { project_code, name, client, location, start_date, end_date, status, contract_value, vat_rate } = req.body;
        const result = await pool.query(
            `INSERT INTO projects (project_code, name, client, location, start_date, end_date, status, contract_value, vat_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
            [project_code, name, client, location, start_date, end_date, status || 'PLANNING', contract_value || 0, vat_rate || 0.07]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Project code already exists' });
        }
        console.error('Create project error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/projects/:id
router.put('/:id', authenticate, authorize('ADMIN', 'EDITOR'), checkProjectAccess, async (req, res) => {
    try {
        const { name, client, location, start_date, end_date, status, contract_value, vat_rate } = req.body;
        const result = await pool.query(
            `UPDATE projects SET name=$1, client=$2, location=$3, start_date=$4, end_date=$5, status=$6, contract_value=$7, vat_rate=$8
       WHERE id = $9 RETURNING *`,
            [name, client, location, start_date, end_date, status, contract_value, vat_rate, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update project error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/projects/:id
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json({ message: 'Project deleted' });
    } catch (err) {
        console.error('Delete project error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/projects/:id/users - Assign user to project
router.post('/:id/users', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const { user_id } = req.body;
        await pool.query(
            'INSERT INTO project_users (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [user_id, req.params.id]
        );
        res.status(201).json({ message: 'User assigned to project' });
    } catch (err) {
        console.error('Assign user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

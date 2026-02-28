const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/employees - List all employees
router.get('/', authenticate, async (req, res) => {
    try {
        const { status, search, project_id } = req.query;
        const params = [];
        let filters = [];

        if (status) {
            params.push(status);
            filters.push(`e.status = $${params.length}`);
        }
        if (search) {
            params.push(`%${search}%`);
            filters.push(`(e.first_name ILIKE $${params.length} OR e.last_name ILIKE $${params.length} OR e.employee_code ILIKE $${params.length} OR e.nickname ILIKE $${params.length})`);
        }
        if (project_id) {
            params.push(project_id);
            filters.push(`e.id IN (SELECT employee_id FROM employee_projects WHERE project_id = $${params.length})`);
        }

        const whereClause = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';

        const result = await pool.query(
            `SELECT e.*,
                COALESCE(
                    json_agg(
                        json_build_object('project_id', ep.project_id, 'project_name', p.name, 'project_code', p.project_code, 'role', ep.role)
                    ) FILTER (WHERE ep.project_id IS NOT NULL), '[]'
                ) as projects
             FROM employees e
             LEFT JOIN employee_projects ep ON ep.employee_id = e.id
             LEFT JOIN projects p ON p.id = ep.project_id
             ${whereClause}
             GROUP BY e.id
             ORDER BY e.created_at DESC`, params
        );

        res.json(result.rows);
    } catch (err) {
        console.error('List employees error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/employees/:id - Get single employee
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT e.*,
                COALESCE(
                    json_agg(
                        json_build_object('project_id', ep.project_id, 'project_name', p.name, 'project_code', p.project_code, 'role', ep.role)
                    ) FILTER (WHERE ep.project_id IS NOT NULL), '[]'
                ) as projects
             FROM employees e
             LEFT JOIN employee_projects ep ON ep.employee_id = e.id
             LEFT JOIN projects p ON p.id = ep.project_id
             WHERE e.id = $1
             GROUP BY e.id`, [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get employee error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/employees - Create employee
router.post('/', authenticate, authorize('ADMIN', 'EDITOR'), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            employee_code, first_name, last_name, nickname, position, department,
            phone, email, id_card, bank_account, bank_name,
            daily_wage, monthly_salary, start_date, end_date, status, notes,
            project_ids
        } = req.body;

        const empResult = await client.query(
            `INSERT INTO employees (employee_code, first_name, last_name, nickname, position, department,
             phone, email, id_card, bank_account, bank_name, daily_wage, monthly_salary,
             start_date, end_date, status, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
             RETURNING *`,
            [employee_code, first_name, last_name, nickname || null, position || null, department || null,
                phone || null, email || null, id_card || null, bank_account || null, bank_name || null,
                daily_wage || 0, monthly_salary || 0, start_date || null, end_date || null,
                status || 'ACTIVE', notes || null, req.user.id]
        );

        const employee = empResult.rows[0];

        // Assign to projects
        if (project_ids && project_ids.length > 0) {
            for (const pid of project_ids) {
                await client.query(
                    `INSERT INTO employee_projects (employee_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [employee.id, pid]
                );
            }
        }

        await client.query('COMMIT');

        // Fetch with projects
        const full = await pool.query(
            `SELECT e.*,
                COALESCE(json_agg(json_build_object('project_id', ep.project_id, 'project_name', p.name, 'project_code', p.project_code, 'role', ep.role)) FILTER (WHERE ep.project_id IS NOT NULL), '[]') as projects
             FROM employees e LEFT JOIN employee_projects ep ON ep.employee_id = e.id LEFT JOIN projects p ON p.id = ep.project_id
             WHERE e.id = $1 GROUP BY e.id`, [employee.id]
        );

        res.status(201).json(full.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create employee error:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Employee code already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// PUT /api/employees/:id - Update employee
router.put('/:id', authenticate, authorize('ADMIN', 'EDITOR'), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { id } = req.params;
        const {
            employee_code, first_name, last_name, nickname, position, department,
            phone, email, id_card, bank_account, bank_name,
            daily_wage, monthly_salary, start_date, end_date, status, notes,
            project_ids
        } = req.body;

        const empResult = await client.query(
            `UPDATE employees SET
             employee_code=$1, first_name=$2, last_name=$3, nickname=$4, position=$5,
             department=$6, phone=$7, email=$8, id_card=$9, bank_account=$10,
             bank_name=$11, daily_wage=$12, monthly_salary=$13, start_date=$14,
             end_date=$15, status=$16, notes=$17, updated_at=NOW()
             WHERE id=$18 RETURNING *`,
            [employee_code, first_name, last_name, nickname || null, position || null,
                department || null, phone || null, email || null, id_card || null,
                bank_account || null, bank_name || null, daily_wage || 0, monthly_salary || 0,
                start_date || null, end_date || null, status || 'ACTIVE', notes || null, id]
        );

        if (empResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Update project assignments
        if (project_ids !== undefined) {
            await client.query('DELETE FROM employee_projects WHERE employee_id = $1', [id]);
            for (const pid of (project_ids || [])) {
                await client.query(
                    `INSERT INTO employee_projects (employee_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [id, pid]
                );
            }
        }

        await client.query('COMMIT');

        const full = await pool.query(
            `SELECT e.*,
                COALESCE(json_agg(json_build_object('project_id', ep.project_id, 'project_name', p.name, 'project_code', p.project_code, 'role', ep.role)) FILTER (WHERE ep.project_id IS NOT NULL), '[]') as projects
             FROM employees e LEFT JOIN employee_projects ep ON ep.employee_id = e.id LEFT JOIN projects p ON p.id = ep.project_id
             WHERE e.id = $1 GROUP BY e.id`, [id]
        );

        res.json(full.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update employee error:', err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Employee code already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// DELETE /api/employees/:id - Delete employee
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM employees WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json({ message: 'Employee deleted' });
    } catch (err) {
        console.error('Delete employee error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/employees/stats/summary - Employee stats
router.get('/stats/summary', authenticate, async (req, res) => {
    try {
        const total = await pool.query('SELECT COUNT(*) as count FROM employees WHERE status = $1', ['ACTIVE']);
        const byDept = await pool.query(
            `SELECT department, COUNT(*) as count FROM employees WHERE status = 'ACTIVE' AND department IS NOT NULL GROUP BY department ORDER BY count DESC`
        );
        const totalWage = await pool.query(
            `SELECT COALESCE(SUM(daily_wage), 0) as daily_total, COALESCE(SUM(monthly_salary), 0) as monthly_total FROM employees WHERE status = 'ACTIVE'`
        );
        res.json({
            active_count: parseInt(total.rows[0].count),
            by_department: byDept.rows,
            daily_wage_total: parseFloat(totalWage.rows[0].daily_total),
            monthly_salary_total: parseFloat(totalWage.rows[0].monthly_total),
        });
    } catch (err) {
        console.error('Employee stats error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, authorize, checkProjectAccess } = require('../middleware/auth');

// Generate next document number
async function getNextDocNumber(client, docType) {
    const prefixMap = {
        'QUOTATION': 'QT',
        'INVOICE': 'INV',
        'TAX_INVOICE': 'TIV',
        'RECEIPT': 'RCT',
        'PO': 'PO',
        'VENDOR_PAYMENT': 'VP',
        'ADVANCE': 'ADV',
        'CLEARANCE': 'CLR'
    };
    const prefix = prefixMap[docType] || 'DOC';
    const year = new Date().getFullYear();

    // Upsert the sequence
    const result = await client.query(
        `INSERT INTO doc_sequences (prefix, year, last_number)
     VALUES ($1, $2, 1)
     ON CONFLICT (prefix, year)
     DO UPDATE SET last_number = doc_sequences.last_number + 1
     RETURNING last_number`,
        [prefix, year]
    );

    const num = String(result.rows[0].last_number).padStart(4, '0');
    return `${prefix}-${year}-${num}`;
}

// Calculate financials
function calculateFinancials(subtotal, vatRate, whtRate, docType) {
    const vat_amount = parseFloat((subtotal * vatRate).toFixed(2));
    const wht_amount = parseFloat((subtotal * whtRate).toFixed(2));

    // Income docs: net = subtotal + VAT - WHT
    // Expense docs: net = subtotal + VAT
    const incomeTypes = ['QUOTATION', 'INVOICE', 'TAX_INVOICE', 'RECEIPT'];
    let net_total;
    if (incomeTypes.includes(docType)) {
        net_total = parseFloat((subtotal + vat_amount - wht_amount).toFixed(2));
    } else {
        net_total = parseFloat((subtotal + vat_amount).toFixed(2));
    }

    return { vat_amount, wht_amount, net_total };
}

// GET /api/documents
router.get('/', authenticate, async (req, res) => {
    try {
        const { type, project, status, date_from, date_to, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        let conditions = [];
        let params = [];
        let paramIdx = 1;

        if (type) {
            conditions.push(`d.doc_type = $${paramIdx++}`);
            params.push(type);
        }
        if (project) {
            conditions.push(`d.project_id = $${paramIdx++}`);
            params.push(project);
        }
        if (status) {
            conditions.push(`d.status = $${paramIdx++}`);
            params.push(status);
        }
        if (date_from) {
            conditions.push(`d.created_at >= $${paramIdx++}`);
            params.push(date_from);
        }
        if (date_to) {
            conditions.push(`d.created_at <= $${paramIdx++}`);
            params.push(date_to);
        }

        // Non-admin: only see assigned projects
        if (req.user.role !== 'ADMIN') {
            conditions.push(`d.project_id IN (SELECT project_id FROM project_users WHERE user_id = $${paramIdx++})`);
            params.push(req.user.id);
        }

        const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        const countResult = await pool.query(`SELECT COUNT(*) FROM documents d ${where}`, params);
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(
            `SELECT d.*, p.name as project_name, p.project_code, u.name as created_by_name
       FROM documents d
       LEFT JOIN projects p ON p.id = d.project_id
       LEFT JOIN users u ON u.id = d.created_by
       ${where}
       ORDER BY d.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...params, limit, offset]
        );

        res.json({
            documents: result.rows,
            pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) }
        });
    } catch (err) {
        console.error('Get documents error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/documents/:id
router.get('/:id', authenticate, async (req, res) => {
    try {
        const docResult = await pool.query(
            `SELECT d.*, p.name as project_name, p.project_code, u.name as created_by_name
       FROM documents d
       LEFT JOIN projects p ON p.id = d.project_id
       LEFT JOIN users u ON u.id = d.created_by
       WHERE d.id = $1`,
            [req.params.id]
        );
        if (docResult.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Check project access for non-admin
        if (req.user.role !== 'ADMIN') {
            const access = await pool.query(
                'SELECT id FROM project_users WHERE user_id = $1 AND project_id = $2',
                [req.user.id, docResult.rows[0].project_id]
            );
            if (access.rows.length === 0) {
                return res.status(403).json({ error: 'No access to this document' });
            }
        }

        const lineItems = await pool.query(
            'SELECT * FROM line_items WHERE document_id = $1 ORDER BY id',
            [req.params.id]
        );

        res.json({ ...docResult.rows[0], line_items: lineItems.rows });
    } catch (err) {
        console.error('Get document error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/documents
router.post('/', authenticate, authorize('ADMIN', 'EDITOR'), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { doc_type, project_id, reference_id, vat_rate = 0.07, wht_rate = 0, due_date, notes, vendor_name, vendor_tax_id, line_items = [] } = req.body;

        // Check project access
        if (req.user.role !== 'ADMIN') {
            const access = await client.query(
                'SELECT id FROM project_users WHERE user_id = $1 AND project_id = $2',
                [req.user.id, project_id]
            );
            if (access.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'No access to this project' });
            }
        }

        // Generate doc number
        const doc_number = await getNextDocNumber(client, doc_type);

        // Calculate subtotal from line items
        let subtotal = 0;
        for (const item of line_items) {
            const lineTotal = parseFloat((item.quantity * item.unit_price).toFixed(2));
            subtotal += lineTotal;
        }

        const { vat_amount, wht_amount, net_total } = calculateFinancials(subtotal, vat_rate, wht_rate, doc_type);

        const docResult = await client.query(
            `INSERT INTO documents (doc_type, doc_number, project_id, reference_id, subtotal, vat_rate, vat_amount, wht_rate, wht_amount, net_total, status, due_date, notes, vendor_name, vendor_tax_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
            [doc_type, doc_number, project_id, reference_id, subtotal, vat_rate, vat_amount, wht_rate, wht_amount, net_total, 'DRAFT', due_date, notes, vendor_name, vendor_tax_id, req.user.id]
        );

        // Insert line items
        const insertedItems = [];
        for (const item of line_items) {
            const lineTotal = parseFloat((item.quantity * item.unit_price).toFixed(2));
            const itemResult = await client.query(
                `INSERT INTO line_items (document_id, description, quantity, unit, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [docResult.rows[0].id, item.description, item.quantity, item.unit || 'unit', item.unit_price, lineTotal]
            );
            insertedItems.push(itemResult.rows[0]);
        }

        await client.query('COMMIT');
        res.status(201).json({ ...docResult.rows[0], line_items: insertedItems });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create document error:', err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// PUT /api/documents/:id
router.put('/:id', authenticate, authorize('ADMIN', 'EDITOR'), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { vat_rate, wht_rate, status, due_date, notes, vendor_name, vendor_tax_id, line_items } = req.body;

        // Get existing doc
        const existing = await client.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
        if (existing.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Document not found' });
        }

        const doc = existing.rows[0];

        // Check project access
        if (req.user.role !== 'ADMIN') {
            const access = await client.query(
                'SELECT id FROM project_users WHERE user_id = $1 AND project_id = $2',
                [req.user.id, doc.project_id]
            );
            if (access.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(403).json({ error: 'No access' });
            }
        }

        let subtotal = parseFloat(doc.subtotal);
        let insertedItems = [];

        // Update line items if provided
        if (line_items) {
            await client.query('DELETE FROM line_items WHERE document_id = $1', [req.params.id]);
            subtotal = 0;
            for (const item of line_items) {
                const lineTotal = parseFloat((item.quantity * item.unit_price).toFixed(2));
                subtotal += lineTotal;
                const itemResult = await client.query(
                    `INSERT INTO line_items (document_id, description, quantity, unit, unit_price, line_total)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                    [req.params.id, item.description, item.quantity, item.unit || 'unit', item.unit_price, lineTotal]
                );
                insertedItems.push(itemResult.rows[0]);
            }
        }

        const finalVatRate = vat_rate !== undefined ? vat_rate : parseFloat(doc.vat_rate);
        const finalWhtRate = wht_rate !== undefined ? wht_rate : parseFloat(doc.wht_rate);
        const { vat_amount, wht_amount, net_total } = calculateFinancials(subtotal, finalVatRate, finalWhtRate, doc.doc_type);

        const result = await client.query(
            `UPDATE documents SET subtotal=$1, vat_rate=$2, vat_amount=$3, wht_rate=$4, wht_amount=$5, net_total=$6,
       status=COALESCE($7, status), due_date=COALESCE($8, due_date), notes=COALESCE($9, notes),
       vendor_name=COALESCE($10, vendor_name), vendor_tax_id=COALESCE($11, vendor_tax_id), updated_at=NOW()
       WHERE id = $12 RETURNING *`,
            [subtotal, finalVatRate, vat_amount, finalWhtRate, wht_amount, net_total, status, due_date, notes, vendor_name, vendor_tax_id, req.params.id]
        );

        await client.query('COMMIT');

        if (!line_items) {
            const items = await pool.query('SELECT * FROM line_items WHERE document_id = $1 ORDER BY id', [req.params.id]);
            insertedItems = items.rows;
        }

        res.json({ ...result.rows[0], line_items: insertedItems });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update document error:', err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// DELETE /api/documents/:id
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.json({ message: 'Document deleted' });
    } catch (err) {
        console.error('Delete document error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

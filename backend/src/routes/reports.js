const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// GET /api/reports/summary
router.get('/summary', authenticate, async (req, res) => {
    try {
        const { project } = req.query;
        let projectFilter = '';
        const params = [];

        if (project) {
            projectFilter = 'AND d.project_id = $1';
            params.push(project);
        } else if (req.user.role !== 'ADMIN') {
            projectFilter = 'AND d.project_id IN (SELECT project_id FROM project_users WHERE user_id = $1)';
            params.push(req.user.id);
        }

        // Outstanding Receivables (INVOICE/TAX_INVOICE not PAID)
        const receivables = await pool.query(
            `SELECT COALESCE(SUM(net_total), 0) as total FROM documents d
       WHERE doc_type IN ('INVOICE', 'TAX_INVOICE') AND status NOT IN ('PAID', 'CANCELLED') ${projectFilter}`, params
        );

        // Outstanding Payables (PO/VENDOR_PAYMENT not PAID)
        const payables = await pool.query(
            `SELECT COALESCE(SUM(net_total), 0) as total FROM documents d
       WHERE doc_type IN ('PO', 'VENDOR_PAYMENT') AND status NOT IN ('PAID', 'CANCELLED') ${projectFilter}`, params
        );

        // Monthly totals (current month)
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
        const monthParams = [...params, monthStart, monthEnd];

        const pIdx = params.length;
        const monthlyIncome = await pool.query(
            `SELECT COALESCE(SUM(net_total), 0) as total FROM documents d
       WHERE doc_type IN ('INVOICE', 'TAX_INVOICE', 'RECEIPT') AND status = 'PAID'
       AND created_at >= $${pIdx + 1} AND created_at <= $${pIdx + 2} ${projectFilter}`, monthParams
        );

        const monthlyExpense = await pool.query(
            `SELECT COALESCE(SUM(net_total), 0) as total FROM documents d
       WHERE doc_type IN ('PO', 'VENDOR_PAYMENT') AND status = 'PAID'
       AND created_at >= $${pIdx + 1} AND created_at <= $${pIdx + 2} ${projectFilter}`, monthParams
        );

        // VAT Payable = VAT from sales - VAT from purchases
        const vatSales = await pool.query(
            `SELECT COALESCE(SUM(vat_amount), 0) as total FROM documents d
       WHERE doc_type IN ('INVOICE', 'TAX_INVOICE', 'RECEIPT') AND status != 'CANCELLED' ${projectFilter}`, params
        );
        const vatPurchase = await pool.query(
            `SELECT COALESCE(SUM(vat_amount), 0) as total FROM documents d
       WHERE doc_type IN ('PO', 'VENDOR_PAYMENT') AND status != 'CANCELLED' ${projectFilter}`, params
        );

        // WHT Payable
        const whtPayable = await pool.query(
            `SELECT COALESCE(SUM(wht_amount), 0) as total FROM documents d
       WHERE status != 'CANCELLED' ${projectFilter}`, params
        );

        // Overdue count
        const overdue = await pool.query(
            `SELECT COUNT(*) as count FROM documents d
       WHERE due_date < NOW() AND status NOT IN ('PAID', 'CANCELLED') ${projectFilter}`, params
        );

        // Cash flow data (last 6 months)
        const cashFlow = await pool.query(
            `SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        SUM(CASE WHEN doc_type IN ('INVOICE', 'TAX_INVOICE', 'RECEIPT') THEN net_total ELSE 0 END) as cash_in,
        SUM(CASE WHEN doc_type IN ('PO', 'VENDOR_PAYMENT') THEN net_total ELSE 0 END) as cash_out
       FROM documents d
       WHERE status != 'CANCELLED' AND created_at >= NOW() - INTERVAL '6 months' ${projectFilter}
       GROUP BY TO_CHAR(created_at, 'YYYY-MM')
       ORDER BY month`, params
        );

        // Expense by category
        const expenseByCategory = await pool.query(
            `SELECT doc_type as category, COALESCE(SUM(net_total), 0) as total
       FROM documents d
       WHERE doc_type IN ('PO', 'VENDOR_PAYMENT', 'ADVANCE') AND status != 'CANCELLED' ${projectFilter}
       GROUP BY doc_type`, params
        );

        // Recent activity
        const recentActivity = await pool.query(
            `SELECT d.id, d.doc_type, d.doc_number, d.net_total, d.status, d.created_at,
              p.name as project_name, u.name as created_by_name
       FROM documents d
       LEFT JOIN projects p ON p.id = d.project_id
       LEFT JOIN users u ON u.id = d.created_by
       WHERE 1=1 ${projectFilter.replace('d.project_id', 'd.project_id')}
       ORDER BY d.created_at DESC LIMIT 10`, params
        );

        res.json({
            outstanding_receivables: parseFloat(receivables.rows[0].total),
            outstanding_payables: parseFloat(payables.rows[0].total),
            monthly_income: parseFloat(monthlyIncome.rows[0].total),
            monthly_expense: parseFloat(monthlyExpense.rows[0].total),
            monthly_profit: parseFloat(monthlyIncome.rows[0].total) - parseFloat(monthlyExpense.rows[0].total),
            vat_payable: parseFloat(vatSales.rows[0].total) - parseFloat(vatPurchase.rows[0].total),
            wht_payable: parseFloat(whtPayable.rows[0].total),
            overdue_count: parseInt(overdue.rows[0].count),
            cash_flow: cashFlow.rows,
            expense_by_category: expenseByCategory.rows,
            recent_activity: recentActivity.rows,
        });
    } catch (err) {
        console.error('Summary error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reports/vat-sales
router.get('/vat-sales', authenticate, async (req, res) => {
    try {
        const { period } = req.query; // YYYY-MM
        let filter = "AND doc_type IN ('INVOICE', 'TAX_INVOICE', 'RECEIPT')";
        const params = [];
        if (period) {
            filter += ` AND TO_CHAR(created_at, 'YYYY-MM') = $1`;
            params.push(period);
        }
        const result = await pool.query(
            `SELECT d.*, p.name as project_name FROM documents d
       LEFT JOIN projects p ON p.id = d.project_id
       WHERE status != 'CANCELLED' ${filter}
       ORDER BY d.created_at`, params
        );

        const totalVat = result.rows.reduce((sum, r) => sum + parseFloat(r.vat_amount), 0);
        const totalSubtotal = result.rows.reduce((sum, r) => sum + parseFloat(r.subtotal), 0);

        res.json({ documents: result.rows, total_subtotal: totalSubtotal, total_vat: totalVat });
    } catch (err) {
        console.error('VAT sales error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reports/vat-purchase
router.get('/vat-purchase', authenticate, async (req, res) => {
    try {
        const { period } = req.query;
        let filter = "AND doc_type IN ('PO', 'VENDOR_PAYMENT')";
        const params = [];
        if (period) {
            filter += ` AND TO_CHAR(created_at, 'YYYY-MM') = $1`;
            params.push(period);
        }
        const result = await pool.query(
            `SELECT d.*, p.name as project_name FROM documents d
       LEFT JOIN projects p ON p.id = d.project_id
       WHERE status != 'CANCELLED' ${filter}
       ORDER BY d.created_at`, params
        );

        const totalVat = result.rows.reduce((sum, r) => sum + parseFloat(r.vat_amount), 0);
        const totalSubtotal = result.rows.reduce((sum, r) => sum + parseFloat(r.subtotal), 0);

        res.json({ documents: result.rows, total_subtotal: totalSubtotal, total_vat: totalVat });
    } catch (err) {
        console.error('VAT purchase error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reports/wht
router.get('/wht', authenticate, async (req, res) => {
    try {
        const { period, type } = req.query; // type: PND3, PND53, 50BIS
        const params = [];
        let filter = 'AND wht_amount > 0';
        if (period) {
            filter += ` AND TO_CHAR(created_at, 'YYYY-MM') = $${params.length + 1}`;
            params.push(period);
        }
        const result = await pool.query(
            `SELECT d.*, p.name as project_name FROM documents d
       LEFT JOIN projects p ON p.id = d.project_id
       WHERE status != 'CANCELLED' ${filter}
       ORDER BY d.created_at`, params
        );

        const totalWht = result.rows.reduce((sum, r) => sum + parseFloat(r.wht_amount), 0);
        res.json({ documents: result.rows, total_wht: totalWht, report_type: type || 'PND3' });
    } catch (err) {
        console.error('WHT report error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reports/export
router.get('/export', authenticate, async (req, res) => {
    try {
        const { format, type } = req.query; // format: pdf|excel, type: vat-sales|vat-purchase|income-expense

        const docs = await pool.query(
            `SELECT d.*, p.name as project_name, p.project_code
       FROM documents d LEFT JOIN projects p ON p.id = d.project_id
       WHERE d.status != 'CANCELLED' ORDER BY d.created_at`
        );

        if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'NCON2559';
            workbook.created = new Date();

            if (type === 'vat-sales' || !type) {
                const ws = workbook.addWorksheet('VAT Sales');
                ws.columns = [
                    { header: 'Date', key: 'date', width: 15 },
                    { header: 'Doc No.', key: 'doc_number', width: 18 },
                    { header: 'Project', key: 'project_name', width: 25 },
                    { header: 'Subtotal', key: 'subtotal', width: 15 },
                    { header: 'VAT', key: 'vat_amount', width: 15 },
                    { header: 'Net Total', key: 'net_total', width: 15 },
                ];
                ws.getRow(1).font = { bold: true };
                const salesDocs = docs.rows.filter(d => ['INVOICE', 'TAX_INVOICE', 'RECEIPT'].includes(d.doc_type));
                salesDocs.forEach(d => {
                    ws.addRow({
                        date: new Date(d.created_at).toLocaleDateString(),
                        doc_number: d.doc_number,
                        project_name: d.project_name,
                        subtotal: parseFloat(d.subtotal),
                        vat_amount: parseFloat(d.vat_amount),
                        net_total: parseFloat(d.net_total),
                    });
                });
            }

            if (type === 'vat-purchase' || !type) {
                const ws = workbook.addWorksheet('VAT Purchase');
                ws.columns = [
                    { header: 'Date', key: 'date', width: 15 },
                    { header: 'Doc No.', key: 'doc_number', width: 18 },
                    { header: 'Vendor', key: 'vendor_name', width: 25 },
                    { header: 'Project', key: 'project_name', width: 25 },
                    { header: 'Subtotal', key: 'subtotal', width: 15 },
                    { header: 'VAT', key: 'vat_amount', width: 15 },
                    { header: 'Net Total', key: 'net_total', width: 15 },
                ];
                ws.getRow(1).font = { bold: true };
                const purchaseDocs = docs.rows.filter(d => ['PO', 'VENDOR_PAYMENT'].includes(d.doc_type));
                purchaseDocs.forEach(d => {
                    ws.addRow({
                        date: new Date(d.created_at).toLocaleDateString(),
                        doc_number: d.doc_number,
                        vendor_name: d.vendor_name || '-',
                        project_name: d.project_name,
                        subtotal: parseFloat(d.subtotal),
                        vat_amount: parseFloat(d.vat_amount),
                        net_total: parseFloat(d.net_total),
                    });
                });
            }

            if (type === 'income-expense' || !type) {
                const ws = workbook.addWorksheet('Income vs Expense');
                ws.columns = [
                    { header: 'Date', key: 'date', width: 15 },
                    { header: 'Doc No.', key: 'doc_number', width: 18 },
                    { header: 'Type', key: 'doc_type', width: 18 },
                    { header: 'Project', key: 'project_name', width: 25 },
                    { header: 'Category', key: 'category', width: 15 },
                    { header: 'Amount', key: 'net_total', width: 15 },
                ];
                ws.getRow(1).font = { bold: true };
                docs.rows.forEach(d => {
                    const isIncome = ['INVOICE', 'TAX_INVOICE', 'RECEIPT', 'QUOTATION'].includes(d.doc_type);
                    ws.addRow({
                        date: new Date(d.created_at).toLocaleDateString(),
                        doc_number: d.doc_number,
                        doc_type: d.doc_type,
                        project_name: d.project_name,
                        category: isIncome ? 'Income' : 'Expense',
                        net_total: parseFloat(d.net_total),
                    });
                });
            }

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=NCON2559_${type || 'report'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
            await workbook.xlsx.write(res);
            res.end();
        } else if (format === 'pdf') {
            const doc = new PDFDocument({ margin: 50 });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=NCON2559_${type || 'report'}_${new Date().toISOString().slice(0, 10)}.pdf`);
            doc.pipe(res);

            // Header
            doc.fontSize(20).text('NCON2559', { align: 'center' });
            doc.fontSize(14).text('Construction Accounting Report', { align: 'center' });
            doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
            doc.moveDown(2);

            const filteredDocs = type === 'vat-sales'
                ? docs.rows.filter(d => ['INVOICE', 'TAX_INVOICE', 'RECEIPT'].includes(d.doc_type))
                : type === 'vat-purchase'
                    ? docs.rows.filter(d => ['PO', 'VENDOR_PAYMENT'].includes(d.doc_type))
                    : docs.rows;

            // Table header
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Doc No.', 50, doc.y, { width: 100, continued: false });

            filteredDocs.forEach(d => {
                if (doc.y > 700) { doc.addPage(); }
                doc.font('Helvetica').fontSize(9);
                const y = doc.y;
                doc.text(d.doc_number, 50, y);
                doc.text(d.doc_type, 155, y);
                doc.text(d.project_name || '-', 240, y);
                doc.text(parseFloat(d.net_total).toLocaleString(), 400, y);
                doc.text(d.status, 480, y);
                doc.moveDown(0.5);
            });

            doc.end();
        } else {
            res.status(400).json({ error: 'Format must be pdf or excel' });
        }
    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

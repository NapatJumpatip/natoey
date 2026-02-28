const express = require('express');
const path = require('path');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const THAI_FONT = path.join(__dirname, '..', 'fonts', 'NotoSansThai-Regular.ttf');

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
       WHERE d.doc_type IN ('INVOICE', 'TAX_INVOICE') AND d.status NOT IN ('PAID', 'CANCELLED') ${projectFilter}`, params
        );

        // Outstanding Payables (PO/VENDOR_PAYMENT not PAID)
        const payables = await pool.query(
            `SELECT COALESCE(SUM(net_total), 0) as total FROM documents d
       WHERE d.doc_type IN ('PO', 'VENDOR_PAYMENT') AND d.status NOT IN ('PAID', 'CANCELLED') ${projectFilter}`, params
        );

        // Monthly totals (current month)
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
        const monthParams = [...params, monthStart, monthEnd];

        const pIdx = params.length;
        const monthlyIncome = await pool.query(
            `SELECT COALESCE(SUM(net_total), 0) as total FROM documents d
       WHERE d.doc_type IN ('INVOICE', 'TAX_INVOICE', 'RECEIPT') AND d.status = 'PAID'
       AND d.created_at >= $${pIdx + 1} AND d.created_at <= $${pIdx + 2} ${projectFilter}`, monthParams
        );

        const monthlyExpense = await pool.query(
            `SELECT COALESCE(SUM(net_total), 0) as total FROM documents d
       WHERE d.doc_type IN ('PO', 'VENDOR_PAYMENT') AND d.status = 'PAID'
       AND d.created_at >= $${pIdx + 1} AND d.created_at <= $${pIdx + 2} ${projectFilter}`, monthParams
        );

        // VAT Payable = VAT from sales - VAT from purchases
        const vatSales = await pool.query(
            `SELECT COALESCE(SUM(vat_amount), 0) as total FROM documents d
       WHERE d.doc_type IN ('INVOICE', 'TAX_INVOICE', 'RECEIPT') AND d.status != 'CANCELLED' ${projectFilter}`, params
        );
        const vatPurchase = await pool.query(
            `SELECT COALESCE(SUM(vat_amount), 0) as total FROM documents d
       WHERE d.doc_type IN ('PO', 'VENDOR_PAYMENT') AND d.status != 'CANCELLED' ${projectFilter}`, params
        );

        // WHT Payable
        const whtPayable = await pool.query(
            `SELECT COALESCE(SUM(wht_amount), 0) as total FROM documents d
       WHERE d.status != 'CANCELLED' ${projectFilter}`, params
        );

        // Overdue count
        const overdue = await pool.query(
            `SELECT COUNT(*) as count FROM documents d
       WHERE d.due_date < NOW() AND d.status NOT IN ('PAID', 'CANCELLED') ${projectFilter}`, params
        );

        // Cash flow data (last 12 months)
        const cashFlow = await pool.query(
            `SELECT 
        TO_CHAR(d.created_at, 'YYYY-MM') as month,
        SUM(CASE WHEN d.doc_type IN ('INVOICE', 'TAX_INVOICE', 'RECEIPT') THEN d.net_total ELSE 0 END) as cash_in,
        SUM(CASE WHEN d.doc_type IN ('PO', 'VENDOR_PAYMENT') THEN d.net_total ELSE 0 END) as cash_out
       FROM documents d
       WHERE d.status != 'CANCELLED' AND d.created_at >= NOW() - INTERVAL '12 months' ${projectFilter}
       GROUP BY TO_CHAR(d.created_at, 'YYYY-MM')
       ORDER BY month`, params
        );

        // Expense by category
        const expenseByCategory = await pool.query(
            `SELECT d.doc_type as category, COALESCE(SUM(d.net_total), 0) as total
       FROM documents d
       WHERE d.doc_type IN ('PO', 'VENDOR_PAYMENT', 'ADVANCE') AND d.status != 'CANCELLED' ${projectFilter}
       GROUP BY d.doc_type`, params
        );

        // Recent activity
        const recentActivity = await pool.query(
            `SELECT d.id, d.doc_type, d.doc_number, d.net_total, d.status, d.created_at,
              p.name as project_name, u.name as created_by_name
       FROM documents d
       LEFT JOIN projects p ON p.id = d.project_id
       LEFT JOIN users u ON u.id = d.created_by
       WHERE 1=1 ${projectFilter}
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
        const params = [];
        let periodFilter = '';
        if (period) {
            periodFilter = `AND TO_CHAR(d.created_at, 'YYYY-MM') = $1`;
            params.push(period);
        }
        const result = await pool.query(
            `SELECT d.*, p.name as project_name FROM documents d
       LEFT JOIN projects p ON p.id = d.project_id
       WHERE d.status != 'CANCELLED' AND d.doc_type IN ('INVOICE', 'TAX_INVOICE', 'RECEIPT') ${periodFilter}
       ORDER BY d.created_at`, params
        );

        const totalVat = result.rows.reduce((sum, r) => sum + parseFloat(r.vat_amount || 0), 0);
        const totalSubtotal = result.rows.reduce((sum, r) => sum + parseFloat(r.subtotal || 0), 0);

        res.json({ documents: result.rows, total_subtotal: totalSubtotal, total_vat: totalVat });
    } catch (err) {
        console.error('VAT sales error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// GET /api/reports/vat-purchase
router.get('/vat-purchase', authenticate, async (req, res) => {
    try {
        const { period } = req.query;
        const params = [];
        let periodFilter = '';
        if (period) {
            periodFilter = `AND TO_CHAR(d.created_at, 'YYYY-MM') = $1`;
            params.push(period);
        }
        const result = await pool.query(
            `SELECT d.*, p.name as project_name FROM documents d
       LEFT JOIN projects p ON p.id = d.project_id
       WHERE d.status != 'CANCELLED' AND d.doc_type IN ('PO', 'VENDOR_PAYMENT') ${periodFilter}
       ORDER BY d.created_at`, params
        );

        const totalVat = result.rows.reduce((sum, r) => sum + parseFloat(r.vat_amount || 0), 0);
        const totalSubtotal = result.rows.reduce((sum, r) => sum + parseFloat(r.subtotal || 0), 0);

        res.json({ documents: result.rows, total_subtotal: totalSubtotal, total_vat: totalVat });
    } catch (err) {
        console.error('VAT purchase error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// GET /api/reports/wht
router.get('/wht', authenticate, async (req, res) => {
    try {
        const { period, type } = req.query; // type: PND3, PND53, 50BIS
        const params = [];
        let periodFilter = '';
        if (period) {
            periodFilter = `AND TO_CHAR(d.created_at, 'YYYY-MM') = $1`;
            params.push(period);
        }
        const result = await pool.query(
            `SELECT d.*, p.name as project_name FROM documents d
       LEFT JOIN projects p ON p.id = d.project_id
       WHERE d.status != 'CANCELLED' AND d.wht_amount > 0 ${periodFilter}
       ORDER BY d.created_at`, params
        );

        const totalWht = result.rows.reduce((sum, r) => sum + parseFloat(r.wht_amount || 0), 0);
        const totalSubtotal = result.rows.reduce((sum, r) => sum + parseFloat(r.subtotal || 0), 0);
        res.json({ documents: result.rows, total_wht: totalWht, total_subtotal: totalSubtotal, report_type: type || 'PND3' });
    } catch (err) {
        console.error('WHT report error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// GET /api/reports/export
router.get('/export', authenticate, async (req, res) => {
    try {
        const { format, type, period } = req.query; // format: pdf|excel, type: vat-sales|vat-purchase|income-expense

        let periodFilter = '';
        const params = [];
        if (period) {
            periodFilter = `AND TO_CHAR(d.created_at, 'YYYY-MM') = $1`;
            params.push(period);
        }

        const docs = await pool.query(
            `SELECT d.*, p.name as project_name, p.project_code
       FROM documents d LEFT JOIN projects p ON p.id = d.project_id
       WHERE d.status != 'CANCELLED' ${periodFilter} ORDER BY d.created_at`, params
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
                        project_name: d.project_name || '-',
                        subtotal: parseFloat(d.subtotal || 0),
                        vat_amount: parseFloat(d.vat_amount || 0),
                        net_total: parseFloat(d.net_total || 0),
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
                        project_name: d.project_name || '-',
                        subtotal: parseFloat(d.subtotal || 0),
                        vat_amount: parseFloat(d.vat_amount || 0),
                        net_total: parseFloat(d.net_total || 0),
                    });
                });
            }

            if (type === 'wht' || !type) {
                const ws = workbook.addWorksheet('WHT Report');
                ws.columns = [
                    { header: 'Date', key: 'date', width: 15 },
                    { header: 'Doc No.', key: 'doc_number', width: 18 },
                    { header: 'Vendor', key: 'vendor_name', width: 25 },
                    { header: 'Tax ID', key: 'vendor_tax_id', width: 18 },
                    { header: 'Subtotal', key: 'subtotal', width: 15 },
                    { header: 'WHT', key: 'wht_amount', width: 15 },
                ];
                ws.getRow(1).font = { bold: true };
                const whtDocs = docs.rows.filter(d => parseFloat(d.wht_amount || 0) > 0);
                whtDocs.forEach(d => {
                    ws.addRow({
                        date: new Date(d.created_at).toLocaleDateString(),
                        doc_number: d.doc_number,
                        vendor_name: d.vendor_name || '-',
                        vendor_tax_id: d.vendor_tax_id || '-',
                        subtotal: parseFloat(d.subtotal || 0),
                        wht_amount: parseFloat(d.wht_amount || 0),
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
                        project_name: d.project_name || '-',
                        category: isIncome ? 'Income' : 'Expense',
                        net_total: parseFloat(d.net_total || 0),
                    });
                });
            }

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=NCON2559_${type || 'report'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
            await workbook.xlsx.write(res);
            res.end();
        } else if (format === 'pdf') {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=NCON2559_${type || 'report'}_${new Date().toISOString().slice(0, 10)}.pdf`);
            doc.pipe(res);

            // Register Thai font
            doc.registerFont('Thai', THAI_FONT);
            doc.registerFont('Thai-Bold', THAI_FONT);

            // Header
            doc.font('Thai-Bold').fontSize(22).text('NCON2559', { align: 'center' });
            doc.font('Thai').fontSize(13).text('Construction Accounting Report', { align: 'center' });
            const reportTitle = type === 'vat-sales' ? 'รายงานภาษีขาย (VAT Sales)'
                : type === 'vat-purchase' ? 'รายงานภาษีซื้อ (VAT Purchase)'
                    : type === 'wht' ? 'รายงานภาษีหัก ณ ที่จ่าย (WHT)'
                        : 'รายงานรายรับ-รายจ่าย (Income/Expense)';
            doc.fontSize(11).text(reportTitle, { align: 'center' });
            doc.fontSize(9).text(`Generated: ${new Date().toLocaleDateString('th-TH')}`, { align: 'center' });
            doc.moveDown(1.5);

            const filteredDocs = type === 'vat-sales'
                ? docs.rows.filter(d => ['INVOICE', 'TAX_INVOICE', 'RECEIPT'].includes(d.doc_type))
                : type === 'vat-purchase'
                    ? docs.rows.filter(d => ['PO', 'VENDOR_PAYMENT'].includes(d.doc_type))
                    : type === 'wht'
                        ? docs.rows.filter(d => parseFloat(d.wht_amount || 0) > 0)
                        : docs.rows;

            // Column layout
            const cols = [
                { label: 'Doc No.', x: 50, w: 95 },
                { label: 'Type', x: 150, w: 80 },
                { label: 'Project', x: 235, w: 140 },
                { label: 'Amount', x: 380, w: 80 },
                { label: 'Status', x: 465, w: 70 },
            ];

            // Table header row
            const headerY = doc.y;
            doc.font('Thai-Bold').fontSize(9);
            doc.rect(45, headerY - 2, 500, 18).fill('#f1f5f9').stroke('#e2e8f0');
            doc.fillColor('#334155');
            cols.forEach(c => doc.text(c.label, c.x, headerY + 2, { width: c.w }));
            doc.moveDown(1);

            // Table rows
            doc.font('Thai').fillColor('#1e293b');
            filteredDocs.forEach((d, i) => {
                if (doc.y > 750) {
                    doc.addPage();
                    // Repeat header on new page
                    const hy = doc.y;
                    doc.font('Thai-Bold').fontSize(9);
                    doc.rect(45, hy - 2, 500, 18).fill('#f1f5f9').stroke('#e2e8f0');
                    doc.fillColor('#334155');
                    cols.forEach(c => doc.text(c.label, c.x, hy + 2, { width: c.w }));
                    doc.moveDown(1);
                    doc.font('Thai').fillColor('#1e293b');
                }

                const y = doc.y;
                // Alternate row background
                if (i % 2 === 1) {
                    doc.rect(45, y - 2, 500, 16).fill('#f8fafc').fillColor('#1e293b');
                }

                doc.fontSize(8);
                doc.text(d.doc_number || '-', cols[0].x, y, { width: cols[0].w });
                doc.text(d.doc_type || '-', cols[1].x, y, { width: cols[1].w });
                doc.text((d.project_name || '-').substring(0, 25), cols[2].x, y, { width: cols[2].w });
                doc.text(parseFloat(d.net_total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 }), cols[3].x, y, { width: cols[3].w });
                doc.text(d.status || '-', cols[4].x, y, { width: cols[4].w });
                doc.moveDown(0.7);
            });

            // Footer totals
            doc.moveDown(1);
            const totalAmount = filteredDocs.reduce((s, d) => s + parseFloat(d.net_total || 0), 0);
            doc.font('Thai-Bold').fontSize(10).fillColor('#0f172a');
            doc.text(`Total: ${totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} THB`, { align: 'right' });
            doc.text(`${filteredDocs.length} documents`, { align: 'right' });

            doc.end();
        } else {
            res.status(400).json({ error: 'Format must be pdf or excel' });
        }
    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;

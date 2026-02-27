require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./pool');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🌱 Starting database seed...');

        // Run schema first
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await client.query(schema);
        console.log('✅ Schema created');

        // Clear existing data (in reverse FK order)
        await client.query('DELETE FROM line_items');
        await client.query('DELETE FROM tax_reports');
        await client.query('DELETE FROM documents');
        await client.query('DELETE FROM doc_sequences');
        await client.query('DELETE FROM project_users');
        await client.query('DELETE FROM projects');
        await client.query('DELETE FROM users');
        console.log('✅ Cleared existing data');

        // === USERS ===
        const adminHash = await bcrypt.hash('123456', SALT_ROUNDS);
        const editorHash = await bcrypt.hash('123456', SALT_ROUNDS);
        const viewerHash = await bcrypt.hash('123456', SALT_ROUNDS);

        const users = await client.query(`
      INSERT INTO users (name, email, password_hash, role) VALUES
        ('Admin User', 'admin@ncon2559.com', $1, 'ADMIN'),
        ('Editor User', 'editor@ncon2559.com', $2, 'EDITOR'),
        ('Viewer User', 'viewer@ncon2559.com', $3, 'VIEWER')
      RETURNING id, name, email, role
    `, [adminHash, editorHash, viewerHash]);
        console.log('✅ Created 3 users');

        const adminId = users.rows[0].id;
        const editorId = users.rows[1].id;
        const viewerId = users.rows[2].id;

        // === PROJECTS ===
        const projects = await client.query(`
      INSERT INTO projects (project_code, name, client, location, start_date, end_date, status, contract_value, vat_rate) VALUES
        ('PRJ-2025-001', 'บ้านพักอาศัย สุขุมวิท 55', 'คุณสมชาย วงศ์ประเสริฐ', 'สุขุมวิท 55 กรุงเทพฯ', '2025-01-15', '2025-12-31', 'ACTIVE', 15000000.00, 0.07),
        ('PRJ-2025-002', 'ปรับปรุงสำนักงาน ABC Tower', 'บริษัท ABC จำกัด', 'สีลม กรุงเทพฯ', '2025-03-01', '2025-09-30', 'ACTIVE', 8500000.00, 0.07)
      RETURNING id, name
    `);
        console.log('✅ Created 2 projects');

        const proj1 = projects.rows[0].id;
        const proj2 = projects.rows[1].id;

        // === PROJECT USERS ===
        await client.query(`
      INSERT INTO project_users (user_id, project_id) VALUES
        ($1, $3), ($1, $4),
        ($2, $3),
        ($5, $3), ($5, $4)
    `, [adminId, editorId, proj1, proj2, viewerId]);
        console.log('✅ Assigned users to projects');

        // === DOCUMENTS ===
        // We'll create 20 documents with line items using the sequence table
        const today = new Date();
        const year = today.getFullYear();

        // Helper to create doc with items
        async function createDoc(docType, prefix, seqNum, projectId, vatRate, whtRate, status, dueDate, vendorName, vendorTaxId, items, notes) {
            // Update sequence
            await client.query(`
        INSERT INTO doc_sequences (prefix, year, last_number) VALUES ($1, $2, $3)
        ON CONFLICT (prefix, year) DO UPDATE SET last_number = GREATEST(doc_sequences.last_number, $3)
      `, [prefix, year, seqNum]);

            const docNumber = `${prefix}-${year}-${String(seqNum).padStart(4, '0')}`;
            let subtotal = 0;
            for (const item of items) {
                subtotal += item.quantity * item.unit_price;
            }

            const vatAmount = parseFloat((subtotal * vatRate).toFixed(2));
            const whtAmount = parseFloat((subtotal * whtRate).toFixed(2));

            const incomeTypes = ['QUOTATION', 'INVOICE', 'TAX_INVOICE', 'RECEIPT'];
            const netTotal = incomeTypes.includes(docType)
                ? parseFloat((subtotal + vatAmount - whtAmount).toFixed(2))
                : parseFloat((subtotal + vatAmount).toFixed(2));

            const doc = await client.query(`
        INSERT INTO documents (doc_type, doc_number, project_id, subtotal, vat_rate, vat_amount, wht_rate, wht_amount, net_total, status, due_date, notes, vendor_name, vendor_tax_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id
      `, [docType, docNumber, projectId, subtotal, vatRate, vatAmount, whtRate, whtAmount, netTotal, status, dueDate, notes, vendorName, vendorTaxId, adminId]);

            for (const item of items) {
                const lineTotal = parseFloat((item.quantity * item.unit_price).toFixed(2));
                await client.query(`
          INSERT INTO line_items (document_id, description, quantity, unit, unit_price, line_total)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [doc.rows[0].id, item.description, item.quantity, item.unit || 'unit', item.unit_price, lineTotal]);
            }

            return doc.rows[0].id;
        }

        // --- 5 Quotations ---
        await createDoc('QUOTATION', 'QT', 1, proj1, 0.07, 0, 'APPROVED', '2025-02-28', null, null, [
            { description: 'งานโครงสร้าง - เสาเข็ม', quantity: 20, unit: 'ต้น', unit_price: 25000 },
            { description: 'งานโครงสร้าง - ฐานราก', quantity: 1, unit: 'งาน', unit_price: 350000 },
            { description: 'งานโครงสร้าง - คาน/เสา ชั้น 1', quantity: 1, unit: 'งาน', unit_price: 480000 },
        ], 'ใบเสนอราคางานโครงสร้าง Phase 1');

        await createDoc('QUOTATION', 'QT', 2, proj1, 0.07, 0, 'APPROVED', '2025-03-15', null, null, [
            { description: 'งานสถาปัตยกรรม - ก่ออิฐ', quantity: 1, unit: 'งาน', unit_price: 280000 },
            { description: 'งานสถาปัตยกรรม - ฉาบปูน', quantity: 1, unit: 'งาน', unit_price: 150000 },
        ], 'ใบเสนอราคางานสถาปัตยกรรม');

        await createDoc('QUOTATION', 'QT', 3, proj2, 0.07, 0, 'PENDING', '2025-04-01', null, null, [
            { description: 'งานรื้อถอนผนังเดิม', quantity: 1, unit: 'งาน', unit_price: 120000 },
            { description: 'งานติดตั้งผนังกระจก', quantity: 50, unit: 'ตร.ม.', unit_price: 8500 },
        ], 'ใบเสนอราคางานปรับปรุง Phase 1');

        await createDoc('QUOTATION', 'QT', 4, proj2, 0.07, 0, 'DRAFT', '2025-04-15', null, null, [
            { description: 'งานระบบไฟฟ้า', quantity: 1, unit: 'งาน', unit_price: 450000 },
            { description: 'งานระบบปรับอากาศ', quantity: 8, unit: 'ชุด', unit_price: 65000 },
        ], 'ใบเสนอราคางานระบบ MEP');

        await createDoc('QUOTATION', 'QT', 5, proj1, 0.07, 0, 'APPROVED', '2025-05-01', null, null, [
            { description: 'งานหลังคา - โครงเหล็ก', quantity: 1, unit: 'งาน', unit_price: 320000 },
            { description: 'งานหลังคา - กระเบื้อง', quantity: 180, unit: 'ตร.ม.', unit_price: 850 },
        ], 'ใบเสนอราคางานหลังคา');

        // --- 5 Invoices (2 overdue) ---
        const pastDue = new Date(today);
        pastDue.setDate(pastDue.getDate() - 30);

        await createDoc('INVOICE', 'INV', 1, proj1, 0.07, 0.03, 'PAID', '2025-02-28', null, null, [
            { description: 'งวดที่ 1 - งานโครงสร้าง 30%', quantity: 1, unit: 'งวด', unit_price: 2500000 },
        ], 'ใบแจ้งหนี้งวดที่ 1');

        await createDoc('INVOICE', 'INV', 2, proj1, 0.07, 0.03, 'OVERDUE', pastDue.toISOString().slice(0, 10), null, null, [
            { description: 'งวดที่ 2 - งานโครงสร้าง 60%', quantity: 1, unit: 'งวด', unit_price: 2500000 },
        ], 'ใบแจ้งหนี้งวดที่ 2 - ค้างชำระ');

        await createDoc('INVOICE', 'INV', 3, proj2, 0.07, 0.03, 'OVERDUE', pastDue.toISOString().slice(0, 10), null, null, [
            { description: 'งวดที่ 1 - งานรื้อถอนและเตรียมพื้นที่', quantity: 1, unit: 'งวด', unit_price: 1200000 },
        ], 'ใบแจ้งหนี้งวดที่ 1 - ค้างชำระ');

        await createDoc('INVOICE', 'INV', 4, proj1, 0.07, 0.03, 'PENDING', '2025-06-30', null, null, [
            { description: 'งวดที่ 3 - งานสถาปัตยกรรม 30%', quantity: 1, unit: 'งวด', unit_price: 1800000 },
        ], 'ใบแจ้งหนี้งวดที่ 3');

        await createDoc('INVOICE', 'INV', 5, proj2, 0.07, 0.03, 'APPROVED', '2025-07-15', null, null, [
            { description: 'งวดที่ 2 - งานติดตั้งผนังกระจก', quantity: 1, unit: 'งวด', unit_price: 2000000 },
        ], 'ใบแจ้งหนี้งวดที่ 2');

        // --- 4 Purchase Orders ---
        await createDoc('PO', 'PO', 1, proj1, 0.07, 0, 'APPROVED', '2025-02-15', 'บริษัท ปูนซีเมนต์ไทย จำกัด', '0105536024688', [
            { description: 'ปูนซีเมนต์ปอร์ตแลนด์', quantity: 200, unit: 'ถุง', unit_price: 165 },
            { description: 'เหล็กเส้น DB16', quantity: 500, unit: 'เส้น', unit_price: 280 },
            { description: 'ทราย', quantity: 30, unit: 'คิว', unit_price: 850 },
        ], 'สั่งซื้อวัสดุก่อสร้าง Lot 1');

        await createDoc('PO', 'PO', 2, proj1, 0.07, 0, 'PAID', '2025-03-01', 'ร้านวัสดุก่อสร้าง สมบูรณ์', '3101500125432', [
            { description: 'อิฐมวลเบา', quantity: 3000, unit: 'ก้อน', unit_price: 28 },
            { description: 'กาวก่ออิฐมวลเบา', quantity: 50, unit: 'ถุง', unit_price: 195 },
        ], 'สั่งซื้อวัสดุก่ออิฐ');

        await createDoc('PO', 'PO', 3, proj2, 0.07, 0, 'APPROVED', '2025-04-01', 'บริษัท กระจกไทย จำกัด', '0105549012345', [
            { description: 'กระจกเทมเปอร์ 12mm', quantity: 50, unit: 'แผ่น', unit_price: 12000 },
            { description: 'อลูมิเนียมเฟรม', quantity: 100, unit: 'เมตร', unit_price: 3500 },
        ], 'สั่งซื้อกระจกและเฟรม');

        await createDoc('PO', 'PO', 4, proj2, 0.07, 0, 'PENDING', '2025-05-01', 'บริษัท แอร์คูล จำกัด', '0105551098765', [
            { description: 'เครื่องปรับอากาศ Daikin 24000 BTU', quantity: 8, unit: 'เครื่อง', unit_price: 45000 },
            { description: 'ค่าติดตั้ง', quantity: 8, unit: 'จุด', unit_price: 5000 },
        ], 'สั่งซื้อเครื่องปรับอากาศ');

        // --- 3 Vendor Payments ---
        await createDoc('VENDOR_PAYMENT', 'VP', 1, proj1, 0.07, 0.03, 'PAID', '2025-02-20', 'หจก. รุ่งเรืองการช่าง', '3101400567890', [
            { description: 'ค่าแรงงานก่อสร้าง - ทีมโครงสร้าง (เดือน ม.ค.)', quantity: 1, unit: 'เดือน', unit_price: 180000 },
        ], 'จ่ายค่าแรงงานเดือน มกราคม');

        await createDoc('VENDOR_PAYMENT', 'VP', 2, proj1, 0.07, 0.03, 'PAID', '2025-03-20', 'หจก. รุ่งเรืองการช่าง', '3101400567890', [
            { description: 'ค่าแรงงานก่อสร้าง - ทีมโครงสร้าง (เดือน ก.พ.)', quantity: 1, unit: 'เดือน', unit_price: 180000 },
        ], 'จ่ายค่าแรงงานเดือน กุมภาพันธ์');

        await createDoc('VENDOR_PAYMENT', 'VP', 3, proj2, 0.07, 0.03, 'APPROVED', '2025-04-15', 'บริษัท รื้อถอนมืออาชีพ จำกัด', '0105548076543', [
            { description: 'ค่างานรื้อถอนผนังและฝ้าเพดานเดิม', quantity: 1, unit: 'งาน', unit_price: 85000 },
        ], 'จ่ายค่างานรื้อถอน');

        // --- 3 Advance/Clearance ---
        await createDoc('ADVANCE', 'ADV', 1, proj1, 0, 0, 'APPROVED', '2025-02-10', null, null, [
            { description: 'เงินทดรองจ่าย - ค่าขนส่งวัสดุ', quantity: 1, unit: 'ครั้ง', unit_price: 25000 },
            { description: 'เงินทดรองจ่าย - ค่าอุปกรณ์เล็กน้อย', quantity: 1, unit: 'ครั้ง', unit_price: 15000 },
        ], 'เบิกเงินทดรองจ่ายงานขนส่ง');

        await createDoc('ADVANCE', 'ADV', 2, proj2, 0, 0, 'PENDING', '2025-04-05', null, null, [
            { description: 'เงินทดรองจ่าย - ค่าเช่าเครื่องมือ', quantity: 1, unit: 'เดือน', unit_price: 35000 },
        ], 'เบิกเงินทดรองจ่ายค่าเช่าเครื่องมือ');

        await createDoc('CLEARANCE', 'CLR', 1, proj1, 0, 0, 'APPROVED', '2025-03-01', null, null, [
            { description: 'หักล้างเงินทดรอง - ค่าขนส่งวัสดุจริง', quantity: 1, unit: 'ครั้ง', unit_price: 22500 },
            { description: 'หักล้างเงินทดรอง - ค่าอุปกรณ์จริง', quantity: 1, unit: 'ครั้ง', unit_price: 14200 },
        ], 'หักล้างเงินทดรองจ่าย');

        console.log('✅ Created 20 documents with line items');
        console.log('');
        console.log('🎉 Seed completed successfully!');
        console.log('');
        console.log('Login credentials:');
        console.log('  Admin:  admin@ncon2559.com  / 123456');
        console.log('  Editor: editor@ncon2559.com / 123456');
        console.log('  Viewer: viewer@ncon2559.com / 123456');
    } catch (err) {
        console.error('❌ Seed failed:', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

seed();

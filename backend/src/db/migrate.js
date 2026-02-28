const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
    try {
        console.log('Running database migrations...');
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await pool.query(schema);
        console.log('Core schema done.');
        // Employee module
        const empSchema = fs.readFileSync(path.join(__dirname, 'employees_schema.sql'), 'utf8');
        await pool.query(empSchema);
        console.log('Employee schema done.');
        console.log('Database migrations completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
        throw err;
    } finally {
        await pool.end();
    }
}

migrate();

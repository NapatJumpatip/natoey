-- NCON2559 Construction Accounting System - Database Schema
-- PostgreSQL

-- Enums
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE doc_type AS ENUM (
    'QUOTATION', 'INVOICE', 'TAX_INVOICE', 'RECEIPT',
    'PO', 'VENDOR_PAYMENT', 'ADVANCE', 'CLEARANCE'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE doc_status AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'PAID', 'OVERDUE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE report_type AS ENUM ('VAT_SALES', 'VAT_PURCHASE', 'PND3', 'PND53', '50BIS');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'VIEWER',
  refresh_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  client VARCHAR(255),
  location VARCHAR(255),
  start_date DATE,
  end_date DATE,
  status project_status NOT NULL DEFAULT 'PLANNING',
  contract_value DECIMAL(15, 2) DEFAULT 0,
  vat_rate DECIMAL(5, 4) DEFAULT 0.07,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project-User assignments
CREATE TABLE IF NOT EXISTS project_users (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(user_id, project_id)
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  doc_type doc_type NOT NULL,
  doc_number VARCHAR(50) UNIQUE NOT NULL,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reference_id INTEGER REFERENCES documents(id),
  subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
  vat_rate DECIMAL(5, 4) DEFAULT 0.07,
  vat_amount DECIMAL(15, 2) DEFAULT 0,
  wht_rate DECIMAL(5, 4) DEFAULT 0,
  wht_amount DECIMAL(15, 2) DEFAULT 0,
  net_total DECIMAL(15, 2) DEFAULT 0,
  status doc_status NOT NULL DEFAULT 'DRAFT',
  due_date DATE,
  notes TEXT,
  vendor_name VARCHAR(255),
  vendor_tax_id VARCHAR(50),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Line Items
CREATE TABLE IF NOT EXISTS line_items (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit VARCHAR(50) DEFAULT 'unit',
  unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
  line_total DECIMAL(15, 2) NOT NULL DEFAULT 0
);

-- Tax Reports
CREATE TABLE IF NOT EXISTS tax_reports (
  id SERIAL PRIMARY KEY,
  report_type report_type NOT NULL,
  period VARCHAR(7) NOT NULL, -- YYYY-MM
  project_id INTEGER REFERENCES projects(id),
  total_amount DECIMAL(15, 2) DEFAULT 0,
  data JSONB,
  generated_by INTEGER REFERENCES users(id),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Doc number sequences
CREATE TABLE IF NOT EXISTS doc_sequences (
  id SERIAL PRIMARY KEY,
  prefix VARCHAR(10) NOT NULL,
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  UNIQUE(prefix, year)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_due_date ON documents(due_date);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_line_items_document ON line_items(document_id);
CREATE INDEX IF NOT EXISTS idx_project_users_user ON project_users(user_id);
CREATE INDEX IF NOT EXISTS idx_project_users_project ON project_users(project_id);
CREATE INDEX IF NOT EXISTS idx_tax_reports_type ON tax_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_tax_reports_period ON tax_reports(period);

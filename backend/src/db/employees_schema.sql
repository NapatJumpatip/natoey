-- Employee Management Module Schema
-- ADDITIVE ONLY - does not modify existing tables

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  nickname VARCHAR(100),
  position VARCHAR(255),
  department VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  id_card VARCHAR(20),
  bank_account VARCHAR(50),
  bank_name VARCHAR(100),
  daily_wage DECIMAL(10, 2) DEFAULT 0,
  monthly_salary DECIMAL(12, 2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table for many-to-many: employees <-> projects
CREATE TABLE IF NOT EXISTS employee_projects (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role VARCHAR(100) DEFAULT 'Worker',
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, project_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employee_projects_employee ON employee_projects(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_projects_project ON employee_projects(project_id);

-- Multi-Company Architecture Migration Script
-- This script migrates from single-tenant to multi-company architecture
-- WARNING: Backup your database before running this migration!

-- Step 1: Create companies table
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
    business_name TEXT NOT NULL,
    business_address TEXT,
    tax_id TEXT,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    is_deleted BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Step 2: Migrate tenant data to companies
-- This assumes you have a tenants table with the old structure
INSERT INTO companies (uuid, business_name, business_address, tax_id, phone, email, logo_url, is_deleted, created_at, updated_at)
SELECT 
    uuid,
    COALESCE(business_name, name) as business_name, -- Use name if business_name is null
    business_address,
    tax_id,
    phone,
    email,
    profile_image as logo_url,
    is_deleted,
    created_at,
    updated_at
FROM tenants;

-- Step 3: Add new columns to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'employee' NOT NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT false NOT NULL;

-- Step 4: Create owner employees from tenants
-- This creates an admin employee for each company with the same credentials
INSERT INTO employees (uuid, name, email, password, phone, company_id, role, is_owner, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    t.name,
    t.email,
    t.password,
    t.phone,
    c.id as company_id,
    'admin' as role,
    true as is_owner,
    t.created_at,
    t.updated_at
FROM tenants t
JOIN companies c ON c.uuid = t.uuid
WHERE NOT EXISTS (
    -- Avoid duplicates if migration is run multiple times
    SELECT 1 FROM employees e WHERE e.email = t.email
);

-- Step 5: Add unique constraint to employee email
ALTER TABLE employees ADD CONSTRAINT employees_email_unique UNIQUE (email);

-- Step 6: Rename tenant_id to company_id in all tables
-- First, drop the old foreign key constraints
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_tenant_id_tenants_id_fk;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_tenant_id_tenants_id_fk;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_tenant_id_tenants_id_fk;
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_tenant_id_tenants_id_fk;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_tenant_id_tenants_id_fk;
ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_tenant_id_tenants_id_fk;
ALTER TABLE invoice_settings DROP CONSTRAINT IF EXISTS invoice_settings_tenant_id_tenants_id_fk;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_tenant_id_tenants_id_fk;
ALTER TABLE brands DROP CONSTRAINT IF EXISTS brands_tenant_id_tenants_id_fk;
ALTER TABLE units DROP CONSTRAINT IF EXISTS units_tenant_id_tenants_id_fk;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_uid_tenants_id_fk;

-- Rename columns
ALTER TABLE employees RENAME COLUMN tenant_id TO company_id;
ALTER TABLE products RENAME COLUMN tenant_id TO company_id;
ALTER TABLE customers RENAME COLUMN tenant_id TO company_id;
ALTER TABLE suppliers RENAME COLUMN tenant_id TO company_id;
ALTER TABLE invoices RENAME COLUMN tenant_id TO company_id;
ALTER TABLE invoice_items RENAME COLUMN tenant_id TO company_id;
ALTER TABLE invoice_settings RENAME COLUMN tenant_id TO company_id;
ALTER TABLE categories RENAME COLUMN tenant_id TO company_id;
ALTER TABLE brands RENAME COLUMN tenant_id TO company_id;
ALTER TABLE units RENAME COLUMN tenant_id TO company_id;
ALTER TABLE tasks RENAME COLUMN uid TO company_id;

-- Add new foreign key constraints
ALTER TABLE employees ADD CONSTRAINT employees_company_id_companies_id_fk 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE products ADD CONSTRAINT products_company_id_companies_id_fk 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE customers ADD CONSTRAINT customers_company_id_companies_id_fk 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_company_id_companies_id_fk 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD CONSTRAINT invoices_company_id_companies_id_fk 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_company_id_companies_id_fk 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE invoice_settings ADD CONSTRAINT invoice_settings_company_id_companies_id_fk 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE categories ADD CONSTRAINT categories_company_id_companies_id_fk 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE brands ADD CONSTRAINT brands_company_id_companies_id_fk 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE units ADD CONSTRAINT units_company_id_companies_id_fk 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD CONSTRAINT tasks_company_id_companies_id_fk 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Step 7: Drop tenants table (CAREFUL! Make sure you have a backup!)
-- Uncomment the line below only after verifying the migration was successful
-- DROP TABLE IF EXISTS tenants;

-- Migration complete!
-- Next steps:
-- 1. Test the application thoroughly
-- 2. Verify all data is accessible
-- 3. Test authentication with migrated employee accounts
-- 4. Once verified, uncomment and run the DROP TABLE statement above

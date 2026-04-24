-- Migration: 002_uuid_constraints.sql
-- Description: Add UNIQUE constraints to units and categories uuid columns
-- Created: 2026-04-17

-- Add UNIQUE constraint to units.uuid if not exists
ALTER TABLE units DROP CONSTRAINT IF EXISTS units_uuid_unique;
ALTER TABLE units ADD CONSTRAINT units_uuid_unique UNIQUE (uuid);

-- Add UNIQUE constraint to categories.uuid if not exists
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_uuid_unique;
ALTER TABLE categories ADD CONSTRAINT categories_uuid_unique UNIQUE (uuid);

-- Ensure brands.uuid already has unique constraint (verify)
ALTER TABLE brands DROP CONSTRAINT IF EXISTS brands_uuid_unique;
ALTER TABLE brands ADD CONSTRAINT brands_uuid_unique UNIQUE (uuid);

-- Ensure products.uuid already has unique constraint (verify)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_uuid_unique;
ALTER TABLE products ADD CONSTRAINT products_uuid_unique UNIQUE (uuid);

-- Add indexes for faster uuid lookups during sync
CREATE INDEX IF NOT EXISTS idx_units_uuid_company ON units(uuid, company_id);
CREATE INDEX IF NOT EXISTS idx_categories_uuid_company ON categories(uuid, company_id);
CREATE INDEX IF NOT EXISTS idx_brands_uuid_company ON brands(uuid, company_id);
CREATE INDEX IF NOT EXISTS idx_products_uuid_company ON products(uuid, company_id);
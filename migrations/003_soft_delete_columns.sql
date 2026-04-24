-- Migration: 003_soft_delete_columns.sql
-- Description: Add deletedAt timestamp column for soft delete support
-- Created: 2026-04-17

-- Add deletedAt column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add deletedAt column to units
ALTER TABLE units ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add deletedAt column to categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add deletedAt column to brands
ALTER TABLE brands ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create indexes for soft delete queries
CREATE INDEX IF NOT EXISTS idx_products_active ON products(company_id, is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_units_active ON units(company_id, is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(company_id, is_deleted) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_brands_active ON brands(company_id, is_deleted) WHERE is_deleted = false;
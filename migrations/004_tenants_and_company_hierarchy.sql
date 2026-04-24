-- ============================================================================
-- Migration: 004_tenants_and_company_hierarchy.sql
-- Purpose: Add first-class tenants entity with company hierarchy
-- Safety: Additive only (no breaking changes for live production)
-- Created: 2026-04-17
-- ============================================================================

-- ============================================================================
-- PHASE A: CREATE TENANTS TABLE
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    external_key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    plan VARCHAR(50) DEFAULT 'free',
    plan_expires_at TIMESTAMPTZ,
    billing_email VARCHAR(255),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenants_external ON tenants(external_key);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- ============================================================================
-- PHASE A: ADD TENANT FK TO COMPANIES
-- ============================================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tenant_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id);

-- ============================================================================
-- PHASE A: UPDATE OPERATIONS_LOG
-- ============================================================================
ALTER TABLE operations_log ADD COLUMN IF NOT EXISTS tenant_fk INTEGER;
ALTER TABLE operations_log ADD COLUMN IF NOT EXISTS company_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_ops_company ON operations_log(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_idempotency_partial ON operations_log(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- PHASE B: BACKFILL
-- ============================================================================
INSERT INTO tenants (uuid, external_key, name, slug, status, created_at)
SELECT uuid_generate_v4(), 'tenant_default', COALESCE(business_name, 'Default Organization'), 'defaultorg', 'active', NOW()
FROM companies WHERE tenant_id IS NULL AND is_deleted = false LIMIT 1
ON CONFLICT (external_key) DO NOTHING;

UPDATE companies SET tenant_id = (SELECT id FROM tenants WHERE external_key = 'tenant_default' LIMIT 1)
WHERE tenant_id IS NULL AND is_deleted = false;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
SELECT 'Migration 004 applied' as status;
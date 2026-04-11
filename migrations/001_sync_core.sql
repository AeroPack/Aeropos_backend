-- Ezo POS Sync API - Core Schema
-- Migration 001: Operations Log, Sync Cursors, Stock Ledger, Stock Snapshot

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CORE: Operations Log (Source of Truth)
-- =====================================================
CREATE TABLE IF NOT EXISTS operations_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    table_name VARCHAR(50) NOT NULL,
    record_key UUID NOT NULL,
    payload JSONB NOT NULL,
    version BIGINT NOT NULL,
    idempotency_key UUID,
    client_generated_at TIMESTAMPTZ,
    server_generated_at TIMESTAMPTZ DEFAULT NOW(),
    client_id VARCHAR(100),
    
    CONSTRAINT uq_tenant_idem UNIQUE (tenant_id, idempotency_key)
);

-- Indexes for efficient sync queries
CREATE INDEX IF NOT EXISTS idx_ops_tenant_version ON operations_log(tenant_id, version);
CREATE INDEX IF NOT EXISTS idx_ops_tenant_record ON operations_log(tenant_id, table_name, record_key);
CREATE INDEX IF NOT EXISTS idx_ops_version ON operations_log(tenant_id, version);

-- =====================================================
-- Sync Cursors (Per Tenant)
-- =====================================================
CREATE TABLE IF NOT EXISTS sync_cursors (
    tenant_id VARCHAR(50) PRIMARY KEY,
    client_id VARCHAR(100),
    last_version_synced BIGINT NOT NULL DEFAULT 0,
    last_ack_version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INVENTORY: Stock Ledger (Delta-Based)
-- =====================================================
CREATE TABLE IF NOT EXISTS stock_ledger (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    product_key UUID NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'TRANSFER')),
    quantity DECIMAL(10, 3) NOT NULL,
    reference_type VARCHAR(50),
    reference_key UUID,
    version BIGINT NOT NULL,
    idempotency_key UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT uq_stock_idem UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_stock_tenant_product ON stock_ledger(tenant_id, product_key, id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_version ON stock_ledger(tenant_id, version);

-- Materialized snapshot for fast stock queries
CREATE TABLE IF NOT EXISTS stock_snapshot (
    tenant_id VARCHAR(50) NOT NULL,
    product_key UUID NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (tenant_id, product_key)
);

-- =====================================================
-- Sync Outbox Tables (for Flutter Client)
-- =====================================================
CREATE TABLE IF NOT EXISTS sync_outbox (
    id BIGSERIAL PRIMARY KEY,
    idempotency_key UUID NOT NULL,
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    table_name VARCHAR(50) NOT NULL,
    record_key UUID NOT NULL,
    payload JSONB NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    client_generated_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acked', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status);

CREATE TABLE IF NOT EXISTS sync_inbox (
    id BIGSERIAL PRIMARY KEY,
    server_operation_id BIGINT NOT NULL,
    operation VARCHAR(10) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_key UUID NOT NULL,
    payload JSONB NOT NULL,
    version BIGINT NOT NULL,
    server_generated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_inbox_version ON sync_inbox(version);

CREATE TABLE IF NOT EXISTS sync_state (
    tenant_id VARCHAR(50) NOT NULL,
    local_version BIGINT NOT NULL DEFAULT 0,
    remote_version BIGINT NOT NULL DEFAULT 0,
    last_ack_version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (tenant_id)
);

CREATE TABLE IF NOT EXISTS stock_outbox (
    id BIGSERIAL PRIMARY KEY,
    product_key UUID NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT')),
    quantity DECIMAL(10, 3) NOT NULL,
    reference_type VARCHAR(50),
    reference_key UUID,
    idempotency_key UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acked', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_outbox_status ON stock_outbox(status);
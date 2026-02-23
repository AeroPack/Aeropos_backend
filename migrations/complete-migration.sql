-- Complete the migration by creating admin employees from tenants
-- This is the part that failed in the original migration

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

---
name: sync-endpoint
description: Generate a complete sync endpoint for an entity. Use when adding backend sync
  support for a Flutter entity. Creates Drizzle schema additions, Zod validators, repository
  upsert function, service layer, and Express route following the uuid-based sync contract.
allowed-tools: Read, Write, Bash
---

## Context
@src/db/schema/index.ts
@src/validators/

## Existing routes
!`ls src/routes/`

## Existing schema tables
!`grep "export" src/db/schema/index.ts`

## Task
Generate sync endpoint for entity: $ARGUMENTS

### 1. Drizzle schema addition in src/db/schema/<name>.ts
- uuid column: text('uuid').notNull().unique()
- All domain columns
- createdAt, updatedAt timestamps
- Standard: id serial primaryKey
- Export and add to src/db/schema/index.ts

### 2. Zod validator in src/validators/<name>_validator.ts
- CreateSchema: all required fields + uuid (must be valid UUID v4)
- UpdateSchema: CreateSchema.partial() — keep uuid required
- SyncItemSchema: for individual item in batch sync
- SyncBatchSchema: z.array(SyncItemSchema).max(500)

### 3. Repository in src/repositories/<name>_repository.ts
- findAll(since?: Date): for delta sync
- upsertBatch(items: SyncItem[]): INSERT ... ON CONFLICT (uuid) DO UPDATE
- findByUuids(uuids: string[]): for lookups

### 4. Service in src/services/<name>_service.ts
- syncBatch(items): validate → upsert → return {synced, failed, timestamp}
- getUpdatedSince(since?: string): validate ISO string → call repo

### 5. Route in src/routes/<name>_route.ts
- GET /<names>?since=ISO → getUpdatedSince → 200
- POST /<names>/sync → syncBatch → 200
- Both require: verifyToken middleware + RBAC role check
- Use the standard response format {success, data, meta}
- Register in src/routes/index.ts

After generating: run `npm run db:migrate` to create the migration.
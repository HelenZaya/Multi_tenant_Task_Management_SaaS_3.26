# Tenant Isolation Architecture

## Overview

TaskFlow uses a **shared database, shared schema** multi-tenancy model with PostgreSQL Row-Level Security (RLS) for strict data isolation.

## How It Works

### 1. Every Table Has `tenant_id`

All tenant-scoped tables include a `tenant_id UUID NOT NULL` column with a foreign key to the `tenants` table. The only exceptions are `tenants` and `users` (which are global).

### 2. RLS Policies on Every Table

```sql
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- SELECT, UPDATE, DELETE
CREATE POLICY tasks_tenant_isolation ON tasks
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- INSERT
CREATE POLICY tasks_tenant_insert ON tasks
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

### 3. Tenant Context Per Request

Every database query runs inside a transaction that sets the tenant context:

```typescript
// packages/db/src/postgres.ts
export async function queryWithTenant<T>(
  tenantId: string,
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`);
    const result = await client.query<T>(text, params);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

`SET LOCAL` scopes the setting to the current transaction only. Once the transaction ends, the setting is cleared.

### 4. Tenant Context Middleware

The API Gateway decodes the JWT and injects `x-tenant-id` as a header. Each service extracts this via middleware:

```
Client → Bearer JWT → API Gateway (decode) → x-tenant-id header → Service → SET LOCAL
```

### 5. What's Protected

| Table | RLS | tenant_id |
|-------|-----|-----------|
| tenants | No (global) | — |
| users | No (global) | — |
| memberships | Yes | FK → tenants |
| projects | Yes | FK → tenants |
| project_members | Yes | FK → tenants |
| boards | Yes | FK → tenants |
| columns | Yes | FK → tenants |
| tasks | Yes | FK → tenants |
| comments | Yes | FK → tenants |
| activity_logs | Yes | FK → tenants |
| attachments | Yes | FK → tenants |
| notifications | Yes | FK → tenants |
| subscriptions | Yes | FK → tenants |
| feature_flags | Yes | FK → tenants |
| usage_records | Yes | FK → tenants |
| analytics_* | Yes | FK → tenants |

### 6. Security Guarantees

- **A tenant can never see another tenant's data** — enforced at the database level
- **Even a SQL injection cannot cross tenant boundaries** — RLS is enforced by PostgreSQL, not application code
- **Application bugs cannot leak data** — if `app.tenant_id` is not set, RLS returns zero rows
- **Indexes include tenant_id** — queries are fast even with shared tables

## Testing Isolation

```sql
-- As tenant A
SET app.tenant_id = 'tenant-a-uuid';
SELECT COUNT(*) FROM tasks; -- Returns only tenant A's tasks

-- As tenant B
SET app.tenant_id = 'tenant-b-uuid';
SELECT COUNT(*) FROM tasks; -- Returns only tenant B's tasks

-- Without context
RESET app.tenant_id;
SELECT COUNT(*) FROM tasks; -- Returns 0 rows (RLS blocks all)
```

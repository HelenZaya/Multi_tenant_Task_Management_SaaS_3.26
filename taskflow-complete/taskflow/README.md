# TaskFlow — Enterprise Multi-tenant Task Management SaaS

A production-grade, microservices-based task management platform built with Node.js, Fastify, PostgreSQL, Redis, and Socket.IO.

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────────────┐
│   Clients   │────▶│                 Nginx (L7 Proxy)                 │
│  (Web/Mobile)│     │         :80 → API Gateway / Socket.IO           │
└─────────────┘     └──────────────┬──────────────────┬────────────────┘
                                   │                  │
                    ┌──────────────▼──────────┐  ┌────▼──────────────┐
                    │    API Gateway :3000     │  │ Realtime :3005    │
                    │  JWT decode · Rate limit │  │ Socket.IO + Redis │
                    │  Proxy → microservices   │  │ adapter           │
                    └──────────┬──────────────┘  └──────────────────┘
                               │
          ┌────────────────────┼──────────────────────┐
          │                    │                       │
    ┌─────▼─────┐    ┌────────▼──────┐    ┌──────────▼────────┐
    │Auth :3001  │    │Tenant :3002   │    │Project :3003      │
    │Register    │    │Members        │    │CRUD, Progress     │
    │Login       │    │Invites        │    │Boards, Members    │
    │JWT/Refresh │    │Roles          │    │                   │
    └────────────┘    └───────────────┘    └───────────────────┘

    ┌────────────┐    ┌───────────────┐    ┌───────────────────┐
    │Task :3004  │    │Notify :3006   │    │Analytics :3007    │
    │LexoRank    │    │Event handlers │    │CQRS read model    │
    │Comments    │    │In-app + Email │    │Dashboard, KPIs    │
    │Activity    │    │               │    │Burndown           │
    └────────────┘    └───────────────┘    └───────────────────┘

    ┌────────────┐    ┌───────────────┐
    │Billing:3008│    │Worker :3009   │
    │Plans/Limits│    │Cron jobs      │
    │Features    │    │LexoRank rebal │
    │Usage       │    │Email queue    │
    └────────────┘    └───────────────┘
          │                    │
    ┌─────▼────────────────────▼──────┐
    │         Redis (pub/sub, cache)  │
    │         PostgreSQL (RLS)        │
    └─────────────────────────────────┘
```

## Key Features

| Feature | Implementation |
|---------|---------------|
| Multi-tenancy | Shared DB, `tenant_id` on all tables, PostgreSQL Row-Level Security |
| Authentication | JWT access (15m) + refresh (7d) tokens with rotation + reuse detection |
| Authorization | Role-based: owner > admin > member > viewer |
| Task ordering | LexoRank (Base62 fractional indexing) with background rebalancing |
| Realtime | Socket.IO with Redis adapter for horizontal scaling |
| Events | Redis pub/sub domain events across all services |
| Analytics | CQRS read model with dashboard, burndown, productivity metrics |
| Billing | Free/Pro/Enterprise plans with feature flags and usage tracking |
| Notifications | Event-driven in-app + email-ready architecture |

## Tech Stack

- **Runtime**: Node.js 20, TypeScript 5.4
- **Framework**: Fastify 5
- **Database**: PostgreSQL 16 (raw SQL, no ORM)
- **Cache/PubSub**: Redis 7
- **Realtime**: Socket.IO 4 with Redis adapter
- **Monorepo**: pnpm workspaces
- **Infra**: Docker Compose, Kubernetes, Nginx
- **CI/CD**: GitHub Actions

## Quick Start

```bash
# Clone and setup
git clone <repo-url> && cd taskflow
cp .env.example .env
# Edit .env — set JWT_SECRET and JWT_REFRESH_SECRET to random 64-char strings

# Start everything
docker-compose -f infra/docker/docker-compose.yml up --build

# Or start infrastructure only + run services locally
docker-compose -f infra/docker/docker-compose.yml up postgres redis
pnpm install
pnpm run dev
```

## Testing the API

```bash
# 1. Register a tenant
curl -X POST http://localhost:3000/auth/register-tenant \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Acme Corp",
    "tenantSlug": "acme-corp",
    "fullName": "Alice Johnson",
    "email": "alice@acme.com",
    "password": "SecurePass1"
  }'
# Save the accessToken and refreshToken from response

# 2. Create a project
curl -X POST http://localhost:3000/projects \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Website Redesign", "slug": "website-redesign"}'

# 3. Create a task
curl -X POST http://localhost:3000/tasks \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "<projectId>",
    "columnId": "<columnId>",
    "title": "Design homepage",
    "priority": "high"
  }'

# 4. Move task (drag and drop)
curl -X POST http://localhost:3000/tasks/<taskId>/move \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"columnId": "<newColumnId>", "afterPosition": "aaa"}'

# 5. Get dashboard
curl http://localhost:3000/analytics/dashboard \
  -H "Authorization: Bearer <accessToken>"
```

## Project Structure

```
taskflow/
├── packages/
│   ├── db/          # PostgreSQL pool, Redis, tenant context, migrations, event bus
│   └── utils/       # Env loader, logger, errors, schemas, server builder
├── services/
│   ├── api-gateway/          # Proxy + rate limiting + JWT decode
│   ├── auth-service/         # Register, login, JWT, refresh rotation
│   ├── tenant-service/       # Workspaces, members, invites
│   ├── project-service/      # Projects, boards, progress
│   ├── task-service/         # Tasks (LexoRank), comments, attachments
│   ├── realtime-service/     # Socket.IO + Redis adapter
│   ├── notification-service/ # Event listeners + in-app notifications
│   ├── analytics-service/    # CQRS dashboard + productivity
│   ├── billing-service/      # Plans, feature flags, usage
│   └── worker-service/       # Background jobs + cron scheduler
├── infra/
│   ├── docker/      # docker-compose.yml, init.sql
│   ├── k8s/         # Kubernetes manifests
│   └── nginx/       # Reverse proxy config
└── docs/            # Documentation
```

## Tenant Isolation

Every tenant-scoped table has `tenant_id UUID NOT NULL` with Row-Level Security:

```sql
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_tenant_isolation ON tasks
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

Every request sets tenant context before executing queries:

```sql
BEGIN;
SET LOCAL app.tenant_id = '<tenant-uuid>';
SELECT * FROM tasks WHERE project_id = '...';
COMMIT;
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | — | Access token signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | — | Refresh token signing secret (min 32 chars) |
| `JWT_ACCESS_EXPIRY` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRY` | `7d` | Refresh token TTL |
| `NODE_ENV` | `development` | Environment |
| `LOG_LEVEL` | `info` | Pino log level |

## Deployment

### Docker Compose (Development/Staging)
```bash
docker-compose -f infra/docker/docker-compose.yml up --build
```

### Kubernetes (Production)
```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/secrets.yaml
kubectl apply -f infra/k8s/configmap.yaml
kubectl apply -f infra/k8s/postgres.yaml
kubectl apply -f infra/k8s/redis.yaml
kubectl apply -f infra/k8s/deployment-*.yaml
kubectl apply -f infra/k8s/ingress.yaml
```

## License

MIT

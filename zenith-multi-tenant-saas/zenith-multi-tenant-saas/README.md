# Zenith Multi-tenant Task Management SaaS

Production-style full-stack starter for a multi-tenant task management SaaS.

## Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express + Prisma
- Database: PostgreSQL
- Realtime: Socket.IO + Redis adapter
- Reverse proxy / HTTPS: Nginx
- Containers: Docker Compose
- Kubernetes manifests: `k8s/`
- Observability: Pino logging, `/health`, `/ready`, Prometheus metrics endpoint

## Features

- JWT auth + refresh token rotation
- Multi-tenant isolation via `organizationId`
- RBAC: Admin / Member / Viewer
- Board → List → Card structure
- Fractional indexing for card ordering
- Real-time card and board updates
- Workspace dashboard (completion, overdue)
- Filtering by assignee / label / deadline
- Validation, rate limiting, centralized error handling
- Frontend and backend separated cleanly

## Local run (recommended)

1. Copy env file:
   ```bash
   cp .env.example .env
   ```
2. Run with Docker:
   ```bash
   docker compose up --build
   ```
3. Open:
   - Frontend (HTTPS via Nginx): `https://localhost`
   - Backend proxied API: `https://localhost/api`
   - Metrics: `https://localhost/metrics`

## Seeded demo users

Password for all demo users:
`Password123!`

- `admin@zenith.local`
- `member@zenith.local`
- `viewer@zenith.local`

## Useful commands without Docker

### Backend
```bash
cd backend
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Notes

- For production cloud deployment, swap local Postgres / Redis with Neon / Railway / Render equivalents.
- `k8s/` contains manifests for namespace, configmap, secret, deployment, service, ingress, and optional postgres/redis workloads.
- HTTPS in local uses a self-signed cert under `nginx/certs/`. Browsers may show a warning on first open.

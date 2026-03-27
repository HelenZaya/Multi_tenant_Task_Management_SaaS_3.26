# Deployment Guide

## Prerequisites

- Docker 24+ and Docker Compose v2
- Node.js 20+ and pnpm 9+ (for local development)
- kubectl and a Kubernetes cluster (for production)

## Local Development

```bash
# 1. Clone and configure
git clone <repo> && cd taskflow
cp .env.example .env
# Generate secure secrets:
openssl rand -hex 32  # → paste as JWT_SECRET
openssl rand -hex 32  # → paste as JWT_REFRESH_SECRET

# 2. Start infrastructure
docker-compose -f infra/docker/docker-compose.yml up postgres redis -d

# 3. Install and run
pnpm install
pnpm run migrate   # Apply database schema
pnpm run seed      # Load sample data
pnpm run dev       # Start all services in watch mode
```

## Docker Compose (Staging)

```bash
# Full stack — all 10 services + Postgres + Redis + Nginx
docker-compose -f infra/docker/docker-compose.yml up --build

# Verify
curl http://localhost/health          # Nginx → Gateway
curl http://localhost:3001/health     # Auth service direct
curl http://localhost:3000/           # Gateway route listing
```

## Kubernetes (Production)

### 1. Build and push images

```bash
# Build all service images
for svc in api-gateway auth-service tenant-service project-service task-service \
           realtime-service notification-service analytics-service billing-service worker-service; do
  docker build --build-arg SERVICE_NAME=$svc -t your-registry/taskflow/$svc:latest .
  docker push your-registry/taskflow/$svc:latest
done
```

### 2. Deploy to cluster

```bash
# Core resources
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/secrets.yaml      # Edit with real base64 values first!
kubectl apply -f infra/k8s/configmap.yaml

# Infrastructure
kubectl apply -f infra/k8s/postgres.yaml
kubectl apply -f infra/k8s/redis.yaml

# Wait for infra
kubectl -n taskflow wait --for=condition=ready pod -l app=postgres --timeout=60s
kubectl -n taskflow wait --for=condition=ready pod -l app=redis --timeout=60s

# Application services (all 10)
kubectl apply -f infra/k8s/deployment-api-gateway.yaml
kubectl apply -f infra/k8s/deployment-auth-service.yaml
kubectl apply -f infra/k8s/deployment-tenant-service.yaml
kubectl apply -f infra/k8s/deployment-project-service.yaml
kubectl apply -f infra/k8s/deployment-task-service.yaml
kubectl apply -f infra/k8s/deployment-realtime-service.yaml
kubectl apply -f infra/k8s/deployment-notification-service.yaml
kubectl apply -f infra/k8s/deployment-analytics-service.yaml
kubectl apply -f infra/k8s/deployment-billing-service.yaml
kubectl apply -f infra/k8s/deployment-worker-service.yaml

# Ingress
kubectl apply -f infra/k8s/ingress.yaml

# Verify
kubectl -n taskflow get pods
kubectl -n taskflow get svc
kubectl -n taskflow get hpa
```

### 3. Database migration

```bash
kubectl -n taskflow exec -it deploy/auth-service -- node -e "
  const { createPool, runMigrations, closePool } = require('@taskflow/db');
  createPool({ connectionString: process.env.DATABASE_URL });
  runMigrations('/app/services/auth-service/migrations').then(() => closePool());
"
```

## Health Checks

Every service exposes:
- `GET /health` — shallow (returns immediately)
- `GET /health/deep` — checks Postgres + Redis connectivity
- `GET /metrics` — memory, CPU, uptime

## Scaling

HPAs are configured for all services:
- Scale at 70% CPU or 80% memory utilization
- Min/max replicas per service (e.g., api-gateway: 2–5, task-service: 2–6)
- Realtime service scales via Socket.IO Redis adapter

## Monitoring

Services use pino structured JSON logging with:
- `requestId` — unique per request
- `correlationId` — propagated across service calls
- `tenantId` / `userId` — for tenant-scoped log filtering
- Response times on every request

Logs can be shipped to ELK, Datadog, or any JSON log aggregator.

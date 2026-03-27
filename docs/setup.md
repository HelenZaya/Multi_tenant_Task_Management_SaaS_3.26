# Setup Guide

## Local prerequisites
- Docker Desktop
- Copy `.env.example` to `.env`

## One-command local run
```bash
docker compose up --build
```

Open `https://localhost`.

## Service map
- `frontend`: Vite React UI
- `gateway`: request routing and rate limiting
- `backend`: versioned API, Prisma, Socket.IO
- `services`: BullMQ workers and event subscribers
- `postgres`: primary OLTP database
- `redis`: cache, pub/sub, queues
- `nginx`: TLS termination and reverse proxy

# Architecture Diagram

```mermaid
flowchart LR
  Browser --> Nginx
  Nginx --> Frontend
  Nginx --> Gateway
  Gateway --> Backend
  Backend --> Postgres
  Backend --> Redis
  Backend --> SocketIO[Socket.IO]
  Backend --> Outbox[Outbox Events]
  Outbox --> Redis
  Redis --> Worker
  Worker --> Jobs[BullMQ Queues]
```

## Notes
- Tenant isolation is enforced by `tenantId` on all core records.
- Redis is used for cache, pub/sub, Socket.IO adapter, and BullMQ queues.
- CQRS is represented by write endpoints plus optimized summary/report read models.

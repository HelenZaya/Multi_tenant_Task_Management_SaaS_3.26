# API Reference

Base URL: `http://localhost:3000` (via API Gateway)

All endpoints return JSON in the format:
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```

## Authentication

### POST /auth/register-tenant
Create a new workspace with owner account.
```json
{
  "tenantName": "Acme Corp",
  "tenantSlug": "acme-corp",
  "fullName": "Alice Johnson",
  "email": "alice@acme.com",
  "password": "SecurePass1"
}
```

### POST /auth/login
```json
{ "email": "alice@acme.com", "password": "SecurePass1", "tenantSlug": "acme-corp" }
```

### POST /auth/refresh
```json
{ "refreshToken": "<refresh_token>" }
```

### POST /auth/logout
```json
{ "refreshToken": "<refresh_token>" }
```

### GET /auth/me
Returns current user profile. **Requires: Bearer token**

---

## Tenants

All endpoints require `Authorization: Bearer <token>`.

| Method | Path | Description |
|--------|------|-------------|
| GET | /tenants/current | Get current workspace |
| PATCH | /tenants/current | Update workspace (owner/admin) |
| GET | /tenants/mine | List user's workspaces |
| GET | /tenants/members | List members (paginated) |
| POST | /tenants/members/invite | Invite by email |
| PATCH | /tenants/members/:id/role | Change role |
| DELETE | /tenants/members/:id | Remove member |
| POST | /tenants/leave | Leave workspace |

---

## Projects

| Method | Path | Description |
|--------|------|-------------|
| POST | /projects | Create project (auto-creates board + columns) |
| GET | /projects | List projects (search, pagination, archive filter) |
| GET | /projects/:id | Get project |
| PATCH | /projects/:id | Update project (admin) |
| DELETE | /projects/:id | Delete project (admin) |
| POST | /projects/:id/archive | Archive |
| POST | /projects/:id/unarchive | Unarchive |
| GET | /projects/:id/progress | Task statistics |
| GET | /projects/:id/boards | Boards with columns |
| GET | /projects/:id/members | Project members |
| POST | /projects/:id/members | Add member |
| PATCH | /projects/:id/members/:mid | Update member role |
| DELETE | /projects/:id/members/:mid | Remove member |

---

## Tasks

| Method | Path | Description |
|--------|------|-------------|
| POST | /tasks | Create task (LexoRank positioned) |
| GET | /tasks?projectId=...&columnId=... | List tasks (filterable) |
| GET | /tasks/:id | Get task detail |
| PATCH | /tasks/:id | Update task |
| POST | /tasks/:id/move | Move task (column + position) |
| DELETE | /tasks/:id | Soft delete |

### Move Task Body
```json
{
  "columnId": "<target-column-id>",
  "beforePosition": "bbb",
  "afterPosition": "ccc"
}
```

---

## Comments

| Method | Path | Description |
|--------|------|-------------|
| POST | /tasks/:id/comments | Add comment |
| GET | /tasks/:id/comments | List comments |
| PATCH | /comments/:id | Edit own comment |
| DELETE | /comments/:id | Delete own comment |

---

## Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | /notifications | List (paginated, unread filter) |
| GET | /notifications/unread-count | Unread count |
| POST | /notifications/mark-read | Mark specific as read |
| POST | /notifications/mark-all-read | Mark all as read |
| DELETE | /notifications/:id | Delete |

---

## Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | /analytics/dashboard | Full tenant dashboard |
| GET | /analytics/projects?projectId=... | Project analytics + burndown |
| GET | /analytics/productivity | Team productivity |
| GET | /analytics/productivity?userId=... | Individual productivity |

---

## Billing

| Method | Path | Description |
|--------|------|-------------|
| GET | /billing/plans | All plan definitions |
| GET | /billing/overview | Full billing status |
| GET | /billing/subscription | Current subscription |
| POST | /billing/change-plan | Upgrade/downgrade |
| POST | /billing/cancel | Cancel subscription |
| GET | /billing/limits/members | Member limit check |
| GET | /billing/limits/projects | Project limit check |
| GET | /billing/features | Feature flags |
| GET | /billing/features/check?feature=sso | Check feature |
| POST | /billing/usage | Record usage metric |
| GET | /billing/usage | Query usage |

---

## Realtime (Socket.IO)

Connect: `io("ws://localhost:3005", { auth: { token: "Bearer <jwt>" } })`

### Client → Server Events
| Event | Payload | Description |
|-------|---------|-------------|
| join:project | projectId | Join project room |
| leave:project | projectId | Leave project room |
| ping | — | Heartbeat |

### Server → Client Events
| Event | Description |
|-------|-------------|
| connected | Connection confirmed |
| task:created | New task in project room |
| task:updated | Task modified |
| task:moved | Task moved between columns |
| task:deleted | Task deleted |
| comment:added | New comment |
| notification:new | Personal notification |
| member:invited | New member invited (tenant room) |
| member:added | Member added to project |
| project:created | New project (tenant room) |
| server:shutdown | Server restarting |

-- ============================================================
-- Migration 005: Comments, Activity Logs, Attachments
-- ============================================================

-- ─── Comments ───────────────────────────────────────────────
CREATE TABLE comments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id),
    content     TEXT NOT NULL,
    edited_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_comments_task ON comments (tenant_id, task_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_comments_user ON comments (tenant_id, user_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Activity Logs ──────────────────────────────────────────
CREATE TABLE activity_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
    user_id         UUID NOT NULL REFERENCES users(id),
    action          VARCHAR(50) NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       UUID NOT NULL,
    changes         JSONB DEFAULT '{}',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_tenant ON activity_logs (tenant_id, created_at DESC);
CREATE INDEX idx_activity_logs_project ON activity_logs (tenant_id, project_id, created_at DESC);
CREATE INDEX idx_activity_logs_task ON activity_logs (tenant_id, task_id, created_at DESC) WHERE task_id IS NOT NULL;
CREATE INDEX idx_activity_logs_user ON activity_logs (tenant_id, user_id, created_at DESC);

-- ─── Attachments ────────────────────────────────────────────
CREATE TABLE attachments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    filename        VARCHAR(500) NOT NULL,
    file_size       BIGINT NOT NULL,
    mime_type       VARCHAR(255) NOT NULL,
    storage_key     VARCHAR(1024) NOT NULL,
    storage_url     VARCHAR(2048),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_attachments_task ON attachments (tenant_id, task_id) WHERE deleted_at IS NULL;

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY comments_tenant_isolation ON comments
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY comments_tenant_insert ON comments
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_logs_tenant_isolation ON activity_logs
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY activity_logs_tenant_insert ON activity_logs
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY attachments_tenant_isolation ON attachments
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY attachments_tenant_insert ON attachments
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

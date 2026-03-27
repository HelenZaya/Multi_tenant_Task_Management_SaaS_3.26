-- ============================================================
-- Migration 004: Boards, Columns, Tasks (LexoRank ordering)
-- ============================================================

-- ─── Boards ─────────────────────────────────────────────────
CREATE TABLE boards (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    position    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_boards_project ON boards (tenant_id, project_id, position) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_boards_updated_at
    BEFORE UPDATE ON boards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Columns ────────────────────────────────────────────────
CREATE TABLE columns (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    position    VARCHAR(255) NOT NULL,
    color       VARCHAR(7) DEFAULT '#6366f1',
    wip_limit   INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_columns_board ON columns (tenant_id, board_id, position) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_columns_updated_at
    BEFORE UPDATE ON columns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Tasks ──────────────────────────────────────────────────
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    column_id       UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'in_progress', 'in_review', 'done', 'archived')),
    priority        VARCHAR(10) NOT NULL DEFAULT 'none'
                    CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),
    position        VARCHAR(255) NOT NULL,
    assignee_id     UUID REFERENCES users(id),
    reporter_id     UUID REFERENCES users(id),
    due_date        TIMESTAMPTZ,
    estimated_hours DECIMAL(6,2),
    actual_hours    DECIMAL(6,2),
    tags            TEXT[] DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- THE critical LexoRank index
CREATE INDEX idx_tasks_position
    ON tasks (tenant_id, project_id, position) WHERE deleted_at IS NULL;

CREATE INDEX idx_tasks_column ON tasks (tenant_id, column_id, position) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_assignee ON tasks (tenant_id, assignee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_status ON tasks (tenant_id, project_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_due_date ON tasks (tenant_id, due_date) WHERE deleted_at IS NULL AND due_date IS NOT NULL;
CREATE INDEX idx_tasks_priority ON tasks (tenant_id, project_id, priority) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY boards_tenant_isolation ON boards
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY boards_tenant_insert ON boards
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY columns_tenant_isolation ON columns
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY columns_tenant_insert ON columns
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_tenant_isolation ON tasks
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tasks_tenant_insert ON tasks
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

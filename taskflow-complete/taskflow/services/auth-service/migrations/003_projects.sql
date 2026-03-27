-- ============================================================
-- Migration 003: Projects (tenant-scoped, RLS enforced)
-- ============================================================

CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    slug            VARCHAR(63) NOT NULL,
    color           VARCHAR(7) DEFAULT '#6366f1',
    is_archived     BOOLEAN NOT NULL DEFAULT false,
    owner_id        UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_projects_tenant_slug
    ON projects (tenant_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_tenant ON projects (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_owner ON projects (tenant_id, owner_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Project Members ────────────────────────────────────────
CREATE TABLE project_members (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin', 'member', 'viewer')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_project_members_unique
    ON project_members (tenant_id, project_id, user_id);
CREATE INDEX idx_project_members_project
    ON project_members (project_id, tenant_id);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_tenant_isolation ON projects
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY projects_tenant_insert ON projects
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_members_tenant_isolation ON project_members
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY project_members_tenant_insert ON project_members
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

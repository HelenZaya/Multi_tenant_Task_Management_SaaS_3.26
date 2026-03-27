-- ================================================================
-- AUTO-GENERATED: Combined schema for Docker init
-- ================================================================

-- >>> 001_core_tables.sql
-- ============================================================
-- Migration 001: Core tables — tenants, users, refresh_tokens
-- ============================================================

-- ─── Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Tenants ────────────────────────────────────────────────
CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(63) NOT NULL UNIQUE,
    plan        VARCHAR(20) NOT NULL DEFAULT 'free'
                CHECK (plan IN ('free', 'pro', 'enterprise')),
    settings    JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_tenants_slug ON tenants (slug) WHERE deleted_at IS NULL;

-- ─── Users ──────────────────────────────────────────────────
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    avatar_url      VARCHAR(1024),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_users_email ON users (email) WHERE deleted_at IS NULL;

-- ─── Refresh Tokens ─────────────────────────────────────────
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,
    family_id       UUID NOT NULL,
    is_revoked      BOOLEAN NOT NULL DEFAULT false,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    replaced_by     UUID REFERENCES refresh_tokens(id)
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id, tenant_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens (family_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash) WHERE is_revoked = false;

-- ─── Updated_at trigger function ────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- >>> 002_memberships.sql
-- ============================================================
-- Migration 002: Memberships (tenant-scoped, RLS enforced)
-- ============================================================

CREATE TABLE memberships (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    invited_by  UUID REFERENCES users(id),
    invite_code VARCHAR(64),
    accepted_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_memberships_tenant_user
    ON memberships (tenant_id, user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_memberships_user ON memberships (user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_memberships_invite ON memberships (invite_code) WHERE accepted_at IS NULL AND deleted_at IS NULL;

CREATE TRIGGER trg_memberships_updated_at
    BEFORE UPDATE ON memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY memberships_tenant_isolation ON memberships
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY memberships_tenant_insert ON memberships
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);


-- >>> 003_projects.sql
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


-- >>> 004_boards_columns_tasks.sql
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


-- >>> 005_comments_activity_attachments.sql
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


-- >>> 006_notifications.sql
-- ============================================================
-- Migration 006: Notifications
-- ============================================================

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(500) NOT NULL,
    body            TEXT,
    data            JSONB DEFAULT '{}',
    is_read         BOOLEAN NOT NULL DEFAULT false,
    read_at         TIMESTAMPTZ,
    email_sent      BOOLEAN NOT NULL DEFAULT false,
    email_sent_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user
    ON notifications (tenant_id, user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_unread
    ON notifications (tenant_id, user_id, created_at DESC) WHERE is_read = false;

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_tenant_isolation ON notifications
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY notifications_tenant_insert ON notifications
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);


-- >>> 007_subscriptions.sql
-- ============================================================
-- Migration 007: Subscriptions / Billing
-- ============================================================

CREATE TABLE subscriptions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan                VARCHAR(20) NOT NULL DEFAULT 'free'
                        CHECK (plan IN ('free', 'pro', 'enterprise')),
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end  TIMESTAMPTZ,
    cancel_at           TIMESTAMPTZ,
    canceled_at         TIMESTAMPTZ,
    trial_start         TIMESTAMPTZ,
    trial_end           TIMESTAMPTZ,
    external_id         VARCHAR(255),
    external_provider   VARCHAR(50),
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_subscriptions_tenant
    ON subscriptions (tenant_id) WHERE status IN ('active', 'trialing');
CREATE INDEX idx_subscriptions_status ON subscriptions (status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions (current_period_end) WHERE status = 'active';

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Feature Flags ──────────────────────────────────────────
CREATE TABLE feature_flags (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    feature     VARCHAR(100) NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT false,
    config      JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_feature_flags_tenant_feature
    ON feature_flags (tenant_id, feature);

CREATE TRIGGER trg_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Usage Tracking ─────────────────────────────────────────
CREATE TABLE usage_records (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric      VARCHAR(100) NOT NULL,
    value       BIGINT NOT NULL DEFAULT 0,
    period      DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_usage_records_tenant_metric_period
    ON usage_records (tenant_id, metric, period);

CREATE TRIGGER trg_usage_records_updated_at
    BEFORE UPDATE ON usage_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_tenant_isolation ON subscriptions
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY subscriptions_tenant_insert ON subscriptions
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY feature_flags_tenant_isolation ON feature_flags
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY feature_flags_tenant_insert ON feature_flags
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_records_tenant_isolation ON usage_records
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY usage_records_tenant_insert ON usage_records
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);


-- >>> 008_analytics.sql
-- ============================================================
-- Migration 008: Analytics Read Model (CQRS-inspired)
-- ============================================================

-- ─── Daily Task Metrics (aggregated per tenant/project/day) ─
CREATE TABLE analytics_daily_tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    tasks_created   INTEGER NOT NULL DEFAULT 0,
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    tasks_overdue   INTEGER NOT NULL DEFAULT 0,
    tasks_in_progress INTEGER NOT NULL DEFAULT 0,
    avg_completion_hours DECIMAL(10,2) DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_analytics_daily_tasks_unique
    ON analytics_daily_tasks (tenant_id, project_id, date);
CREATE INDEX idx_analytics_daily_tasks_tenant_date
    ON analytics_daily_tasks (tenant_id, date DESC);

CREATE TRIGGER trg_analytics_daily_tasks_updated_at
    BEFORE UPDATE ON analytics_daily_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── User Productivity (aggregated per tenant/user/period) ──
CREATE TABLE analytics_user_productivity (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    tasks_assigned  INTEGER NOT NULL DEFAULT 0,
    tasks_completed INTEGER NOT NULL DEFAULT 0,
    comments_made   INTEGER NOT NULL DEFAULT 0,
    hours_logged    DECIMAL(10,2) DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_analytics_user_prod_unique
    ON analytics_user_productivity (tenant_id, user_id, date);
CREATE INDEX idx_analytics_user_prod_tenant_date
    ON analytics_user_productivity (tenant_id, date DESC);

CREATE TRIGGER trg_analytics_user_prod_updated_at
    BEFORE UPDATE ON analytics_user_productivity
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Project Summary (snapshot per tenant/project) ──────────
CREATE TABLE analytics_project_summary (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    total_tasks     INTEGER NOT NULL DEFAULT 0,
    completed_tasks INTEGER NOT NULL DEFAULT 0,
    overdue_tasks   INTEGER NOT NULL DEFAULT 0,
    total_members   INTEGER NOT NULL DEFAULT 0,
    progress_pct    DECIMAL(5,2) NOT NULL DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_analytics_project_summary_unique
    ON analytics_project_summary (tenant_id, project_id);

CREATE TRIGGER trg_analytics_project_summary_updated_at
    BEFORE UPDATE ON analytics_project_summary
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE analytics_daily_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_daily_tasks_tenant ON analytics_daily_tasks
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY analytics_daily_tasks_insert ON analytics_daily_tasks
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE analytics_user_productivity ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_user_prod_tenant ON analytics_user_productivity
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY analytics_user_prod_insert ON analytics_user_productivity
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE analytics_project_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY analytics_project_summary_tenant ON analytics_project_summary
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY analytics_project_summary_insert ON analytics_project_summary
    FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);



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

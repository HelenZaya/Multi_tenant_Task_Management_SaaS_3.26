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

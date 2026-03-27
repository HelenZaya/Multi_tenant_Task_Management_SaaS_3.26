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

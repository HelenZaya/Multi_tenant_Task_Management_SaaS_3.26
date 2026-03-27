/**
 * Seed development data.
 * Usage: tsx packages/db/src/seed.ts
 *
 * Creates:
 *  - 2 tenants (Acme Corp, Globex Inc)
 *  - 3 users per tenant
 *  - memberships, projects, boards, columns
 *  - sample tasks with LexoRank positions
 *  - subscriptions
 */
import { createPool, getPool, closePool } from "./index.js";
import { loadEnv, createLogger } from "@taskflow/utils";
import crypto from "node:crypto";

const env = loadEnv();
const logger = createLogger("seed", env.LOG_LEVEL);

// Simple bcrypt-like hash for seeding (real app uses bcrypt)
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function main() {
  createPool({ connectionString: env.DATABASE_URL, min: 1, max: 3 });
  const pool = getPool();

  logger.info("Seeding database...");

  // ─── Tenants ────────────────────────────────────────────
  const { rows: tenants } = await pool.query(`
    INSERT INTO tenants (id, name, slug, plan) VALUES
      ('a0000000-0000-0000-0000-000000000001', 'Acme Corp', 'acme-corp', 'pro'),
      ('a0000000-0000-0000-0000-000000000002', 'Globex Inc', 'globex-inc', 'free')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, slug
  `);
  logger.info({ tenants: tenants.map((t) => t.slug) }, "Tenants seeded");

  const acmeId = "a0000000-0000-0000-0000-000000000001";
  const globexId = "a0000000-0000-0000-0000-000000000002";

  // ─── Users ──────────────────────────────────────────────
  const passwordHash = hashPassword("Password123");

  await pool.query(`
    INSERT INTO users (id, email, password_hash, full_name) VALUES
      ('b0000000-0000-0000-0000-000000000001', 'alice@acme.com', $1, 'Alice Johnson'),
      ('b0000000-0000-0000-0000-000000000002', 'bob@acme.com', $1, 'Bob Smith'),
      ('b0000000-0000-0000-0000-000000000003', 'carol@acme.com', $1, 'Carol Williams'),
      ('b0000000-0000-0000-0000-000000000004', 'dave@globex.com', $1, 'Dave Brown'),
      ('b0000000-0000-0000-0000-000000000005', 'eve@globex.com', $1, 'Eve Davis'),
      ('b0000000-0000-0000-0000-000000000006', 'frank@globex.com', $1, 'Frank Miller')
    ON CONFLICT DO NOTHING
  `, [passwordHash]);
  logger.info("Users seeded");

  // ─── Memberships ────────────────────────────────────────
  await pool.query(`
    INSERT INTO memberships (tenant_id, user_id, role, accepted_at) VALUES
      ($1, 'b0000000-0000-0000-0000-000000000001', 'owner', NOW()),
      ($1, 'b0000000-0000-0000-0000-000000000002', 'admin', NOW()),
      ($1, 'b0000000-0000-0000-0000-000000000003', 'member', NOW()),
      ($2, 'b0000000-0000-0000-0000-000000000004', 'owner', NOW()),
      ($2, 'b0000000-0000-0000-0000-000000000005', 'admin', NOW()),
      ($2, 'b0000000-0000-0000-0000-000000000006', 'member', NOW())
    ON CONFLICT DO NOTHING
  `, [acmeId, globexId]);
  logger.info("Memberships seeded");

  // ─── Projects (Acme) ───────────────────────────────────
  await pool.query(`
    INSERT INTO projects (id, tenant_id, name, slug, owner_id, description) VALUES
      ('c0000000-0000-0000-0000-000000000001', $1, 'Website Redesign', 'website-redesign',
       'b0000000-0000-0000-0000-000000000001', 'Complete website overhaul'),
      ('c0000000-0000-0000-0000-000000000002', $1, 'Mobile App', 'mobile-app',
       'b0000000-0000-0000-0000-000000000002', 'iOS and Android app development')
    ON CONFLICT DO NOTHING
  `, [acmeId]);

  // ─── Projects (Globex) ─────────────────────────────────
  await pool.query(`
    INSERT INTO projects (id, tenant_id, name, slug, owner_id, description) VALUES
      ('c0000000-0000-0000-0000-000000000003', $1, 'Q1 Marketing', 'q1-marketing',
       'b0000000-0000-0000-0000-000000000004', 'Q1 marketing campaign')
    ON CONFLICT DO NOTHING
  `, [globexId]);
  logger.info("Projects seeded");

  // ─── Boards & Columns (Acme - Website Redesign) ────────
  const projectId = "c0000000-0000-0000-0000-000000000001";

  await pool.query(`
    INSERT INTO boards (id, tenant_id, project_id, name, position) VALUES
      ('d0000000-0000-0000-0000-000000000001', $1, $2, 'Sprint Board', 'aaa')
    ON CONFLICT DO NOTHING
  `, [acmeId, projectId]);

  const boardId = "d0000000-0000-0000-0000-000000000001";

  await pool.query(`
    INSERT INTO columns (id, tenant_id, board_id, name, position, color) VALUES
      ('e0000000-0000-0000-0000-000000000001', $1, $2, 'To Do', 'aaa', '#ef4444'),
      ('e0000000-0000-0000-0000-000000000002', $1, $2, 'In Progress', 'bbb', '#f59e0b'),
      ('e0000000-0000-0000-0000-000000000003', $1, $2, 'In Review', 'ccc', '#3b82f6'),
      ('e0000000-0000-0000-0000-000000000004', $1, $2, 'Done', 'ddd', '#10b981')
    ON CONFLICT DO NOTHING
  `, [acmeId, boardId]);
  logger.info("Boards and columns seeded");

  // ─── Tasks with LexoRank positions ─────────────────────
  await pool.query(`
    INSERT INTO tasks (id, tenant_id, project_id, column_id, title, description, status, priority, position, assignee_id, reporter_id) VALUES
      ('f0000000-0000-0000-0000-000000000001', $1, $2, 'e0000000-0000-0000-0000-000000000001',
       'Design homepage mockup', 'Create Figma designs for the new homepage', 'todo', 'high', 'aaa',
       'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001'),
      ('f0000000-0000-0000-0000-000000000002', $1, $2, 'e0000000-0000-0000-0000-000000000001',
       'Write API docs', 'Document all REST endpoints', 'todo', 'medium', 'bbb',
       'b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001'),
      ('f0000000-0000-0000-0000-000000000003', $1, $2, 'e0000000-0000-0000-0000-000000000002',
       'Implement auth flow', 'JWT login + refresh tokens', 'in_progress', 'urgent', 'aaa',
       'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
      ('f0000000-0000-0000-0000-000000000004', $1, $2, 'e0000000-0000-0000-0000-000000000003',
       'Review PR #42', 'Code review for the settings page', 'in_review', 'low', 'aaa',
       'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003'),
      ('f0000000-0000-0000-0000-000000000005', $1, $2, 'e0000000-0000-0000-0000-000000000004',
       'Setup CI/CD pipeline', 'GitHub Actions + Docker builds', 'done', 'high', 'aaa',
       'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001')
    ON CONFLICT DO NOTHING
  `, [acmeId, projectId]);
  logger.info("Tasks seeded");

  // ─── Subscriptions ─────────────────────────────────────
  await pool.query(`
    INSERT INTO subscriptions (tenant_id, plan, status, current_period_start, current_period_end) VALUES
      ($1, 'pro', 'active', NOW(), NOW() + INTERVAL '30 days'),
      ($2, 'free', 'active', NOW(), NULL)
    ON CONFLICT DO NOTHING
  `, [acmeId, globexId]);
  logger.info("Subscriptions seeded");

  // ─── Project Members ───────────────────────────────────
  await pool.query(`
    INSERT INTO project_members (tenant_id, project_id, user_id, role) VALUES
      ($1, $2, 'b0000000-0000-0000-0000-000000000001', 'admin'),
      ($1, $2, 'b0000000-0000-0000-0000-000000000002', 'member'),
      ($1, $2, 'b0000000-0000-0000-0000-000000000003', 'member')
    ON CONFLICT DO NOTHING
  `, [acmeId, projectId]);
  logger.info("Project members seeded");

  await closePool();
  logger.info("Seed complete!");
}

main().catch((err) => {
  logger.fatal({ err }, "Seed failed");
  process.exit(1);
});

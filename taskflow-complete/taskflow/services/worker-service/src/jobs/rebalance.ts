import { queryWithTenant } from "@taskflow/db";
import { createLogger } from "@taskflow/utils";

const logger = createLogger("worker:rebalance");

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = BASE62.length;

/**
 * Rebalance LexoRank positions for tasks in a column.
 * Generates evenly-spaced 3-char ranks for all tasks.
 */
export async function rebalanceLexoRank(
  tenantId: string,
  projectId: string,
  columnId: string
): Promise<void> {
  // Get all tasks in the column, sorted by current position
  const { rows: tasks } = await queryWithTenant(
    tenantId,
    `SELECT id, position FROM tasks
     WHERE project_id = $1 AND column_id = $2 AND deleted_at IS NULL
     ORDER BY position ASC`,
    [projectId, columnId]
  );

  if (tasks.length === 0) return;

  const count = tasks.length;
  const step = Math.max(1, Math.floor(BASE / (count + 1)));

  logger.info(
    { tenantId, projectId, columnId, taskCount: count, step },
    "Rebalancing LexoRank positions"
  );

  for (let i = 0; i < count; i++) {
    const charIdx = Math.min(step * (i + 1), BASE - 1);
    const primary = BASE62[charIdx]!;
    const mid = BASE62[Math.floor(BASE / 2)]!;
    const newPosition = primary + mid + mid;

    await queryWithTenant(
      tenantId,
      "UPDATE tasks SET position = $1 WHERE id = $2",
      [newPosition, tasks[i]!.id]
    );
  }

  logger.info(
    { tenantId, columnId, rebalanced: count },
    "LexoRank rebalance complete"
  );
}

/**
 * Rebalance columns within a board.
 */
export async function rebalanceColumns(
  tenantId: string,
  boardId: string
): Promise<void> {
  const { rows: columns } = await queryWithTenant(
    tenantId,
    `SELECT id, position FROM columns
     WHERE board_id = $1 AND deleted_at IS NULL
     ORDER BY position ASC`,
    [boardId]
  );

  if (columns.length === 0) return;

  const count = columns.length;
  const step = Math.max(1, Math.floor(BASE / (count + 1)));

  for (let i = 0; i < count; i++) {
    const charIdx = Math.min(step * (i + 1), BASE - 1);
    const primary = BASE62[charIdx]!;
    const mid = BASE62[Math.floor(BASE / 2)]!;
    const newPosition = primary + mid + mid;

    await queryWithTenant(
      tenantId,
      "UPDATE columns SET position = $1 WHERE id = $2",
      [newPosition, columns[i]!.id]
    );
  }

  logger.info({ tenantId, boardId, rebalanced: count }, "Column rebalance complete");
}

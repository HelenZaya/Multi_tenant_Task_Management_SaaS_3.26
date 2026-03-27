/**
 * Lightweight query-builder helpers for raw SQL.
 * These do NOT replace raw SQL — they compose fragments safely.
 */

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface SortParams {
  column: string;
  direction: "ASC" | "DESC";
}

/**
 * Build LIMIT/OFFSET clause from pagination params.
 */
export function paginationClause(params: PaginationParams): {
  clause: string;
  offset: number;
} {
  const offset = (params.page - 1) * params.limit;
  return {
    clause: `LIMIT ${params.limit} OFFSET ${offset}`,
    offset,
  };
}

/**
 * Build ORDER BY clause with safe column whitelisting.
 */
export function orderByClause(
  sort: SortParams,
  allowedColumns: string[]
): string {
  if (!allowedColumns.includes(sort.column)) {
    throw new Error(`Invalid sort column: ${sort.column}`);
  }
  const dir = sort.direction === "DESC" ? "DESC" : "ASC";
  return `ORDER BY ${sort.column} ${dir}`;
}

/**
 * Soft-delete WHERE clause fragment.
 * Filters out rows where deleted_at IS NOT NULL unless includeDeleted is true.
 */
export function softDeleteClause(includeDeleted: boolean = false): string {
  return includeDeleted ? "" : "AND deleted_at IS NULL";
}

/**
 * Build a safe WHERE IN clause with parameterized values.
 * Returns { clause: "col IN ($1, $2, $3)", params: [...values] }
 */
export function whereIn(
  column: string,
  values: string[],
  startIndex: number = 1
): { clause: string; params: string[] } {
  if (values.length === 0) {
    return { clause: "FALSE", params: [] };
  }
  const placeholders = values
    .map((_, i) => `$${startIndex + i}`)
    .join(", ");
  return {
    clause: `${column} IN (${placeholders})`,
    params: values,
  };
}

/**
 * Build INSERT statement with RETURNING clause.
 */
export function buildInsert(
  table: string,
  columns: string[],
  returning: string = "*"
): { text: string; placeholders: string } {
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  const text = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING ${returning}`;
  return { text, placeholders };
}

/**
 * Build UPDATE SET clause from object keys.
 * Returns { setClause: "col1 = $1, col2 = $2", values: [...], nextIndex: 3 }
 */
export function buildUpdate(
  data: Record<string, unknown>,
  startIndex: number = 1
): { setClause: string; values: unknown[]; nextIndex: number } {
  const entries = Object.entries(data).filter(
    ([_, v]) => v !== undefined
  );
  const setClauses: string[] = [];
  const values: unknown[] = [];

  entries.forEach(([key, value], i) => {
    setClauses.push(`${key} = $${startIndex + i}`);
    values.push(value);
  });

  return {
    setClause: setClauses.join(", "),
    values,
    nextIndex: startIndex + entries.length,
  };
}

/**
 * LexoRank — Base62 fractional indexing for drag-and-drop ordering.
 *
 * Positions are VARCHAR strings that sort lexicographically.
 * No floats. No integer sequences. No full-table reorder on move.
 *
 * Base62 charset: 0-9A-Za-z
 */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = BASE62.length; // 62
const MIN_CHAR = BASE62[0]!;             // '0'
const MAX_CHAR = BASE62[BASE - 1]!;      // 'z'
const MID_CHAR = BASE62[Math.floor(BASE / 2)]!; // 'V'
const DEFAULT_LENGTH = 6;

/**
 * Get the midpoint character between two Base62 characters.
 */
function midChar(a: string, b: string): string {
  const ai = BASE62.indexOf(a);
  const bi = BASE62.indexOf(b);
  const mid = Math.floor((ai + bi) / 2);
  return BASE62[mid]!;
}

/**
 * Generate a rank string between `before` and `after`.
 *
 * Cases:
 *   - No before, no after: return middle rank
 *   - No before (insert at start): return rank before `after`
 *   - No after (insert at end): return rank after `before`
 *   - Both provided: return rank between them
 *
 * Returns null if ranks are adjacent (need rebalance).
 */
export function generateRank(opts: {
  before?: string | null;
  after?: string | null;
}): string {
  const { before, after } = opts;

  // Case 1: Empty board — return middle
  if (!before && !after) {
    return MID_CHAR.repeat(DEFAULT_LENGTH);
  }

  // Case 2: Insert at beginning
  if (!before && after) {
    return rankBefore(after);
  }

  // Case 3: Insert at end
  if (before && !after) {
    return rankAfter(before);
  }

  // Case 4: Insert between two ranks
  return rankBetween(before!, after!);
}

/**
 * Generate a rank that sorts before the given rank.
 */
function rankBefore(rank: string): string {
  // Find the rightmost character that isn't the minimum
  for (let i = rank.length - 1; i >= 0; i--) {
    const c = rank[i]!;
    if (c !== MIN_CHAR) {
      // Set this position to midpoint between MIN and current
      const mid = midChar(MIN_CHAR, c);
      if (mid !== MIN_CHAR && mid !== c) {
        return rank.slice(0, i) + mid;
      }
    }
  }
  // All characters are at minimum — prepend with mid
  return MIN_CHAR + MID_CHAR.repeat(DEFAULT_LENGTH);
}

/**
 * Generate a rank that sorts after the given rank.
 */
function rankAfter(rank: string): string {
  // Find the rightmost character that isn't the maximum
  for (let i = rank.length - 1; i >= 0; i--) {
    const c = rank[i]!;
    if (c !== MAX_CHAR) {
      // Set this position to midpoint between current and MAX
      const mid = midChar(c, MAX_CHAR);
      if (mid !== c && mid !== MAX_CHAR) {
        return rank.slice(0, i) + mid;
      }
    }
  }
  // All characters are at maximum — append with mid
  return rank + MID_CHAR.repeat(DEFAULT_LENGTH);
}

/**
 * Generate a rank between two existing ranks.
 */
function rankBetween(before: string, after: string): string {
  // Pad to same length
  const maxLen = Math.max(before.length, after.length);
  const a = before.padEnd(maxLen, MIN_CHAR);
  const b = after.padEnd(maxLen, MIN_CHAR);

  // Find first differing position
  let commonPrefix = "";
  for (let i = 0; i < maxLen; i++) {
    if (a[i] === b[i]) {
      commonPrefix += a[i];
    } else {
      // Found difference at position i
      const aChar = a[i]!;
      const bChar = b[i]!;
      const aIdx = BASE62.indexOf(aChar);
      const bIdx = BASE62.indexOf(bChar);
      const diff = bIdx - aIdx;

      if (diff > 1) {
        // There's room between them
        const mid = midChar(aChar, bChar);
        return commonPrefix + mid;
      }

      // diff === 1 — adjacent characters, need to go deeper
      // Use aChar and find midpoint in next position
      const nextA = i + 1 < a.length ? a[i + 1]! : MIN_CHAR;
      const midNext = midChar(nextA, MAX_CHAR);
      if (midNext !== nextA && midNext !== MAX_CHAR) {
        return commonPrefix + aChar + midNext;
      }

      // Still no room — extend by one level
      return commonPrefix + aChar + MID_CHAR;
    }
  }

  // Strings are identical — extend
  return before + MID_CHAR;
}

/**
 * Check if two ranks are "close" enough to warrant rebalancing.
 * Returns true if the rank string is getting too long (> 10 chars).
 */
export function needsRebalance(rank: string): boolean {
  return rank.length > 10;
}

/**
 * Generate evenly-spaced ranks for rebalancing N items.
 * Returns an array of N rank strings that are evenly distributed.
 */
export function generateBalancedRanks(count: number): string[] {
  if (count === 0) return [];
  if (count === 1) return [MID_CHAR.repeat(DEFAULT_LENGTH)];

  const ranks: string[] = [];
  const step = Math.floor(BASE / (count + 1));

  for (let i = 1; i <= count; i++) {
    const charIdx = Math.min(step * i, BASE - 1);
    const primary = BASE62[charIdx]!;
    // Use 3-char ranks for balance: primary + VV
    ranks.push(primary + MID_CHAR + MID_CHAR);
  }

  return ranks;
}

/**
 * Validate a rank string (only Base62 characters).
 */
export function isValidRank(rank: string): boolean {
  if (!rank || rank.length === 0 || rank.length > 255) return false;
  for (const c of rank) {
    if (!BASE62.includes(c)) return false;
  }
  return true;
}

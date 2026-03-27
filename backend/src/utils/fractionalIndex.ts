export function midValue(left?: string | number | null, right?: string | number | null) {
  const leftNum = left === undefined || left === null ? 0 : Number(left);
  const rightNum = right === undefined || right === null ? leftNum + 1000 : Number(right);
  if (!Number.isFinite(leftNum) || !Number.isFinite(rightNum) || leftNum === rightNum) {
    return "1000";
  }
  return ((leftNum + rightNum) / 2).toFixed(4);
}

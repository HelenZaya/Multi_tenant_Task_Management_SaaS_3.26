export function midValue(left, right) {
  const l = left !== undefined && left !== null ? Number(left) : null;
  const r = right !== undefined && right !== null ? Number(right) : null;
  if (l === null && r === null) return 1000;
  if (l === null) return r / 2;
  if (r === null) return l + 1000;
  return (l + r) / 2;
}

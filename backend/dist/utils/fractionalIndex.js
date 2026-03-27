export function midValue(left, right) {
    const leftNum = left === undefined || left === null ? 0 : Number(left);
    const rightNum = right === undefined || right === null ? leftNum + 1000 : Number(right);
    if (!Number.isFinite(leftNum) || !Number.isFinite(rightNum) || leftNum === rightNum) {
        return "1000";
    }
    return ((leftNum + rightNum) / 2).toFixed(4);
}

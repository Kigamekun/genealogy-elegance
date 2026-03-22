export interface HorizontalSpanBlock {
  id: string;
  minX: number;
  maxX: number;
}

export function resolveNonOverlappingSpanShifts(
  blocks: HorizontalSpanBlock[],
  clearance: number,
): Map<string, number> {
  const shifts = new Map<string, number>();
  const sortedBlocks = [...blocks].sort((left, right) => {
    if (left.minX !== right.minX) return left.minX - right.minX;
    if (left.maxX !== right.maxX) return left.maxX - right.maxX;
    return left.id.localeCompare(right.id);
  });

  let occupiedMaxX = Number.NEGATIVE_INFINITY;

  sortedBlocks.forEach((block) => {
    const requiredMinX = Number.isFinite(occupiedMaxX)
      ? occupiedMaxX + clearance
      : block.minX;
    const shift = Math.max(0, requiredMinX - block.minX);

    shifts.set(block.id, shift);
    occupiedMaxX = Math.max(occupiedMaxX, block.maxX + shift);
  });

  return shifts;
}

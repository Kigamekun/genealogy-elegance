import { describe, expect, it } from "vitest";
import { resolveNonOverlappingSpanShifts } from "@/lib/family-graph-layout";

describe("resolveNonOverlappingSpanShifts", () => {
  it("pushes later family spans to the right when their connector areas overlap", () => {
    const shifts = resolveNonOverlappingSpanShifts([
      { id: "rifai-family", minX: 120, maxX: 620 },
      { id: "obay-family", minX: 560, maxX: 980 },
      { id: "sjafrudin-family", minX: 930, maxX: 1320 },
    ], 72);

    expect(shifts.get("rifai-family")).toBe(0);
    expect(shifts.get("obay-family")).toBe(132);
    expect(shifts.get("sjafrudin-family")).toBe(254);
  });
});

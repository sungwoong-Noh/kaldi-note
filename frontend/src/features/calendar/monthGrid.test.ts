import { describe, expect, it } from "vitest";
import { buildMonthGrid } from "./monthGrid";

describe("buildMonthGrid", () => {
  it("월요일 시작이다 — 2026-09-01(화)의 앞은 2026-08-31(월)", () => {
    const grid = buildMonthGrid("2026-09");

    expect(grid[0]).toEqual({ date: "2026-08-31", inMonth: false });
    expect(grid[1]).toEqual({ date: "2026-09-01", inMonth: true });
  });

  it("5주에 걸친 달은 길이가 35다", () => {
    expect(buildMonthGrid("2026-09")).toHaveLength(35);
  });

  it("6주에 걸친 달은 길이가 42다", () => {
    expect(buildMonthGrid("2026-08")).toHaveLength(42);
  });

  it("그 달의 마지막 날이 포함된다", () => {
    const grid = buildMonthGrid("2026-09");

    expect(grid.some((c) => c.date === "2026-09-30" && c.inMonth)).toBe(true);
  });

  it("다음 달로 넘어간 칸은 inMonth가 false다", () => {
    const grid = buildMonthGrid("2026-09");

    expect(grid.at(-1)).toEqual({ date: "2026-10-04", inMonth: false });
  });
});

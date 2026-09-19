import { describe, expect, it } from "vitest";
import { addMonths, kstMonthOf, kstToday, toKstDate } from "./kstDate";

describe("toKstDate", () => {
  it("AC-HOMECAL-54 · UTC 전날 23시는 KST 다음 날이다", () => {
    expect(toKstDate("2026-09-18T23:00:00Z")).toBe("2026-09-19");
  });

  it("KST 자정 경계가 15:00:00Z에서 갈린다", () => {
    expect(toKstDate("2026-09-19T14:59:59Z")).toBe("2026-09-19");
    expect(toKstDate("2026-09-19T15:00:00Z")).toBe("2026-09-20");
  });
});

describe("kstToday · kstMonthOf", () => {
  it("KST 오늘 날짜를 YYYY-MM-DD로 돌려준다", () => {
    expect(kstToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("YYYY-MM-DD에서 YYYY-MM을 뽑는다", () => {
    expect(kstMonthOf("2026-09-19")).toBe("2026-09");
  });
});

describe("addMonths", () => {
  it("월을 더하거나 뺀다", () => {
    expect(addMonths("2026-09", -1)).toBe("2026-08");
    expect(addMonths("2026-09", 1)).toBe("2026-10");
  });

  it("연도 경계를 넘는다", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });
});

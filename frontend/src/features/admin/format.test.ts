import { describe, expect, it } from "vitest";
import unspecialty from "@/test/admin/run-unspecialty.json";
import {
  clock,
  duration,
  groupSkipped,
  groupUnmapped,
  observation,
} from "./format";
import { crawlRunSchema, type CrawlRun } from "./schema";

const run = (patch: Partial<CrawlRun>): CrawlRun => ({
  ...crawlRunSchema.parse(unspecialty),
  ...patch,
});

const item = (field: string, i: number) => ({
  name: `상품${i}`,
  field,
  raw: `원문${i}`,
});

describe("groupSkipped", () => {
  it("AC-ADMIN-09 · 사유별로 묶고 한글 설명을 붙인다", () => {
    const groups = groupSkipped([
      { name: "a", reason: "FETCH_FAILED" },
      { name: "b", reason: "USER_OWNED" },
      { name: "c", reason: "FETCH_FAILED" },
    ]);
    expect(groups.map((g) => [g.code, g.label, g.items.length])).toEqual([
      ["USER_OWNED", "사용자가 등록한 원두 — 덮어쓰지 않음", 1],
      ["FETCH_FAILED", "상품 페이지를 읽지 못함", 2],
    ]);
    expect(groupSkipped([{ name: "x", reason: "PARSE_FAILED" }])[0].label).toBe(
      "페이지 구조를 해석하지 못함",
    );
  });
});

describe("groupUnmapped", () => {
  it("AC-ADMIN-10 · field별로 묶어 많은 순으로 놓는다", () => {
    const groups = groupUnmapped([
      item("process", 1),
      ...Array.from({ length: 7 }, (_, i) => item("variety", i)),
      item("process", 2),
    ]);
    expect(groups.map((g) => [g.code, g.label, g.items.length])).toEqual([
      ["variety", "품종", 7],
      ["process", "가공법", 2],
    ]);
    expect(groupUnmapped([item("roastLevel", 1)])[0].label).toBe("로스팅");
  });
});

describe("observation", () => {
  it("AC-ADMIN-08 · 건너뜀·미매핑 건수를 문장으로", () => {
    const r = run({
      status: "SUCCEEDED",
      skipped: Array.from({ length: 3 }, (_, i) => ({
        name: `${i}`,
        reason: "USER_OWNED",
      })),
      unmapped: Array.from({ length: 5 }, (_, i) => item("process", i)),
    });
    expect(observation(r)).toBe(
      "이번 실행에서 상품 3건을 건너뛰고, 원문 5건을 매핑하지 못했습니다.",
    );
  });

  it("AC-ADMIN-11 · 40건 이상이면 가장 많은 field를 짚는다 (실제 응답 41건)", () => {
    expect(observation(run({}))).toBe(
      "이번 실행에서 상품 0건을 건너뛰고, 원문 41건을 매핑하지 못했습니다. 품종(variety)이 25건으로 가장 많습니다.",
    );
  });

  it("AC-ADMIN-21 · 둘 다 0건", () => {
    expect(observation(run({ skipped: [], unmapped: [] }))).toBe(
      "이번 실행에서 건너뛴 상품과 매핑하지 못한 원문이 없습니다.",
    );
  });
});

describe("duration · clock", () => {
  it("소요는 mm:ss, RUNNING은 지금까지 경과", () => {
    const r = run({
      startedAt: "2026-10-14T11:48:55.295Z",
      finishedAt: "2026-10-14T11:49:31.329Z",
    });
    expect(duration(r)).toBe("00:36");
    expect(
      duration(
        { ...r, status: "RUNNING", finishedAt: undefined },
        new Date("2026-10-14T11:51:00.000Z"),
      ),
    ).toBe("02:04");
  });

  it("AC-ADMIN-22 · INTERRUPTED는 finishedAt이 있어도 —", () => {
    expect(duration(run({ status: "INTERRUPTED" }))).toBe("—");
  });

  it("시각은 로컬 MM.DD HH:mm", () => {
    const d = new Date(2026, 9, 14, 21, 3);
    expect(clock(d.toISOString())).toBe("10.14 21:03");
  });
});

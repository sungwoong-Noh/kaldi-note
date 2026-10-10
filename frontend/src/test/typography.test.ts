import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 타입 — docs/specs/2026-09-17-design-system-v2.md
 *
 * <p>크기 허용목록(AC-DS2-12·13, AC-READ-07~10·21)은 ADR 0010으로 대체돼 지웠다 — 크기는 목업이
 * 정본이다. 여기 남은 것은 서체(수치는 Mono)와 테스트 훅뿐이다.
 */
const SELF = join("src", "test", "typography.test.ts");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const SOURCES = walk("src").filter(
  (path) => /\.tsx?$/.test(path) && path !== SELF,
);

/** 앱 코드만. 테스트 파일은 클래스 문자열을 단정 인자로 담고 있어 세면 어긋난다. */
const APP_SOURCES = SOURCES.filter((path) => !/\.test\.tsx?$/.test(path));

describe("타입 스케일", () => {
  it("AC-DS2-15 · 수치 요소에 Sans가 강제되지 않는다", () => {
    // text-metric 계열이 font-family를 이미 들고 있다. font-sans를 덧붙이면 그것을 덮어쓴다.
    const bad: string[] = [];
    for (const path of APP_SOURCES) {
      for (const match of readFileSync(path, "utf8").matchAll(
        /className="([^"]*\btext-metric(?:-hero)?\b[^"]*)"/g,
      )) {
        if (/\bfont-sans\b/.test(match[1])) bad.push(`${path}: ${match[1]}`);
      }
    }

    expect(bad).toEqual([]);
  });

  it("AC-DS2-25 · 기존 data-* 훅이 남아 있다", () => {
    /*
     * 테스트가 이 훅으로 화면을 잡는다. 리스킨 중 지우면 AC 여러 개가 **조용히** 깨진다 —
     * 셀렉터가 아무것도 못 찾으면 단정이 통과해버리는 경우가 있기 때문이다.
     */
    const all = APP_SOURCES.map((path) => readFileSync(path, "utf8")).join("");

    for (const hook of ["data-lead", "data-compare", "data-diff", "data-empty"]) {
      expect(all.includes(hook), hook).toBe(true);
    }
  });
});
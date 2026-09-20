import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const SOURCES = walk("src").filter(
  (path) => path.endsWith(".tsx") && !path.includes(".test."),
);

/** `<h1 className="...">`의 클래스 문자열만 뽑는다. */
function headingClasses(source: string): string[] {
  return [...source.matchAll(/<h1[^>]*className="([^"]*)"/g)].map(
    (match) => match[1],
  );
}

describe("AC-VISUAL-13 · 화면 제목 14곳이 같은 단계를 쓴다", () => {
  const found = SOURCES.flatMap((path) =>
    headingClasses(readFileSync(path, "utf8")).map((className) => ({
      path,
      className,
    })),
  );

  it("h1이 14곳이다", () => {
    // 2026-09-19: 홈이 달력으로 바뀌며 h1("최근 기록")이 없어졌다 — 15 → 14.
    expect(found).toHaveLength(14);
  });

  it("모든 h1이 text-page-title font-semibold다", () => {
    const offenders = found.filter(
      ({ className }) =>
        !className.includes("text-page-title") ||
        !className.includes("font-semibold"),
    );
    expect(offenders).toEqual([]);
  });
});

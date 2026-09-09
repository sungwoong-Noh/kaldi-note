import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// 이 파일 자신은 검사 대상이 아니다 — 금지 패턴을 리터럴로 담고 있어
// 넣어두면 무엇을 고치든 자기 자신이 offender로 잡힌다(designTokens.test.ts의 선례).
const SELF = join("src", "test", "spacing.test.ts");

/**
 * **파일명의 `.test.`로만 거른다.** 경로에 `test`가 있는지로 거르면
 * `src/app/login/test/page.tsx`가 빠지는데 그것은 실제 앱 코드다.
 */
const SOURCES = walk("src").filter(
  (path) =>
    /\.(ts|tsx)$/.test(path) && !/\.test\.[jt]sx?$/.test(path) && path !== SELF,
);

function offenders(pattern: RegExp): string[] {
  return SOURCES.filter((path) => pattern.test(readFileSync(path, "utf8")));
}

describe("간격·모서리 허용목록", () => {
  it("AC-SPACE-03 · 임의값 간격과 음수 마진이 없다", () => {
    const arbitrary = /\b(?:gap|gap-x|gap-y|[pm][xytblr]?)-\[/;
    const negative = /(?:^|[\s"'`])-m[xytblr]?-\d/;

    expect(offenders(arbitrary)).toEqual([]);
    expect(offenders(negative)).toEqual([]);
  });

  it("AC-SPACE-08 · shadow 클래스가 없다", () => {
    expect(offenders(/\bshadow(?:-[a-z0-9]+)?\b/)).toEqual([]);
  });
});

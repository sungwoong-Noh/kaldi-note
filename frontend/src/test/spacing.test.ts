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

/** 잠근 간격 단계. `1` = `0.25rem` = 4px. */
const SCALE = [1, 2, 3, 4, 6, 12] as const;

/** 소스에서 간격 유틸리티의 숫자만 뽑는다. */
function spacingValues(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const path of SOURCES) {
    const source = readFileSync(path, "utf8");
    const values = [
      ...source.matchAll(
        /\b(?:gap|gap-x|gap-y|space-x|space-y|[pm][xytblr]?)-(\d+(?:\.\d+)?)\b/g,
      ),
    ].map((match) => match[1]);
    if (values.length > 0) {
      found.set(path, values);
    }
  }
  return found;
}

describe("AC-SPACE-01 · 간격이 6단계 밖의 값을 쓰지 않는다", () => {
  it("스케일 밖의 값이 없다", () => {
    const allowed = new Set(SCALE.map(String));
    const bad = [...spacingValues()].flatMap(([path, values]) =>
      [...new Set(values.filter((value) => !allowed.has(value)))].map(
        (value) => `${path}: ${value}`,
      ),
    );

    expect(bad).toEqual([]);
  });
});

describe("AC-SPACE-02 · 6단계가 각각 쓰인다", () => {
  it("죽은 단계가 없다", () => {
    const used = new Set([...spacingValues().values()].flat());
    const dead = SCALE.filter((step) => !used.has(String(step)));

    expect(dead).toEqual([]);
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";
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

/**
 * `rounded-lg`(8px)가 남는 곳 — **면**이다.
 *
 * <p>경로 구분자를 리터럴 `/`로 쓰지 않는다. `walk`가 `join`으로 만든 경로는 플랫폼 구분자를
 * 쓰므로 윈도에서 비교가 어긋난다.
 */
const SURFACES = [
  ["src", "features", "recipe", "components", "RecipeCard.tsx"],
  ["src", "features", "brewlog", "components", "BrewLogCard.tsx"],
  ["src", "features", "brewlog", "components", "BeanBatchDialog.tsx"],
  ["src", "features", "brewlog", "components", "UserGrinderDialog.tsx"],
  ["src", "features", "recipe", "components", "DeleteRecipeDialog.tsx"],
  ["src", "features", "brewlog", "components", "DeleteBrewLogDialog.tsx"],
  ["src", "features", "recipe", "components", "RecipeStepEditor.tsx"],
].map((parts) => parts.join(sep));

function count(path: string, pattern: RegExp): number {
  return readFileSync(path, "utf8").match(pattern)?.length ?? 0;
}

describe("모서리", () => {
  it("AC-SPACE-04 · rounded(4px)가 없다", () => {
    // 뒤에 값이 붙지 않은 `rounded`만 잡는다. rounded-md·-lg·-full은 제외다.
    expect(offenders(/\brounded(?![-\w])/)).toEqual([]);
  });

  it("AC-SPACE-05 · 면 7곳이 rounded-lg를 쓴다", () => {
    const missing = SURFACES.filter((path) => count(path, /\brounded-lg\b/g) < 1);

    expect(missing).toEqual([]);
  });

  it("AC-SPACE-06 · rounded-lg가 면 밖에 없다", () => {
    const outside = SOURCES.filter(
      (path) =>
        !SURFACES.includes(path) && count(path, /\brounded-lg\b/g) > 0,
    );

    expect(outside).toEqual([]);
  });

  it("AC-SPACE-07 · rounded-full이 아바타와 스피너 2곳뿐이다", () => {
    const found = SOURCES.flatMap((path) =>
      Array(count(path, /\brounded-full\b/g)).fill(path),
    );

    expect(found).toHaveLength(2);
    expect(found.map((path) => path.split(sep).pop()).sort()).toEqual([
      "LoadingState.tsx",
      "UserProfile.tsx",
    ]);
  });
});

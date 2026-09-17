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

  it("AC-SPACE-08 · AC-DS2-17 · shadow가 포커스 링 외에 없다", () => {
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
 * `rounded-surface`(8px)가 남는 곳 — **면**이다.
 *
 * <p>경로 구분자를 리터럴 `/`로 쓰지 않는다. `walk`가 `join`으로 만든 경로는 플랫폼 구분자를
 * 쓰므로 윈도에서 비교가 어긋난다.
 */
const SURFACES = [
  // 갱신(2026-09-17): 카드 프리미티브가 생겼다. 새 화면은 이것을 쓰고,
  // 아래 목록은 아직 옮기지 않은 곳들이다(리스킨에서 줄어든다).
  ["src", "components", "ui", "Surface.tsx"],
  // 갱신(2026-09-17): 히어로도 면이다 — 대표 수치를 담는 어두운 판.
  ["src", "components", "ui", "Hero.tsx"],
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

/**
 * 모서리 — 갱신(2026-09-17)
 *
 * <p>역할 2종(면 8px · 컨트롤 6px)에서 **4종**으로 늘었다
 * (docs/specs/2026-09-17-design-system-v2.md). 값이 아니라 **이름**으로 쓴다 —
 * 타입 스케일과 같은 방식이고, 그래야 「어느 역할인가」가 클래스에 남는다.
 *
 * | 역할 | 클래스 | px | 어디 |
 * |---|---|---|---|
 * | 태그 | `rounded-tag` | 3 | 배지 |
 * | 컨트롤 | `rounded-control` | 7 | 버튼·링크·입력칸·select |
 * | 면 | `rounded-surface` | 12 | 카드·다이얼로그 |
 * | 원형 | `rounded-full` | — | 아바타·스피너 |
 */
const RADIUS = ["tag", "control", "surface", "full"] as const;

describe("모서리", () => {
  it("AC-SPACE-04 · AC-DS2-16 · 모서리가 4종 밖을 쓰지 않는다", () => {
    const allowed = new Set(RADIUS.map((name) => `rounded-${name}`));
    const bad: string[] = [];

    for (const path of SOURCES) {
      for (const match of readFileSync(path, "utf8").matchAll(
        /\brounded(?:-[a-z0-9[\]#.-]+)?/g,
      )) {
        if (!allowed.has(match[0])) bad.push(`${path}: ${match[0]}`);
      }
    }

    expect(bad).toEqual([]);
  });

  it("AC-SPACE-05 · 면 7곳이 rounded-surface를 쓴다", () => {
    const missing = SURFACES.filter(
      (path) => count(path, /\brounded-surface\b/g) < 1,
    );

    expect(missing).toEqual([]);
  });

  it("AC-SPACE-06 · rounded-surface가 면 밖에 없다", () => {
    const outside = SOURCES.filter(
      (path) =>
        !SURFACES.includes(path) && count(path, /\brounded-surface\b/g) > 0,
    );

    expect(outside).toEqual([]);
  });

  it("AC-DS2-16 · 4종이 각각 쓰인다", () => {
    const used = new Set<string>();
    for (const path of SOURCES) {
      for (const match of readFileSync(path, "utf8").matchAll(
        /\brounded-[a-z]+/g,
      )) {
        used.add(match[0]);
      }
    }

    expect(RADIUS.filter((name) => !used.has(`rounded-${name}`))).toEqual([]);
  });

  it("AC-SPACE-07 · rounded-full이 원형 자리 4곳뿐이다", () => {
    /*
     * 갱신(2026-09-17): 다크 모드 토글이 늘며 2곳 → 4곳이 됐다. 핸드오프 README도
     * radius 999(rounded-full)를 "아바타·**토글**·프로그레스"로 못박아뒀다 —
     * 스위치 트랙과 손잡이가 각각 하나씩, 두 번 쓰인다.
     */
    const found = SOURCES.flatMap((path) =>
      Array(count(path, /\brounded-full\b/g)).fill(path),
    );

    expect(found).toHaveLength(4);
    expect(found.map((path) => path.split(sep).pop()).sort()).toEqual([
      "LoadingState.tsx",
      "ThemeToggle.tsx",
      "ThemeToggle.tsx",
      "UserProfile.tsx",
    ]);
  });
});

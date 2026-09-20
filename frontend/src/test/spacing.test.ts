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
 * 갱신(2026-09-17): 면 목록을 없앴다.
 *
 * <p>예전에는 「`rounded-surface`를 쓰는 파일 7곳」을 리터럴로 들고 있었다. 리스킨이
 * 그 7곳을 `Card`·`cardClass`로 걷어내면서 목록이 통째로 빈다 —
 * **조건이 깨진 것이 아니라 값이 한 곳으로 모인 것**이다.
 *
 * <p>이제 「면이 프리미티브를 쓰는가」는 `reskin.test.ts`의 `AC-SKIN-02`가 본다.
 * 여기 남은 것은 모서리 4종의 경계뿐이다.
 */
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

  it("AC-SPACE-05 · AC-SKIN-02 · 면 스타일이 프리미티브에만 있다", () => {
    // 갱신(2026-09-17): 「면 7곳」 목록에서 「프리미티브 한 곳」으로 뒤집혔다.
    const owners = SOURCES.filter(
      (path) => count(path, /\brounded-surface\b/g) > 0,
    ).map((path) => path.split(sep).slice(-2).join(sep));

    expect(owners.sort()).toEqual([
      join("ui", "Hero.tsx"),
      join("ui", "Surface.tsx"),
    ]);
  });

  it("AC-SPACE-06 · rounded-surface가 프리미티브 밖에 없다", () => {
    const uiDir = join("src", "components", "ui");
    const outside = SOURCES.filter(
      (path) =>
        !path.startsWith(uiDir) && count(path, /\brounded-surface\b/g) > 0,
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

  it("AC-SPACE-07 · rounded-full이 원형 자리 6곳뿐이다", () => {
    /*
     * 갱신(2026-09-17): 다크 모드 토글이 늘며 2곳 → 4곳이 됐다. 핸드오프 README도
     * radius 999(rounded-full)를 "아바타·**토글**·프로그레스"로 못박아뒀다 —
     * 스위치 트랙과 손잡이가 각각 하나씩, 두 번 쓰인다.
     *
     * 갱신(2026-09-19): 아바타(사진 있을 때 img·없을 때 닉네임 첫 글자 대체 원)가
     * 늘어 4곳 → 6곳. 홈 달력 레일과 웹 상단 바가 둘 다 쓰므로 `components/ui/Avatar.tsx`
     * 하나로 모았다 — 따로 있었으면 8곳이 됐을 것이다.
     *
     * 갱신(2026-09-20): 웹 달력 날짜 숫자가 늘어 6곳 → 8곳. 선택된 날짜 숫자(24px `ink` 원)와
     * 오늘·미선택 날짜 숫자(24px `border` 링)가 `Calendar.tsx`에 하나씩 더해졌다
     * (docs/specs/2026-09-20-calendar-grid-responsive.md AC-HOMECAL-89·90).
     */
    const found = SOURCES.flatMap((path) =>
      Array(count(path, /\brounded-full\b/g)).fill(path),
    );

    expect(found).toHaveLength(8);
    expect(found.map((path) => path.split(sep).pop()).sort()).toEqual([
      "Avatar.tsx",
      "Avatar.tsx",
      "Calendar.tsx",
      "Calendar.tsx",
      "LoadingState.tsx",
      "ThemeToggle.tsx",
      "ThemeToggle.tsx",
      "UserProfile.tsx",
    ]);
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TOKEN_NAMES, readPalettes } from "./tokens";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// 이 파일 자신은 검사 대상이 아니다 — 금지 패턴을 리터럴로 담고 있어
// 넣어두면 무엇을 고치든 자기 자신이 offender로 잡힌다(polish.test.ts의 선례).
const SELF = join("src", "test", "designTokens.test.ts");

const SOURCES = walk("src").filter(
  (path) => /\.(ts|tsx)$/.test(path) && path !== SELF,
);

function offenders(pattern: RegExp): string[] {
  return SOURCES.filter((path) => pattern.test(readFileSync(path, "utf8")));
}

describe("디자인 토큰", () => {
  it("AC-VISUAL-06 · AC-READ-04 · 토큰 8개가 라이트·다크 값을 모두 갖는다", () => {
    const { light, dark } = readPalettes();
    const expected = [...TOKEN_NAMES].sort();

    expect(Object.keys(light).sort()).toEqual(expected);
    expect(Object.keys(dark).sort()).toEqual(expected);
  });
});

describe("허용목록", () => {
  it("AC-VISUAL-01 · 앰버 클래스가 없다", () => {
    expect(offenders(/\b(?:text|bg|border|ring)-amber-/)).toEqual([]);
  });

  it("AC-VISUAL-02 · 팔레트 색 클래스가 없다", () => {
    // 다이얼로그 배경막 bg-black/40만 예외다. border-black/10은 예외가 아니라 border-line으로 옮긴다.
    // `bg-black\b`로 쓰면 `/`가 단어 경계라 배경막까지 잡힌다 — 14개 경우로 확인했다.
    const palette =
      /\b(?:text|bg|border|ring)-(?:neutral-|red-|white\b)|\b(?:text|border|ring)-black\b|\bbg-black(?![/\w])/;
    expect(offenders(palette)).toEqual([]);
  });

  it("AC-VISUAL-03 · dark: 색 클래스가 없다", () => {
    expect(offenders(/\bdark:(?:text|bg|border|ring)-/)).toEqual([]);
  });

  it("AC-VISUAL-04 · 임의값 색이 없다", () => {
    // 카카오 로그인 버튼의 #FEE500·#191600은 카카오 디자인 가이드가 강제하는 브랜드 색이라
    // 우리 토큰으로 칠할 수 없다. 파일이 아니라 그 두 리터럴만 면제한다 — 파일째 빼면
    // 로그인 화면에 아무 색이나 새로 들어온다.
    expect(offenders(/\b(?:text|bg|border)-\[#(?!FEE500\]|191600\])/)).toEqual(
      [],
    );
  });

  it("AC-VISUAL-05 · 허용된 글자 크기 다섯 개만 쓴다", () => {
    // text-는 크기뿐 아니라 색(text-muted)과 정렬(text-center)에도 쓰인다.
    // RatingInput의 text-[22px]는 별 아이콘 크기라 글자 위계와 무관하다.
    // 임의값 색(text-[#...])은 크기가 아니므로 여기서 보지 않는다. AC-VISUAL-04가 맡는다.
    //
    // 갱신(2026-09-15): 다섯 단계가 20/18/16/14/12에서 36/24/18/16/14로 재배치됐다.
    // 개수는 그대로 다섯이고 값만 바뀌었다(docs/specs/2026-09-15-readability.md).
    const sizes =
      /\btext-(?!4xl\b|2xl\b|lg\b|base\b|sm\b|\[22px\]|\[#|muted\b|brand\b|danger\b|foreground\b|background\b|on-accent\b|center\b|left\b|right\b)[a-z0-9[\]-]+/;
    expect(offenders(sizes)).toEqual([]);
  });
});

/**
 * 읽힘 — docs/specs/2026-09-15-readability.md
 *
 * <p>`SOURCES`는 테스트 파일을 포함한다. `*.test.tsx`가 클래스 문자열을 `toHaveClass` 인자로
 * 담고 있어 세면 개수가 어긋난다. `src/app/login/test/page.tsx`는 경로에 `/test/`가 있지만
 * 앱 코드이므로 파일명 끝으로 거른다.
 */
const APP_SOURCES = SOURCES.filter((path) => !/\.test\.tsx?$/.test(path));

function countClass(name: string): number {
  const pattern = new RegExp(`\\b${name}\\b`, "g");
  return APP_SOURCES.reduce(
    (sum, path) =>
      sum + (readFileSync(path, "utf8").match(pattern)?.length ?? 0),
    0,
  );
}

describe("읽힘 — 글자 단계", () => {
  it("AC-READ-07 · text-xl과 text-xs가 0곳이다", () => {
    expect(countClass("text-xl")).toBe(0);
    expect(countClass("text-xs")).toBe(0);
  });

  it("AC-READ-08 · 단계별 개수가 4/15/18/127/21이다", () => {
    // 치환 순서 사고를 잡는다. text-sm을 먼저 올리면 127곳이 이중 변환되어
    // text-base가 0, text-lg가 145가 된다.
    const counts = {
      "text-4xl": countClass("text-4xl"),
      "text-2xl": countClass("text-2xl"),
      "text-lg": countClass("text-lg"),
      "text-base": countClass("text-base"),
      "text-sm": countClass("text-sm"),
    };

    expect(counts).toEqual({
      "text-4xl": 4,
      "text-2xl": 15,
      "text-lg": 18,
      "text-base": 127,
      "text-sm": 21,
    });
    expect(Object.values(counts).reduce((a, b) => a + b)).toBe(185);
  });

  it("AC-READ-09 · 5단계 밖의 크기 클래스가 없다", () => {
    const allowed = new Set([
      "text-4xl",
      "text-2xl",
      "text-lg",
      "text-base",
      "text-sm",
    ]);
    const found = new Set<string>();
    for (const path of APP_SOURCES) {
      for (const match of readFileSync(path, "utf8").matchAll(
        /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)\b/g,
      )) {
        found.add(match[0]);
      }
    }

    expect([...found].filter((name) => !allowed.has(name))).toEqual([]);
  });

  it("AC-READ-10 · 임의값 크기가 별 아이콘 1곳뿐이다", () => {
    const found: string[] = [];
    for (const path of APP_SOURCES) {
      for (const match of readFileSync(path, "utf8").matchAll(
        /\btext-\[\d+px\]/g,
      )) {
        found.push(match[0]);
      }
    }

    expect(found).toEqual(["text-[22px]"]);
  });

  it("AC-READ-21 · h2 13곳이 전부 text-lg다", () => {
    // 크기를 안 줘서 상속받는 제목을 없앤다. 상속은 부모가 바뀌면 조용히 따라 움직여서,
    // 본문만 키웠을 때 제목이 본문과 같아지는 사고가 난다.
    const bare: string[] = [];
    for (const path of APP_SOURCES) {
      for (const match of readFileSync(path, "utf8").matchAll(
        /<h2\s+[^>]*className="([^"]*)"/g,
      )) {
        if (!/\btext-lg\b/.test(match[1])) bare.push(`${path}: ${match[1]}`);
      }
    }
    expect(bare).toEqual([]);

    const total = APP_SOURCES.reduce(
      (sum, path) =>
        sum + (readFileSync(path, "utf8").match(/<h2\b/g)?.length ?? 0),
      0,
    );
    expect(total).toBe(13);
  });
});

/**
 * 구조와 폼 — docs/specs/2026-09-15-structure.md
 */
describe("구조 — 컨트롤", () => {
  it("AC-STRUCT-02 · select 13곳이 appearance-none이다", () => {
    const bare: string[] = [];
    for (const path of APP_SOURCES) {
      for (const match of readFileSync(path, "utf8").matchAll(
        /<select\b[\s\S]*?className="([^"]*)"/g,
      )) {
        if (!/\bappearance-none\b/.test(match[1])) bare.push(`${path}`);
      }
    }

    expect(bare).toEqual([]);
  });
});

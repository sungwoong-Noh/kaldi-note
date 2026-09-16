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
  it("AC-VISUAL-06 · AC-READ-04 · AC-DS2-01 · 토큰 15개가 라이트·다크 값을 모두 갖는다", () => {
    const { light, dark } = readPalettes();
    const expected = [...TOKEN_NAMES].sort();

    expect(Object.keys(light).sort()).toEqual(expected);
    expect(Object.keys(dark).sort()).toEqual(expected);
  });

  it("AC-DS2-02 · 모든 색 토큰이 oklch로 정의된다", () => {
    // hex가 남아 있으면 대비 계산이 옛 경로로 새어 나간다.
    const { light, dark } = readPalettes();
    const notOklch = Object.entries({ ...light, ...dark })
      .filter(([, value]) => !value.startsWith("oklch("))
      .map(([name, value]) => `${name}: ${value}`);

    expect(notOklch).toEqual([]);
  });
});

describe("허용목록", () => {
  it("AC-VISUAL-01 · 앰버 클래스가 없다", () => {
    expect(offenders(/\b(?:text|bg|border|ring)-amber-/)).toEqual([]);
  });

  it("AC-VISUAL-02 · 팔레트 색 클래스가 없다", () => {
    // 다이얼로그 배경막 bg-black/40만 예외다. border-black/10은 예외가 아니라 border-border으로 옮긴다.
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

});

/**
 * `SOURCES`는 테스트 파일을 포함한다. `*.test.tsx`가 클래스 문자열을 `toHaveClass` 인자로
 * 담고 있어 세면 개수가 어긋난다. `src/app/login/test/page.tsx`는 경로에 `/test/`가 있지만
 * 앱 코드이므로 파일명 끝으로 거른다.
 *
 * <p>갱신(2026-09-17): 글자 크기 관련 검사는 `typography.test.ts`로 옮겼다
 * (AC-VISUAL-05 · AC-READ-07~10 · AC-READ-21). 타입 스케일이 6단계로 재편되면서
 * 두 파일이 같은 것을 다르게 검사하고 있었다.
 */
const APP_SOURCES = SOURCES.filter((path) => !/\.test\.tsx?$/.test(path));

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

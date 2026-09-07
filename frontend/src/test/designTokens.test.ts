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
  it("AC-VISUAL-06 · 토큰 8개가 라이트·다크 값을 모두 갖는다", () => {
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
    const sizes =
      /\btext-(?!xs\b|sm\b|base\b|lg\b|xl\b|\[22px\]|\[#|muted\b|brand\b|danger\b|foreground\b|background\b|on-accent\b|center\b|left\b|right\b)[a-z0-9[\]-]+/;
    expect(offenders(sizes)).toEqual([]);
  });
});

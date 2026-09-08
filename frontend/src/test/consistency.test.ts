import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 화면 간 일관성의 소스 검사.
 *
 * <p><b>이 검사는 「금지된 것이 없다」만 본다.</b> 클래스 이름을 틀리거나 유틸리티가 생성되지
 * 않으면 여기는 초록인데 화면에서 간격이 사라진다. 그것은 `e2e/consistency.spec.ts`가 잡는다.
 */

/** 항목 구분자로 쓰이던 가운뎃점. `·`(U+00B7). */
const SEPARATOR = "·";

/** 대표 수치와 메타줄을 가진 네 곳. 이 스펙이 한 규칙으로 묶는 대상이다. */
const CARD_AND_DETAIL = [
  "src/features/recipe/components/RecipeCard.tsx",
  "src/features/brewlog/components/BrewLogCard.tsx",
  "src/features/recipe/components/RecipeDetail.tsx",
  "src/features/brewlog/components/BrewDetail.tsx",
] as const;

/**
 * 주석을 지운 소스.
 *
 * <p><b>이 저장소는 주석에서 `·`를 정상적으로 쓴다</b> — `dt·dd`,
 * `actual_dose_g`·`actual_water_g`처럼 한국어 산문의 연결 부호다. 원본 그대로 세면 구분자가
 * 아니라 설명 문장을 금지하게 된다. 검사하려는 것은 **화면에 그려지는 것**이다.
 *
 * <p>줄 주석은 `//`가 줄 앞머리에 있을 때만 지운다. 문자열 안의 `https://`를 자르지 않기 위해서다.
 */
function read(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("AC-CONSIST-01 · BrewLogCard에 구분자가 없다", () => {
  it("`·`가 0개다", () => {
    const source = read("src/features/brewlog/components/BrewLogCard.tsx");

    expect(source.split(SEPARATOR)).toHaveLength(1);
  });
});

describe("AC-CONSIST-02 · RecipeDetail에 구분자가 없다", () => {
  it("`·`가 0개다", () => {
    const source = read("src/features/recipe/components/RecipeDetail.tsx");

    expect(source.split(SEPARATOR)).toHaveLength(1);
  });
});

describe("AC-CONSIST-03 · 메타줄 4곳의 가로 간격이 gap-x-3이다", () => {
  it("네 파일 다 gap-x-3을 쓴다", () => {
    const offenders = CARD_AND_DETAIL.filter(
      (path) => !read(path).includes("gap-x-3"),
    );

    expect(offenders).toEqual([]);
  });

  it("네 파일 어디에도 다른 gap-x가 없다", () => {
    const offenders = CARD_AND_DETAIL.flatMap((path) =>
      [...read(path).matchAll(/gap-x-([0-9.]+)/g)]
        .filter((match) => match[1] !== "3")
        .map((match) => `${path}: ${match[0]}`),
    );

    expect(offenders).toEqual([]);
  });
});

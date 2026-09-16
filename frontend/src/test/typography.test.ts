import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 타입 스케일 — docs/specs/2026-09-17-design-system-v2.md
 *
 * <p>디자인 파일에는 34개 크기가 쓰였다. 그대로 허용하면 허용목록이 아무것도 막지 못한다.
 * 역할별로 묶어 **6단계**로 줄였고, 이 파일이 그 경계를 지킨다.
 */
const SELF = join("src", "test", "typography.test.ts");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const SOURCES = walk("src").filter(
  (path) => /\.tsx?$/.test(path) && path !== SELF,
);

/** 앱 코드만. 테스트 파일은 클래스 문자열을 단정 인자로 담고 있어 세면 어긋난다. */
const APP_SOURCES = SOURCES.filter((path) => !/\.test\.tsx?$/.test(path));

/** 이번에 도입한 6단계. 늘리려면 스펙을 먼저 고친다. */
const SCALE = [
  "page-title",
  "card-title",
  "body",
  "body-sm",
  "metric-hero",
  "metric",
] as const;

/**
 * `text-`로 시작하지만 크기가 아닌 것들 — 색·정렬·변환.
 *
 * <p>임의값 색(`text-[#191600]`)도 여기서 뺀다. 카카오 로그인 버튼의 브랜드 색이고,
 * **크기가 아니므로 이 AC의 대상이 아니다** — `AC-VISUAL-04`가 그 둘을 소유한다.
 */
const NOT_A_SIZE =
  /^text-(?:\[#|ink|ink-2|ink-3|on-ink|paper|surface|sunken|raised|border|divider|divider-strong|accent|accent-soft|accent-wash|danger|center|left|right|start|end|nowrap|balance|pretty|wrap|ellipsis|clip)/;

function classNames(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const path of APP_SOURCES) {
    const source = readFileSync(path, "utf8");
    const hits = [...source.matchAll(/\btext-[a-z0-9[\]#.-]+/g)]
      .map((m) => m[0])
      .filter((name) => !NOT_A_SIZE.test(name));
    if (hits.length > 0) found.set(path, hits);
  }
  return found;
}

describe("타입 스케일", () => {
  it("AC-VISUAL-05 · AC-READ-09 · AC-DS2-12 · 글자 크기가 정해진 단계 밖을 쓰지 않는다", () => {
    const allowed = new Set(SCALE.map((name) => `text-${name}`));
    // RatingInput의 text-[22px]는 별 아이콘 크기라 글자 위계와 무관하다(AC-READ-10이 소유한다).
    allowed.add("text-[22px]");

    const bad = [...classNames()].flatMap(([path, names]) =>
      names.filter((name) => !allowed.has(name)).map((n) => `${path}: ${n}`),
    );

    expect(bad).toEqual([]);
  });

  it("AC-READ-08 · AC-DS2-13 · 각 단계가 쓰인다", () => {
    // 쓰이지 않는 단계는 체계가 아니라 장식이다. 핸드오프의 display·title·caption·label을
    // 미리 넣지 않은 이유가 이것이다.
    const used = new Set([...classNames().values()].flat());
    const dead = SCALE.filter((name) => !used.has(`text-${name}`));

    expect(dead).toEqual([]);
  });

  it("AC-DS2-15 · 수치 요소에 Sans가 강제되지 않는다", () => {
    // text-metric 계열이 font-family를 이미 들고 있다. font-sans를 덧붙이면 그것을 덮어쓴다.
    const bad: string[] = [];
    for (const path of APP_SOURCES) {
      for (const match of readFileSync(path, "utf8").matchAll(
        /className="([^"]*\btext-metric(?:-hero)?\b[^"]*)"/g,
      )) {
        if (/\bfont-sans\b/.test(match[1])) bad.push(`${path}: ${match[1]}`);
      }
    }

    expect(bad).toEqual([]);
  });

  it("AC-READ-07 · 옛 Tailwind 크기 클래스가 0곳이다", () => {
    // 갱신(2026-09-17): 원래는 text-xl·text-xs만 봤다. 스케일이 이름 기반으로 바뀌면서
    // 검사 대상이 「Tailwind 기본 크기 전부」로 넓어졌다 — 되돌아갈 자리가 그쪽이기 때문이다.
    const legacy = /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\b/;
    const offenders = APP_SOURCES.filter((path) =>
      legacy.test(readFileSync(path, "utf8")),
    );

    expect(offenders).toEqual([]);
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

  it("AC-READ-21 · 모든 h2가 card-title이다", () => {
    // 이 조건의 목적은 「크기를 안 줘서 상속받는 제목」을 없애는 것이다. 개수는 못박지 않는다.
    const bare: string[] = [];
    let total = 0;
    for (const path of APP_SOURCES) {
      const source = readFileSync(path, "utf8");
      total += source.match(/<h2\b/g)?.length ?? 0;
      for (const match of source.matchAll(/<h2\s+[^>]*className="([^"]*)"/g)) {
        if (!/\btext-card-title\b/.test(match[1])) {
          bare.push(`${path}: ${match[1]}`);
        }
      }
    }

    expect(bare).toEqual([]);
    expect(total).toBeGreaterThan(0);
  });
});
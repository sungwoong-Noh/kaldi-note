import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 서체 — docs/specs/2026-09-17-design-system-v2.md
 *
 * <p>`@font-face`는 조각이 190개라 `globals.css`에 두지 않고 `fonts.css`로 분리했다.
 * 검사하는 것은 파일이 아니라 **앱이 실제로 선언하는 face 전부**이므로 둘을 합쳐 읽는다.
 *
 * <p>`fonts.css`와 `public/fonts/`는 `scripts/sync-fonts.mjs`가 만든다. 손으로 고치지 않는다.
 */
const GLOBALS = readFileSync(join("src", "app", "globals.css"), "utf8");
const FONTS = readFileSync(join("src", "app", "fonts.css"), "utf8");
const CSS = `${GLOBALS}\n${FONTS}`;

/** `@font-face { ... }` 본문만 뽑는다. */
const FACES = [...CSS.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);

const FONT_DIR = join("public", "fonts");

function facesOf(family: RegExp): string[] {
  return FACES.filter((face) => family.test(face));
}

function weightsOf(family: RegExp): string[] {
  return [
    ...new Set(
      facesOf(family)
        .map((face) => face.match(/font-weight:\s*(\d+)/)?.[1])
        .filter((w): w is string => w !== undefined),
    ),
  ].sort();
}

describe("서체", () => {
  it("AC-DS2-06 · Sans와 Mono가 self-host @font-face로 정의된다", () => {
    expect(facesOf(/IBM Plex Sans KR/).length).toBeGreaterThan(0);
    expect(facesOf(/IBM Plex Mono/).length).toBeGreaterThan(0);

    // Google Fonts를 쓰면 렌더 블로킹과 서드파티 의존이 늘고, web-seo가 다룰 LCP에 직접 영향을 준다.
    const remote = FACES.filter((face) =>
      /fonts\.(googleapis|gstatic)\.com/.test(face),
    );
    expect(remote).toEqual([]);
    expect(/@import\s+url\(["']?https?:/.test(CSS)).toBe(false);
  });

  it("AC-DS2-07 · 모든 @font-face에 font-display: swap이 있다", () => {
    // 한글 글리프는 무겁다. swap이 없으면 폰트가 도착할 때까지 글자가 보이지 않는다.
    const missing = FACES.filter((face) => !/font-display:\s*swap/.test(face));
    expect(missing).toEqual([]);
  });

  it("AC-DS2-08 · Mono에 한글 unicode-range가 없다", () => {
    // 수치만 쓰는 폰트에 한글을 실으면 받을 이유가 없는 바이트를 받는다.
    const withHangul = facesOf(/IBM Plex Mono/).filter((face) =>
      /U\+AC00/i.test(face),
    );
    expect(withHangul).toEqual([]);
  });

  it("AC-DS2-09 · --font-sans에서 system-ui가 첫 자리가 아니다", () => {
    const stack = GLOBALS.match(/--font-sans:\s*([^;]+);/)?.[1].trim();
    expect(stack).toBeDefined();
    expect(stack?.startsWith('"IBM Plex Sans KR"')).toBe(true);
    // 폰트가 도착하지 않아도 글자는 보여야 한다.
    expect(stack).toMatch(/sans-serif\s*$/);

    const mono = GLOBALS.match(/--font-mono:\s*([^;]+);/)?.[1].trim();
    expect(mono?.startsWith('"IBM Plex Mono"')).toBe(true);
    expect(mono).toMatch(/monospace\s*$/);
  });

  it("AC-DS2-10 · 단일 폰트 파일이 100KB를 넘지 않는다", () => {
    // korean 통짜 서브셋 하나가 505KB다. 실수로 그것을 링크하면 여기서 잡힌다.
    const files = readdirSync(FONT_DIR).filter((name) =>
      name.endsWith(".woff2"),
    );
    expect(files.length).toBeGreaterThan(0);

    const tooBig = files
      .map((name) => ({ name, size: statSync(join(FONT_DIR, name)).size }))
      .filter(({ size }) => size >= 102_400)
      .map(({ name, size }) => `${name}: ${Math.round(size / 1024)}KB`);

    expect(tooBig).toEqual([]);
  });

  it("AC-DS2-11 · 웨이트가 정해진 것 밖에 없다", () => {
    // 웨이트 하나가 늘면 한글 조각 전체(94개 · 약 1.3MB)가 한 벌 더 붙는다.
    expect(weightsOf(/IBM Plex Sans KR/)).toEqual(["400", "600"]);
    expect(weightsOf(/IBM Plex Mono/)).toEqual(["400", "500"]);
  });

  it("AC-DS2-11 · 선언된 파일이 전부 존재한다", () => {
    // 경로를 잘못 쓰면 조용히 fallback으로 렌더된다 — 테스트는 초록인데 화면만 다르다.
    const referenced = [...CSS.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) =>
      m[1].replace(/^["']|["']$/g, "").replace(/^\/fonts\//, ""),
    );
    expect(referenced.length).toBeGreaterThan(0);

    const present = new Set(readdirSync(FONT_DIR));
    expect(referenced.filter((name) => !present.has(name))).toEqual([]);
  });
});

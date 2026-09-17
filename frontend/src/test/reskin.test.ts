import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 리스킨 — docs/specs/2026-09-17-screen-reskin.md
 *
 * <p>`design-system-v2`가 색·서체·타입을 갈아끼웠지만 배치는 그대로 뒀다. 이 파일은
 * 화면이 목업과 같은 **구조 어휘**를 쓰는지 본다.
 */
const SELF = join("src", "test", "reskin.test.ts");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const SOURCES = walk("src").filter(
  (path) => /\.tsx?$/.test(path) && path !== SELF,
);
const APP = SOURCES.filter((path) => !/\.test\.tsx?$/.test(path));
const UI_DIR = join("src", "components", "ui");
const OUTSIDE_UI = APP.filter((path) => !path.startsWith(UI_DIR));

describe("리스킨 — 구조", () => {
  it("AC-SKIN-01 · 화면이 Shell 프리미티브를 쓴다", () => {
    // 같은 컨테이너 문자열이 11곳에 복붙돼 있었고 두 변종으로 갈라져 있었다.
    // 거터를 16→24px로 올릴 때 11곳을 동시에 고쳐야 했던 것이 그 비용이다.
    const bad: string[] = [];
    for (const path of OUTSIDE_UI) {
      if (/\bmax-w-2xl\b/.test(readFileSync(path, "utf8"))) bad.push(path);
    }

    expect(bad).toEqual([]);
  });

  it("AC-SKIN-02 · 면이 Card·Hero 프리미티브를 쓴다", () => {
    // rounded-surface를 직접 쓰면 카드가 제각각이 된다 — 남긴 채로 신규 화면을 만들면
    // 그 예외가 영구히 굳는다.
    const bad: string[] = [];
    for (const path of OUTSIDE_UI) {
      if (/\brounded-surface\b/.test(readFileSync(path, "utf8"))) bad.push(path);
    }

    expect(bad).toEqual([]);
  });

  it("AC-SKIN-08 · data-* 훅이 그대로다", () => {
    // 테스트가 이 훅으로 화면을 잡는다. 마크업을 바꿔도 남긴다.
    const all = APP.map((path) => readFileSync(path, "utf8")).join("");

    for (const hook of [
      "data-lead",
      "data-compare",
      "data-diff",
      "data-empty",
    ]) {
      expect(all.includes(hook), hook).toBe(true);
    }
  });
});

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** docs/specs/2026-09-27-brew-form-redesign.md — 다크 모드가 토큰 치환만으로 되려면 색을 직접 쓰면 안 된다. */
const DIR = join("src", "features", "brewlog", "components");
const LITERAL = /oklch\(|#[0-9a-fA-F]{3,6}\b|rgb\(/g;

describe("기록 폼 — 색", () => {
  it("AC-BREWFORM-26 · 색은 토큰만 쓴다", () => {
    const found = readdirSync(DIR)
      .filter((name) => name.endsWith(".tsx") && !name.includes(".test."))
      .flatMap((name) =>
        [...readFileSync(join(DIR, name), "utf8").matchAll(LITERAL)].map(
          (match) => `${name}: ${match[0]}`,
        ),
      );

    expect(found).toEqual([]);
  });
});

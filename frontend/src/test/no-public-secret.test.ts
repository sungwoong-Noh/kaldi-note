import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** 시크릿을 NEXT_PUBLIC_으로 두면 번들에 박혀 누구나 읽는다. 그 실수를 여기서 막는다. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("AC-TESTLOGIN-22 · 시크릿이 프론트에 박히지 않는다", () => {
  it("NEXT_PUBLIC_ 시크릿이 0건이다", () => {
    const targets = [...walk("src"), ".env.example", "wrangler.jsonc"].filter(
      (path) =>
        /\.(ts|tsx|mjs|json|jsonc)$/.test(path) || path === ".env.example",
    );

    const offenders = targets.filter((path) =>
      /NEXT_PUBLIC_[A-Z_]*(SECRET|TEST_LOGIN)/.test(readFileSync(path, "utf8")),
    );

    expect(offenders).toEqual([]);
  });
});

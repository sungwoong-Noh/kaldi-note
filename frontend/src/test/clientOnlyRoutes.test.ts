import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 레시피 서랍 화면 스펙 AC-RECIPESBREWS-100.
 *
 * <p>`/recipes`·`/brews`는 서버 컴포넌트로 fetch하지 않는다 — 첫 줄이 정확히
 * `"use client";`인지로 확인한다. 정적 셸만 SSR되므로 Cloudflare Workers의 요청당
 * CPU 10ms 예산은 이 화면들과 무관하다.
 */
const ROUTES = [
  join("src", "app", "recipes", "page.tsx"),
  join("src", "app", "brews", "page.tsx"),
];

describe("클라이언트 전용 라우트", () => {
  it("AC-RECIPESBREWS-100 · /recipes·/brews의 첫 줄이 \"use client\";다", () => {
    for (const path of ROUTES) {
      const firstLine = readFileSync(path, "utf8").split("\n")[0];
      expect(firstLine, path).toBe('"use client";');
    }
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// 테스트는 검사하지 않는다 — MSW 핸들러가 경로를 리터럴로 담는다.
const SOURCES = walk("src").filter(
  (path) => /\.(ts|tsx)$/.test(path) && !/\.test\.tsx?$/.test(path),
);

describe("원두 전체 목록", () => {
  it("AC-BEANDETAIL-61 · 프론트는 원두 전체 목록을 부르지 않는다", () => {
    const usesHook = SOURCES.filter((path) =>
      /\buseBeanProducts\b/.test(readFileSync(path, "utf8")),
    );
    // 쿼리 문자열 없는 경로 리터럴은 POST(등록)에서만 남는다.
    const bareGet = SOURCES.filter((path) => {
      const source = readFileSync(path, "utf8");
      return [...source.matchAll(/["'`]\/api\/v1\/bean-products["'`]/g)].some(
        (m) => !/method:\s*"POST"/.test(source.slice(m.index, m.index + 200)),
      );
    });

    expect(usesHook).toEqual([]);
    expect(bareGet).toEqual([]);
  });
});

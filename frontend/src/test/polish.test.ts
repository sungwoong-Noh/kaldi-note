import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// 이 파일 자신은 검사 대상이 아니다 — 금지 문자열을 리터럴로 담고 있어
// 넣어두면 무엇을 고치든 자기 자신이 offender로 잡힌다.
const SELF = join("src", "test", "polish.test.ts");

const SOURCES = walk("src").filter(
  (path) => /\.(ts|tsx|css)$/.test(path) && path !== SELF,
);

describe("마감 결함", () => {
  it("AC-POLISH-03 · --font-geist-sans 참조가 없다", () => {
    // 정의된 적 없는 변수를 참조하고 있었다. 폰트가 적용되지 않은 원인이다.
    const offenders = SOURCES.filter((path) =>
      readFileSync(path, "utf8").includes("--font-geist-sans"),
    );
    expect(offenders).toEqual([]);
  });
});

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = resolve(import.meta.dirname, "../../..");

/** WorkerBuildTest */
describe("WorkerBuildTest", () => {
  it("AC-WEBDEPLOY-01 · OpenNext 빌드가 Worker 번들을 산출한다", () => {
    // globalSetup이 빌드를 끝낸 뒤에만 이 테스트가 실행된다.
    // 빌드가 0이 아닌 코드로 끝나면 globalSetup이 던져 스위트 전체가 실패한다.
    expect(existsSync(resolve(frontendRoot, ".open-next/worker.js"))).toBe(
      true,
    );
    expect(existsSync(resolve(frontendRoot, ".open-next/assets"))).toBe(true);
  });
});

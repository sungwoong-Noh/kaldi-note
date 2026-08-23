import { defineConfig } from "vitest/config";

// 기존 vitest.config.mts와 분리한 이유: 이 스위트는 globalSetup에서 OpenNext 빌드를
// 돌리고 workerd를 띄운다. 한데 섞으면 59개 테스트의 4초가 분 단위가 된다.
export default defineConfig({
  test: {
    include: ["src/test/worker/**/*.test.ts"],
    globalSetup: ["src/test/worker/globalSetup.ts"],
    // 빌드와 workerd 기동은 globalSetup이 담당한다. 개별 테스트는 HTTP 요청만 하므로 짧아도 된다.
    testTimeout: 30_000,
    hookTimeout: 300_000,
    environment: "node",
    // workerd를 하나만 띄우므로 병렬 실행하지 않는다.
    fileParallelism: false,
  },
});

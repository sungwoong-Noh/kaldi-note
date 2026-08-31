import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// .mts인 이유: Vite의 native config loader가 ESM을 요구한다.
// .ts로 두면 "ESM syntax in a file loaded as CommonJS" 경고가 매 실행마다 뜬다.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // 시각을 다루는 테스트는 실행 환경의 TZ에 좌우된다 — 로컬(Asia/Seoul)과 CI(UTC)가 9시간 어긋난다.
    // 브루잉 로그 스펙의 AC가 시스템 시각 `09:00Z`에 대해 입력칸 값 `09:00`을 요구하므로 UTC로 고정한다.
    env: { TZ: "UTC" },
    // next dev가 생성하는 빌드 산출물은 테스트 대상이 아니다.
    // src/test/worker는 workerd를 띄우는 별도 스위트다 — vitest.worker.config.mts가 맡는다.
    // 여기 섞이면 OpenNext 빌드가 매번 돌아 이 스위트의 실행 시간이 분 단위가 된다.
    exclude: [
      "node_modules/**",
      ".next/**",
      ".open-next/**",
      "src/test/worker/**",
    ],
  },
});

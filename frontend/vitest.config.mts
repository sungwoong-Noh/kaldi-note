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
    // next dev가 생성하는 빌드 산출물은 테스트 대상이 아니다.
    exclude: ["node_modules/**", ".next/**"],
  },
});

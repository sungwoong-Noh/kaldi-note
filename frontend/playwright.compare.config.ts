import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/**
 * 목업 대조 이미지 — `pnpm compare` (#152, docs/decisions/0010).
 *
 * <p>테스트가 아니라 **이미지를 만드는 도구**다. 단정은 없고 `compare-out/`에 PNG만 남긴다.
 * e2e와 같은 프로덕션 빌드·스텁에 붙으려고 Playwright 러너를 빌려 쓴다.
 */
export default defineConfig({
  ...base,
  testDir: "./compare",
  testMatch: "capture.ts",
  reporter: [["list"]],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], colorScheme: "light" },
    },
  ],
});

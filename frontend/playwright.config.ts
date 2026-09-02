import { defineConfig, devices } from "@playwright/test";

/**
 * 레이아웃 불변식만 검사한다. 백엔드는 띄우지 않는다 — 모든 API 요청은 e2e/stubs.ts가 가로챈다.
 *
 * 뷰포트 360x800은 현실적 최소 폭이자 가장 흔한 조합이다. 가로 스크롤은 폭이 좁을수록 먼저 드러난다.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // 레이아웃 측정은 결정적이라 flaky할 이유가 없다. 재시도는 진짜 결함을 가린다.
  retries: 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 360, height: 800 },
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      // devices["Desktop Chrome"]가 자체 viewport(1280x720)를 갖고 있으므로 뒤에서 덮어쓴다.
      // 순서를 바꾸면 데스크톱 폭으로 재게 된다.
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 800 },
      },
    },
  ],
  webServer: {
    // 프로덕션 빌드에 붙는다. dev 서버는 번들이 달라 배포될 화면을 보장하지 못한다.
    //
    // CI에는 이 단계보다 앞에 `pnpm build` 단계가 이미 있다. 여기서 또 빌드하면 워크플로가
    // 같은 일을 두 번 하므로 CI에서는 기동만 한다. 로컬에는 그런 선행 단계가 없어 빌드를 붙인다.
    command: process.env.CI ? "pnpm start" : "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

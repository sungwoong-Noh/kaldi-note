# 레이아웃 E2E 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-02-web-e2e-layout.md`

**Goal:** 실제 Chromium에서 11개 화면의 레이아웃 불변식 셋을 검사하고, 그 검사가 CI에서 자동으로 돈다.

**Architecture:** Playwright를 `frontend/`의 devDependency로 넣고, 테스트는 앱 소스 밖 `frontend/e2e/`에 둔다. **백엔드는 띄우지 않는다** — `page.route()`로 `**/api/v1/**`를 전부 가로채 `src/test/fixtures.ts`의 픽스처로 답한다. 로그인도 `/api/auth/refresh`를 스텁해 처리한다. 판정 로직은 순수 함수로 뽑아 경계값 조건이 화면 없이 직접 부를 수 있게 한다.

**작업 위치:** `frontend/`, `.github/workflows/frontend.yml`, `scripts/check-spec-coverage.sh`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-WEBLAYOUT-10 | 1px 어긋남은 통과 | Task 2 | E2E 헬퍼 단위 테스트 |
| AC-WEBLAYOUT-11 | 2px 어긋남은 실패 | Task 2 | E2E 헬퍼 단위 테스트 |
| AC-WEBLAYOUT-04 | 스텁 안 된 요청이 나가면 실패 | Task 3 | E2E |
| AC-WEBLAYOUT-01 | 탭바가 뷰포트 하단에 붙는다 | Task 4 | E2E |
| AC-WEBLAYOUT-02 | 가로 스크롤이 생기지 않는다 | Task 4 | E2E |
| AC-WEBLAYOUT-03 | 탭바가 본문 끝을 가리지 않는다 | Task 4 | E2E |

**스펙의 AC 6개 중 6개가 매핑됐다.**

---

## Global Constraints

- **백엔드를 띄우지 않는다.** 이 계획 어디에서도 `bootRun`이나 `docker compose`가 필요해서는 안 된다. 필요해지면 설계가 어긋난 것이다.
- **픽스처를 새로 지어내지 않는다.** `src/test/fixtures.ts`의 것을 재사용한다 — 그것들은 실제 응답에서 뜬 값이다(`docs/conventions/frontend.md`「픽스처는 실제 응답에서 뜬다」). 부족하면 **실제 백엔드를 로컬에서 띄워 응답을 뜬 뒤** 그 파일에 더한다.
- **`any` 금지, `as` 단언 금지.**
- **AC ID를 소스 주석에 적지 않는다.** 커버리지 스크립트가 `frontend/e2e`도 훑게 되므로(Task 1) 주석에 ID만 있어도 통과해 버린다.
- **다른 스펙의 AC ID를 이 계획 본문에 문자 그대로 쓰지 않는다.** 스크립트가 스펙 문서에서 ID를 긁을 때 남의 AC를 이 기능 것으로 센다(2026-09-02에 두 번 겪었다).
- 커밋 전 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. E2E는 `pnpm e2e`로 따로 돌린다.
- **`pnpm test`(vitest)가 `e2e/`를 집지 않아야 한다.** `frontend/e2e/`는 `src/` 밖이라 기본 설정으로는 안 걸리지만 Task 1 Step 4에서 확인한다.

---

## File Structure

```
frontend/
├── package.json                     Modify — playwright devDependency, e2e 스크립트 2개
├── playwright.config.ts             Create — 360x800, next start, retries 0, 스크린샷
├── .gitignore                       Modify — playwright-report/, test-results/
└── e2e/
    ├── tolerance.ts                 Create — 판정 순수 함수
    ├── tolerance.spec.ts            Create — 경계값 AC 2개
    ├── stubs.ts                     Create — route 인터셉트 + 픽스처 매핑
    ├── screens.ts                   Create — 대상 화면 11개 목록
    └── layout.spec.ts               Create — 불변식 AC 4개

.github/workflows/frontend.yml       Modify — E2E 단계 + 실패 시 아티팩트
scripts/check-spec-coverage.sh       Modify — SEARCH_PATHS에 frontend/e2e 추가
```

---

## Task 1: Playwright 설치와 커버리지 경로

**Files:**
- Modify: `frontend/package.json`, `frontend/.gitignore`
- Create: `frontend/playwright.config.ts`
- Modify: `scripts/check-spec-coverage.sh`

**Covers:** 없음 — 인프라. **기존 테스트가 하나도 깨지지 않는 것이 이 태스크의 인수 조건이다.**

**Interfaces:**
- Produces: `pnpm e2e`, `pnpm e2e:ui` — `frontend/CLAUDE.md`에 이미 문서화된 이름을 그대로 쓴다
- Produces: `playwright.config.ts`의 `webServer` 설정 — 뒤 태스크가 이것에 의존한다

- [x] **Step 1: 리팩터 전 초록을 확인한다**

Run: `cd frontend && pnpm test`
Expected: PASS. **이 숫자를 적어둔다**(249개일 것). Step 4에서 같은 숫자가 나와야 한다.

- [x] **Step 2: 설치와 설정**

```bash
cd frontend && pnpm add -D @playwright/test && pnpm exec playwright install chromium
```

`package.json`의 `scripts`에 더한다:

```json
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
```

`playwright.config.ts`:

```ts
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
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 360, height: 800 },
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } } },
  ],
  webServer: {
    // 프로덕션 빌드에 붙는다. dev 서버는 번들이 달라 배포될 화면을 보장하지 못한다.
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

**`devices["Desktop Chrome"]`이 자체 viewport를 갖고 있으므로 뒤에서 덮어쓴다.** 순서를 바꾸면 1280×720이 된다.

`.gitignore`에 더한다:

```
playwright-report/
test-results/
```

- [x] **Step 3: 커버리지 스크립트가 e2e를 보게 한다**

`scripts/check-spec-coverage.sh`의 경로 목록에 한 줄 더한다:

```bash
for path in backend/src/test frontend/src frontend/e2e; do
```

주석의 설명도 함께 고친다(`frontend/src/` → `frontend/src/`와 `frontend/e2e/`).

- [x] **Step 4: 기존 것이 그대로인지 확인한다**

Run: `cd frontend && pnpm test`
Expected: PASS, Step 1과 **같은 개수**. vitest가 `e2e/`를 집으면 숫자가 늘거나 깨진다.

Run: `cd frontend && pnpm typecheck && pnpm lint && pnpm build`
Expected: 통과. `playwright.config.ts`가 `tsconfig`에 걸려 타입 오류를 낼 수 있다 — 그러면 `include`를 확인한다.

Run: `(cd .. && ./scripts/check-spec-coverage.sh)`
Expected: 통과, **AC 453개 그대로**. 이 스펙은 아직 `초안`이라 건너뛴다.

- [x] **Step 5: 커밋** — `chore(web): Playwright를 넣고 커버리지가 e2e도 훑게 한다`

---

## Task 2: 판정 함수와 경계값

**Files:**
- Create: `frontend/e2e/tolerance.ts`, `frontend/e2e/tolerance.spec.ts`

**Covers:** AC-WEBLAYOUT-10, 11

**Interfaces:**
- Produces: `withinTolerance(actual: number, expected: number, tolerance?: number): boolean`
- Produces: `notBelow(actual: number, limit: number, tolerance?: number): boolean` — 「`limit`을 `tolerance` 넘게 초과하지 않는다」

**왜 순수 함수로 뽑는가:** 실제 화면을 1px씩 어긋나게 만들 방법이 없어 경계값 조건을 화면으로 검사할 수 없다. 판정을 함수로 분리하면 그 함수를 직접 부를 수 있다.

- [x] **Step 1: 실패하는 테스트 작성**

```ts
import { expect, test } from "@playwright/test";
import { notBelow, withinTolerance } from "./tolerance";

test.describe("판정 함수", () => {
  test("AC-WEBLAYOUT-10 · 1px 어긋난 것은 통과한다", () => {
    expect(withinTolerance(799, 800)).toBe(true);
    expect(withinTolerance(801, 800)).toBe(true);
    expect(withinTolerance(800, 800)).toBe(true);
  });

  test("AC-WEBLAYOUT-11 · 2px 어긋난 것은 실패한다", () => {
    expect(withinTolerance(798, 800)).toBe(false);
    expect(withinTolerance(802, 800)).toBe(false);
  });

  test("초과 판정은 한쪽만 본다", () => {
    // 문서 폭 361은 허용, 362는 초과
    expect(notBelow(361, 360)).toBe(true);
    expect(notBelow(362, 360)).toBe(false);
    // 작은 쪽은 언제나 통과한다 — 가로 스크롤은 넘칠 때만 문제다
    expect(notBelow(100, 360)).toBe(true);
  });
});
```

- [x] **Step 2: 실패 확인**

Run: `cd frontend && pnpm e2e tolerance`
Expected: FAIL — `tolerance.ts`가 없다.

- [x] **Step 3: 최소 구현**

```ts
/** 좌표 비교의 기본 허용 오차. 브라우저가 서브픽셀로 계산해 766.5 같은 값이 나온다. */
const DEFAULT_TOLERANCE = 1;

/** `actual`이 `expected`와 `tolerance` 이내로 같은가. */
export function withinTolerance(
  actual: number,
  expected: number,
  tolerance: number = DEFAULT_TOLERANCE,
): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

/**
 * `actual`이 `limit`을 `tolerance` 넘게 초과하지 않는가.
 *
 * <p>가로 스크롤과 겹침 판정에 쓴다 — 모자란 쪽은 문제가 아니므로 한쪽만 본다.
 */
export function notBelow(
  actual: number,
  limit: number,
  tolerance: number = DEFAULT_TOLERANCE,
): boolean {
  return actual - limit <= tolerance;
}
```

- [x] **Step 4: 통과 확인**

Run: `cd frontend && pnpm e2e tolerance`
Expected: PASS, 3개

- [x] **Step 5: 커밋** — `test(web): 레이아웃 판정 함수와 경계값 (AC-WEBLAYOUT 2개)`

---

## Task 3: 스텁과 화면 목록

**Files:**
- Create: `frontend/e2e/stubs.ts`, `frontend/e2e/screens.ts`
- Modify: `frontend/src/test/fixtures.ts` (모자란 픽스처가 있을 때만)

**Covers:** AC-WEBLAYOUT-04

**Interfaces:**
- Produces: `installStubs(page: Page): Promise<{ unstubbed: string[] }>` — 가로채기를 걸고, 스텁 없이 나간 요청 URL을 모은다
- Produces: `SCREENS: readonly Screen[]` — `{ path: string; hasTabBar: boolean }`
- Consumes: `src/test/fixtures.ts`의 `hoffmann`·`kasuyaSummary`·`brewLogPage`·`brewLogWithTds`·`myComandante`·`yirgacheffeBatch`·`comandanteC40`·`holzklotzE80` 등

- [x] **Step 1: 어느 응답이 필요한지 실제로 확인한다**

**픽스처를 지어내지 않는다.** 로컬 백엔드를 띄워 각 엔드포인트의 실제 응답을 뜬 뒤, `src/test/fixtures.ts`에 이미 있는 것과 대조한다.

```bash
docker compose up -d
(cd backend && SPRING_PROFILES_ACTIVE=local ./gradlew bootRun) &
```

로그인 없이 토큰을 얻는 방법은 `docs/JOURNAL.md`의 2026-09-02 「어떻게 확인했나」에 적혀 있다.

확인할 엔드포인트: `/users/me`, `/recipes`, `/recipes/{id}`, `/brew-logs`, `/brew-logs/{id}`, `/gear/brewers`, `/gear/filters`, `/gear/grinders`, `/gear/user-grinders`, `/bean-batches`.

**모자란 것만** `fixtures.ts`에 더한다. 이미 있는 것은 그대로 쓴다.

- [x] **Step 2: 실패하는 테스트 작성**

`layout.spec.ts`에 이 태스크의 조건만 먼저 넣는다:

```ts
import { expect, test } from "@playwright/test";
import { SCREENS } from "./screens";
import { installStubs } from "./stubs";

for (const screen of SCREENS) {
  test(`AC-WEBLAYOUT-04 · ${screen.path} — 스텁되지 않은 요청이 없다`, async ({ page }) => {
    const stubs = await installStubs(page);

    await page.goto(screen.path);
    await page.waitForLoadState("networkidle");

    expect(stubs.unstubbed).toEqual([]);
  });
}
```

- [x] **Step 3: 실패 확인**

Run: `cd frontend && pnpm e2e layout`
Expected: FAIL — `screens.ts`·`stubs.ts`가 없다.

- [x] **Step 4: 최소 구현**

`screens.ts` — 스펙의 「대상 화면」 표를 그대로 옮긴다:

```ts
export interface Screen {
  readonly path: string;
  /** 탭바가 보이는 화면인가. 숨는 규칙은 BottomNav의 HIDDEN_PREFIXES가 정한다. */
  readonly hasTabBar: boolean;
}

export const SCREENS: readonly Screen[] = [
  { path: "/", hasTabBar: true },
  { path: "/recipes", hasTabBar: true },
  { path: "/recipes/12", hasTabBar: true },
  { path: "/brews", hasTabBar: true },
  { path: "/brews/2", hasTabBar: true },
  { path: "/more", hasTabBar: true },
  { path: "/gear/grind-converter", hasTabBar: true },
  { path: "/recipes/new", hasTabBar: false },
  { path: "/brews/new?recipeId=12", hasTabBar: false },
  { path: "/recipes/12/edit", hasTabBar: false },
  { path: "/brews/2/edit", hasTabBar: false },
];

export const TAB_BAR_SCREENS = SCREENS.filter((s) => s.hasTabBar);
```

`stubs.ts` — 백엔드 요청과 BFF 로그인 경로를 모두 가로챈다:

```ts
import type { Page, Route } from "@playwright/test";
// 픽스처는 실제 응답에서 뜬 것이다. 여기서 새로 지어내지 않는다.
import { /* Step 1에서 확인한 것들 */ } from "../src/test/fixtures";

/**
 * 모든 API 요청을 가로챈다. 백엔드는 띄우지 않는다.
 *
 * <p>accessToken은 메모리에만 사는데 새 탭은 그것이 없다. 앱은 첫 401에서 `/api/auth/refresh`로
 * 복구하므로, 그 경로만 스텁하면 로그인 상태가 된다 — refresh 토큰을 발급할 필요가 없다.
 */
export async function installStubs(page: Page): Promise<{ unstubbed: string[] }> {
  const unstubbed: string[] = [];

  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({
      json: { accessToken: "e2e.access.token", expiresInSeconds: 1800 },
    }),
  );

  const handlers: Array<[RegExp, unknown]> = [
    [/\/api\/v1\/users\/me$/, /* me 픽스처 */],
    [/\/api\/v1\/recipes\/12$/, /* hoffmann */],
    // …Step 1에서 확인한 순서대로. 구체적인 것을 먼저 둔다 —
    // /recipes 가 /recipes/12 보다 앞에 오면 상세가 목록 응답을 받는다.
  ];

  await page.route("**/api/v1/**", (route: Route) => {
    const url = route.request().url();
    const matched = handlers.find(([pattern]) => pattern.test(url));
    if (matched === undefined) {
      unstubbed.push(url);
      return route.fulfill({ status: 500, json: { code: "E2E_UNSTUBBED", message: url } });
    }
    return route.fulfill({ json: matched[1] });
  });

  return { unstubbed };
}
```

**정규식 순서가 중요하다.** `/recipes$`와 `/recipes/12$`를 구분하려면 앵커(`$`)를 정확히 쓰고, 쿼리스트링이 붙는 목록 경로는 `\/recipes(\?|$)` 형태로 맞춘다.

- [x] **Step 5: 통과 확인**

Run: `cd frontend && pnpm e2e layout`
Expected: PASS, 11개. 실패하면 어느 URL이 스텁되지 않았는지 `unstubbed`에 그대로 나온다.

- [x] **Step 6: 커밋** — `test(web): E2E 스텁과 화면 목록 (AC-WEBLAYOUT 1개)`

---

## Task 4: 레이아웃 불변식 셋

**Files:**
- Modify: `frontend/e2e/layout.spec.ts`

**Covers:** AC-WEBLAYOUT-01, 02, 03

**Interfaces:**
- Consumes: Task 2의 `withinTolerance`·`notBelow`, Task 3의 `SCREENS`·`TAB_BAR_SCREENS`·`installStubs`

- [x] **Step 1: 실패하는 테스트 작성**

```ts
const VIEWPORT = { width: 360, height: 800 } as const;

for (const screen of TAB_BAR_SCREENS) {
  test(`AC-WEBLAYOUT-01 · ${screen.path} — 탭바가 뷰포트 하단에 붙는다`, async ({ page }) => {
    await installStubs(page);
    await page.goto(screen.path);

    const nav = page.getByRole("navigation", { name: "주요 화면" });
    await nav.waitFor();
    const box = await nav.boundingBox();

    expect(box).not.toBeNull();
    expect(withinTolerance(box!.y + box!.height, VIEWPORT.height)).toBe(true);
  });
}

for (const screen of SCREENS) {
  test(`AC-WEBLAYOUT-02 · ${screen.path} — 가로 스크롤이 없다`, async ({ page }) => {
    await installStubs(page);
    await page.goto(screen.path);
    await page.waitForLoadState("networkidle");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);

    expect(notBelow(scrollWidth, VIEWPORT.width)).toBe(true);
  });
}

for (const screen of TAB_BAR_SCREENS) {
  test(`AC-WEBLAYOUT-03 · ${screen.path} — 탭바가 본문 끝을 가리지 않는다`, async ({ page }) => {
    await installStubs(page);
    await page.goto(screen.path);
    await page.getByRole("navigation", { name: "주요 화면" }).waitFor();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const main = await page.locator("main").first().boundingBox();
    const nav = await page.getByRole("navigation", { name: "주요 화면" }).boundingBox();

    expect(main).not.toBeNull();
    expect(nav).not.toBeNull();
    expect(notBelow(main!.y + main!.height, nav!.y)).toBe(true);
  });
}
```

**`box!`를 쓰지 않는다** — 프로젝트가 `as` 단언을 금지하고 `!`도 같은 부류다. `if (box === null) throw new Error(...)`로 좁히거나 `expect(box).not.toBeNull()` 뒤에 지역 변수로 받아 좁힌다. Step 3에서 정리한다.

- [x] **Step 2: 실패 확인**

Run: `cd frontend && pnpm e2e layout`
Expected: **AC-01과 AC-03은 통과할 가능성이 크다** — `mt-auto`가 이미 들어가 있다. AC-02는 어느 화면에서 터질지 모른다. **여기서 통과하는 것은 회귀 방지용이고, 실패하는 것이 있으면 그것이 이 태스크가 찾아낸 결함이다.**

이 태스크는 TDD의 「빨강」이 보장되지 않는다. 대신 **`mt-auto`를 잠시 지워 AC-01이 11개 중 7개 빨간불을 내는지 확인한 뒤 되돌린다** — 검사가 실제로 작동하는지 그렇게 확인한다.

- [x] **Step 3: 구현 정리와 결함 대응**

null 좁히기를 정리한다. AC-02가 실패하는 화면이 있으면 **그 자리에서 고치지 말고 기록한다** — 원인이 CSS인지 콘텐츠인지에 따라 다른 스펙의 일이 될 수 있다. 사람에게 보고하고 판단을 받는다.

- [x] **Step 4: 통과 확인**

Run: `cd frontend && pnpm e2e`
Expected: PASS — 판정 3개 + 스텁 11개 + AC-01 7개 + AC-02 11개 + AC-03 7개 = **39개**

- [x] **Step 5: 커밋** — `test(web): 레이아웃 불변식 셋을 실제 브라우저로 고정 (AC-WEBLAYOUT 3개)`

---

## Task 5: CI 통합

**Files:**
- Modify: `.github/workflows/frontend.yml`
- Modify: `docs/specs/2026-09-02-web-e2e-layout.md` (status를 `구현완료`로)

**Covers:** 없음 — 인프라

- [x] **Step 1: 워크플로에 단계를 더한다**

`check` 잡의 「워커 테스트」 뒤에 붙인다. **빌드는 이미 앞 단계에서 했으므로 `webServer.command`가 다시 빌드하지 않도록** `PLAYWRIGHT_SKIP_BUILD` 같은 분기를 두거나, `webServer.command`를 `pnpm start`로 두고 CI에서만 빌드를 앞에 두는 방식을 고른다. **둘 중 하나를 골라 config에 주석으로 이유를 남긴다.**

```yaml
      - name: Playwright 브라우저 설치
        working-directory: frontend
        run: pnpm exec playwright install --with-deps chromium

      # jsdom은 레이아웃을 계산하지 않는다. 이 단계만이 탭바 위치·가로 스크롤을 실제로 잰다.
      - name: 레이아웃 E2E
        working-directory: frontend
        run: pnpm e2e

      - name: 실패 시 스크린샷 업로드
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-실패-스크린샷
          path: frontend/test-results/
          retention-days: 7
```

**브라우저 설치를 캐시한다.** `actions/cache`로 `~/.cache/ms-playwright`를 잡으면 매 실행 150MB 다운로드를 아낀다. 캐시 키에 Playwright 버전을 넣는다.

- [x] **Step 2: CI에서 실제로 도는지 확인한다**

푸시하고 Actions에서 「레이아웃 E2E」 단계가 초록인지 본다. **로컬 통과만으로 이 태스크를 끝내지 않는다** — CI 러너는 폰트가 달라 텍스트 폭이 달라지고, 그것이 가로 스크롤 판정을 바꿀 수 있다.

- [x] **Step 3: 실패 아티팩트를 확인한다**

`mt-auto`를 지운 커밋을 일부러 밀어 **스크린샷이 아티팩트로 올라오는지** 본다. 확인 후 되돌린다. 스펙의 「수동 확인」이 이것이다.

- [x] **Step 4: 스펙 status 변경**

`docs/specs/2026-09-02-web-e2e-layout.md`의 `status`를 `구현완료`로 바꾼다.

Run: `./scripts/check-spec-coverage.sh`
Expected: 통과. **AC 6개가 전부 발견돼야 한다** — 발견되지 않으면 Task 1 Step 3의 경로 추가가 빠진 것이다.

- [x] **Step 5: 커밋** — `ci(web): 레이아웃 E2E를 CI에 넣는다`

---

## 완료 기준

- [x] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 (249개 유지)
- [x] `cd frontend && pnpm test:worker` 통과 (6개)
- [x] `cd frontend && pnpm e2e` 통과 (39개)
- [x] `cd backend && ./gradlew clean check` 통과 (462개) — 백엔드는 건드리지 않으므로 그대로여야 한다
- [x] `./scripts/check-spec-coverage.sh` 통과, 이 스펙의 AC 6개가 발견됨
- [x] CI에서 「레이아웃 E2E」 단계가 초록
- [x] 일부러 깨뜨렸을 때 스크린샷 아티팩트가 올라옴
- [x] `git diff --stat main...HEAD`에 `backend/`가 없다

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 6개 중 6개가 태스크에 매핑됨

**자리표시자 검사:** Task 3 Step 4의 `handlers` 배열에 의도적인 빈칸이 있다 — **Step 1에서 실제 응답을 확인한 뒤 채우기 위한 것**이며, 지어낸 값을 미리 박지 않으려는 것이다. 그 외 `TODO`·`TBD`·"나중에"는 없다.

**타입 일관성:** Task 2의 `withinTolerance`·`notBelow`를 Task 4가 그대로 쓴다. Task 3의 `SCREENS`를 Task 4가 필터링해 쓴다. `installStubs`의 반환 타입은 Task 3에서 확정되고 Task 4는 반환값을 쓰지 않는다.

**검증되지 않은 가정:**

1. **`page.route("**/api/v1/**")`가 Next 서버 사이드 요청까지 잡는지.** 브라우저가 보내는 요청만 가로챈다 — 서버 컴포넌트가 백엔드를 직접 부르면 못 잡는다. 이 앱은 브라우저가 백엔드를 직접 부르는 구조이나(`frontend/CLAUDE.md`「인증 흐름」), Task 3 Step 5에서 실제로 드러난다. 서버에서 부르는 것이 있으면 그 화면은 대상에서 빼거나 다른 방법이 필요하다.
2. **`/api/auth/refresh` 스텁만으로 로그인 상태가 되는지.** 앱이 첫 401에서 복구한다는 것은 코드로 확인했으나, 새 탭에서 그 경로가 실제로 도는지는 Task 3 Step 5에서 확인한다.
3. **CI 러너의 폰트가 로컬과 달라 가로 스크롤 판정이 달라지는지.** Task 5 Step 2에서 드러난다. 달라지면 폰트를 고정하거나(`--with-deps`가 기본 폰트를 깐다) 그 화면의 판정을 조정한다.
4. **`webServer.command`의 빌드 중복.** CI에 이미 `pnpm build` 단계가 있어 두 번 빌드하게 된다. Task 5 Step 1에서 한쪽으로 정리한다.
5. **`main` 요소가 모든 화면에 하나씩 있는지.** AC-03이 `locator("main").first()`를 쓴다. 없는 화면이 있으면 그 화면에서 실패한다 — Task 4 Step 2에서 드러난다.

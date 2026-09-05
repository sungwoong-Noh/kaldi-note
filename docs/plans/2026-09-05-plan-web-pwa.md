# PWA 설치와 레시피 오프라인 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-05-web-pwa.md`

**Goal:** 앱을 폰 홈화면에 설치할 수 있고, 한 번이라도 연 레시피는 네트워크 없이 다시 열린다.

**Architecture:** 빌드 시점 프리캐시 목록을 만들지 않는다 — **「한 번 연 것만 캐시」이므로 방문한 것을 그때그때 담으면 된다.** 그래서 `public/sw.js`를 손으로 쓰고 Serwist/Workbox를 넣지 않는다. 캐시는 둘로 나눈다: 레시피 API 응답은 `kaldi-recipe-v1`(네트워크 우선 · 50개 LRU), 문서와 정적 자산은 `kaldi-shell-v1`(문서는 네트워크 우선, 해시된 자산은 캐시 우선). **가장 까다로운 부분은 캐시가 아니라 인증이다** — 지금은 `refreshSession()`이 실패하면 원인을 가리지 않고 `/login`으로 보내서, 오프라인이면 캐시가 아무리 차 있어도 레시피에 도달할 수 없다. 실패를 `offline`과 `unauthorized`로 가르고, `offline`일 때는 토큰 없이도 화면을 그리게 한다.

**작업 위치:** `frontend/` 전용. **백엔드 변경 0줄.**

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-PWA-01 | 매니페스트가 열린다 | Task 1 | e2e |
| AC-PWA-02 | 이름이 `kaldi note` | Task 1 | e2e |
| AC-PWA-03 | `standalone` · `start_url` `/` | Task 1 | e2e |
| AC-PWA-04 | 색이 `#ffffff` | Task 1 | e2e |
| AC-PWA-05 | 아이콘 3장이 실제로 열린다 | Task 1 | e2e |
| AC-PWA-06 | 문서가 매니페스트를 가리킨다 | Task 1 | e2e |
| AC-PWA-07 | `/sw.js`가 열린다 | Task 2 | e2e |
| AC-PWA-08 | Service Worker가 등록된다 | Task 2 | e2e |
| AC-PWA-09 | 연 레시피가 캐시에 들어간다 | Task 3 | e2e |
| AC-PWA-10 | 온라인에서 캐시가 최신을 안 가린다 | Task 3 | e2e |
| AC-PWA-19 | 50개까지 전부 남는다 | Task 3 | e2e |
| AC-PWA-20 | 51번째에 가장 오래된 것이 빠진다 | Task 3 | e2e |
| AC-PWA-21 | 캐시에 없으면 503 `OFFLINE` | Task 3 | e2e |
| AC-PWA-11 | 오프라인에서 연 적 있는 레시피가 열린다 | Task 4 | e2e |
| AC-PWA-12 | 연 적 없는 레시피는 안내로 떨어진다 | Task 4 | e2e |
| AC-PWA-13 | 오프라인 콜드 스타트가 안 튕긴다 | Task 4 | e2e |
| AC-PWA-14 | 401이면 지금처럼 로그인으로 | Task 4 | 단위 |
| AC-PWA-16 | 저장된 레시피가 목록으로 나온다 | Task 5 | e2e |
| AC-PWA-17 | 목록의 항목이 실제로 열린다 | Task 5 | e2e |
| AC-PWA-18 | 캐시가 비면 그렇게 말한다 | Task 5 | e2e |
| AC-PWA-15 | 로그아웃하면 캐시가 빈다 | Task 6 | e2e |

**스펙의 AC 21개 중 21개가 매핑됐다.**

---

## Global Constraints

- **백엔드를 건드리지 않는다.** `git diff --stat main...HEAD`에 `backend/`가 나오면 설계가 어긋난 것이다.
- **의존성을 추가하지 않는다.** Serwist·Workbox·`next-pwa` 모두 넣지 않는다. `package.json`의 `dependencies`·`devDependencies`가 이 브랜치에서 늘어나면 안 된다.
- **`public/sw.js`는 번들러를 거치지 않는다.** TypeScript도 `import`도 쓸 수 없다. 순수 JS 한 파일이다. ESLint가 이 파일을 훑지 않도록 무시 목록에 넣는다.
- **캐시 이름은 리터럴 `kaldi-shell-v1`·`kaldi-recipe-v1`이다.** 테스트가 이 문자열로 캐시를 연다.
- **`any` 금지, `as` 단언 금지, `!` 금지.** `sw.js`는 검사 대상이 아니지만 나머지는 그대로다.
- **`Write` 전에 파일이 있는지 본다.** 2026-09-02에 계획이 `Create`로 적은 파일이 이미 있어 기존 테스트 11개를 덮어썼다.
- 커밋 전 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. e2e를 건드린 태스크는 `pnpm e2e`도 돌린다.

---

## File Structure

```
frontend/
├── public/
│   ├── manifest.json                          Create — 매니페스트
│   ├── sw.js                                  Create — Service Worker (번들 안 함)
│   └── icons/
│       ├── icon-192.png                       Create
│       ├── icon-512.png                       Create
│       └── icon-512-maskable.png              Create
├── scripts/
│   └── make-icons.mjs                         Create — SVG를 PNG로 굽는다 (Playwright 재사용)
├── eslint.config.mjs                          Modify — public/sw.js 무시
├── src/
│   ├── app/
│   │   ├── layout.tsx                         Modify — manifest 메타 + SW 등록
│   │   ├── offline/page.tsx                   Create — 「연결 없음」 화면
│   │   └── more/page.tsx                      Modify — 로그아웃 시 캐시 삭제
│   ├── components/pwa/
│   │   └── ServiceWorkerRegistrar.tsx         Create
│   ├── features/auth/
│   │   ├── useRequireSession.ts               Modify — offline / unauthorized 분기
│   │   └── useRequireSession.test.tsx         Modify — AC-PWA-14
│   ├── lib/
│   │   ├── refresh.ts                         Modify — RefreshResult 반환
│   │   ├── authed-fetch.ts                    Modify — 새 반환형에 맞춤
│   │   └── offline-cache.ts                   Create — 캐시 읽기·비우기
│   └── test/fixtures.ts                       Modify — kasuya 상세 픽스처 추가
└── e2e/
    ├── stubs.ts                               Modify — context 라우팅 + 합성 레시피
    └── pwa.spec.ts                            Create — AC 20개

docs/specs/2026-09-05-web-pwa.md               Modify — status
```

---

## Task 1: 매니페스트와 아이콘

**Files:**
- Create: `frontend/scripts/make-icons.mjs`
- Create: `frontend/public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`
- Create: `frontend/public/manifest.json`
- Modify: `frontend/src/app/layout.tsx`
- Create: `frontend/e2e/pwa.spec.ts`

**Covers:** AC-PWA-01, 02, 03, 04, 05, 06

**Interfaces:**
- Produces: `/manifest.json`과 `/icons/*.png` 세 장. 뒤 태스크는 쓰지 않는다.
- Consumes: 없음.

- [ ] **Step 1: 시작 전 초록을 확인한다**

Run: `cd frontend && pnpm test && pnpm e2e`
Expected: PASS. **두 숫자를 적어둔다**(단위 283개, e2e는 현재 개수).

- [ ] **Step 2: 실패하는 e2e를 쓴다**

Create `frontend/e2e/pwa.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

test.describe("매니페스트", () => {
  test("AC-PWA-01 · /manifest.json이 200이고 manifest MIME이다", async ({ request }) => {
    const response = await request.get("/manifest.json");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/manifest+json");
  });

  test("AC-PWA-02 · 이름이 kaldi note다", async ({ request }) => {
    const manifest = await (await request.get("/manifest.json")).json();
    expect(manifest.name).toBe("kaldi note");
    expect(manifest.short_name).toBe("kaldi note");
  });

  test("AC-PWA-03 · standalone으로 / 에서 시작한다", async ({ request }) => {
    const manifest = await (await request.get("/manifest.json")).json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
  });

  test("AC-PWA-04 · 색이 흰색이다", async ({ request }) => {
    const manifest = await (await request.get("/manifest.json")).json();
    expect(manifest.theme_color).toBe("#ffffff");
    expect(manifest.background_color).toBe("#ffffff");
  });

  test("AC-PWA-05 · 아이콘 3장이 실제로 열린다", async ({ request }) => {
    const manifest = await (await request.get("/manifest.json")).json();
    expect(manifest.icons).toHaveLength(3);
    expect(
      manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`),
    ).toEqual(["192x192 any", "512x512 any", "512x512 maskable"]);

    for (const icon of manifest.icons) {
      const file = await request.get(icon.src);
      expect(file.status(), icon.src).toBe(200);
      expect(file.headers()["content-type"], icon.src).toContain("image/png");
    }
  });

  test("AC-PWA-06 · 문서가 매니페스트를 가리킨다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");
    await expect(page.locator('link[rel="manifest"][href="/manifest.json"]')).toHaveCount(1);
  });
});
```

- [ ] **Step 3: e2e 실행 — 실패 확인**

Run: `cd frontend && pnpm e2e pwa.spec.ts`
Expected: FAIL — 6개 전부. `/manifest.json`이 404라 `status()`가 `404`이고, JSON 파싱이 깨진다.

- [ ] **Step 4: 아이콘을 굽는 스크립트를 쓴다**

Create `frontend/scripts/make-icons.mjs`:

```js
/**
 * 홈화면 아이콘 3장을 굽는다. **한 번 굽고 나면 다시 돌릴 일이 거의 없다** — 결과 PNG를
 * 저장소에 커밋하므로 빌드가 이 스크립트에 의존하지 않는다.
 *
 *   cd frontend && node scripts/make-icons.mjs
 *
 * 의존성을 새로 넣지 않으려고 Playwright(이미 devDependency다)로 SVG를 렌더해 캡처한다.
 * maskable은 안드로이드 런처가 가장자리를 최대 20%까지 깎으므로 글자를 더 작게 그린다.
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const OUT = new URL("../public/icons/", import.meta.url);

/** @param {number} ratio 글자 높이가 캔버스에서 차지할 비율 */
const svg = (size, ratio) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#171717"/>
  <text x="50%" y="50%" fill="#ffffff" font-family="Helvetica, Arial, sans-serif"
        font-weight="700" font-size="${Math.round(size * ratio)}"
        text-anchor="middle" dominant-baseline="central">k</text>
</svg>`;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

for (const [name, size, ratio] of [
  ["icon-192.png", 192, 0.62],
  ["icon-512.png", 512, 0.62],
  ["icon-512-maskable.png", 512, 0.42],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(svg(size, ratio));
  await page.screenshot({ path: new URL(name, OUT).pathname, omitBackground: false });
  await page.close();
  console.log(`✓ ${name} (${size}x${size})`);
}

await browser.close();
```

- [ ] **Step 5: 아이콘을 굽는다**

Run: `cd frontend && node scripts/make-icons.mjs`
Expected: `✓ icon-192.png (192x192)` 등 3줄. `ls -l public/icons`로 세 파일이 0바이트가 아닌지 본다.

- [ ] **Step 6: 매니페스트를 쓴다**

Create `frontend/public/manifest.json`:

```json
{
  "name": "kaldi note",
  "short_name": "kaldi note",
  "description": "커피 레시피를 재현 가능한 형태로 기록하고 공유합니다.",
  "lang": "ko",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 7: 문서가 매니페스트를 가리키게 한다**

Modify `frontend/src/app/layout.tsx` — `metadata`에 한 줄을 더한다. Next가 `<link rel="manifest">`를 직접 넣어 준다.

```tsx
export const metadata: Metadata = {
  title: "kaldi note",
  description: "커피 레시피를 재현 가능한 형태로 기록하고 공유합니다.",
  // Next가 이 값으로 <link rel="manifest">를 만든다. 직접 <head>에 넣지 않는다.
  manifest: "/manifest.json",
};
```

- [ ] **Step 8: e2e 실행 — 통과 확인**

Run: `cd frontend && pnpm e2e pwa.spec.ts`
Expected: PASS, 6 tests.

> `Content-Type`이 `application/manifest+json`이 아니라 `application/json`으로 나오면 AC-PWA-01이 빨갛다. `public/`의 MIME은 Next(개발·`start`)와 Workers(배포)가 각각 정한다. 그때는 `public/manifest.json` 대신 `src/app/manifest.ts`(Next의 매니페스트 라우트)로 옮긴다 — Next가 이 MIME을 보장한다. 옮기면 File Structure의 경로도 함께 고친다.

- [ ] **Step 9: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && cd ..
git add frontend/public frontend/scripts frontend/src/app/layout.tsx frontend/e2e/pwa.spec.ts
git commit -m "feat(web): 홈화면 설치용 매니페스트와 아이콘 (AC-PWA 6개)"
```

---

## Task 2: Service Worker 등록

**Files:**
- Create: `frontend/public/sw.js`
- Create: `frontend/src/components/pwa/ServiceWorkerRegistrar.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/eslint.config.mjs`
- Modify: `frontend/e2e/pwa.spec.ts`

**Covers:** AC-PWA-07, AC-PWA-08

**Interfaces:**
- Produces: `/sw.js`가 scope `/`로 등록된다. 뒤 태스크가 이 파일에 `fetch` 처리를 더한다.
- Produces: `ServiceWorkerRegistrar()` — props 없는 클라이언트 컴포넌트, `null`을 그린다.

- [ ] **Step 1: 실패하는 e2e를 쓴다**

Modify `frontend/e2e/pwa.spec.ts` — 파일 끝에 더한다.

```ts
test.describe("Service Worker", () => {
  test("AC-PWA-07 · /sw.js가 열린다", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/javascript");
  });

  test("AC-PWA-08 · 등록되고 scope가 루트다", async ({ page, baseURL }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.scope;
    });
    expect(scope).toBe(`${baseURL}/`);
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  });
});
```

- [ ] **Step 2: e2e 실행 — 실패 확인**

Run: `cd frontend && pnpm e2e pwa.spec.ts`
Expected: FAIL — AC-PWA-07은 404, AC-PWA-08은 `navigator.serviceWorker.ready`가 영영 풀리지 않아 타임아웃.

- [ ] **Step 3: 최소 Service Worker를 쓴다**

Create `frontend/public/sw.js`:

```js
/*
 * kaldi note Service Worker.
 *
 * 번들러를 거치지 않는다 — import도 TypeScript도 쓸 수 없다. 브라우저가 이 파일을 그대로 읽는다.
 * 캐시 규칙은 docs/specs/2026-09-05-web-pwa.md가 정한다.
 */

// skipWaiting/claim을 둘 다 켠다. 안 켜면 첫 방문에서 컨트롤러가 붙지 않아
// 그 세션 동안 fetch 핸들러가 한 번도 돌지 않는다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
```

- [ ] **Step 4: 등록 컴포넌트를 쓴다**

Create `frontend/src/components/pwa/ServiceWorkerRegistrar.tsx`:

```tsx
"use client";

import { useEffect } from "react";

/**
 * Service Worker를 등록한다. 화면을 그리지 않는다.
 *
 * <p>등록이 실패해도 앱은 그대로 동작해야 하므로 예외를 삼킨다 — 오프라인 캐시가 없을 뿐이다.
 * 사파리의 사생활 보호 창처럼 `serviceWorker` 자체가 없는 환경도 있다.
 */
export function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => undefined);
  }, []);

  return null;
}
```

- [ ] **Step 5: 레이아웃에 붙인다**

Modify `frontend/src/app/layout.tsx` — import를 더하고 `<BottomNav />` 아래에 둔다.

```tsx
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
```

```tsx
        <Providers>
          {children}
          <BottomNav />
          <ServiceWorkerRegistrar />
        </Providers>
```

- [ ] **Step 6: ESLint가 sw.js를 훑지 않게 한다**

Modify `frontend/eslint.config.mjs` — `ignores`에 `"public/sw.js"`를 더한다. 이미 `ignores` 배열이 있으면 항목만 추가하고, 없으면 배열 맨 앞에 `{ ignores: ["public/sw.js"] }` 항목을 넣는다.

- [ ] **Step 7: e2e 실행 — 통과 확인**

Run: `cd frontend && pnpm e2e pwa.spec.ts`
Expected: PASS, 8 tests.

- [ ] **Step 8: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && cd ..
git add frontend/public/sw.js frontend/src frontend/eslint.config.mjs frontend/e2e/pwa.spec.ts
git commit -m "feat(web): Service Worker 등록 (AC-PWA-07·08)"
```

---

## Task 3: 레시피 캐시 — 네트워크 우선과 50개 LRU

**Files:**
- Modify: `frontend/public/sw.js`
- Modify: `frontend/e2e/stubs.ts`
- Modify: `frontend/e2e/pwa.spec.ts`

**Covers:** AC-PWA-09, 10, 19, 20, 21

**Interfaces:**
- Produces (`sw.js`): `kaldi-recipe-v1` 캐시. **키는 `Request`가 아니라 `request.url` 문자열이다** — 오프라인 콜드 스타트에는 `Authorization` 헤더가 없어서, 헤더가 붙은 `Request`로 넣으면 나중에 못 찾을 수 있다.
- Produces (`stubs.ts`): `installSwStubs(context: BrowserContext): Promise<void>` — Service Worker가 보낸 요청까지 가로챈다. `installStubs(page)`는 그대로 둔다.
- Produces (`stubs.ts`): `stubRecipeDetail(context: BrowserContext, body: unknown): Promise<void>` — `/api/v1/recipes/<숫자>` 하나의 응답을 갈아끼운다(AC-PWA-10용).
- Produces (`stubs.ts`): `stubSyntheticRecipes(context: BrowserContext): Promise<void>` — id 101~151이 각자 자기 id를 담은 응답을 낸다(AC-PWA-19·20용).

> **`page.route`가 아니라 `context.route`인 이유.** Service Worker가 보낸 `fetch`는 페이지가 보낸 것이 아니라서 `page.route`에 걸리지 않는다. Playwright는 `serviceWorkers: "allow"`(기본값)일 때 **컨텍스트 라우팅으로만** 이 요청을 가로챈다. Step 1이 이것을 먼저 잰다 — 여기서 어긋나면 이 태스크 이후가 전부 무너진다.

- [ ] **Step 1: 가정을 먼저 잰다 — SW의 요청이 스텁에 걸리는가**

Modify `frontend/e2e/pwa.spec.ts` — 임시 테스트를 하나 더한다.

```ts
test("측정용 · SW가 보낸 요청이 context 스텁에 걸린다", async ({ page, context }) => {
  const seen: string[] = [];
  await context.route("**/api/v1/recipes/2", (route) => {
    seen.push(route.request().url());
    return route.fulfill({ json: { probe: true } });
  });
  await installStubs(page);
  await page.goto("/recipes");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.evaluate(() => fetch("http://localhost:8080/api/v1/recipes/2"));
  expect(seen.length).toBeGreaterThan(0);
});
```

Run: `cd frontend && pnpm e2e pwa.spec.ts -g "측정용"`
Expected: PASS. **빨갛게 나오면 여기서 멈추고 사람에게 알린다** — 스텁 방식을 다시 정해야 하고, 그건 계획을 고치는 일이지 코드를 비트는 일이 아니다. 통과하면 이 임시 테스트를 지운다.

- [ ] **Step 2: 스텁 하네스를 넓힌다**

Modify `frontend/e2e/stubs.ts` — 파일 끝에 더한다. 기존 `HANDLERS`와 `installStubs`는 건드리지 않는다.

```ts
/**
 * Service Worker가 보낸 요청까지 가로챈다.
 *
 * <p>`installStubs(page)`는 `page.route`라 SW의 fetch를 못 잡는다. PWA 테스트는 SW가
 * 네트워크에 나가는 것을 봐야 하므로 컨텍스트에 건다.
 */
export async function installSwStubs(context: BrowserContext): Promise<void> {
  await context.route("**/api/auth/refresh", (route: Route) =>
    route.fulfill({
      json: { accessToken: "e2e.access.token", expiresInSeconds: 1800 },
    }),
  );

  await context.route("**/api/v1/**", (route: Route) => {
    const pathname = new URL(route.request().url()).pathname;
    const handler = HANDLERS.find(([pattern]) => pattern.test(pathname));
    if (handler === undefined) return route.fulfill({ status: 404, json: {} });
    return route.fulfill({ json: handler[1] });
  });
}

/** `/api/v1/recipes/<숫자>` 하나의 응답을 갈아끼운다. 나중에 건 라우트가 이긴다. */
export async function stubRecipeDetail(
  context: BrowserContext,
  body: unknown,
): Promise<void> {
  await context.route(/\/api\/v1\/recipes\/\d+$/, (route: Route) =>
    route.fulfill({ json: body }),
  );
}

/**
 * id 101~151이 각자 자기 id를 담은 응답을 낸다. **개수만 세는 테스트 전용이다** —
 * 지어낸 픽스처로 내용을 검증하지 않는다. 서로 다른 레시피 51개를 실제 응답으로 뜰 수는 없다.
 */
export async function stubSyntheticRecipes(context: BrowserContext): Promise<void> {
  await context.route(/\/api\/v1\/recipes\/1\d\d$/, (route: Route) => {
    const id = Number(new URL(route.request().url()).pathname.split("/").pop());
    return route.fulfill({ json: { ...hoffmann, id, title: `레시피 ${id}` } });
  });
}
```

`BrowserContext`를 import에 더한다:

```ts
import type { BrowserContext, Page, Route } from "@playwright/test";
```

- [ ] **Step 3: 실패하는 e2e를 쓴다**

Modify `frontend/e2e/pwa.spec.ts` — 파일 끝에 더한다.

```ts
/** `kaldi-recipe-v1`에 든 키의 URL 목록. */
async function recipeCacheKeys(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(async () => {
    const cache = await caches.open("kaldi-recipe-v1");
    return (await cache.keys()).map((request) => request.url);
  });
}

test.describe("레시피 캐시", () => {
  test("AC-PWA-09 · 연 레시피가 캐시에 들어간다", async ({ page, context }) => {
    await installSwStubs(context);
    await installStubs(page);
    await page.goto("/recipes/2");
    await expect(page.getByText("James Hoffmann Ultimate V60")).toBeVisible();

    await expect
      .poll(() => recipeCacheKeys(page))
      .toEqual([expect.stringMatching(/\/api\/v1\/recipes\/2$/)]);
  });

  test("AC-PWA-10 · 온라인에서는 캐시가 최신을 가리지 않는다", async ({ page, context }) => {
    await installSwStubs(context);
    await installStubs(page);
    await page.goto("/recipes/2");
    await expect(page.getByText("100°C")).toBeVisible();

    await stubRecipeDetail(context, { ...hoffmann, waterTempC: 94.0 });
    await page.goto("/recipes/2");

    await expect(page.getByText("94°C")).toBeVisible();
    await expect(page.getByText("100°C")).toHaveCount(0);
  });

  test("AC-PWA-19 · 50개까지는 전부 남는다", async ({ page, context }) => {
    await installSwStubs(context);
    await stubSyntheticRecipes(context);
    await installStubs(page);
    await page.goto("/recipes/101");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    for (let id = 102; id <= 150; id += 1) await page.goto(`/recipes/${id}`);

    await expect.poll(async () => (await recipeCacheKeys(page)).length).toBe(50);
    expect(await recipeCacheKeys(page)).toContainEqual(
      expect.stringMatching(/\/api\/v1\/recipes\/101$/),
    );
  });

  test("AC-PWA-20 · 51번째에서 가장 오래된 것이 빠진다", async ({ page, context }) => {
    await installSwStubs(context);
    await stubSyntheticRecipes(context);
    await installStubs(page);
    await page.goto("/recipes/101");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    for (let id = 102; id <= 151; id += 1) await page.goto(`/recipes/${id}`);

    await expect.poll(async () => (await recipeCacheKeys(page)).length).toBe(50);
    const keys = await recipeCacheKeys(page);
    expect(keys).not.toContainEqual(expect.stringMatching(/\/api\/v1\/recipes\/101$/));
    expect(keys).toContainEqual(expect.stringMatching(/\/api\/v1\/recipes\/151$/));
  });

  test("AC-PWA-21 · 캐시에 없는 API 요청은 오프라인에서 503이다", async ({ page, context }) => {
    await installSwStubs(context);
    await installStubs(page);
    await page.goto("/recipes/2");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    await context.setOffline(true);
    const result = await page.evaluate(async () => {
      const response = await fetch("http://localhost:8080/api/v1/recipes/3");
      return { status: response.status, body: await response.text() };
    });

    expect(result.status).toBe(503);
    expect(JSON.parse(result.body)).toEqual({
      code: "OFFLINE",
      message: "네트워크에 연결되어 있지 않습니다.",
    });
  });
});
```

import를 파일 위쪽에 더한다:

```ts
import { hoffmann } from "../src/test/fixtures";
import {
  installStubs,
  installSwStubs,
  stubRecipeDetail,
  stubSyntheticRecipes,
} from "./stubs";
```

- [ ] **Step 4: e2e 실행 — 실패 확인**

Run: `cd frontend && pnpm e2e pwa.spec.ts`
Expected: FAIL — 5개. `caches.open("kaldi-recipe-v1")`이 빈 캐시를 만들어 키가 0개이고, AC-PWA-21은 오프라인에서 `fetch`가 `TypeError`로 죽는다.

- [ ] **Step 5: sw.js에 레시피 캐시를 넣는다**

Modify `frontend/public/sw.js` — `activate` 아래에 더한다.

```js
const RECIPE_CACHE = "kaldi-recipe-v1";
const RECIPE_LIMIT = 50;
const RECIPE_PATH = /^\/api\/v1\/recipes\/\d+$/;

function offlineResponse() {
  return new Response(
    JSON.stringify({
      code: "OFFLINE",
      message: "네트워크에 연결되어 있지 않습니다.",
    }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  );
}

/**
 * 응답을 넣고 상한을 지킨다.
 *
 * 넣기 전에 지우는 것이 핵심이다 — Cache Storage의 keys()는 넣은 순서를 돌려주므로,
 * 다시 연 항목을 맨 뒤로 옮겨야 "가장 오래전에 연 것"이 앞에 온다. 안 그러면 LRU가 아니라
 * "가장 먼저 처음 연 것"을 지우게 된다.
 */
async function putRecipe(url, response) {
  const cache = await caches.open(RECIPE_CACHE);
  await cache.delete(url);
  await cache.put(url, response);

  const keys = await cache.keys();
  for (const stale of keys.slice(0, Math.max(0, keys.length - RECIPE_LIMIT))) {
    await cache.delete(stale);
  }
}

async function handleRecipe(request) {
  try {
    const response = await fetch(request);
    if (response.ok) await putRecipe(request.url, response.clone());
    return response;
  } catch {
    const cache = await caches.open(RECIPE_CACHE);
    const cached = await cache.match(request.url);
    return cached ?? offlineResponse();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  if (RECIPE_PATH.test(new URL(request.url).pathname)) {
    event.respondWith(handleRecipe(request));
  }
});
```

- [ ] **Step 6: e2e 실행 — 통과 확인**

Run: `cd frontend && pnpm e2e pwa.spec.ts`
Expected: PASS, 13 tests.

- [ ] **Step 7: 돌연변이로 LRU를 확인한다**

`putRecipe`의 `await cache.delete(url);` 한 줄을 잠시 지우고 돌린다.
Expected: **AC-PWA-20만** 빨갛다(101이 남고 다른 것이 빠진다). AC-PWA-19는 초록 그대로다 — 50개까지는 재방문이 없어 순서가 같기 때문이다. 확인한 뒤 줄을 되돌린다.

- [ ] **Step 8: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && cd ..
git add frontend/public/sw.js frontend/e2e
git commit -m "feat(web): 레시피 응답을 네트워크 우선으로 캐시하고 50개로 제한 (AC-PWA 5개)"
```

---

## Task 4: 오프라인 재방문 — 앱 셸 캐시와 인증 분기

**Files:**
- Modify: `frontend/public/sw.js`
- Modify: `frontend/src/lib/refresh.ts`
- Modify: `frontend/src/lib/authed-fetch.ts`
- Modify: `frontend/src/features/auth/useRequireSession.ts`
- Modify: `frontend/src/features/auth/useRequireSession.test.tsx`
- Modify: `frontend/e2e/pwa.spec.ts`

**Covers:** AC-PWA-11, 12, 13, 14

**Interfaces:**
- Produces (`refresh.ts`):
  ```ts
  export type RefreshResult =
    | { readonly kind: "ok"; readonly accessToken: string }
    | { readonly kind: "unauthorized" }
    | { readonly kind: "offline" };

  export function refreshSession(): Promise<RefreshResult>;
  ```
  `fetch`가 예외로 끝나면 `offline`, HTTP가 ok가 아니면 `unauthorized`다.
- Changes (`useRequireSession`): 반환 타입은 그대로 `{ ready: boolean; onSessionLost: () => void }`다. **`offline`일 때 `ready`가 true가 된다** — 토큰이 없어도 화면을 그려야 Service Worker가 캐시를 내줄 수 있다.
- Consumes: Task 3의 `installSwStubs`.

- [ ] **Step 1: 실패하는 단위 테스트를 쓴다 (AC-PWA-14)**

Modify `frontend/src/features/auth/useRequireSession.test.tsx` — 기존 테스트는 그대로 두고 더한다.

```tsx
it("AC-PWA-14 · refresh가 401이면 로그인으로 보낸다", async () => {
  vi.mocked(global.fetch).mockResolvedValueOnce(
    new Response(null, { status: 401 }),
  );

  renderHook(() => useRequireSession());

  await waitFor(() =>
    expect(replace).toHaveBeenCalledWith("/login?next=%2Frecipes%2F2"),
  );
});

it("AC-PWA-13 · refresh가 네트워크로 실패하면 로그인으로 보내지 않는다", async () => {
  vi.mocked(global.fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));

  const { result } = renderHook(() => useRequireSession());

  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(replace).not.toHaveBeenCalled();
});
```

> 기존 파일이 `usePathname`을 무엇으로 모킹하는지 먼저 읽고, `/recipes/2`를 돌려주도록 맞춘다. 기존 테스트가 다른 경로를 쓰고 있으면 **그 테스트를 고치지 말고** 이 두 개만 자기 경로로 맞춘다.

- [ ] **Step 2: 단위 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test useRequireSession`
Expected: FAIL — AC-PWA-13이 빨갛다. 지금은 네트워크 실패도 `/login`으로 보내므로 `replace`가 불린다.

- [ ] **Step 3: refresh의 반환을 넓힌다**

Modify `frontend/src/lib/refresh.ts` — `inFlight`의 타입과 본문을 바꾼다.

```ts
/**
 * refresh의 결과.
 *
 * <p><b>실패를 둘로 가르는 이유:</b> 오프라인에서 앱을 열면 `fetch`가 예외로 끝나는데, 이것을
 * 인증 만료와 같이 다루면 캐시가 차 있어도 로그인 화면으로 튕긴다(`docs/specs/2026-09-05-web-pwa.md`).
 */
export type RefreshResult =
  | { readonly kind: "ok"; readonly accessToken: string }
  | { readonly kind: "unauthorized" }
  | { readonly kind: "offline" };

let inFlight: Promise<RefreshResult> | null = null;

export function refreshSession(): Promise<RefreshResult> {
  inFlight ??= (async (): Promise<RefreshResult> => {
    try {
      const response = await fetch("/api/auth/refresh", { method: "POST" });
      // 응답을 받았다면 네트워크는 살아 있다. ok가 아니면 인증 문제로 본다.
      if (!response.ok) return { kind: "unauthorized" };

      const { accessToken } = refreshResponseSchema.parse(await response.json());
      setAccessToken(accessToken);
      return { kind: "ok", accessToken };
    } catch {
      return { kind: "offline" };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
```

> 본문 파싱이 깨져도 `offline`이 된다. 지금까지도 그 경우는 `null`이었고 화면에는 차이가 없다 — 다만 로그인으로 보내지 않게 되는 것이 유일한 변화다.

- [ ] **Step 4: authed-fetch를 새 반환형에 맞춘다**

Modify `frontend/src/lib/authed-fetch.ts` — `const refreshed = await refreshSession();` 아래를 바꾼다.

```ts
    const refreshed = await refreshSession();
    // 네트워크 문제라면 세션이 끊긴 것이 아니다. 지우지도 보내지도 않고 원래 오류를 올린다.
    if (refreshed.kind === "offline") throw error;
    if (refreshed.kind === "unauthorized") {
      clearSession();
      onSessionLost?.();
      throw error;
    }

    return request(url, withAuth(rest, refreshed.accessToken) as typeof rest);
```

- [ ] **Step 5: 세션 훅을 고친다**

Modify `frontend/src/features/auth/useRequireSession.ts` — `useState`를 import에 더하고 본문을 바꾼다.

```ts
  const hasToken = useSyncExternalStore(
    subscribeSession,
    hasAccessToken,
    hasAccessTokenOnServer,
  );
  // 서버와 첫 렌더가 어긋나지 않도록 false로 시작한다. 오프라인 판정은 effect에서만 켜진다.
  const [offline, setOffline] = useState(false);
  const ready = hasToken || offline;

  useEffect(() => {
    if (hasToken) return;

    let cancelled = false;
    void refreshSession().then((result) => {
      if (cancelled || result.kind === "ok") return;
      // 오프라인이면 토큰 없이 그린다. Service Worker가 캐시된 응답을 내주므로
      // 화면은 채워지고, 캐시에 없는 것만 503으로 떨어진다.
      if (result.kind === "offline") {
        setOffline(true);
        return;
      }
      router.replace(loginPathFor(pathname));
    });

    return () => {
      cancelled = true;
    };
  }, [hasToken, router, pathname]);
```

`ready`를 계산하는 자리가 바뀌었으므로 반환문은 그대로 `{ ready, onSessionLost }`다.

- [ ] **Step 6: 단위 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS, 285 tests (283 + 2).

- [ ] **Step 7: 실패하는 e2e를 쓴다 (AC-PWA-11·12·13)**

Modify `frontend/e2e/pwa.spec.ts` — 파일 끝에 더한다.

```ts
test.describe("오프라인 재방문", () => {
  test("AC-PWA-11 · 연 적 있는 레시피가 오프라인에서 열린다", async ({ page, context }) => {
    await installSwStubs(context);
    await installStubs(page);
    await page.goto("/recipes/2");
    await expect(page.getByText("James Hoffmann Ultimate V60")).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByText("James Hoffmann Ultimate V60")).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(7);
  });

  test("AC-PWA-12 · 연 적 없는 레시피는 안내로 떨어진다", async ({ page, context }) => {
    await installSwStubs(context);
    await installStubs(page);
    await page.goto("/recipes/2");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    await context.setOffline(true);
    await page.goto("/recipes/3");

    await expect(page.getByText("연결 없음")).toBeVisible();
  });

  test("AC-PWA-13 · 오프라인 콜드 스타트가 로그인으로 튕기지 않는다", async ({ page, context }) => {
    await installSwStubs(context);
    await installStubs(page);
    await page.goto("/recipes/2");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    await context.setOffline(true);
    await page.reload();
    await page.waitForTimeout(5000);

    expect(new URL(page.url()).pathname).toBe("/recipes/2");
  });
});
```

- [ ] **Step 8: e2e 실행 — 실패 확인**

Run: `cd frontend && pnpm e2e pwa.spec.ts`
Expected: FAIL — 3개. 오프라인 새로고침에서 문서 요청이 실패해 브라우저 오류 페이지가 뜬다(`/recipes/2`의 HTML이 캐시에 없다).

- [ ] **Step 9: sw.js에 앱 셸 캐시를 넣는다**

Modify `frontend/public/sw.js`.

`install`을 `/offline`을 미리 담도록 바꾼다:

```js
const SHELL_CACHE = "kaldi-shell-v1";

self.addEventListener("install", (event) => {
  // /offline은 "네트워크가 없을 때 여는 화면"이라 그때 받아올 수 없다. 설치 시점에 담는다.
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add("/offline"))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});
```

`handleRecipe` 아래에 더한다:

```js
/** 문서. 온라인이면 최신을 받고 담아 두며, 실패하면 담아 둔 것을, 그것도 없으면 /offline을 준다. */
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request.url, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request.url);
    return cached ?? (await cache.match("/offline")) ?? offlineResponse();
  }
}

/** 해시가 박힌 정적 자산. 내용이 바뀌면 이름이 바뀌므로 캐시를 먼저 본다. */
async function handleAsset(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request.url, response.clone());
  return response;
}
```

`fetch` 리스너를 바꾼다:

```js
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (RECIPE_PATH.test(url.pathname)) {
    event.respondWith(handleRecipe(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/")) {
    event.respondWith(handleAsset(request));
  }
});
```

- [ ] **Step 10: e2e 실행 — 통과 확인**

Run: `cd frontend && pnpm e2e pwa.spec.ts`
Expected: PASS, 16 tests.

> AC-PWA-11의 `getByRole("listitem")`이 7이 아니라 더 나오면, 상세 화면에 스텝 말고 다른 목록이 있다는 뜻이다. 그때는 스텝 목록에 붙은 실제 셀렉터로 좁힌다 — **기대값 7을 바꾸지 않는다.** 스펙이 못박은 숫자다.

- [ ] **Step 11: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && cd ..
git add frontend/public/sw.js frontend/src frontend/e2e
git commit -m "feat(web): 오프라인에서 연 적 있는 레시피가 열린다 (AC-PWA 4개)"
```

---

## Task 5: 「연결 없음」 화면

**Files:**
- Create: `frontend/src/lib/offline-cache.ts`
- Create: `frontend/src/app/offline/page.tsx`
- Modify: `frontend/src/test/fixtures.ts`
- Modify: `frontend/e2e/stubs.ts`
- Modify: `frontend/e2e/pwa.spec.ts`

**Covers:** AC-PWA-16, 17, 18

**Interfaces:**
- Produces (`offline-cache.ts`):
  ```ts
  export interface CachedRecipe {
    readonly id: number;
    readonly title: string;
  }
  export function readCachedRecipes(): Promise<CachedRecipe[]>;
  export function clearRecipeCache(): Promise<void>;
  ```
  `caches`가 없는 환경(사파리 사생활 보호 창, 서버)에서는 각각 빈 배열과 즉시 완료를 돌려준다.
- Produces (`fixtures.ts`): `kasuya: Recipe` — id `3`, 제목 `Tetsu Kasuya 4:6 Method`, 스텝 6개.

- [ ] **Step 1: kasuya 상세 픽스처를 실제 응답에서 뜬다**

**지어내지 않는다**(`docs/conventions/frontend.md`「픽스처는 실제 응답에서 뜬다」). 백엔드를 띄우고 실제 응답을 받는다.

```bash
docker compose up -d
cd backend && SPRING_PROFILES_ACTIVE=local ./gradlew bootRun   # 별도 터미널
node scripts/open-as.mjs 11                                     # 토큰이 필요하면
curl -s http://localhost:8080/api/v1/recipes/9 -H "Authorization: Bearer <토큰>" | python3 -m json.tool
```

받은 JSON을 `frontend/src/test/fixtures.ts`에 `kasuyaSteps`와 `kasuya`로 옮긴다. **`id`는 `3`으로 바꾼다** — 픽스처의 `kasuyaSummary`가 이미 3이라 맞춰야 한다. 나머지 값은 손대지 않는다.

```ts
/** Kasuya 4:6 시드의 스텝 6개. **실제 백엔드 응답을 그대로 옮긴 것이다.** */
export const kasuyaSteps: Recipe["steps"] = [
  /* curl 결과의 steps 배열을 그대로 */
];

export const kasuya: Recipe = {
  ...kasuyaSummary,
  authorName: "Tetsu Kasuya",
  sourceUrl: /* curl 결과 그대로 */,
  sourceNote: /* curl 결과 그대로 */,
  steps: kasuyaSteps,
};
```

- [ ] **Step 2: 스텁이 id 3에 kasuya를 주게 한다**

Modify `frontend/e2e/stubs.ts` — `HANDLERS`의 **상세 항목보다 위에** 한 줄을 넣는다. 순서를 지키지 않으면 `/recipes/3`도 hoffmann을 받는다.

```ts
  [/^\/api\/v1\/recipes\/3$/, kasuya],
  [/^\/api\/v1\/recipes\/\d+$/, hoffmann],
```

import에 `kasuya`를 더한다.

- [ ] **Step 3: 실패하는 e2e를 쓴다**

Modify `frontend/e2e/pwa.spec.ts` — 파일 끝에 더한다.

```ts
test.describe("연결 없음 화면", () => {
  test("AC-PWA-16 · 저장된 레시피가 목록으로 나온다", async ({ page, context }) => {
    await installSwStubs(context);
    await installStubs(page);
    await page.goto("/recipes/2");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.goto("/recipes/3");
    await expect(page.getByText("Tetsu Kasuya 4:6 Method")).toBeVisible();

    await context.setOffline(true);
    await page.goto("/offline");

    await expect(page.getByText("James Hoffmann Ultimate V60")).toBeVisible();
    await expect(page.getByText("Tetsu Kasuya 4:6 Method")).toBeVisible();
  });

  test("AC-PWA-17 · 목록의 항목이 실제로 열린다", async ({ page, context }) => {
    await installSwStubs(context);
    await installStubs(page);
    await page.goto("/recipes/3");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    await context.setOffline(true);
    await page.goto("/offline");
    await page.getByRole("link", { name: "Tetsu Kasuya 4:6 Method" }).click();

    await expect.poll(() => new URL(page.url()).pathname).toBe("/recipes/3");
    await expect(page.getByRole("listitem")).toHaveCount(6);
  });

  test("AC-PWA-18 · 캐시가 비면 그렇게 말한다", async ({ page, context }) => {
    await installSwStubs(context);
    await installStubs(page);
    await page.goto("/recipes");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    await context.setOffline(true);
    await page.goto("/offline");

    await expect(page.getByText("저장된 레시피가 없습니다")).toBeVisible();
  });
});
```

- [ ] **Step 4: e2e 실행 — 실패 확인**

Run: `cd frontend && pnpm e2e pwa.spec.ts`
Expected: FAIL — 3개. `/offline`이 404다.

- [ ] **Step 5: 캐시를 읽는 모듈을 쓴다**

Create `frontend/src/lib/offline-cache.ts`:

```ts
/**
 * Service Worker가 쌓아 둔 레시피 캐시를 창(window) 쪽에서 읽고 지운다.
 *
 * <p>SW에 메시지를 보내지 않는다 — Cache Storage는 창에서도 열 수 있어서, 한쪽만 알면 되는
 * 지식을 둘로 나눌 이유가 없다. 캐시 이름은 `public/sw.js`와 **문자열이 같아야 한다.**
 */
const RECIPE_CACHE = "kaldi-recipe-v1";

export interface CachedRecipe {
  readonly id: number;
  readonly title: string;
}

function supported(): boolean {
  return typeof caches !== "undefined";
}

/**
 * 캐시에 실제로 든 레시피만 돌려준다.
 *
 * <p>순서는 Cache Storage가 돌려주는 순서, 즉 넣은 순이다. 본문이 깨진 항목은 조용히 건너뛴다 —
 * 「연결 없음」 화면이 파싱 오류로 통째로 비는 것이 더 나쁘다.
 */
export async function readCachedRecipes(): Promise<CachedRecipe[]> {
  if (!supported()) return [];

  const cache = await caches.open(RECIPE_CACHE);
  const found: CachedRecipe[] = [];

  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (response === undefined) continue;
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "id" in body &&
        "title" in body &&
        typeof body.id === "number" &&
        typeof body.title === "string"
      ) {
        found.push({ id: body.id, title: body.title });
      }
    } catch {
      continue;
    }
  }

  return found;
}

/** 로그아웃에서 쓴다. 캐시가 없어도 오류를 내지 않는다. */
export async function clearRecipeCache(): Promise<void> {
  if (!supported()) return;
  await caches.delete(RECIPE_CACHE);
}
```

- [ ] **Step 6: 「연결 없음」 화면을 쓴다**

Create `frontend/src/app/offline/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readCachedRecipes, type CachedRecipe } from "@/lib/offline-cache";

/**
 * 네트워크가 없을 때 여는 화면.
 *
 * <p><b>세션을 요구하지 않는다.</b> `useRequireSession`을 쓰면 오프라인에서 이 화면조차
 * 로그인으로 튕긴다 — 이 화면이 있는 이유가 사라진다.
 */
export default function OfflinePage() {
  const [recipes, setRecipes] = useState<CachedRecipe[] | null>(null);

  useEffect(() => {
    void readCachedRecipes().then(setRecipes);
  }, []);

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">연결 없음</h1>
      <p className="text-neutral-500 dark:text-neutral-400">
        네트워크에 연결되어 있지 않습니다. 저장된 레시피는 볼 수 있습니다.
      </p>

      {recipes !== null &&
        (recipes.length === 0 ? (
          <p className="text-neutral-500 dark:text-neutral-400">
            저장된 레시피가 없습니다
          </p>
        ) : (
          <ul className="flex flex-col">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <Link
                  href={`/recipes/${recipe.id}`}
                  className="block rounded-lg px-2 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  {recipe.title}
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}
```

- [ ] **Step 7: e2e 실행 — 통과 확인**

Run: `cd frontend && pnpm e2e pwa.spec.ts`
Expected: PASS, 19 tests.

> AC-PWA-17의 `listitem` 6개가 `/offline`의 `<li>`까지 세면 안 된다. 이 단언은 **이동한 뒤** `/recipes/3`에서 재는 것이라 문제 없지만, 숫자가 어긋나면 스텝 목록 셀렉터로 좁힌다.

- [ ] **Step 8: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && cd ..
git add frontend/src frontend/e2e
git commit -m "feat(web): 「연결 없음」 화면이 저장된 레시피를 보여준다 (AC-PWA 3개)"
```

---

## Task 6: 로그아웃하면 캐시를 비운다

**Files:**
- Modify: `frontend/src/app/more/page.tsx`
- Modify: `frontend/e2e/pwa.spec.ts`

**Covers:** AC-PWA-15

**Interfaces:**
- Consumes: Task 5의 `clearRecipeCache(): Promise<void>`.

- [ ] **Step 1: 실패하는 e2e를 쓴다**

Modify `frontend/e2e/pwa.spec.ts` — 파일 끝에 더한다.

```ts
test("AC-PWA-15 · 로그아웃하면 레시피 캐시가 빈다", async ({ page, context }) => {
  await installSwStubs(context);
  await installStubs(page);
  await page.goto("/recipes/2");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(async () => (await recipeCacheKeys(page)).length).toBe(1);

  await page.goto("/more");
  await page.getByRole("button", { name: "로그아웃" }).click();

  await expect.poll(async () => (await recipeCacheKeys(page)).length).toBe(0);
});
```

- [ ] **Step 2: e2e 실행 — 실패 확인**

Run: `cd frontend && pnpm e2e pwa.spec.ts -g "AC-PWA-15"`
Expected: FAIL — 로그아웃 뒤에도 키가 1개다.

- [ ] **Step 3: 로그아웃에 캐시 삭제를 넣는다**

Modify `frontend/src/app/more/page.tsx` — import를 더하고 `logout` 본문을 바꾼다.

```tsx
import { clearRecipeCache } from "@/lib/offline-cache";
```

```tsx
  async function logout() {
    setLoggingOut(true);
    // `/api/auth/logout`은 백엔드가 아니라 Next 라우트 핸들러다. 실패해도 세션을 지우고
    // 나간다 — 로그아웃을 눌렀는데 로그인 상태로 남는 것이 더 나쁘다.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    // 오프라인 캐시에는 남의 비공개 레시피가 될 수 있는 본문이 들어 있다.
    // 계정이 바뀌기 전에 지운다(docs/specs/2026-09-05-web-pwa.md).
    await clearRecipeCache();
    clearSession();
    router.push("/");
  }
```

> **`clearSession()` 안에 넣지 않는다.** 그것은 401을 만났을 때도 불린다(`lib/authed-fetch.ts:37`). 토큰이 만료됐을 뿐인데 오프라인 데이터를 날리게 된다.

- [ ] **Step 4: e2e 실행 — 통과 확인**

Run: `cd frontend && pnpm e2e pwa.spec.ts`
Expected: PASS, 20 tests.

- [ ] **Step 5: 스펙 status를 올린다**

Modify `docs/specs/2026-09-05-web-pwa.md` — `status: 초안` → `status: 구현완료`, `plan: docs/plans/2026-09-05-plan-web-pwa.md`.

**남은 수동 확인 4개는 전부 비차단형이다**(폰 실물 설치와 마스킹 확인). `docs/conventions/verification.md`「비차단형만 남아 `구현완료`로 올릴 때」에 따라 스펙의 수동 확인 절에 남은 개수와 내용을 인용 블록으로 적는다.

- [ ] **Step 6: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e && cd ..
./scripts/check-spec-coverage.sh
git add frontend/src frontend/e2e docs/specs/2026-09-05-web-pwa.md
git commit -m "feat(web): 로그아웃하면 오프라인 캐시를 비운다 (AC-PWA-15)"
```

---

## 완료 기준

- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과
- [ ] `cd frontend && pnpm e2e` 통과 — `pwa.spec.ts` 20개 포함
- [ ] `./scripts/check-spec-coverage.sh` 통과 — AC 604 + 21 = **625개**
- [ ] `git diff --stat main...HEAD`에 `backend/`가 **0줄**
- [ ] `frontend/package.json`의 의존성이 **늘지 않았다**
- [ ] 스펙의 `status`를 `구현완료`로 변경 (남은 수동 확인 4개는 비차단형)
- [ ] 스펙 「수동 확인」 4개 완료

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC **21개** 중 **21개**가 태스크에 매핑됐다. 위 매핑 표와 스펙의 `#### AC-PWA-` 개수를 세어 대조했다.

**자리표시자 검사:** `TODO`·`TBD`·「나중에」·「비슷하게」 없음. 다만 Task 5 Step 1의 `kasuyaSteps` 본문은 **일부러 비워 뒀다** — 실제 백엔드 응답을 떠서 채우라는 지시이고, 여기에 값을 적으면 그것이 곧 지어낸 픽스처가 된다(`frontend/CLAUDE.md`가 금지하는 것).

**타입 일관성:**
- `RefreshResult`는 Task 4에서 정의하고 `authed-fetch.ts`·`useRequireSession.ts` 두 곳에서 같은 이름으로 쓴다.
- `clearRecipeCache`·`readCachedRecipes`는 Task 5에서 정의하고 Task 6이 `clearRecipeCache`만 쓴다. 이름이 갈리지 않는다.
- 캐시 이름 문자열 `kaldi-recipe-v1`은 `public/sw.js`·`src/lib/offline-cache.ts`·`e2e/pwa.spec.ts` **세 곳**에 리터럴로 박힌다. `sw.js`가 번들을 안 거쳐 상수를 공유할 수 없기 때문이다. 셋 중 하나만 바꾸면 조용히 어긋난다.

**검증되지 않은 가정:**
- **Service Worker가 보낸 요청이 Playwright의 `context.route`에 걸리는가.** 이 계획의 절반이 여기 달렸다. Task 3 Step 1이 **다른 어떤 코드를 쓰기 전에** 이것부터 잰다. 빨가면 멈추고 계획을 고친다.
- **`public/manifest.json`의 `Content-Type`이 `application/manifest+json`인가.** Next의 `start`와 Cloudflare Workers가 각각 정한다. Task 1 Step 8에 어긋났을 때의 대안(`src/app/manifest.ts`로 이전)을 적어 뒀다.
- **오프라인 새로고침에서 Next의 RSC 페이로드 요청이 문서 캐시만으로 충분한가.** App Router는 문서 외에 `?_rsc=` 요청을 보낼 수 있다. Task 4 Step 10이 빨가면 `handleAsset`의 조건을 `/_next/` 대신 「같은 오리진의 GET 전부」로 넓힌다.
- **`getByRole("listitem")`이 스텝만 세는가.** 상세 화면에 다른 목록이 있으면 7·6이 안 맞는다. Task 4 Step 10과 Task 5 Step 7에 대응을 적어 뒀다 — **기대 숫자는 바꾸지 않는다.**

**확인해서 지운 가정:**

- **`e2e`가 CI에서 도는가 — 2026-09-05에 확인했다. 돈다.** `.github/workflows/frontend.yml:91`에 `pnpm e2e`가 있고 Playwright 브라우저 캐시 단계까지 갖춰져 있다. **워크플로를 손댈 필요가 없다** — 계획에 워크플로 태스크를 더하지 않는다.

# 웹 헤더를 홈 밖 화면에도 적용 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-20-web-header-rollout.md`

**Goal:** `BottomNav`가 보이는 화면 전부(`/recipes`·`/brews`·`/recipes/[id]`·`/brews/[id]`·`/more`·`/gear/grind-converter`)에서 `<1100px`이면 로고 헤더가, `≥1100px`이면 네비·CTA·아바타를 포함한 전체 헤더가 보인다. 로그인·작성·편집 화면에는 없다.

**Architecture:** `WebTopBar`를 홈 페이지 전용 컴포넌트에서 **전역 컴포넌트**로 바꾼다 — `page.tsx`가 아니라 `layout.tsx`에 `BottomNav`와 같은 자리에 한 번만 둔다. `props`로 `me`를 받던 것을 그만두고 `usePathname()` + `useMe()`를 스스로 부른다. 어느 화면에서 숨을지(`isHidden`)와 어느 네비 링크가 활성인지(`isActive`)는 `BottomNav`와 같은 규칙이므로 `lib/navScreens.ts`로 뽑아 공유한다.

**핵심 관찰:** Tailwind의 `hidden`(`display:none`)은 그 서브트리를 접근성 트리에서 완전히 뺀다. 그래서 `<1100px`에서 네비 링크(`홈`·`레시피`·`기록`)가 DOM에는 있어도 `getByRole`로는 안 잡힌다 — 기본 뷰포트(360px)로 도는 기존 e2e 테스트 대부분은 이 헤더가 추가돼도 영향받지 않는다. **예외**는 이미 `header`로 스코프를 좁혀둔 홈 관련 테스트들뿐이다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-WEBHDR-01 | 대상 화면 전부 `<1100px`에도 로고 헤더 | Task 2 | e2e |
| AC-WEBHDR-02 | 그 헤더에 네비·CTA·아바타 없음 | Task 2 | e2e |
| AC-WEBHDR-03 | `≥1100px`에 네비·CTA·아바타 모두 | Task 2 | e2e |
| AC-WEBHDR-04 | `/recipes`에서 「레시피」가 감전다 | Task 2 | e2e |
| AC-WEBHDR-05 | `/brews`에서 「기록」이 감전다 | Task 2 | e2e |
| AC-WEBHDR-06 | `me` 로딩 중엔 아바타만 빈다 | Task 3 | e2e |
| AC-WEBHDR-07 | `≥1100px`에서 대상 화면 전부 하단 탭바 숨음 | Task 4 | e2e |
| AC-WEBHDR-08 | `1100px`은 전체 헤더 쪽 | Task 2 | e2e |
| AC-WEBHDR-09 | `1099px`은 로고만 | Task 2 | e2e |
| AC-WEBHDR-10 | 제외 화면엔 헤더 없음 | Task 2 | e2e |

---

## Global Constraints

- 백엔드 변경 0건.
- 새 브레이크포인트를 만들지 않는다 — 기존 `1100px`을 그대로 쓴다.
- CTA는 화면마다 다르게 만들지 않는다 — `기록하기` → `/recipes`로 통일.
- `WebTopBar`는 `me`를 prop으로 받지 않는다 — 전역 컴포넌트이므로 스스로 `useMe()`를 부른다.

## File Structure

```
frontend/src/
├── lib/navScreens.ts                       (신규) isHidden·isActive 공유 로직
├── lib/navScreens.test.ts                  (신규)
├── components/layout/
│   ├── BottomNav.tsx                       (수정) navScreens 재사용, 숨김 규칙 일반화
│   ├── WebTopBar.tsx                       (수정) 전역화, 활성 네비, 아바타 로딩 처리
│   └── WebTopBar.test.tsx                  (신규) 컴포넌트 단위 테스트
├── app/
│   ├── layout.tsx                          (수정) WebTopBar를 여기서 렌더
│   └── page.tsx                            (수정) WebTopBar 직접 렌더 제거
└── e2e/web-header-rollout.spec.ts          (신규) AC-WEBHDR-01~10
```

---

## Task 1: 공용 네비게이션 판정 로직 추출

**Files:**
- Create: `frontend/src/lib/navScreens.ts`
- Test: `frontend/src/lib/navScreens.test.ts`
- Modify: `frontend/src/components/layout/BottomNav.tsx` (동작 변화 없이 재사용만)

**Covers:** (직접 AC 없음 — Task 2·4가 공유하는 하부 로직)

**Interfaces:**
- Produces: `isHidden(pathname: string): boolean`, `isActive(href: string, pathname: string): boolean`

- [x] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from "vitest";
import { isActive, isHidden } from "./navScreens";

describe("isHidden", () => {
  it("로그인·작성·편집 화면은 숨긴다", () => {
    expect(isHidden("/login")).toBe(true);
    expect(isHidden("/auth/callback")).toBe(true);
    expect(isHidden("/recipes/new")).toBe(true);
    expect(isHidden("/brews/new")).toBe(true);
    expect(isHidden("/recipes/12/edit")).toBe(true);
    expect(isHidden("/brews/2/edit")).toBe(true);
  });

  it("목록·상세·더보기는 숨기지 않는다", () => {
    expect(isHidden("/")).toBe(false);
    expect(isHidden("/recipes")).toBe(false);
    expect(isHidden("/recipes/12")).toBe(false);
    expect(isHidden("/brews/2")).toBe(false);
    expect(isHidden("/more")).toBe(false);
    expect(isHidden("/gear/grind-converter")).toBe(false);
  });
});

describe("isActive", () => {
  it("홈은 정확히 일치할 때만 켜진다", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/recipes")).toBe(false);
  });

  it("나머지는 접두어로 켜진다", () => {
    expect(isActive("/recipes", "/recipes")).toBe(true);
    expect(isActive("/recipes", "/recipes/12")).toBe(true);
    expect(isActive("/recipes", "/brews")).toBe(false);
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- navScreens`
Expected: FAIL — `navScreens.ts`가 없다

- [x] **Step 3: 최소 구현**

```ts
/**
 * 탭바를 감추는 경로. 로그인·콜백은 세션이 없는 화면이고, 나머지는 저장하지 않으면
 * 사라질 입력을 들고 있는 작성 화면이다. 편집 화면은 `/edit`로 끝나는 것으로 판정한다.
 */
const HIDDEN_PREFIXES = ["/login", "/auth", "/recipes/new", "/brews/new"];

export function isHidden(pathname: string): boolean {
  return (
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname.endsWith("/edit")
  );
}

/** 홈은 완전 일치일 때만 켜진다. 접두어로 보면 모든 경로에서 켜진다. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

`BottomNav.tsx`에서 로컬 `isHidden`/`isActive` 정의를 지우고 `@/lib/navScreens`에서 가져온다 — 동작은 바뀌지 않는다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test`
Expected: PASS, 전체 통과(BottomNav.test.tsx 포함, 회귀 없음)

- [x] **Step 5: 커밋**

```bash
pnpm lint && pnpm typecheck
git add src/lib/navScreens.ts src/lib/navScreens.test.ts src/components/layout/BottomNav.tsx
git commit -m "refactor(web): 탭바 숨김·활성 판정을 공유 모듈로 뽑는다"
```

---

## Task 2: WebTopBar를 전역화하고 활성 네비를 추가한다

**Files:**
- Modify: `frontend/src/components/layout/WebTopBar.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/page.tsx`
- Create: `frontend/src/components/layout/WebTopBar.test.tsx`
- Create: `frontend/e2e/web-header-rollout.spec.ts`

**Covers:** AC-WEBHDR-01, AC-WEBHDR-02, AC-WEBHDR-03, AC-WEBHDR-04, AC-WEBHDR-05, AC-WEBHDR-08, AC-WEBHDR-09, AC-WEBHDR-10

**Interfaces:**
- Consumes: `isHidden`, `isActive` (Task 1)

- [x] **Step 1: 실패하는 테스트 작성**

`e2e/web-header-rollout.spec.ts` (신규 파일):

```ts
import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

const TARGET_PAGES = [
  "/recipes",
  "/recipes/12",
  "/brews",
  "/brews/2",
  "/more",
  "/gear/grind-converter",
];

const EXCLUDED_PAGES = [
  "/login",
  "/recipes/new",
  "/brews/new?recipeId=12",
  "/recipes/12/edit",
  "/brews/2/edit",
];

test.describe("웹 헤더 롤아웃", () => {
  for (const path of TARGET_PAGES) {
    test(`AC-WEBHDR-01 · ${path}에 로고 헤더가 보인다(<1100px)`, async ({
      page,
    }) => {
      await installStubs(page);
      await page.goto(path);

      const header = page.locator("header");
      await expect(header.locator("svg")).toBeVisible();
      await expect(header.getByText("kaldi")).toBeVisible();
    });
  }

  test("AC-WEBHDR-02 · <1100px에서는 네비·CTA·아바타가 없다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "홈" })).toBeHidden();
    await expect(header.getByRole("link", { name: "기록하기" })).toBeHidden();
    await expect(header.getByRole("link", { name: "더보기" })).toBeHidden();
  });

  test("AC-WEBHDR-03 · ≥1100px에서는 네비·CTA·아바타가 모두 보인다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/recipes");

    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "홈" })).toBeVisible();
    await expect(header.getByRole("link", { name: "레시피" })).toBeVisible();
    await expect(
      header.getByRole("link", { name: "기록", exact: true }),
    ).toBeVisible();
    const cta = header.getByRole("link", { name: "기록하기" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/recipes");
    await expect(header.getByRole("link", { name: "더보기" })).toBeVisible();
  });

  test("AC-WEBHDR-04 · /recipes에서는 「레시피」만 감전다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/recipes");

    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "레시피" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(header.getByRole("link", { name: "홈" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  test("AC-WEBHDR-05 · /brews에서는 「기록」이 감전다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/brews");

    const header = page.locator("header");
    await expect(
      header.getByRole("link", { name: "기록", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("AC-WEBHDR-08 · 1100px은 전체 헤더 쪽이다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto("/recipes");

    await expect(
      page.locator("header").getByRole("link", { name: "레시피" }),
    ).toBeVisible();
  });

  test("AC-WEBHDR-09 · 1099px은 로고만 보이는 쪽이다", async ({ page }) => {
    await installStubs(page);
    await page.setViewportSize({ width: 1099, height: 900 });
    await page.goto("/recipes");

    const header = page.locator("header");
    await expect(header.locator("svg")).toBeVisible();
    await expect(header.getByRole("link", { name: "레시피" })).toBeHidden();
  });

  for (const path of EXCLUDED_PAGES) {
    test(`AC-WEBHDR-10 · ${path}에는 헤더가 없다`, async ({ page }) => {
      await installStubs(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(path);

      await expect(page.locator("header")).toHaveCount(0);
    });
  }
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm e2e -- web-header-rollout`
Expected: FAIL — `/recipes` 등에는 아직 `header`가 전혀 없다

- [x] **Step 3: 최소 구현**

`WebTopBar.tsx` 전체를 다시 쓴다:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/features/user/queries";
import { isActive, isHidden } from "@/lib/navScreens";
import { Avatar, ButtonLink } from "@/components/ui";

const NAV_LINKS = [
  { href: "/", label: "홈" },
  { href: "/recipes", label: "레시피" },
  { href: "/brews", label: "기록" },
];

/**
 * 전역 상단 헤더. `BottomNav`가 보이는 화면 전부에 뜬다.
 * 로고+워드마크는 모든 폭에서, 네비·CTA·아바타는 `≥1100px`에서만 보인다.
 *
 * <p>2026-09-20 갱신: 홈 전용 컴포넌트였다가 `layout.tsx`로 옮겨 전역화했다
 * (docs/specs/2026-09-20-web-header-rollout.md). `me`를 prop으로 받지 않고
 * 스스로 `useMe()`를 부른다 — 화면마다 그 값을 물어다 줄 필요가 없어진다.
 *
 * <p>로고는 SVG를 파일로 참조하지 않고 인라인한다 — `<img src>`로 불러오면
 * `currentColor`가 상속되지 않아 다크 모드에서 심볼이 고정색으로 남는다.
 */
export function WebTopBar() {
  const pathname = usePathname();
  const me = useMe();

  if (isHidden(pathname)) return null;

  return (
    <header className="flex items-center justify-between gap-6 border-b border-border bg-paper px-6 py-3">
      <Link href="/" className="flex min-h-11 items-center gap-2">
        <LogoSymbol />
        <span className="text-card-title font-semibold tracking-[-0.03em]">
          kaldi<span className="text-accent-soft">·</span>note
        </span>
      </Link>
      <div className="hidden min-[1100px]:flex items-center gap-6">
        <nav className="flex items-center gap-4 text-body">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href, pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={active ? "font-semibold text-accent" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-4">
          <ButtonLink href="/recipes" variant="primary">
            기록하기
          </ButtonLink>
          {me.data && (
            <Link href="/more" aria-label="더보기">
              <Avatar
                nickname={me.data.nickname}
                profileImageUrl={me.data.profileImageUrl}
                size={36}
              />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function LogoSymbol() {
  return (
    <svg
      viewBox="0 0 26 26"
      width="26"
      height="26"
      role="img"
      aria-label="kaldi-note"
      className="text-ink"
    >
      <circle cx="13" cy="13" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="13" cy="13" r="4" fill="currentColor" />
    </svg>
  );
}
```

`layout.tsx`에 추가:

```tsx
import { WebTopBar } from "@/components/layout/WebTopBar";
// ...
<Providers>
  <WebTopBar />
  {children}
  <BottomNav />
  <ServiceWorkerRegistrar />
</Providers>
```

`page.tsx`에서 `<WebTopBar me={me.data} />` 줄과 그 import를 지운다. 그 한 줄만 감싸던 바깥 `<>...</>` 프래그먼트도 더 필요 없으면 `<Shell>`을 바로 반환한다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e -- web-header-rollout` 그리고 `pnpm e2e -- home-calendar`(회귀 확인)
Expected: PASS 전부

- [x] **Step 5: 커밋**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add src/components/layout/WebTopBar.tsx src/app/layout.tsx src/app/page.tsx e2e/web-header-rollout.spec.ts
git commit -m "feat(web): 로고 헤더를 전역화하고 활성 네비를 추가한다 (AC-WEBHDR-01~05·08~10)"
```

---

## Task 3: `me` 로딩 중 아바타 빈자리 처리

**Files:**
- Test: `frontend/src/components/layout/WebTopBar.test.tsx`, `frontend/e2e/web-header-rollout.spec.ts`

**Covers:** AC-WEBHDR-06

**Interfaces:**
- 없음 — Task 2에서 이미 `{me.data && (...)}` 가드를 넣었으므로, 이 태스크는 그 동작을 **검증**하는 것이 전부다.

- [x] **Step 1: 실패하는 테스트 작성**

`e2e/web-header-rollout.spec.ts`에 추가. `installStubs` 뒤에 `/users/me`만 늦추는 로컬 헬퍼(다른 파일의 `delay()`와 동일 패턴)를 쓴다:

```ts
async function delayMe(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/users/me", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ json: me });
  });
}
```

(파일 상단에 `import { me } from "../src/test/fixtures";` 추가)

```ts
test("AC-WEBHDR-06 · me가 로딩 중이어도 헤더는 보이고 아바타 자리만 빈다", async ({
  page,
}) => {
  await installStubs(page);
  await delayMe(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/recipes");

  const header = page.locator("header");
  await expect(header.locator("svg")).toBeVisible();
  await expect(header.getByRole("link", { name: "더보기" })).toBeHidden();

  await expect(header.getByRole("link", { name: "더보기" })).toBeVisible();
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm e2e -- web-header-rollout`
Expected: PASS — Task 2에서 이미 가드를 넣었으므로 사실 이 단계에서 이미 통과할 가능성이 높다.
이 경우 **Step 3(구현)을 건너뛰고 테스트만으로 회귀를 잠근다** — 코드를 추가로 바꾸지 않는다.

- [x] **Step 3: 최소 구현 (필요시)**

Step 2에서 이미 통과했다면 이 단계는 없음.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e -- web-header-rollout`
Expected: PASS, 전체 통과

- [x] **Step 5: 커밋**

```bash
git add e2e/web-header-rollout.spec.ts
git commit -m "test(web): me 로딩 중 아바타 빈자리를 회귀로 잠근다 (AC-WEBHDR-06)"
```

---

## Task 4: 하단 탭바 숨김 규칙을 모든 대상 화면으로 일반화

**Files:**
- Modify: `frontend/src/components/layout/BottomNav.tsx`
- Test: `frontend/e2e/web-header-rollout.spec.ts`

**Covers:** AC-WEBHDR-07

- [x] **Step 1: 실패하는 테스트 작성**

```ts
test("AC-WEBHDR-07 · ≥1100px에서는 대상 화면 전부에서 하단 탭바가 숨는다", async ({
  page,
}) => {
  await installStubs(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const path of ["/recipes", "/brews", "/more"]) {
    await page.goto(path);
    await expect(page.locator("nav[aria-label='주요 화면']")).toBeHidden();
  }
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm e2e -- web-header-rollout`
Expected: FAIL — `/recipes`·`/brews`·`/more`에서는 지금 `hideOnWideHome`이 `""`(홈이 아니므로)라 하단 탭바가 그대로 보인다

- [x] **Step 3: 최소 구현**

`BottomNav.tsx`에서 `pathname === "/"` 조건을 없애고, `isHidden`으로 걸러진 뒤에는 항상 `min-[1100px]:hidden`을 붙인다:

```tsx
export function BottomNav() {
  const pathname = usePathname();
  if (isHidden(pathname)) return null;

  return (
    <nav
      aria-label="주요 화면"
      className="mt-auto sticky bottom-0 z-10 grid grid-cols-4 border-t border-border bg-paper min-[1100px]:hidden"
    >
      {TABS.map((tab) => {
        const active = isActive(tab.href, pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`py-3 text-center text-body ${active ? "font-semibold text-accent" : "text-ink-3"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

(이 지점에 도달했다는 것은 이미 대상 화면이라는 뜻이므로 `pathname === "/"` 분기가 더 필요 없다.)

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e -- web-header-rollout` 그리고 `pnpm e2e`(전체)
Expected: PASS 전부

- [x] **Step 5: 커밋**

```bash
pnpm lint && pnpm typecheck
git add src/components/layout/BottomNav.tsx e2e/web-header-rollout.spec.ts
git commit -m "feat(web): 하단 탭바가 대상 화면 전부에서 1100px 이상일 때 숨는다 (AC-WEBHDR-07)"
```

---

## 완료 기준

- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 전부 통과
- [x] `pnpm test:worker` 통과
- [x] `pnpm e2e` 전체 통과 (신규 + 기존 회귀)
- [x] `(cd .. && ./scripts/check-spec-coverage.sh)` 통과
- [x] 스펙의 `status`를 `구현완료`로 변경
- [x] 수동 확인 없음(전부 자동화됨)

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 10개 중 10개가 태스크에 매핑됨.

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음.

**타입 일관성:** `WebTopBar`가 더 이상 `me` prop을 받지 않는 것이 `page.tsx`의 유일한 호출부 변경이다 — 다른 소비자가 없다(사전 조사에서 확인).

**검증되지 않은 가정:**
- `hidden`(`display:none`)이 접근성 트리를 실제로 완전히 비우는지는 Task 2의 e2e(특히 AC-WEBHDR-02·09에서 `toBeHidden()`이 strict-mode 충돌 없이 통과하는지)로 확인한다. 어긋나면 그 지점에서 개별 테스트에 `header` 스코프를 추가한다.

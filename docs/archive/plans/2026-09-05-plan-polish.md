# 마감 결함 구현 계획 — 폰트·로딩 표시·잔재

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-05-polish.md`

**Goal:** 폰트가 정해지고, 로딩 중 흰 화면이 사라지고, 잔재가 없어진다.

**Architecture:** 새 기능이 없다. **셋은 서로 독립이라 태스크 순서를 바꿔도 된다.** 로딩 표시만 구조가 있다 — 컴포넌트 하나(`LoadingState`)를 만들고 10곳의 `<Shell>{null}</Shell>`를 `<Shell><LoadingState /></Shell>`로 바꾼다. **각 화면의 `Shell`은 파일마다 따로 정의돼 있고 제목·헤더를 품고 있으므로**, 이렇게 하면 헤더는 그대로 남고 본문 자리에만 표시가 들어간다 — 맨 스피너보다 낫다.

**작업 위치:** `frontend/` 전용. **백엔드 변경 0줄.**

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-POLISH-01 | 폰트 스택이 적용된다 | Task 1 | e2e |
| AC-POLISH-02 | 숫자가 자릿수 정렬된다 | Task 1 | e2e |
| AC-POLISH-03 | 죽은 변수 참조 0건 | Task 1 | 단위 |
| AC-POLISH-04 | 199ms엔 안 뜬다 | Task 2 | 단위 |
| AC-POLISH-05 | 200ms에 뜬다 (경계) | Task 2 | 단위 |
| AC-POLISH-06 | role=status·`불러오는 중` | Task 2 | 단위 |
| AC-POLISH-07 | `<Shell>{null}</Shell>` 0건 | Task 2 | 단위 |
| AC-POLISH-08 | 홈에서 뜬다 | Task 2 | e2e |
| AC-POLISH-09 | 레시피 상세에서 뜬다 | Task 2 | e2e |
| AC-POLISH-10 | Next 기본 SVG 없음 | Task 3 | 단위 |
| AC-POLISH-11 | `/icon.svg`가 열린다 | Task 3 | e2e |
| AC-POLISH-12 | `<link rel="icon">` 1개 | Task 3 | e2e |

**스펙의 AC 12개 중 12개가 매핑됐다.**

---

## Global Constraints

- **백엔드를 건드리지 않는다.** `git diff --stat main...HEAD`에 `backend/`가 나오면 설계가 어긋난 것이다.
- **새 의존성을 넣지 않는다.** 웹폰트도 스피너 라이브러리도 없다.
- **레이아웃과 간격을 조정하지 않는다.** 폰트가 바뀌면 인상이 달라진다 — 그 뒤에 판단한다(스펙의 범위 밖).
- **색을 새로 만들지 않는다.** `neutral` 계열 안에서 해결한다(스펙의 범위 밖).
- **각 화면의 `Shell`을 공통화하지 않는다.** 10개가 서로 다른 헤더를 품고 있다. 합치는 것은 리팩터링이고 이 계획에 없다.
- **`any` 금지, `as` 단언 금지, `!` 금지.**
- **`Write` 전에 파일이 있는지 본다.** 2026-09-02에 계획이 `Create`로 적은 파일이 이미 있어 기존 테스트 11개를 덮어썼다.
- 커밋 전 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. e2e를 건드린 태스크는 `pnpm e2e`도.

---

## File Structure

```
frontend/
├── public/
│   ├── file.svg                                Delete
│   ├── globe.svg                               Delete
│   ├── next.svg                                Delete
│   ├── vercel.svg                              Delete
│   └── window.svg                              Delete
├── src/
│   ├── app/
│   │   ├── globals.css                         Modify — 폰트 스택·tabular-nums
│   │   ├── icon.svg                            Create — 파비콘
│   │   ├── page.tsx                            Modify ─┐
│   │   ├── brews/page.tsx                      Modify  │
│   │   ├── gear/grind-converter/page.tsx       Modify  │ <Shell>{null}</Shell> →
│   │   ├── more/page.tsx                       Modify  │ <Shell><LoadingState /></Shell>
│   │   └── recipes/new/page.tsx                Modify  │
│   ├── features/                                        │
│   │   ├── brewlog/components/BrewLogForm.tsx  Modify  │
│   │   ├── brewlog/components/BrewDetail.tsx   Modify  │
│   │   ├── brewlog/components/BrewLogEditor.tsx Modify │
│   │   ├── recipe/components/RecipeEditor.tsx  Modify  │
│   │   └── recipe/components/RecipeDetail.tsx  Modify ─┘
│   ├── components/
│   │   ├── LoadingState.tsx                    Create
│   │   └── LoadingState.test.tsx               Create
│   └── test/polish.test.ts                     Create — 소스 검사 3개
└── e2e/polish.spec.ts                          Create

docs/specs/2026-09-05-polish.md                 Modify — status
```

---

## Task 1: 폰트

**Files:**
- Modify: `frontend/src/app/globals.css`
- Create: `frontend/src/test/polish.test.ts`
- Create: `frontend/e2e/polish.spec.ts`

**Covers:** AC-POLISH-01, 02, 03

**Interfaces:**
- Produces: `body`의 `font-family`와 `font-variant-numeric`. 다른 태스크가 쓰지 않는다.

- [x] **Step 1: 시작 전 초록을 확인한다**

Run: `cd frontend && pnpm test && pnpm e2e`
Expected: PASS. **두 숫자를 적어둔다**(단위 283개).

- [x] **Step 2: 실패하는 테스트 작성**

Create `frontend/e2e/polish.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

/** 브라우저가 따옴표를 정규화하므로 이름 단위로 순서를 본다. */
const FONT_STACK = [
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Roboto",
  "Apple SD Gothic Neo",
  "Noto Sans KR",
  "Malgun Gothic",
  "sans-serif",
];

test.describe("폰트", () => {
  test("AC-POLISH-01 · 지정한 폰트 스택이 적용된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const family = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    );
    const names = family.split(",").map((n) => n.trim().replace(/^["']|["']$/g, ""));
    expect(names).toEqual(FONT_STACK);
  });

  test("AC-POLISH-02 · 숫자가 자릿수 정렬된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const variant = await page.evaluate(
      () => getComputedStyle(document.body).fontVariantNumeric,
    );
    expect(variant).toBe("tabular-nums");
  });
});
```

Create `frontend/src/test/polish.test.ts`:

```ts
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
```

- [x] **Step 3: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test polish && pnpm e2e polish.spec.ts`
Expected: FAIL — 3개. `fontFamily`가 `Arial, Helvetica, sans-serif`이고, `fontVariantNumeric`이 `normal`이며, `globals.css`에 `--font-geist-sans`가 있다.

- [x] **Step 4: 최소 구현**

Modify `frontend/src/app/globals.css`:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /*
   * 웹폰트를 받지 않는다. 부엌에서 폰으로, 느린 회선에서 쓰는 것이 주 환경이라
   * 0바이트·즉시 렌더가 실질 이득이 크다(docs/specs/2026-09-05-polish.md).
   */
  --font-sans:
    system-ui, -apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo",
    "Noto Sans KR", "Malgun Gothic", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

`body`를 바꾼다:

```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  /* 이 앱은 숫자가 주인공이다. 자릿수가 정렬돼야 목록에서 값이 흔들리지 않는다. */
  font-variant-numeric: tabular-nums;
}
```

> **`--font-geist-sans`와 `--font-geist-mono` 참조를 지운다.** 정의된 적이 없다.

- [x] **Step 5: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test polish && pnpm e2e polish.spec.ts`
Expected: PASS, 3 tests.

> `fontFamily` 문자열이 기대와 다르게 나오면 **브라우저가 정규화한 실제 값을 먼저 찍어보고** `FONT_STACK`을 그 값에 맞춘다 — `globals.css`를 비틀지 않는다.

- [x] **Step 6: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && cd ..
git add frontend/src/app/globals.css frontend/src/test frontend/e2e
git commit -m "fix(web): 적용된 적 없던 폰트를 정한다 — 시스템 스택과 자릿수 정렬 (AC-POLISH 3개)"
```

---

## Task 2: 로딩 표시

**Files:**
- Create: `frontend/src/components/LoadingState.tsx`
- Create: `frontend/src/components/LoadingState.test.tsx`
- Modify: 10개 화면 파일 (File Structure 참조)
- Modify: `frontend/src/test/polish.test.ts`
- Modify: `frontend/e2e/polish.spec.ts`

**Covers:** AC-POLISH-04, 05, 06, 07, 08, 09

**Interfaces:**
- Produces: `LoadingState(): JSX.Element | null` — props 없음. **마운트 후 200ms가 지나야 그린다.** 그 전에는 `null`이다.

- [x] **Step 1: 실패하는 테스트 작성**

Create `frontend/src/components/LoadingState.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoadingState } from "./LoadingState";

describe("LoadingState", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("AC-POLISH-04 · 199ms까지는 한 번도 뜨지 않는다", () => {
    render(<LoadingState />);

    act(() => {
      vi.advanceTimersByTime(199);
    });

    expect(screen.queryByText("불러오는 중")).not.toBeInTheDocument();
  });

  it("AC-POLISH-05 · 200ms가 지나면 뜬다", () => {
    render(<LoadingState />);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText("불러오는 중")).toBeInTheDocument();
  });

  it("AC-POLISH-06 · role이 status이고 이름이 불러오는 중이다", () => {
    render(<LoadingState />);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole("status", { name: "불러오는 중" })).toBeInTheDocument();
  });
});
```

Modify `frontend/src/test/polish.test.ts` — `describe` 안에 더한다:

```ts
  it("AC-POLISH-07 · 빈 화면을 그리는 곳이 없다", () => {
    // <Shell>{null}</Shell>는 로딩 중 흰 화면만 남긴다. 10곳이 그랬다.
    const offenders = SOURCES.filter((path) =>
      readFileSync(path, "utf8").includes("<Shell>{null}</Shell>"),
    );
    expect(offenders).toEqual([]);
  });
```

Modify `frontend/e2e/polish.spec.ts` — 파일 끝에 더한다:

```ts
import { brewLogPage, hoffmann } from "../src/test/fixtures";
import type { Page, Route } from "@playwright/test";

/** 응답을 늦춘다. installStubs 뒤에 걸어야 이긴다. */
async function delay(page: Page, pattern: string, ms: number, body: unknown) {
  await page.route(pattern, async (route: Route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.fulfill({ json: body });
  });
}

test.describe("로딩 표시", () => {
  test("AC-POLISH-08 · 홈에서 느린 응답이면 뜬다", async ({ page }) => {
    await installStubs(page);
    await delay(page, "**/api/v1/brew-logs*", 1500, brewLogPage);

    await page.goto("/");

    await expect(page.getByRole("status", { name: "불러오는 중" })).toBeVisible();
  });

  test("AC-POLISH-09 · 레시피 상세에서 느린 응답이면 뜬다", async ({ page }) => {
    await installStubs(page);
    await delay(page, "**/api/v1/recipes/2", 1500, hoffmann);

    await page.goto("/recipes/2");

    await expect(page.getByRole("status", { name: "불러오는 중" })).toBeVisible();
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test LoadingState polish`
Expected: FAIL — `LoadingState` 모듈이 없고, `polish.test.ts`가 10개 파일을 offender로 잡는다.

- [x] **Step 3: 컴포넌트를 만든다**

Create `frontend/src/components/LoadingState.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

/** 이 값보다 빨리 끝나는 응답에서는 아무것도 그리지 않는다. */
const SHOW_AFTER_MS = 200;

/**
 * 로딩 중 표시.
 *
 * <p><b>즉시 그리지 않는 이유:</b> 빠른 응답에서 흰 화면 → 표시 → 콘텐츠로 세 번 바뀌면 빈 화면보다
 * 나빠 보인다. 200ms를 넘겨 실제로 기다리게 될 때만 나타난다
 * (docs/specs/2026-09-05-polish.md).
 */
export function LoadingState() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="불러오는 중"
      className="flex items-center justify-center py-12"
    >
      <span
        aria-hidden="true"
        className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100"
      />
      <span className="sr-only">불러오는 중</span>
    </div>
  );
}
```

> `aria-label`과 `sr-only` 텍스트를 **둘 다** 둔다. 전자는 `getByRole("status", { name })`이, 후자는 `getByText("불러오는 중")`이 잡는다 — AC-04·05가 텍스트로, AC-06이 역할로 본다.

- [x] **Step 4: 10곳을 바꾼다**

각 파일에서 `return <Shell>{null}</Shell>;`를 찾아 바꾼다.

```tsx
    return (
      <Shell>
        <LoadingState />
      </Shell>
    );
```

import를 더한다: `import { LoadingState } from "@/components/LoadingState";`

**대상 10곳** — `app/page.tsx` · `app/brews/page.tsx` · `app/gear/grind-converter/page.tsx` · `app/more/page.tsx` · `app/recipes/new/page.tsx` · `features/brewlog/components/BrewLogForm.tsx` · `features/brewlog/components/BrewDetail.tsx` · `features/brewlog/components/BrewLogEditor.tsx` · `features/recipe/components/RecipeEditor.tsx` · `features/recipe/components/RecipeDetail.tsx`

> **`app/recipes/page.tsx`의 `Shell`은 인자가 다르다**(`function Shell({` 뒤에 줄바꿈). 그 파일에는 `<Shell>{null}</Shell>`가 없으므로 **손대지 않는다.** AC-POLISH-07의 검색이 이것을 확인해 준다.

- [x] **Step 5: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS. 283 + 1(AC-03) + 3(LoadingState) + 1(AC-07) = **288개**.

> **기존 화면 테스트가 깨질 수 있다.** 로딩 중을 `container.firstChild === null`로 단언한 테스트가 있으면 이제 `<Shell>`이 그려진다. 그런 테스트는 **기대를 「빈 화면」이 아니라 「콘텐츠가 아직 없다」로 고친다** — 로딩 표시가 뜨는 것이 이번 변경의 목적이다.

- [x] **Step 6: e2e 실행 — 통과 확인**

Run: `cd frontend && pnpm e2e polish.spec.ts`
Expected: PASS, 4 tests.

- [x] **Step 7: 돌연변이로 지연을 확인한다**

`SHOW_AFTER_MS`를 `0`으로 잠시 바꾼다.
Expected: **AC-POLISH-04만** 빨갛다. 되돌린다.

- [x] **Step 8: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e && cd ..
git add frontend/src frontend/e2e
git commit -m "feat(web): 로딩 중 흰 화면 10곳에 표시를 넣는다 (AC-POLISH 6개)"
```

---

## Task 3: 잔재와 파비콘

**Files:**
- Delete: `frontend/public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`
- Create: `frontend/src/app/icon.svg`
- Modify: `frontend/src/test/polish.test.ts`
- Modify: `frontend/e2e/polish.spec.ts`

**Covers:** AC-POLISH-10, 11, 12

**Interfaces:**
- Produces: `src/app/icon.svg` — **PWA 스펙이 이 도형을 PNG 세 장으로 굽는다**(`2026-09-05-web-pwa.md` Task 1). 도형을 바꾸면 그쪽도 다시 구워야 한다.

- [x] **Step 1: 실패하는 테스트 작성**

Modify `frontend/src/test/polish.test.ts`:

```ts
  it("AC-POLISH-10 · Next 기본 SVG가 없다", () => {
    // 배포는 Cloudflare Workers인데 vercel.svg가 남아 있었다.
    const leftovers = [
      "file.svg",
      "globe.svg",
      "next.svg",
      "vercel.svg",
      "window.svg",
    ];
    // 5개가 public/의 전부여서 지우면 디렉터리째 사라진다.
    // PWA 스펙이 sw.js와 아이콘 PNG를 넣으면 다시 생긴다.
    const present = (existsSync("public") ? readdirSync("public") : []).filter(
      (name) => leftovers.includes(name),
    );
    expect(present).toEqual([]);
  });
```

Modify `frontend/e2e/polish.spec.ts`:

```ts
test.describe("파비콘", () => {
  test("AC-POLISH-11 · /icon.svg가 열린다", async ({ request }) => {
    const response = await request.get("/icon.svg");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/svg+xml");
  });

  test("AC-POLISH-12 · 문서가 파비콘을 가리킨다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");
    await expect(page.locator('link[rel="icon"]')).toHaveCount(1);
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test polish && pnpm e2e polish.spec.ts`
Expected: FAIL — 3개. SVG 5개가 남아 있고 `/icon.svg`가 404다.

- [x] **Step 3: 잔재를 지운다**

```bash
cd frontend && rm public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
```

**지우기 전에 참조가 없는지 다시 확인한다** — 2026-09-05 조사에서 5개 모두 0건이었다.

```bash
grep -rn "file.svg\|globe.svg\|next.svg\|vercel.svg\|window.svg" src e2e
```

- [x] **Step 4: 파비콘을 만든다**

Create `frontend/src/app/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#171717"/>
  <text x="32" y="32" fill="#ffffff" font-family="Helvetica, Arial, sans-serif"
        font-weight="700" font-size="40" text-anchor="middle"
        dominant-baseline="central">k</text>
</svg>
```

> `src/app/icon.svg`에 두면 **Next가 `<link rel="icon">`을 자동으로 넣는다.** `layout.tsx`를 고치지 않는다.
>
> **PWA 스펙이 같은 도형을 PNG로 굽는다.** 여기 모양을 바꾸면 `frontend/scripts/make-icons.mjs`의 SVG도 함께 바꾼다.

- [x] **Step 5: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test polish && pnpm e2e polish.spec.ts`
Expected: PASS. 단위 3개, e2e 6개.

> **실제로 2개가 나왔다**(2026-09-05). `src/app/favicon.ico`가 있어 Next가 `icon.svg`와 별개로 링크를 하나 더 넣었다. **`favicon.ico`를 지워** 1개로 만들었다.

- [x] **Step 6: 스펙 status를 올린다**

Modify `docs/specs/2026-09-05-polish.md` — `status: 초안` → `status: 구현완료`.

**수동 확인 3개는 전부 비차단형이다**(폰에서 숫자 가독성, 기기 간 인상 차이, 200ms 체감). `docs/conventions/verification.md`「비차단형만 남아 `구현완료`로 올릴 때」에 따라 남은 개수와 내용을 스펙의 인용 블록에 적는다.

- [x] **Step 7: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e && cd ..
./scripts/check-spec-coverage.sh
git add frontend docs/specs/2026-09-05-polish.md
git commit -m "chore(web): Next 기본 잔재를 지우고 파비콘을 넣는다 (AC-POLISH 3개)"
```

---

## 완료 기준

- [x] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 — **289개**
- [x] `cd frontend && pnpm e2e` 통과 — `polish.spec.ts` 6개 포함
- [x] `./scripts/check-spec-coverage.sh` 통과 — AC 604 + 12 = **616개**
- [x] `git diff --stat main...HEAD`에 `backend/`가 **0줄**
- [x] `package.json`의 의존성이 **늘지 않았다**
- [x] 스펙의 `status`를 `구현완료`로 (수동 확인 3개는 전부 비차단형)

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC **12개** 중 **12개**가 태스크에 매핑됐다.

**자리표시자 검사:** `TODO`·`TBD`·「나중에」 없음.

**타입 일관성:**
- `LoadingState`는 Task 2에서 정의하고 같은 태스크의 10곳이 쓴다. props가 없어 시그니처가 갈릴 여지가 없다.
- `polish.test.ts`의 `SOURCES`·`walk`는 Task 1에서 만들고 Task 2·3이 같은 것을 쓴다.
- `e2e/polish.spec.ts`의 `installStubs` import는 세 태스크가 공유한다.

**검증되지 않은 가정 — 2026-09-05 구현 세션의 결과:**
- **브라우저가 돌려주는 `fontFamily` 문자열의 정확한 모양.** ✅ **기대 그대로였다.** 따옴표만 벗기면 이름 8개가 순서대로 나왔다 — `FONT_STACK`을 손보지 않았다.
- **`font-variant-numeric`이 `body`에서 상속되는가.** `body`가 `tabular-nums`인 것은 확인했다(AC-POLISH-02). **자식에서 덮는 곳이 있는지는 여전히 미확인** — 수동 확인 첫 항목이 실제 화면을 본다.
- **기존 화면 테스트가 로딩 중을 어떻게 단언하는가.** ✅ **깨진 것이 없었다.** 「빈 화면」을 단언한 테스트는 없었고 283개가 그대로 초록이었다.
- **`src/app/icon.svg`를 OpenNext/Workers가 그대로 서빙하는가.** ✅ **로컬 `next start`에서 `image/svg+xml`로 200이었다**(AC-POLISH-11). **운영 Workers에서는 아직 확인하지 않았다.**
- **`page.route`의 지연이 `installStubs`의 라우트를 이기는가.** ✅ **이겼다.** 나중에 등록한 라우트가 이긴다 — `web-pwa` 계획의 `stubRecipeDetail`도 같은 전제를 써도 된다.

**구현하며 드러난 계획의 결함 2개 (본문을 고쳤다):**
- **소스 검사 테스트가 자기 자신을 잡았다.** `polish.test.ts`가 `--font-geist-sans`·`<Shell>{null}</Shell>`를 리터럴로 담고 있어, 원안대로면 무엇을 고쳐도 초록이 될 수 없었다. `SELF` 제외를 넣었다.
- **`public/`가 통째로 사라졌다.** 지운 5개가 그 디렉터리의 전부였다. `readdirSync("public")`가 ENOENT를 던져 `existsSync` 가드를 넣었다.

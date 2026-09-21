# 버튼 색 정합 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-21-button-color-fidelity.md`

**Goal:** 모든 화면의 주 액션 버튼이 에스프레소색이 아니라 먹색으로 칠해지고, 네 모습
(primary·secondary·ghost·disabled)과 hover 색이 목업 값으로 잠긴다. `ButtonLink`가 `Button`과
같은 색을 쓰며, 그 사실이 브라우저가 실제로 칠한 색을 재는 테스트로 보증된다.

**Architecture:** 검증을 **두 층으로 나눈다.** 단위 테스트는 "컴포넌트가 어떤 클래스를
붙이는가"와 "토큰이 어떤 값인가"를 보고, e2e는 "그 클래스가 브라우저에서 어떤 색으로
렌더되는가"를 본다. 이렇게 나누는 이유는 jsdom이 CSS 캐스케이드를 타지 않아 색을 잴 수 없고
(`theme-toggle.spec.ts` 주석), 반대로 e2e만으로는 컴포넌트가 그 클래스를 실제로 붙이는지
보증되지 않기 때문이다.

e2e는 **변형 클래스 문자열을 `Button.tsx`에서 import해 페이지에 `<button>`을 꽂고 잰다.**
앱 화면을 여는 방식으로는 `ghost`를 잴 수 없다 — 쓰이는 곳이 **0곳**이다. disabled와 `:hover`도
화면 상태에 의존하지 않고 직접 만들 수 있어야 한다. 이 import는 테스트를 위해 새로 뚫는 구멍이
아니라 `AC-BTN-15`(단일 출처)가 어차피 요구하는 export다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-BTN-01 | `--ink-hover` 라이트·다크 값 | Task 1 | 단위 `designTokens.test.ts` |
| AC-BTN-02 | `--ink-disabled` 라이트·다크 값 | Task 1 | 단위 `designTokens.test.ts` |
| AC-BTN-03 | 색 토큰이 양쪽 18개 | Task 1 | 단위 `designTokens.test.ts` |
| AC-BTN-04 | primary = `ink` / `on-ink` | Task 2 | e2e `button-color.spec.ts` |
| AC-BTN-05 | secondary = `surface` + 1px `border` | Task 2 | e2e `button-color.spec.ts` |
| AC-BTN-06 | ghost = 투명 / `accent` | Task 2 | e2e `button-color.spec.ts` |
| AC-BTN-07 | disabled = `sunken` / `ink-disabled`, opacity 1 | Task 2 | e2e `button-color.spec.ts` |
| AC-BTN-08 | primary hover = `ink-hover` | Task 2 | e2e `button-color.spec.ts` |
| AC-BTN-09 | secondary hover = `sunken` | Task 2 | e2e `button-color.spec.ts` |
| AC-BTN-10 | ghost hover = `accent-wash` | Task 2 | e2e `button-color.spec.ts` |
| AC-BTN-11 | disabled은 hover해도 불변 | Task 2 | e2e `button-color.spec.ts` |
| AC-BTN-12 | 다크 primary가 저절로 반전 | Task 2 | e2e `button-color.spec.ts` |
| AC-BTN-13 | 다크 primary hover = 다크 `ink-hover` | Task 2 | e2e `button-color.spec.ts` |
| AC-BTN-14 | `ButtonLink`와 `Button`의 색이 같다 | Task 3 | e2e `button-color.spec.ts` |
| AC-BTN-15 | 변형 테이블이 한 곳에만 있다 | Task 3 | 단위 `primitives.test.tsx` |

스펙의 AC 15개 중 15개가 매핑됐다.

---

## Global Constraints

- **`dark:` 접두 클래스를 새로 쓰지 않는다.** 반전은 토큰이 한다 (`AC-VISUAL-03`).
- **임의값 색(`bg-[#...]`, `bg-[oklch(...)]`)을 쓰지 않는다** (`AC-VISUAL-04`).
- **간격·글자 크기·모서리를 건드리지 않는다.** `min-h-11`·`px-3 py-2`·`rounded-control`·
  `text-body`는 그대로다. 손대면 `spacing.test.ts`·`typography.test.ts`·`AC-TOUCH-01`이 운다.
- **`Button`/`ButtonLink` 밖의 버튼류는 손대지 않는다.** 삭제 다이얼로그·`RecipeStepEditor`·
  `ThemeToggle`의 `disabled:opacity-*`는 그대로 남는다 (스펙의 범위 밖 항목).
- 태스크마다 `pnpm typecheck && pnpm lint && pnpm test`가 초록이어야 커밋한다.

---

## File Structure

```
frontend/
├── src/
│   ├── app/globals.css                    수정 — 토큰 2개 + @theme inline 2줄
│   ├── components/ui/
│   │   ├── Button.tsx                     수정 — 변형 색 교체, 상수 export
│   │   └── ButtonLink.tsx                 수정 — 자체 테이블 제거, Button에서 import
│   └── test/
│       ├── tokens.ts                      수정 — TOKEN_NAMES 16 → 18
│       ├── designTokens.test.ts           수정 — AC-BTN-01~03 추가
│       └── primitives.test.tsx            수정 — AC-BTN-15 추가
└── e2e/
    └── button-color.spec.ts               신규 — AC-BTN-04~14
docs/specs/
└── 2026-09-17-design-system-v2.md         수정 — AC-DS2-01 개수 정정 (16 → 18)
```

---

## Task 1: 토큰 두 개를 더한다

**Files:**
- Modify: `frontend/src/app/globals.css`
- Modify: `frontend/src/test/tokens.ts`
- Modify: `frontend/src/test/designTokens.test.ts`
- Modify: `docs/specs/2026-09-17-design-system-v2.md`

**Covers:** AC-BTN-01, AC-BTN-02, AC-BTN-03

**Interfaces:**
- Produces: CSS 토큰 `--ink-hover`·`--ink-disabled`, Tailwind 유틸 `bg-ink-hover`·
  `text-ink-disabled`, `TOKEN_NAMES` 18개 배열

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/test/designTokens.test.ts`의 기존 `describe` 안에 더한다.

```ts
it("AC-BTN-01 · --ink-hover가 라이트·다크 값을 갖는다", () => {
  const { light, dark } = readPalettes();
  expect(light["ink-hover"]).toBe("oklch(0.15 0.015 60)");
  expect(dark["ink-hover"]).toBe("oklch(0.88 0.005 85)");
});

it("AC-BTN-02 · --ink-disabled가 라이트·다크 값을 갖는다", () => {
  const { light, dark } = readPalettes();
  expect(light["ink-disabled"]).toBe("oklch(0.65 0.015 65)");
  expect(dark["ink-disabled"]).toBe("oklch(0.46 0.01 65)");
});

it("AC-BTN-03 · 색 토큰이 양쪽 팔레트에 18개씩 있다", () => {
  const { light, dark } = readPalettes();
  expect(TOKEN_NAMES).toHaveLength(18);
  expect(Object.keys(light).sort()).toEqual([...TOKEN_NAMES].sort());
  expect(Object.keys(dark).sort()).toEqual([...TOKEN_NAMES].sort());
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- designTokens`
Expected: FAIL 3건 —
`AC-BTN-01`·`AC-BTN-02`는 `expected undefined to be "oklch(...)"`(토큰이 없다),
`AC-BTN-03`은 `expected length 16 to be 18`.

- [ ] **Step 3: 최소 구현**

`globals.css`의 `:root` 글자 블록에 더한다.

```css
  /* 글자 */
  --ink: oklch(0.22 0.015 60);
  --ink-2: oklch(0.38 0.015 60);
  --ink-3: oklch(0.55 0.02 70);
  /* primary 버튼 hover 배경. ink보다 어둡다 — 누르면 더 진해진다 */
  --ink-hover: oklch(0.15 0.015 60);
  /* disabled 버튼 글자. sunken 위에 놓인다 */
  --ink-disabled: oklch(0.65 0.015 65);
  /* ink 배경 위 글자. primary 버튼이 이 조합이다. */
  --on-ink: oklch(0.97 0.004 85);
```

다크 블록에 더한다. **`--ink-hover`가 `--ink`(0.95)보다 어둡다** — 라이트의 "더 어둡게"
(0.22→0.15)를 대칭시키면 1.02라 표현 범위를 벗어나므로, 밝은 면이 눌리면 어두워지는 쪽을 택했다.

```css
    --ink: oklch(0.95 0.005 85);
    --ink-2: oklch(0.82 0.008 78);
    --ink-3: oklch(0.68 0.01 70);
    --ink-hover: oklch(0.88 0.005 85);
    --ink-disabled: oklch(0.46 0.01 65);
    --on-ink: oklch(0.2 0.015 60);
```

`@theme inline`에 두 줄을 더한다 — 이게 없으면 `bg-ink-hover`·`text-ink-disabled` 유틸이 생기지 않는다.

```css
  --color-ink-3: var(--ink-3);
  --color-ink-hover: var(--ink-hover);
  --color-ink-disabled: var(--ink-disabled);
  --color-on-ink: var(--on-ink);
```

`src/test/tokens.ts`의 `TOKEN_NAMES` 글자 묶음에 더하고 주석을 갱신한다.

```ts
  // 글자
  "ink",
  "ink-2",
  "ink-3",
  // 버튼 전용 — hover 배경과 disabled 글자 (docs/specs/2026-09-21-button-color-fidelity.md)
  "ink-hover",
  "ink-disabled",
  "on-ink",
```

`docs/specs/2026-09-17-design-system-v2.md`의 `AC-DS2-01`에 정정을 덧붙인다 —
`signal-record` 때와 같은 방식이다.

```markdown
> **2026-09-21 정정:** `docs/specs/2026-09-21-button-color-fidelity.md`가 버튼 전용 토큰
> `ink-hover`·`ink-disabled`를 더한다 — **18개**가 된다. 둘 다 유채색이 아니라 먹색 계열의
> 상태 변주라, "유채색은 에스프레소 한 색뿐"이라는 전제는 그대로다.
```

본문의 "현재 **16개**"도 **18개**로 고친다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- designTokens`
Expected: PASS. `AC-DS2-01`(개수)과 `AC-DS2-02`(전부 oklch)도 함께 초록이어야 한다 — 새 토큰
두 개가 그 검사에도 걸린다.

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: 전부 PASS. `AC-DS2-04`(대비 4.5:1)는 대상 토큰 목록이 `ink`·`ink-2`·`ink-3`·
`accent`·`danger`로 명시돼 있어 새 토큰이 걸리지 않는다 — disabled 글자는 의도적으로 흐리다.

- [ ] **Step 5: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test
cd .. && git add . && git commit -m "feat(design): 버튼 전용 토큰 ink-hover·ink-disabled 추가 (AC-BTN-01~03)"
```

---

## Task 2: `Button`의 네 모습과 hover를 목업 값으로 바꾼다

**Files:**
- Modify: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/e2e/button-color.spec.ts`

**Covers:** AC-BTN-04, AC-BTN-05, AC-BTN-06, AC-BTN-07, AC-BTN-08, AC-BTN-09, AC-BTN-10, AC-BTN-11, AC-BTN-12, AC-BTN-13

**Interfaces:**
- Consumes: Task 1의 `bg-ink-hover`·`text-ink-disabled` 유틸
- Produces: `Button.tsx`가 내보내는 `BUTTON_BASE: string`과
  `BUTTON_VARIANT: Record<ButtonVariant, string>` — Task 3과 e2e가 쓴다

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/e2e/button-color.spec.ts`를 새로 만든다. 하네스가 핵심이다 — 변형 클래스를
`Button.tsx`에서 가져와 실제 페이지에 꽂고, **같은 문서에서 읽은 토큰 값**과 대조한다.
문자열을 하드코딩해 비교하지 않는 이유는 브라우저가 `oklch(...)`를 그대로 주기도 하고
`rgb(...)`로 바꾸기도 하기 때문이다 — 양쪽을 같은 방법으로 읽으면 형식이 일치한다.

```ts
import { expect, test, type Page } from "@playwright/test";
import { installStubs } from "./stubs";
import { BUTTON_BASE, BUTTON_VARIANT } from "../src/components/ui/Button";
import { THEME_KEY } from "../src/lib/theme";

const HARNESS_ID = "btn-probe";

/** 토큰 이름을 브라우저가 계산한 색 문자열로 바꾼다. 비교의 기준이 된다. */
async function token(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--${n})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);
}

/** 변형 클래스를 가진 버튼을 페이지에 꽂는다. 화면에 쓰이지 않는 ghost도 이렇게 잰다. */
async function mount(
  page: Page,
  variant: keyof typeof BUTTON_VARIANT,
  disabled = false,
): Promise<void> {
  await page.evaluate(
    ({ cls, id, off }) => {
      document.getElementById(id)?.remove();
      const el = document.createElement("button");
      el.id = id;
      el.className = cls;
      el.textContent = "저장";
      el.disabled = off;
      document.body.appendChild(el);
    },
    {
      cls: `${BUTTON_BASE} ${BUTTON_VARIANT[variant]}`,
      id: HARNESS_ID,
      off: disabled,
    },
  );
}

async function styleOf(page: Page): Promise<{
  background: string;
  color: string;
  borderWidth: string;
  borderColor: string;
  opacity: string;
}> {
  return page.locator(`#${HARNESS_ID}`).evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      background: s.backgroundColor,
      color: s.color,
      borderWidth: s.borderTopWidth,
      borderColor: s.borderTopColor,
      opacity: s.opacity,
    };
  });
}

async function openLight(page: Page): Promise<void> {
  await installStubs(page);
  await page.goto("/more");
  await page.waitForLoadState("networkidle");
}

test.describe("버튼 색 — 라이트", () => {
  test("AC-BTN-04 · primary가 먹색으로 칠해진다", async ({ page }) => {
    await openLight(page);
    await mount(page, "primary");
    const style = await styleOf(page);

    expect(style.background).toBe(await token(page, "ink"));
    expect(style.color).toBe(await token(page, "on-ink"));
    expect(style.background).not.toBe(await token(page, "accent"));
  });

  test("AC-BTN-05 · secondary가 표면색 + 1px 테두리다", async ({ page }) => {
    await openLight(page);
    await mount(page, "secondary");
    const style = await styleOf(page);

    expect(style.background).toBe(await token(page, "surface"));
    expect(style.borderWidth).toBe("1px");
    expect(style.borderColor).toBe(await token(page, "border"));
    expect(style.color).toBe(await token(page, "ink"));
  });

  test("AC-BTN-06 · ghost는 배경이 없다", async ({ page }) => {
    await openLight(page);
    await mount(page, "ghost");
    const style = await styleOf(page);

    expect(style.background).toBe("rgba(0, 0, 0, 0)");
    expect(style.color).toBe(await token(page, "accent"));
  });

  test("AC-BTN-07 · disabled가 가라앉은 면으로 칠해진다", async ({ page }) => {
    await openLight(page);
    await mount(page, "primary", true);
    const style = await styleOf(page);

    expect(style.background).toBe(await token(page, "sunken"));
    expect(style.color).toBe(await token(page, "ink-disabled"));
    // opacity-50이 남아 있으면 sunken 위에 겹쳐 목업보다 흐려진다.
    expect(style.opacity).toBe("1");
  });
});

test.describe("버튼 색 — hover", () => {
  const CASES = [
    ["AC-BTN-08", "primary", "ink-hover"],
    ["AC-BTN-09", "secondary", "sunken"],
    ["AC-BTN-10", "ghost", "accent-wash"],
  ] as const;

  for (const [ac, variant, expected] of CASES) {
    test(`${ac} · ${variant} hover 배경이 ${expected}다`, async ({ page }) => {
      await openLight(page);
      await mount(page, variant);
      await page.locator(`#${HARNESS_ID}`).hover();

      expect((await styleOf(page)).background).toBe(
        await token(page, expected),
      );
    });
  }

  test("AC-BTN-11 · disabled는 hover해도 변하지 않는다", async ({ page }) => {
    await openLight(page);
    await mount(page, "primary", true);
    const before = (await styleOf(page)).background;

    await page.locator(`#${HARNESS_ID}`).hover({ force: true });
    const after = (await styleOf(page)).background;

    expect(after).toBe(await token(page, "sunken"));
    expect(after).toBe(before);
  });
});

test.describe("버튼 색 — 다크", () => {
  async function openDark(page: Page): Promise<void> {
    await installStubs(page);
    await page.addInitScript(
      ([key]) => window.localStorage.setItem(key, "dark"),
      [THEME_KEY],
    );
    await page.goto("/more");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  }

  test("AC-BTN-12 · 다크에서 primary가 저절로 반전된다", async ({ page }) => {
    await openDark(page);
    await mount(page, "primary");
    const style = await styleOf(page);

    expect(style.background).toBe(await token(page, "ink"));
    expect(style.color).toBe(await token(page, "on-ink"));
  });

  test("AC-BTN-13 · 다크에서 primary hover가 어두워진다", async ({ page }) => {
    await openDark(page);
    await mount(page, "primary");
    await page.locator(`#${HARNESS_ID}`).hover();

    expect((await styleOf(page)).background).toBe(
      await token(page, "ink-hover"),
    );
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm e2e -- button-color`
Expected: FAIL —
먼저 `BUTTON_BASE`/`BUTTON_VARIANT`가 export되지 않아 **import 에러**로 파일 전체가 죽는다.
export만 먼저 뚫으면 `AC-BTN-04`가 `expected "oklch(0.42 0.06 45)" to be "oklch(0.22 0.015 60)"`
(accent로 칠해져 있다), `AC-BTN-05`는 배경이 `rgba(0, 0, 0, 0)`, `AC-BTN-07`은 opacity가
`0.5`, hover 세 건은 색이 변하지 않아 실패한다.

**두 단계로 나눠 실패 사유를 확인한다** — import 에러만 보고 "실패했으니 됐다"로 넘어가면
색이 틀렸다는 진짜 사유를 못 본다. 먼저 `Button.tsx`에서 `const`를 `export const`로만 바꾸고
(`AC-BTN-15`의 이름과 맞춘다) 다시 돌려 위의 색 실패를 눈으로 확인한 뒤 Step 3으로 간다.

- [ ] **Step 3: 최소 구현**

`frontend/src/components/ui/Button.tsx`의 두 상수를 교체한다.

```ts
/**
 * 44px 보장과 모양의 단일 출처. `ButtonLink`와 색 검증 e2e가 이 두 상수를 가져다 쓴다
 * (docs/specs/2026-09-21-button-color-fidelity.md).
 *
 * <p>`disabled:`는 `:disabled` 의사클래스가 붙어 명시도가 높으므로 변형의 배경을 이긴다.
 * `enabled:hover:`로 쓰는 이유는 그냥 `hover:`면 비활성 버튼에 포인터를 올렸을 때도
 * 색이 바뀌기 때문이다(AC-BTN-11).
 */
export const BUTTON_BASE =
  "inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control px-3 py-2 text-body disabled:bg-sunken disabled:text-ink-disabled";

export const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-ink text-on-ink enabled:hover:bg-ink-hover",
  secondary: "border border-border bg-surface text-ink enabled:hover:bg-sunken",
  ghost: "text-accent enabled:hover:bg-accent-wash",
};
```

`Button` 본문의 `BASE`·`VARIANT` 참조를 새 이름으로 바꾼다. `disabled:opacity-50`은 **지운다** —
`bg-sunken`과 겹치면 목업보다 흐려진다.

`ButtonLink`는 `<a>`라 `:disabled`가 없다. Task 3에서 그 차이를 다룬다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e -- button-color`
Expected: PASS, 10 tests

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm e2e`
Expected: 전부 PASS. 특히 아래가 깨지지 않았는지 확인한다.
- `primitives.test.tsx`의 `AC-DS2-19` — 세 변형 클래스가 여전히 서로 다르다
- `designTokens.test.ts`의 `AC-VISUAL-02`·`AC-VISUAL-03`·`AC-VISUAL-04` — 팔레트 색·`dark:`·임의값이 늘지 않았다
- `spacing.test.ts`·`typography.test.ts`·`AC-TOUCH-01` — 간격·글자·터치 크기를 건드리지 않았다
- `e2e/reskin.spec.ts`·`e2e/visual.spec.ts` — primary 색이 바뀌며 기대값이 깨진 곳이 없는지

깨진 게 있으면 **고치기 전에 그 테스트가 무엇을 지키던 것인지 먼저 읽는다.** 색을 옛 값으로
되돌리는 식의 수정은 하지 않는다.

- [ ] **Step 5: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm e2e
cd .. && git add . && git commit -m "feat(ui): Button 네 모습과 hover를 목업 색으로 되돌림 (AC-BTN-04~13)"
```

---

## Task 3: `ButtonLink`를 같은 출처에 묶는다

**Files:**
- Modify: `frontend/src/components/ui/ButtonLink.tsx`
- Modify: `frontend/src/test/primitives.test.tsx`
- Modify: `frontend/e2e/button-color.spec.ts`

**Covers:** AC-BTN-14, AC-BTN-15

**Interfaces:**
- Consumes: Task 2의 `BUTTON_BASE`·`BUTTON_VARIANT`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/test/primitives.test.tsx`에 더한다.

```tsx
it("AC-BTN-15 · ButtonLink가 변형 색 테이블을 자체 선언하지 않는다", () => {
  const source = readFileSync(
    join("src", "components", "ui", "ButtonLink.tsx"),
    "utf8",
  );

  // 자체 테이블이 없고, Button에서 가져다 쓴다.
  expect(source).not.toMatch(/const\s+VARIANT\s*[:=]/);
  expect(source).toMatch(/import\s*\{[^}]*BUTTON_VARIANT[^}]*\}\s*from\s*"\.\/Button"/);
});
```

`frontend/e2e/button-color.spec.ts`에 더한다. 하네스에 `<a>`도 꽂아 같은 자리에서 비교한다.

```ts
test.describe("버튼 색 — 링크와 버튼이 같다", () => {
  const VARIANTS = ["primary", "secondary", "ghost"] as const;

  for (const variant of VARIANTS) {
    test(`AC-BTN-14 · ${variant} 링크와 버튼의 색이 같다`, async ({ page }) => {
      await openLight(page);

      const pair = await page.evaluate(
        ({ base, cls }) => {
          const make = (tag: "button" | "a") => {
            const el = document.createElement(tag);
            el.className = `${base} ${cls}`;
            el.textContent = "저장";
            document.body.appendChild(el);
            const s = getComputedStyle(el);
            const read = { bg: s.backgroundColor, fg: s.color };
            el.remove();
            return read;
          };
          return { button: make("button"), link: make("a") };
        },
        { base: BUTTON_BASE, cls: BUTTON_VARIANT[variant] },
      );

      expect(pair.link.bg).toBe(pair.button.bg);
      expect(pair.link.fg).toBe(pair.button.fg);
    });
  }

  test("AC-BTN-14 · 실제 화면의 링크 버튼도 먹색이다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12");
    await page.waitForLoadState("networkidle");

    const cta = page.getByRole("link", { name: "이 레시피로 내렸다" });
    await expect(cta).toBeVisible();

    expect(await cta.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      await token(page, "ink"),
    );
  });
});
```

마지막 검사가 하네스와 별개로 필요한 이유는, 하네스가 같은 상수를 두 태그에 붙이므로
**컴포넌트가 실제로 그 상수를 쓰는지**는 보증하지 않기 때문이다. `/recipes/12`의 CTA는 실제
`ButtonLink`가 렌더한 것이다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- primitives` 그리고 `pnpm e2e -- button-color`
Expected: FAIL —
`AC-BTN-15`는 `ButtonLink.tsx`에 `const VARIANT`가 남아 있어 실패.
하네스 3건은 **통과한다**(상수를 직접 쓰므로). 실제 화면 검사는
`expected "oklch(0.42 0.06 45)" to be "oklch(0.22 0.015 60)"`로 실패한다 —
`ButtonLink`가 아직 자기 `bg-accent`를 쓰고 있다.

> 하네스 3건이 Step 2에서 통과하는 것은 정상이다. 그 검사가 지키는 것은 "앞으로 둘이
> 갈라지지 않는다"는 회귀 방지이고, **지금 갈라져 있다는 사실은 실제 화면 검사가 잡는다.**

- [ ] **Step 3: 최소 구현**

`frontend/src/components/ui/ButtonLink.tsx`의 자체 `BASE`·`VARIANT`를 지우고 가져다 쓴다.

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { BUTTON_BASE, BUTTON_VARIANT, type ButtonVariant } from "./Button";
```

`className` 조립을 `BUTTON_BASE`·`BUTTON_VARIANT[variant]`로 바꾼다.

`BUTTON_BASE`의 `disabled:` 유틸은 `<a>`에 `:disabled`가 없어 **아무 일도 하지 않는다** —
죽은 클래스가 붙을 뿐 렌더 결과는 같다. 링크는 비활성화되지 않으므로 분리할 이유가 없다.
이 사실을 `ButtonLink.tsx` 주석에 남긴다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- primitives`
Expected: PASS

Run: `pnpm e2e -- button-color`
Expected: PASS, 14 tests

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e`
Expected: 전부 PASS

Run: `./scripts/check-spec-coverage.sh`
Expected: PASS — `AC-BTN-01`~`AC-BTN-15`가 전부 테스트에서 발견된다

- [ ] **Step 5: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e
cd .. && ./scripts/check-spec-coverage.sh
git add . && git commit -m "feat(ui): ButtonLink를 Button과 같은 색 출처에 묶음 (AC-BTN-14~15)"
```

---

## 완료 기준

- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e` 통과
- [ ] `./scripts/check-spec-coverage.sh` 통과
- [ ] 스펙 `docs/specs/2026-09-21-button-color-fidelity.md`의 `status`를 `구현완료`로 변경
- [ ] `docs/specs/2026-09-17-design-system-v2.md`의 `AC-DS2-01` 개수가 18로 정정됨
- [ ] 수동 확인 3건 (스펙의 「수동 확인」 절) — 폰 라이트/다크, 데스크톱 hover

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 15개 중 15개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** Task 2가 내보내는 `BUTTON_BASE: string`·
`BUTTON_VARIANT: Record<ButtonVariant, string>`을 Task 3과 e2e가 같은 이름으로 가져다 쓴다.
`ButtonVariant` 타입은 기존 것을 그대로 유지한다.

**검증되지 않은 가정:**
- **Tailwind v4의 `enabled:` 변형이 이 설정에서 쓸 수 있는지.** 코드베이스에 전례가 없다.
  Task 2 Step 4에서 `AC-BTN-11`이 실패하면 `hover:not(:disabled)` 또는 `not-disabled:hover:`로
  바꾼다 — 클래스 표기만 바뀌고 AC는 그대로다.
- **`e2e/visual.spec.ts`가 primary 색을 기대값으로 갖고 있는지 확인하지 않았다.** `bg-accent`
  문자열 검색으로는 앱 코드 6곳만 나왔고 테스트에는 없었지만, 색을 간접적으로 비교하는
  단언이 있을 수 있다. Task 2 Step 4의 전체 e2e 실행이 이를 드러낸다.
- **`/recipes/12` 스텁이 `isMine: true`를 주는지.** `reskin.spec.ts`가 같은 경로에서 히어로를
  확인하지만 CTA 링크의 존재는 확인하지 않는다. Task 3 Step 2에서 CTA가 보이지 않으면
  `getByRole("link", { name: "이 레시피로 내렸다" })`가 타임아웃으로 실패하므로 즉시 드러난다.
  그 경우 스텁이 내 소유로 주는 다른 레시피 id로 바꾼다.
- **`ghost` 변형이 앱에서 한 번도 쓰이지 않는다**(사용처 0곳). 이번 스펙은 색만 맞추고 적용은
  하지 않는다. 목업이 ghost를 어디에 쓰는지는 화면별 스펙에서 다룬다.

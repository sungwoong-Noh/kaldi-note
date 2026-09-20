# 폼 에러 필드로 포커스 이동 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-20-error-focus.md`

**Goal:** 브루잉 로그 작성 화면(`BrewLogForm`)과 그 안의 원두·그라인더 등록 모달에서, 저장이 422로 실패하면 화면에 보이는 순서상 첫 번째로 틀린 입력칸에 포커스가 자동으로 간다. 어떤 칸에도 안 붙는 에러라면 하단 일반 에러 문구로 포커스가 간다.

**Architecture:** 순수 DOM 함수 `focusFirstInvalidField(container)`를 하나 만들어 세 컴포넌트가 공유한다. 각 컴포넌트는 자기 루트에 `ref`를 하나 두고, 저장 실패(`error` 객체가 새로 생길 때)마다 그 함수를 부른다. 대상을 찾는 기준은 기존에 이미 있는 `aria-invalid="true"` 속성이다 — 새 접근성 속성을 만들지 않고 있는 것을 그대로 쓴다.

**⚠️ 선행 조사에서 발견한 것:** 이 기준이 성립하려면 `aria-invalid`가 **그 필드 자신의** 에러 여부를 반영해야 하는데, 지금 3곳이 그렇지 않다 — `BrewLogFields.tsx`의 `내린 시각`·`메모`, `BeanBatchDialog.tsx`의 `중량`·`로스팅일`이 전체 `fieldErrors` 객체의 존재 여부(항상 truthy)로 `aria-invalid`를 켜고 있다. 이대로면 다른 필드가 틀려도 `내린 시각`(폼의 첫 칸)이 잘못 invalid로 잡혀 포커스가 엉뚱한 곳으로 간다. 이 스펙의 AC를 통과시키려면 **먼저 고쳐야 하는 버그**라 각 통합 태스크에 포함했다. 또한 `UserGrinderDialog.tsx`는 `별명` 필드의 에러를 `fieldErrors.byField.nickname`으로 읽지만 `nickname`이 `lib/fieldErrors.ts`의 `KNOWN_FIELDS`에 없어 **한 번도 실제로 매칭된 적이 없는 죽은 코드**다 — Task 4에서 같이 고친다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-ERRFOCUS-01 | BrewLogForm — 첫 번째 invalid 필드로 포커스 | Task 2 | 컴포넌트 테스트 |
| AC-ERRFOCUS-02 | BeanBatchDialog — 첫 번째 invalid 필드로 포커스 | Task 3 | 컴포넌트 테스트 |
| AC-ERRFOCUS-03 | UserGrinderDialog — 첫 번째 invalid 필드로 포커스 | Task 4 | 컴포넌트 테스트 |
| AC-ERRFOCUS-04 | BrewLogForm — 필드에 안 붙는 에러는 하단 문구로 포커스 | Task 2 | 컴포넌트 테스트 |
| AC-ERRFOCUS-05 | BeanBatchDialog — 필드에 안 붙는 에러는 하단 문구로 포커스 | Task 3 | 컴포넌트 테스트 |
| AC-ERRFOCUS-06 | UserGrinderDialog — 필드에 안 붙는 에러는 하단 문구로 포커스 | Task 4 | 컴포넌트 테스트 |
| AC-ERRFOCUS-07 | BrewLogForm — 필드 에러가 하단 문구보다 우선한다 | Task 2 | 컴포넌트 테스트 |
| AC-ERRFOCUS-08 | BrewLogForm — 재시도가 다른 필드에서 실패하면 그 필드로 다시 이동 | Task 2 | 컴포넌트 테스트 |

---

## Global Constraints

- 백엔드 변경 0건. 기존 422 응답 포맷(`fieldErrors`)을 그대로 소비한다.
- 새 `aria-live`나 요약 안내 UI를 추가하지 않는다 — 기존 `aria-invalid`/`aria-describedby` + 포커스 이동만으로 스크린리더 안내가 완결된다.
- `focusFirstInvalidField`는 React 훅에 의존하지 않는 순수 DOM 함수로 만든다 — 세 컴포넌트가 각자의 `useEffect`에서 부르기만 한다.
- 기존 테스트 파일·헬퍼(`badRequest`, `captureCreate`, `fillNewBean`, `recordCalls` 등)를 재사용한다. 새 테스트 파일을 만들지 않고 기존 파일에 `describe` 블록을 추가한다 — `BrewLogForm`은 항상 `app/brews/new/page.tsx`를 통해서만 쓰이므로 그 페이지의 테스트 파일(`src/app/brews/new/page.test.tsx`)이 이미 통합 테스트 자리다.

---

## File Structure

```
frontend/src/
├── lib/
│   ├── focusFirstError.ts          (신규) 공용 포커스 유틸리티
│   ├── focusFirstError.test.ts     (신규)
│   └── fieldErrors.ts              (수정) KNOWN_FIELDS에 nickname 추가
├── features/brewlog/components/
│   ├── BrewLogFields.tsx           (수정) 내린 시각·메모의 aria-invalid 버그 수정
│   ├── BrewLogForm.tsx             (수정) ref + 포커스 이동 + 하단 문구 tabIndex
│   ├── BeanBatchDialog.tsx         (수정) 중량·로스팅일 aria-invalid 버그 수정 + ref + 포커스 이동
│   ├── BeanBatchDialog.test.tsx    (수정) AC-ERRFOCUS-02·05 추가
│   ├── UserGrinderDialog.tsx       (수정) ref + 포커스 이동 + 하단 문구 tabIndex
│   └── UserGrinderDialog.test.tsx  (수정) AC-ERRFOCUS-03·06 추가
└── app/brews/new/
    └── page.test.tsx               (수정) AC-ERRFOCUS-01·04·07·08 추가
```

---

## Task 1: 공용 포커스 유틸리티

**Files:**
- Create: `frontend/src/lib/focusFirstError.ts`
- Test: `frontend/src/lib/focusFirstError.test.ts`

**Covers:** (직접 AC 없음 — Task 2~4가 공유하는 하부 유틸리티)

**Interfaces:**
- Produces: `focusFirstInvalidField(container: HTMLElement | null): void` — Task 2·3·4가 각자의 `useEffect`에서 그대로 부른다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { afterEach, describe, expect, it } from "vitest";
import { focusFirstInvalidField } from "./focusFirstError";

function mount(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("focusFirstInvalidField", () => {
  it("DOM 순서상 첫 번째 aria-invalid=true 요소로 포커스가 간다", () => {
    const container = mount(`
      <input id="a" />
      <input id="b" aria-invalid="true" />
      <input id="c" aria-invalid="true" />
    `);

    focusFirstInvalidField(container);

    expect(document.activeElement).toBe(container.querySelector("#b"));
  });

  it("invalid 필드가 없으면 [data-general-error]로 포커스가 간다", () => {
    const container = mount(`
      <input id="a" />
      <p id="msg" data-general-error tabindex="-1">문제가 있습니다</p>
    `);

    focusFirstInvalidField(container);

    expect(document.activeElement).toBe(container.querySelector("#msg"));
  });

  it("둘 다 없으면 아무 일도 하지 않는다", () => {
    const container = mount(`<input id="a" />`);

    expect(() => focusFirstInvalidField(container)).not.toThrow();
    expect(document.activeElement).not.toBe(container.querySelector("#a"));
  });

  it("container가 null이면 아무 일도 하지 않는다", () => {
    expect(() => focusFirstInvalidField(null)).not.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- focusFirstError`
Expected: FAIL — `focusFirstError.ts`가 없어 import 자체가 깨진다

- [ ] **Step 3: 최소 구현**

```ts
/**
 * 폼 제출이 실패했을 때 포커스를 옮길 곳을 찾는다.
 * 우선순위: DOM 순서상 첫 번째 aria-invalid="true" 요소 → 없으면 [data-general-error].
 */
export function focusFirstInvalidField(container: HTMLElement | null): void {
  if (container === null) return;
  const target =
    container.querySelector<HTMLElement>('[aria-invalid="true"]') ??
    container.querySelector<HTMLElement>("[data-general-error]");
  target?.focus();
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- focusFirstError`
Expected: PASS, 4 tests

- [ ] **Step 5: 커밋**

```bash
pnpm lint && pnpm typecheck
git add src/lib/focusFirstError.ts src/lib/focusFirstError.test.ts
git commit -m "feat(web): 첫 번째 invalid 필드로 포커스를 옮기는 유틸리티"
```

---

## Task 2: BrewLogForm — 저장 실패 시 포커스 이동

**Files:**
- Modify: `frontend/src/features/brewlog/components/BrewLogFields.tsx`
- Modify: `frontend/src/features/brewlog/components/BrewLogForm.tsx`
- Test: `frontend/src/app/brews/new/page.test.tsx`

**Covers:** AC-ERRFOCUS-01, AC-ERRFOCUS-04, AC-ERRFOCUS-07, AC-ERRFOCUS-08

**Interfaces:**
- Consumes: `focusFirstInvalidField` (Task 1)
- Produces: 없음 — 화면 동작만 바뀐다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/app/brews/new/page.test.tsx`의 마지막 `describe` 뒤에 추가:

```tsx
describe("BrewNewPage — 에러 필드로 포커스 이동", () => {
  it("AC-ERRFOCUS-01 · 여러 필드가 틀리면 DOM 순서상 첫 번째로 포커스가 간다", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${BASE}/brew-logs`, () =>
        HttpResponse.json(
          {
            code: "INVALID_REQUEST",
            message: "입력값이 올바르지 않습니다.",
            fieldErrors: [
              { field: "actualDoseG", message: "0보다 커야 합니다" },
              { field: "actualWaterG", message: "0보다 커야 합니다" },
            ],
          },
          { status: 400 },
        ),
      ),
    );

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "기록하기" }));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("원두량")),
    );
  });

  it("AC-ERRFOCUS-04 · 어떤 필드에도 안 붙는 에러는 하단 문구가 포커스를 받는다", async () => {
    const user = userEvent.setup();
    captureCreate(badRequest("quantity", "이상한 값입니다"));

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "기록하기" }));

    const message = await screen.findByText("입력값이 올바르지 않습니다.");
    await waitFor(() => expect(document.activeElement).toBe(message));
    expect(message).toHaveAttribute("tabindex", "-1");
  });

  it("AC-ERRFOCUS-07 · 필드 에러가 있으면 하단 문구가 보여도 필드가 포커스를 받는다", async () => {
    const user = userEvent.setup();
    captureCreate(badRequest("actualDoseG", "0보다 커야 합니다"));

    await renderNewPage();
    await user.click(await screen.findByRole("button", { name: "기록하기" }));

    expect(
      await screen.findByText("입력값이 올바르지 않습니다."),
    ).toBeVisible();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("원두량")),
    );
  });

  it("AC-ERRFOCUS-08 · 재시도가 다른 필드에서 실패하면 포커스가 그 필드로 다시 이동한다", async () => {
    const user = userEvent.setup();
    let call = 0;
    server.use(
      http.post(`${BASE}/brew-logs`, () => {
        call += 1;
        return call === 1
          ? badRequest("actualDoseG", "0보다 커야 합니다")()
          : badRequest("actualWaterG", "0보다 커야 합니다")();
      }),
    );

    await renderNewPage();
    const submit = await screen.findByRole("button", { name: "기록하기" });

    await user.click(submit);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("원두량")),
    );

    await user.click(submit);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("물량")),
    );
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- page.test`
Expected: FAIL — 4 tests fail. `document.activeElement`가 여전히 저장 버튼이거나(포커스 이동이 없음), `내린 시각`이 엉뚱하게 잡힌다(기존 aria-invalid 버그)

- [ ] **Step 3: 최소 구현**

`BrewLogFields.tsx` — 두 곳의 버그 수정:

```tsx
// 내린 시각 입력칸
aria-invalid={fieldErrors?.byField.brewedAt ? true : undefined}
className={controlClass("", Boolean(fieldErrors?.byField.brewedAt))}
```

```tsx
// 메모 textarea
aria-invalid={fieldErrors?.byField.overallNote ? true : undefined}
className={controlClass("", Boolean(fieldErrors?.byField.overallNote))}
```

`BrewLogForm.tsx` — import 추가:

```tsx
import { useEffect, useRef, useState } from "react";
import { focusFirstInvalidField } from "@/lib/focusFirstError";
```

`Fields` 함수 안, `save` 뮤테이션 선언 뒤:

```tsx
const formRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (save.error) focusFirstInvalidField(formRef.current);
}, [save.error]);
```

반환하는 최상위 `<div>`에 ref를 달고, 하단 에러 문구에 `data-general-error`와 `tabIndex={-1}`을 준다:

```tsx
<div ref={formRef} className="flex flex-col gap-4">
  <BrewLogFields ... />

  {save.error && (
    <p data-general-error tabIndex={-1} className="text-body text-danger">
      {save.error.message}
    </p>
  )}
  ...
</div>
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- page.test`
Expected: PASS — 새 4 tests 포함 전체 통과

- [ ] **Step 5: 커밋**

```bash
pnpm lint && pnpm typecheck
git add src/features/brewlog/components/BrewLogFields.tsx \
        src/features/brewlog/components/BrewLogForm.tsx \
        src/app/brews/new/page.test.tsx
git commit -m "fix(web): 기록 작성 폼에서 틀린 필드로 포커스를 옮긴다 (AC-ERRFOCUS-01·04·07·08)"
```

---

## Task 3: BeanBatchDialog — 저장 실패 시 포커스 이동

**Files:**
- Modify: `frontend/src/features/brewlog/components/BeanBatchDialog.tsx`
- Test: `frontend/src/features/brewlog/components/BeanBatchDialog.test.tsx`

**Covers:** AC-ERRFOCUS-02, AC-ERRFOCUS-05

**Interfaces:**
- Consumes: `focusFirstInvalidField` (Task 1)

- [ ] **Step 1: 실패하는 테스트 작성**

`BeanBatchDialog.test.tsx`에 추가:

```tsx
function unmappedProductError() {
  return HttpResponse.json(
    {
      code: "INVALID_REQUEST",
      message: "입력값이 올바르지 않습니다.",
      fieldErrors: [{ field: "sku", message: "알 수 없는 오류" }],
    },
    { status: 400 },
  );
}

it("AC-ERRFOCUS-02 · 실패한 필드로 포커스가 간다", async () => {
  const user = userEvent.setup();
  recordCalls({ product: invalidProductName });
  renderDialog();

  await fillNewBean(user);
  await user.click(screen.getByRole("button", { name: "등록" }));

  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByLabelText("제품 이름")),
  );
});

it("AC-ERRFOCUS-05 · 필드에 안 붙는 에러는 하단 문구가 포커스를 받는다", async () => {
  const user = userEvent.setup();
  recordCalls({ product: unmappedProductError });
  renderDialog();

  await fillNewBean(user);
  await user.click(screen.getByRole("button", { name: "등록" }));

  const message = await screen.findByText("입력값이 올바르지 않습니다.");
  await waitFor(() => expect(document.activeElement).toBe(message));
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- BeanBatchDialog`
Expected: FAIL — 2 new tests fail, 포커스 이동이 없다

- [ ] **Step 3: 최소 구현**

`BeanBatchDialog.tsx` — 중량·로스팅일의 버그 수정:

```tsx
// 중량
aria-invalid={mapped?.byField.weightG ? true : undefined}
className={controlClass("", Boolean(mapped?.byField.weightG))}
```

```tsx
// 로스팅일
aria-invalid={mapped?.byField.roastedAt ? true : undefined}
className={controlClass("", Boolean(mapped?.byField.roastedAt))}
```

import 추가:

```tsx
import { useEffect, useRef, useState } from "react";
import { focusFirstInvalidField } from "@/lib/focusFirstError";
```

`submit` 뮤테이션 뒤:

```tsx
const dialogRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (submit.error) focusFirstInvalidField(dialogRef.current);
}, [submit.error]);
```

`role="dialog"` div에 `ref={dialogRef}`를 달고, 하단 문구를 고친다:

```tsx
{submit.error && (
  <p data-general-error tabIndex={-1} className="text-body-sm text-danger">
    {submit.error.message}
  </p>
)}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- BeanBatchDialog`
Expected: PASS, 전체 통과

- [ ] **Step 5: 커밋**

```bash
pnpm lint && pnpm typecheck
git add src/features/brewlog/components/BeanBatchDialog.tsx \
        src/features/brewlog/components/BeanBatchDialog.test.tsx
git commit -m "fix(web): 원두 등록 모달에서 틀린 필드로 포커스를 옮긴다 (AC-ERRFOCUS-02·05)"
```

---

## Task 4: UserGrinderDialog — 저장 실패 시 포커스 이동

**Files:**
- Modify: `frontend/src/lib/fieldErrors.ts`
- Modify: `frontend/src/features/brewlog/components/UserGrinderDialog.tsx`
- Test: `frontend/src/features/brewlog/components/UserGrinderDialog.test.tsx`

**Covers:** AC-ERRFOCUS-03, AC-ERRFOCUS-06

**Interfaces:**
- Consumes: `focusFirstInvalidField` (Task 1)

- [ ] **Step 1: 실패하는 테스트 작성**

`UserGrinderDialog.test.tsx`에 추가:

```tsx
function invalidNickname() {
  return HttpResponse.json(
    {
      code: "INVALID_REQUEST",
      message: "입력값이 올바르지 않습니다.",
      fieldErrors: [{ field: "nickname", message: "20자 이하여야 합니다" }],
    },
    { status: 400 },
  );
}

it("AC-ERRFOCUS-03 · 실패한 필드로 포커스가 간다", async () => {
  const user = userEvent.setup();
  server.use(
    http.get(GRINDERS_URL, () => HttpResponse.json([comandanteC40])),
    http.post(USER_GRINDERS_URL, invalidNickname),
  );

  renderWithQuery(
    <UserGrinderDialog onCreated={vi.fn()} onCancel={vi.fn()} />,
  );
  await screen.findByRole("option", { name: "Comandante C40 MK4" });
  await user.selectOptions(screen.getByLabelText("모델"), "1");
  await user.click(screen.getByRole("button", { name: "등록" }));

  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByLabelText("별명")),
  );
});

it("AC-ERRFOCUS-06 · 필드에 안 붙는 에러는 하단 문구가 포커스를 받는다", async () => {
  const user = userEvent.setup();
  server.use(
    http.get(GRINDERS_URL, () => HttpResponse.json([comandanteC40])),
    http.post(USER_GRINDERS_URL, () =>
      HttpResponse.json(
        {
          code: "INVALID_REQUEST",
          message: "입력값이 올바르지 않습니다.",
          fieldErrors: [{ field: "grinderModelId", message: "이상합니다" }],
        },
        { status: 400 },
      ),
    ),
  );

  renderWithQuery(
    <UserGrinderDialog onCreated={vi.fn()} onCancel={vi.fn()} />,
  );
  await screen.findByRole("option", { name: "Comandante C40 MK4" });
  await user.selectOptions(screen.getByLabelText("모델"), "1");
  await user.click(screen.getByRole("button", { name: "등록" }));

  const message = await screen.findByText("입력값이 올바르지 않습니다.");
  await waitFor(() => expect(document.activeElement).toBe(message));
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- UserGrinderDialog`
Expected: FAIL — 2 new tests fail. AC-ERRFOCUS-03은 `nickname`이 `KNOWN_FIELDS`에 없어 애초에 `aria-invalid`가 걸리지 않는다

- [ ] **Step 3: 최소 구현**

`lib/fieldErrors.ts`의 `KNOWN_FIELDS`에 `"nickname"` 추가(브루잉 로그 섹션 뒤, 원두 등록 섹션 앞).

`UserGrinderDialog.tsx` — import 추가:

```tsx
import { useEffect, useRef, useState } from "react";
import { focusFirstInvalidField } from "@/lib/focusFirstError";
```

`create` 뮤테이션 뒤:

```tsx
const dialogRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (create.error) focusFirstInvalidField(dialogRef.current);
}, [create.error]);
```

`role="dialog"` div에 `ref={dialogRef}`를 달고, 하단 문구를 고친다:

```tsx
{create.error && !fieldErrors?.byField.nickname && (
  <p data-general-error tabIndex={-1} className="text-body-sm text-danger">
    {create.error.message}
  </p>
)}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- UserGrinderDialog`
Expected: PASS, 전체 통과

- [ ] **Step 5: 커밋**

```bash
pnpm lint && pnpm typecheck
git add src/lib/fieldErrors.ts \
        src/features/brewlog/components/UserGrinderDialog.tsx \
        src/features/brewlog/components/UserGrinderDialog.test.tsx
git commit -m "fix(web): 그라인더 등록 모달에서 틀린 필드로 포커스를 옮긴다 (AC-ERRFOCUS-03·06)"
```

---

## 완료 기준

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 전부 통과
- [ ] `pnpm test:worker` 통과
- [ ] `(cd .. && ./scripts/check-spec-coverage.sh)` 통과 — AC-ERRFOCUS-01~08 전부 테스트에서 검출
- [ ] 스펙(`docs/specs/2026-09-20-error-focus.md`)의 `status`를 `구현완료`로 변경
- [ ] 수동 확인 1건(모바일 실기기에서 포커스 이동 시 스크롤·키보드 겹침이 어색하지 않은지) 수행

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 8개 중 8개가 태스크에 매핑됨(Task 2가 4개, Task 3·4가 각 2개).

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음.

**타입 일관성:** `focusFirstInvalidField(container: HTMLElement | null): void`는 Task 1에서 정의한 시그니처를 Task 2·3·4가 그대로 쓴다. `useEffect`의 의존성 배열은 각 컴포넌트의 뮤테이션 `error` 객체 하나만 — TanStack Query는 새 실패 시도마다 새 에러 참조를 주므로 재시도마다 effect가 다시 돈다(AC-ERRFOCUS-08의 전제).

**검증되지 않은 가정:**
- TanStack Query의 `mutation.error`가 "같은 필드로 다시 실패해도" 매번 새 객체 참조를 주는지는 Task 2 Step 4에서 AC-ERRFOCUS-08 테스트가 실제로 통과하는 것으로 확인한다(참조가 재사용되면 effect가 안 돌아 테스트가 실패로 드러난다 — 이 경우 `useEffect` 의존성에 카운터를 추가하는 대안이 필요하다).

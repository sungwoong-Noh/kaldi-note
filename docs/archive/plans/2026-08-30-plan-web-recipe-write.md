# 레시피 쓰기 슬라이스 — 생성·편집·삭제와 푸어 스텝 에디터 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-08-30-web-recipe-write.md`

**Goal:** 브라우저에서 레시피를 새로 만들고, 포크한 레시피를 편집해 저장하고, 내 레시피를 지울 수 있다. 푸어 스텝은 추가·삽입·삭제·순서 변경이 되고 뒤 스텝의 시작 시각이 규칙대로 따라 움직인다.

**Architecture:** **백엔드를 건드리지 않는다** — 필요한 API 셋(`POST`/`PUT`/`DELETE`)과 검증 규칙이 이미 있다. 화면의 심장은 `stepSequence.ts`의 **순수 함수 네 개**(추가·삽입·삭제·이동)이고, 컴포넌트는 그 함수의 결과를 `useState`에 담기만 한다. 밀기·당기기 규칙을 순수 함수로 격리하면 시간 계산을 렌더링과 떼어 검증할 수 있다. 시퀀스의 옳고 그름을 **판정하는 쪽은 서버 하나뿐**이고, 화면은 합계를 보여주기만 한다.

**작업 위치:** `frontend/` (전부)

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-WEBEDIT-11 | 첫 스텝은 BLOOM·0초 | Task 2 | 컴포넌트 테스트 |
| AC-WEBEDIT-12 | 두 번째는 POUR·앞 종료 | Task 2 | 컴포넌트 테스트 |
| AC-WEBEDIT-13 | 자리 남으면 안 밀림 | Task 2 | 컴포넌트 테스트 |
| AC-WEBEDIT-14 | 5초 부족하면 5초 밀림 | Task 2 | 컴포넌트 테스트 |
| AC-WEBEDIT-15 | 삭제하면 간격만큼 당겨짐 | Task 2 | 컴포넌트 테스트 |
| AC-WEBEDIT-16 | 마지막 삭제는 안 움직임 | Task 2 | 컴포넌트 테스트 |
| AC-WEBEDIT-17 | 이동 시 소요만 따라감 | Task 2 | 컴포넌트 테스트 |
| AC-WEBEDIT-18 | 이동 후 겹치면 밀림 | Task 2 | 컴포넌트 테스트 |
| AC-WEBEDIT-19 | 첫 위로·마지막 아래로 disabled | Task 2 | 컴포넌트 테스트 |
| AC-WEBEDIT-20 | 30개면 추가 disabled | Task 2 | 컴포넌트 테스트 |
| AC-WEBEDIT-21 | 90초 옆에 (1:30) | Task 2 | 컴포넌트 테스트 |
| AC-WEBEDIT-22 | 부족량 표시 | Task 2 | 컴포넌트 테스트 |
| AC-WEBEDIT-23 | 일치하면 경고 없음 | Task 2 | 컴포넌트 테스트 |
| AC-WEBEDIT-25 | source=target으로 환산 호출 | Task 3 | 컴포넌트 테스트 |
| AC-WEBEDIT-26 | "추정치" 표기 | Task 3 | 컴포넌트 테스트 |
| AC-WEBEDIT-27 | 422면 안내만, 저장 가능 | Task 3 | 컴포넌트 테스트 |
| AC-WEBEDIT-28 | 범위 밖은 서버 문구, 저장 가능 | Task 3 | 컴포넌트 테스트 |
| AC-WEBEDIT-29 | MICRON이면 호출 안 함 | Task 3 | 컴포넌트 테스트 |
| AC-WEBEDIT-01 | 미인증 → /login?next= | Task 4 | 페이지 테스트 |
| AC-WEBEDIT-07 | 최소 입력 POST 본문 | Task 4 | 페이지 테스트 |
| AC-WEBEDIT-08 | 저장 중 버튼 잠김 | Task 4 | 페이지 테스트 |
| AC-WEBEDIT-24 | 합계 달라도 요청 나감 | Task 4 | 페이지 테스트 |
| AC-WEBEDIT-30 | fieldError가 입력칸 아래 | Task 4 | 페이지 테스트 |
| AC-WEBEDIT-31 | steps[2]가 3번 행에 | Task 4 | 페이지 테스트 |
| AC-WEBEDIT-32 | 매핑 실패는 상단에 | Task 4 | 페이지 테스트 |
| AC-WEBEDIT-33 | 시퀀스 오류 시 화면 유지 | Task 4 | 페이지 테스트 |
| AC-WEBEDIT-36 | 변경 후 beforeunload 경고 | Task 4 | 페이지 테스트 |
| AC-WEBEDIT-37 | 무변경이면 경고 없음 | Task 4 | 페이지 테스트 |
| AC-WEBEDIT-09 | 편집 초기값 채움 | Task 5 | 페이지 테스트 |
| AC-WEBEDIT-10 | PUT이 스텝 통째 교체 | Task 5 | 페이지 테스트 |
| AC-WEBEDIT-04 | 목록에 "새 레시피" | Task 6 | 페이지 테스트 |
| AC-WEBEDIT-05 | "내 레시피만"이 ownerUserId | Task 6 | 페이지 테스트 |
| AC-WEBEDIT-02 | 내 것에 편집·삭제 | Task 7 | 페이지 테스트 |
| AC-WEBEDIT-03 | 남의 것엔 없음 | Task 7 | 페이지 테스트 |
| AC-WEBEDIT-06 | 포크 → /edit로 이동 | Task 7 | 페이지 테스트 |
| AC-WEBEDIT-34 | 삭제 확인 → DELETE → 목록 | Task 7 | 페이지 테스트 |
| AC-WEBEDIT-35 | 취소하면 요청 없음 | Task 7 | 페이지 테스트 |

**스펙의 AC 37개 중 37개가 매핑됐다.** Task 1은 순수 함수 기반을 만들고 AC를 직접 담당하지 않는다 — 그 AC들은 Task 2가 컴포넌트 수준에서 검증한다(스펙이 검증 방식을 컴포넌트 테스트로 못박았다).

---

## Global Constraints

- **`any` 금지, `as` 단언 금지.** 요청·응답 타입은 Zod 스키마에서 `z.infer`로 뽑는다.
- **API는 MSW로 모킹한다.** 테스트에서 실제 백엔드를 호출하지 않는다.
- **픽스처는 실행 중인 백엔드 응답을 떠서 만든다.** 새로 필요한 픽스처(그라인더 목록, 환산 응답, 생성 응답)는 `docker compose up -d && ./gradlew bootRun` 후 실제 호출로 뜬다. 지어내지 않는다.
- **조회는 `getByRole`·`getByLabelText`로.** `getByTestId`는 최후 수단이다.
- **리스트 `key`에 배열 인덱스를 쓰지 않는다.** 스텝은 순서가 바뀌므로 인덱스 key는 확실한 버그다 — 각 스텝에 클라이언트 전용 `uid`를 부여한다(서버에 보내지 않는다).
- **검증 규칙을 프론트에 복제하지 않는다.** 합계·겹침·타입 모순의 **판정**은 서버 몫이다. 화면은 표시만 한다.
- **폼 상태는 `useState`로 직접 관리한다.** react-hook-form을 도입하지 않는다 — 스텝 배열 변환이 이 화면의 본체인데 `useFieldArray` 위에 커스텀 변환을 얹으면 상태가 두 군데 생긴다. 검증도 서버가 하므로 RHF의 이점이 거의 남지 않는다. **`frontend/CLAUDE.md`의 스택 표를 이 결정에 맞게 고치는 것이 Task 8이다.**
- **모달은 직접 만든다.** `role="dialog"` 요소를 조건부 렌더링한다. shadcn/ui·Radix를 도입하지 않는다.
- 커밋 전 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. **`pnpm build`를 빠뜨리지 않는다.**

---

## File Structure

```
frontend/src/
├── app/recipes/
│   ├── page.tsx                              Modify — "새 레시피" 링크, "내 레시피만" 토글
│   ├── page.test.tsx                         Modify — AC-WEBEDIT-04, 05
│   ├── new/page.tsx                          Create — 생성 화면
│   ├── new/page.test.tsx                     Create — AC-WEBEDIT-01,07,08,24,30~33,36,37
│   ├── [id]/edit/page.tsx                    Create — 편집 화면
│   └── [id]/edit/page.test.tsx               Create — AC-WEBEDIT-09, 10
│
├── features/recipe/
│   ├── stepSequence.ts                       Create — ★ 밀기·당기기 순수 함수
│   ├── stepSequence.test.ts                  Create — 순수 함수 단위 테스트
│   ├── formState.ts                          Create — 폼 상태 타입 + 서버 응답 ↔ 폼 변환
│   ├── formState.test.ts                     Create
│   ├── api.ts                                Modify — createRecipe/updateRecipe/deleteRecipe
│   ├── schema.ts                             Modify — recipeRequestSchema
│   └── components/
│       ├── RecipeForm.tsx                    Create — 스칼라 필드 + 저장 + 오류 표시
│       ├── RecipeStepEditor.tsx              Create — ★ 스텝 목록 + 합계
│       ├── RecipeStepEditor.test.tsx         Create — AC-WEBEDIT-11~23
│       ├── GrindSettingField.tsx             Create — 그라인더·단위·값 + 미리보기
│       ├── GrindSettingField.test.tsx        Create — AC-WEBEDIT-25~29
│       ├── DeleteRecipeDialog.tsx            Create — 확인 모달
│       └── RecipeDetail.tsx                  Modify — 편집·삭제, 포크 후 /edit 이동
│
├── features/gear/
│   ├── queries.ts                            Modify — useGrinders, useGrindPreview
│   └── schema.ts                             Modify — grinderModelSchema, grindConversionSchema
│
├── lib/
│   ├── fieldErrors.ts                        Create — fieldErrors → 폼 필드 매핑
│   └── fieldErrors.test.ts                   Create
│
└── test/fixtures.ts                          Modify — 그라인더·환산·생성 응답 픽스처

docs/specs/2026-08-21-web-recipe-read.md      Modify — AC-WEB-24에 정정 표기
frontend/src/app/recipes/[id]/page.test.tsx   Modify — 기존 포크 이동 테스트를 /edit로
frontend/CLAUDE.md                            Modify — 폼 스택 표기 정정
```

---

## Task 1: 스텝 시퀀스 순수 함수와 폼 상태 타입

**Files:**
- Create: `frontend/src/features/recipe/stepSequence.ts`
- Create: `frontend/src/features/recipe/formState.ts`
- Test: `frontend/src/features/recipe/stepSequence.test.ts`, `frontend/src/features/recipe/formState.test.ts`

**Covers:** 없음 — Task 2가 이 함수들을 컴포넌트 수준에서 AC로 검증한다.

**Interfaces:**
- Produces: `EditableStep`(`uid: string` + 서버 스텝 필드), `StepType`, `appendStep`, `insertStepAfter`, `removeStep`, `moveStep`, `pouredWaterTotal`, `isPouringStep`, `MAX_STEPS` — 그리고 `formState.ts`의 `RecipeFormState`, `emptyFormState`, `fromRecipe`, `toRequestBody`

> **구현 후 정정:** 요청 변환 함수의 이름은 `toRequestSteps`가 아니라 **`toRequestBody`**다(스칼라 필드까지 함께 만든다). Task 4·5가 이 이름을 쓴다.

- [x] **Step 1: 실패하는 테스트 작성**

```ts
// stepSequence.test.ts
import { describe, expect, it } from "vitest";
import { insertStepAfter, moveStep, removeStep, type EditableStep } from "./stepSequence";

function step(over: Partial<EditableStep> & { uid: string }): EditableStep {
  return {
    stepType: "POUR", startAtSeconds: 0, durationSeconds: 10,
    waterG: null, pourTechnique: null, agitation: null, note: null, ...over,
  };
}

describe("insertStepAfter", () => {
  it("자리가 남으면 뒤 스텝을 밀지 않는다", () => {
    const steps = [step({ uid: "a", startAtSeconds: 0 }), step({ uid: "b", startAtSeconds: 45 })];
    const next = insertStepAfter(steps, 0);
    expect(next.map((s) => s.startAtSeconds)).toEqual([0, 10, 45]);
  });

  it("자리가 5초 부족하면 뒤를 정확히 5초 민다", () => {
    const steps = [step({ uid: "a", startAtSeconds: 0 }), step({ uid: "b", startAtSeconds: 15 })];
    const next = insertStepAfter(steps, 0);
    expect(next.map((s) => s.startAtSeconds)).toEqual([0, 10, 20]);
  });
});

describe("removeStep", () => {
  it("다음 스텝 시작까지의 간격만큼 뒤를 당긴다", () => {
    const steps = [
      step({ uid: "a", startAtSeconds: 0 }),
      step({ uid: "b", startAtSeconds: 45 }),
      step({ uid: "c", startAtSeconds: 90 }),
    ];
    expect(removeStep(steps, 1).map((s) => s.startAtSeconds)).toEqual([0, 45]);
  });

  it("마지막 스텝을 지우면 아무것도 움직이지 않는다", () => {
    const steps = [
      step({ uid: "a", startAtSeconds: 0 }),
      step({ uid: "b", startAtSeconds: 45 }),
      step({ uid: "c", startAtSeconds: 90 }),
    ];
    expect(removeStep(steps, 2).map((s) => s.startAtSeconds)).toEqual([0, 45]);
  });
});

describe("moveStep", () => {
  it("소요는 따라가고 시작 시각은 자리에 남는다", () => {
    const steps = [
      step({ uid: "a", stepType: "BLOOM", startAtSeconds: 0, durationSeconds: 10 }),
      step({ uid: "b", stepType: "WAIT", startAtSeconds: 20, durationSeconds: 10 }),
      step({ uid: "c", stepType: "POUR", startAtSeconds: 45, durationSeconds: 20 }),
    ];
    const next = moveStep(steps, 2, -1);
    expect(next[1]).toMatchObject({ uid: "c", startAtSeconds: 20, durationSeconds: 20 });
    expect(next[2]).toMatchObject({ uid: "b", startAtSeconds: 45, durationSeconds: 10 });
  });
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test -- stepSequence`
Expected: FAIL — `Failed to resolve import "./stepSequence"` (파일이 없다)

- [x] **Step 3: 최소 구현**

```ts
// stepSequence.ts
export const MAX_STEPS = 30;
const DEFAULT_DURATION_SECONDS = 10;

export type EditableStep = {
  uid: string;
  stepType: "BLOOM" | "POUR" | "WAIT" | "SWIRL" | "STIR" | "DRAWDOWN";
  startAtSeconds: number;
  durationSeconds: number;
  waterG: number | null;
  pourTechnique: "CENTER" | "SPIRAL" | "PULSE" | "EDGE" | null;
  agitation: "NONE" | "SWIRL" | "STIR" | null;
  note: string | null;
};

const endOf = (s: EditableStep) => s.startAtSeconds + s.durationSeconds;

/** index 뒤의 모든 스텝에 amount를 더한다. amount가 0이면 원본 참조를 유지한다. */
function shiftFrom(steps: EditableStep[], from: number, amount: number): EditableStep[] {
  if (amount === 0) return steps;
  return steps.map((s, i) => (i < from ? s : { ...s, startAtSeconds: s.startAtSeconds + amount }));
}

export function insertStepAfter(steps: EditableStep[], index: number, uid = crypto.randomUUID()): EditableStep[] {
  const previous = steps[index];
  const created: EditableStep = {
    uid, stepType: "POUR", startAtSeconds: endOf(previous),
    durationSeconds: DEFAULT_DURATION_SECONDS,
    waterG: null, pourTechnique: null, agitation: null, note: null,
  };
  const rest = steps.slice(index + 1);
  // 겹치는 만큼만 민다. 자리가 남으면 0이 되어 아무도 안 움직인다.
  const overlap = rest.length === 0 ? 0 : Math.max(0, endOf(created) - rest[0].startAtSeconds);
  return [...steps.slice(0, index + 1), created, ...shiftFrom(rest, 0, overlap)];
}

export function removeStep(steps: EditableStep[], index: number): EditableStep[] {
  const next = steps[index + 1];
  // 마지막 스텝에는 다음이 없으므로 당기기량이 없다.
  const pull = next ? next.startAtSeconds - steps[index].startAtSeconds : 0;
  const rest = shiftFrom(steps.slice(index + 1), 0, -pull);
  return [...steps.slice(0, index), ...rest];
}

export function moveStep(steps: EditableStep[], index: number, delta: -1 | 1): EditableStep[] {
  const target = index + delta;
  if (target < 0 || target >= steps.length) return steps;

  // 시작 시각은 자리에 남고 나머지만 교환한다.
  const slots = steps.map((s) => s.startAtSeconds);
  const swapped = [...steps];
  swapped[index] = steps[target];
  swapped[target] = steps[index];
  const placed = swapped.map((s, i) => ({ ...s, startAtSeconds: slots[i] }));

  const from = Math.min(index, target);
  const rest = placed.slice(from + 1);
  const overlap = rest.length === 0 ? 0 : Math.max(0, endOf(placed[from]) - rest[0].startAtSeconds);
  return [...placed.slice(0, from + 1), ...shiftFrom(rest, 0, overlap)];
}
```

`appendStep`(스텝이 없으면 `BLOOM`·시작 0, 있으면 `POUR`·앞 종료), `pouredWaterTotal`(`BLOOM`·`POUR`의 `waterG` 합), `formState.ts`의 `fromRecipe`(서버 응답 → `EditableStep[]`, `uid` 부여)와 `toRequestSteps`(`uid` 제거)도 같은 방식으로 만든다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test -- stepSequence formState`
Expected: PASS

- [x] **Step 5: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 스텝 시퀀스 밀기·당기기 순수 함수"
```

---

## Task 2: 푸어 스텝 에디터 컴포넌트

**Files:**
- Create: `frontend/src/features/recipe/components/RecipeStepEditor.tsx`
- Test: `frontend/src/features/recipe/components/RecipeStepEditor.test.tsx`

**Covers:** AC-WEBEDIT-11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23

**Interfaces:**
- Consumes: `EditableStep`, `appendStep`, `insertStepAfter`, `removeStep`, `moveStep`, `pouredWaterTotal`, `MAX_STEPS` (Task 1), `formatDuration`·`formatGrams` (`lib/format.ts`)
- Produces: `<RecipeStepEditor steps waterG onChange />` — 상태는 부모가 들고 이 컴포넌트는 `onChange(next)`만 부른다

- [x] **Step 1: 실패하는 테스트 작성**

```tsx
// RecipeStepEditor.test.tsx (일부)
it("AC-WEBEDIT-11 · 첫 스텝은 BLOOM으로 0초에 시작한다", async () => {
  const user = userEvent.setup();
  render(<Harness initial={[]} />);

  await user.click(screen.getByRole("button", { name: "스텝 추가" }));

  expect(screen.getByLabelText("스텝 1 타입")).toHaveValue("BLOOM");
  expect(screen.getByLabelText("스텝 1 시작")).toHaveValue(0);
  expect(screen.getByLabelText("스텝 1 소요")).toHaveValue(10);
  expect(screen.getByLabelText("스텝 1 물량")).toHaveValue(null);
});

it("AC-WEBEDIT-14 · 자리가 5초 부족하면 뒤 스텝이 정확히 5초 밀린다", async () => {
  const user = userEvent.setup();
  render(<Harness initial={[stepAt("a", 0, 10), stepAt("b", 15, 10)]} />);

  await user.click(screen.getByRole("button", { name: "스텝 1 아래에 추가" }));

  expect(screen.getByLabelText("스텝 2 시작")).toHaveValue(10);
  expect(screen.getByLabelText("스텝 3 시작")).toHaveValue(20);
});

it("AC-WEBEDIT-22 · 합계가 모자라면 부족량을 보여준다", () => {
  render(<Harness initial={[pourAt("a", 0, 240)]} waterG={300} />);

  expect(screen.getByText("240.0g / 300.0g")).toBeInTheDocument();
  expect(screen.getByText("60.0g 부족합니다")).toBeInTheDocument();
});
```

`Harness`는 `useState`로 스텝을 들고 `RecipeStepEditor`에 넘기는 이 파일 안의 테스트 전용 래퍼다. AC-WEBEDIT-12·13·15~21·23도 같은 형태로 각각 하나씩 쓴다.

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test -- RecipeStepEditor`
Expected: FAIL — `Failed to resolve import "./RecipeStepEditor"`

- [x] **Step 3: 최소 구현**

스텝 행 하나가 `<li>`이고 `key`는 `step.uid`다. 버튼의 접근명은 스펙의 표를 그대로 쓴다(`스텝 ${i + 1} 위로` 등). 합계 줄은 `pouredWaterTotal(steps)`와 `waterG`를 `formatGrams`로 찍고, 차이가 0이 아닐 때만 `부족합니다`/`초과합니다`를 덧붙인다. 시작·소요 입력은 `type="number"`이고 옆에 `({formatDuration(value)})`를 둔다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test -- RecipeStepEditor`
Expected: PASS, 13 tests

- [x] **Step 5: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 푸어 스텝 에디터 (AC-WEBEDIT 13개)"
```

---

## Task 3: 분쇄도 입력과 마이크론 미리보기

**Files:**
- Create: `frontend/src/features/recipe/components/GrindSettingField.tsx`
- Modify: `frontend/src/features/gear/queries.ts`, `frontend/src/features/gear/schema.ts`
- Modify: `frontend/src/test/fixtures.ts`
- Test: `frontend/src/features/recipe/components/GrindSettingField.test.tsx`

**Covers:** AC-WEBEDIT-25, 26, 27, 28, 29

**Interfaces:**
- Consumes: `authedRequest`, `backendUrl`
- Produces: `useGrinders()`, `useGrindPreview({ grinderModelId, unit, value })` — 셋이 다 있고 `unit !== "MICRON"`일 때만 `enabled`

- [x] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-WEBEDIT-25 · 셋이 채워지면 같은 그라인더로 환산을 부른다", async () => {
  const user = userEvent.setup();
  const bodies: unknown[] = [];
  server.use(
    http.get("http://localhost:8080/api/v1/gear/grinders", () => HttpResponse.json([comandanteC40])),
    http.post("http://localhost:8080/api/v1/gear/grind-conversions", async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(comandanteConversion); // micron: 660
    }),
  );

  renderWithQuery(<Harness />);
  await user.selectOptions(await screen.findByLabelText("그라인더"), "1");
  await user.selectOptions(screen.getByLabelText("분쇄도 단위"), "CLICK");
  await user.type(screen.getByLabelText("분쇄도 값"), "22");

  expect(await screen.findByText(/약 660 µm/)).toBeInTheDocument();
  expect(bodies).toEqual([
    { sourceGrinderModelId: 1, sourceSetting: 22, targetGrinderModelId: 1 },
  ]);
});

it("AC-WEBEDIT-29 · 단위가 마이크론이면 환산을 부르지 않는다", async () => {
  const user = userEvent.setup();
  let called = 0;
  server.use(
    http.get("http://localhost:8080/api/v1/gear/grinders", () => HttpResponse.json([comandanteC40])),
    http.post("http://localhost:8080/api/v1/gear/grind-conversions", () => {
      called += 1;
      return HttpResponse.json(comandanteConversion);
    }),
  );

  renderWithQuery(<Harness />);
  await user.selectOptions(screen.getByLabelText("분쇄도 단위"), "MICRON");
  await user.type(screen.getByLabelText("분쇄도 값"), "800");

  expect(await screen.findByText(/약 800 µm/)).toBeInTheDocument();
  expect(screen.getByText(/추정치/)).toBeInTheDocument();
  expect(called).toBe(0);
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test -- GrindSettingField`
Expected: FAIL — `Failed to resolve import "./GrindSettingField"`

- [x] **Step 3: 최소 구현**

`useGrindPreview`는 `useQuery`이고 `queryKey`가 `["grind-preview", grinderModelId, unit, value]`라 같은 조합은 캐시에서 나온다. `enabled`는 세 값이 모두 채워지고 `unit !== "MICRON"`일 때만 `true`. 오류는 `ApiError`의 `status`/`code`로 분기한다 — `422`면 고정 문구, `400 GRIND_SETTING_OUT_OF_RANGE`면 `error.message` 그대로. **어느 경우에도 저장을 막는 상태를 부모에게 올리지 않는다.**

**픽스처는 실제 응답에서 뜬다:**

```bash
docker compose up -d && (cd backend && ./gradlew bootRun) &
# 토큰을 얻은 뒤
curl -s -H "Authorization: Bearer $TOKEN" localhost:8080/api/v1/gear/grinders | jq '.[0]'
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"sourceGrinderModelId":1,"sourceSetting":22,"targetGrinderModelId":1}' \
  localhost:8080/api/v1/gear/grind-conversions | jq
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test -- GrindSettingField`
Expected: PASS, 5 tests

- [x] **Step 5: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 분쇄도 입력과 마이크론 추정 미리보기 (AC-WEBEDIT 5개)"
```

---

## Task 4: 생성 화면과 서버 오류 표시

**Files:**
- Create: `frontend/src/app/recipes/new/page.tsx`, `frontend/src/features/recipe/components/RecipeForm.tsx`, `frontend/src/lib/fieldErrors.ts`
- Modify: `frontend/src/features/recipe/api.ts`, `frontend/src/features/recipe/schema.ts`
- Test: `frontend/src/app/recipes/new/page.test.tsx`, `frontend/src/lib/fieldErrors.test.ts`

**Covers:** AC-WEBEDIT-01, 07, 08, 24, 30, 31, 32, 33, 36, 37

**Interfaces:**
- Consumes: `RecipeStepEditor`(Task 2), `GrindSettingField`(Task 3), `useRequireSession`, `authedRequest`
- Produces: `createRecipe(body, onSessionLost)`, `<RecipeForm mode="create" | "edit" initial onSubmit />`, `mapFieldErrors(fieldErrors)` → `{ byField: Record<string,string>; byStepIndex: Record<number,string>; unmapped: string[] }`

- [x] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-WEBEDIT-07 · 최소 입력만으로 저장하면 세 필드만 담아 보낸다", async () => {
  const user = userEvent.setup();
  let body: unknown = null;
  server.use(
    http.post("http://localhost:8080/api/v1/recipes", async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ ...createdRecipe, id: 1 }, { status: 201 });
    }),
  );

  renderWithQuery(<RecipeNewPage />);
  await user.type(screen.getByLabelText("제목"), "아침 레시피");
  await user.type(screen.getByLabelText("원두량"), "15");
  await user.type(screen.getByLabelText("물량"), "250");
  await user.click(screen.getByRole("button", { name: "저장" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/recipes/1"));
  expect(body).toEqual({
    title: "아침 레시피", doseG: 15, waterG: 250, visibility: "PRIVATE", steps: [],
  });
});

it("AC-WEBEDIT-31 · 스텝 배열 오류가 그 스텝 행에 붙는다", async () => {
  const user = userEvent.setup();
  server.use(
    http.post("http://localhost:8080/api/v1/recipes", () =>
      HttpResponse.json(
        { code: "INVALID_REQUEST", message: "입력값이 올바르지 않습니다.",
          fieldErrors: [{ field: "steps[2].waterG", message: "붓는 스텝은 물량이 0보다 커야 합니다" }] },
        { status: 400 },
      ),
    ),
  );
  // … 스텝 3개를 만든 뒤 저장
  expect(await screen.findByText("붓는 스텝은 물량이 0보다 커야 합니다")).toBeInTheDocument();
  expect(screen.getByRole("listitem", { name: /스텝 3/ })).toHaveTextContent("붓는 스텝은 물량이 0보다 커야 합니다");
});

it("AC-WEBEDIT-36 · 변경한 뒤에는 새로고침을 경고한다", async () => {
  const user = userEvent.setup();
  renderWithQuery(<RecipeNewPage />);
  await user.type(screen.getByLabelText("제목"), "아침 레시피");

  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);

  expect(event.defaultPrevented).toBe(true);
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test -- recipes/new fieldErrors`
Expected: FAIL — 페이지 모듈이 없다

- [x] **Step 3: 최소 구현**

`mapFieldErrors`는 `/^steps\[(\d+)\]\./`로 인덱스를 뽑고, 알려진 스칼라 필드 이름 집합에 없으면서 배열 표기도 아니면 `unmapped`에 남긴다. 요청 본문은 **빈 값을 키째 제외한다**(백엔드가 `non_null` 정책이라 응답과 대칭이고, `waterTempC: null`을 보내면 검증이 달라질 수 있다). `beforeunload`는 `dirty`가 `true`일 때만 리스너를 걸고 `event.preventDefault()`를 부른다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test -- recipes/new fieldErrors`
Expected: PASS, 10 tests + fieldErrors 단위 테스트

- [x] **Step 5: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 레시피 생성 화면과 서버 오류 표시 (AC-WEBEDIT 10개)"
```

---

## Task 5: 편집 화면

**Files:**
- Create: `frontend/src/app/recipes/[id]/edit/page.tsx`
- Modify: `frontend/src/features/recipe/api.ts` (`updateRecipe`)
- Test: `frontend/src/app/recipes/[id]/edit/page.test.tsx`

**Covers:** AC-WEBEDIT-09, 10

**Interfaces:**
- Consumes: `RecipeForm`(Task 4), `fromRecipe`(Task 1), `fetchRecipe`
- Produces: `updateRecipe(id, body, onSessionLost)`

- [x] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-WEBEDIT-10 · 편집 저장은 PUT으로 스텝 배열을 통째로 보낸다", async () => {
  const user = userEvent.setup();
  let body: { steps: unknown[] } | null = null;
  server.use(
    http.get("http://localhost:8080/api/v1/recipes/1", () => HttpResponse.json(kasuyaRecipe)),
    http.put("http://localhost:8080/api/v1/recipes/1", async ({ request }) => {
      body = (await request.json()) as { steps: unknown[] };
      return HttpResponse.json(kasuyaRecipe);
    }),
  );

  renderWithQuery(<RecipeEditPage params={Promise.resolve({ id: "1" })} />);
  await user.click(await screen.findByRole("button", { name: "스텝 5 삭제" }));
  await user.click(screen.getByRole("button", { name: "저장" }));

  await waitFor(() => expect(body?.steps).toHaveLength(4));
});
```

`params`가 Promise인 것은 Next 16의 규약이다(`frontend/CLAUDE.md`).

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test -- recipes/\\[id\\]/edit`
Expected: FAIL — 페이지 모듈이 없다

- [x] **Step 3: 최소 구현**

`fetchRecipe`로 받은 응답을 `fromRecipe`로 폼 상태에 옮기고 `RecipeForm`에 `mode="edit"`으로 넘긴다. 저장 성공 시 `router.push('/recipes/1')`, 쿼리 캐시의 `["recipe", 1]`과 `["recipes"]`를 무효화한다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test -- recipes`
Expected: PASS

- [x] **Step 5: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 레시피 편집 화면 (AC-WEBEDIT 2개)"
```

---

## Task 6: 목록의 새 레시피 링크와 내 레시피 필터

**Files:**
- Modify: `frontend/src/app/recipes/page.tsx`, `frontend/src/features/recipe/api.ts`
- Test: `frontend/src/app/recipes/page.test.tsx`

**Covers:** AC-WEBEDIT-04, 05

**Interfaces:**
- Consumes: `useMe`(`features/user/queries.ts`)
- Produces: `fetchRecipePage(page, { ownerUserId })` — 기존 시그니처에 옵션을 더한다. 기존 호출부가 깨지지 않게 세 번째 인자로 받는다

- [x] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-WEBEDIT-05 · '내 레시피만'을 켜면 ownerUserId를 붙여 다시 부른다", async () => {
  const user = userEvent.setup();
  const urls: string[] = [];
  server.use(
    http.get("http://localhost:8080/api/v1/users/me", () => HttpResponse.json({ id: 7, nickname: "노" })),
    http.get("http://localhost:8080/api/v1/recipes", ({ request }) => {
      urls.push(new URL(request.url).search);
      return HttpResponse.json(emptyPage);
    }),
  );

  renderWithQuery(<RecipesPage />);
  await user.click(await screen.findByRole("checkbox", { name: "내 레시피만" }));

  await waitFor(() => expect(urls.at(-1)).toBe("?page=0&size=20&ownerUserId=7"));
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test -- recipes/page`
Expected: FAIL — `내 레시피만` 컨트롤이 없다

- [x] **Step 3: 최소 구현**

토글 상태는 `useState`로 두고 `queryKey`에 `ownerUserId`를 포함시켜 켤 때 새 무한 쿼리가 시작되게 한다. 상단 링크는 `<Link href="/recipes/new">새 레시피</Link>`.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test -- recipes/page`
Expected: PASS

- [x] **Step 5: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 목록에 새 레시피 링크와 내 레시피 필터 (AC-WEBEDIT 2개)"
```

---

## Task 7: 상세의 편집·삭제와 포크 이동 변경

**Files:**
- Create: `frontend/src/features/recipe/components/DeleteRecipeDialog.tsx`
- Modify: `frontend/src/features/recipe/components/RecipeDetail.tsx`, `frontend/src/features/recipe/api.ts`
- Modify: `frontend/src/app/recipes/[id]/page.test.tsx` (기존 포크 이동 테스트)
- Modify: `docs/specs/2026-08-21-web-recipe-read.md` (AC-WEB-24에 정정 표기)

**Covers:** AC-WEBEDIT-02, 03, 06, 34, 35

**Interfaces:**
- Consumes: `useMe`, `forkRecipe`
- Produces: `deleteRecipe(id, onSessionLost)`

- [x] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-WEBEDIT-34 · 삭제를 확인하면 요청 후 목록으로 간다", async () => {
  const user = userEvent.setup();
  let deleted = 0;
  server.use(
    http.get("http://localhost:8080/api/v1/recipes/1", () => HttpResponse.json({ ...kasuyaRecipe, ownerUserId: 7 })),
    http.delete("http://localhost:8080/api/v1/recipes/1", () => {
      deleted += 1;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  renderWithQuery(<RecipeDetail id={1} />);
  await user.click(await screen.findByRole("button", { name: "삭제" }));
  await user.click(screen.getByRole("button", { name: "삭제합니다" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/recipes"));
  expect(deleted).toBe(1);
});

it("AC-WEBEDIT-06 · 포크에 성공하면 새 레시피의 편집 화면으로 간다", async () => {
  // 기존 AC-WEB-24 테스트를 이 기대값으로 바꾼다
  await waitFor(() => expect(push).toHaveBeenCalledWith("/recipes/42/edit"));
});
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test -- recipes/\\[id\\]`
Expected: FAIL — `삭제` 버튼이 없고, 포크 이동이 `/recipes/42`라 새 기대값과 어긋난다

- [x] **Step 3: 최소 구현**

`DeleteRecipeDialog`는 열렸을 때만 `role="dialog"` 요소를 렌더링하고 `삭제합니다`·`취소` 두 버튼을 둔다. `취소`는 상태만 닫고 어떤 요청도 만들지 않는다. 편집·삭제는 `me.data?.id === recipe.ownerUserId`일 때만 렌더링한다.

**기존 스펙 정정:** `docs/specs/2026-08-21-web-recipe-read.md`의 `AC-WEB-24` 아래에 정정 블록을 추가한다 — 이동 대상이 `/recipes/42/edit`로 바뀌었고 근거는 `WEBEDIT` 스펙이라는 것. **기존 AC 본문은 지우지 않는다**(append-only 원칙).

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS — 기존 59개 + 이번에 늘어난 것 전부

- [x] **Step 5: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 상세의 편집·삭제와 포크 후 편집 이동 (AC-WEBEDIT 5개)"
```

---

## Task 8: 문서 정정과 최종 검증

**Files:**
- Modify: `frontend/CLAUDE.md` (폼 스택 표기), `docs/specs/2026-08-30-web-recipe-write.md` (`status`)

**Covers:** 없음

- [x] **Step 1: `frontend/CLAUDE.md`의 스택 표 정정**

폼 행을 `React Hook Form + Zod`에서 `useState + Zod(응답 스키마)`로 바꾸고, **왜 그렇게 했는지**(스텝 배열 변환이 본체이고 검증은 서버가 한다)를 한 줄로 남긴다. 현재 상태 문단에 이번 슬라이스를 반영한다.

- [x] **Step 2: 전체 검증**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm test:worker
cd .. && ./scripts/check-spec-coverage.sh
```

Expected: 전부 PASS. 커버리지는 스펙 14건·AC 451개(414 + 37).

- [x] **Step 3: 스펙 `status`를 `구현완료`로**

수동 확인 4개를 끝낸 뒤에 바꾼다. **그 전까지 커버리지 스크립트는 이 스펙의 AC 37개를 건너뛴다.**

- [x] **Step 4: 커밋**

```bash
git add . && git commit -m "docs(web-recipe-write): 폼 스택 정정 + 스펙 구현완료"
```

---

## 완료 기준

- [x] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과
- [x] `cd frontend && pnpm test:worker` 통과 (6개)
- [x] `./scripts/check-spec-coverage.sh` 통과
- [x] 스펙의 `status`를 `구현완료`로 변경
- [ ] 스펙 「수동 확인」 4개 완료

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 37개 중 37개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** `EditableStep`(Task 1)이 Task 2·4·5에서 같은 이름으로 쓰이고, `mapFieldErrors`의 반환 형태(`byField`/`byStepIndex`/`unmapped`)가 Task 4에서만 소비된다. `fetchRecipePage`의 시그니처 확장은 기존 호출부(`page.tsx` 한 곳)와 함께 Task 6에서 바뀐다.

**검증되지 않은 가정:**

1. ~~**`crypto.randomUUID()`가 jsdom과 workerd 양쪽에서 쓸 수 있다.**~~ **✅ 확인됨 — jsdom에도 있다**(probe 테스트로 `typeof globalThis.crypto.randomUUID === "function"`을 확인했다). **그럼에도 구현은 모듈 스코프 카운터를 쓴다** — uid는 리스트 `key`로만 쓰이고 서버에 보내지 않으므로, 값이 재현 가능한 쪽이 실패한 테스트를 다시 돌릴 때 유리하다. Task 1 Step 3의 코드 예시(`crypto.randomUUID()` 기본 인자)는 실제 구현과 다르다.
2. ~~**`user.type`으로 `type="number"` 입력에 값을 넣었을 때 `toHaveValue(15)`가 숫자로 온다.**~~ **✅ 확인됨** — props로 준 값(Task 2)과 `user.type`으로 친 값(Task 4) 모두 숫자 단언이 통과한다.
3. ~~**빈 값을 키째 제외하는 요청 본문이 백엔드에서 통과한다.**~~ **✅ 실제 백엔드로 확인됨(2026-08-30)** — `{title, doseG, waterG, visibility, steps:[]}`를 `POST /api/v1/recipes`에 보내 **201**을 받았고 `ratio`가 `16.7`로 계산됐다. 응답에도 `waterTempC` 키가 없어 요청·응답이 대칭이다. **곁가지 발견:** DB에 없는 사용자 id로 서명한 유효 JWT로 같은 요청을 보내면 400이 아니라 **500**이 난다(실사용에서는 토큰이 로그인으로만 발급되므로 나지 않는다).
4. **`useMe`가 목록 화면에서도 이미 동작한다.** 상세에서는 쓰이고 있으나 목록에서는 처음 부른다. `ownerUserId` 필터가 `me`를 기다려야 하므로 로딩 순서를 봐야 한다.
5. ~~**스텝 행을 `getByRole("listitem", { name: /스텝 3/ })`로 잡을 수 있다.**~~ **✅ 확인됨** — `<li>`에 `aria-label={`스텝 ${number}`}`를 주면 잡힌다(AC-WEBEDIT-31).
6. ~~**`beforeunload`의 `defaultPrevented`로 경고 여부를 검증할 수 있다.**~~ **✅ 확인됨** — jsdom에서 `dispatchEvent` 후 `defaultPrevented`가 그대로 읽힌다(AC-WEBEDIT-36·37).

**새로 정해진 것:** 미리보기 환산 호출에 **400ms 디바운스**를 건다(`lib/useDebounced.ts`). 스펙·계획이 열어둔 결정이었고, `queryKey` 캐시만으로는 부족하다는 것을 Task 3의 테스트가 잡았다 — `22`를 치면 `2`·`22`로 요청이 두 번 나갔다.

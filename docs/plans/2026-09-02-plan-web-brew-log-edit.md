# 브루잉 로그 편집 화면 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-02-web-brew-log-edit.md`

**Goal:** 저장한 브루잉 로그를 열어 실측값·평가·공개범위를 고치고, 남의 로그에서는 편집·삭제가 보이지 않는다.

**Architecture:** 백엔드는 손대지 않는다 — `PATCH /brew-logs/{id}`가 이미 있다. 작성 폼에서 **두 화면이 공유하는 입력칸 묶음을 `BrewLogFields`로 뽑아내고**, 편집 컨테이너(`BrewLogEditor`)를 따로 둔다. `RecipeForm`/`RecipeEditor`가 이미 쓰는 구조다. 변경분 판정은 **폼 상태끼리 비교**한다 — 요청 본문끼리 비교하면 `brewedAt`이 `Instant → datetime-local → Instant`를 왕복하며 초 단위가 잘려 건드리지도 않은 필드가 바뀐 것으로 보인다.

**작업 위치:** `frontend/` (백엔드 변경 없음)

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-WEBLOGEDIT-01 | 내 로그에 편집 링크 | Task 1 | 페이지 테스트 |
| AC-WEBLOGEDIT-02 | 남의 로그엔 편집·삭제 없음 | Task 1 | 페이지 테스트 |
| AC-WEBLOGEDIT-03 | 내 로그엔 삭제 유지 | Task 1 | 페이지 테스트 |
| AC-WEBLOGEDIT-04 | 저장된 값이 채워진다 | Task 3 | 페이지 테스트 |
| AC-WEBLOGEDIT-05 | 공개범위 3옵션·현재값 | Task 3 | 페이지 테스트 |
| AC-WEBLOGEDIT-06 | 레시피·원두 잠금 | Task 3 | 페이지 테스트 |
| AC-WEBLOGEDIT-17 | 없는 로그는 오류 화면 | Task 3 | 페이지 테스트 |
| AC-WEBLOGEDIT-18 | 편집 화면엔 탭바 없음 | Task 3 | 컴포넌트 테스트 |
| AC-WEBLOGEDIT-07 | 바뀐 필드만 본문에 | Task 4 | 페이지 테스트 |
| AC-WEBLOGEDIT-08 | 공개범위만 바꾸면 그것만 | Task 4 | 페이지 테스트 |
| AC-WEBLOGEDIT-09 | 저장 성공 시 상세로 | Task 4 | 페이지 테스트 |
| AC-WEBLOGEDIT-10 | 취소하면 상세로 | Task 4 | 페이지 테스트 |
| AC-WEBLOGEDIT-11 | 변경 없으면 요청 0회 | Task 4 | 페이지 테스트 |
| AC-WEBLOGEDIT-12 | 비우면 안내가 붙는다 | Task 5 | 페이지 테스트 |
| AC-WEBLOGEDIT-13 | 지우기 시도 중 저장 비활성 | Task 5 | 페이지 테스트 |
| AC-WEBLOGEDIT-14 | 다시 넣으면 저장 살아난다 | Task 5 | 페이지 테스트 |
| AC-WEBLOGEDIT-15 | 원래 빈 칸은 막지 않는다 | Task 5 | 페이지 테스트 |
| AC-WEBLOGEDIT-16 | 서버 검증 오류가 그 칸에 | Task 6 | 페이지 테스트 |

**스펙의 AC 18개 중 18개가 매핑됐다.**

---

## Global Constraints

- **백엔드를 건드리지 않는다.** `PATCH`도 `DELETE`도 이미 있고 `BLEDIT` 계열 인수 조건으로 검증돼 있다.
- **`any` 금지, `as` 단언 금지.** 응답 타입은 Zod 스키마에서 `z.infer`로 뽑는다.
- **API는 MSW로 모킹한다.** 이번에 새로 필요한 픽스처는 없다 — `test/fixtures.ts`의 `brewLogWithTds`를 쓴다. 다만 **`visibility` 값이 실제 응답과 같은지 Task 3 Step 1에서 확인한다.**
- **AC ID를 소스 주석에 적지 않는다.** `check-spec-coverage.sh`가 `frontend/src` 전체를 grep하므로 주석에 ID만 있어도 통과해 버린다.
- **다른 스펙의 AC ID를 이 계획 본문에 문자 그대로 쓰지 않는다.** 스크립트가 스펙 문서에서 ID를 긁을 때 남의 AC를 이 기능의 것으로 센다(2026-09-02에 실제로 겪었다).
- **변경분은 폼 상태끼리 비교한다.** 요청 본문끼리 비교하면 `brewedAt` 왕복에서 초가 잘려 거짓 변경이 생긴다.
- 커밋 전 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. **새 라우트(`/brews/[id]/edit`)가 생기므로 `pnpm test:worker`도 반드시 돌린다.**

---

## File Structure

```
frontend/src/
├── app/brews/[id]/
│   ├── page.test.tsx                         Modify — AC 01·02·03
│   └── edit/
│       ├── page.tsx                          Create — 서버 컴포넌트, params 풀기
│       └── page.test.tsx                     Create — AC 04~17
│
├── components/layout/
│   └── BottomNav.test.tsx                    Modify — AC 18
│
└── features/brewlog/
    ├── api.ts                                Modify — patchBrewLog
    ├── schema.ts                             Modify — visibility를 enum으로
    ├── formState.ts                          Modify — 편집용 상태·변환 3개
    ├── formState.test.ts                     Create — 순수 함수 단위 테스트
    └── components/
        ├── BrewLogFields.tsx                 Create — 두 화면이 공유하는 입력칸
        ├── BrewLogForm.tsx                   Modify — 공유 부분을 넘긴다
        ├── BrewLogEditor.tsx                 Create — 편집 컨테이너
        └── BrewDetail.tsx                    Modify — 소유 판정, 편집 링크
```

---

## Task 1: 소유 판정과 편집 진입점

**Files:**
- Modify: `frontend/src/features/brewlog/components/BrewDetail.tsx`
- Test: `frontend/src/app/brews/[id]/page.test.tsx`

**Covers:** AC-WEBLOGEDIT-01, 02, 03

**Interfaces:**
- Consumes: `useMe(onSessionLost)` (기존, `features/user/queries`) — `{ data?: { id: number } }`
- Produces: 없음. 이후 태스크가 만드는 `/brews/[id]/edit`로 가는 링크만 남긴다

- [x] **Step 1: 실패하는 테스트 작성**

`page.test.tsx`의 `baseHandlers()`에 `GET /users/me`가 이미 있는지 확인하고, 없으면 더한다(레시피 상세 테스트가 쓰는 것과 같은 모양이다).

```tsx
it("AC-WEBLOGEDIT-01 · 내 로그 상세에 편집 링크가 있다", async () => {
  server.use(
    http.get(`${BASE}/brew-logs/42`, () =>
      HttpResponse.json({ ...brewLogWithTds, id: 42, userId: 11 }),
    ),
    http.get(`${BASE}/users/me`, () =>
      HttpResponse.json({
        id: 11,
        nickname: "테스터",
        role: "USER",
        createdAt: "2026-08-21T00:00:00Z",
      }),
    ),
  );

  await renderDetail();

  expect(await screen.findByRole("link", { name: "편집" })).toHaveAttribute(
    "href",
    "/brews/42/edit",
  );
});

it("AC-WEBLOGEDIT-02 · 남의 로그에는 편집도 삭제도 없다", async () => {
  server.use(
    http.get(`${BASE}/brew-logs/42`, () =>
      HttpResponse.json({ ...brewLogWithTds, id: 42, userId: 99 }),
    ),
    http.get(`${BASE}/users/me`, () =>
      HttpResponse.json({
        id: 11,
        nickname: "테스터",
        role: "USER",
        createdAt: "2026-08-21T00:00:00Z",
      }),
    ),
  );

  await renderDetail();

  // 본문이 그려진 뒤에 부재를 본다 — 로딩 중이면 무엇이든 없다
  await screen.findByText("실측값");
  expect(screen.queryByRole("link", { name: "편집" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
});

it("AC-WEBLOGEDIT-03 · 내 로그에는 삭제가 그대로 있다", async () => {
  server.use(
    http.get(`${BASE}/brew-logs/42`, () =>
      HttpResponse.json({ ...brewLogWithTds, id: 42, userId: 11 }),
    ),
    http.get(`${BASE}/users/me`, () =>
      HttpResponse.json({
        id: 11,
        nickname: "테스터",
        role: "USER",
        createdAt: "2026-08-21T00:00:00Z",
      }),
    ),
  );

  await renderDetail();

  expect(await screen.findByRole("button", { name: "삭제" })).toBeInTheDocument();
});
```

`renderDetail()`이 `id: "42"`를 쓰는지 확인하고, 다른 id를 쓰고 있으면 위 핸들러의 경로를 그 id에 맞춘다.

- [x] **Step 2: 실패 확인**

Run: `pnpm vitest run 'src/app/brews/[id]/page.test.tsx'`
Expected: FAIL — AC-01은 `편집` 링크가 없어서, AC-02는 `삭제` 버튼이 소유와 무관하게 보여서. AC-03은 이미 통과한다(회귀 방지용이다).

- [x] **Step 3: 최소 구현**

`BrewDetail.tsx`:

```tsx
import { useMe } from "@/features/user/queries";
```

```tsx
  const me = useMe(onSessionLost);
```

`const log = logQuery.data;` 아래에 판정을 둔다. **레시피 상세의 `isMine`과 같은 모양으로 쓴다** — `me`가 아직 안 왔으면 남의 것으로 본다(파괴적 버튼은 늦게 나타나는 편이 안전하다):

```tsx
  const isMine = me.data !== undefined && log.userId === me.data.id;
```

기존 `삭제` 버튼을 편집 링크와 함께 감싼다:

```tsx
      {isMine && (
        <div className="flex items-center gap-2">
          <Link
            href={`/brews/${id}/edit`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            편집
          </Link>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-800"
          >
            삭제
          </button>
        </div>
      )}
```

기존 버튼에 있던 `self-start`는 감싼 `div`로 옮기지 않아도 된다 — `Shell`이 `flex flex-col`이라 자식이 가로로 늘어나므로 `self-start`를 `div`에 붙인다.

- [x] **Step 4: 통과 확인**

Run: `pnpm vitest run 'src/app/brews/[id]/page.test.tsx'`
Expected: PASS. 기존 삭제 관련 테스트가 함께 통과해야 한다 — **그 테스트들이 쓰는 픽스처의 `userId`가 `GET /users/me`의 `id`와 같은지 확인한다.** 다르면 그 테스트들이 `삭제` 버튼을 못 찾아 깨진다. 이때 픽스처를 소유 상태로 맞추는 것이 옳다(2026-09-01에 `AC-WEBBREW-46`에서 같은 일을 했다).

- [x] **Step 5: 커밋** — `fix(web): 내 로그에서만 편집·삭제가 보인다 (AC-WEBLOGEDIT 3개)`

---

## Task 2: 두 화면이 공유할 입력칸 분리

**Files:**
- Create: `frontend/src/features/brewlog/components/BrewLogFields.tsx`
- Modify: `frontend/src/features/brewlog/components/BrewLogForm.tsx`

**Covers:** 없음 — 순수 리팩터다. **기존 테스트가 하나도 깨지지 않는 것이 이 태스크의 인수 조건이다.**

**Interfaces:**
- Produces: `<BrewLogFields state grinders fieldErrors onChange onAddGrinder beanSlot />`
  ```tsx
  interface BrewLogFieldsProps {
    state: BrewLogFormState;
    grinders: UserGrinder[];
    fieldErrors: ReturnType<typeof mapFieldErrors> | null;
    onChange: <K extends keyof BrewLogFormState>(
      key: K,
      value: BrewLogFormState[K],
    ) => void;
    /** 없으면 `+ 그라인더 등록` 버튼을 그리지 않는다 — 편집 화면은 모달을 갖지 않는다 */
    onAddGrinder?: () => void;
    /** `내린 시각`과 `그라인더` 사이에 끼울 것. 작성 화면은 원두 선택란을, 편집 화면은 잠긴 원두 표시를 넣는다 */
    beanSlot: React.ReactNode;
  }
  ```

  **`state`의 타입이 `BrewLogFormState`인 점이 중요하다.** Task 3이 넘기는 `BrewLogEditState`는 그것을 확장한 타입이라 그대로 들어간다. `onChange`의 제네릭도 `BrewLogEditState`의 `set`을 받아준다.
- Consumes: 기존 `NumberField`·`RatingInput`·`SENSORY_AXES`·`grinderLabel`

- [x] **Step 1: 옮길 범위를 확정한다**

`BrewLogForm.tsx`의 `Fields` 안에서 **아래 네 덩어리만** 새 파일로 옮긴다. 나머지(원두 fieldset, 두 모달, 저장 버튼, 취소 버튼)는 작성 화면에 남긴다.

| 옮기는 것 | 지금 위치 |
|---|---|
| `내린 시각` 입력 | `<label>` 하나 |
| `그라인더` fieldset (select + `+ 그라인더 등록` + `분쇄도 값`) | `<fieldset>` |
| `실측값` fieldset (7칸) | `<fieldset>` |
| `평가` fieldset (별점·`맛 자세히`·5축·메모) | `<fieldset>` |

`+ 그라인더 등록` 버튼은 함께 옮기되 `onClick`을 `onAddGrinder` prop으로 바꾸고 **`onAddGrinder`가 없으면 버튼을 그리지 않는다**(`{onAddGrinder && <button …>}`). 편집 화면은 이 모달을 갖지 않는다. **모달 자체(`UserGrinderDialog`)는 옮기지 않는다** — 등록 성공 후 처리가 화면마다 다르다.

`NumberField`·`SENSORY_AXES`·`grinderLabel`도 새 파일로 옮긴다(`BrewLogForm`에서 더는 쓰지 않는다). `BrewLogFields.tsx`에서 `export`하지 않는다 — 한 파일에 하나의 컴포넌트만 export한다.

- [x] **Step 2: 리팩터 전 초록을 확인한다**

Run: `pnpm vitest run src/app/brews src/features/brewlog`
Expected: PASS. **이 숫자를 적어둔다.** Step 4에서 같은 숫자가 나와야 한다.

- [x] **Step 3: 옮긴다**

`BrewLogFields.tsx`는 `"use client"`로 시작하고 위 네 덩어리를 그대로 담는다. 내부에서 `state`·`fieldErrors`를 읽고 `onChange(key, value)`로 쓴다 — `Fields`의 `set`을 그대로 넘기면 된다.

`BrewLogForm.tsx`의 `Fields`에서는 그 자리에 다음을 놓는다:

```tsx
      <BrewLogFields
        state={state}
        grinders={grinders}
        fieldErrors={fieldErrors}
        onChange={set}
        onAddGrinder={() => setAddingGrinder(true)}
      />
```

**순서를 바꾸지 않는다.** 원두 fieldset은 지금 위치(내린 시각과 그라인더 사이)에 그대로 둬야 하므로, `BrewLogFields`를 두 번 나눠 부르지 말고 **원두 fieldset을 `children`으로 받는다**:

```tsx
interface BrewLogFieldsProps {
  // …위와 같음
  /** `내린 시각`과 `그라인더` 사이에 끼울 것. 작성 화면은 원두 선택란을, 편집 화면은 잠긴 원두 표시를 넣는다 */
  beanSlot: React.ReactNode;
}
```

`BrewLogFields` 안에서 `내린 시각` 바로 뒤에 `{beanSlot}`을 렌더한다.

- [x] **Step 4: 통과 확인 — 숫자가 같아야 한다**

Run: `pnpm vitest run src/app/brews src/features/brewlog`
Expected: PASS, Step 2와 **같은 개수**. 하나라도 줄었으면 옮기다 빠뜨린 것이다.

Run: `pnpm typecheck && pnpm lint`
Expected: 통과

- [x] **Step 5: 커밋** — `refactor(web): 브루잉 로그 입력칸을 두 화면이 공유하도록 분리`

---

## Task 3: 편집 화면 뼈대 — 초기값과 잠금

**Files:**
- Create: `frontend/src/app/brews/[id]/edit/page.tsx`, `frontend/src/app/brews/[id]/edit/page.test.tsx`
- Create: `frontend/src/features/brewlog/components/BrewLogEditor.tsx`
- Modify: `frontend/src/features/brewlog/schema.ts`, `frontend/src/features/brewlog/formState.ts`
- Create: `frontend/src/features/brewlog/formState.test.ts`
- Modify: `frontend/src/components/layout/BottomNav.test.tsx`

**Covers:** AC-WEBLOGEDIT-04, 05, 06, 17, 18

**Interfaces:**
- Produces: `formStateFromLog(log: BrewLog): BrewLogEditState`
  ```ts
  export type BrewLogEditState = BrewLogFormState & {
    visibility: "PRIVATE" | "FRIENDS" | "PUBLIC";
  };
  ```
- Produces: `<BrewLogEditor id={42} />`
- Consumes: Task 2의 `<BrewLogFields />`, 기존 `fetchBrewLog`·`useUserGrinders`

- [ ] **Step 1: 실제 응답에서 `visibility` 값을 확인한다**

```bash
docker compose up -d
(cd backend && SPRING_PROFILES_ACTIVE=local ./gradlew bootRun) &
curl -s -H "Authorization: Bearer $TOKEN" localhost:8080/api/v1/brew-logs/2 | jq '.visibility, .brewedAt'
```

`visibility`가 `"PRIVATE"`인지, `brewedAt`이 `2026-08-31T09:00:00Z` 같은 Instant 문자열인지 확인한다. **로컬 JWT는 `application-local.yml`의 고정 시크릿(HS256)으로 만들고 `sub`는 `11`이다.**

- [ ] **Step 2: 실패하는 테스트 작성**

`formState.test.ts` — 순수 함수부터. **AC ID를 붙이지 않는다**(AC는 페이지 테스트가 갖는다):

```ts
import { describe, expect, it } from "vitest";
import { brewLogWithTds } from "@/test/fixtures";
import { formStateFromLog } from "./formState";
import { brewLogSchema } from "./schema";

describe("formStateFromLog", () => {
  it("Instant를 datetime-local 문자열로 바꾼다", () => {
    const state = formStateFromLog({ ...brewLogWithTds, brewedAt: "2026-08-31T09:00:00Z" });

    // 로컬 시각이라 실행 환경의 오프셋을 탄다 — 형식만 본다
    expect(state.brewedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("5축이 하나라도 있으면 펼친 상태로 연다", () => {
    expect(formStateFromLog({ ...brewLogWithTds, acidity: 4 }).sensoryExpanded).toBe(true);
  });

  it("5축이 하나도 없으면 접은 상태로 연다", () => {
    const withoutSensory: Record<string, unknown> = { ...brewLogWithTds };
    for (const key of ["acidity", "sweetness", "body", "bitterness", "aftertaste"]) {
      delete withoutSensory[key];
    }

    expect(formStateFromLog(brewLogSchema.parse(withoutSensory)).sensoryExpanded).toBe(false);
  });

  it("없는 키는 null이 된다", () => {
    const withoutTds: Record<string, unknown> = { ...brewLogWithTds };
    delete withoutTds.tdsPercent;

    expect(formStateFromLog(brewLogSchema.parse(withoutTds)).tdsPercent).toBeNull();
  });
});
```

`page.test.tsx`:

```tsx
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setAccessToken } from "@/lib/session";
import { brewLogWithTds, myComandante } from "@/test/fixtures";
import { server } from "@/test/msw-server";
import { renderWithQuery } from "@/test/render";
import BrewEditPage from "./page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/brews/42/edit",
}));

const BASE = "http://localhost:8080/api/v1";

/** 이 화면이 항상 부르는 것들. 개별 테스트는 필요한 것만 덮어쓴다. */
function baseHandlers() {
  return [
    http.get(`${BASE}/brew-logs/42`, () =>
      HttpResponse.json({ ...brewLogWithTds, id: 42, userId: 11 }),
    ),
    http.get(`${BASE}/gear/user-grinders`, () =>
      HttpResponse.json([{ ...myComandante, id: 5 }]),
    ),
  ];
}

/** 페이지는 async 서버 컴포넌트다 — 먼저 실행해 params를 푼 뒤 그 결과를 렌더한다. */
function renderEditPage() {
  return BrewEditPage({ params: Promise.resolve({ id: "42" }) }).then((ui) =>
    renderWithQuery(ui),
  );
}

beforeEach(() => {
  push.mockClear();
  clearSession();
  setAccessToken("a.b.c");
  server.use(...baseHandlers());
});

describe("BrewEditPage", () => {
  it("AC-WEBLOGEDIT-04 · 저장된 값이 채워진 채로 열린다", async () => {
    await renderEditPage();

    expect(await screen.findByLabelText("원두량")).toHaveValue(20);
    expect(screen.getByLabelText("물량")).toHaveValue(300);
    expect(screen.getByLabelText("물 온도")).toHaveValue(92);
    expect(screen.getByLabelText("추출 시간")).toHaveValue(210);
    expect(screen.getByLabelText("TDS")).toHaveValue(1.35);
  });

  it("AC-WEBLOGEDIT-05 · 공개범위 세 옵션이 있고 저장된 값이 골라져 있다", async () => {
    await renderEditPage();

    const select = await screen.findByLabelText("공개 범위");
    expect(select).toHaveValue("PRIVATE");
    for (const label of ["나만 보기", "맞팔로우만", "전체 공개"]) {
      expect(within(select).getByRole("option", { name: label })).toBeInTheDocument();
    }
  });

  it("AC-WEBLOGEDIT-06 · 레시피와 원두는 바꿀 수 없다", async () => {
    await renderEditPage();

    await screen.findByLabelText("원두량");
    expect(screen.queryByRole("combobox", { name: "원두" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "레시피" })).not.toBeInTheDocument();
  });

  it("AC-WEBLOGEDIT-17 · 없는 로그를 편집하려 하면 오류 화면이 뜬다", async () => {
    server.use(
      http.get(`${BASE}/brew-logs/42`, () =>
        HttpResponse.json({ code: "NOT_FOUND", message: "없습니다", fieldErrors: [] }, { status: 404 }),
      ),
    );

    await renderEditPage();

    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.queryByLabelText("원두량")).not.toBeInTheDocument();
  });
});
```

`ErrorState`의 재시도 버튼 문구가 `다시 시도`가 맞는지 그 파일에서 확인하고, 다르면 실제 문구로 바꾼다.

`BottomNav.test.tsx`에 한 줄 더한다:

```tsx
  it("AC-WEBLOGEDIT-18 · 로그 편집 화면에는 탭바가 없다", () => {
    pathname = "/brews/42/edit";

    render(<BottomNav />);

    expect(screen.queryByRole("link", { name: "기록" })).not.toBeInTheDocument();
  });
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm vitest run 'src/app/brews/[id]/edit' src/features/brewlog/formState.test.ts src/components/layout`
Expected: FAIL — 페이지·`formStateFromLog`가 없어서. **AC-18은 통과한다** — 탭바가 `/edit`로 끝나는 경로를 이미 숨기기 때문이다. 회귀 방지용이므로 그대로 둔다.

- [ ] **Step 4: 최소 구현**

`schema.ts` — `visibility`를 좁힌다:

```ts
  visibility: z.enum(["PRIVATE", "FRIENDS", "PUBLIC"]),
```

`formState.ts`에 더한다:

```ts
export type BrewLogEditState = BrewLogFormState & {
  visibility: "PRIVATE" | "FRIENDS" | "PUBLIC";
};

/** 저장된 로그를 편집 폼 상태로 되돌린다. 없는 키는 `null`이 된다 — 백엔드가 `non_null`로 응답한다. */
export function formStateFromLog(log: BrewLog): BrewLogEditState {
  return {
    recipeId: log.recipeId,
    brewedAt: toDateTimeLocal(new Date(log.brewedAt)),
    beanBatchId: log.beanBatchId ?? null,
    userGrinderId: log.userGrinderId ?? null,
    actualGrindSettingValue: log.actualGrindSettingValue ?? null,
    actualDoseG: log.actualDoseG,
    actualWaterG: log.actualWaterG,
    actualWaterTempC: log.actualWaterTempC,
    actualTotalTimeSeconds: log.actualTotalTimeSeconds ?? null,
    actualDrawdownSeconds: log.actualDrawdownSeconds ?? null,
    beverageWeightG: log.beverageWeightG ?? null,
    tdsPercent: log.tdsPercent ?? null,
    rating: log.rating ?? null,
    overallNote: log.overallNote ?? "",
    // 하나라도 값이 있으면 펼쳐서 연다. 접힌 채로 열면 사용자가 넣어둔 평가가 안 보인다.
    sensoryExpanded:
      log.acidity !== undefined ||
      log.sweetness !== undefined ||
      log.body !== undefined ||
      log.bitterness !== undefined ||
      log.aftertaste !== undefined,
    acidity: log.acidity ?? null,
    sweetness: log.sweetness ?? null,
    body: log.body ?? null,
    bitterness: log.bitterness ?? null,
    aftertaste: log.aftertaste ?? null,
    visibility: log.visibility,
  };
}
```

`BrewLogEditor.tsx` — 데이터 로딩 껍데기와 폼:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorState } from "@/components/ErrorState";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { useUserGrinders } from "@/features/gear/queries";
import type { UserGrinder } from "@/features/gear/schema";
import { fetchBrewLog } from "../api";
import { formStateFromLog, type BrewLogEditState } from "../formState";
import type { BrewLog } from "../schema";
import { BrewLogFields } from "./BrewLogFields";

const VISIBILITY_LABELS = {
  PRIVATE: "나만 보기",
  FRIENDS: "맞팔로우만",
  PUBLIC: "전체 공개",
} as const;

export function BrewLogEditor({ id }: { id: number }) {
  const { ready, onSessionLost } = useRequireSession();

  const log = useQuery({
    queryKey: ["brew-log", id],
    queryFn: () => fetchBrewLog(id, onSessionLost),
    enabled: ready,
  });
  const grinders = useUserGrinders(onSessionLost);

  const failure = log.error ?? grinders.error;
  if (failure) {
    return (
      <Shell>
        <ErrorState
          error={failure}
          onRetry={() => {
            void log.refetch();
            void grinders.refetch();
          }}
        />
      </Shell>
    );
  }

  if (!ready || !log.data || !grinders.data) {
    return <Shell>{null}</Shell>;
  }

  return (
    <Shell>
      <Fields log={log.data} grinders={grinders.data} onSessionLost={onSessionLost} />
    </Shell>
  );
}

function Fields({
  log,
  grinders,
  onSessionLost,
}: {
  log: BrewLog;
  grinders: UserGrinder[];
  onSessionLost: () => void;
}) {
  // 초기값은 마운트 시점에 한 번만 만든다. 저장 후 캐시가 갱신돼도 입력 중인 값을 덮지 않는다.
  const [initial] = useState<BrewLogEditState>(() => formStateFromLog(log));
  const [state, setState] = useState<BrewLogEditState>(initial);

  const set = <K extends keyof BrewLogEditState>(key: K, value: BrewLogEditState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex flex-col gap-5">
      <BrewLogFields
        state={state}
        grinders={grinders}
        fieldErrors={null}
        onChange={set}
        beanSlot={
          <dl className="flex flex-wrap gap-x-4 text-sm">
            <div className="flex items-center gap-1">
              <dt className="text-neutral-500">레시피</dt>
              <dd>{state.recipeId}</dd>
            </div>
            {state.beanBatchId !== null && (
              <div className="flex items-center gap-1">
                <dt className="text-neutral-500">원두</dt>
                <dd>{state.beanBatchId}</dd>
              </div>
            )}
          </dl>
        }
      />

      <label className="flex items-center gap-2 text-sm">
        <span className="w-20 text-neutral-500">공개 범위</span>
        <select
          aria-label="공개 범위"
          value={state.visibility}
          onChange={(e) => set("visibility", e.target.value as BrewLogEditState["visibility"])}
          className="rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700"
        >
          {Object.entries(VISIBILITY_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <h1 className="text-xl font-semibold">기록 편집</h1>
      {children}
    </main>
  );
}
```

**`as` 단언이 하나 들어간다** — `select`의 `e.target.value`는 `string`이다. 프로젝트 규칙이 `as`를 금지하므로, 대신 좁히는 함수를 쓴다:

```tsx
function toVisibility(value: string): BrewLogEditState["visibility"] {
  return value === "FRIENDS" || value === "PUBLIC" ? value : "PRIVATE";
}
```

`onChange={(e) => set("visibility", toVisibility(e.target.value))}`

`onAddGrinder`를 넘기지 않았으므로 `+ 그라인더 등록` 버튼은 그려지지 않는다(Task 2에서 그렇게 만들었다). 위 코드의 `onAddGrinder={() => undefined}`를 **지운다.**

`app/brews/[id]/edit/page.tsx`:

```tsx
import { BrewLogEditor } from "@/features/brewlog/components/BrewLogEditor";

/** Next 16에서 params는 Promise다. 여기서 풀어 클라이언트 컴포넌트에 숫자로 넘긴다. */
export default async function BrewEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BrewLogEditor id={Number(id)} />;
}
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm vitest run 'src/app/brews/[id]/edit' src/features/brewlog src/components/layout`
Expected: PASS — 페이지 4개 + `formStateFromLog` 4개 + `BottomNav` 12개

- [ ] **Step 6: 커밋** — `feat(web): 로그 편집 화면 뼈대와 초기값 (AC-WEBLOGEDIT 5개)`

---

## Task 4: 저장 — 바뀐 필드만 보내기

**Files:**
- Modify: `frontend/src/features/brewlog/api.ts`, `frontend/src/features/brewlog/formState.ts`, `frontend/src/features/brewlog/formState.test.ts`
- Modify: `frontend/src/features/brewlog/components/BrewLogEditor.tsx`
- Test: `frontend/src/app/brews/[id]/edit/page.test.tsx`

**Covers:** AC-WEBLOGEDIT-07, 08, 09, 10, 11

**Interfaces:**
- Produces: `toPatchBody(initial: BrewLogEditState, current: BrewLogEditState): BrewLogPatchBody`
  ```ts
  export type BrewLogPatchBody = Partial<
    Omit<BrewLogRequestBody, "recipeId" | "beanBatchId">
  > & { visibility?: "PRIVATE" | "FRIENDS" | "PUBLIC" };
  ```
- Produces: `patchBrewLog(id: number, body: BrewLogPatchBody, onSessionLost?: () => void): Promise<BrewLog>`

- [ ] **Step 1: 실패하는 테스트 작성**

`formState.test.ts`에 더한다:

```ts
describe("toPatchBody", () => {
  const initial = formStateFromLog(brewLogWithTds);

  it("아무것도 안 바꾸면 빈 객체다", () => {
    expect(toPatchBody(initial, initial)).toEqual({});
  });

  it("바꾼 것만 담는다", () => {
    expect(toPatchBody(initial, { ...initial, rating: 4.5 })).toEqual({ rating: 4.5 });
  });

  it("공개범위도 담는다", () => {
    expect(toPatchBody(initial, { ...initial, visibility: "FRIENDS" })).toEqual({
      visibility: "FRIENDS",
    });
  });

  it("recipeId와 beanBatchId는 절대 담지 않는다", () => {
    const changed = { ...initial, recipeId: 99, beanBatchId: 99, rating: 4.5 };

    expect(toPatchBody(initial, changed)).toEqual({ rating: 4.5 });
  });

  it("brewedAt을 건드리지 않으면 담기지 않는다", () => {
    // 왕복(Instant → datetime-local → Instant)에서 초가 잘려도 거짓 변경이 생기면 안 된다
    expect(toPatchBody(initial, { ...initial })).not.toHaveProperty("brewedAt");
  });

  it("brewedAt을 바꾸면 Instant 문자열로 담는다", () => {
    const body = toPatchBody(initial, { ...initial, brewedAt: "2026-09-01T07:30" });

    expect(body.brewedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
```

`page.test.tsx`에 더한다:

```tsx
/** PATCH 본문을 잡는다. */
function capturePatch() {
  const captured: { body: Record<string, unknown> | null; calls: number } = {
    body: null,
    calls: 0,
  };
  server.use(
    http.patch(`${BASE}/brew-logs/42`, async ({ request }) => {
      captured.calls += 1;
      captured.body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ...brewLogWithTds, id: 42, userId: 11 });
    }),
  );
  return captured;
}

it("AC-WEBLOGEDIT-07 · 바뀐 필드만 본문에 담긴다", async () => {
  const user = userEvent.setup();
  const captured = capturePatch();
  server.use(
    http.get(`${BASE}/brew-logs/42`, () =>
      HttpResponse.json({ ...brewLogWithTds, id: 42, userId: 11, rating: 3.5 }),
    ),
  );

  await renderEditPage();
  await user.click(await screen.findByRole("button", { name: "별점 4" }));
  await user.click(screen.getByRole("button", { name: "저장" }));

  await waitFor(() => expect(captured.body).not.toBeNull());
  expect(captured.body).toEqual({ rating: 4 });
});

it("AC-WEBLOGEDIT-08 · 공개범위를 바꾸면 그것만 담긴다", async () => {
  const user = userEvent.setup();
  const captured = capturePatch();

  await renderEditPage();
  await user.selectOptions(await screen.findByLabelText("공개 범위"), "FRIENDS");
  await user.click(screen.getByRole("button", { name: "저장" }));

  await waitFor(() => expect(captured.body).not.toBeNull());
  expect(captured.body).toEqual({ visibility: "FRIENDS" });
});

it("AC-WEBLOGEDIT-09 · 저장에 성공하면 그 로그 상세로 간다", async () => {
  const user = userEvent.setup();
  capturePatch();

  await renderEditPage();
  await user.selectOptions(await screen.findByLabelText("공개 범위"), "FRIENDS");
  await user.click(screen.getByRole("button", { name: "저장" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/brews/42"));
});

it("AC-WEBLOGEDIT-10 · 취소하면 그 로그 상세로 간다", async () => {
  const user = userEvent.setup();
  const captured = capturePatch();

  await renderEditPage();
  await user.click(await screen.findByRole("button", { name: "취소" }));

  expect(push).toHaveBeenCalledWith("/brews/42");
  expect(captured.calls).toBe(0);
});

it("AC-WEBLOGEDIT-11 · 아무것도 고치지 않고 저장하면 요청이 나가지 않는다", async () => {
  const user = userEvent.setup();
  const captured = capturePatch();

  await renderEditPage();
  await user.click(await screen.findByRole("button", { name: "저장" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/brews/42"));
  expect(captured.calls).toBe(0);
});
```

**`별점 4`가 `rating: 4`인지 `4.0`인지 확인한다.** `RatingInput`이 무엇을 넘기는지 그 파일에서 보고 기대값을 맞춘다 — JSON에서 `4.0`과 `4`는 같은 값이라 `toEqual({ rating: 4 })`로 쓴다.

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run 'src/app/brews/[id]/edit' src/features/brewlog/formState.test.ts`
Expected: FAIL — `toPatchBody`·`patchBrewLog`·`저장`·`취소`가 없어서

- [ ] **Step 3: 최소 구현**

`formState.ts`:

```ts
export type BrewLogPatchBody = Partial<
  Omit<BrewLogRequestBody, "recipeId" | "beanBatchId">
> & { visibility?: BrewLogEditState["visibility"] };

/** 요청에 실을 수 있는 필드. `recipeId`·`beanBatchId`·`sensoryExpanded`는 없다. */
const PATCHABLE = [
  "brewedAt",
  "userGrinderId",
  "actualGrindSettingValue",
  "actualDoseG",
  "actualWaterG",
  "actualWaterTempC",
  "actualTotalTimeSeconds",
  "actualDrawdownSeconds",
  "beverageWeightG",
  "tdsPercent",
  "rating",
  "overallNote",
  "acidity",
  "sweetness",
  "body",
  "bitterness",
  "aftertaste",
  "visibility",
] as const satisfies readonly (keyof BrewLogEditState)[];

/**
 * 바뀐 필드만 담는다.
 *
 * <p><b>폼 상태끼리 비교한다.</b> 요청 본문끼리 비교하면 `brewedAt`이 Instant → `datetime-local` →
 * Instant를 왕복하며 초가 잘려, 건드리지도 않은 필드가 바뀐 것으로 보인다.
 *
 * <p><b>`null`이 된 필드는 담지 않는다.</b> 백엔드가 `null`을 "변경 없음"으로 읽어 보내봐야 소용이 없다.
 * 화면이 그 상태에서 저장 자체를 막는다.
 */
export function toPatchBody(
  initial: BrewLogEditState,
  current: BrewLogEditState,
): BrewLogPatchBody {
  const body: Record<string, unknown> = {};

  for (const key of PATCHABLE) {
    const before = initial[key];
    const after = current[key];
    if (before === after) continue;
    if (after === null || after === "") continue;

    body[key] = key === "brewedAt" ? toInstant(String(after)) : after;
  }

  return body;
}
```

`toInstant`는 이미 이 파일에 있다. `export`할 필요는 없다.

`api.ts`:

```ts
import type { BrewLogPatchBody, BrewLogRequestBody } from "./formState";
```

```ts
/** 부분 수정. 보내지 않은 필드는 바뀌지 않는다. */
export function patchBrewLog(
  id: number,
  body: BrewLogPatchBody,
  onSessionLost?: () => void,
): Promise<BrewLog> {
  return authedRequest(backendUrl(`/api/v1/brew-logs/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    schema: brewLogSchema,
    onSessionLost,
  });
}
```

`BrewLogEditor.tsx`의 `Fields`에 저장·취소를 붙인다:

```tsx
  const router = useRouter();
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: () => patchBrewLog(log.id, toPatchBody(initial, state), onSessionLost),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["brew-logs"] });
      void queryClient.invalidateQueries({ queryKey: ["brew-log", log.id] });
      router.push(`/brews/${log.id}`);
    },
  });

  function submit() {
    // 보낼 것이 없으면 부르지 않는다. 사용자 입장에서는 취소와 같은 결과다.
    if (Object.keys(toPatchBody(initial, state)).length === 0) {
      router.push(`/brews/${log.id}`);
      return;
    }
    save.mutate();
  }
```

```tsx
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={save.isPending}
          onClick={submit}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          저장
        </button>
        <button
          type="button"
          onClick={() => router.push(`/brews/${log.id}`)}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
        >
          취소
        </button>
      </div>
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run 'src/app/brews/[id]/edit' src/features/brewlog/formState.test.ts`
Expected: PASS — 페이지 9개 + 순수 함수 10개

- [ ] **Step 5: 커밋** — `feat(web): 로그 편집 저장 — 바뀐 필드만 보낸다 (AC-WEBLOGEDIT 5개)`

---

## Task 5: 지우기 시도 차단

**Files:**
- Modify: `frontend/src/features/brewlog/formState.ts`, `frontend/src/features/brewlog/formState.test.ts`
- Modify: `frontend/src/features/brewlog/components/BrewLogEditor.tsx`, `frontend/src/features/brewlog/components/BrewLogFields.tsx`
- Test: `frontend/src/app/brews/[id]/edit/page.test.tsx`

**Covers:** AC-WEBLOGEDIT-12, 13, 14, 15

**Interfaces:**
- Produces: `clearedFields(initial: BrewLogEditState, current: BrewLogEditState): string[]` — 값이 있었는데 비워진 필드 이름들
- Produces: `BrewLogFields`의 `fieldErrors`가 받는 모양에 지우기 안내를 얹는다. **새 prop을 만들지 않고 기존 `fieldErrors.byField`에 합쳐 넘긴다** — 입력칸 쪽 코드를 건드리지 않아도 된다

- [ ] **Step 1: 실패하는 테스트 작성**

`formState.test.ts`:

```ts
describe("clearedFields", () => {
  const initial = formStateFromLog(brewLogWithTds);

  it("값이 있던 칸을 비우면 잡는다", () => {
    expect(clearedFields(initial, { ...initial, tdsPercent: null })).toEqual(["tdsPercent"]);
  });

  it("원래 비어 있던 칸은 잡지 않는다", () => {
    const withoutTds = { ...initial, tdsPercent: null };

    expect(clearedFields(withoutTds, withoutTds)).toEqual([]);
  });

  it("메모를 빈 문자열로 만들어도 잡는다", () => {
    const withNote = { ...initial, overallNote: "고소하다" };

    expect(clearedFields(withNote, { ...withNote, overallNote: "" })).toEqual(["overallNote"]);
  });

  it("값을 바꾸기만 한 것은 잡지 않는다", () => {
    expect(clearedFields(initial, { ...initial, tdsPercent: 1.4 })).toEqual([]);
  });
});
```

`page.test.tsx`:

```tsx
const CLEAR_MESSAGE = "값을 지울 수 없습니다. 고치거나 기록을 삭제하세요";

it("AC-WEBLOGEDIT-12 · 값이 있던 칸을 비우면 그 칸에 안내가 붙는다", async () => {
  const user = userEvent.setup();

  await renderEditPage();
  await user.clear(await screen.findByLabelText("TDS"));

  const input = screen.getByLabelText("TDS");
  const describedBy = await waitFor(() => {
    const id = input.getAttribute("aria-describedby");
    expect(id).not.toBeNull();
    return id as string;
  });
  expect(document.getElementById(describedBy)).toHaveTextContent(CLEAR_MESSAGE);
});

it("AC-WEBLOGEDIT-13 · 지우기 시도 중에는 저장이 비활성이다", async () => {
  const user = userEvent.setup();

  await renderEditPage();
  await user.clear(await screen.findByLabelText("TDS"));

  expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
});

it("AC-WEBLOGEDIT-14 · 값을 다시 넣으면 저장이 살아난다", async () => {
  const user = userEvent.setup();
  const captured = capturePatch();

  await renderEditPage();
  await user.clear(await screen.findByLabelText("TDS"));
  await user.type(screen.getByLabelText("TDS"), "1.40");

  const saveButton = screen.getByRole("button", { name: "저장" });
  expect(saveButton).not.toBeDisabled();

  await user.click(saveButton);
  await waitFor(() => expect(captured.body).not.toBeNull());
  expect(captured.body).toEqual({ tdsPercent: 1.4 });
});

it("AC-WEBLOGEDIT-15 · 원래 비어 있던 칸은 비어 있어도 막지 않는다", async () => {
  const user = userEvent.setup();
  const captured = capturePatch();
  const withoutTds: Record<string, unknown> = { ...brewLogWithTds, id: 42, userId: 11, rating: 3.5 };
  delete withoutTds.tdsPercent;
  server.use(http.get(`${BASE}/brew-logs/42`, () => HttpResponse.json(withoutTds)));

  await renderEditPage();
  await screen.findByLabelText("TDS");
  await user.click(screen.getByRole("button", { name: "별점 4" }));
  await user.click(screen.getByRole("button", { name: "저장" }));

  await waitFor(() => expect(captured.body).not.toBeNull());
  expect(captured.body).toEqual({ rating: 4 });
  expect(screen.queryByText(CLEAR_MESSAGE)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run 'src/app/brews/[id]/edit' src/features/brewlog/formState.test.ts`
Expected: FAIL — `clearedFields`가 없고, 비워도 안내가 없고 `저장`이 활성이다

- [ ] **Step 3: 최소 구현**

`formState.ts`:

```ts
/**
 * 값이 있었는데 비워진 필드.
 *
 * <p>백엔드가 `null`을 "변경 없음"으로 읽으므로 이 상태로 저장하면 아무 일도 일어나지 않는다.
 * 조용히 무시하면 사용자는 지워졌다고 믿는다 — 화면이 저장 전에 막는다.
 */
export function clearedFields(
  initial: BrewLogEditState,
  current: BrewLogEditState,
): string[] {
  return PATCHABLE.filter((key) => {
    const before = initial[key];
    const after = current[key];
    const hadValue = before !== null && before !== "";
    const isEmpty = after === null || after === "";
    return hadValue && isEmpty;
  });
}
```

`BrewLogEditor.tsx`의 `Fields`:

```tsx
  const cleared = clearedFields(initial, state);

  const fieldErrors = {
    byField: Object.fromEntries(
      cleared.map((key) => [key, "값을 지울 수 없습니다. 고치거나 기록을 삭제하세요"]),
    ),
    byStepIndex: {},
    unmapped: [],
  };
```

`저장` 버튼에 조건을 더한다:

```tsx
          disabled={save.isPending || cleared.length > 0}
```

`fieldErrors`를 `BrewLogFields`에 넘긴다(지금은 `null`을 넘기고 있다).

**서버 오류와 합쳐야 한다** — Task 6에서 `save.error`의 `fieldErrors`와 병합한다. 이 태스크에서는 지우기 안내만 넘긴다.

`BrewLogFields.tsx`에서 **`TDS` 말고 다른 칸도 안내를 받을 수 있어야 한다.** 지금 `NumberField`에 `error`를 넘기는 곳이 `TDS` 하나뿐이므로, 실측값 7칸 전부에 `error={fieldErrors?.byField.<필드명>}`을 붙인다. 필드명은 `actualDoseG`·`actualWaterG`·`actualWaterTempC`·`actualTotalTimeSeconds`·`actualDrawdownSeconds`·`beverageWeightG`·`tdsPercent`다. `분쇄도 값`에도 `actualGrindSettingValue`로 붙인다.

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run 'src/app/brews/[id]/edit' src/features/brewlog`
Expected: PASS — 페이지 13개 + 순수 함수 14개

- [ ] **Step 5: 커밋** — `feat(web): 지우기 시도를 저장 전에 막는다 (AC-WEBLOGEDIT 4개)`

---

## Task 6: 서버 검증 오류를 입력칸에

**Files:**
- Modify: `frontend/src/features/brewlog/components/BrewLogEditor.tsx`
- Test: `frontend/src/app/brews/[id]/edit/page.test.tsx`

**Covers:** AC-WEBLOGEDIT-16

**Interfaces:**
- Consumes: `mapFieldErrors(error.fieldErrors)` (기존, `lib/fieldErrors`), `ApiError` (기존, `lib/api-client`)

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-WEBLOGEDIT-16 · 서버 검증 실패는 그 입력칸에 붙는다", async () => {
  const user = userEvent.setup();
  server.use(
    http.patch(`${BASE}/brew-logs/42`, () =>
      HttpResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "요청이 올바르지 않습니다",
          fieldErrors: [{ field: "tdsPercent", message: "100 미만이어야 합니다" }],
        },
        { status: 400 },
      ),
    ),
  );

  await renderEditPage();
  await user.clear(await screen.findByLabelText("TDS"));
  await user.type(screen.getByLabelText("TDS"), "150");
  await user.click(screen.getByRole("button", { name: "저장" }));

  const input = await screen.findByLabelText("TDS");
  const describedBy = await waitFor(() => {
    const id = input.getAttribute("aria-describedby");
    expect(id).not.toBeNull();
    return id as string;
  });
  expect(document.getElementById(describedBy)).toHaveTextContent("100 미만이어야 합니다");
  expect(push).not.toHaveBeenCalled();
});
```

`fieldErrors` 응답의 키 이름이 `field`·`message`가 맞는지 `lib/fieldErrors.ts`에서 확인한다.

- [ ] **Step 2: 실패 확인**

Run: `pnpm vitest run 'src/app/brews/[id]/edit'`
Expected: FAIL — 서버 오류가 화면에 붙지 않는다

- [ ] **Step 3: 최소 구현**

Task 5에서 만든 `fieldErrors`를 서버 오류와 합친다. **지우기 안내가 서버 오류를 덮지 않게 한다** — 지우기 안내가 떠 있으면 저장 자체가 막히므로 둘이 동시에 뜰 일은 없지만, 순서를 정해 둔다(서버 오류가 나중에 온 정보다):

```tsx
  const serverErrors =
    save.error instanceof ApiError ? mapFieldErrors(save.error.fieldErrors) : null;

  const fieldErrors = {
    byField: {
      ...Object.fromEntries(
        cleared.map((key) => [key, "값을 지울 수 없습니다. 고치거나 기록을 삭제하세요"]),
      ),
      ...(serverErrors?.byField ?? {}),
    },
    byStepIndex: {},
    unmapped: serverErrors?.unmapped ?? [],
  };
```

`unmapped`가 있으면 폼 위에 보여준다:

```tsx
      {save.error && (
        <div role="alert" className="flex flex-col gap-1 text-sm text-red-600">
          <p>{errorMessageOf(save.error)}</p>
          {fieldErrors.unmapped.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm vitest run 'src/app/brews/[id]/edit'`
Expected: PASS, 14개

- [ ] **Step 5: 전체 검증**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm test:worker
(cd .. && ./scripts/check-spec-coverage.sh)
```

- [ ] **Step 6: 커밋** — `feat(web): 로그 편집의 서버 검증 오류 표시 (AC-WEBLOGEDIT 1개)`

---

## 완료 기준

- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과
- [ ] `cd frontend && pnpm test:worker` 통과 (6개)
- [ ] `./scripts/check-spec-coverage.sh` 통과
- [ ] 백엔드는 건드리지 않았다 — `git diff --stat main...HEAD`에 `backend/`가 없다
- [ ] 스펙의 `status`를 `구현완료`로 변경
- [ ] 스펙 「수동 확인」 4개 완료

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 18개 중 18개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** `BrewLogEditState`(Task 3) → `toPatchBody`·`clearedFields`(Task 4·5)가 같은 타입을 받는다. `PATCHABLE` 배열을 Task 4에서 정의하고 Task 5가 재사용한다 — **Task 5를 Task 4보다 먼저 하면 컴파일되지 않는다.** `BrewLogFields`의 `fieldErrors` prop 타입(`ReturnType<typeof mapFieldErrors> | null`)을 Task 3은 `null`로, Task 5는 객체로 넘긴다.

**검증되지 않은 가정:**

1. **`brewLogSchema.visibility`를 enum으로 좁혀도 되는지.** 백엔드 `BrewLogVisibility`에 값이 셋뿐이라 안전해 보이나, 실제 응답을 Task 3 Step 1에서 확인한다. 어긋나면 파싱이 던져 화면이 통째로 오류가 된다.
2. **`RatingInput`이 넘기는 값의 형태.** `별점 4`를 눌렀을 때 `4`인지 `4.0`인지에 따라 Task 4의 기대값이 달라진다. Task 4 Step 1에서 그 파일을 보고 맞춘다.
3. **로그 상세 테스트의 기존 픽스처가 소유 상태인지.** `brewLogWithTds.userId`는 `11`이고 상세 테스트의 `GET /users/me`가 무엇을 주는지에 따라 기존 삭제 테스트가 깨질 수 있다. Task 1 Step 4에서 드러난다.
4. **`user.clear()`가 `type="number"` 입력에서 `null`을 만드는지.** `NumberField`는 `e.target.value === ""`일 때 `null`을 넘긴다. jsdom에서 `clear()`가 빈 문자열을 만드는 것은 확인됐으나 이 조합은 처음이다 — Task 5 Step 2에서 드러난다.
5. **원두·레시피를 id 숫자로만 보여주는 것으로 충분한지.** 이름을 보여주려면 `GET /recipes/{id}`와 재고 3종 목록을 더 불러야 한다. 스펙의 AC-06은 "바꿀 수 없다"만 요구하므로 이번엔 id로 둔다. 실물에서 답답하면 후속에서 이름을 붙인다.

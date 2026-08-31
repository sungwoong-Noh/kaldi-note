# 브루잉 로그 화면 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-08-31-web-brew-log.md`

**Goal:** 레시피 상세에서 "이 레시피로 내렸다"를 눌러 실측값과 평가를 기록하고, 홈·목록·상세에서 다시 본다. 그라인더도 원두도 없는 상태에서 시작해도 화면을 떠나지 않고 채울 수 있다.

**Architecture:** 로그 작성 화면이 **선행 데이터 등록을 모달로 품는다.** 페이지 이동이 없으므로 임시저장(비목표) 없이도 작성 중인 값이 살아남는다. 3단 생성(로스터→제품→재고)은 순차 뮤테이션이고, **이미 만들어진 것을 상태로 승격**시켜 재시도할 때 중복이 생기지 않게 한다. 폼 상태는 쓰기 슬라이스와 같이 `useState`로 들고, 요청 본문은 빈 값을 키째 빼는 변환 함수가 만든다.

**작업 위치:** `frontend/` (전부. 백엔드는 건드리지 않는다)

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-WEBBREW-01 | 그라인더 없음 안내 | Task 3 | 페이지 테스트 |
| AC-WEBBREW-02 | 그라인더 등록 본문 | Task 2 | 컴포넌트 테스트 |
| AC-WEBBREW-03 | 등록 후 선택 상태 | Task 3 | 페이지 테스트 |
| AC-WEBBREW-04 | 별명 없이 등록 | Task 2 | 컴포넌트 테스트 |
| AC-WEBBREW-05 | 3단 순서대로 호출 | Task 4 | 컴포넌트 테스트 |
| AC-WEBBREW-06 | 기존 로스터면 생략 | Task 4 | 컴포넌트 테스트 |
| AC-WEBBREW-07 | 실패 후 로스터 재생성 안 함 | Task 4 | 컴포넌트 테스트 |
| AC-WEBBREW-08 | 필드 오류가 입력칸에 | Task 4 | 컴포넌트 테스트 |
| AC-WEBBREW-09 | 재고 등록 후 선택 상태 | Task 5 | 페이지 테스트 |
| AC-WEBBREW-10 | 원두 선택란 표시 형식 | Task 5 | 페이지 테스트 |
| AC-WEBBREW-11 | 레시피 값 초기화 | Task 3 | 페이지 테스트 |
| AC-WEBBREW-12 | 추출 시간은 빈칸 | Task 3 | 페이지 테스트 |
| AC-WEBBREW-13 | 내린 시각 기본값 | Task 3 | 페이지 테스트 |
| AC-WEBBREW-14 | 같은 모델 자동 선택 | Task 3 | 페이지 테스트 |
| AC-WEBBREW-15 | 없으면 빈 상태 | Task 3 | 페이지 테스트 |
| AC-WEBBREW-16 | 둘이면 id 작은 쪽 | Task 3 | 페이지 테스트 |
| AC-WEBBREW-17 | 분쇄도 설정값 복사 | Task 3 | 페이지 테스트 |
| AC-WEBBREW-18 | 저장 본문 | Task 6 | 페이지 테스트 |
| AC-WEBBREW-19 | 저장 중 잠김 | Task 6 | 페이지 테스트 |
| AC-WEBBREW-20 | 성공 시 상세로 | Task 6 | 페이지 테스트 |
| AC-WEBBREW-21 | 빈칸은 키째 제외 | Task 6 | 페이지 테스트 |
| AC-WEBBREW-22 | 미래 시각 오류 표시 | Task 6 | 페이지 테스트 |
| AC-WEBBREW-23 | 원두 없음 안내 | Task 5 | 페이지 테스트 |
| AC-WEBBREW-24 | 모달 후 값 유지(그라인더) | Task 5 | 페이지 테스트 |
| AC-WEBBREW-25 | 모달 후 값 유지(원두) | Task 5 | 페이지 테스트 |
| AC-WEBBREW-26 | 모달 취소는 무요청 | Task 4 | 컴포넌트 테스트 |
| AC-WEBBREW-27 | 별점 4 | Task 6 | 페이지 테스트 |
| AC-WEBBREW-28 | 5축 접힘 | Task 6 | 페이지 테스트 |
| AC-WEBBREW-29 | 안 펼치면 키 없음 | Task 6 | 페이지 테스트 |
| AC-WEBBREW-30 | 펼쳐 고른 값만 담김 | Task 6 | 페이지 테스트 |
| AC-WEBBREW-31 | 메모 오류 표시 | Task 6 | 페이지 테스트 |
| AC-WEBBREW-32 | 목록 page·size | Task 7 | 페이지 테스트 |
| AC-WEBBREW-33 | 더 보기 | Task 7 | 페이지 테스트 |
| AC-WEBBREW-34 | 빈 목록 안내 | Task 7 | 페이지 테스트 |
| AC-WEBBREW-35 | 날짜·제목·별점 | Task 7 | 페이지 테스트 |
| AC-WEBBREW-36 | EY 없으면 빈자리 | Task 7 | 페이지 테스트 |
| AC-WEBBREW-37 | 홈 size=3 | Task 8 | 페이지 테스트 |
| AC-WEBBREW-38 | 전체 보기 링크 | Task 8 | 페이지 테스트 |
| AC-WEBBREW-39 | 홈 빈 상태 안내 | Task 8 | 페이지 테스트 |
| AC-WEBBREW-40 | 실측값 표시 | Task 9 | 페이지 테스트 |
| AC-WEBBREW-41 | TDS 있으면 분석 표시 | Task 9 | 페이지 테스트 |
| AC-WEBBREW-42 | TDS 없으면 영역 없음 | Task 9 | 페이지 테스트 |
| AC-WEBBREW-43 | 레시피 링크 | Task 9 | 페이지 테스트 |
| AC-WEBBREW-44 | 삭제 확인 | Task 9 | 페이지 테스트 |
| AC-WEBBREW-45 | 삭제 취소 | Task 9 | 페이지 테스트 |
| AC-WEBBREW-46 | 레시피 상세 진입 | Task 10 | 페이지 테스트 |

**스펙의 AC 46개 중 46개가 매핑됐다.** Task 1은 스키마·API 함수 기반이라 AC를 직접 담당하지 않는다.

---

## Global Constraints

- **`any` 금지, `as` 단언 금지.** 응답 타입은 Zod 스키마에서 `z.infer`로 뽑는다.
- **API는 MSW로 모킹한다.** 테스트에서 실제 백엔드를 호출하지 않는다.
- **픽스처는 실행 중인 백엔드에서 뜬다.** 이번에 새로 필요한 것: 내 그라인더 목록, 로스터 목록, 원두 제품 목록, 재고 목록, 브루로그 단건·목록(TDS 있는 것과 없는 것 각각). 뜨는 방법은 Task 1 Step 1에 있다.
- **검증 규칙을 프론트에 복제하지 않는다.** 범위 판정은 서버 몫이고 화면은 `fieldErrors`를 붙이기만 한다 — `lib/fieldErrors.ts`를 **그대로 재사용**한다(`KNOWN_FIELDS`에 브루로그 필드를 추가해야 한다).
- **폼 상태는 `useState`.** react-hook-form을 도입하지 않는다(`frontend/CLAUDE.md`「폼 라이브러리를 쓰지 않는 이유」).
- **모달은 직접 만든다.** `DeleteRecipeDialog`가 쓰는 `role="dialog"` 패턴을 따른다.
- **AC ID를 소스 주석에 적지 않는다.** `check-spec-coverage.sh`는 `frontend/src` 전체를 grep하므로 주석에 ID만 있어도 통과해 버린다 — 테스트가 없는데 있다고 보고하게 된다(2026-08-30에 실제로 겪었다).
- 커밋 전 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

---

## File Structure

```
frontend/src/
├── app/
│   ├── page.tsx                              Modify — 홈: 최근 로그 3개
│   ├── page.test.tsx                         Create — AC 37~39
│   ├── brews/
│   │   ├── page.tsx  page.test.tsx           Create — 목록, AC 32~36
│   │   ├── new/page.tsx  page.test.tsx       Create — 작성, AC 01·03·09~31
│   │   └── [id]/page.tsx  page.test.tsx      Create — 상세, AC 40~45
│   └── recipes/[id]/page.test.tsx            Modify — AC 46
│
├── features/brewlog/
│   ├── api.ts                                Create — create/fetch/fetchPage/delete
│   ├── schema.ts                             Create — brewLogSchema, summary, page
│   ├── formState.ts                          Create — 레시피 → 폼, 폼 → 요청 본문
│   ├── formState.test.ts                     Create
│   └── components/
│       ├── BrewLogForm.tsx                   Create — 실측·평가 입력
│       ├── BrewDetail.tsx                    Create — 상세 본문
│       ├── ExtractionSummary.tsx             Create — TDS 있을 때만 그린다
│       ├── RatingInput.tsx                   Create — 별 5개
│       ├── UserGrinderDialog.tsx             Create — AC 02·04
│       ├── UserGrinderDialog.test.tsx        Create
│       ├── BeanBatchDialog.tsx               Create — 3단 생성, AC 05~08·26
│       └── BeanBatchDialog.test.tsx          Create
│
├── features/inventory/
│   ├── api.ts  schema.ts                     Create — bean-batches
├── features/catalog/
│   ├── api.ts  schema.ts                     Create — roasters, bean-products
├── features/gear/
│   ├── queries.ts                            Modify — useUserGrinders
│   └── schema.ts                             Modify — userGrinderSchema
│
├── features/recipe/components/RecipeDetail.tsx  Modify — "이 레시피로 내렸다"
├── lib/fieldErrors.ts                        Modify — 브루로그 필드 추가
└── test/fixtures.ts                          Modify — 새 픽스처
```

---

## Task 1: 스키마·API 함수와 픽스처

**Files:**
- Create: `features/brewlog/{api,schema,formState}.ts`, `features/inventory/{api,schema}.ts`, `features/catalog/{api,schema}.ts`
- Modify: `features/gear/{queries,schema}.ts`, `lib/fieldErrors.ts`, `test/fixtures.ts`
- Test: `features/brewlog/formState.test.ts`, `lib/fieldErrors.test.ts`

**Covers:** 없음 — 뒤 태스크가 AC로 검증한다.

**Interfaces:**
- Produces: `BrewLogFormState`, `initialFormState(recipe, grinders)`, `toRequestBody(state)`, `createBrewLog`, `fetchBrewLog`, `fetchBrewLogPage`, `deleteBrewLog`, `useUserGrinders`, `useBeanBatches`, `useRoasters`, `useBeanProducts`

> **실행 시 조정(2026-08-31):** 이 태스크에서 실제로 만든 것은 **픽스처·`formState`·`userGrinderSchema`·`fieldErrors` 확장**까지다. `api.ts`·나머지 `schema.ts`는 **그것을 요구하는 AC 테스트가 빨개진 뒤** Task 2·3·5·7에서 만든다 — 지금 만들면 실패하는 테스트 없이 프로덕션 코드를 쓰는 셈이라 TDD 규칙에 어긋난다. Produces의 이름과 시그니처는 그대로 지킨다.
>
> **`vitest.config.mts`에 `env: { TZ: "UTC" }`를 넣었다.** 스펙의 AC-13·AC-18이 시스템 시각 `09:00Z`에 대해 입력칸 `09:00`·요청 `09:00:00.000Z`를 요구하는데, 고정하지 않으면 로컬(Asia/Seoul)에서 9시간 어긋나고 CI(UTC)와 결과가 갈린다. **가정 2는 이로써 해소됐다** — `toHaveValue`가 아니라 TZ가 문제였다.

- [x] **Step 1: 픽스처를 실제 백엔드에서 뜬다**

```bash
docker compose up -d
(cd backend && SPRING_PROFILES_ACTIVE=local ./gradlew bootRun) &
# JWT는 application-local.yml의 고정 시크릿으로 만든다. sub는 11 — DB에 그 사용자만 있다.
curl -s -H "Authorization: Bearer $TOKEN" localhost:8080/api/v1/gear/user-grinders | jq
curl -s -H "Authorization: Bearer $TOKEN" localhost:8080/api/v1/bean-batches | jq '.content[0]'
curl -s -H "Authorization: Bearer $TOKEN" localhost:8080/api/v1/brew-logs | jq '.content[0]'
```

**없으면 만들어서 떠야 한다** — 그라인더·재고·로그가 로컬 DB에 없을 수 있다. 만든 데이터는 확인이 끝나면 지운다.

- [x] **Step 2: 실패하는 테스트 작성**

```ts
// formState.test.ts (일부)
it("레시피 값으로 초기화하고 추출 시간은 비운다", () => {
  const state = initialFormState(kasuyaRecipe, [{ id: 5, grinderModelId: 1 }]);

  expect(state).toMatchObject({
    actualDoseG: 20.0,
    actualWaterG: 300.0,
    actualWaterTempC: 92.0,
    actualTotalTimeSeconds: null,
    userGrinderId: 5,
    actualGrindSettingValue: 22.0,
  });
});

it("같은 모델이 둘이면 id가 작은 쪽을 고른다", () => {
  const state = initialFormState(kasuyaRecipe, [
    { id: 8, grinderModelId: 1 },
    { id: 5, grinderModelId: 1 },
  ]);

  expect(state.userGrinderId).toBe(5);
});

it("빈 값과 펼치지 않은 5축은 본문에서 빠진다", () => {
  const body = toRequestBody({ ...filled, tdsPercent: null, acidity: null });

  expect(body).not.toHaveProperty("tdsPercent");
  expect(body).not.toHaveProperty("acidity");
  expect(body).not.toHaveProperty("visibility");
});
```

- [x] **Step 3: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test -- brewlog/formState`
Expected: FAIL — `Failed to resolve import "./formState"`

- [x] **Step 4: 최소 구현**

`toRequestBody`는 쓰기 슬라이스의 `omitEmpty`와 같은 방식이다. `initialFormState`는 그라인더 배열에서 `grinderModelId`가 일치하는 것 중 `id`가 최소인 것을 고른다. `lib/fieldErrors.ts`의 `KNOWN_FIELDS`에 `brewedAt`·`actualDoseG`·`actualWaterG`·`actualWaterTempC`·`actualTotalTimeSeconds`·`actualDrawdownSeconds`·`actualGrindSettingValue`·`beverageWeightG`·`tdsPercent`·`rating`·`overallNote`·`weightG`·`roastedAt`·`name`을 더한다.

- [x] **Step 5: 통과 확인 후 커밋**

Run: `cd frontend && pnpm test -- brewlog lib/fieldErrors`
Expected: PASS

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 브루잉 로그 스키마·API·폼 상태 변환"
```

---

## Task 2: 그라인더 등록 모달

**Files:** Create `features/brewlog/components/UserGrinderDialog.tsx` + 테스트
**Covers:** AC-WEBBREW-02, 04

- [x] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-WEBBREW-02 · 모델을 골라 등록하면 그 본문으로 요청한다", async () => {
  const user = userEvent.setup();
  let body: unknown = null;
  server.use(
    http.get(`${BASE}/gear/grinders`, () => HttpResponse.json([comandanteC40])),
    http.post(`${BASE}/gear/user-grinders`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ id: 5, grinderModelId: 1, nickname: "집" }, { status: 201 });
    }),
  );

  renderWithQuery(<UserGrinderDialog onCreated={vi.fn()} onCancel={vi.fn()} />);
  await screen.findByRole("option", { name: "Comandante C40 MK4" });
  await user.selectOptions(screen.getByLabelText("모델"), "1");
  await user.type(screen.getByLabelText("별명"), "집");
  await user.click(screen.getByRole("button", { name: "등록" }));

  await waitFor(() => expect(body).toEqual({ grinderModelId: 1, nickname: "집" }));
});
```

- [x] **Step 2: 실패 확인** — Run: `pnpm test -- UserGrinderDialog` / Expected: FAIL(모듈 없음)
- [x] **Step 3: 최소 구현** — `role="dialog"`, 모델 `select`, 별명 `input`, `등록`·`취소`. 성공하면 `onCreated(created)`를 부른다.
- [x] **Step 4: 통과 확인** — Expected: PASS, 2 tests
- [x] **Step 5: 커밋** — `feat(web): 그라인더 등록 모달 (AC-WEBBREW 2개)`

---

## Task 3: 로그 작성 화면 — 초기값

**Files:** Create `app/brews/new/page.tsx`, `features/brewlog/components/BrewLogForm.tsx` + 페이지 테스트
**Covers:** AC-WEBBREW-01, 03, 11, 12, 13, 14, 15, 16, 17

**Interfaces:** Consumes `initialFormState`(Task 1), `UserGrinderDialog`(Task 2)

- [x] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-WEBBREW-13 · 내린 시각의 기본값은 화면이 열린 시각이다", async () => {
  vi.setSystemTime(new Date("2026-08-31T09:00:00Z"));

  await renderNewPage();

  expect(await screen.findByLabelText("내린 시각")).toHaveValue("2026-08-31T09:00");
});

it("AC-WEBBREW-16 · 같은 모델이 둘이면 먼저 등록한 것을 고른다", async () => {
  server.use(
    http.get(`${BASE}/gear/user-grinders`, () =>
      HttpResponse.json([
        { id: 8, grinderModelId: 1, nickname: "사무실" },
        { id: 5, grinderModelId: 1, nickname: "집" },
      ]),
    ),
  );

  await renderNewPage();

  expect(await screen.findByLabelText("그라인더")).toHaveValue("5");
});
```

`vi.setSystemTime`을 쓰면 `afterEach`에서 `vi.useRealTimers()`로 되돌린다 — 안 하면 뒤 테스트의 시간이 멈춘 채로 남는다.

> **실행 결과(2026-08-31):** `vi.setSystemTime`만으로는 부족했다. **`vi.useFakeTimers({ shouldAdvanceTime: true })`를 함께 써야 한다** — 타이머를 완전히 멈추면 MSW 응답과 `findBy*`의 폴링이 진행되지 않아 화면이 영원히 로딩 상태에 머문다. **가정 1·2 해소:** `datetime-local`의 `toHaveValue`는 초 없이 `"2026-08-31T09:00"`로 오고, TZ를 UTC로 고정한 뒤 AC-13이 그대로 통과한다. 스펙 수정은 필요 없었다.

- [x] **Step 2: 실패 확인** — Expected: FAIL(페이지 모듈 없음)
- [x] **Step 3: 최소 구현** — 페이지는 async 서버 컴포넌트로 `searchParams`를 풀어 `recipeId`를 넘기고, 클라이언트 컴포넌트가 레시피·그라인더·재고를 부른다. **`use(params)`를 쓰지 않는다**(Suspense 경계가 없어 빈 화면이 된다 — 2026-08-30에 겪었다).
- [x] **Step 4: 통과 확인** — Expected: PASS, 9 tests
- [x] **Step 5: 커밋** — `feat(web): 로그 작성 화면 초기값 (AC-WEBBREW 9개)`

---

## Task 4: 원두 등록 모달 — 3단 생성

**Files:** Create `features/brewlog/components/BeanBatchDialog.tsx` + 테스트
**Covers:** AC-WEBBREW-05, 06, 07, 08, 26

- [x] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-WEBBREW-07 · 제품에서 실패하면 로스터는 선택 상태로 남고 다시 만들지 않는다", async () => {
  const user = userEvent.setup();
  let roasterCalls = 0;
  const productBodies: { roasterId: number }[] = [];
  server.use(
    http.post(`${BASE}/roasters`, () => {
      roasterCalls += 1;
      return HttpResponse.json({ id: 3, name: "프릿츠" }, { status: 201 });
    }),
    http.post(`${BASE}/bean-products`, async ({ request }) => {
      productBodies.push((await request.json()) as { roasterId: number });
      return HttpResponse.json(
        { code: "INVALID_REQUEST", message: "입력값이 올바르지 않습니다.",
          fieldErrors: [{ field: "name", message: "100자 이하여야 합니다" }] },
        { status: 400 },
      );
    }),
  );

  // … 로스터·제품을 새로 만들도록 채우고 등록 → 실패 → 이름 고쳐 다시 등록
  expect(roasterCalls).toBe(1);
  expect(productBodies.map((b) => b.roasterId)).toEqual([3, 3]);
});
```

- [x] **Step 2: 실패 확인** — Expected: FAIL(모듈 없음)
- [x] **Step 3: 최소 구현** — 순차 `await`로 세 요청을 부르되, 각 단계가 성공하면 **그 결과를 상태에 승격**한다(`createdRoasterId`). 다음 시도는 이미 있는 id를 쓴다. 오류는 `mapFieldErrors`로 각 입력칸에 붙인다.
- [x] **Step 4: 통과 확인** — Expected: PASS, 5 tests
- [x] **Step 5: 커밋** — `feat(web): 원두 등록 모달 3단 생성 (AC-WEBBREW 5개)`

---

## Task 5: 작성 화면에 모달 연결

**Files:** Modify `app/brews/new/page.tsx`
**Covers:** AC-WEBBREW-09, 10, 23, 24, 25

- [x] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-WEBBREW-25 · 원두를 모달에서 등록해도 작성 중인 값이 남는다", async () => {
  const user = userEvent.setup();
  await renderNewPage();
  await user.type(await screen.findByLabelText("메모"), "단맛이 좋았다");

  await user.click(screen.getByRole("button", { name: "+ 원두 등록" }));
  // … 3단 생성 완료
  expect(screen.getByLabelText("메모")).toHaveValue("단맛이 좋았다");
});
```

- [x] **Step 2: 실패 확인** — Expected: FAIL(모달 진입 버튼 없음)
- [x] **Step 3: 최소 구현** — 모달 열림 상태를 페이지가 들고, 폼 상태는 그대로 둔다. 등록 성공 시 해당 선택란의 값을 새 id로 바꾸고 목록 쿼리를 무효화한다.
- [x] **Step 4: 통과 확인** — Expected: PASS, 5 tests
- [x] **Step 5: 커밋** — `feat(web): 작성 화면의 선행 데이터 모달 (AC-WEBBREW 5개)`

---

## Task 6: 저장과 평가

**Files:** Modify `BrewLogForm.tsx`, Create `RatingInput.tsx`
**Covers:** AC-WEBBREW-18, 19, 20, 21, 22, 27, 28, 29, 30, 31

- [x] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-WEBBREW-29 · 펼치지 않으면 5축 키를 보내지 않는다", async () => {
  const user = userEvent.setup();
  let body: Record<string, unknown> = {};
  server.use(
    http.post(`${BASE}/brew-logs`, async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ id: 42 }, { status: 201 });
    }),
  );

  await renderNewPage();
  await user.click(await screen.findByRole("button", { name: "기록하기" }));

  await waitFor(() => expect(body.recipeId).toBe(1));
  for (const key of ["acidity", "sweetness", "body", "bitterness", "aftertaste"]) {
    expect(body).not.toHaveProperty(key);
  }
});
```

- [x] **Step 2: 실패 확인** — Expected: FAIL(`기록하기` 버튼 없음)
- [x] **Step 3: 최소 구현** — `RatingInput`은 별 5개 버튼(`aria-label="별점 N"`)이고 정수만 올린다. 5축은 `맛 자세히`로 펼치며, 펼치지 않으면 상태가 `null`이라 본문에서 빠진다.
- [x] **Step 4: 통과 확인** — Expected: PASS, 10 tests

> **실행 시 조정(2026-08-31):** 저장 응답 스텁을 계획 예시의 `{ id: 42 }`가 아니라 **실제 응답 픽스처**(`{ ...brewLogWithTds, id: 42 }`)로 썼다. `id`만 돌려주면 `brewLogSchema`가 거부해서 화면이 성공을 성공으로 보지 못한다 — 지어낸 응답으로는 그 사실이 드러나지 않는다.
- [x] **Step 5: 커밋** — `feat(web): 로그 저장과 평가 입력 (AC-WEBBREW 10개)`

---

## Task 7: 로그 목록

**Files:** Create `app/brews/page.tsx` + 테스트
**Covers:** AC-WEBBREW-32, 33, 34, 35, 36

- [x] **Step 1: 실패하는 테스트 작성** — `useInfiniteQuery`로 `page=0&size=20`을 부르고 `hasNext`로 "더 보기"를 판단한다(레시피 목록과 같은 형태).
- [x] **Step 2: 실패 확인** — Expected: FAIL(페이지 모듈 없음)
- [x] **Step 3: 최소 구현** — 항목에 레시피 제목을 보이려면 `recipeId`로 제목을 얻어야 한다. **목록 응답에는 제목이 없다** — 화면에 나온 `recipeId`들만 모아 각각 `GET /recipes/{id}`를 부르고 `staleTime`을 길게 둔다.
- [x] **Step 4: 통과 확인** — Expected: PASS, 5 tests

> **실행 결과(2026-08-31):** 가정 3 확인 — `recipeId`를 `Set`으로 묶어 `useQueries`로 부른다. **같은 레시피를 여러 번 내린 것이 이 서비스의 전제라 20개 항목이 대개 한두 요청으로 줄고**, `staleTime` 5분이면 다음 페이지를 불러와도 이미 읽은 레시피는 다시 나가지 않는다.
- [x] **Step 5: 커밋** — `feat(web): 브루잉 로그 목록 (AC-WEBBREW 5개)`

---

## Task 8: 홈

**Files:** Modify `app/page.tsx`, Create `app/page.test.tsx`
**Covers:** AC-WEBBREW-37, 38, 39

- [x] **Step 1: 실패하는 테스트 작성** — `size=3`으로 부르는지, `전체 보기` 링크, 빈 상태 안내를 각각 확인한다.
- [x] **Step 2: 실패 확인** — Expected: FAIL(홈이 아직 빈 페이지다)
- [x] **Step 3: 최소 구현** — 목록 항목 컴포넌트를 Task 7과 공유한다. **제목 조회 훅(`useRecipeTitles`)도 함께 뽑아 공유했다** — Task 7이 페이지 안에 인라인으로 갖고 있던 것을 옮겼다.
- [x] **Step 4: 통과 확인** — Expected: PASS, 3 tests
- [x] **Step 5: 커밋** — `feat(web): 홈을 최근 브루잉 로그로 (AC-WEBBREW 3개)`

---

## Task 9: 로그 상세와 삭제

**Files:** Create `app/brews/[id]/page.tsx`, `BrewDetail.tsx`, `ExtractionSummary.tsx` + 테스트
**Covers:** AC-WEBBREW-40, 41, 42, 43, 44, 45

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-WEBBREW-42 · TDS가 없으면 추출 분석 영역이 아예 없다", async () => {
  server.use(http.get(`${BASE}/brew-logs/42`, () => HttpResponse.json(brewLogWithoutTds)));

  await renderDetail();

  expect(await screen.findByText("20.0g")).toBeInTheDocument();
  expect(screen.queryByText("추출 분석")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL(페이지 모듈 없음)
- [ ] **Step 3: 최소 구현** — 상세 페이지는 async 서버 컴포넌트가 `params`를 풀고 클라이언트 컴포넌트가 그린다. 삭제 모달은 `DeleteRecipeDialog`와 같은 형태로 만들되 브루로그용으로 따로 둔다(문구가 다르다).
- [ ] **Step 4: 통과 확인** — Expected: PASS, 6 tests
- [ ] **Step 5: 커밋** — `feat(web): 로그 상세와 삭제 (AC-WEBBREW 6개)`

---

## Task 10: 레시피 상세 진입과 문서

**Files:** Modify `features/recipe/components/RecipeDetail.tsx`, `app/recipes/[id]/page.test.tsx`, `frontend/CLAUDE.md`, 스펙 `status`
**Covers:** AC-WEBBREW-46

- [ ] **Step 1: 실패하는 테스트 작성** — `이 레시피로 내렸다` 링크의 `href`가 `/brews/new?recipeId=1`인지 확인한다.
- [ ] **Step 2: 실패 확인** — Expected: FAIL(링크 없음)
- [ ] **Step 3: 최소 구현 + 문서** — 링크를 추가하고, `frontend/CLAUDE.md`의 현재 상태 문단에 이번 슬라이스를 반영한다.
- [ ] **Step 4: 전체 검증**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:worker
cd .. && ./scripts/check-spec-coverage.sh
```

Expected: 전부 PASS. 커버리지는 스펙 15건·AC 498개(452 + 46).

- [ ] **Step 5: 스펙 `status`를 `구현완료`로 바꾸고 커밋** — 수동 확인 4개를 끝낸 뒤에 바꾼다.

---

## 완료 기준

- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과
- [ ] `cd frontend && pnpm test:worker` 통과 (6개)
- [ ] `./scripts/check-spec-coverage.sh` 통과
- [ ] 스펙의 `status`를 `구현완료`로 변경
- [ ] 스펙 「수동 확인」 4개 완료

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 46개 중 46개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** `BrewLogFormState`·`initialFormState`·`toRequestBody`(Task 1)가 Task 3·5·6에서 같은 이름으로 쓰인다. `UserGrinderDialog`·`BeanBatchDialog`의 `onCreated(created)` 시그니처가 Task 5의 연결부와 맞는다.

**검증되지 않은 가정:**

1. **`vi.setSystemTime`이 이 프로젝트 테스트에서 처음 쓰인다.** 기존 59→124개 테스트 중 시간을 고정한 것이 없다. `afterEach`에서 되돌리지 않으면 뒤 테스트가 멈춘 시간을 물려받는다. Task 3에서 드러난다.
2. **`datetime-local` 입력의 `toHaveValue`가 `"2026-08-31T09:00"` 문자열로 온다.** 초 단위가 붙는지, 타임존이 어떻게 반영되는지 확인하지 않았다. 어긋나면 AC-WEBBREW-13의 기대값을 실제 형식에 맞춘다 — **스펙 수정이 필요하므로 사람에게 보고한다.**
3. **목록에서 레시피 제목을 얻는 방법.** 브루로그 목록 응답에 제목이 없어 `recipeId`마다 `GET /recipes/{id}`를 부른다. 한 화면에 20개면 최대 20번이고, 대부분 같은 레시피라 캐시가 듣는다는 전제다. 실제로 몇 번 나가는지 Task 7에서 확인한다. — **전제 확인(Task 1):** 목록 항목은 상세 응답에서 `overallNote` 하나만 뺀 구조이고(`BrewLogSummaryResponse`) 레시피 제목은 실제로 없다.
4. ~~**`GET /bean-batches`·`/bean-products`·`/roasters`가 페이지 봉투인지 배열인지.**~~ **해소(Task 1):** 셋 다 **배열**이다. 페이지 봉투(`{content,page,size,totalElements,totalPages,hasNext}`)는 `/brew-logs`뿐이다.
5. ~~**원두 선택란의 표시(`프릿츠 예가체프 · 3일차`)를 만들려면 세 응답을 조합해야 한다.**~~ **해소(Task 5):** 셋을 다 부르는 것이 맞고, 셋 다 사용자당 몇 건 수준이라 비용이 문제되지 않았다. 세 목록이 동시에 도착하지 않을 수 있어 `batchLabel`은 **있는 것만으로 라벨을 만든다** — 빈 선택지보다 낫다. **이로써 계획의 미확인 가정 6개가 전부 해소됐다.**
6. ~~**브루로그 생성 응답이 `201`인지 `200`인지.**~~ **해소(Task 1):** `POST /brew-logs`는 **201**이다.
7. **(Task 1에서 새로 드러남) `POST /bean-products`는 `origins`를 반드시 요구한다.** 스펙이 "서버가 생략을 허용한다"고 적어둔 것이 사실이 아니었다 — 키를 빼거나 빈 배열을 보내면 `400 BEAN_MIX_ORIGIN_MISMATCH`다. **사람 승인을 받아 스펙을 고쳤다**: 모달이 `원산지 국가`를 필수로 받고 `beanMix`는 `SINGLE_ORIGIN` 고정, `BLEND`는 비목표 11번으로 뺐다. AC-WEBBREW-05의 When·Then도 그에 맞게 정정했다.

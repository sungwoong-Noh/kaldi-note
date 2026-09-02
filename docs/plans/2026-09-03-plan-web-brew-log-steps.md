# 로그 상세의 푸어 스텝 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-03-web-brew-log-steps.md`

**Goal:** 로그 상세를 보고 그대로 커피를 내릴 수 있다. 실측값 아래에 그 레시피의 푸어 스텝이 읽기 전용으로 붙는다.

**Architecture:** 새 조회가 없다. `useRecipeLabel`이 이미 `GET /recipes/{id}`를 부르고 그 응답 전체를 갖고 있는데 `label`·`isReady`만 내보낸다. **스텝을 함께 내보내게 넓히고, 화면은 `RecipeStepList`를 재사용한다.** `isReady`가 곧 「절을 그릴 조건」이라 못 읽는 세 경우(403·404·조회 중)가 한 갈래로 처리된다.

**작업 위치:** `frontend/` 전용. **백엔드 변경 0줄.**

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-WEBLOGSTEP-01 | 스텝이 순서대로 보인다 | Task 1 | 화면 |
| AC-WEBLOGSTEP-02 | 실측값 뒤, 추출 분석 앞 | Task 1 | 화면 |
| AC-WEBLOGSTEP-06 | 스텝 0개면 안내가 보인다 | Task 1 | 화면 |
| AC-WEBLOGSTEP-07 | 절이 읽기 전용이다 | Task 1 | 화면 |
| AC-WEBLOGSTEP-03 | 403이면 절이 없다 | Task 2 | 화면 |
| AC-WEBLOGSTEP-04 | 404면 절이 없다 | Task 2 | 화면 |
| AC-WEBLOGSTEP-05 | 조회 중이면 절이 없다 | Task 2 | 화면 |

**스펙의 AC 7개 중 7개가 매핑됐다.**

---

## Global Constraints

- **백엔드를 건드리지 않는다.** `git diff --stat main...HEAD`에 `backend/`가 나오면 설계가 어긋난 것이다.
- **새 API 호출을 만들지 않는다.** 스텝은 이미 받고 있는 응답 안에 있다. `pnpm e2e`의 「스텁되지 않은 요청이 없다」가 새 요청을 곧바로 잡는다.
- **`RecipeStepList`를 고치지 않는다.** 레시피 상세와 공유하는 컴포넌트다. 로그 쪽 사정으로 바꾸면 저쪽이 조용히 달라진다.
- **스텝 절에 버튼·입력칸을 두지 않는다.** 푸어링을 바꾸는 것은 새 레시피를 만드는 일이다(스펙의 「범위 밖」 첫 항목).
- **`any` 금지, `as` 단언 금지, `!` 금지.**
- **`Write` 전에 파일이 있는지 본다.** 2026-09-02에 계획이 `Create`로 적은 파일이 이미 있어 기존 테스트 11개를 덮어썼다.
- 커밋 전 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

---

## File Structure

```
frontend/src/
├── features/brewlog/
│   ├── useEntityLabels.ts                    Modify — useRecipeLabel이 steps를 함께 내보낸다
│   └── components/BrewDetail.tsx             Modify — 푸어 스텝 절 추가
└── app/brews/[id]/page.test.tsx              Modify — AC 7개 추가

docs/specs/2026-09-03-web-brew-log-steps.md   Modify — status
```

---

## Task 1: 스텝 절

**Files:**
- Modify: `frontend/src/features/brewlog/useEntityLabels.ts`
- Modify: `frontend/src/features/brewlog/components/BrewDetail.tsx`
- Modify: `frontend/src/app/brews/[id]/page.test.tsx`

**Covers:** AC-WEBLOGSTEP-01, 02, 06, 07

**Interfaces:**
- Changes: `useRecipeLabel(...): EntityLabel & { steps: RecipeStep[] }`
  - 레시피를 못 읽었으면 빈 배열이다. **`isReady`가 false일 때 화면이 절 자체를 안 그리므로** 이 배열은 그때 쓰이지 않는다
  - `useBeanLabel`의 반환은 그대로 `EntityLabel`이다 — 두 훅의 타입이 갈리지만 필요한 쪽만 넓히는 편이 낫다
- Consumes: `RecipeStepList` (`features/recipe/components/RecipeStepList.tsx`) — **그대로 쓴다**

- [ ] **Step 1: 리팩터 전 초록을 확인한다**

Run: `cd frontend && pnpm test`
Expected: PASS. **이 숫자를 적어둔다**(276개일 것).

- [ ] **Step 2: 실패하는 테스트 작성**

`src/app/brews/[id]/page.test.tsx`는 **이미 있는 파일이다.** 열어서 덧붙인다. `beforeEach`가 `GET /recipes/1`을 `grindedRecipe`(스텝 2개)로 스텁하고 있으니, 스펙이 정한 `recipeId: 12` + `kasuyaRecipe`(스텝 6개)로 덮어쓰는 헬퍼를 쓴다.

AC-02는 문서상 순서를 본다. 텍스트 존재만으로는 자리를 못 박는다:

```ts
const measured = screen.getByText("실측값");
const steps = screen.getByText("푸어 스텝");
expect(
  measured.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING,
).toBeTruthy();
```

AC-07은 **절 안쪽만** 본다. 화면 전체에는 `편집`·`삭제` 버튼이 있으므로 범위를 좁히지 않으면 언제나 실패한다. `푸어 스텝` 제목의 부모 `section`을 잡아 `within(...)`으로 센다.

- [ ] **Step 3: 실패 확인**

Run: `cd frontend && pnpm exec vitest run "src/app/brews/[id]/page.test.tsx"`
Expected: FAIL — 아직 절이 없다.

- [ ] **Step 4: 최소 구현**

`useRecipeLabel`이 `steps`를 함께 돌려준다. `recipe.data?.steps ?? []`.

`BrewDetail`의 실측값 `section` 바로 뒤에 절을 넣는다. **기존 절들과 같은 모양을 쓴다** — `<section className="flex flex-col gap-2">` + `<h2 className="text-base font-semibold">`. 레시피 상세는 `text-sm font-medium`을 쓰는데, 여기서는 **이 화면의 다른 제목들과 맞춘다**(`실측값`·`메모`와 같은 크기여야 나란히 읽힌다).

- [ ] **Step 5: 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS, **276 + 4 = 280개**

- [ ] **Step 6: 커밋** — `feat(web): 로그 상세에 푸어 스텝 (AC-WEBLOGSTEP 4개)`

---

## Task 2: 못 읽을 때

**Files:**
- Modify: `frontend/src/app/brews/[id]/page.test.tsx`

**Covers:** AC-WEBLOGSTEP-03, 04, 05

**★ 이 태스크는 TDD의 「빨강」이 보장되지 않는다.** Task 1이 `isReady`로 절을 감쌌다면 세 조건이 처음부터 통과한다. **그것이 정상이다** — 세 경우가 한 갈래로 처리되는 것이 이 설계의 요점이다.

그래도 조건을 쓰는 이유는 **회귀 방지**다. 누군가 `isReady` 대신 `steps.length > 0`으로 바꾸면 403일 때도 빈 절이 그려지는데, 그것을 잡는 것은 이 세 조건뿐이다.

- [ ] **Step 1: 세 조건을 쓴다**

403·404는 기존 파일의 msw 핸들러를 덮어쓰면 된다. **조회 중(AC-05)은 응답을 지연**시켜 만든다 — `await delay()`를 쓰거나 영영 안 끝나는 핸들러를 두고, 로그 응답이 도착한 시점의 화면을 본다.

- [ ] **Step 2: 실행하고 결과를 그대로 본다**

Run: `cd frontend && pnpm exec vitest run "src/app/brews/[id]/page.test.tsx"`
Expected: **셋 다 통과할 가능성이 크다.** 통과하면 그대로 두고, 하나라도 실패하면 그것이 진짜 결함이다.

- [ ] **Step 3: 검사가 실제로 작동하는지 확인한다**

절을 감싼 조건을 `isReady` → `steps.length > 0`으로 **잠시 바꿔** AC-03·04·05 중 몇 개가 빨간불을 내는지 본다. **하나도 안 나오면 세 조건이 아무것도 지키지 않는 것이므로 조건을 다시 쓴다.** 확인 후 되돌린다.

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS, **280 + 3 = 283개**

- [ ] **Step 5: 커밋** — `test(web): 레시피를 못 읽을 때 스텝 절이 없다 (AC-WEBLOGSTEP 3개)`

---

## Task 3: 검증과 마무리

**Files:**
- Modify: `docs/specs/2026-09-03-web-brew-log-steps.md` (status를 `구현완료`로)

**Covers:** 없음 — 마무리

- [ ] **Step 1: 새 요청이 생기지 않았는지 본다**

Run: `cd frontend && pnpm e2e`
Expected: PASS, **39개 그대로.** 「스텁되지 않은 요청이 없다」가 초록이면 새 API 호출이 없다는 뜻이다. 빨간불이면 스텝을 엉뚱한 데서 가져오고 있다.

**레이아웃도 함께 본다.** 상세가 길어져 탭바·가로 스크롤 조건이 흔들릴 수 있다. E2E 스텁은 `/recipes/{id}`에 스텝 7개짜리 픽스처를 주므로 실제보다 긴 화면으로 검사된다.

- [ ] **Step 2: 나머지 검증**

Run: `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:worker`
Expected: 전부 통과

- [ ] **Step 3: 스펙 status 변경**

Run: `./scripts/check-spec-coverage.sh`
Expected: 통과, **AC 476 + 7 = 483개**

- [ ] **Step 4: 커밋** — `docs(spec-web-brew-log-steps): status를 구현완료로`

---

## 완료 기준

- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 (283개)
- [ ] `cd frontend && pnpm test:worker` 통과 (6개)
- [ ] `cd frontend && pnpm e2e` 통과 (39개) — **새 요청이 없다는 증거다**
- [ ] `./scripts/check-spec-coverage.sh` 통과, AC 483개
- [ ] `git diff --stat main...HEAD`에 `backend/`가 없다
- [ ] 스텝 절 안에 버튼·입력칸이 없다
- [ ] CI 초록

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 7개 중 7개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`·`TBD`·"나중에"는 없다.

**타입 일관성:** `useRecipeLabel`만 반환을 넓히고 `useBeanLabel`은 그대로다. `RecipeStepList`의 `steps` 타입(`RecipeStep[]`)이 그대로 흐른다.

**검증되지 않은 가정:**

1. **`RecipeStepList`가 로그 상세의 폭에서 그대로 읽히는지.** 레시피 상세용으로 만든 것이라 좌우 여백이나 글자 크기가 다를 수 있다. Task 1 Step 5에서 화면을 실제로 열어 본다.
2. **절 제목의 크기.** 레시피 상세는 `text-sm font-medium`, 로그 상세의 다른 제목은 `text-base font-semibold`다. **후자를 따르기로 했으나** 나란히 놓았을 때 스텝 목록이 제목보다 커 보일 수 있다 — Task 1에서 눈으로 본다.
3. **조회 중(AC-05)을 테스트로 만들 수 있는지.** msw로 한쪽 응답만 지연시키는 것이 이 저장소에서 처음이다. 잘 안 되면 그 조건만 다른 방식(쿼리를 `enabled: false`로 두는 등)으로 만들고 이유를 계획에 적는다.
4. **레이아웃 E2E가 길어진 화면에서도 초록인지.** Task 3 Step 1에서 드러난다. 빨간불이면 그것은 이번 변경이 만든 진짜 결함이다.
5. **테스트 개수 283.** 기존 테스트를 고쳐야 하면 달라진다. 달라지면 그 자리에서 새 기대값과 이유를 적는다.

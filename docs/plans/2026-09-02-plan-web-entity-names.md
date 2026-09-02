# 브루잉 로그 화면의 레시피·원두 이름 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-02-web-entity-names.md`

**Goal:** 편집 화면의 `12`·`3`이 이름으로 바뀌고, 이름을 못 읽었을 때 그 이유를 알 수 있는 문구가 뜬다.

**Architecture:** 문구 판정을 순수 함수 `entityLabel.ts`로 뽑는다. 화면은 조회 결과를 그 함수에 넘겨 문자열 하나를 받는다. 조회는 훅 둘(`useRecipeLabel`·`useBeanLabel`)이 감싸고, 목록은 기존 `useRecipeTitles`를 라벨까지 만들어 주도록 고친다. **백엔드는 건드리지 않는다.**

**작업 위치:** `frontend/` 전용

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-WEBNAME-10 | 레시피 `FORBIDDEN` → `비공개 레시피` | Task 1 | 단위 |
| AC-WEBNAME-11 | 레시피 `NOT_FOUND` → `삭제된 레시피` | Task 1 | 단위 |
| AC-WEBNAME-12 | 레시피 그 밖의 실패 | Task 1 | 단위 |
| AC-WEBNAME-13 | 레시피 조회 중 → 빈 문자열 | Task 1 | 단위 |
| AC-WEBNAME-20 | 원두 `FORBIDDEN` → `비공개 원두` | Task 1 | 단위 |
| AC-WEBNAME-21 | 원두 `NOT_FOUND` → `삭제된 원두` | Task 1 | 단위 |
| AC-WEBNAME-22 | 원두 그 밖의 실패 | Task 1 | 단위 |
| AC-WEBNAME-23 | 원두 조회 중 → 빈 문자열 | Task 1 | 단위 |
| AC-WEBNAME-24 | 로스터를 못 찾으면 제품명만 | Task 1 | 단위 |
| AC-WEBNAME-01 | 편집이 레시피 제목을 보여준다 | Task 3 | 화면 |
| AC-WEBNAME-02 | 편집이 원두를 `로스터 제품`으로 보여준다 | Task 3 | 화면 |
| AC-WEBNAME-40 | 이름 조회가 실패해도 저장은 된다 | Task 3 | 화면 |
| AC-WEBNAME-03 | 상세에 원두 줄이 있다 | Task 4 | 화면 |
| AC-WEBNAME-30 | 읽었으면 제목이 링크다 | Task 4 | 화면 |
| AC-WEBNAME-31 | 폴백 문구는 링크가 아니다 | Task 4 | 화면 |
| AC-WEBNAME-41 | 하나가 실패해도 나머지 카드는 제목을 보여준다 | Task 5 | 화면 |
| AC-WEBNAME-42 | 같은 레시피는 조회 1회 | Task 5 | 화면 |

**스펙의 AC 17개 중 17개가 매핑됐다.**

---

## Global Constraints

- **백엔드를 건드리지 않는다.** `git diff --stat main...HEAD`에 `backend/`가 나오면 설계가 어긋난 것이다.
- **픽스처를 지어내지 않는다.** `src/test/fixtures.ts`의 것을 쓴다 — `yirgacheffeBatch`·`yirgacheffeProduct`·`fritzRoaster`·`hoffmann`이 전부 실제 응답에서 뜬 것이다. 모자라면 로컬 백엔드를 띄워 뜬 뒤 그 파일에 더한다.
- **`any` 금지, `as` 단언 금지, `!` 금지.**
- **화면은 `code`로 분기한다.** `message` 문자열이나 HTTP 상태 숫자로 판단하지 않는다(`docs/conventions/frontend.md`).
- **`Write` 전에 파일이 있는지 본다.** 이 계획이 `Create`로 적은 것도 마찬가지다 — 2026-09-02에 계획이 `Create`라고 적은 파일이 이미 있어서 기존 테스트 11개를 덮어썼다.
- 커밋 전 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. E2E는 `pnpm e2e`로 따로.

---

## File Structure

```
frontend/src/
├── features/brewlog/
│   ├── entityLabel.ts              Create — 판정 순수 함수
│   ├── entityLabel.test.ts         Create — AC 9개
│   ├── useEntityLabels.ts          Create — useRecipeLabel · useBeanLabel
│   └── useRecipeTitles.ts          Modify — 제목 대신 라벨을 돌려준다
├── features/inventory/api.ts       Modify — fetchBeanBatch(id)
├── features/catalog/api.ts         Modify — fetchBeanProduct(id)
└── features/brewlog/components/
    ├── BrewLogEditor.tsx           Modify — id → 이름
    ├── BrewDetail.tsx              Modify — 원두 줄 신설, 링크 조건부
    └── BrewLogCard.tsx             Modify — prop 이름과 폴백 제거

frontend/src/app/
├── brews/[id]/edit/page.test.tsx   Modify — AC 3개 추가
├── brews/[id]/page.test.tsx        Modify — AC 3개 추가
├── brews/page.test.tsx             Modify — AC 2개 추가
└── page.test.tsx                   Modify — 카드 prop 변경 반영

frontend/e2e/stubs.ts               Modify — /bean-batches/{id} · /bean-products/{id}
docs/specs/2026-09-02-web-entity-names.md   Modify — status
```

---

## Task 1: 판정 순수 함수

**Files:**
- Create: `frontend/src/features/brewlog/entityLabel.ts`, `frontend/src/features/brewlog/entityLabel.test.ts`

**Covers:** AC-WEBNAME-10, 11, 12, 13, 20, 21, 22, 23, 24

**Interfaces:**
- Produces: `type LabelSource = { state: "loading" } | { state: "ready"; name: string } | { state: "failed"; code: string }`
- Produces: `entityLabel(kind: "recipe" | "bean", source: LabelSource): string`
- Produces: `beanName(product?: { name: string }, roaster?: { name: string }): string`
- Produces: `combineSources(snapshots: readonly { isPending: boolean; error: unknown }[], name?: string): LabelSource`

**왜 순수 함수로 뽑는가:** 문구가 8개이고 화면이 3개다. 화면마다 네 갈래를 재현하면 테스트가 12개가 되는데, 검증하는 것은 같은 표 하나다. 앞 세션의 레이아웃 E2E가 같은 이유로 판정을 함수로 뽑았다.

**판정 순서 (`combineSources`):** 실패가 하나라도 있으면 **첫 실패의 `code`**. 실패가 없고 `isPending`이 하나라도 있으면 `loading`. 전부 성공이면 `ready`.

- [x] **Step 1: 리팩터 전 초록을 확인한다**

Run: `cd frontend && pnpm test`
Expected: PASS. **이 숫자를 적어둔다**(249개일 것). 이후 모든 Step에서 이 숫자와 대조한다.

- [x] **Step 2: 실패하는 테스트 작성**

`entityLabel.test.ts`에 AC 9개를 쓴다. `DisplayName` 자리에 AC ID를 넣는다:

```ts
it("AC-WEBNAME-10 · 레시피가 FORBIDDEN이면 비공개 레시피", () => {
  expect(entityLabel("recipe", { state: "failed", code: "FORBIDDEN" })).toBe("비공개 레시피");
});
```

`ApiError`로 만든 실제 에러를 `combineSources`에 넘기는 경우도 함께 검증한다 — `code`를 꺼내는 부분이 여기서만 테스트된다.

AC-24는 `beanName`을 직접 부른다:

```ts
it("AC-WEBNAME-24 · 로스터를 못 찾으면 제품명만 쓴다", () => {
  expect(beanName({ name: "예가체프" }, undefined)).toBe("예가체프");
});
```

- [x] **Step 3: 실패 확인**

Run: `cd frontend && pnpm test entityLabel`
Expected: FAIL — `entityLabel.ts`가 없다.

- [x] **Step 4: 최소 구현**

문구 표는 스펙의 「폴백 문구」 절과 **문자 하나까지 같아야 한다.** 옮겨 적을 때 스펙을 열어두고 대조한다.

- [x] **Step 5: 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS, **266개**. 계획은 258개(249+9)로 봤으나 AC 9개 외에 `combineSources`·`beanName`의 판정 규칙을 고정하는 테스트 8개를 더 썼다 — 「실패가 pending보다 이긴다」는 아래 미확인 가정 1번이라 함수 단위로 못박았다.

- [x] **Step 6: 커밋** — `feat(web): 이름 폴백 판정 함수 (AC-WEBNAME 9개)`

---

## Task 2: 이름 조회 훅

**Files:**
- Modify: `frontend/src/features/inventory/api.ts`, `frontend/src/features/catalog/api.ts`
- Create: `frontend/src/features/brewlog/useEntityLabels.ts`

**Covers:** 없음 — 배선. **기존 테스트가 하나도 깨지지 않는 것이 이 태스크의 인수 조건이다.**

**Interfaces:**
- Produces: `fetchBeanBatch(id: number, onSessionLost?): Promise<BeanBatch>` — `GET /bean-batches/{id}`, `beanBatchSchema`
- Produces: `fetchBeanProduct(id: number, onSessionLost?): Promise<BeanProduct>` — `GET /bean-products/{id}`, `beanProductSchema`
- Produces: `useRecipeLabel(recipeId: number | undefined, enabled: boolean, onSessionLost?): string`
- Produces: `useBeanLabel(beanBatchId: number | undefined, enabled: boolean, onSessionLost?): string`
- Consumes: Task 1의 `entityLabel`·`beanName`·`combineSources`, 기존 `useRoasters`

**왜 목록이 아니라 `/{id}`인가:** `GET /bean-batches`는 **내 재고만** 준다. 남의 로그의 배치는 목록에 없을 뿐이라 「권한이 없다」와 「삭제됐다」를 가를 수 없다. 폴백 네 갈래가 성립하려면 단건 조회여야 한다. 작성 화면의 `batchLabel`이 목록 3개를 쓰는 것과 다른 이유가 이것이다 — **그 함수를 재사용하지 않는다.**

**`useBeanLabel`의 연쇄:** `fetchBeanBatch` → 성공하면 그 `beanProductId`로 `fetchBeanProduct` → `useRoasters`(이미 캐시될 가능성이 높다). 뒤 조회는 앞이 성공했을 때만 `enabled`가 된다. **`enabled: false`인 쿼리는 `isPending`이 `true`다** — 그대로 넘기면 실패한 상황이 `loading`으로 보인다. 앞이 실패했으면 그 실패가 첫 실패이므로 `combineSources`의 순서가 이것을 막아 준다. Step 3에서 실제로 확인한다.

- [ ] **Step 1: 단건 조회 함수 둘을 더한다**

기존 `fetchRecipe`와 같은 모양으로 쓴다. 스키마는 이미 있다(`beanBatchSchema`·`beanProductSchema`).

- [ ] **Step 2: 훅 둘을 만든다**

`queryKey`는 기존 관례를 따른다 — `["bean-batch", id]`, `["catalog", "bean-product", id]`. 로스터는 기존 `useRoasters`의 키를 그대로 쓴다.

- [ ] **Step 3: `enabled: false`가 실패를 가리지 않는지 확인한다**

임시 테스트를 하나 써서, **배치 조회가 403일 때** `useBeanLabel`이 `비공개 원두`를 돌려주는지 본다. `loading`(빈 문자열)이 나오면 `combineSources`에 넘기는 스냅샷 구성이 틀린 것이다. 확인 후 임시 테스트는 지우고, 이 조건은 Task 3의 화면 테스트가 대신 지킨다.

- [ ] **Step 4: 기존 것이 그대로인지 확인한다**

Run: `cd frontend && pnpm test`
Expected: PASS, **266개 그대로.**

Run: `cd frontend && pnpm typecheck && pnpm lint`
Expected: 통과

- [ ] **Step 5: 커밋** — `feat(web): 레시피·원두 이름 조회 훅`

---

## Task 3: 편집 화면

**Files:**
- Modify: `frontend/src/features/brewlog/components/BrewLogEditor.tsx`
- Modify: `frontend/src/app/brews/[id]/edit/page.test.tsx`

**Covers:** AC-WEBNAME-01, 02, 40

**Interfaces:**
- Consumes: Task 2의 `useRecipeLabel`·`useBeanLabel`

- [ ] **Step 1: 실패하는 테스트 작성**

`edit/page.test.tsx`는 **이미 있는 파일이다.** 열어서 기존 `describe`에 덧붙인다. 새 msw 핸들러가 셋 필요하다 — `/bean-batches/3`, `/bean-products/3`, `/roasters`.

AC-40은 이름 조회가 403이어도 `PATCH`가 나가는지 본다. **`rating`만 바꾸고 본문이 `{"rating":5}` 하나인지까지 대조한다** — 이름 조회를 붙이면서 폼 상태에 값이 섞여 들어가는 사고를 여기서 잡는다.

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && pnpm test edit`
Expected: FAIL — 화면이 아직 `12`·`3`을 그린다.

- [ ] **Step 3: 최소 구현**

`beanSlot`의 `<dd>{state.recipeId}</dd>`와 `<dd>{state.beanBatchId}</dd>`를 훅이 준 문자열로 바꾼다. 링크로 감싸지 않는다.

주석의 「레시피와 원두는 PATCH DTO에 없어 서버가 무시한다. 값만 보여준다」는 여전히 맞다 — 문장을 지우지 말고 이름을 보여준다는 사실만 반영한다.

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS, **266 + 3 = 269개**

- [ ] **Step 5: 커밋** — `feat(web): 편집 화면이 레시피·원두를 이름으로 보여준다 (AC-WEBNAME 3개)`

---

## Task 4: 상세 화면

**Files:**
- Modify: `frontend/src/features/brewlog/components/BrewDetail.tsx`
- Modify: `frontend/src/app/brews/[id]/page.test.tsx`

**Covers:** AC-WEBNAME-03, 30, 31

- [ ] **Step 1: 실패하는 테스트 작성**

`[id]/page.test.tsx`도 **이미 있는 파일이다.** 덧붙인다.

AC-31은 「텍스트가 있고 그 텍스트를 가진 링크는 없다」를 본다. `queryByRole("link", { name: "비공개 레시피" })`가 `null`인지 보는 방식으로 쓴다 — `getByText`만으로는 링크 여부를 판정하지 못한다.

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && pnpm test 'brews/\[id\]/page'`
Expected: FAIL — 원두 줄이 없고, 폴백도 여전히 링크다.

- [ ] **Step 3: 최소 구현**

제목: 이름을 읽었을 때만 `<Link>`, 아니면 같은 자리에 `<span>`. **두 갈래가 같은 글자 크기·굵기를 갖게 한다** — 폴백일 때만 작아 보이면 레이아웃이 흔들린다.

원두: 실측값 위에 `원두` 라벨과 값을 `<dl>`로 한 줄 넣는다. 상세 화면의 기존 `dl` 구조를 따른다.

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS, **269 + 3 = 272개**

- [ ] **Step 5: 커밋** — `feat(web): 상세 화면의 원두 줄과 조건부 링크 (AC-WEBNAME 3개)`

---

## Task 5: 목록과 홈

**Files:**
- Modify: `frontend/src/features/brewlog/useRecipeTitles.ts`
- Modify: `frontend/src/features/brewlog/components/BrewLogCard.tsx`
- Modify: `frontend/src/app/brews/page.test.tsx`
- Modify: `frontend/src/app/page.test.tsx`(카드 prop 변경 반영), `frontend/src/app/brews/page.tsx`, `frontend/src/app/page.tsx`

**Covers:** AC-WEBNAME-41, 42

**Interfaces:**
- Changes: `useRecipeTitles(...): Map<number, string>` — **값이 제목이 아니라 라벨이 된다.** 실패한 id도 키를 갖는다(지금은 없다)
- Changes: `BrewLogCard`의 prop `recipeTitle?: string` → `recipeLabel: string`

**이름을 바꾸는 이유:** `recipeTitle`은 「제목」이라는 뜻이라 `비공개 레시피`가 들어가면 거짓말이 된다. **prop이 필수가 되므로** 넘기는 것을 빠뜨리면 타입 검사가 잡는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`brews/page.test.tsx`에 AC 둘을 더한다. AC-42는 **호출 횟수를 세야 한다** — msw 핸들러에 카운터를 두고 `GET /recipes/12`가 정확히 1인지 본다. "출력을 찍는 것과 기대값에 대조하는 것은 다른 일"이므로 `toBe(1)`로 못박는다.

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && pnpm test brews/page`
Expected: FAIL

- [ ] **Step 3: 최소 구현**

`useRecipeTitles`가 각 id마다 `combineSources` → `entityLabel("recipe", ...)`을 거쳐 라벨을 넣게 고친다. 함수 이름도 `useRecipeLabels`로 바꾼다 — 파일명까지 함께 바꾼다.

`BrewLogCard`의 `{recipeTitle ?? \`레시피 ${log.recipeId}\`}`를 `{recipeLabel}`로 바꾼다. **`??` 폴백을 남겨두지 않는다** — 남기면 이번에 없앤 문구가 조용히 되살아난다.

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS, **272 + 2 = 274개**

Run: `cd frontend && grep -rn "레시피 \${" src`
Expected: 출력 없음(픽스처의 `레시피 ${startId + i}`는 목록 픽스처 생성기라 제외 — 그것만 남는지 눈으로 확인한다)

- [ ] **Step 5: 커밋** — `feat(web): 목록·홈 카드가 라벨을 쓴다 (AC-WEBNAME 2개)`

---

## Task 6: E2E 스텁과 마무리

**Files:**
- Modify: `frontend/e2e/stubs.ts`
- Modify: `docs/specs/2026-09-02-web-entity-names.md` (status를 `구현완료`로)

**Covers:** 없음 — 인프라

**왜 필요한가:** 상세와 편집이 `GET /bean-batches/3`·`GET /bean-products/3`을 새로 부른다. 지금 스텁 표의 패턴은 `^/api/v1/bean-batches$`처럼 끝을 고정해 두어 **단건 경로가 걸리지 않는다.** 레이아웃 E2E의 「스텁되지 않은 요청이 없다」 조건이 곧바로 빨간불을 낸다.

- [ ] **Step 1: 먼저 빨간불을 확인한다**

Run: `cd frontend && pnpm e2e layout`
Expected: **FAIL.** `/brews/2`와 `/brews/2/edit`에서 `unstubbed`에 두 URL이 잡혀야 한다. **여기서 통과하면 화면이 그 조회를 안 하고 있다는 뜻이므로 Task 3·4로 돌아간다.**

- [ ] **Step 2: 스텁을 더한다**

`HANDLERS`에 두 줄을 더한다. **단건이 목록보다 위에 와야 한다** — 순서를 바꾸면 `/bean-batches/3`이 목록 응답을 받는다.

```ts
[/^\/api\/v1\/bean-batches\/\d+$/, yirgacheffeBatch],
[/^\/api\/v1\/bean-products\/\d+$/, yirgacheffeProduct],
```

- [ ] **Step 3: 통과 확인**

Run: `cd frontend && pnpm e2e`
Expected: PASS, **39개 그대로.** 화면이 늘지 않았으므로 개수는 변하지 않는다.

- [ ] **Step 4: 스펙 status 변경**

Run: `./scripts/check-spec-coverage.sh`
Expected: 통과, **AC 459 + 17 = 476개**. 이 스펙의 17개가 전부 발견돼야 한다.

- [ ] **Step 5: 커밋** — `test(web): E2E 스텁에 단건 조회를 더한다`

---

## 완료 기준

- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 (274개)
- [ ] `cd frontend && pnpm test:worker` 통과 (6개)
- [ ] `cd frontend && pnpm e2e` 통과 (39개)
- [ ] `./scripts/check-spec-coverage.sh` 통과, AC 476개
- [ ] `git diff --stat main...HEAD`에 `backend/`가 없다
- [ ] `grep -rn "레시피 \${" frontend/src`에 화면 코드가 없다
- [ ] CI 초록

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 17개 중 17개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`·`TBD`·"나중에"는 없다.

**타입 일관성:** Task 1의 `LabelSource`를 Task 2의 훅 둘이 만들고, Task 3·4·5가 훅의 반환 문자열만 쓴다. `entityLabel`을 화면에서 직접 부르는 곳은 없다.

**검증되지 않은 가정:**

1. **`enabled: false`인 쿼리의 `isPending`이 `true`라는 것.** TanStack Query v5의 동작이다. 연쇄 조회에서 앞이 실패했을 때 뒤 쿼리가 `pending`으로 남아 `loading`이 이기면 폴백이 안 나온다. `combineSources`가 실패를 먼저 보므로 막히지만, **Task 2 Step 3에서 실제로 확인한다.**
2. **`GET /bean-products/{id}`가 남의 원두에도 200을 준다는 것.** 제품·로스터는 공용 카탈로그라 그럴 것으로 보이나 확인하지 않았다. 만약 이것도 403이면 AC-WEBNAME-22의 「배치는 성공, 제품은 실패」 시나리오가 실제로는 잘 안 생길 뿐 판정은 그대로다 — 스펙 변경은 필요 없다.
3. **상세 화면의 원두 줄을 넣을 자리.** 실측값 `dl` 위에 넣기로 했으나 기존 마크업이 그것을 자연스럽게 받는지는 Task 4에서 드러난다.
4. **테스트 개수 266.** 기존 테스트를 고쳐야 하면(카드 prop 변경 때문에 `page.test.tsx`가 걸릴 수 있다) 숫자가 달라진다. **달라지면 그 자리에서 새 기대값을 적고 이유를 남긴다.**
5. **`useRecipeTitles` 이름 변경의 파급.** 홈과 목록 둘이 부른다. 파일명을 바꾸면 import도 둘 다 고쳐야 한다 — 타입 검사가 잡는다.

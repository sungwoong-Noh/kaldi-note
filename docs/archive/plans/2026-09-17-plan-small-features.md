# 작은 기능 3개 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-17-small-features.md`

**Goal:** 비교표가 차이를 문장으로 말하고, 환산 결과와 기록이 다음 행동으로 이어진다.

**Architecture:** 차이 문구는 **순수 함수**로 뽑는다(`diffPhrase`). 화면에서 조립하면
문장 규칙이 마크업에 흩어지고 경계값(같을 때·기준값 없을 때)을 테스트하기 어렵다.
나머지 둘은 링크 하나씩이라 화면에서 끝난다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md`

---

## AC 커버리지 매핑

| AC ID | 담당 태스크 | 검증 |
|---|---|---|
| AC-SMALL-01~04 | Task 1 | 단위 (순수 함수) |
| AC-SMALL-05~06 | Task 1 | 단위 (경계값) |
| AC-SMALL-07~09 | Task 2 | 단위 (렌더) |
| AC-SMALL-10~11 | Task 3 | 단위 (렌더) |

---

## Global Constraints

- **`data-diff` 속성을 지우지 않는다.** 기존 AC가 그것으로 비교표를 잡는다.
- **문구는 서버가 아니라 프론트가 만든다.** 차이 계산에 필요한 값이 이미 화면에 다 있고,
  이 문장은 표현이지 판정이 아니다 — 서버 판정 문구(분쇄도 경고·SCA 존)와 성격이 다르다.
- **평가하지 않는다.** 「원두를 1.0g 더 썼습니다」이지 「너무 많습니다」가 아니다.
  브랜드 문서의 목소리 규칙이다.

---

## Task 1: 차이 문구

**Files:**
- Create: `src/features/brewlog/diffPhrase.ts`, `src/features/brewlog/diffPhrase.test.ts`
- Modify: `src/features/brewlog/components/RecipeComparison.tsx`

**Covers:** AC-SMALL-01~06

**인터페이스**

```ts
export type DiffKind = "weight" | "temperature" | "duration";

/** 기준값이 없거나 차이가 없으면 `null`. 화면은 null이면 아무것도 그리지 않는다. */
export function diffPhrase(
  kind: DiffKind,
  subject: string,
  target: number | undefined,
  actual: number | undefined,
): string | null;
```

- [x] **Step 1: 실패하는 테스트** — 스펙의 AC 6개를 그대로 옮긴다
- [x] **Step 2: 실패 확인**
- [x] **Step 3: 구현.** 단위별 어미가 다르다 — 무게는 「더/덜 썼습니다」, 온도는
      「높게/낮게 내렸습니다」, 시간은 「빨리/늦게 끝났습니다」
- [x] **Step 4: `RecipeComparison`에 붙인다.** `[data-diff-text]`를 단다
- [x] **Step 5: 모바일 폭에서 행이 두 줄이 되는지 확인**(스펙의 「열어둔 결정」)
- [x] **Step 6: 전체 초록 + 커밋**


**계획과 달라진 점(2026-09-17).**

- **시간 차이에 `formatDuration`을 쓸 수 없었다.** 그 포맷터는 `3:30`처럼 **시점**을 적는
  것이라 15초 차이가 `0:15`로 나온다 — 「0:15 빨리 끝났습니다」는 읽히지 않는다.
  차이 전용 `gapDuration()`을 따로 뒀다(`15초` · `1분 15초` · `2분`).
- **한국어 조사 처리가 필요했다.** 「원두**를**」과 「물**을**」이 갈린다.
  받침은 `(코드 - 0xAC00) % 28`로 판정한다.
- 행이 두 줄이 되는 것은 **의도한 배치**다(목업이 문구를 값 아래 우측 정렬로 둔다).
  모바일 폭에서 확인했고 지저분하지 않다.

## Task 2: 이 값으로 기록하기

**Files:** Modify: `src/features/gear/components/GrindConverter.tsx` 및 그 테스트

**Covers:** AC-SMALL-07~09

- [ ] **Step 1: 실패하는 테스트**
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 환산 성공 시 `ButtonLink`를 낸다.** `/brews/new?userGrinderId=…&grindSettingValue=…`
- [ ] **Step 4: 기록 작성 화면이 그 쿼리를 읽는지 확인.** 안 읽으면 읽게 한다 —
      **링크만 만들고 받는 쪽이 무시하면 아무 일도 안 일어난다**
- [ ] **Step 5: 전체 초록 + 커밋**

## Task 3: 다시 내리기

**Files:** Modify: `src/features/brewlog/components/BrewDetail.tsx` 및 그 테스트

**Covers:** AC-SMALL-10~11

- [ ] **Step 1: 실패하는 테스트** — `recipeId` 있을 때/없을 때 둘 다
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 액션 영역에 `ButtonLink` 추가**
- [ ] **Step 4: 전체 초록 + 스펙 `구현완료` + 커밋 + PR**

---

## 검증

**자동:** `pnpm test` · `pnpm e2e` · `pnpm build` · `pnpm lint` · `./scripts/check-spec-coverage.sh`

**수동**

- [ ] 기록 상세에서 차이 문구가 **읽히는 문장인지** — 어색하면 어미를 고친다
- [ ] 환산 → 기록 작성으로 넘어갔을 때 **분쇄도가 실제로 채워져 있는지**

---

## 리스크

| 리스크 | 대응 |
|---|---|
| 기록 작성 화면이 쿼리 파라미터를 안 읽는다 | Task 2 Step 4에서 먼저 확인. 안 읽으면 그쪽도 고친다 |
| 차이 문구가 모바일에서 줄바꿈으로 지저분해진다 | Task 1 Step 5에서 눈으로 확인 |
| 소수점 표기가 어색하다(`1.0g` vs `1g`) | 기존 `formatGrams`를 그대로 쓴다 — 표기를 새로 만들지 않는다 |

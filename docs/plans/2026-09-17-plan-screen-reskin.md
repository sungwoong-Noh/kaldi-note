# 기존 16화면 리스킨 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-17-screen-reskin.md`

**Goal:** 기존 화면이 목업과 같은 문법을 쓴다 — 히어로 카드·아이브로우·원장 행·단일 Shell.

**Architecture:** 프리미티브를 먼저 늘리고(`Hero`·`Eyebrow`·`Shell`) 화면을 그쪽으로 옮긴다.
화면마다 마크업을 손으로 고치면 16번 같은 판단을 반복하게 되고, 그게 지금 카드 7곳이
제각각인 이유다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md`

---

## AC 커버리지 매핑

| AC ID | 담당 태스크 | 검증 |
|---|---|---|
| AC-SKIN-01 | Task 1 | 단위 (소스 스캔) |
| AC-SKIN-02 | Task 2 | 단위 (소스 스캔) |
| AC-SKIN-03 | Task 3 | e2e (DOM 조상) |
| AC-SKIN-04 | Task 3 | e2e (렌더 색) |
| AC-SKIN-05 | Task 3 | e2e (렌더 스타일) |
| AC-SKIN-06 | Task 1 | 단위 |
| AC-SKIN-07 | Task 1 | e2e (렌더 border) |
| AC-SKIN-08 | Task 4 | 단위 (소스 스캔) |
| AC-SKIN-09 | Task 4 | e2e (터치 스윕) |
| AC-SKIN-10 | Task 4 | e2e (가로 스크롤) |
| AC-SKIN-11 | Task 4 | e2e |

---

## Global Constraints

- **각 태스크 끝에 `pnpm test`·`pnpm e2e`가 초록이어야 한다.** 16화면을 동시에 만지므로
  중간에 빨간 채로 넘어가면 어디서 깨졌는지 못 찾는다.
- **`data-*` 훅을 지우지 않는다.** 마크업을 바꿔도 `data-lead`·`data-compare`·`data-diff`·
  `data-empty`는 남긴다(`AC-SKIN-08`).
- **서버가 준 문구를 건드리지 않는다** — 분쇄도 경고, 프로필 관계 문구, SCA 존 판정.

---

## File Structure

```
frontend/src/components/ui/
├── Hero.tsx        ← 신규: 다크 블록 + 아이브로우 + 대표 수치 + 서브메트릭
├── Eyebrow.tsx     ← 신규: Mono 대문자 라벨
├── Shell.tsx       ← 신규: 화면 공통 컨테이너
└── Surface.tsx     ← 수정: MetricRow에 원장 행 border-top
```

---

## Task 1: 프리미티브 3종 추가

**Files:**
- Create: `src/components/ui/{Hero,Eyebrow,Shell}.tsx`
- Modify: `src/components/ui/{Surface.tsx,index.ts}`, `src/test/primitives.test.tsx`

**Covers:** AC-SKIN-01(일부), AC-SKIN-06, AC-SKIN-07

- [ ] **Step 1: 실패하는 테스트** — `Hero`·`Eyebrow`·`Shell` import가 없어 실패한다
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현.** `Hero`는 `data-hero`를, `Eyebrow`는 `data-eyebrow`를 단다.
      히어로 배경은 **모드와 무관하게 어두운 블록**이므로 `--ink` 계열 리터럴이 아니라
      전용 토큰(`--hero`)을 `globals.css`에 더한다 — 라이트·다크 양쪽에서 같은 값이다
- [ ] **Step 4: `MetricRow`에 `border-top: 1px solid var(--divider)`**
- [ ] **Step 5: 통과 확인 + 커밋**

## Task 2: Shell·Card 이관

**Files:** Modify: 16화면 전부

**Covers:** AC-SKIN-01, AC-SKIN-02

- [ ] **Step 1: 실패하는 테스트** — `rounded-surface` 직접 사용 0곳, Shell 1종
- [ ] **Step 2: 실패 확인** (현재 카드 7곳 · Shell 2종)
- [ ] **Step 3: 화면의 `<main>`을 `Shell`로 교체**
- [ ] **Step 4: 카드 7곳을 `Card`로 교체.** 다이얼로그 4곳은 `bg-paper`가 필요하므로
      `Card`에 `tone="raised"` 같은 변형이 필요한지 여기서 판단한다
- [ ] **Step 5: `pnpm test` + `pnpm e2e` 초록 + 커밋**

## Task 3: 히어로 카드 도입

**Files:** Modify: `RecipeDetail.tsx`, `BrewDetail.tsx`, `GrindConverter.tsx`, `e2e/`

**Covers:** AC-SKIN-03, AC-SKIN-04, AC-SKIN-05

- [ ] **Step 1: e2e 테스트 작성** — `data-lead`의 조상에 `data-hero`가 있는지,
      히어로 배경이 `paper`보다 어두운지, 아이브로우가 Mono 대문자인지
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 세 화면의 대표 수치를 `Hero`로 감싼다.** 목업(`RecipeWeb.dc.html`·
      `GearDetail.dc.html`)의 구성을 따른다 — 아이브로우 · 36px 수치 · 구분선 · 서브메트릭 그리드
- [ ] **Step 4: 목록 카드에도 히어로를 쓸지 판단** (스펙의 「열어둔 결정」).
      **눈으로 보고 정한다** — 다크 블록이 목록에 여러 개 쌓이면 무겁다
- [ ] **Step 5: 통과 확인 + 스크린샷으로 라이트·다크 확인 + 커밋**

## Task 4: 회귀 확인과 마감

**Files:** Modify: `src/test/`, `e2e/`, 스펙

**Covers:** AC-SKIN-08, 09, 10, 11

- [ ] **Step 1: 회귀 AC 4개 테스트 작성**
- [ ] **Step 2: 16화면 전부 e2e 스윕 통과 확인**
- [ ] **Step 3: 라이트·다크 전 화면 스크린샷 대조**
- [ ] **Step 4: 스펙 `status`를 `구현완료`로 + `check-spec-coverage.sh` 통과**
- [ ] **Step 5: 커밋 + PR**

---

## 검증

**자동:** `pnpm test` · `pnpm e2e` · `pnpm build` · `pnpm lint` · `./scripts/check-spec-coverage.sh`

**수동 (차단형)**

- [ ] 라이트·다크 양쪽에서 16화면을 폰 크기로 연다 — **히어로 블록이 두 모드 모두 읽히는지**
- [ ] 목록 화면에 다크 블록이 여러 개일 때 **무겁지 않은지**

---

## 리스크

| 리스크 | 대응 |
|---|---|
| 히어로 다크 블록이 라이트 모드에서 튄다 | Task 3 Step 5에서 눈으로 확인. 튀면 목록에서는 빼고 상세에만 쓴다 |
| 16화면 동시 수정으로 e2e가 대량 실패 | 태스크를 Shell → Card → Hero 순으로 쪼갰다. 각 단계마다 e2e를 돌린다 |
| 다이얼로그가 `Card`와 요구가 다르다 | Task 2 Step 4에서 판단. 변형이 필요하면 `Card`에 더한다 |

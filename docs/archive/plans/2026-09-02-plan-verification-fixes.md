# 수동 확인에서 드러난 결함 수정 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-08-14-extraction-analysis.md`(AC-EXT-06 정정), `docs/specs/2026-09-01-web-shell.md`(AC-WEBSHELL-32 추가)

**Goal:** 실물에서 드러난 두 결함을 고친다 — 탭바가 짧은 화면에서 하단에 붙지 않는 것, 그리고 음료 중량만 없을 때 "TDS가 없다"고 틀리게 말하는 것.

**Architecture:** 둘 다 이미 있는 코드의 한 줄짜리 결함이다. 새 구조를 만들지 않는다. 탭바는 `BottomNav`의 className에 `mt-auto`를 더하고(`body`가 이미 `flex min-h-full flex-col`이다), 진단 문구는 `ExtractionAnalyzer`가 `yieldMeasurable()` 실패를 **TDS 누락과 음료 중량 누락으로 나눠** 판정하게 한다.

**작업 위치:** `frontend/`(Task 1), `backend/`(Task 2)

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → 각 워크스페이스의 `CLAUDE.md` → `docs/conventions/git.md`

---

## 배경 — 왜 테스트가 초록인데 실물이 틀렸나

2026-09-02 수동 확인 세션에서 로컬 실물(백엔드 `bootRun` + 프론트 `pnpm dev`, 375px)을 밟다 나왔다.

- **탭바:** AC 31개 중 **위치를 못박은 것이 없었다.** 이동·활성·숨김만 검증하므로 `sticky bottom-0`이 짧은 화면에서 무력한 것을 아무도 보지 않았다.
- **진단 문구:** `AC-EXT-06`이 "수율이 null이다"만 요구하고 **문구를 규정하지 않았다.** 구현이 두 누락을 한 문구로 묶어도 통과한다.

두 스펙 모두 사람 승인 아래 정정했고, 정정 이유는 각 스펙 본문의 인용 블록에 남겼다.

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-WEBSHELL-32 | 콘텐츠가 짧아도 탭바가 하단에 | Task 1 | 컴포넌트 테스트 |
| AC-EXT-06 | 음료 중량이 없으면 그 사실을 말한다 | Task 2 | 단위 테스트 |

**정정·추가된 AC 2개가 모두 매핑됐다.**

---

## Global Constraints

- **두 태스크는 서로 의존하지 않는다.** 순서를 바꿔도 되지만 각각 커밋한다.
- **`AC-EXT-06`은 이미 테스트가 있다.** 새로 만들지 말고 **그 테스트의 Then을 강화한다** — 그래야 Step 2에서 실제로 빨갛다.
- 커밋 전 각 워크스페이스의 전체 검증을 돌린다. 탭바는 레이아웃 변경이므로 **`pnpm test:worker`도 돌린다.**
- 백엔드 문구는 `ExtractionAnalyzer`의 상수로 둔다 — 프론트는 서버가 준 문구를 그대로 보여줄 뿐이라 프론트 변경은 없다.

---

## File Structure

```
frontend/src/components/layout/
├── BottomNav.tsx                    Modify — mt-auto
└── BottomNav.test.tsx               Modify — AC-WEBSHELL-32

backend/src/main/java/com/kaldinote/extraction/domain/
└── ExtractionAnalyzer.java          Modify — 누락 사유를 나눠 판정

backend/src/test/java/com/kaldinote/extraction/domain/
└── ExtractionAnalyzerTest.java      Modify — AC-EXT-06의 Then 강화
```

---

## Task 1: 탭바를 화면 하단에 붙인다

**Files:**
- Modify: `frontend/src/components/layout/BottomNav.tsx`
- Test: `frontend/src/components/layout/BottomNav.test.tsx`

**Covers:** AC-WEBSHELL-32

**Interfaces:**
- Consumes: 없음
- Produces: 없음 — `nav`의 className만 바뀐다

- [x] **Step 1: 실패하는 테스트 작성**

`BottomNav.test.tsx`에 더한다. 기존 테스트가 `pathname`을 모듈 변수로 주입하는 방식을 그대로 따른다.

```tsx
  it("AC-WEBSHELL-32 · 콘텐츠가 짧아도 탭바가 화면 하단에 놓인다", () => {
    pathname = "/";

    render(<BottomNav />);

    // jsdom은 레이아웃을 계산하지 않는다. 좌표 대신 하단에 놓이게 하는 클래스를 본다.
    const nav = screen.getByRole("navigation", { name: "주요 화면" });
    for (const className of ["mt-auto", "sticky", "bottom-0"]) {
      expect(nav).toHaveClass(className);
    }
  });
```

`getByRole("navigation", { name: "주요 화면" })`이 맞는지 확인한다 — `nav`에 `aria-label="주요 화면"`이 있다.

- [x] **Step 2: 실패 확인**

Run: `cd frontend && pnpm vitest run src/components/layout`
Expected: FAIL — `mt-auto`가 없다. `sticky`·`bottom-0`은 이미 있으므로 그 둘로는 빨갛지 않다.

- [x] **Step 3: 최소 구현**

`BottomNav.tsx`의 `nav` className 맨 앞에 `mt-auto`를 더한다:

```tsx
      className="mt-auto sticky bottom-0 z-10 grid grid-cols-4 border-t border-black/10 bg-[var(--background)] dark:border-white/15"
```

`body`가 `flex min-h-full flex-col`이고 `Providers`가 DOM 요소를 만들지 않으므로 `main`과 `nav`가 body의 flex 아이템이다. `mt-auto`가 남은 공간을 위로 밀어 `nav`를 하단에 놓는다. `sticky bottom-0`은 콘텐츠가 길어 스크롤이 생겼을 때를 위해 남긴다.

- [x] **Step 4: 통과 확인**

Run: `cd frontend && pnpm vitest run src/components/layout`
Expected: PASS. `BottomNav` 테스트가 13개(기존 12 + 1)여야 한다.

Run: `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:worker`
Expected: 전부 통과. 프론트 248 → 249개.

- [x] **Step 5: 실물에서 눈으로 본다**

로컬 프론트를 띄우고 홈·`/brews`·`/more`에서 탭바가 화면 맨 아래에 있는지 본다. **이 확인이 이 태스크의 진짜 인수 조건이다** — 클래스 검사는 회귀 방지용이지 위치를 보장하지 않는다.

- [x] **Step 6: 커밋** — `fix(web): 짧은 화면에서도 탭바를 하단에 붙인다 (AC-WEBSHELL-32)`

---

## Task 2: 음료 중량이 없을 때 그 사실을 말한다

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/extraction/domain/ExtractionAnalyzer.java`
- Test: `backend/src/test/java/com/kaldinote/extraction/domain/ExtractionAnalyzerTest.java`

**Covers:** AC-EXT-06

**Interfaces:**
- Consumes: `BrewMeasurement.tdsPercent()`, `BrewMeasurement.beverageWeightG()` (기존)
- Produces: 없음 — `ExtractionAnalysis.diagnosis()`의 값만 달라진다

- [x] **Step 1: 실패하는 테스트 작성**

`ExtractionAnalyzerTest`의 **기존** `AC-EXT-06` 테스트에 문구 단언을 더한다. 새 테스트를 만들지 않는다 — 같은 AC를 두 곳에서 검증하면 커버리지 스크립트가 어느 쪽이 진짜인지 말해주지 못한다.

```java
    @Test
    @DisplayName("AC-EXT-06 · 음료 중량이 없으면 수율을 계산하지 않는다")
    void 음료_중량이_없으면_수율을_계산하지_않는다() {
      // 기존 given/when 유지
      assertThat(analysis.extractionYieldPercent()).isNull();
      assertThat(analysis.diagnosis())
          .isEqualTo("음료 중량이 없어 추출 수율을 계산할 수 없습니다. 추출 후 잔의 무게를 재어 입력하세요.");
    }
```

기존 given이 스펙과 같은지 확인한다 — 원두 `15`g, 물 `250`g, 음료 중량 null, TDS `1.25`.

- [x] **Step 2: 실패 확인**

Run: `cd backend && ./gradlew test --tests '*ExtractionAnalyzerTest'`
Expected: FAIL — 지금은 `TDS 측정값이 없어…`가 나온다. **AC-EXT-05는 그대로 통과해야 한다**(그쪽은 TDS가 진짜 없다).

- [x] **Step 3: 최소 구현**

`ExtractionAnalyzer.java`에 문구를 더하고 판정을 나눈다:

```java
  private static final String NO_BEVERAGE_WEIGHT =
      "음료 중량이 없어 추출 수율을 계산할 수 없습니다. 추출 후 잔의 무게를 재어 입력하세요.";
```

```java
    if (!m.yieldMeasurable()) {
      // 없는 것을 정확히 말한다. TDS가 있는데 "TDS가 없다"고 하면 사용자가 고칠 곳을 못 찾는다.
      String reason = m.tdsPercent() == null ? NO_TDS : NO_BEVERAGE_WEIGHT;
      return new ExtractionAnalysis(brewRatio, null, null, null, reason);
    }
```

둘 다 없으면 `NO_TDS`가 나간다 — TDS가 더 근본적인 누락이고, 리프랙토미터가 없는 것이 기본 상황이라는 스펙 전제와 맞다.

- [x] **Step 4: 통과 확인**

Run: `cd backend && ./gradlew test --tests '*ExtractionAnalyzerTest'`
Expected: PASS. **AC-EXT-05도 함께 초록이어야 한다.**

Run: `cd backend && ./gradlew clean check`
Expected: BUILD SUCCESSFUL, 462개.

- [x] **Step 5: 브루로그 응답에도 반영되는지 확인**

Run: `cd backend && ./gradlew test --tests '*BrewLog*'`
Expected: PASS. 로그 응답이 이 문구를 그대로 실어 나르므로, 문구를 문자열로 고정한 테스트가 있으면 여기서 깨진다. 깨지면 그 테스트도 새 문구로 맞춘다.

- [x] **Step 6: 커밋** — `fix(api): 음료 중량 누락을 TDS 누락과 구분해 안내한다 (AC-EXT-06)`

---

## 완료 기준

- [x] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 — 249개(248→249)
- [x] `cd frontend && pnpm test:worker` 통과 (6개)
- [x] `cd backend && ./gradlew clean check` 통과 (462개, 실패 0)
- [x] `./scripts/check-spec-coverage.sh` 통과 — 스펙 14건, AC 453개
- [x] 실물에서 탭바가 하단에 붙는 것을 확인 — `/`·`/brews`·`/more` 모두 y=767 + 높이 45 = 812(뷰포트 하단). 수정 전 y=276·276·283
- [x] 실물에서 TDS만 있는 로그가 음료 중량을 요구하는 문구를 내는 것을 확인 — 로그 3(TDS 1.40, 음료 중량 없음)

---

## 자체 검토 결과

**AC 커버리지:** 정정·추가된 AC 2개가 모두 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** 두 태스크는 서로의 산출물을 쓰지 않는다. 프론트는 className만, 백엔드는 문자열 상수만 바뀐다.

**검증되지 않은 가정:**

1. **`BottomNav.test.tsx`가 `pathname`을 모듈 변수로 주입하는지.** 기존 테스트가 그 방식이면 그대로 따른다. Task 1 Step 1에서 그 파일을 열어 확인한다.
2. **`mt-auto`가 실제로 탭바를 하단으로 보내는지.** `body`의 flex 컨텍스트와 `Providers`가 DOM 요소를 만들지 않는다는 것은 확인했으나, 실제 렌더는 Step 5에서 눈으로 본다.
3. **브루로그 응답 테스트가 진단 문구를 문자열로 고정하고 있는지.** 고정돼 있으면 Task 2 Step 5에서 깨진다. 그때 새 문구로 맞춘다.
4. **`ExtractionAnalyzerTest`의 기존 AC-EXT-06 given이 스펙과 같은지.** 다르면 스펙 쪽(원두 15g·물 250g·TDS 1.25)에 맞춘다.

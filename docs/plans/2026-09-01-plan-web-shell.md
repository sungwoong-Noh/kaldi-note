# 앱 셸 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-01-web-shell.md`

**Goal:** 로그인한 뒤 앱 안을 돌아다닐 수 있고, 나갈 수 있고, 시드 레시피에서 막히지 않고, TDS를 넣을 수 있고, 그라인더끼리 분쇄도를 환산할 수 있다.

**Architecture:** 탭바는 `app/layout.tsx`에 한 번만 놓고 **경로를 보고 스스로 숨는다** — 페이지마다 넣으면 새 화면을 만들 때마다 빠뜨린다. 백엔드는 그라인더 시드 한 행뿐이라 Task 1에서 끝내고 나머지는 전부 프론트다. 환산기는 기존 `useGrindPreview`가 아니라 **두 그라인더를 직접 고르는** 별도 호출을 쓴다(미리보기는 source와 target이 같은 특수 케이스였다).

**작업 위치:** `backend/`(Task 1) → `frontend/`(Task 2~8)

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-WEBSHELL-01 | 탭 넷이 순서대로 | Task 2 | 컴포넌트 테스트 |
| AC-WEBSHELL-02 | 각 탭의 href | Task 2 | 컴포넌트 테스트 |
| AC-WEBSHELL-03 | 로그 상세에서 기록 탭 활성 | Task 2 | 컴포넌트 테스트 |
| AC-WEBSHELL-04 | 편집에서 레시피 탭 활성 | Task 2 | 컴포넌트 테스트 |
| AC-WEBSHELL-05 | 홈은 정확히 일치할 때만 | Task 2 | 컴포넌트 테스트 |
| AC-WEBSHELL-06 | 로그인 화면엔 탭바 없음 | Task 2 | 컴포넌트 테스트 |
| AC-WEBSHELL-07 | 작성 화면엔 탭바 없음 | Task 2 | 컴포넌트 테스트 |
| AC-WEBSHELL-08 | 내 정보 표시 | Task 3 | 페이지 테스트 |
| AC-WEBSHELL-09 | 이메일 없으면 줄 없음 | Task 3 | 페이지 테스트 |
| AC-WEBSHELL-10 | 로그아웃 1회 + 홈 이동 | Task 3 | 페이지 테스트 |
| AC-WEBSHELL-11 | 500이어도 홈 이동 | Task 3 | 페이지 테스트 |
| AC-WEBSHELL-12 | 환산기 링크 | Task 3 | 페이지 테스트 |
| AC-WEBSHELL-13 | 레시피 작성 취소 | Task 4 | 페이지 테스트 |
| AC-WEBSHELL-14 | 레시피 편집 취소 | Task 4 | 페이지 테스트 |
| AC-WEBSHELL-15 | 로그 작성 취소 | Task 4 | 페이지 테스트 |
| AC-WEBSHELL-16 | 내 레시피엔 기록 버튼 | Task 5 | 페이지 테스트 |
| AC-WEBSHELL-17 | 남의 레시피엔 안내 | Task 5 | 페이지 테스트 |
| AC-WEBSHELL-18 | 세 입력칸이 빈 채로 | Task 6 | 페이지 테스트 |
| AC-WEBSHELL-19 | 채운 값이 본문에 | Task 6 | 페이지 테스트 |
| AC-WEBSHELL-20 | TDS 오류가 입력칸에 | Task 6 | 페이지 테스트 |
| AC-WEBSHELL-21 | 카드에 비율·온도·시간 | Task 7 | 페이지 테스트 |
| AC-WEBSHELL-22 | 시간 없으면 자리 없음 | Task 7 | 페이지 테스트 |
| AC-WEBSHELL-23 | 마스터 목록 전체 | Task 8 | 페이지 테스트 |
| AC-WEBSHELL-24 | 환산 결과 표시 | Task 8 | 페이지 테스트 |
| AC-WEBSHELL-25 | 요청 본문 | Task 8 | 페이지 테스트 |
| AC-WEBSHELL-26 | 최소 단계도 요청은 나간다 | Task 8 | 페이지 테스트 |
| AC-WEBSHELL-27 | E80 30스텝 = 675µm | Task 1 | 단위 테스트 |
| AC-WEBSHELL-28 | 422 문구 노출 | Task 8 | 페이지 테스트 |
| AC-WEBSHELL-29 | 400 문구 노출 | Task 8 | 페이지 테스트 |
| AC-WEBSHELL-30 | E80이 목록에 있다 | Task 1 | 통합 테스트 |
| AC-WEBSHELL-31 | E80 25스텝 = 563µm (반올림) | Task 1 | 단위 테스트 |

**스펙의 AC 31개 중 31개가 매핑됐다.**

---

## Global Constraints

- **Task 1(백엔드)을 먼저 끝낸다.** Task 8의 환산기가 E80을 픽스처로 쓴다.
- **적용된 Flyway 파일을 수정하지 않는다.** 새 `V11`을 추가한다(`backend/CLAUDE.md`).
- **`any` 금지, `as` 단언 금지.** 응답 타입은 Zod 스키마에서 `z.infer`로 뽑는다.
- **API는 MSW로 모킹한다.** 픽스처는 실행 중인 백엔드에서 뜬다 — 이번에 새로 필요한 것은 **E80을 포함한 그라인더 목록**과 **C40→E80 환산 응답** 둘이다.
- **탭바는 `app/layout.tsx`에 한 번만 놓는다.** 페이지마다 넣으면 새 화면에서 빠뜨린다.
- **`aria-current="page"`로 활성 탭을 표시한다.** 색만으로 구분하면 테스트가 잡을 수 없고 스크린리더도 모른다.
- **AC ID를 소스 주석에 적지 않는다.** `check-spec-coverage.sh`가 `frontend/src` 전체를 grep하므로 주석에 ID만 있어도 통과해 버린다(2026-08-30에 실제로 겪었다).
- 커밋 전 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. **라우팅을 건드리므로 `pnpm test:worker`도 반드시 돌린다**(2026-09-01에 홈 교체가 `AC-WEBDEPLOY-06`을 깼고 jsdom 스위트는 전부 초록이었다).

---

## File Structure

```
backend/src/main/resources/db/migration/
└── V11__seed_holzklotz_e80.sql              Create

backend/src/test/java/com/kaldinote/
├── grind/domain/GrindConverterTest.java      Modify — AC 27
└── gear/presentation/GrinderControllerTest.java  Modify — AC 30

frontend/src/
├── app/
│   ├── layout.tsx                            Modify — BottomNav 배치
│   ├── more/page.tsx  page.test.tsx          Create — AC 08~12
│   ├── gear/grind-converter/
│   │   └── page.tsx  page.test.tsx           Create — AC 23~26·28·29
│   ├── recipes/new/page.test.tsx             Modify — AC 13
│   ├── recipes/[id]/edit/page.test.tsx       Modify — AC 14
│   ├── recipes/[id]/page.test.tsx            Modify — AC 16·17
│   ├── brews/new/page.test.tsx               Modify — AC 15·18~20
│   └── brews/page.test.tsx                   Modify — AC 21·22
│
├── components/layout/
│   ├── BottomNav.tsx                         Create — AC 01~07
│   └── BottomNav.test.tsx                    Create
│
├── features/
│   ├── gear/
│   │   ├── api.ts                            Modify — convertGrind
│   │   └── components/GrindConverter.tsx     Create
│   ├── recipe/components/
│   │   ├── RecipeForm.tsx                    Modify — 취소
│   │   ├── RecipeEditor.tsx                  Modify — 취소
│   │   └── RecipeDetail.tsx                  Modify — 포크 유도
│   └── brewlog/components/
│       ├── BrewLogForm.tsx                   Modify — 취소 + 입력칸 3개
│       └── BrewLogCard.tsx                   Modify — 둘째 줄
│
└── test/fixtures.ts                          Modify — E80, 환산 응답
```

---

## Task 1: 그라인더 시드 — Holzklotz E80

**Files:**
- Create: `backend/src/main/resources/db/migration/V11__seed_holzklotz_e80.sql`
- Test: `GrindConverterTest.java`, `GrinderControllerTest.java`

**Covers:** AC-WEBSHELL-27, 30, 31

**Interfaces:**
- Produces: `grinder_models`에 `Holzklotz E80` 한 행 — 프론트 Task 8이 픽스처로 쓴다

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("AC-WEBSHELL-27 · E80 30스텝은 675마이크론이다")
void E80_30스텝은_675마이크론이다() {
    BigDecimal micron = converter.toMicron(e80Spec(), new BigDecimal("30"));

    assertThat(micron).isEqualByComparingTo("675");
}

@Test
@DisplayName("AC-WEBSHELL-31 · 반올림이 필요한 스텝도 표와 맞는다")
void E80_25스텝은_563마이크론이다() {
    // 25 × 22.50 = 562.5 → HALF_UP
    BigDecimal micron = converter.toMicron(e80Spec(), new BigDecimal("25"));

    assertThat(micron).isEqualByComparingTo("563");
}
```

`e80Spec()`은 `micronsPerClick=22.50`, `zeroPointOffsetClicks=0`, `min=0`, `max=80`인 `GrindSpec`을 만드는 헬퍼다.

`GrinderControllerTest`에는 목록 응답에 E80이 있고 `micronsPerClick`이 `22.50`, `maxSetting`이 `80`인지 보는 테스트를 더한다(AC-WEBSHELL-30).

- [ ] **Step 2: 실패 확인** — Run: `./gradlew test --tests '*GrindConverterTest'` / Expected: FAIL — 목록에 E80이 없어 시드가 필요하다

**`GrindSpec`의 생성자 시그니처를 먼저 확인하고 `e80Spec()`을 거기 맞춘다.**

- [ ] **Step 3: 최소 구현**

```sql
-- V11__seed_holzklotz_e80.sql
INSERT INTO grinder_models
    (brand, name, adjustment_type, microns_per_click, zero_point_offset_clicks,
     min_setting, max_setting, burr_type, is_system) VALUES
    ('Holzklotz', 'E80', 'CLICK', 22.50, 0, 0, 80, 'CONICAL', true);
```

- [ ] **Step 4: 통과 확인** — Run: `./gradlew clean check` / Expected: PASS
- [ ] **Step 5: 커밋** — `feat(gear): Holzklotz E80 그라인더 시드 (AC-WEBSHELL 3개)`

---

## Task 2: 하단 탭바

**Files:** Create `components/layout/BottomNav.tsx` + 테스트, Modify `app/layout.tsx`
**Covers:** AC-WEBSHELL-01~07

**Interfaces:**
- Produces: `<BottomNav />` — 인자 없음. `usePathname()`으로 현재 경로를 읽어 스스로 숨는다

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// BottomNav.test.tsx
let pathname = "/recipes";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

it("AC-WEBSHELL-03 · 로그 상세에서도 기록 탭이 켜진다", () => {
  pathname = "/brews/42";

  render(<BottomNav />);

  expect(screen.getByRole("link", { name: "기록" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "홈" })).not.toHaveAttribute("aria-current");
});

it("AC-WEBSHELL-07 · 작성 화면에는 탭바가 없다", () => {
  pathname = "/brews/new";

  render(<BottomNav />);

  expect(screen.queryByRole("link", { name: "기록" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL(모듈 없음)

- [ ] **Step 3: 최소 구현** — 숨길 경로는 **접두사 목록**으로 판정한다: `/login`, `/auth`, `/recipes/new`, `/brews/new`, 그리고 `/edit`로 끝나는 경로. 활성 판정은 홈만 완전 일치, 나머지는 접두사.

- [ ] **Step 4: 통과 확인** — Expected: PASS, 7 tests
- [ ] **Step 5: 커밋** — `feat(web): 하단 탭바 (AC-WEBSHELL 7개)`

---

## Task 3: 더보기 화면

**Files:** Create `app/more/page.tsx` + 테스트
**Covers:** AC-WEBSHELL-08~12

**Interfaces:** Consumes `useMe`(기존)

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it("AC-WEBSHELL-11 · 로그아웃 요청이 실패해도 홈으로 간다", async () => {
  const user = userEvent.setup();
  server.use(http.post("/api/auth/logout", () => new HttpResponse(null, { status: 500 })));

  renderWithQuery(<MorePage />);
  await user.click(await screen.findByRole("button", { name: "로그아웃" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
});
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL(모듈 없음)
- [ ] **Step 3: 최소 구현** — `/api/auth/logout`은 **Next 라우트 핸들러**라 상대 경로로 부른다(백엔드가 아니다). 실패해도 `clearSession()` 후 이동한다.
- [ ] **Step 4: 통과 확인** — Expected: PASS, 5 tests
- [ ] **Step 5: 커밋** — `feat(web): 더보기 화면과 로그아웃 (AC-WEBSHELL 5개)`

---

## Task 4: 작성 화면의 취소

**Files:** Modify `RecipeForm.tsx`, `RecipeEditor.tsx`, `BrewLogForm.tsx` + 각 페이지 테스트
**Covers:** AC-WEBSHELL-13, 14, 15

- [ ] **Step 1: 실패하는 테스트 작성** — 세 화면에서 `취소`를 누르면 각각 `/recipes`·`/recipes/12`·`/recipes/1`로 `push`되는지.
- [ ] **Step 2: 실패 확인** — Expected: FAIL(`취소` 버튼 없음)
- [ ] **Step 3: 최소 구현** — 목적지는 **부모가 prop으로 준다**. 폼이 라우팅을 알면 재사용이 막힌다.
- [ ] **Step 4: 통과 확인** — Expected: PASS, 3 tests
- [ ] **Step 5: 커밋** — `feat(web): 작성 화면의 취소 버튼 (AC-WEBSHELL 3개)`

---

## Task 5: 포크 유도

**Files:** Modify `features/recipe/components/RecipeDetail.tsx` + 페이지 테스트
**Covers:** AC-WEBSHELL-16, 17

- [ ] **Step 1: 실패하는 테스트 작성** — `CURATED` 레시피에서 `이 레시피로 내렸다` 링크가 없고 `포크한 뒤 기록할 수 있습니다`가 보이는지.
- [ ] **Step 2: 실패 확인** — Expected: FAIL(지금은 소유와 무관하게 링크가 있다)
- [ ] **Step 3: 최소 구현** — 판정은 **기존 `isMine`을 그대로 쓴다**(`me.data !== undefined && recipe.ownerUserId === me.data.id`). 편집·삭제 버튼이 이미 그 값으로 갈린다.
- [ ] **Step 4: 통과 확인** — Expected: PASS, 2 tests
- [ ] **Step 5: 커밋** — `fix(web): 내 레시피에서만 기록을 시작한다 (AC-WEBSHELL 2개)`

---

## Task 6: 브루잉 로그의 빠진 입력칸

**Files:** Modify `features/brewlog/components/BrewLogForm.tsx` + 페이지 테스트
**Covers:** AC-WEBSHELL-18, 19, 20

**Interfaces:** Consumes `BrewLogFormState`(이미 세 필드를 갖고 있다), `toRequestBody`(이미 세 필드를 담는다)

- [ ] **Step 1: 실패하는 테스트 작성** — 세 입력칸이 존재하고, 채우면 본문에 실리고, `tdsPercent` 오류가 그 칸에 붙는지.
- [ ] **Step 2: 실패 확인** — Expected: FAIL(입력칸 없음)
- [ ] **Step 3: 최소 구현** — **상태와 변환 함수는 이미 다 있다.** `NumberField` 세 줄과 `tdsPercent`용 `aria-describedby`만 더하면 된다.
- [ ] **Step 4: 통과 확인** — Expected: PASS, 3 tests
- [ ] **Step 5: 커밋** — `fix(web): 드로다운·음료 중량·TDS 입력칸 (AC-WEBSHELL 3개)`

---

## Task 7: 로그 목록 카드 보강

**Files:** Modify `features/brewlog/components/BrewLogCard.tsx` + 페이지 테스트
**Covers:** AC-WEBSHELL-21, 22

- [ ] **Step 1: 실패하는 테스트 작성** — 카드에 `1:15.0`·`92°C`·`3:30`이 있고, `actualTotalTimeSeconds`가 없는 항목엔 시간 표기가 없는지.
- [ ] **Step 2: 실패 확인** — Expected: FAIL(지금은 날짜와 수율만)
- [ ] **Step 3: 최소 구현** — `formatRatio`·`formatTemperature`·`formatDuration`을 그대로 쓴다. 값이 `undefined`인 항목은 배열에서 빼고 ` · `로 잇는다.
- [ ] **Step 4: 통과 확인** — Expected: PASS, 2 tests
- [ ] **Step 5: 커밋** — `feat(web): 로그 카드에 추출 파라미터 (AC-WEBSHELL 2개)`

---

## Task 8: 분쇄도 환산기

**Files:** Create `app/gear/grind-converter/page.tsx` + 테스트, `features/gear/components/GrindConverter.tsx`, Modify `features/gear/api.ts`
**Covers:** AC-WEBSHELL-23, 24, 25, 26, 28, 29

**Interfaces:**
- Consumes: `useGrinders`(기존), Task 1의 E80 시드
- Produces: `convertGrind(body, onSessionLost)` — `{ sourceGrinderModelId, sourceSetting, targetGrinderModelId }`를 받아 `GrindConversion`을 돌려준다

- [ ] **Step 1: 픽스처를 실제 백엔드에서 뜬다**

```bash
docker compose up -d
(cd backend && SPRING_PROFILES_ACTIVE=local ./gradlew bootRun) &
curl -s -H "Authorization: Bearer $TOKEN" localhost:8080/api/v1/gear/grinders | jq '.[] | select(.name=="E80")'
curl -s -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -X POST localhost:8080/api/v1/gear/grind-conversions \
  -d '{"sourceGrinderModelId":1,"sourceSetting":22,"targetGrinderModelId":<E80 id>}' | jq
```

**E80의 id는 시드 순서에 따라 정해진다 — 하드코딩하지 말고 응답에서 확인한다.**

- [ ] **Step 2: 실패하는 테스트 작성**

```tsx
it("AC-WEBSHELL-25 · 요청 본문이 고른 값 그대로다", async () => {
  const user = userEvent.setup();
  let body: unknown = null;
  server.use(
    http.get(`${BASE}/gear/grinders`, () => HttpResponse.json([comandanteC40, holzklotzE80])),
    http.post(`${BASE}/gear/grind-conversions`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(c40ToE80Conversion);
    }),
  );

  renderWithQuery(<GrindConverterPage />);
  await user.selectOptions(await screen.findByLabelText("원본 그라인더"), "1");
  await user.type(screen.getByLabelText("설정값"), "22");
  await user.selectOptions(screen.getByLabelText("대상 그라인더"), "11");
  await user.click(screen.getByRole("button", { name: "환산" }));

  await waitFor(() =>
    expect(body).toEqual({ sourceGrinderModelId: 1, sourceSetting: 22, targetGrinderModelId: 11 }),
  );
});
```

- [ ] **Step 3: 실패 확인** — Expected: FAIL(모듈 없음)
- [ ] **Step 4: 최소 구현** — `useMutation`으로 부른다(`useGrindPreview`의 자동 조회와 달리 버튼을 눌러야 나간다). **경고 문구는 서버가 준 `warning`을 그대로 렌더한다** — 프론트가 다시 쓰지 않는다.
- [ ] **Step 5: 통과 확인** — Expected: PASS, 6 tests
- [ ] **Step 6: 커밋** — `feat(web): 분쇄도 환산기 화면 (AC-WEBSHELL 6개)`

---

## 완료 기준

- [ ] `cd backend && ./gradlew clean check` 통과
- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과
- [ ] `cd frontend && pnpm test:worker` 통과 (6개)
- [ ] `./scripts/check-spec-coverage.sh` 통과
- [ ] 스펙의 `status`를 `구현완료`로 변경
- [ ] 스펙 「수동 확인」 4개 완료

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 31개 중 31개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** `convertGrind`(Task 8)가 기존 `grindConversionSchema`를 재사용한다. Task 6이 쓰는 `BrewLogFormState`의 세 필드와 `toRequestBody`의 처리는 `WEBBREW` 슬라이스에서 이미 만들어져 있다 — 화면만 없었다.

**검증되지 않은 가정:**

1. **`GrindSpec`의 생성자 시그니처.** Task 1의 테스트가 쓰는 `e80Spec()` 헬퍼를 만들 때 실제 시그니처에 맞춘다 — Task 1 Step 2에서 즉시 드러난다.
2. ~~**`zero_point_offset_clicks`에 음수가 들어가는지.**~~ **해소:** 제조사 대응표(「변경 후」)가 원점을 지나는 정비례라 오프셋이 `0`이다. 음수를 넣을 일이 없어졌다.
3. **E80의 그라인더 모델 id.** 시드 순서상 `11`일 것으로 보이나 확정하지 않았다. Task 8 Step 1의 픽스처 뜨기에서 확인한다.
4. **`app/layout.tsx`에 클라이언트 컴포넌트를 넣어도 되는지.** 루트 레이아웃은 서버 컴포넌트인데 `BottomNav`는 `usePathname`을 쓰므로 `"use client"`가 붙는다. 서버 레이아웃이 클라이언트 자식을 갖는 것은 정상이지만 이 프로젝트에서 처음이다 — Task 2에서 드러난다.
5. **로그아웃 후 `/`로 갔을 때의 리다이렉트 연쇄.** `/`는 인증이 필요해 `useRequireSession`이 `/login?next=%2F`로 다시 보낸다. 테스트에서 `push("/")`까지만 검증하므로 그 뒤 동작은 확인하지 않는다. 실물에서 깜빡임이 심하면 목적지를 재고한다.
6. **`pnpm test:worker`의 스모크 대상.** 탭바가 모든 화면에 붙으면 `/`·`/login` 응답 본문이 바뀐다. `AC-WEBDEPLOY` 테스트가 상태 코드와 `content-type`만 보므로 영향 없을 것으로 보이나, Task 2 이후 반드시 돌려 확인한다.

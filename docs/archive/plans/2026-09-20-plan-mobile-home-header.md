# 모바일 홈 로고 헤더 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-19-home-calendar.md` (AC-HOMECAL-80~83, 「정상 동작 — 반응형 헤더」)

**Goal:** `1100px` 미만(모바일 + 1컬럼 웹)에서도 홈 화면 상단에 로고 심볼 + `kaldi·note` 워드마크가 보인다. 네비게이션·CTA·아바타는 하단 탭바와 중복이라 넣지 않는다. `1100px` 이상의 기존 전체 헤더는 그대로 유지된다.

**Architecture:** 새 컴포넌트를 만들지 않고 `WebTopBar.tsx`를 확장한다. `<header>`를 항상 렌더링하고, 로고+워드마크는 항상 보이며, 네비·CTA·아바타 묶음만 `hidden min-[1100px]:flex`로 좁힌다. `1100px`은 `TWO_COLUMN_BREAKPOINT_PX`가 이미 쓰는 값과 같은 지점이라 새 리터럴이 아니다.

**작업 위치:** `frontend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-HOMECAL-80 | 1100px 미만에서도 로고 헤더가 보인다 | Task 1 | e2e |
| AC-HOMECAL-81 | 그 헤더에는 네비게이션 링크가 없다 | Task 1 | e2e |
| AC-HOMECAL-82 | 그 헤더에는 CTA와 아바타가 없다 | Task 1 | e2e |
| AC-HOMECAL-83 | 1100px 이상에서는 기존 전체 헤더가 그대로 보인다(회귀) | Task 1 | e2e (기존 AC-HOMECAL-58 테스트에 태그 추가) |

## Global Constraints

- 새 브레이크포인트 리터럴을 만들지 않는다 — 기존 `1100px`의 반대편을 채운다.
- 하단 탭바(`BottomNav`)와 기능이 중복되는 요소(네비·아바타)는 넣지 않는다.
- `AC-TOUCH-01`(360px 뷰포트 `/`의 모든 탭 영역 ≥44×44)이 이 로고 링크의 탭 크기를 자동으로 검증한다 — 별도 AC를 만들지 않되, 통과를 확인한다.

## File Structure

```
frontend/src/components/layout/WebTopBar.tsx   (수정) header 항상 렌더 + 반응형 분기
frontend/e2e/home-calendar.spec.ts             (수정) AC-HOMECAL-80·81·82 추가
frontend/e2e/home-calendar-web.spec.ts         (수정) AC-HOMECAL-58 테스트에 AC-HOMECAL-83 태그 추가
```

---

## Task 1: WebTopBar를 반응형으로 확장

**Files:**
- Modify: `frontend/src/components/layout/WebTopBar.tsx`
- Test: `frontend/e2e/home-calendar.spec.ts`, `frontend/e2e/home-calendar-web.spec.ts`

**Covers:** AC-HOMECAL-80, AC-HOMECAL-81, AC-HOMECAL-82, AC-HOMECAL-83

- [x] **Step 1: 실패하는 테스트 작성**

`home-calendar.spec.ts`에 추가(기본 뷰포트가 이미 `360px`, `<1100px`):

```ts
test.describe("홈 달력 — 모바일 헤더", () => {
  test("AC-HOMECAL-80 · 1100px 미만에서도 로고 헤더가 보인다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/");

    const header = page.locator("header");
    await expect(header.locator("svg")).toBeVisible();
    await expect(header.getByText("kaldi")).toBeVisible();
  });

  test("AC-HOMECAL-81 · 그 헤더에는 네비게이션 링크가 없다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/");

    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "홈" })).toBeHidden();
    await expect(header.getByRole("link", { name: "레시피" })).toBeHidden();
    await expect(
      header.getByRole("link", { name: "기록", exact: true }),
    ).toBeHidden();
  });

  test("AC-HOMECAL-82 · 그 헤더에는 CTA와 아바타가 없다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/");

    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "기록하기" })).toBeHidden();
    await expect(header.getByRole("link", { name: "더보기" })).toBeHidden();
  });
});
```

`home-calendar-web.spec.ts`의 기존 테스트 제목에 AC-83 추가:

```ts
test("AC-HOMECAL-58 · AC-HOMECAL-83 · 상단 바에 6개 요소가 있다", async ({ page }) => {
  // 기존 본문 그대로 — 1440px에서 6개 요소가 전부 보이는 것이 AC-83의 회귀 확인이다.
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm e2e -- home-calendar`
Expected: FAIL — AC-80·81·82는 `header` 자체가 없어 `svg`를 못 찾고, AC-83은 제목 변경만이라 기존 로직대로 통과(회귀 없음 확인용이지 실패 유발용이 아니다).

- [x] **Step 3: 최소 구현**

`WebTopBar.tsx`의 `<header>`를 항상 렌더링하도록 바꾸고, 네비·CTA·아바타를 하나의 `hidden min-[1100px]:flex` 컨테이너로 감싼다:

```tsx
export function WebTopBar({ me }: { me: Me }) {
  return (
    <header className="flex items-center justify-between gap-6 border-b border-border bg-paper px-6 py-3">
      <Link href="/" className="flex min-h-11 items-center gap-2">
        <LogoSymbol />
        <span className="text-card-title font-semibold tracking-[-0.03em]">
          kaldi<span className="text-accent-soft">·</span>note
        </span>
      </Link>
      <div className="hidden min-[1100px]:flex items-center gap-6">
        <nav className="flex items-center gap-4 text-body">
          <Link href="/">홈</Link>
          <Link href="/recipes">레시피</Link>
          <Link href="/brews">기록</Link>
        </nav>
        <div className="flex items-center gap-4">
          <ButtonLink href="/recipes" variant="primary">
            기록하기
          </ButtonLink>
          <Link href="/more" aria-label="더보기">
            <Avatar nickname={me.nickname} profileImageUrl={me.profileImageUrl} size={36} />
          </Link>
        </div>
      </div>
    </header>
  );
}
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm e2e -- home-calendar` 그리고 `pnpm e2e -- touch-targets`(로고 링크가 44px 이상인지 회귀 확인)
Expected: PASS 전부

- [x] **Step 5: 커밋**

```bash
git add src/components/layout/WebTopBar.tsx e2e/home-calendar.spec.ts e2e/home-calendar-web.spec.ts
git commit -m "feat(web): 1100px 미만에서도 홈에 로고 헤더를 보여준다 (AC-HOMECAL-80~83)"
```

---

## 완료 기준

- [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` 전부 통과
- [x] `pnpm e2e` 전체 통과 (터치 타깃 회귀 포함)
- [x] `(cd .. && ./scripts/check-spec-coverage.sh)` 통과
- [x] 수동 확인 항목 추가 없음(전부 자동화됨)

---

## 자체 검토 결과

**AC 커버리지:** AC 4개(80~83) 전부 Task 1에 매핑됨.

**자리표시자 검사:** 없음.

**타입 일관성:** `WebTopBar`의 props 시그니처(`{ me: Me }`)는 바뀌지 않는다 — `page.tsx`의 호출부 수정이 필요 없다.

**검증되지 않은 가정:**
- 로고 `Link`가 `min-h-11`만으로 실제로 44px 높이가 나오는지는 `AC-TOUCH-01` 스윕(360px 뷰포트)이 그대로 검증한다 — 부족하면 그 테스트가 실패로 드러난다.

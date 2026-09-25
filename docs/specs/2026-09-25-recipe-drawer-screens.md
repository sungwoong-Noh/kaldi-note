---
id: RECIPESBREWS
title: 레시피 서랍 화면 — 웹·모바일 둘러보기/내 서랍/상세/내 잔
status: 초안
milestone: M1
supersedes:
---

# 레시피 서랍 화면 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**
>
> `docs/design/kaldi-note-design/docs/RECIPES-AND-BREWS.md`·`DECISIONS.md`가 정한 레시피/잔
> 재설계를 4개 스펙으로 나눈 것 중 **2~4번째(화면)**를 하나로 묶는다 — 이슈 #137(웹
> 둘러보기·내 서랍)·#138(웹 상세·담기·내 잔)·#139(모바일 전체). 1번째(API,
> `docs/specs/2026-09-21-recipes-and-brews-search-api.md`)는 구현완료다. 같은
> `RECIPESBREWS` AC 접두어를 이어 쓴다(현재 최댓값 AC-54, 이 스펙은 55부터).

## 시나리오

로그인한 사용자가 웹·모바일의 「레시피」 탭에서 **내 서랍**(내가 만든 것 + 담아온 것,
기본값)과 **둘러보기**(검색·필터로 공개 레시피 전체를 찾는 곳) 세그먼트를 오간다. 둘러보기
상세에서 남의 레시피를 「내 서랍에 담기」(바디 없는 즉시 복제)하거나 「바로 내리기」로 한
번만 쓴다. 「내 잔」 탭에서는 통계 4칸(웹)/2칸(모바일)과 날짜순 목록(웹은 테이블, 모바일은
2줄 원장 행)을 본다.

### 범위 밖 (Non-goals)

- RM5(담기 직후 편집 화면). 「레시피 작성·편집」 M2 이슈로 이미 옮겨졌다.
- 레시피 작성·편집 화면(`/recipes/new`·`/recipes/[id]/edit`) 자체의 변경.
- 기록 상세 2컬럼 레이아웃·비교표. 이 스펙의 BW1/BM1은 **내 잔 목록**만 다룬다 — 상세는 M2.
- 친구 피드, 프로필 화면의 레시피·잔 탭(M4).
- 검색 결과 하이라이트·자동완성.
- 원두·로스터 이름 검색(`Recipe`가 원두를 참조하지 않음 — API 스펙과 동일한 비목표).
- 내 서랍(scope=DRAWER)에 `q`·`temp`·`roast`·`doseMin`/`doseMax`·`dripper` 필터 UI를 두는 것
  — 내 서랍은 소유 필터(owner) pill만 쓴다.
- 필터·검색·정렬 조건의 공유 가능한 딥링크 설계(쿼리 동기화는 하되, 링크 공유 UX는 다루지
  않는다).
- 픽셀 단위 완전 정합(색·간격의 소수점 오차). 구조·데이터·동작만 AC로 못박고, 시각 대조는
  완료 조건의 mockup-checker 절차로 확인한다.

## 용어

| 용어 | 정의 |
|---|---|
| 내 서랍 | `scope=DRAWER`. 내가 만든 것 + 담아온 것 |
| 둘러보기 | `scope=PUBLIC`. 검색·필터 대상, 공개 레시피 전체 |
| 담기 | 바디 없는 `POST /recipes/{id}/fork` — 즉시 복제, 편집 화면을 거치지 않는다 |
| 바로 내리기 | 담지 않고 그 레시피 값으로 바로 `/brews/new`를 여는 것 |
| 스테이징 | 모바일 필터 바텀시트에서 "N개 결과 보기"를 누르기 전까지, 목록에는 반영되지 않고
  시트 안에서만 유지되는 임시 필터 값 |

## 데이터

스키마 변경 없음. `RecipeSummaryResponse`(목록 DTO)에 필드 3개를 추가한다 — DB 컬럼 추가는
없다(전부 기존 엔티티 컬럼·집계를 노출만 한다).

| 필드 | 타입 | Null | 설명 |
|---|---|---|---|
| `authorDisplayName` | string | 아니오 | CURATED는 `authorName`, USER는 소유자 닉네임. `ownerUserId`가 null(유기물)이면 `authorName` |
| `sourceAuthorName` | string | 예 | 포크본만 값 존재(엔티티 `sourceAuthorName` 컬럼을 그대로 노출) |
| `brewCount` | long | 아니오 | 그 레시피로 만든 잔 수. `savedCount`와 같은 배치 조회 패턴(N+1 방지) |

## 계약

| 메서드 | 경로 | 인증 | 계약 파일 |
|---|---|---|---|
| `GET` | `/api/v1/recipes` | O | `docs/contracts/2026-09-21-recipes-and-brews-search-api.json`(`RecipeSummary`에 필드 3개 추가) |
| `GET` | `/api/v1/brew-logs/stats` | O | 위와 동일 파일(변경 없음) |
| `POST` | `/api/v1/recipes/{id}/fork` | O | 위와 동일 파일(변경 없음, 바디 없이 호출) |

이 스펙의 Task 0이 계약 JSON의 `RecipeSummary` 스키마에 `authorDisplayName`·
`sourceAuthorName`·`brewCount`를 추가한다. `ContractComplianceTest`는 대상 스펙(원 API
스펙)이 이미 `구현완료`이므로 이 시점부터 즉시 강제된다.

---

## 인수 조건

### 기능

#### AC-RECIPESBREWS-55 · 목록 응답에 authorDisplayName이 포함된다

- **Given** CURATED 레시피 1건(`authorName: "James Hoffmann"`), USER 소유 PUBLIC 레시피 1건(소유자 닉네임 `"지연"`)
- **When** `GET /recipes?scope=PUBLIC`
- **Then** 전자는 `authorDisplayName: "James Hoffmann"`, 후자는 `authorDisplayName: "지연"`이다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-56 · 목록 응답에 sourceAuthorName이 포함된다

- **Given** B가 A의 레시피를 담은 포크본 1건
- **When** B가 `GET /recipes`(내 서랍)
- **Then** 그 항목의 `sourceAuthorName`이 A의 닉네임이다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-57 · 목록 응답에 brewCount가 포함된다

- **Given** 어떤 레시피로 만든 잔 3건
- **When** 그 레시피가 포함된 목록을 조회한다
- **Then** 그 항목의 `brewCount`가 `3`이다. 페이지 안 레시피 N개에 대해 추가 쿼리는 1회다(savedCount와 같은 배치 조회)
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-58 · /recipes가 세그먼트로 진입하고 기본은 내 서랍이다

- **Given** 로그인 사용자
- **When** `/recipes`로 진입한다(쿼리 없음)
- **Then** "내 서랍" 세그먼트가 활성 상태로 렌더되고 `GET /recipes?scope=DRAWER`가 호출된다
- **검증** 컴포넌트 테스트 `RecipesPage`

#### AC-RECIPESBREWS-59 · 둘러보기 검색어는 300ms 디바운스로 조회된다

- **Given** 둘러보기 세그먼트, 가짜 타이머(vi.useFakeTimers)
- **When** 검색 입력에 `"워시드"`를 타이핑한다
- **Then** 299ms 시점에는 `q` 파라미터를 포함한 요청이 0회이고, 300ms 시점에는 정확히 1회다
- **검증** 컴포넌트 테스트 `RecipesPage`

#### AC-RECIPESBREWS-60 · IME 조합 중에는 검색 요청이 나가지 않는다

- **Given** 둘러보기 세그먼트, 가짜 타이머
- **When** 한글 입력을 위한 `compositionstart` → 여러 번의 `input`(조합 중, `isComposing: true`) → `compositionend`가 순서대로 발생한다
- **Then** `compositionend` 이전까지는 요청이 0회다. `compositionend` 이후 299ms 시점에도 0회, 300ms 시점에 정확히 1회다
- **검증** 컴포넌트 테스트 `RecipesPage`

#### AC-RECIPESBREWS-61 · 온도·배전도·기구 필터가 즉시 반영된다

- **Given** 둘러보기 세그먼트(웹은 pill 줄, 모바일은 시트 안)
- **When** 온도 pill `HOT`, 배전도 pill `중배전`, 기구 pill `V60`을 각각 클릭한다
- **Then** 웹은 클릭 즉시 `temp=HOT&roast=MEDIUM&dripper=V60`으로 재조회된다(원두량은 AC-62가 다룬다). 모바일은 시트 안에서 값만 바뀌고(AC-82) 목록엔 아직 반영되지 않는다
- **검증** 컴포넌트 테스트 `RecipesPage`

#### AC-RECIPESBREWS-62 · 원두량 슬라이더는 조작을 마쳤을 때 한 번만 갱신된다

- **Given** 둘러보기 세그먼트, 원두량 슬라이더(10–30g)
- **When** (a) 마우스로 핸들을 드래그하다 `pointerup`한다, 또는 (b) 핸들에 포커스를 두고 화살표 키를 5번 연속 누른다
- **Then** (a)는 `pointerup` 시점에 `doseMin`/`doseMax`로 1회 조회된다. (b)는 마지막 키 입력 후 200ms 디바운스로 1회만 조회되고, 그 사이 5번의 요청은 나가지 않는다
- **검증** 컴포넌트 테스트 `RecipesPage`

#### AC-RECIPESBREWS-63 · 내 서랍 소유 필터 pill로 owner가 바뀐다

- **Given** 내 서랍 세그먼트
- **When** 소유 필터 pill `내가 만든`을 클릭한다
- **Then** `GET /recipes?scope=DRAWER&owner=MINE`으로 재조회된다
- **검증** 컴포넌트 테스트 `RecipesPage`

#### AC-RECIPESBREWS-64 · 정렬 토글로 sort가 바뀐다

- **Given** 둘러보기 세그먼트. 초기값은 `인기순`이고 이때는 `sort` 파라미터를 보내지 않는다(서버 기본 정렬 AC-RECIPESBREWS-11을 그대로 따른다 — CURATED 우선 + 담김 순)
- **When** 정렬 토글에서 `최신순`을 클릭한다
- **Then** `GET /recipes?scope=PUBLIC&sort=RECENT`로 재조회되고, 다시 `인기순`을 클릭하면 `sort` 파라미터 없이 재조회된다
- **검증** 컴포넌트 테스트 `RecipesPage`

#### AC-RECIPESBREWS-65 · 검색·필터·정렬·세그먼트·owner가 URL 쿼리로 동기화된다

- **Given** 둘러보기 세그먼트
- **When** 검색어 `"워시드"`, 온도 `HOT`, 정렬 `최신순`을 설정한다
- **Then** 브라우저 URL이 `/recipes?scope=PUBLIC&q=워시드&temp=HOT&sort=RECENT`가 된다(페이지 새로고침 없이 `router.replace`)
- **검증** 컴포넌트 테스트 `RecipesPage`

#### AC-RECIPESBREWS-66 · 상세로 이동했다가 뒤로가기하면 조건이 유지된다

- **Given** `/recipes?scope=PUBLIC&temp=HOT`에서 카드 하나를 클릭해 `/recipes/{id}`로 이동했다
- **When** 브라우저 뒤로가기를 누른다
- **Then** `/recipes?scope=PUBLIC&temp=HOT`로 돌아오고 온도 필터 `HOT`이 여전히 선택돼 있다
- **검증** e2e

#### AC-RECIPESBREWS-67 · "더 보기"로 불러온 페이지 depth는 URL에 반영되지 않는다

- **Given** 목록 첫 페이지가 로드된 상태
- **When** "더 보기"를 2번 눌러 3페이지를 불러온다
- **Then** URL 쿼리에 `page` 파라미터가 나타나지 않는다(내부 `useInfiniteQuery` 캐시에만 누적)
- **검증** 컴포넌트 테스트 `RecipesPage`

#### AC-RECIPESBREWS-68 · 검색·필터·정렬이 바뀌면 목록을 처음부터 다시 불러온다

- **Given** "더 보기"로 2페이지까지 불러온 상태(총 40개 표시)
- **When** 온도 필터를 바꾼다
- **Then** 누적된 40개가 사라지고 새 조건의 0페이지(최대 20개)만 표시된다
- **검증** 컴포넌트 테스트 `RecipesPage`

#### AC-RECIPESBREWS-69 · 카드 대표 수치가 원두량이다

- **Given** `doseG: 15.0`인 레시피
- **When** 카드를 렌더한다
- **Then** `data-lead` 안에 기존 `formatGrams()`로 `"15.0g"`이 렌더된다. (목업의 `15 g`(공백·소수 생략) 표기는 이 스펙에서 다루지 않고 시각 보정 트랙에서 근사를 재검토한다)
- **검증** 컴포넌트 테스트 `RecipeCard`

#### AC-RECIPESBREWS-70 · 둘러보기 카드에 작성자 줄이 있다

- **Given** `authorDisplayName: "지연"`, `savedCount: 12`인 레시피
- **When** 둘러보기 카드를 렌더한다
- **Then** `data-card-author` 안에 정확히 `"지연 · 담김 12"`가 렌더된다
- **검증** 컴포넌트 테스트 `RecipeCard`

#### AC-RECIPESBREWS-71 · 내 서랍의 담아온 카드에 출처 배지가 있다

- **Given** `parentRecipeId`가 있고 `sourceAuthorName: "지연"`인 카드
- **When** 내 서랍 카드를 렌더한다
- **Then** `data-card-source` 안에 정확히 `"지연 님 레시피에서"`가 렌더되고 `data-card-badge`(내가 만든)는 렌더되지 않는다
- **검증** 컴포넌트 테스트 `RecipeCard`

#### AC-RECIPESBREWS-72 · 내 서랍의 내가 만든 카드에 잔 수 배지가 있다

- **Given** `parentRecipeId`가 없고 `brewCount: 3`인 카드
- **When** 내 서랍 카드를 렌더한다
- **Then** `data-card-badge`에 `"내가 만든"`, `data-card-brew-count`에 정확히 `"3잔 기록"`이 렌더되고 `data-card-source`는 렌더되지 않는다
- **검증** 컴포넌트 테스트 `RecipeCard`

#### AC-RECIPESBREWS-73 · 상세 화면에 히어로·원장·스텝이 있다

- **Given** 레시피 상세 응답
- **When** `/recipes/{id}`를 렌더한다
- **Then** 히어로(원두량·Hot/Ice·추천 배전도), 원장(기구/분쇄도/총 시간), 스텝 목록이 전부 표시된다
- **검증** 컴포넌트 테스트 `RecipeDetail`

#### AC-RECIPESBREWS-74 · 담기는 바디 없이 즉시 담기고 담긴 레시피로 이동한다

- **Given** 남의 PUBLIC 레시피 상세
- **When** "내 서랍에 담기"를 클릭한다
- **Then** `POST /recipes/{id}/fork`가 바디 없이 호출되고, 성공(201) 시 `router.push(`/recipes/${새 id}`)`로 이동한다
- **검증** 컴포넌트 테스트 `RecipeDetail`

#### AC-RECIPESBREWS-75 · 내 레시피 상세에는 담기 버튼이 없다

- **Given** 내가 소유한 레시피 상세
- **When** 렌더한다
- **Then** "내 서랍에 담기" 버튼이 DOM에 없다(기존 `isMine` 분기 재사용 — 편집·삭제·"이 레시피로 내렸다"만 표시)
- **검증** 컴포넌트 테스트 `RecipeDetail`(기존 테스트 확장)

#### AC-RECIPESBREWS-76 · 통계 카드에 이번 달·평균 별점·최빈 원두량·즐겨 쓴 레시피가 있다

- **Given** `BrewLogStatsResponse { monthCount: 9, averageRating: 3.7, favoriteDoseG: 16.0, favoriteRecipeTitle: "케냐 94도 3푸어" }`
- **When** 웹 `/brews`를 렌더한다
- **Then** 4칸이 각각 `"9잔"` / `"★ 3.7"` / `"16.0g"` / `"케냐 94도 3푸어"`로 렌더된다. 모바일(`<760px`)은 `이번 달`·`평균 별점` 2칸만 렌더되고 나머지 둘은 DOM에 없다
- **검증** 컴포넌트 테스트 `BrewsPage`

#### AC-RECIPESBREWS-77 · 내 잔 목록이 웹은 테이블, 모바일은 2줄 원장 행이다

- **Given** 브루 로그 목록
- **When** `≥760px`에서 렌더한다
- **Then** 날짜·레시피/원두·원두량·온도·시간·수율·평가 7열 테이블이 렌더된다
- **Given** `<760px`에서 렌더한다
- **Then** 첫 줄에 레시피명+원두량, 둘째 줄에 날짜·온도·시간 / 수율·평가인 2줄 행이 렌더된다
- **검증** 컴포넌트 테스트 `BrewsPage`

#### AC-RECIPESBREWS-78 · 레시피/원두 열은 기존 useRecipeLabels로 채운다

- **Given** 브루 로그 목록
- **When** 테이블/원장 행을 렌더한다
- **Then** 레시피명·원두명 해석에 새 API 호출이 추가되지 않고 기존 `useRecipeLabels` 훅을 그대로 쓴다
- **검증** 컴포넌트 테스트 `BrewsPage`

#### AC-RECIPESBREWS-79 · 탭·상단 바 3번째 라벨이 "내 잔"이다

- **Given** 로그인 사용자
- **When** `BottomNav`(모바일)·`WebTopBar`(웹)를 렌더한다
- **Then** 3번째 항목의 텍스트가 정확히 `"내 잔"`이다(`"기록"`이 아니다)
- **검증** 컴포넌트 테스트 `BottomNav`·`WebTopBar`(기존 테스트 갱신)

#### AC-RECIPESBREWS-80 · ⌘K/Ctrl+K가 검색 입력에 포커스한다

- **Given** 둘러보기 세그먼트, 검색 입력이 포커스돼 있지 않음
- **When** Mac에서 `Cmd+K`, Windows/Linux에서 `Ctrl+K`를 누른다
- **Then** 검색 입력에 포커스가 이동하고 브라우저 기본 동작(주소창 포커스 등)은 발생하지 않는다(`preventDefault`)
- **검증** 컴포넌트 테스트 `RecipesPage`

#### AC-RECIPESBREWS-81 · 바로 내리기는 기록 작성 화면을 연다

- **Given** 남의 PUBLIC 레시피 상세(`id: 5`)
- **When** "바로 내리기"(웹: "이 레시피로 바로 내리기")를 클릭한다
- **Then** `/brews/new?recipeId=5`로 이동한다(담지 않음 — `POST /recipes/5/fork` 호출 없음). 기존 "이 레시피로 내렸다"(내 레시피용) CTA와 같은 라우트를 재사용한다
- **검증** 컴포넌트 테스트 `RecipeDetail`

#### AC-RECIPESBREWS-82 · 모바일 필터 시트는 스테이징 영역이다

- **Given** 모바일(`<760px`) 둘러보기, 필터 시트가 열려 있음
- **When** 온도 pill을 바꾼다
- **Then** 목록에는 아직 반영되지 않고, CTA 문구가 `{N}개 결과 보기`로 갱신된다(N은 스테이징된 조건으로 300ms 디바운스 후 다시 센 결과 건수)
- **When** 그 CTA를 클릭한다
- **Then** 스테이징된 조건이 실제 목록 조회에 적용되고 시트가 닫힌다
- **When** 대신 "초기화"를 클릭한다
- **Then** 스테이징 값만 초기값으로 돌아가고 시트는 열린 채로 유지된다(적용된 필터는 그대로)
- **검증** 컴포넌트 테스트 `FilterSheet`

#### AC-RECIPESBREWS-83 · 마지막 페이지에서 "더 보기"가 숨는다

- **Given** 마지막 페이지까지 불러온 목록(`hasNext: false`)
- **When** 렌더한다
- **Then** "더 보기" 버튼이 DOM에 없다
- **검증** 컴포넌트 테스트 `RecipesPage`·`BrewsPage`

### 엣지 (경계값)

#### AC-RECIPESBREWS-84 · 둘러보기 결과 0건이면 안내 카드가 뜬다

- **Given** 검색·필터 결과 0건
- **When** 둘러보기 목록을 렌더한다
- **Then** 점선 카드에 `"찾는 레시피가 없나요?"`와 `"검색어를 줄이거나 필터를 해제해 보세요."`가 정확히 렌더된다
- **검증** 컴포넌트 테스트 `RecipesPage`

#### AC-RECIPESBREWS-85 · 내 서랍 0건(신규 가입자)이면 빈 상태가 뜬다

- **Given** 레시피가 하나도 없는 신규 사용자
- **When** 내 서랍을 렌더한다
- **Then** 기존 빈 상태 문구 `"레시피가 없습니다"`와 `"새 레시피"` CTA(`/recipes/new`)가 렌더된다(기존 패턴 재사용, 새 카피 없음)
- **검증** 컴포넌트 테스트 `RecipesPage`

#### AC-RECIPESBREWS-86 · 내 잔 0건이면 통계가 전부 빈 값이다

- **Given** `BrewLogStatsResponse { monthCount: 0, averageRating: null, favoriteDoseG: null, favoriteRecipeTitle: null }`
- **When** `/brews`를 렌더한다
- **Then** `이번 달` 칸만 `"0잔"`이고 나머지 칸은 전부 `"—"`이며, `"기록하기"` CTA가 표시된다
- **검증** 컴포넌트 테스트 `BrewsPage`

#### AC-RECIPESBREWS-87 · TDS 없는 잔은 수율 칸이 빈다

- **Given** `tdsPercent`가 없는 브루 로그
- **When** 웹 테이블 행을 렌더한다
- **Then** 수율 칸이 `"—"`이고 열 자체는 유지된다(테이블 폭이 줄지 않음)
- **검증** 컴포넌트 테스트 `BrewsPage`

#### AC-RECIPESBREWS-88 · 뷰포트 1280px에서 4열이다

- **Given** 뷰포트 폭 `1280px`
- **When** 둘러보기 그리드를 렌더한다
- **Then** 4열 그리드다
- **검증** e2e

#### AC-RECIPESBREWS-89 · 뷰포트 1279px에서 3열이다

- **Given** 뷰포트 폭 `1279px`
- **Then** 3열 그리드다
- **검증** e2e

#### AC-RECIPESBREWS-90 · 뷰포트 1024px에서 3열이다

- **Given** 뷰포트 폭 `1024px`
- **Then** 3열 그리드다
- **검증** e2e

#### AC-RECIPESBREWS-91 · 뷰포트 1023px에서 2열이고 수율 열이 숨는다

- **Given** 뷰포트 폭 `1023px`
- **Then** 레시피 그리드는 2열이고, 내 잔 테이블은 수율 열이 렌더되지 않는다
- **검증** e2e

#### AC-RECIPESBREWS-92 · 뷰포트 760px에서 2열이다

- **Given** 뷰포트 폭 `760px`
- **Then** 2열 그리드다
- **검증** e2e

#### AC-RECIPESBREWS-93 · 뷰포트 759px에서 1열·바텀시트·2줄 원장이다

- **Given** 뷰포트 폭 `759px`
- **Then** 레시피 그리드는 1열, 필터는 바텀시트, 내 잔은 2줄 원장 행이다
- **검증** e2e

### 실패

#### AC-RECIPESBREWS-94 · 인증 없이 /recipes·/brews 접근 시 로그인으로 보낸다

- **Given** 토큰 없음
- **When** `/recipes` 또는 `/brews`에 접근한다
- **Then** `/login`으로 리다이렉트된다(기존 `useRequireSession`)
- **검증** 컴포넌트 테스트

#### AC-RECIPESBREWS-95 · 가시성 없는 레시피 상세는 403 화면이다

- **Given** 볼 수 없는 레시피 id
- **When** `/recipes/{id}`에 접근한다
- **Then** 기존 `ErrorState`가 백엔드 403 응답의 `message`를 그대로 표시한다(프론트가 새 문구를 만들지 않는다)
- **검증** 컴포넌트 테스트 `RecipeDetail`

#### AC-RECIPESBREWS-96 · 담기 실패 시 백엔드 메시지를 그대로 보여주고 버튼이 재활성된다

- **Given** 담기 요청이 400(검증 실패)·403(가시성 없음)·404(삭제됨) 중 하나로 실패한다
- **When** 담기 버튼을 클릭한다
- **Then** 버튼 아래에 `errorMessageOf(error)`(백엔드 `message` 그대로)가 표시되고, `fork.isPending`이 꺼지며 버튼이 다시 클릭 가능해진다
- **Given** 네트워크 자체가 끊겨 응답이 없다
- **Then** 고정 문구 `"일시적인 오류가 발생했습니다."`가 표시된다(`errorMessageOf`의 기존 폴백)
- **검증** 컴포넌트 테스트 `RecipeDetail`

#### AC-RECIPESBREWS-97 · 목록·통계 조회 실패 시 재시도 버튼이 있다

- **Given** `GET /recipes` 또는 `GET /brew-logs/stats`가 네트워크 오류로 실패한다
- **When** 화면을 렌더한다
- **Then** 기존 `ErrorState` + "다시 시도" 버튼이 표시된다
- **검증** 컴포넌트 테스트

### 비기능

#### AC-RECIPESBREWS-98 · 새 글자 크기는 타입 스케일에 등록된다

- **Given** 이 스펙에서 새로 쓰는 `text-*` 크기 클래스
- **When** `pnpm test -- typography`를 실행한다
- **Then** `frontend/src/test/typography.test.ts`의 `SCALE`에 등록되지 않은 크기가 없다
- **검증** 유닛 테스트 `typography.test.ts`

#### AC-RECIPESBREWS-99 · 목록 API는 작성자·잔 수 조회로 추가 쿼리가 1회를 넘지 않는다

- **Given** 페이지 크기 20의 목록 조회
- **When** `authorDisplayName`·`sourceAuthorName`·`brewCount`를 채운다
- **Then** 배치 조회로 요청당 추가 쿼리가 1회다(N+1 없음)
- **검증** API 테스트 `RecipeControllerTest`(쿼리 카운트 어서션)

#### AC-RECIPESBREWS-100 · /recipes·/brews는 서버 렌더링 없이 클라이언트에서 데이터를 가져온다

- **Given** `/recipes`·`/brews` 라우트
- **When** 빌드 산출물을 확인한다
- **Then** 두 라우트 모두 `"use client"` 컴포넌트이고 서버 컴포넌트에서 API를 호출하지 않는다 — Cloudflare Workers의 요청당 CPU 10ms 예산은 이 화면들과 무관하다(정적 셸만 SSR)
- **검증** 코드 리뷰 + `pnpm build` 산출물 확인

---

## 구현 순서

- [ ] **Task 0: 계약·백엔드 필드 3개** — Covers: AC-RECIPESBREWS-55, 56, 57

  ```
  1. docs/contracts/2026-09-21-recipes-and-brews-search-api.json의 RecipeSummary에
     authorDisplayName · sourceAuthorName · brewCount 추가
  2. RecipeSummaryResponse 레코드에 필드 3개 추가, RecipeService.list()/search()에서
     savedCount와 같은 배치 조회로 채운다(authorDisplayName은 ownerUserId 목록을
     UserRepository에서 배치 조회, CURATED는 entity의 authorName)
  3. ./gradlew test --tests '*ContractComplianceTest' 초록 확인
  ```

- [ ] **Task 1: 세그먼트·라우팅·URL 동기화 뼈대** — Covers: AC-RECIPESBREWS-58, 65, 66, 67, 68

  ```tsx
  // frontend/src/app/recipes/page.tsx
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") ?? "DRAWER";
  // useInfiniteQuery queryKey에 scope·q·temp·roast·doseMin·doseMax·dripper·sort·owner 포함
  // page는 queryKey에 넣지 않는다(AC-67) — useInfiniteQuery가 알아서 누적
  ```

- [ ] **Task 2: 검색 입력 — 디바운스·IME** — Covers: AC-RECIPESBREWS-59, 60, 80

- [ ] **Task 3: 필터 — 웹 pill 줄 · 모바일 스테이징 시트** — Covers: AC-RECIPESBREWS-61, 62, 82

- [ ] **Task 4: RecipeCard 재설계** — Covers: AC-RECIPESBREWS-69, 70, 71, 72

- [ ] **Task 5: 내 서랍 owner pill + 정렬 토글** — Covers: AC-RECIPESBREWS-63, 64

- [ ] **Task 6: 레시피 상세 재설계 — 담기·바로 내리기** — Covers: AC-RECIPESBREWS-73, 74, 75, 81

- [ ] **Task 7: 내 잔(BW1/BM1) — 통계 + 목록** — Covers: AC-RECIPESBREWS-76, 77, 78

- [ ] **Task 8: 반응형 4구간** — Covers: AC-RECIPESBREWS-83, 88, 89, 90, 91, 92, 93

- [ ] **Task 9: 탭 개칭 "내 잔"** — Covers: AC-RECIPESBREWS-79

  ```
  BottomNav·WebTopBar 라벨 "기록" → "내 잔" 변경 전, docs/GOTCHAS.md
  "문구가 다른 요소의 부분 문자열이 되면 Playwright strict-mode 충돌" 확인.
  BottomNav.test.tsx 등 기존 "기록" 문자열 단정을 함께 갱신.
  ```

- [ ] **Task 10: 에러·빈 상태 전반** — Covers: AC-RECIPESBREWS-84, 85, 86, 87, 94, 95, 96, 97

- [ ] **Task 11: 비기능 검증** — Covers: AC-RECIPESBREWS-98, 99, 100

---

## 수동 확인

- [ ] ★ mockup-checker 서브에이전트로 RW1~RW3·BW1·RM1~RM4·BM1을 `390px`/`1280px`에서
      실제 배포와 목업을 나란히 대조하고, 결과를 PR 본문에 첨부한다(완료 조건).

## 열어둔 결정

- 타이포그래피 근사값이 실제 렌더에서 목업과 시각적으로 얼마나 벌어지는지는 위 수동 확인의
  mockup-checker 결과를 보고 그 자리에서 미세 조정한다(새 named 토큰이 필요하면 추가).

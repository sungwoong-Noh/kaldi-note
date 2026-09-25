---
id: RECIPESBREWS
title: 레시피 검색·필터 + 잔 통계 + 담기(포크) API 개편
status: 승인
plan: docs/archive/plans/2026-09-21-plan-recipes-and-brews-search-api.md
---

# 레시피 검색·필터 + 잔 통계 + 담기(포크) API 개편 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**
>
> `docs/design/design_handoff_kaldi_note/RECIPES-AND-BREWS.md`·`DECISIONS.md`가 정한
> 레시피/잔 재설계를 4개 스펙으로 나눈 것 중 **1번째(백엔드)**다. 나머지 3개(웹 둘러보기/내
> 서랍, 웹 상세/담기/내 잔, 모바일 전체)는 이 스펙의 API를 소비하며, 같은 `RECIPESBREWS` AC
> 접두어를 이어 쓴다.

## 무엇을

`GET /api/v1/recipes`에 검색(`q`)·필터(`temp`·`roast`·`doseMin`/`doseMax`·`dripper`)·정렬
(`sort`)·범위 구분(`scope`: 내 서랍/둘러보기, `owner`: 전체/내가 만든/담아온)을 추가하고,
목록 응답에 `temperatureType`·`recommendedRoastLevel`·`savedCount`를 싣는다. 새 통계 API
`GET /api/v1/brew-logs/stats`를 추가한다. `POST /recipes/{id}/fork`가 선택적 요청 바디를
받아, 원본을 복제하면서 동시에 사용자가 고친 값을 반영해 **저장 시점에 한 번만** 레시피를
생성하도록 바꾼다(기존: 먼저 복제 → 별도 PUT으로 수정).

### 범위 밖 (Non-goals)

- 웹·모바일 화면 자체. 이 스펙은 API만 다룬다 — 화면은 스펙 2~4.
- 원두·로스터 이름 검색. `Recipe` 엔티티가 원두를 참조하지 않으므로 이번엔 제외한다.
  (필요해지면 `Recipe`에 대표 원두 참조를 추가하는 별도 스펙이 선행돼야 한다.)
- `⌘K` 단축키, 검색 디바운스 등 프론트 UX 세부. 스펙 2가 다룬다.
- 검색 결과의 하이라이트·자동완성.
- `POST /recipes/{id}/fork`의 하위 호환 제거. 바디 없이 호출하는 기존 경로는 계속 지원한다.

## 왜

`RECIPES-AND-BREWS.md`가 재설계한 레시피 화면(둘러보기/내 서랍 분리, 검색+필터 4종, 「내
서랍에 담기」)과 잔 화면(통계 4칸)은 현재 `GET /recipes`(소유자 필터만)·`GET /brew-logs`
(recipeId/userId/beanBatchId/date 필터만)로는 구현할 수 없다. 화면을 만들기 전에 이 API들이
먼저 있어야 한다.

## 용어

| 용어 | 정의 |
|---|---|
| 내 서랍 (`scope=DRAWER`) | 내가 만든 것 + 담아온(포크한) 것 중 바로 내릴 수 있는 레시피만 |
| 둘러보기 (`scope=PUBLIC`) | 공개 레시피 전체(검색·필터 대상) |
| 담기 | 남의 레시피를 「내 서랍에 담기」로 복제하는 것(기존 「포크」의 새 이름, API 경로는 유지) |

## 데이터

스키마 변경 없음. `brewers` 테이블에 시드 1건(`Clever`) 추가.

| 테이블 | 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|---|
| `brewers` | (신규 행) `brand='Clever'`, `name='Clever Dripper'`, `type='IMMERSION'`, `is_system=true` | - | - | 목업의 「기구」 필터 4종(V60/Kalita/Origami/Clever) 완성을 위한 시드 |

## API

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| `GET` | `/api/v1/recipes` | O | 검색·필터·정렬·범위 파라미터 추가(기존 `ownerUserId`·`page`·`size` 유지) |
| `GET` | `/api/v1/brew-logs/stats` | O | 내 잔 통계 4칸(신규) |
| `POST` | `/api/v1/recipes/{id}/fork` | O | 선택적 요청 바디로 담기+수정을 한 번에 처리 |

### 요청 / 응답 예시

```json
// GET /api/v1/recipes?scope=PUBLIC&q=워시드&temp=HOT&roast=LIGHT&roast=MEDIUM&doseMin=15&doseMax=20&dripper=V60&sort=POPULAR&page=0&size=20
{
  "content": [
    {
      "id": 5,
      "title": "아침에 마시는 밝은 워시드",
      "temperatureType": "HOT",
      "recommendedRoastLevel": "LIGHT",
      "savedCount": 12,
      "doseG": 15.0,
      "...": "기존 RecipeSummaryResponse 필드 유지"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 37,
  "totalPages": 2
}
```

```json
// GET /api/v1/brew-logs/stats  (기록 있음)
{
  "monthCount": 9,
  "averageRating": 4.3,
  "favoriteDoseG": 15.0,
  "favoriteRecipeId": 5,
  "favoriteRecipeTitle": "아침에 마시는 밝은 워시드"
}

// 기록이 0건일 때
{
  "monthCount": 0,
  "averageRating": null,
  "favoriteDoseG": null,
  "favoriteRecipeId": null,
  "favoriteRecipeTitle": null
}
```

```json
// POST /api/v1/recipes/{id}/fork  (바디로 원두량만 고쳐서 담기)
// 요청
{ "doseG": 16.0 }
// 응답 — 나머지 필드는 원본값 그대로, doseG만 교체된 새 레시피
{ "id": 42, "doseG": 16.0, "parentRecipeId": 5, "sourceAuthorName": "지연", "...": "..." }
```

---

## 어떻게 동작 — 인수 조건

### 정상 동작 — 검색

#### AC-RECIPESBREWS-01 · q로 레시피 제목이 부분 일치 검색된다

- **Given** 제목이 "아침에 마시는 밝은 워시드"인 공개 레시피
- **When** `GET /recipes?scope=PUBLIC&q=워시드`
- **Then** 그 레시피가 결과에 포함된다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-02 · q로 기구(브루어) 이름도 매칭된다

- **Given** `brewerId`가 이름 "V60 01"인 브루어를 가리키는 레시피
- **When** `GET /recipes?scope=PUBLIC&q=V60`
- **Then** 그 레시피가 결과에 포함된다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-03 · q가 제목·기구명 어디에도 안 맞으면 빈 결과다(200)

- **Given** 공개 레시피가 존재하는 상태
- **When** `GET /recipes?scope=PUBLIC&q=존재하지않는검색어`
- **Then** HTTP `200`, `content`가 빈 배열, `totalElements`가 0
- **검증** API 테스트 `RecipeControllerTest`

### 정상 동작 — 필터

#### AC-RECIPESBREWS-04 · temp=HOT이면 HOT 레시피만 남는다

- **Given** HOT 레시피 1개, ICE 레시피 1개(둘 다 공개)
- **When** `GET /recipes?scope=PUBLIC&temp=HOT`
- **Then** 결과에 HOT 레시피만 있다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-05 · roast를 2개 넘기면 OR로 매칭된다

- **Given** LIGHT·MEDIUM·DARK 레시피 각 1개(전부 공개)
- **When** `GET /recipes?scope=PUBLIC&roast=LIGHT&roast=DARK`
- **Then** 결과에 LIGHT·DARK 레시피만 있고 MEDIUM은 없다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-06 · doseMin·doseMax 둘 다 주면 그 사이(포함) 레시피만 남는다

- **Given** doseG가 각각 10.0 / 15.0 / 20.0 / 30.0인 공개 레시피 4개
- **When** `GET /recipes?scope=PUBLIC&doseMin=15&doseMax=20`
- **Then** 결과에 doseG 15.0·20.0 레시피만 있다(경계 포함)
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-07 · doseMin만 주면 그 이상만 남는다

- **Given** doseG 10.0·20.0 공개 레시피
- **When** `GET /recipes?scope=PUBLIC&doseMin=15`
- **Then** doseG 20.0만 결과에 있다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-08 · dripper=V60이면 이름이 "V60"으로 시작하는 브루어의 레시피만 남는다

- **Given** 브루어 이름 "V60 01"(Hario)을 쓰는 레시피와 "Wave 155"(Kalita)를 쓰는 레시피
- **When** `GET /recipes?scope=PUBLIC&dripper=V60`
- **Then** "V60 01"을 쓰는 레시피만 결과에 있다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-09 · dripper=KALITA/ORIGAMI는 brand로 매칭된다

- **Given** brand가 각각 Kalita·Origami인 브루어를 쓰는 레시피 2개
- **When** `GET /recipes?scope=PUBLIC&dripper=KALITA`
- **Then** brand=Kalita 레시피만 결과에 있다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-10 · dripper=CLEVER가 새로 시드된 Clever 브루어와 매칭된다

- **Given** V15 이후 시드로 존재하는 brand="Clever" 브루어를 쓰는 레시피
- **When** `GET /recipes?scope=PUBLIC&dripper=CLEVER`
- **Then** 그 레시피가 결과에 있다
- **검증** 통합 테스트 `RecipeSeedMigrationTest`(신규) + API 테스트 `RecipeControllerTest`

### 정상 동작 — 정렬·범위

#### AC-RECIPESBREWS-11 · scope=PUBLIC 기본 정렬은 CURATED desc, savedCount desc, createdAt desc다

- **Given** CURATED 레시피 1개(savedCount 낮음), USER 공개 레시피 2개(savedCount 각각 5·1)
- **When** `GET /recipes?scope=PUBLIC`(sort 생략)
- **Then** 응답 순서가 CURATED → savedCount 5 → savedCount 1 순이다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-12 · sort=RECENT는 createdAt desc 단일 기준이다

- **Given** CURATED 레시피(오래됨)와 최근에 만든 USER 공개 레시피
- **When** `GET /recipes?scope=PUBLIC&sort=RECENT`
- **Then** 최근에 만든 레시피가 먼저 온다(CURATED 우선순위 없음)
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-13 · scope=DRAWER에서 sort 파라미터는 무시되고 기존 createdAt desc, id desc를 유지한다

- **Given** 내가 만든 레시피 2개
- **When** `GET /recipes?scope=DRAWER&sort=RECENT`(값이 있어도)
- **Then** 응답이 기존 목록 정렬(createdAt desc, id desc)과 같다 — 400이 아니다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-14 · scope=DRAWER + owner=MINE은 내가 만든 것만 남긴다

- **Given** 내가 만든 레시피 1개, 담아온(포크한) 레시피 1개
- **When** `GET /recipes?scope=DRAWER&owner=MINE`
- **Then** 내가 만든 것만 결과에 있다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-15 · scope=DRAWER + owner=SAVED는 담아온 것만 남긴다

- **Given** 내가 만든 레시피 1개, 담아온 레시피 1개
- **When** `GET /recipes?scope=DRAWER&owner=SAVED`
- **Then** 담아온 것만 결과에 있다(`parentRecipeId`가 null이 아닌 것)
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-16 · scope=DRAWER + owner=ALL(또는 생략)은 내가 만든 것 + 담아온 것 전부다

- **Given** 내가 만든 레시피 1개, 담아온 레시피 1개, 남의 공개 레시피 1개(내 것 아님)
- **When** `GET /recipes?scope=DRAWER`(owner 생략)
- **Then** 내가 만든 것 + 담아온 것 2개만 결과에 있고 남의 레시피는 없다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-17 · scope=DRAWER에서 ownerUserId 파라미터는 무시되고 항상 호출자 본인 기준이다

- **Given** 사용자 A가 로그인, 다른 사용자 B의 id를 `ownerUserId`로 지정
- **When** `GET /recipes?scope=DRAWER&ownerUserId={B의 id}`
- **Then** A 본인의 서랍이 반환된다(B의 레시피가 아니다)
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-18 · scope=PUBLIC에서 owner 파라미터는 무시된다(400 아님)

- **Given** 공개 레시피 목록
- **When** `GET /recipes?scope=PUBLIC&owner=MINE`
- **Then** HTTP `200`이고 `owner` 조건 없이 전체 공개 레시피가 반환된다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-19a · scope=PUBLIC은 visibility=PUBLIC인 레시피만 보여준다(FRIENDS 제외)

- **Given** 사용자 A가 소유한 FRIENDS 레시피 1개(B와 맞팔로우), PUBLIC 레시피 1개
- **When** B가 `GET /recipes?scope=PUBLIC`을 호출한다(A와 맞팔로우 상태여도)
- **Then** 결과에 PUBLIC 레시피만 있고 FRIENDS 레시피는 없다 — 둘러보기는 "공개 레시피 전체"이며
  기존 `findVisible`의 FRIENDS 조건을 적용하지 않는다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-19 · scope 생략 시 기본값은 DRAWER다

- **Given** `ownerUserId`·`scope` 둘 다 생략
- **When** `GET /recipes`
- **Then** 호출자 본인의 내 서랍(내가 만든 것 + 담아온 것) 목록이 반환된다
- **검증** API 테스트 `RecipeControllerTest`

### 정상 동작 — 목록 응답 필드

#### AC-RECIPESBREWS-20 · 목록 응답에 temperatureType·recommendedRoastLevel·savedCount가 포함된다

- **Given** temperatureType=ICE, recommendedRoastLevel=DARK, 포크가 2건인 공개 레시피
- **When** `GET /recipes?scope=PUBLIC`
- **Then** 해당 항목의 `temperatureType`이 `"ICE"`, `recommendedRoastLevel`이 `"DARK"`,
  `savedCount`가 `2`다
- **검증** API 테스트 `RecipeControllerTest`

### 정상 동작 — 잔 통계

#### AC-RECIPESBREWS-21 · monthCount가 이번 달(KST) 브루 건수다

- **Given** 이번 달(KST) 브루 로그 3건, 지난달 브루 로그 2건
- **When** `GET /brew-logs/stats`
- **Then** `monthCount`가 `3`이다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-RECIPESBREWS-22 · averageRating이 소수 1자리 HALF_UP으로 반올림된다

- **Given** rating이 4.0, 4.5, 4.5인 브루 로그 3건
- **When** `GET /brew-logs/stats`
- **Then** `averageRating`이 `4.3`이다((4.0+4.5+4.5)/3 = 4.333... → 4.3)
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-RECIPESBREWS-23 · rating이 null인 로그는 평균 계산에서 제외된다

- **Given** rating이 4.0인 로그 1건, rating이 null인 로그 1건
- **When** `GET /brew-logs/stats`
- **Then** `averageRating`이 `4.0`이다(null 제외 평균)
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-RECIPESBREWS-24 · favoriteDoseG는 actualDoseG의 최빈값이다

- **Given** actualDoseG가 15.0, 15.0, 20.0인 브루 로그 3건
- **When** `GET /brew-logs/stats`
- **Then** `favoriteDoseG`가 `15.0`이다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-RECIPESBREWS-25 · favoriteDoseG 동점이면 가장 최근에 쓴 값을 돌려준다

- **Given** actualDoseG 15.0(3일 전), 20.0(1일 전)이 각각 1건씩(동점)
- **When** `GET /brew-logs/stats`
- **Then** `favoriteDoseG`가 `20.0`이다(더 최근 brewedAt)
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-RECIPESBREWS-26 · favoriteRecipe는 전체 기간 최다 브루 레시피다

- **Given** 레시피 A로 3번, 레시피 B로 1번 브루
- **When** `GET /brew-logs/stats`
- **Then** `favoriteRecipeId`가 A의 id다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-RECIPESBREWS-27 · favoriteRecipe 동점이면 가장 최근에 브루한 레시피를 돌려준다

- **Given** 레시피 A(3일 전), 레시피 B(1일 전)로 각각 1번씩 브루(동점)
- **When** `GET /brew-logs/stats`
- **Then** `favoriteRecipeId`가 B의 id다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-RECIPESBREWS-28 · 브루 로그가 0건이면 통계 전부 0 또는 null이다

- **Given** 브루 로그가 하나도 없는 사용자
- **When** `GET /brew-logs/stats`
- **Then** `monthCount`가 `0`, `averageRating`·`favoriteDoseG`·`favoriteRecipeId`·
  `favoriteRecipeTitle`이 전부 `null`이다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-RECIPESBREWS-29 · 통계는 호출자 본인 것만 조회된다(userId 파라미터 없음)

- **Given** 사용자 A가 로그인, 사용자 B가 브루 로그 5건 보유
- **When** A가 `GET /brew-logs/stats` 호출(B를 지정할 방법 없음)
- **Then** A 본인의 통계만 반환된다(B의 것과 섞이지 않는다)
- **검증** API 테스트 `BrewLogControllerTest`

### 정상 동작 — 담기(포크) API 변경

#### AC-RECIPESBREWS-30 · 바디 없이 fork하면 기존과 동일하게 원본 그대로 복제된다

- **Given** doseG 15.0인 공개 레시피
- **When** `POST /recipes/{id}/fork`(바디 없음)
- **Then** HTTP `201`, 새 레시피의 `doseG`가 `15.0`(원본과 동일)
- **검증** API 테스트 `RecipeForkControllerTest`(기존 회귀)

#### AC-RECIPESBREWS-31 · 바디로 넘긴 필드는 원본 값 대신 그 값으로 저장된다

- **Given** doseG 15.0인 공개 레시피
- **When** `POST /recipes/{id}/fork` 바디 `{"doseG": 16.0}`
- **Then** HTTP `201`, 새 레시피의 `doseG`가 `16.0`이다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-RECIPESBREWS-32 · 바디에서 생략한 필드는 원본 값을 그대로 물려받는다

- **Given** doseG 15.0, waterG 250.0인 공개 레시피
- **When** `POST /recipes/{id}/fork` 바디 `{"doseG": 16.0}`(waterG 생략)
- **Then** 새 레시피의 `waterG`가 원본과 같은 `250.0`이다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-RECIPESBREWS-33 · 담기 후에도 parentRecipeId·sourceAuthorName은 기존 규칙대로 채워진다

- **Given** 소유자 닉네임이 "지연"인 공개 레시피
- **When** `POST /recipes/{id}/fork` 바디로 값을 고쳐 담는다
- **Then** 새 레시피의 `parentRecipeId`가 원본 id, `sourceAuthorName`이 `"지연"`이다(값을
  고쳤어도 출처 필드는 영향받지 않는다)
- **검증** API 테스트 `RecipeForkControllerTest`

### 경계값

#### AC-RECIPESBREWS-40 · doseMin=doseMax(같은 값)이면 그 값과 정확히 같은 레시피만 남는다

- **Given** doseG 15.0·16.0 공개 레시피
- **When** `GET /recipes?scope=PUBLIC&doseMin=15&doseMax=15`
- **Then** doseG 15.0인 레시피만 결과에 있다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-41 · doseMin이 doseMax보다 크면 400이다

- **Given** 유효한 공개 레시피 목록
- **When** `GET /recipes?scope=PUBLIC&doseMin=20&doseMax=10`
- **Then** HTTP `400`, `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

### 에러

#### AC-RECIPESBREWS-50 · scope에 잘못된 값을 보내면 400이다

- **Given** 유효한 요청
- **When** `GET /recipes?scope=INVALID`
- **Then** HTTP `400`, `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPESBREWS-51 · temp·roast·sort·owner·dripper에 잘못된 enum 값을 보내면 400이다

- **Given** 유효한 요청
- **When** `GET /recipes?scope=PUBLIC&temp=WARM`
- **Then** HTTP `400`, `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`(5개 파라미터 각각)

#### AC-RECIPESBREWS-52 · 담기 바디의 필드 검증은 CreateRecipeRequest와 동일하게 적용된다

- **Given** 공개 레시피
- **When** `POST /recipes/{id}/fork` 바디 `{"doseG": -1.0}`(음수)
- **Then** HTTP `400`, `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-RECIPESBREWS-53 · 가시성 없는 레시피는 담기 시도 시 403이다(기존 유지)

- **Given** 남의 PRIVATE 레시피
- **When** `POST /recipes/{id}/fork` 바디 포함 여부와 무관하게 호출
- **Then** HTTP `403`, `code: "FORBIDDEN"`
- **검증** API 테스트 `RecipeForkControllerTest`(기존 회귀)

#### AC-RECIPESBREWS-54 · 인증 없이 GET /recipes 호출 시 401이다(기존 유지)

- **Given** 토큰 없음
- **When** `GET /recipes?scope=PUBLIC`
- **Then** HTTP `401`
- **검증** API 테스트 `RecipeControllerTest`(기존 회귀)

---

## 수동 확인

없음. 전부 자동화 가능하다.

## 열어둔 결정

- `roast`·`dripper`처럼 배열로 받는 쿼리 파라미터의 정확한 전송 형식(반복 파라미터
  `roast=A&roast=B` vs 콤마 구분 `roast=A,B`)은 계획 단계에서 Spring MVC 바인딩 방식에 맞춰
  정한다 — 어느 쪽이든 이 스펙의 인수 조건(값이 매칭되는지)에는 영향 없다.

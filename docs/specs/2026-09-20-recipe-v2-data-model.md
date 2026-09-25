---
id: RECIPEV2
title: 레시피/잔 재설계 — 데이터 모델과 마이그레이션
status: 구현완료
plan: docs/archive/plans/2026-09-20-plan-recipe-v2-data-model.md
---

# 레시피/잔 재설계 — 데이터 모델과 마이그레이션 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

`docs/design/design_handoff_kaldi_note/RECIPES-AND-BREWS.md`(이하 설계 문서)와 그 `DECISIONS.md`가
확정한 레시피/잔 재설계 중 **백엔드 데이터 모델·마이그레이션·API DTO만** 먼저 구현한다.

- `recipes`에 `temperatureType`(HOT/ICE)·`recommendedRoastLevel`(LIGHT/MEDIUM/DARK)·`sourceAuthorName`을
  추가한다.
- `savedCount`·`brewCount`를 저장 없이 파생 계산해 `GET /recipes/{id}` 응답에 노출한다.
- `brew_logs.recipe_id`를 nullable로 바꾸고, 남의(비소유) 레시피로 브루잉했을 때 서버가 그 FK를
  `null`로 저장하는 규칙을 추가한다.
- `brew_logs`에 `recipeSnapshot`(JSONB, 항상 채움)을 추가해 레시피의 설명 필드(제목·작성자·계획
  물리값·그라인더·스텝)를 브루 시점에 고정한다.
- `POST /brew-logs`의 레시피 접근 규칙을 **소유자만 → 가시성 규칙(PUBLIC/FRIENDS-맞팔로우/내 소유)**
  으로 완화한다.

### 범위 밖 (Non-goals)

- **프론트 화면 전부.** 카드·목록·필터·「내 서랍에 담기」 편집 화면은 다루지 않는다 — 다음 스펙.
- **검색·필터·정렬 쿼리파라미터** (`q`, `temp`, `roast[]`, `doseMin/Max`, `dripper[]`, `sort`,
  `scope`, `owner`). `docs/specs/2026-08-19-list-query-api.md`가 이미 `sort`를 Non-goal로
  명시했고, 이번 스펙도 목록 API 자체는 건드리지 않는다.
- **`savedCount`/`brewCount` COUNT 쿼리의 N+1 성능 최적화.** 목록 API에서 실제로 쓰기 시작하는
  다음 스펙의 몫이다.
- **원두 실배전도(`catalog.RoastLevel`, 5단계)와 레시피 추천 배전도(`RecipeRoastLevel`, 3단계)
  간 자동 매핑.** 설계 문서가 명시적으로 별개 필드라고 못박았다 — 자동 변환 로직을 만들지 않는다.

## 왜

설계 문서의 「레시피/잔 구조 개편」은 카드에 원두량·HOT/ICE·배전도를 보여주고, 「담김 N」·
「N잔 기록」을 표시하고, 「내 서랍에 담기」로 원본이 바뀌어도 잔이 불변이게 만든다. 이 전부가
프론트에서 쓸 수 있으려면 그 데이터가 먼저 존재해야 한다. 화면을 먼저 만들면 목 데이터로
구현했다가 이 스펙이 뒤늦게 스키마를 바꿔 다시 손대야 한다.

## 용어

| 용어 | 정의 |
|---|---|
| 담기 | 기존 「포크」의 새 이름. 동작은 동일 — 레시피+스텝 전체를 깊은 복사하고 `parentRecipeId`를 원본으로 설정 |
| 바로 내리기 | 담지 않고 남의 레시피로 한 번만 브루잉하는 것. 저장된 `brew_logs.recipe_id`는 `null`이 된다 |
| 레시피 값 | `recipeSnapshot` 안의 계획값(`doseG` 등) — 브루 시점 레시피의 값. 실측값(`actualDoseG` 등)과 다르다 |

## 데이터

| 테이블 | 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|---|
| `recipes` | `temperature_type` | `VARCHAR(10)` | `NOT NULL DEFAULT 'HOT'` | `HOT` / `ICE` |
| `recipes` | `recommended_roast_level` | `VARCHAR(10)` | `NOT NULL DEFAULT 'MEDIUM'` | `LIGHT` / `MEDIUM` / `DARK`. 원두의 실제 배전도(`bean_products.roast_level`)와 별개 |
| `recipes` | `source_author_name` | `VARCHAR(100)` | `NULL` | 담기(포크) 시점에 원본의 `authorName`(CURATED) 또는 원본 소유자 닉네임(USER)을 복사. 이후 원본이 바뀌어도 갱신하지 않는다 |
| `brew_logs` | `recipe_id` | `BIGINT REFERENCES recipes(id)` | **NULL 허용으로 변경** (기존 `NOT NULL`) | 브루잉에 쓴 레시피가 내 소유일 때만 채운다. 남의 레시피로 「바로 내리기」하면 `null` |
| `brew_logs` | `recipe_snapshot` | `JSONB` | `NOT NULL` | 브루 시점 레시피의 설명값 스냅샷. 구조는 아래 「API」 예시 참조 |

`RecipeRoastLevel` enum은 `catalog.RoastLevel`(5단계, `BeanProduct` 소유)과 이름·패키지 모두
분리한다 — `recipe.domain.RecipeRoastLevel { LIGHT, MEDIUM, DARK }`.

`savedCount`·`brewCount`는 컬럼이 아니다. 각각 다음 쿼리의 파생값이다:

```sql
-- savedCount
SELECT COUNT(*) FROM recipes WHERE parent_recipe_id = :id AND deleted_at IS NULL;

-- brewCount
SELECT COUNT(*) FROM brew_logs WHERE recipe_id = :id AND deleted_at IS NULL;
```

`recipe_id`의 null-out 규칙 덕분에, 어떤 레시피에 대해 FK가 살아 있는 `brew_logs` 행은 항상 그
레시피 소유자 본인이 낸 잔뿐이다 — 그래서 `brewCount`에 소유자 필터가 따로 필요 없다.

## API

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| `POST` | `/api/v1/recipes` | O | `temperatureType`·`recommendedRoastLevel` 필드 추가(생략 가능, 기본값 적용) |
| `PATCH` | `/api/v1/recipes/{id}` | O | 위 두 필드 단독 수정 허용 |
| `GET` | `/api/v1/recipes/{id}` | O | 응답에 `temperatureType`·`recommendedRoastLevel`·`sourceAuthorName`·`savedCount`·`brewCount` 추가 |
| `POST` | `/api/v1/brew-logs` | O | 레시피 접근 규칙을 소유자 전용에서 가시성 규칙으로 완화. 응답에 `recipeSnapshot` 추가 |
| `GET` | `/api/v1/brew-logs/{id}` | O | 응답에 `recipeSnapshot` 추가. `recipeId`는 `null`일 수 있다 |

### 요청 / 응답 예시

```json
// GET /api/v1/recipes/5
{
  "id": 5,
  "ownerUserId": 3,
  "title": "아침에 마시는 밝은 워시드",
  "temperatureType": "HOT",
  "recommendedRoastLevel": "LIGHT",
  "parentRecipeId": null,
  "sourceAuthorName": null,
  "savedCount": 2,
  "brewCount": 7
}
```

```json
// POST /api/v1/brew-logs 응답 (recipeId가 남의 PUBLIC 레시피일 때)
{
  "id": 99,
  "recipeId": null,
  "recipeSnapshot": {
    "title": "Kasuya 4:6",
    "authorName": "지연",
    "doseG": 15.0,
    "waterG": 250.0,
    "temperatureC": 92.0,
    "grinder": "Comandante C40",
    "grindValue": { "value": 22, "unit": "CLICK" },
    "steps": [
      { "type": "BLOOM", "waterG": 40.0, "seconds": 45, "note": null },
      { "type": "POUR", "waterG": 100.0, "seconds": 30, "note": null }
    ]
  }
}
```

---

## 어떻게 동작 — 인수 조건

### 정상 동작

#### AC-RECIPEV2-01 · temperatureType을 지정해 레시피를 만들 수 있다

- **Given** 인증된 사용자
- **When** `temperatureType: "ICE"`로 `POST /recipes`
- **Then** HTTP `201`, 응답의 `temperatureType`이 `"ICE"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-02 · temperatureType을 생략하면 HOT이 기본값이다

- **Given** 인증된 사용자
- **When** `temperatureType` 없이 `POST /recipes`
- **Then** HTTP `201`, 응답의 `temperatureType`이 `"HOT"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-03 · recommendedRoastLevel을 지정해 레시피를 만들 수 있다

- **Given** 인증된 사용자
- **When** `recommendedRoastLevel: "DARK"`로 `POST /recipes`
- **Then** HTTP `201`, 응답의 `recommendedRoastLevel`이 `"DARK"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-04 · recommendedRoastLevel을 생략하면 MEDIUM이 기본값이다

- **Given** 인증된 사용자
- **When** `recommendedRoastLevel` 없이 `POST /recipes`
- **Then** HTTP `201`, 응답의 `recommendedRoastLevel`이 `"MEDIUM"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-05 · PATCH로 temperatureType만 수정할 수 있다

- **Given** `temperatureType: "HOT"`인 내 레시피
- **When** `{"temperatureType": "ICE"}`만 담아 `PATCH /recipes/{id}`
- **Then** HTTP `200`, 응답의 `temperatureType`이 `"ICE"`이고 다른 필드는 그대로
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-06 · PATCH로 recommendedRoastLevel만 수정할 수 있다

- **Given** `recommendedRoastLevel: "MEDIUM"`인 내 레시피
- **When** `{"recommendedRoastLevel": "LIGHT"}`만 담아 `PATCH /recipes/{id}`
- **Then** HTTP `200`, 응답의 `recommendedRoastLevel`이 `"LIGHT"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-07 · 포크가 0건이면 savedCount는 0이다

- **Given** 아무도 포크하지 않은 내 레시피 R
- **When** `GET /recipes/{R.id}`
- **Then** 응답의 `savedCount`가 `0`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-08 · 포크한 사람 수만큼 savedCount가 늘어난다

- **Given** 레시피 R을 사용자 A와 B가 각각 담기(포크)했다
- **When** `GET /recipes/{R.id}`
- **Then** 응답의 `savedCount`가 `2`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-09 · 포크본을 삭제하면 원본의 savedCount가 즉시 줄어든다

- **Given** 레시피 R을 A가 포크해 `savedCount`가 `1`이다
- **When** A가 자기 포크본을 `DELETE`(소프트 삭제)한 뒤 `GET /recipes/{R.id}`
- **Then** 응답의 `savedCount`가 `0`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-10 · 소유자가 자기 레시피로 낸 잔 수만큼 brewCount가 늘어난다

- **Given** 사용자 A가 소유한 레시피 R로 A가 잔 3건을 만들었다
- **When** `GET /recipes/{R.id}`
- **Then** 응답의 `brewCount`가 `3`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-11 · 남이 바로 내린 잔은 원본의 brewCount에 잡히지 않는다

- **Given** 사용자 A가 소유한 `PUBLIC` 레시피 R
- **When** 사용자 B가 R을 담지 않고 `recipeId=R.id`로 `POST /brew-logs`
- **Then** HTTP `201`이고, 그 뒤 `GET /recipes/{R.id}`의 `brewCount`는 브루잉 전과 같다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-12 · CURATED 레시피를 포크하면 sourceAuthorName이 authorName이 된다

- **Given** `sourceType: CURATED`, `authorName: "James Hoffmann"`인 레시피 R
- **When** 사용자 A가 R을 포크
- **Then** 포크본의 `sourceAuthorName`이 `"James Hoffmann"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-13 · USER 소유 레시피를 포크하면 sourceAuthorName이 그 시점 소유자 닉네임이다

- **Given** 닉네임이 `"지연"`인 사용자 B가 소유한 레시피 R
- **When** 사용자 A가 R을 포크
- **Then** 포크본의 `sourceAuthorName`이 `"지연"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-14 · 포크 후 원본 소유자가 닉네임을 바꿔도 sourceAuthorName은 그대로다

- **Given** AC-RECIPEV2-13처럼 포크된 레시피(`sourceAuthorName: "지연"`)
- **When** B가 닉네임을 `"지연2"`로 바꾼 뒤 포크본을 다시 조회
- **Then** 포크본의 `sourceAuthorName`은 여전히 `"지연"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-15 · 내 소유 레시피로 브루잉하면 recipeId가 그대로 저장된다

- **Given** 사용자 A가 소유한 레시피 R
- **When** A가 `recipeId=R.id`로 `POST /brew-logs`
- **Then** 응답의 `recipeId`가 `R.id`
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-RECIPEV2-16 · 남의 PUBLIC 레시피로 브루잉하면 성공하되 recipeId는 null로 저장된다

- **Given** 사용자 B가 소유한 `PUBLIC` 레시피 R (A는 담지 않음)
- **When** 사용자 A가 `recipeId=R.id`로 `POST /brew-logs`
- **Then** HTTP `201`, 응답의 `recipeId`가 `null`이고 `recipeSnapshot`이 채워져 있다
- **검증** API 테스트 `BrewLogControllerTest` (기존 `AC-BREW-32`를 대체)

#### AC-RECIPEV2-17 · 맞팔로우 상대의 FRIENDS 레시피로도 바로 내릴 수 있다

- **Given** 사용자 A와 B가 맞팔로우 상태이고, B 소유의 `FRIENDS` 레시피 R이 있다 (A는 담지 않음)
- **When** A가 `recipeId=R.id`로 `POST /brew-logs`
- **Then** HTTP `201`, 응답의 `recipeId`가 `null`
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-RECIPEV2-18 · recipeSnapshot.doseG는 브루 시점 레시피의 doseG와 같다

- **Given** `doseG: 15.0`인 레시피 R
- **When** `recipeId=R.id`로 `POST /brew-logs`
- **Then** 응답의 `recipeSnapshot.doseG`가 `15.0`
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-RECIPEV2-19 · 레시피를 나중에 수정해도 기존 잔의 recipeSnapshot은 불변이다

- **Given** `doseG: 15.0`인 레시피 R로 만든 잔 L (`recipeSnapshot.doseG == 15.0`)
- **When** R의 `doseG`를 `16.0`으로 수정한 뒤 `GET /brew-logs/{L.id}`
- **Then** 응답의 `recipeSnapshot.doseG`는 여전히 `15.0`
- **검증** API 테스트 `BrewLogControllerTest` (설계 핵심 회귀 — `backend/CLAUDE.md`의 스냅샷
  불변성 규칙 확장)

#### AC-RECIPEV2-20 · recipeSnapshot.steps는 브루 시점 recipe_steps를 순서대로 담는다

- **Given** 스텝이 2개(BLOOM, POUR 순서)인 레시피 R
- **When** `recipeId=R.id`로 `POST /brew-logs`
- **Then** 응답의 `recipeSnapshot.steps`가 길이 `2`이고 `[0].type == "BLOOM"`, `[1].type == "POUR"`
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-RECIPEV2-21 · recipeSnapshot.grindValue는 {value, unit} 구조다

- **Given** `grindSettingValue: 22.0`, `grindSettingUnit: CLICK`인 레시피 R
- **When** `recipeId=R.id`로 `POST /brew-logs`
- **Then** 응답의 `recipeSnapshot.grindValue`가 `{"value": 22.0, "unit": "CLICK"}`
- **검증** API 테스트 `BrewLogControllerTest`

### 경계값

#### AC-RECIPEV2-30 · recommendedRoastLevel에 5단계 값을 보내면 거절한다

- **Given** 인증된 사용자
- **When** `recommendedRoastLevel: "MEDIUM_LIGHT"`(`catalog.RoastLevel`의 5단계 값)로 `POST /recipes`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-31 · 마이그레이션 직후 기존 레시피는 전부 HOT/MEDIUM이다

- **Given** 마이그레이션 적용 전에 만들어진 레시피(N건)
- **When** 마이그레이션 적용 후 그 레시피들을 조회
- **Then** 전부 `temperatureType == "HOT"`이고 `recommendedRoastLevel == "MEDIUM"`
- **검증** 통합 테스트 `RecipeMigrationTest` (Flyway 마이그레이션 자체를 대상)

#### AC-RECIPEV2-32 · 마이그레이션 직후 기존 잔은 전부 recipeSnapshot이 채워져 있다

- **Given** 마이그레이션 적용 전에 만들어진 브루로그(N건, 모두 `recipe_id NOT NULL`이던 시절 데이터)
- **When** 마이그레이션 적용 후 그 브루로그들을 조회
- **Then** 전부 `recipeSnapshot`이 `null`이 아니고, `recipeSnapshot.doseG`가 그 시점 참조하던
  레시피의 `doseG`와 같다
- **검증** 통합 테스트 `BrewLogMigrationTest`

### 에러

#### AC-RECIPEV2-40 · 잘못된 temperatureType은 400이다

- **Given** 인증된 사용자
- **When** `temperatureType: "WARM"`으로 `POST /recipes`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPEV2-41 · recipeId를 생략하면 여전히 400이다

- **Given** 인증된 사용자
- **When** `recipeId` 없이 `POST /brew-logs`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"` (기존 규칙 유지 — nullable 전환은 저장값에만
  적용되고 요청 필드 자체는 여전히 필수다)
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-RECIPEV2-42 · 가시성이 없는 남의 레시피를 가리키면 여전히 403이다

- **Given** 사용자 B가 소유한 `PRIVATE` 레시피 R
- **When** 사용자 A가 `recipeId=R.id`로 `POST /brew-logs`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`
- **검증** API 테스트 `BrewLogControllerTest` (`AC-BREW-32`를 대체 — 조건이 "남의 것"에서
  "가시성 없음"으로 바뀐다)

#### AC-RECIPEV2-43 · 존재하지 않는 recipeId는 여전히 404다

- **Given** 인증된 사용자
- **When** `recipeId=999999`로 `POST /brew-logs`
- **Then** HTTP `404`와 `code: "NOT_FOUND"` (기존 `AC-BREW-31` 그대로)
- **검증** API 테스트 `BrewLogControllerTest`

---

## 수동 확인

없음. 전부 자동화 가능하다.

## 열어둔 결정

- **없음.** 이번 스펙의 범위 안에서는 미룬 결정이 없다. `savedCount`/`brewCount`의 목록 API
  성능 설계와 검색·필터·정렬 API 자체는 다음 스펙에서 새로 인터뷰한다.

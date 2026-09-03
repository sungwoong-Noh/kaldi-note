---
id: LIST
title: 목록 조회 API + 브루잉 로그 수정·삭제
status: 구현완료
plan: docs/plans/2026-08-19-plan-list-query.md
---

# 목록 조회 API + 브루잉 로그 수정·삭제 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

**이 스펙은 AC 접두사를 셋 쓴다** — `AC-LIST-nn`(목록 조회), `AC-BLEDIT-nn`(브루잉 로그 수정·삭제), `AC-ME-nn`(내 프로필·내 그라인더). 세 기능이 "프론트엔드가 화면을 그리려면 반드시 있어야 하는 것"이라는 하나의 이유로 묶인다. `check-spec-coverage.sh`의 패턴(`AC-[A-Z][A-Z0-9_]*-[0-9]+`)이 셋 다 잡는다.

## 무엇을

사용자가 레시피와 브루잉 로그를 **목록으로** 훑고, 이미 남긴 브루잉 로그를 **고치거나 지운다.**

지금 서버에는 목록 조회가 없다. 레시피도 브루잉 로그도 `id`를 이미 아는 경우에만 열 수 있다. 이 스펙은 두 도메인에 페이지네이션이 붙은 목록 엔드포인트를 추가하고, 단건 조회에만 적용되던 공개범위 판정 규칙을 목록 전체로 확장한다. 함께 브루잉 로그의 부분 수정(`PATCH`)과 소프트 삭제(`DELETE`)를 만들고, 프론트가 헤더와 폼을 그리는 데 필요한 `GET /users/me`·`GET /gear/user-grinders`를 추가한다.

### 범위 밖 (Non-goals)

- **커서 기반 페이지네이션.** 오프셋의 약점(스크롤 중 항목이 삽입되면 중복이 보인다)은 사용자가 3명 규모인 지금 실현되지 않는다. 응답 봉투에 `hasNext`를 두었으므로 나중에 커서로 바꿔도 프론트의 무한 스크롤 로직은 그대로 쓸 수 있다.
- **`sort` 파라미터.** 정렬은 서버가 정한 한 가지로 고정한다. 나중에 파라미터를 추가하는 것은 기존 호출을 깨지 않는 순수 확장이다.
- **`PATCH`의 값 지우기.** `null`은 언제나 "변경 없음"이다. 이미 넣은 `tdsPercent`를 다시 `null`로 되돌릴 수는 없다. 잘못 넣었으면 올바른 값으로 고치거나 로그를 삭제한다. `JsonNullable` 도입은 Jackson 3 패키지 재편(`backend/CLAUDE.md`의 함정 2번)과 얽히므로 감수할 이유가 없다.
- **`recipeId`·`beanBatchId` 변경.** 수정 요청 DTO에 아예 넣지 않는다. 이 둘을 바꾸면 `actualDoseG` 이하의 실측 스냅샷이 어떤 레시피·어떤 원두의 기록인지 알 수 없게 된다. 잘못 골랐으면 삭제하고 다시 쓴다.
- **검색·랭킹 피드.** `docs/design/2026-08-14-architecture.md:263`이 MVP 비목표로 못박은 것이다. 이번 목록은 제목 검색도, 정렬 선택도, 추천도 제공하지 않는다. 필터만 있다.
- **팔로워/팔로잉 목록 조회.** `docs/specs/2026-08-17-visibility-authorization.md`의 비목표를 그대로 유지한다.
- **레시피 수정·삭제 API 변경.** `PUT`/`DELETE /api/v1/recipes/{id}`는 손대지 않는다.
- **레시피 목록의 `steps`.** 목록 응답에는 푸어 스텝을 담지 않는다. 스텝이 필요하면 단건 조회를 부른다.

## 왜

**`FRIENDS` 공개범위가 지금 도달 불가능한 상태다.** `visibility` 스펙이 상호 팔로우 판정을 구현했지만, 상대의 레시피 `id`를 알아낼 방법이 서버에 없다. 핵심 시나리오(`docs/design/2026-08-14-architecture.md:253`)의 6단계 "여자친구 계정으로 로그인해 FRIENDS 레시피 조회"는 SQL을 직접 치지 않는 한 실행되지 않는다. 같은 이유로 시드 CURATED 레시피(Hoffmann V60, Kasuya 4:6)도 포크할 수 없다 — 5단계 "Kasuya 4:6 시드 레시피 포크"에 도달할 경로가 없다.

**같은 레시피를 여러 번 내렸을 때의 결과 차이를 볼 수 없다.** 이것이 Recipe와 BrewLog를 분리한 이유(`CLAUDE.md`의 설계 결정 1번)인데, `recipeId`로 로그를 모아 보는 수단이 없어 분리의 효용이 실현되지 않는다.

**브루잉 로그를 고칠 수 없다.** 커피는 내리고 나서 식혀 마시며 평가한다. 지금은 관능 평가를 나중에 채우려면 로그를 처음부터 다시 써야 한다. TDS도 마찬가지다 — 리프랙토미터는 추출 직후가 아니라 잔이 식은 뒤에 재는 경우가 많다.

목록·수정 API는 세 스펙이 각각 "후속 스펙 몫"으로 명시해 미뤄둔 것이다(`recipe-crud.md:20`, `brew-log.md:20`, `visibility-authorization.md:25`). 선행 조건인 공개범위 판정이 구현 완료됐으므로 이 스펙이 그 후속이다.

## 용어

| 용어 | 정의 |
|---|---|
| 볼 수 있는 레시피 | `visibility` 스펙의 조회 인가 판정(소유자 → `PUBLIC` → `FRIENDS`+상호 팔로우)을 통과하는 레시피. 목록은 이 판정을 통과한 것만 담는다 |
| 요약 응답 | 목록 항목용 DTO. 단건 응답에서 무거운 필드만 덜어낸 것. 레시피는 `steps`, 브루잉 로그는 `overallNote`를 뺀다 |
| 페이지 봉투 | `PageResponse<T>`. `content`/`page`/`size`/`totalElements`/`totalPages`/`hasNext` 여섯 키만 갖는다 |
| 조회 시점 계산 필드 | DB에 없고 응답을 만들 때마다 계산하는 값. `brewRatio`, `extractionYieldPercent`, `strengthZone`, `extractionZone`, `diagnosis`가 여기 해당한다 |

## 데이터

`brew_logs`에 소프트 삭제 컬럼 하나만 추가한다. 나머지 엔드포인트는 스키마 변경이 없다.

**`V10__add_brew_logs_deleted_at.sql`**

| 테이블 | 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|---|
| `brew_logs` | `deleted_at` | `TIMESTAMPTZ` | O | `NULL`이면 살아 있는 기록. `recipes`·`bean_batches`와 같은 소프트 삭제 패턴 |

`recipes.deleted_at`과 동일하게 **부분 인덱스**를 둔다. 목록 조회가 항상 `deleted_at IS NULL`로 필터하기 때문이다.

목록 정렬을 뒷받침하는 인덱스도 함께 만든다.

| 인덱스 | 대상 | 이유 |
|---|---|---|
| `idx_brew_logs_alive` | `brew_logs (brewed_at DESC, id DESC) WHERE deleted_at IS NULL` | 목록 기본 정렬 |
| `idx_recipes_alive` | `recipes (created_at DESC, id DESC) WHERE deleted_at IS NULL` | 목록 기본 정렬 |

> **기존 동작이 바뀐다.** `GET /api/v1/brew-logs/{id}`에 `deleted_at IS NULL` 조건이 붙는다. `docs/specs/2026-08-17-brew-log.md`의 단건 조회 동작 변경이며, 그 스펙에 정정 주석을 남긴다.

## API

| 메서드 | 경로 | 인증 | 성공 상태 | 설명 |
|---|---|---|---|---|
| GET | `/api/v1/recipes` | 필요 | 200 | 볼 수 있는 레시피 목록 (페이지 봉투) |
| GET | `/api/v1/brew-logs` | 필요 | 200 | 볼 수 있는 브루잉 로그 목록 (페이지 봉투) |
| PATCH | `/api/v1/brew-logs/{id}` | 필요 | 200 | 브루잉 로그 부분 수정 (소유자 전용) |
| DELETE | `/api/v1/brew-logs/{id}` | 필요 | 204 | 브루잉 로그 소프트 삭제 (소유자 전용) |
| GET | `/api/v1/users/me` | 필요 | 200 | 내 프로필 |
| GET | `/api/v1/gear/user-grinders` | 필요 | 200 | 내 그라인더 목록 (배열, 페이지 봉투 아님) |

**검증 순서:** `401`(미인증) → `404`(대상 없음 / 소프트 삭제됨) → `403`(권한 없음) → `400`(필드 검증). 기존 스펙과 같다.

> **null 필드는 응답에서 생략된다.** `application.yml`의 `default-property-inclusion: non_null` 설정 때문이다. 아래 인수 조건에서 "`X`가 없다"는 **키 자체가 응답 JSON에 존재하지 않는다**는 뜻이며, `"X": null`이 내려오는 것이 아니다.

### 쿼리 파라미터

**공통 (`GET /recipes`, `GET /brew-logs`)**

| 이름 | 타입 | 기본값 | 허용 범위 | 초과 시 |
|---|---|---|---|---|
| `page` | `int` | `0` | `0` 이상 | `400 INVALID_REQUEST` |
| `size` | `int` | `20` | `1` 이상 `100` 이하 (양끝 포함) | `400 INVALID_REQUEST` |

**`GET /recipes` 전용**

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `ownerUserId` | `Long` | X | 지정하면 그 사용자가 소유한 레시피만. 생략하면 필터 없음 |

**`GET /brew-logs` 전용**

| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `recipeId` | `Long` | X | 그 레시피로 내린 기록만 |
| `userId` | `Long` | X | 그 사용자가 남긴 기록만 |
| `beanBatchId` | `Long` | X | 그 원두 봉지로 내린 기록만 |

세 필터는 함께 쓸 수 있고 `AND`로 결합한다.

**필터 값이 존재하지 않거나 볼 수 없는 대상을 가리켜도 `404`·`403`을 내지 않고 `200`과 빈 목록을 반환한다.** `id`를 바꿔가며 요청해 타인의 비공개 레시피 존재 여부를 알아내는 것을 막기 위해서다.

### 정렬

| 엔드포인트 | 정렬 | 2차 기준 |
|---|---|---|
| `GET /recipes` | `created_at DESC` | `id DESC` |
| `GET /brew-logs` | `brewed_at DESC` | `id DESC` |

2차 기준은 생략할 수 없다. 같은 시각에 만들어진 두 건이 있을 때 PostgreSQL이 순서를 보장하지 않아 페이지를 넘길 때 중복·누락이 생긴다.

### 목록 범위 판정

`GET /recipes`와 `GET /brew-logs` 모두 `visibility` 스펙의 단건 판정 규칙을 그대로 확장한다. 호출자를 `viewer`라 할 때 다음 중 **하나라도** 참인 행만 담는다.

1. 소유자 id가 `viewer`와 같다
2. `visibility == PUBLIC`
3. `visibility == FRIENDS` **그리고** `existsMutualFollow(viewer, 소유자)`

소유자 id가 `NULL`인 CURATED 시드 레시피는 1·3을 통과할 수 없고 2로만 들어온다. 판정은 요청 시점에 실시간으로 하며 캐시하지 않는다.

### 요청 / 응답 예시

**레시피 목록**

```
GET /api/v1/recipes?page=0&size=20
Authorization: Bearer <토큰>
```

```json
{
  "content": [
    {
      "id": 12,
      "ownerUserId": 3,
      "sourceType": "USER",
      "title": "Kasuya 4:6 — 산미 강조 조정",
      "description": "1차 푸어를 늘려 단맛보다 산미를 세게",
      "brewMethod": "POUR_OVER",
      "visibility": "FRIENDS",
      "parentRecipeId": 2,
      "forkRootId": 2,
      "doseG": 20.0,
      "waterG": 300.0,
      "ratio": 15.0,
      "waterTempC": 92.0,
      "totalTimeSeconds": 210,
      "brewerId": 1,
      "filterId": 1,
      "grinderModelId": 7,
      "grindSettingValue": 22.0,
      "grindSettingUnit": "CLICK",
      "grindMicronEstimated": 660,
      "createdAt": "2026-08-19T02:11:04Z",
      "updatedAt": "2026-08-19T02:11:04Z"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 47,
  "totalPages": 3,
  "hasNext": true
}
```

`RecipeSummaryResponse`는 `RecipeResponse`에서 **`steps`만 제외**한 22개 필드다.

**브루잉 로그 목록**

```
GET /api/v1/brew-logs?recipeId=12&size=20
Authorization: Bearer <토큰>
```

`BrewLogSummaryResponse`는 `BrewLogResponse`에서 **`overallNote`만 제외**한 30개 필드다. `brewRatio`·`extractionYieldPercent`·`strengthZone`·`extractionZone`·`diagnosis`는 목록에서도 계산해 담는다. TDS가 없는 기록은 이 다섯이 `null`이다.

**브루잉 로그 수정**

```
PATCH /api/v1/brew-logs/31
Authorization: Bearer <토큰>
```

```json
{
  "rating": 4.0,
  "acidity": 4,
  "tdsPercent": 1.35
}
```

보내지 않은 필드는 바뀌지 않는다. 요청 DTO가 받는 필드는 다음 18개뿐이다.

| 그룹 | 필드 |
|---|---|
| 관능 평가 (7) | `rating`, `acidity`, `sweetness`, `body`, `bitterness`, `aftertaste`, `overallNote` |
| 실측값 (9) | `actualDoseG`, `actualWaterG`, `actualWaterTempC`, `actualTotalTimeSeconds`, `actualDrawdownSeconds`, `userGrinderId`, `actualGrindSettingValue`, `beverageWeightG`, `tdsPercent` |
| 시각 (1) | `brewedAt` |
| 공개범위 (1) | `visibility` |

`recipeId`·`beanBatchId`는 DTO에 없으므로 요청에 담아도 무시된다.

### 수정 시 재계산

| 바뀐 필드 | 다시 계산되는 것 | 어디서 |
|---|---|---|
| `userGrinderId`, `actualGrindSettingValue` | `actualGrindMicronEstimated` | **DB 컬럼.** 수정 시 실제로 다시 계산해 저장한다 |
| `brewedAt` | `daysOffRoast`, `degassingStatus` | **DB 컬럼.** 원두 재고의 `roastedAt`과 새 `brewedAt`으로 다시 계산해 저장한다 |
| `actualDoseG`, `beverageWeightG`, `tdsPercent` | `brewRatio`, `extractionYieldPercent`, `strengthZone`, `extractionZone`, `diagnosis` | **DB에 없다.** 조회할 때마다 `extraction` 도메인으로 계산하므로(`BrewLogResponse` 주석) 저장된 실측값만 바꾸면 자동으로 따라온다 |

`daysOffRoast` 재계산 시 원두 재고가 이미 삭제됐다면 **기존 값을 그대로 둔다.** 재고를 지워도 과거 기록의 `daysOffRoast`가 남아야 한다는 필수 회귀 테스트(`backend/CLAUDE.md`)를 깨지 않기 위해서다.

> **`visibility` 스펙의 결정을 하나 뒤집는다.** `docs/specs/2026-08-17-visibility-authorization.md`는 "`visibility`는 생성 시점에만 정한다. 만든 뒤 공개로 전환할 수 없다"고 적었다. 이 스펙은 `PATCH`로 변경을 허용한다. 근거: 사용자는 일단 `PRIVATE`로 기록해 두었다가 마음에 드는 결과만 친구에게 여는 방식을 기대하며, 그러지 못하면 로그를 지우고 다시 쓰게 된다. 해당 스펙에 정정 주석을 남긴다.

---

## 어떻게 동작 — 인수 조건

### 페이지네이션 (공통)

아래 조건은 `GET /recipes`와 `GET /brew-logs` 양쪽에서 검증한다.

#### AC-LIST-01 · size를 생략하면 20개를 반환한다

- **Given** 볼 수 있는 레시피가 25건 있다
- **When** `GET /api/v1/recipes` (파라미터 없음)
- **Then** HTTP `200`, `content` 길이가 `20`, `size`가 `20`, `page`가 `0`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-02 · size=100은 허용한다 (상한 포함)

- **Given** 볼 수 있는 레시피가 3건 있다
- **When** `GET /api/v1/recipes?size=100`
- **Then** HTTP `200`, `size`가 `100`, `content` 길이가 `3`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-03 · size=1은 허용한다 (하한 포함)

- **Given** 볼 수 있는 레시피가 3건 있다
- **When** `GET /api/v1/recipes?size=1`
- **Then** HTTP `200`, `content` 길이가 `1`, `totalElements`가 `3`, `totalPages`가 `3`, `hasNext`가 `true`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-04 · page=0이 첫 페이지다

- **Given** 볼 수 있는 레시피가 3건 있고 `createdAt`이 서로 다르다
- **When** `GET /api/v1/recipes?page=0&size=1`
- **Then** `content[0].id`가 가장 최근에 만들어진 레시피의 `id`와 같다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-05 · 첫 페이지의 봉투 값이 정확하다

- **Given** 볼 수 있는 레시피가 47건 있다
- **When** `GET /api/v1/recipes?page=0&size=20`
- **Then** `content` 길이 `20`, `page` `0`, `size` `20`, `totalElements` `47`, `totalPages` `3`, `hasNext` `true`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-06 · 마지막 페이지에서 hasNext가 false다

- **Given** 볼 수 있는 레시피가 47건 있다
- **When** `GET /api/v1/recipes?page=2&size=20`
- **Then** `content` 길이 `7`, `page` `2`, `totalPages` `3`, `hasNext` `false`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-07 · 응답 봉투는 여섯 키만 갖는다

- **Given** 볼 수 있는 레시피가 1건 있다
- **When** `GET /api/v1/recipes`
- **Then** 최상위 JSON 키 집합이 정확히 `["content","page","size","totalElements","totalPages","hasNext"]`다. `pageable`·`sort`·`empty`·`numberOfElements`·`first`·`last`·`number` 키는 존재하지 않는다
- **검증** API 테스트 `RecipeControllerTest`

### 레시피 목록 — 공개범위

#### AC-LIST-08 · 내 PRIVATE 레시피는 목록에 포함된다

- **Given** 사용자 A가 소유한 `visibility: PRIVATE` 레시피가 1건 있다
- **When** A가 `GET /api/v1/recipes`
- **Then** HTTP `200`, `content`에 그 레시피의 `id`가 있다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-09 · 타인의 PRIVATE 레시피는 제외된다

- **Given** 사용자 B가 소유한 `visibility: PRIVATE` 레시피가 1건 있고, A와 B는 아무 팔로우 관계가 없다
- **When** A가 `GET /api/v1/recipes`
- **Then** `content`에 그 레시피의 `id`가 없고 `totalElements`에도 포함되지 않는다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-10 · 타인의 PUBLIC 레시피는 포함된다

- **Given** 사용자 B가 소유한 `visibility: PUBLIC` 레시피가 1건 있고, A와 B는 아무 팔로우 관계가 없다
- **When** A가 `GET /api/v1/recipes`
- **Then** `content`에 그 레시피의 `id`가 있다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-11 · 상호 팔로우 상대의 FRIENDS 레시피는 포함된다

- **Given** 사용자 B가 소유한 `visibility: FRIENDS` 레시피가 1건 있고, `follows`에 `(A→B)`와 `(B→A)`가 모두 있다
- **When** A가 `GET /api/v1/recipes`
- **Then** `content`에 그 레시피의 `id`가 있다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-12 · 단방향 팔로우 상대의 FRIENDS 레시피는 제외된다

- **Given** 사용자 B가 소유한 `visibility: FRIENDS` 레시피가 1건 있고, `follows`에 `(A→B)`만 있다
- **When** A가 `GET /api/v1/recipes`
- **Then** `content`에 그 레시피의 `id`가 없다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-13 · 주인 없는 CURATED 시드 레시피는 포함된다

- **Given** `owner_user_id IS NULL`이고 `visibility: PUBLIC`, `source_type: CURATED`인 레시피가 1건 있다
- **When** A가 `GET /api/v1/recipes`
- **Then** `content`에 그 레시피의 `id`가 있고 `ownerUserId` 키는 응답에 존재하지 않는다(null 생략)
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-14 · 소프트 삭제된 레시피는 제외된다

- **Given** 사용자 A가 소유한 레시피 1건의 `deleted_at`이 `null`이 아니다
- **When** A가 `GET /api/v1/recipes`
- **Then** `content`에 그 레시피의 `id`가 없고 `totalElements`가 `0`이다
- **검증** API 테스트 `RecipeControllerTest`

### 레시피 목록 — 정렬·필터·응답 형태

#### AC-LIST-15 · createdAt이 같으면 id 내림차순으로 나온다

- **Given** 사용자 A가 소유하고 `created_at`이 동일한 레시피 2건의 `id`가 각각 `100`, `101`이다
- **When** A가 `GET /api/v1/recipes`
- **Then** `content[0].id`가 `101`, `content[1].id`가 `100`이다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-16 · ownerUserId 필터가 소유자를 좁힌다

- **Given** A 소유 레시피 2건과 B 소유 `PUBLIC` 레시피 1건이 있다
- **When** A가 `GET /api/v1/recipes?ownerUserId=<A의 id>`
- **Then** `totalElements`가 `2`이고 `content`의 모든 항목의 `ownerUserId`가 A의 `id`다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-17 · 목록 응답에 steps 키가 없다

- **Given** 푸어 스텝 3개를 가진 레시피가 1건 있다
- **When** A가 `GET /api/v1/recipes`
- **Then** `content[0]`에 `steps` 키가 존재하지 않고, `title`·`doseG`·`ratio`는 존재한다
- **검증** API 테스트 `RecipeControllerTest`

### 브루잉 로그 목록

#### AC-LIST-18 · 타인의 PRIVATE 로그는 제외된다

- **Given** 사용자 B가 남긴 `visibility: PRIVATE` 브루잉 로그가 1건 있고, A와 B는 아무 팔로우 관계가 없다
- **When** A가 `GET /api/v1/brew-logs`
- **Then** `content`에 그 로그의 `id`가 없다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-LIST-19 · 상호 팔로우 상대의 FRIENDS 로그는 포함된다

- **Given** 사용자 B가 남긴 `visibility: FRIENDS` 로그가 1건 있고, `follows`에 `(A→B)`와 `(B→A)`가 모두 있다
- **When** A가 `GET /api/v1/brew-logs`
- **Then** `content`에 그 로그의 `id`가 있다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-LIST-20 · recipeId 필터가 해당 레시피의 기록만 남긴다

- **Given** A가 레시피 `12`로 내린 로그 3건과 레시피 `13`으로 내린 로그 2건이 있다
- **When** A가 `GET /api/v1/brew-logs?recipeId=12`
- **Then** `totalElements`가 `3`이고 모든 항목의 `recipeId`가 `12`다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-LIST-21 · userId 필터가 해당 사용자의 기록만 남긴다

- **Given** A의 로그 2건과 B의 `PUBLIC` 로그 1건이 있다
- **When** A가 `GET /api/v1/brew-logs?userId=<B의 id>`
- **Then** `totalElements`가 `1`이고 그 항목의 `userId`가 B의 `id`다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-LIST-22 · beanBatchId 필터가 해당 봉지의 기록만 남긴다

- **Given** A가 원두 배치 `5`로 내린 로그 2건과 배치 `6`으로 내린 로그 1건이 있다
- **When** A가 `GET /api/v1/brew-logs?beanBatchId=5`
- **Then** `totalElements`가 `2`이고 모든 항목의 `beanBatchId`가 `5`다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-LIST-23 · 필터를 함께 쓰면 AND로 결합한다

- **Given** A가 (레시피 `12`, 배치 `5`)로 내린 로그 1건, (레시피 `12`, 배치 `6`)로 내린 로그 1건이 있다
- **When** A가 `GET /api/v1/brew-logs?recipeId=12&beanBatchId=5`
- **Then** `totalElements`가 `1`이다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-LIST-24 · brewedAt 내림차순으로 나오고 동점이면 id 내림차순이다

- **Given** A의 로그 3건의 `brewed_at`이 각각 `2026-08-17T00:00:00Z`, `2026-08-18T00:00:00Z`, `2026-08-18T00:00:00Z`(id `200`, `201`)이다
- **When** A가 `GET /api/v1/brew-logs`
- **Then** `content`의 `id` 순서가 `[201, 200, <8월 17일 건>]`이다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-LIST-25 · 목록 응답에 overallNote 키가 없다

- **Given** `overallNote`가 채워진 로그가 1건 있다
- **When** A가 `GET /api/v1/brew-logs`
- **Then** `content[0]`에 `overallNote` 키가 존재하지 않고, `rating`·`actualDoseG`는 존재한다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-LIST-26 · TDS가 없는 로그도 목록에 나오고 분석 필드가 null이다

- **Given** A의 로그 1건의 `tds_percent`가 `null`이다
- **When** A가 `GET /api/v1/brew-logs`
- **Then** `content[0]`에 `extractionYieldPercent`·`strengthZone` 키가 존재하지 않고(null 생략) `brewRatio`는 존재한다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-LIST-27 · 소프트 삭제된 로그는 목록에서 제외된다

- **Given** A의 로그 2건 중 1건의 `deleted_at`이 `null`이 아니다
- **When** A가 `GET /api/v1/brew-logs`
- **Then** `totalElements`가 `1`이다
- **검증** API 테스트 `BrewLogControllerTest`

### 경계값

#### AC-LIST-28 · size=101은 거절한다 (상한 바로 바깥)

- **Given** 인증된 사용자 A
- **When** `GET /api/v1/recipes?size=101`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-29 · size=0은 거절한다 (하한 바로 바깥)

- **Given** 인증된 사용자 A
- **When** `GET /api/v1/recipes?size=0`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-30 · page=-1은 거절한다

- **Given** 인증된 사용자 A
- **When** `GET /api/v1/recipes?page=-1`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-31 · page가 전체 페이지 수를 넘으면 빈 content를 반환한다

- **Given** 볼 수 있는 레시피가 47건 있다
- **When** `GET /api/v1/recipes?page=99&size=20`
- **Then** HTTP `200`, `content`가 빈 배열, `totalElements`가 `47`, `totalPages`가 `3`, `hasNext`가 `false`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-32 · 볼 수 있는 것이 하나도 없으면 빈 목록을 반환한다

- **Given** 레시피가 하나도 없다
- **When** A가 `GET /api/v1/recipes`
- **Then** HTTP `200`, `content`가 빈 배열, `totalElements`가 `0`, `totalPages`가 `0`, `hasNext`가 `false`
- **검증** API 테스트 `RecipeControllerTest`

### 에러

#### AC-LIST-33 · 존재하지 않는 ownerUserId는 빈 목록이다

- **Given** `id`가 `999999`인 사용자는 없다
- **When** A가 `GET /api/v1/recipes?ownerUserId=999999`
- **Then** HTTP `200`, `content`가 빈 배열이다. `404`가 아니다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-34 · 볼 수 없는 레시피 id로 필터해도 빈 목록이다

- **Given** 사용자 B가 소유한 `visibility: PRIVATE` 레시피 `77`이 존재하고, A와 B는 아무 팔로우 관계가 없다
- **When** A가 `GET /api/v1/brew-logs?recipeId=77`
- **Then** HTTP `200`, `content`가 빈 배열이다. `403`도 `404`도 아니다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-LIST-35 · JWT 없이 레시피 목록을 부르면 401이다

- **Given** `Authorization` 헤더가 없다
- **When** `GET /api/v1/recipes`
- **Then** HTTP `401`과 `code: "UNAUTHORIZED"`를 반환한다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-LIST-36 · JWT 없이 브루잉 로그 목록을 부르면 401이다

- **Given** `Authorization` 헤더가 없다
- **When** `GET /api/v1/brew-logs`
- **Then** HTTP `401`과 `code: "UNAUTHORIZED"`를 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

---

### 브루잉 로그 수정

#### AC-BLEDIT-01 · 보낸 필드만 바뀐다

- **Given** A의 로그 `31`이 `rating: 3.0`, `actualDoseG: 15.0`, `overallNote: "묽다"`다
- **When** A가 `PATCH /api/v1/brew-logs/31`에 `{"rating": 4.0}`
- **Then** HTTP `200`, `rating`이 `4.0`, `actualDoseG`가 `15.0`, `overallNote`가 `"묽다"`로 그대로다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-02 · 생략한 필드는 null로 지워지지 않는다

- **Given** A의 로그 `31`의 `tdsPercent`가 `1.35`다
- **When** A가 `PATCH /api/v1/brew-logs/31`에 `{"rating": 4.0}` (`tdsPercent` 키 없음)
- **Then** HTTP `200`, `tdsPercent`가 여전히 `1.35`다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-03 · 명시적 null도 변경 없음으로 취급한다

- **Given** A의 로그 `31`의 `tdsPercent`가 `1.35`다
- **When** A가 `PATCH /api/v1/brew-logs/31`에 `{"tdsPercent": null}`
- **Then** HTTP `200`, `tdsPercent`가 여전히 `1.35`다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-04 · TDS를 넣으면 추출 수율이 계산되어 응답에 나온다

- **Given** A의 로그 `31`이 `actualDoseG: 15.0`, `beverageWeightG: 250.0`, `tdsPercent: null`이고 응답의 `extractionYieldPercent`가 `null`이다
- **When** A가 `PATCH /api/v1/brew-logs/31`에 `{"tdsPercent": 1.35}`
- **Then** HTTP `200`, `extractionYieldPercent`가 `22.5`, `extractionZone`이 `"OVER"`다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-05 · 음료 중량을 바꾸면 추출 수율이 따라 바뀐다

- **Given** A의 로그 `31`이 `actualDoseG: 15.0`, `beverageWeightG: 250.0`, `tdsPercent: 1.35`이고 `extractionYieldPercent`가 `22.5`다
- **When** A가 `PATCH /api/v1/brew-logs/31`에 `{"beverageWeightG": 225.0}`
- **Then** HTTP `200`, `extractionYieldPercent`가 `20.3`이다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-06 · 분쇄도 설정을 바꾸면 마이크론 추정값이 다시 저장된다

- **Given** A의 로그 `31`이 클릭당 `30`µm인 그라인더로 `actualGrindSettingValue: 22.0`, `actualGrindMicronEstimated: 660`이다
- **When** A가 `PATCH /api/v1/brew-logs/31`에 `{"actualGrindSettingValue": 24.0}`
- **Then** HTTP `200`, `actualGrindMicronEstimated`가 `720`이고 DB의 `actual_grind_micron_estimated` 컬럼도 `720`이다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-07 · 추출 시각을 바꾸면 경과일과 디게싱 상태가 다시 저장된다

- **Given** A의 로그 `31`이 `roastedAt: 2026-08-10`인 원두로 `brewedAt: 2026-08-11T00:00:00Z`, `daysOffRoast: 1`, `degassingStatus: "TOO_FRESH"`다
- **When** A가 `PATCH /api/v1/brew-logs/31`에 `{"brewedAt": "2026-08-20T00:00:00Z"}`
- **Then** HTTP `200`, `daysOffRoast`가 `10`, `degassingStatus`가 `"IDEAL"`이고 DB 컬럼도 같은 값이다 (`bean-inventory` 스펙의 판정: `0~2` `TOO_FRESH` / `3~14` `IDEAL` / `15` 이상 `PAST_PEAK`)
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-08 · 원두 재고가 삭제된 뒤 추출 시각을 바꿔도 경과일은 유지된다

- **Given** A의 로그 `31`이 `daysOffRoast: 4`이고, 참조하던 원두 재고는 소프트 삭제되었다
- **When** A가 `PATCH /api/v1/brew-logs/31`에 `{"brewedAt": "2026-08-20T00:00:00Z"}`
- **Then** HTTP `200`, `brewedAt`은 바뀌었지만 `daysOffRoast`는 `4` 그대로다 (**필수 회귀** — 재고 삭제 후에도 경과일이 남는다)
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-09 · 공개범위를 FRIENDS로 바꾸면 상호 팔로우 상대가 볼 수 있다

- **Given** A의 로그 `31`이 `visibility: PRIVATE`이고, `follows`에 `(A→B)`와 `(B→A)`가 모두 있다. B의 `GET /api/v1/brew-logs/31`은 현재 `403`이다
- **When** A가 `PATCH /api/v1/brew-logs/31`에 `{"visibility": "FRIENDS"}` 후 B가 `GET /api/v1/brew-logs/31`
- **Then** B의 요청이 HTTP `200`이다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-10 · recipeId를 보내도 무시된다

- **Given** A의 로그 `31`의 `recipeId`가 `12`다
- **When** A가 `PATCH /api/v1/brew-logs/31`에 `{"recipeId": 13, "rating": 4.0}`
- **Then** HTTP `200`, `recipeId`가 여전히 `12`이고 `rating`은 `4.0`으로 바뀐다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-11 · 레시피를 수정해도 로그의 실측 스냅샷은 불변이다

- **Given** A의 로그 `31`의 `actualDoseG`가 `15.0`이고 참조 레시피 `12`의 `doseG`도 `15.0`이다
- **When** A가 `PUT /api/v1/recipes/12`로 `doseG`를 `16.0`으로 바꾼 뒤 `GET /api/v1/brew-logs?recipeId=12`
- **Then** `content[0].actualDoseG`가 `15.0`이다 (**필수 회귀** — 스냅샷 불변성)
- **검증** API 테스트 `BrewLogControllerTest`

### 브루잉 로그 삭제

#### AC-BLEDIT-12 · 삭제하면 204이고 deleted_at이 채워진다

- **Given** A의 로그 `31`의 `deleted_at`이 `null`이다
- **When** A가 `DELETE /api/v1/brew-logs/31`
- **Then** HTTP `204`, 응답 본문이 비어 있고 DB의 `deleted_at`이 `null`이 아니다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-13 · 삭제 후 단건 조회는 404다

- **Given** A가 로그 `31`을 삭제했다
- **When** A가 `GET /api/v1/brew-logs/31`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

### 수정·삭제 에러

#### AC-BLEDIT-14 · 타인의 로그는 수정할 수 없다

- **Given** B가 남긴 `visibility: PUBLIC` 로그 `31`이 있고 A와 B는 상호 팔로우 상태다
- **When** A가 `PATCH /api/v1/brew-logs/31`에 `{"rating": 4.0}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`을 반환한다. 볼 수 있는 것과 고칠 수 있는 것은 다르다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-15 · 타인의 로그는 삭제할 수 없다

- **Given** B가 남긴 `visibility: PUBLIC` 로그 `31`이 있다
- **When** A가 `DELETE /api/v1/brew-logs/31`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`을 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-16 · 존재하지 않는 로그를 수정하면 404다

- **Given** `id`가 `999999`인 로그는 없다
- **When** A가 `PATCH /api/v1/brew-logs/999999`에 `{"rating": 4.0}`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-17 · 이미 삭제된 로그를 수정하면 404다

- **Given** A가 로그 `31`을 삭제했다
- **When** A가 `PATCH /api/v1/brew-logs/31`에 `{"rating": 4.0}`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-18 · 이미 삭제된 로그를 다시 삭제하면 404다

- **Given** A가 로그 `31`을 삭제했다
- **When** A가 `DELETE /api/v1/brew-logs/31`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BLEDIT-19 · JWT 없이 수정하면 401이다

- **Given** `Authorization` 헤더가 없다
- **When** `PATCH /api/v1/brew-logs/31`에 `{"rating": 4.0}`
- **Then** HTTP `401`과 `code: "UNAUTHORIZED"`를 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

---

### 내 프로필 · 내 그라인더

#### AC-ME-01 · 내 프로필은 여섯 필드를 반환한다

- **Given** 사용자 A의 `nickname`이 `"노성웅"`, `role`이 `USER`다
- **When** A가 `GET /api/v1/users/me`
- **Then** HTTP `200`, JSON 키 집합이 정확히 `["id","email","nickname","profileImageUrl","role","createdAt"]`이고 `nickname`이 `"노성웅"`, `role`이 `"USER"`다. (`email`·`profileImageUrl`이 채워진 사용자로 검증한다 — null이면 키가 생략되어 집합이 달라진다)
- **검증** API 테스트 `UserControllerTest`

#### AC-ME-02 · 이메일이 없는 사용자도 200이다

- **Given** 카카오 이메일 제공에 동의하지 않아 `users.email`이 `null`인 사용자 A
- **When** A가 `GET /api/v1/users/me`
- **Then** HTTP `200`이고 `email` 키가 응답에 존재하지 않는다(null 생략). `nickname`은 정상적으로 채워져 있다
- **검증** API 테스트 `UserControllerTest`

#### AC-ME-03 · JWT 없이 내 프로필을 부르면 401이다

- **Given** `Authorization` 헤더가 없다
- **When** `GET /api/v1/users/me`
- **Then** HTTP `401`과 `code: "UNAUTHORIZED"`를 반환한다
- **검증** API 테스트 `UserControllerTest`

#### AC-ME-04 · 내 그라인더 목록에 모델 정보가 펼쳐진다

- **Given** A가 `micronsPerClick`이 `30.00`인 `"C40 MK4"`(브랜드 `"Comandante"`) 모델을 `nickname: "집 그라인더"`로 등록해 두었다
- **When** A가 `GET /api/v1/gear/user-grinders`
- **Then** HTTP `200`, 배열 길이 `1`이고 `[0]`의 `brand`가 `"Comandante"`, `grinderModelName`이 `"C40 MK4"`, `micronsPerClick`이 `30.00`(`BigDecimal` scale 2), `nickname`이 `"집 그라인더"`, `isDefault`가 `false`다

> `isDefault`는 `false`다. `user_grinders.is_default`의 DB 기본값이 `false`이고 **첫 등록을 자동으로 기본 그라인더로 만드는 로직이 없다**(`V4__create_gear_tables.sql:25`). 기본 그라인더 지정 기능은 이 스펙의 범위가 아니다 — 아래 "열어둔 결정" 참조.
- **검증** API 테스트 `GearControllerTest`

#### AC-ME-05 · 타인의 그라인더는 보이지 않는다

- **Given** A가 등록한 그라인더 1개, B가 등록한 그라인더 1개가 있다
- **When** A가 `GET /api/v1/gear/user-grinders`
- **Then** 배열 길이가 `1`이고 모든 항목이 A의 것이다
- **검증** API 테스트 `GearControllerTest`

#### AC-ME-06 · 등록한 그라인더가 없으면 빈 배열이다

- **Given** A가 등록한 그라인더가 없다
- **When** A가 `GET /api/v1/gear/user-grinders`
- **Then** HTTP `200`이고 응답이 빈 배열 `[]`이다. 페이지 봉투가 아니므로 `content` 키가 없다
- **검증** API 테스트 `GearControllerTest`

#### AC-ME-07 · JWT 없이 그라인더 목록을 부르면 401이다

- **Given** `Authorization` 헤더가 없다
- **When** `GET /api/v1/gear/user-grinders`
- **Then** HTTP `401`과 `code: "UNAUTHORIZED"`를 반환한다
- **검증** API 테스트 `GearControllerTest`

---

## 수동 확인

- [x] Swagger UI에서 `GET /api/v1/recipes`의 `page`·`size`·`ownerUserId` 파라미터가 설명과 기본값을 갖고 노출된다
- [x] 계정 2개로 상호 팔로우한 뒤, 한쪽의 `FRIENDS` 레시피가 상대의 목록에 실제로 나타나고 팔로우를 해제하면 다음 요청부터 사라진다 (`visibility` 계획의 미완료 수동 확인 2건을 이 스펙에서 함께 처리한다)

> **2026-09-03 확인.** `/v3/api-docs`를 받아 `GET /api/v1/recipes`의 파라미터를 대조했다.
>
> | 파라미터 | 기본값 | 설명 |
> |---|---|---|
> | `page` | `0` | `0-based 페이지 번호. 음수면 400.` |
> | `size` | `20` | `페이지 크기. 1 이상 100 이하(양끝 포함), 벗어나면 400.` |
> | `ownerUserId` | (없음 — 옵션 필터라 정상) | `지정하면 그 사용자가 소유한 레시피만. 없는 id면 빈 목록.` |
>
> **목록 쪽 상호 팔로우도 단건과 같이 움직인다.** 12의 목록에서: 상호 팔로우일 때 `[19, 18, 9, 8]`로 11의 `FRIENDS` 레시피 19가 **나타나고**, 언팔로우 직후 `[18, 9, 8]`로 **사라진다**. 확인 후 팔로우를 복구했다.
>
> 이로써 `visibility` 스펙의 수동 확인 2건도 함께 끝났다 — 그쪽에도 결과를 적었다.
- [x] 시드 CURATED 레시피(Hoffmann V60, Kasuya 4:6)가 신규 계정의 목록 첫 화면에 보이고, 거기서 바로 포크가 된다 — 2026-08-21 `docs/specs/2026-08-21-seed-curated-recipes.md`가 시드를 넣은 뒤 확인 완료. `AC-SEED-10`·`AC-SEED-12`가 자동 검증한다

## 열어둔 결정

- **`GET /users/me`의 팔로워·팔로잉 수 포함 여부** — 프로필 화면을 실제로 그릴 때(Plan 4) 정한다. 지금 넣으면 매 요청마다 `COUNT` 두 번이 붙는데 쓰는 화면이 없다.
- **레시피 목록의 브루잉 로그 건수 표시** — "이 레시피로 12번 내렸다"는 유용하지만 목록마다 집계 쿼리가 필요하다. 프론트 카드 디자인이 확정될 때 판단한다.
- **기본 그라인더 지정 기능** — `user_grinders.is_default` 컬럼과 `findByUserIdAndIsDefaultTrue` 쿼리는 있지만 값을 `true`로 만드는 경로가 서버 어디에도 없다. 브루잉 로그 작성 폼에서 그라인더를 매번 고르는 것이 실제로 번거로워질 때 별도 스펙으로 다룬다.
- **커서 페이지네이션 전환 시점** — 한 사용자의 브루잉 로그가 500건을 넘고 오프셋 스크롤에서 중복이 실제로 관측될 때.
- **`AttachmentController`의 목록 조회에 페이지 봉투 적용 여부** — 지금은 `targetType`+`targetId`로 좁혀 몇 건뿐이라 배열 그대로 둔다. 한 로그에 사진이 20장을 넘기 시작하면 다시 본다.

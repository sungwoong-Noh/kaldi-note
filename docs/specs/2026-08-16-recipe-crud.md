---
id: RECIPE
title: 레시피 등록·조회·수정·삭제 (푸어 스텝 포함)
status: 초안
plan:
---

# 레시피 등록·조회·수정·삭제 (푸어 스텝 포함) 스펙

> 2026-08-16 `/interview`로 확정. 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md).

## 무엇을

사용자가 푸어오버 레시피를 등록하고, 그 안에 **푸어 스텝 시퀀스**(몇 초에 몇 g을 어떤 방식으로 붓는지)를 순서대로 담는다. 등록한 레시피를 조회·수정·삭제한다. 저장 시점에 그라인더 설정값을 마이크론으로 환산해 **스냅샷**으로 함께 남기고, 조회 시 브루 비율과 스텝별 누적 물량을 계산해 돌려준다.

스텝 시퀀스는 **물리적으로 재현 가능한 것만** 저장한다. 스텝들의 물량 합계가 레시피 총 물량과 다르거나, 앞 스텝을 아직 붓는 중인데 다음 스텝이 시작하는 시퀀스는 거부한다.

### 범위 밖 (Non-goals)

1. **레시피 목록 조회·검색·정렬·페이징.** 단건 조회만 다룬다. 목록은 공개범위 필터링과 얽혀 있어 그 스펙을 선행해야 한다.
2. **공개범위 판정.** `visibility` 컬럼에 값을 저장하고 기본값을 정하기만 한다. PRIVATE/FRIENDS/PUBLIC에 따라 **누가 조회할 수 있는지는 별도 스펙**에서 정한다. 이 스펙의 조회 인수 조건은 전부 **소유자 기준**이다.
3. **포크.** `parent_recipe_id`·`fork_root_id` 컬럼은 만들되 이 스펙의 API에서는 항상 `null`로 저장한다. 포크 생성과 계보 조회는 별도 스펙.
4. **태그.** `tags`·`recipe_tags` 테이블을 만들지 않는다.
5. **물 프로필.** `water_profiles` 테이블을 만들지 않고 `water_profile_id`도 받지 않는다.
6. **원두 연결.** `bean_product_id`를 받지 않고 컬럼도 만들지 않는다. `bean_products` 테이블이 아직 없으며, 원두 재고 스펙에서 nullable FK를 추가하는 마이그레이션 한 줄이면 된다.
7. **에스프레소·침지식.** `brew_method`는 `POUR_OVER` 하나만 쓴다. 요청에서 받지 않는다.
8. **관리자용 CURATED 레시피 등록.** 일반 API에서 `sourceType=CURATED`는 거부만 한다. 등록 경로는 후속 관리자 API 소관이다.

## 왜

이 서비스의 존재 이유는 **푸어 스텝 시퀀스를 구조화해 저장하는 것**이다. "1:16.7로 3분 30초"만 적힌 메모는 재현이 불가능하다. 같은 총 물량 300g이라도 60g 블룸 후 한 번에 붓는 것과 60g씩 다섯 번 나눠 붓는 것(Kasuya 4:6)은 완전히 다른 커피가 된다. 그 차이가 어디서 왔는지 알려면 스텝이 데이터로 남아야 한다.

스텝을 자유 텍스트로 두면 나중에 타이머 기능도, 레시피 간 비교도, 포크 diff도 만들 수 없다. 그래서 처음부터 구조화된 행으로 저장한다.

물량 합계와 시간 겹침을 저장 시점에 막는 이유도 같다. **합계가 안 맞는 레시피는 재현할 수 없으므로 애초에 저장되면 안 된다.** 나중에 검증하면 이미 깨진 데이터가 쌓여 있다.

## 용어

| 용어 | 정의 |
|---|---|
| 스텝(step) | 레시피 안의 한 동작. 붓기·기다리기·스월 등 |
| 붓는 스텝 | `stepType`이 `BLOOM` 또는 `POUR`인 스텝. 물을 추가한다 |
| 붓지 않는 스텝 | `WAIT`·`SWIRL`·`STIR`·`DRAWDOWN`. 물을 추가하지 않는다 |
| 점유 구간 | 한 스텝의 `[startAtSeconds, startAtSeconds + durationSeconds]` |
| 겹침(overlap) | 앞 스텝의 점유 구간 끝이 다음 스텝의 시작보다 뒤인 상태. 한 주전자로 재현 불가능 |
| 빈 구간(gap) | 앞 스텝이 끝나고 다음 스텝이 시작하기까지의 공백. 암묵적 대기로 보고 허용한다 |
| 마이크론 스냅샷 | `grind_micron_estimated`. 등록 시점에 서버가 계산해 고정하는 값 |
| 브루 비율(ratio) | `waterG ÷ doseG`. 저장하지 않고 조회 시 계산한다 |

## 데이터

### 새 테이블 `recipes`

| 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|
| `id` | `BIGSERIAL` | X | PK |
| `owner_user_id` | `BIGINT` | O | `users(id)` FK. CURATED는 null (이 스펙 API로는 항상 값이 있다) |
| `source_type` | `VARCHAR(20)` | X | `USER` / `CURATED`. 이 스펙 API로는 항상 `USER` |
| `author_name` | `VARCHAR(100)` | O | CURATED 출처 표기. 이 스펙에서는 항상 null |
| `source_url` | `VARCHAR(500)` | O | 동일 |
| `source_note` | `VARCHAR(500)` | O | 동일 |
| `title` | `VARCHAR(100)` | X | |
| `description` | `VARCHAR(2000)` | O | |
| `brew_method` | `VARCHAR(20)` | X | `POUR_OVER` 고정 |
| `visibility` | `VARCHAR(20)` | X | `PRIVATE` / `FRIENDS` / `PUBLIC`. 기본 `PRIVATE` |
| `parent_recipe_id` | `BIGINT` | O | 포크 원본. 이 스펙에서는 항상 null |
| `fork_root_id` | `BIGINT` | O | 계보 최상위. 이 스펙에서는 항상 null |
| `dose_g` | `NUMERIC(5,1)` | X | |
| `water_g` | `NUMERIC(6,1)` | X | |
| `water_temp_c` | `NUMERIC(4,1)` | O | |
| `total_time_seconds` | `INTEGER` | O | 목표 시간. 스텝과 대조하지 않는다 |
| `brewer_id` | `BIGINT` | O | `brewers(id)` FK |
| `filter_id` | `BIGINT` | O | `brew_filters(id)` FK |
| `grinder_model_id` | `BIGINT` | O | `grinder_models(id)` FK |
| `grind_setting_value` | `NUMERIC(7,1)` | O | 단위는 `grind_setting_unit`을 따른다 |
| `grind_setting_unit` | `VARCHAR(10)` | O | `CLICK` / `NUMBER` / `MICRON` |
| `grind_micron_estimated` | `NUMERIC(6,0)` | O | 등록 시점 스냅샷. 서버가 계산 |
| `created_at` | `TIMESTAMPTZ` | X | |
| `updated_at` | `TIMESTAMPTZ` | X | |
| `deleted_at` | `TIMESTAMPTZ` | O | 소프트 삭제 |

> `parent_recipe_id`·`fork_root_id`·`author_name`·`source_url`·`source_note`는 **이 스펙의 API가 쓰지 않는다.** 포크와 CURATED 등록이 이 컬럼들을 곧 쓰게 되고, 나중에 추가하면 기존 행을 백필해야 하므로 스키마에만 미리 넣는다.

### 새 테이블 `recipe_steps`

| 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|
| `id` | `BIGSERIAL` | X | PK |
| `recipe_id` | `BIGINT` | X | `recipes(id)` FK, `ON DELETE CASCADE` |
| `step_order` | `INTEGER` | X | 1부터. 서버가 요청 배열 순서로 부여 |
| `step_type` | `VARCHAR(20)` | X | `BLOOM`/`POUR`/`WAIT`/`SWIRL`/`STIR`/`DRAWDOWN` |
| `start_at_seconds` | `INTEGER` | X | 레시피 시작 기준 누적 시각 |
| `duration_seconds` | `INTEGER` | X | 이 동작에 걸리는 시간 |
| `water_g` | `NUMERIC(6,1)` | O | 이번 스텝에서 붓는 물량 |
| `pour_technique` | `VARCHAR(20)` | O | `CENTER`/`SPIRAL`/`PULSE`/`EDGE` |
| `agitation` | `VARCHAR(20)` | O | `NONE`/`SWIRL`/`STIR` |
| `note` | `VARCHAR(500)` | O | |

`UNIQUE(recipe_id, step_order)`.

### 입력 값의 범위와 정규화

범위는 **양끝을 포함**한다.

| 값 | 범위 | 타입 · 스케일 | Null |
|---|---|---|---|
| `doseG` | 1.0 ~ 200.0 | `BigDecimal` 스케일 1, HALF_UP | X |
| `waterG` | 10.0 ~ 3000.0 | `BigDecimal` 스케일 1, HALF_UP | X |
| `waterTempC` | 60.0 ~ 100.0 | `BigDecimal` 스케일 1, HALF_UP | O |
| `totalTimeSeconds` | 1 ~ 3600 | `int` | O |
| `title` | 1 ~ 100자, 공백만이면 거부 | `String` | X |
| `description` | 0 ~ 2000자 | `String` | O |
| `grindSettingValue` (`unit=MICRON`) | 100 ~ 2000 | `BigDecimal` 스케일 1 | O |
| 스텝 `startAtSeconds` | 0 ~ 3600 | `int` | X |
| 스텝 `durationSeconds` | 0 ~ 3600 | `int` | X |
| 스텝 `waterG` | 0.0 ~ 3000.0 | `BigDecimal` 스케일 1, HALF_UP | O |
| 스텝 `note` | 0 ~ 500자 | `String` | O |
| 스텝 개수 | 0 ~ 30 | — | — |

`doseG`·`waterG`·`waterTempC`·스텝 `waterG`는 **스케일 1 HALF_UP으로 정규화해 저장한다.** (계획 문서 「반올림 규칙」의 중량 스케일 1을 따른다.)

### 파생값 — 저장하지 않는다

| 값 | 계산식 | 스케일 |
|---|---|---|
| `ratio` | `waterG ÷ doseG` | 1, HALF_UP |
| 스텝 `cumulativeWaterG` | 1번 스텝부터 해당 스텝까지 `waterG` 누적합 | 1, HALF_UP |

### 마이크론 스냅샷 계산

```
unit = CLICK 또는 NUMBER  → GrindConverter로 (settingValue - zeroPointOffsetClicks) × micronsPerClick
unit = MICRON             → settingValue를 그대로 사용
```

| 상황 | `grindMicronEstimated` | 레시피 저장 |
|---|---|---|
| `micronsPerClick`이 있는 그라인더 | 계산값 (스케일 0, HALF_UP) | 성공 |
| `micronsPerClick`이 `null`인 무단계 그라인더 | `null` | **성공** |
| `unit=MICRON` | `settingValue` | 성공 |
| 설정값이 그라인더 min/max 밖 | — | 거부 (400) |

> **무단계 그라인더를 거부하지 않는 것이 중요하다.** 환산 API는 422로 거부하지만, 레시피 등록까지 막으면 무단계 그라인더 사용자는 이 서비스를 아예 쓸 수 없다. 환산이 안 될 뿐 레시피는 온전하다.

## API

| 메서드 | 경로 | 인증 | 성공 상태 | 설명 |
|---|---|---|---|---|
| POST | `/api/v1/recipes` | 필요 | 201 | 레시피 + 스텝 생성 |
| GET | `/api/v1/recipes/{id}` | 필요 | 200 | 단건 조회 (소유자 기준) |
| PUT | `/api/v1/recipes/{id}` | 필요 | 200 | 전체 교체. 스텝은 통째로 교체 |
| DELETE | `/api/v1/recipes/{id}` | 필요 | 204 | 소프트 삭제 |

**검증 순서:** `401`(미인증) → `404`(레시피 없음 / FK 대상 없음) → `403`(소유자 아님 · CURATED 지정) → `400`(값·시퀀스 검증).

### 요청 예시 — Kasuya 4:6

```json
{
  "title": "Kasuya 4:6",
  "description": "40%로 단맛·산미를 잡고 60%로 농도를 맞춘다",
  "visibility": "FRIENDS",
  "doseG": 20.0,
  "waterG": 300.0,
  "waterTempC": 92.0,
  "totalTimeSeconds": 210,
  "brewerId": 1,
  "filterId": 1,
  "grinderModelId": 1,
  "grindSettingValue": 22,
  "grindSettingUnit": "CLICK",
  "steps": [
    { "stepType": "BLOOM", "startAtSeconds": 0,   "durationSeconds": 10, "waterG": 60.0, "pourTechnique": "CENTER", "agitation": "NONE" },
    { "stepType": "POUR",  "startAtSeconds": 45,  "durationSeconds": 10, "waterG": 60.0, "pourTechnique": "SPIRAL", "agitation": "NONE" },
    { "stepType": "POUR",  "startAtSeconds": 90,  "durationSeconds": 10, "waterG": 60.0, "pourTechnique": "SPIRAL", "agitation": "NONE" },
    { "stepType": "POUR",  "startAtSeconds": 135, "durationSeconds": 10, "waterG": 60.0, "pourTechnique": "SPIRAL", "agitation": "NONE" },
    { "stepType": "POUR",  "startAtSeconds": 165, "durationSeconds": 10, "waterG": 60.0, "pourTechnique": "SPIRAL", "agitation": "SWIRL" }
  ]
}
```

### 응답 예시 (201 / 200)

```json
{
  "id": 1,
  "ownerUserId": 1,
  "sourceType": "USER",
  "title": "Kasuya 4:6",
  "description": "40%로 단맛·산미를 잡고 60%로 농도를 맞춘다",
  "brewMethod": "POUR_OVER",
  "visibility": "FRIENDS",
  "doseG": 20.0,
  "waterG": 300.0,
  "ratio": 15.0,
  "waterTempC": 92.0,
  "totalTimeSeconds": 210,
  "brewerId": 1,
  "filterId": 1,
  "grinderModelId": 1,
  "grindSettingValue": 22.0,
  "grindSettingUnit": "CLICK",
  "grindMicronEstimated": 660,
  "steps": [
    { "stepOrder": 1, "stepType": "BLOOM", "startAtSeconds": 0,   "durationSeconds": 10, "waterG": 60.0, "cumulativeWaterG": 60.0,  "pourTechnique": "CENTER", "agitation": "NONE", "note": null },
    { "stepOrder": 2, "stepType": "POUR",  "startAtSeconds": 45,  "durationSeconds": 10, "waterG": 60.0, "cumulativeWaterG": 120.0, "pourTechnique": "SPIRAL", "agitation": "NONE", "note": null },
    { "stepOrder": 3, "stepType": "POUR",  "startAtSeconds": 90,  "durationSeconds": 10, "waterG": 60.0, "cumulativeWaterG": 180.0, "pourTechnique": "SPIRAL", "agitation": "NONE", "note": null },
    { "stepOrder": 4, "stepType": "POUR",  "startAtSeconds": 135, "durationSeconds": 10, "waterG": 60.0, "cumulativeWaterG": 240.0, "pourTechnique": "SPIRAL", "agitation": "NONE", "note": null },
    { "stepOrder": 5, "stepType": "POUR",  "startAtSeconds": 165, "durationSeconds": 10, "waterG": 60.0, "cumulativeWaterG": 300.0, "pourTechnique": "SPIRAL", "agitation": "SWIRL", "note": null }
  ],
  "createdAt": "2026-08-16T10:00:00Z",
  "updatedAt": "2026-08-16T10:00:00Z"
}
```

### 신설 ErrorCode

| code | HTTP | 언제 |
|---|---|---|
| `RECIPE_STEP_WATER_MISMATCH` | 400 | 스텝 `waterG` 합계 ≠ 레시피 `waterG` |
| `RECIPE_STEP_OVERLAP` | 400 | 앞 스텝의 점유 구간이 다음 스텝 시작과 겹침 |
| `RECIPE_STEP_WATER_INVALID` | 400 | 스텝 타입과 `waterG`가 모순 |

기존 `INVALID_REQUEST`(400) · `UNAUTHORIZED`(401) · `FORBIDDEN`(403) · `NOT_FOUND`(404) · `GRIND_SETTING_OUT_OF_RANGE`(400)를 그대로 재사용한다.

### 시드 그라인더 (AC에서 사용)

Plan 1의 `V5__seed_gear.sql`에 이미 들어 있는 값이다.

| 그라인더 | micronsPerClick | zeroPoint | min | max |
|---|---|---|---|---|
| Comandante C40 MK4 | 30 | 0 | 0 | 50 |
| Wilfa Uniform | `null` | 0 | 0 | 0 |

---

## 어떻게 동작 — 인수 조건

### 정상 동작

#### AC-RECIPE-01 · 최소 입력만으로 레시피가 생성된다

- **Given** 인증된 사용자
- **When** `title="아침 레시피"`, `doseG=15.0`, `waterG=250.0`만 담아 `POST /api/v1/recipes`
- **Then** HTTP `201`. 저장된 행의 `visibility="PRIVATE"`, `sourceType="USER"`, `brewMethod="POUR_OVER"`, `ownerUserId`는 호출자의 id
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-02 · 스텝이 0개면 물량 합계 검증을 건너뛴다

- **Given** 인증된 사용자
- **When** `doseG=15.0`, `waterG=250.0`, `steps=[]`로 생성
- **Then** HTTP `201`. 저장된 `recipe_steps` 행이 0개
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-03 · 스텝 물량 합계가 총 물량과 같으면 생성된다

- **Given** 인증된 사용자
- **When** `waterG=300.0`, 스텝 5개(각 `waterG=60.0`)로 생성
- **Then** HTTP `201`. `recipe_steps` 행이 5개
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-04 · stepOrder는 서버가 배열 순서로 1부터 부여한다

- **Given** 인증된 사용자
- **When** 스텝 3개를 배열로 보내 생성 (요청에 `stepOrder` 없음)
- **Then** 저장된 스텝의 `step_order`가 배열 순서대로 `1`, `2`, `3`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-05 · 조회 응답의 ratio는 waterG ÷ doseG를 소수 1자리로 반올림한 값이다

- **Given** `doseG=18.0`, `waterG=300.0`인 레시피
- **When** 소유자가 `GET /api/v1/recipes/{id}`
- **Then** HTTP `200`, `ratio`가 `16.7` (300 ÷ 18 = 16.666… → HALF_UP)
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-06 · 조회 응답의 스텝별 cumulativeWaterG가 누적합이다

- **Given** `waterG=300.0`, 스텝 5개(각 `waterG=60.0`)인 레시피
- **When** 소유자가 `GET /api/v1/recipes/{id}`
- **Then** 스텝의 `cumulativeWaterG`가 순서대로 `60.0`, `120.0`, `180.0`, `240.0`, `300.0`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-07 · 마이크론 스냅샷을 서버가 계산해 저장한다

- **Given** Comandante C40 MK4(`micronsPerClick=30`, `zeroPointOffsetClicks=0`)
- **When** `grinderModelId=C40`, `grindSettingValue=22`, `grindSettingUnit="CLICK"`로 생성
- **Then** HTTP `201`, `grindMicronEstimated`가 `660`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-08 · 무단계 그라인더는 스냅샷이 null이고 레시피는 생성된다

- **Given** Wilfa Uniform(`micronsPerClick=null`)
- **When** `grinderModelId=Wilfa`, `grindSettingValue=5`, `grindSettingUnit="NUMBER"`로 생성
- **Then** HTTP `201`, `grindMicronEstimated`가 `null`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-09 · unit이 MICRON이면 그라인더 없이도 값을 그대로 스냅샷에 넣는다

- **Given** 인증된 사용자
- **When** `grinderModelId` 없이 `grindSettingValue=800`, `grindSettingUnit="MICRON"`로 생성
- **Then** HTTP `201`, `grindMicronEstimated`가 `800`, `grinderModelId`가 `null`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-10 · PUT은 스텝을 통째로 교체한다

- **Given** 스텝 5개(각 `waterG=60.0`, 합계 300.0)인 레시피
- **When** 소유자가 `waterG=300.0`, 스텝 2개(각 `waterG=150.0`)로 `PUT /api/v1/recipes/{id}`
- **Then** HTTP `200`. 조회 시 스텝이 정확히 2개이고 `step_order`가 `1`, `2`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-11 · 삭제하면 소유자도 조회할 수 없다

- **Given** 소유자의 레시피
- **When** `DELETE /api/v1/recipes/{id}` 후 같은 사용자가 `GET /api/v1/recipes/{id}`
- **Then** DELETE는 HTTP `204`, 이어진 GET은 HTTP `404`와 `code: "NOT_FOUND"`. DB의 `deleted_at`은 `null`이 아니다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-12 · 이미 삭제된 레시피를 다시 삭제하면 404다

- **Given** 이미 소프트 삭제된 레시피
- **When** 소유자가 `DELETE /api/v1/recipes/{id}`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `RecipeControllerTest`

### 경계값

> 모든 범위는 **양끝을 포함**한다. 각 경계마다 통과 1개·거부 1개를 둔다.

#### AC-RECIPE-20 · doseG 1.0은 허용된다

- **Given** 인증된 사용자
- **When** `doseG=1.0`, `waterG=250.0`으로 생성
- **Then** HTTP `201`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-21 · doseG 0.9는 거부된다

- **When** `doseG=0.9`로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-22 · doseG 200.0은 허용된다

- **When** `doseG=200.0`, `waterG=3000.0`으로 생성
- **Then** HTTP `201`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-23 · doseG 200.1은 거부된다

- **When** `doseG=200.1`로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-24 · waterG 10.0은 허용된다

- **When** `doseG=1.0`, `waterG=10.0`으로 생성
- **Then** HTTP `201`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-25 · waterG 9.9는 거부된다

- **When** `waterG=9.9`로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-26 · waterG 3000.0은 허용된다

- **When** `doseG=200.0`, `waterG=3000.0`으로 생성
- **Then** HTTP `201`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-27 · waterG 3000.1은 거부된다

- **When** `waterG=3000.1`로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-28 · waterTempC 60.0은 허용된다

- **When** `waterTempC=60.0`으로 생성
- **Then** HTTP `201`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-29 · waterTempC 59.9는 거부된다

- **When** `waterTempC=59.9`로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-30 · waterTempC 100.0은 허용된다

- **When** `waterTempC=100.0`으로 생성
- **Then** HTTP `201`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-31 · waterTempC 100.1은 거부된다

- **When** `waterTempC=100.1`로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-32 · totalTimeSeconds 3600은 허용된다

- **When** `totalTimeSeconds=3600`으로 생성
- **Then** HTTP `201`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-33 · totalTimeSeconds 3601은 거부된다

- **When** `totalTimeSeconds=3601`로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-34 · 스텝 30개는 허용된다

- **Given** `waterG=300.0`, 각 `waterG=10.0`인 POUR 스텝 30개 (합계 300.0, 겹치지 않음)
- **When** 생성
- **Then** HTTP `201`, 저장된 스텝 30개
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-35 · 스텝 31개는 거부된다

- **When** 스텝 31개로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-36 · title 100자는 허용된다

- **When** 100자 `title`로 생성
- **Then** HTTP `201`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-37 · title 101자는 거부된다

- **When** 101자 `title`로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-38 · 공백만인 title은 거부된다

- **When** `title="   "`(공백 3칸)로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-39 · description 2000자는 허용된다

- **When** 2000자 `description`으로 생성
- **Then** HTTP `201`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-40 · description 2001자는 거부된다

- **When** 2001자 `description`으로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-41 · unit=MICRON에서 100은 허용된다

- **When** `grindSettingValue=100`, `grindSettingUnit="MICRON"`으로 생성
- **Then** HTTP `201`, `grindMicronEstimated`가 `100`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-42 · unit=MICRON에서 99는 거부된다

- **When** `grindSettingValue=99`, `grindSettingUnit="MICRON"`으로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-43 · unit=MICRON에서 2000은 허용된다

- **When** `grindSettingValue=2000`, `grindSettingUnit="MICRON"`으로 생성
- **Then** HTTP `201`, `grindMicronEstimated`가 `2000`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-44 · unit=MICRON에서 2001은 거부된다

- **When** `grindSettingValue=2001`, `grindSettingUnit="MICRON"`으로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-45 · 앞 스텝이 끝나는 순간 다음 스텝이 시작하면 허용된다

- **Given** `waterG=120.0`
- **When** 스텝1(`startAtSeconds=0`, `durationSeconds=30`, `waterG=60.0`)과 스텝2(`startAtSeconds=30`, `durationSeconds=10`, `waterG=60.0`)로 생성
- **Then** HTTP `201` (`0 + 30 ≤ 30`)
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-46 · 1초라도 겹치면 거부된다

- **Given** `waterG=120.0`
- **When** 스텝1(`startAtSeconds=0`, `durationSeconds=30`, `waterG=60.0`)과 스텝2(`startAtSeconds=29`, `durationSeconds=10`, `waterG=60.0`)로 생성
- **Then** HTTP `400`과 `code: "RECIPE_STEP_OVERLAP"` (`0 + 30 > 29`)
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-47 · 스텝 사이의 빈 구간은 허용된다

- **Given** `waterG=120.0`
- **When** 스텝1(`startAtSeconds=0`, `durationSeconds=10`, `waterG=60.0`)과 스텝2(`startAtSeconds=45`, `durationSeconds=10`, `waterG=60.0`)로 생성
- **Then** HTTP `201` (10초~45초의 공백은 암묵적 대기)
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-48 · totalTimeSeconds가 마지막 스텝 종료보다 작아도 허용된다

- **Given** `waterG=60.0`, 마지막 스텝이 `startAtSeconds=165`, `durationSeconds=10`(종료 175초)
- **When** `totalTimeSeconds=160`으로 생성
- **Then** HTTP `201`. 목표 시간은 스텝과 대조하지 않는다
- **검증** API 테스트 `RecipeControllerTest`

### 에러

#### AC-RECIPE-50 · 스텝 물량 합계가 총 물량과 다르면 거부된다

- **Given** `waterG=300.0`
- **When** 스텝 합계가 `290.0`인 요청으로 생성
- **Then** HTTP `400`과 `code: "RECIPE_STEP_WATER_MISMATCH"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-51 · 붓지 않는 스텝에 물량이 있으면 거부된다

- **When** `stepType="SWIRL"`, `waterG=50.0`인 스텝을 포함해 생성
- **Then** HTTP `400`과 `code: "RECIPE_STEP_WATER_INVALID"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-52 · 붓는 스텝에 물량이 0이면 거부된다

- **When** `stepType="POUR"`, `waterG=0`인 스텝을 포함해 생성
- **Then** HTTP `400`과 `code: "RECIPE_STEP_WATER_INVALID"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-53 · 존재하지 않는 brewerId는 404다

- **When** `brewerId=999999`로 생성
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-54 · 존재하지 않는 grinderModelId는 404다

- **When** `grinderModelId=999999`, `grindSettingValue=22`, `grindSettingUnit="CLICK"`로 생성
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-55 · 그라인더 범위를 벗어난 설정값은 거부된다

- **Given** Comandante C40 MK4(`max_setting=50`)
- **When** `grinderModelId=C40`, `grindSettingValue=51`, `grindSettingUnit="CLICK"`로 생성
- **Then** HTTP `400`과 `code: "GRIND_SETTING_OUT_OF_RANGE"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-56 · unit이 CLICK인데 그라인더가 없으면 거부된다

- **When** `grinderModelId` 없이 `grindSettingValue=22`, `grindSettingUnit="CLICK"`로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-57 · 일반 API로 CURATED 레시피를 만들 수 없다

- **When** `sourceType="CURATED"`를 담아 생성
- **Then** HTTP `403`과 `code: "FORBIDDEN"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-58 · 남의 레시피를 수정할 수 없다

- **Given** 사용자 A의 레시피
- **When** 사용자 B의 토큰으로 `PUT /api/v1/recipes/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`. 레시피는 변경되지 않는다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-59 · 남의 레시피를 삭제할 수 없다

- **Given** 사용자 A의 레시피
- **When** 사용자 B의 토큰으로 `DELETE /api/v1/recipes/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`. `deleted_at`은 `null`로 남는다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-60 · 인증 없이 생성할 수 없다

- **When** Authorization 헤더 없이 `POST /api/v1/recipes`
- **Then** HTTP `401`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-RECIPE-61 · 존재하지 않는 레시피 조회는 404다

- **When** 인증된 사용자가 `GET /api/v1/recipes/999999`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `RecipeControllerTest`

---

## 수동 확인

- [ ] Swagger UI에서 Kasuya 4:6 레시피를 등록하고, 응답의 `steps` 배열이 타이머 UI를 만들 수 있을 만큼의 정보(시각·지속시간·누적 물량)를 담고 있는지 눈으로 확인

## 열어둔 결정

- **레시피 목록 조회의 정렬 기준과 페이징 방식** — 공개범위 인가 스펙을 쓸 때 함께 정한다.
- **QueryDSL 도입 여부** — 목록 조회에 검색 조건이 붙는 시점에 판단한다. 이 스펙의 단건 CRUD만으로는 필요 없다.
- **`user_grinders.calibration_offset_clicks`를 마이크론 스냅샷에 반영할지** — 분쇄도 환산 스펙에서도 비목표로 미뤄둔 항목이다. 개인 보정을 다루는 스펙에서 함께 정한다.

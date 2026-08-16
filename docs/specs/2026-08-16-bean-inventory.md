---
id: BEAN
title: 원두 카탈로그와 개인 재고
status: 구현완료
plan:
---

# 원두 카탈로그와 개인 재고 스펙

> 2026-08-16 `/interview`로 확정. 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md).

## 무엇을

사용자가 원두 **상품**(어느 로스터의 어떤 원두인지, 싱글오리진인지 블렌드인지, 배전도·산지·품종·가공법)을 카탈로그에 등록하고, 그 상품을 실제로 구매한 **개인 재고**(몇 g을 언제 샀고 언제 볶았는지, 얼마나 남았는지)를 관리한다. 재고 조회 응답에는 로스팅 후 경과일과 디게싱(가스 배출) 권장 상태를 서버가 계산해 함께 내려준다.

로스터·원두 상품은 Variety·CoffeeProcess와 같은 **공용 카탈로그**다 — 누구나 즉시 등록할 수 있고, 중복은 관리자가 사후 병합한다. 개인 재고는 그 카탈로그를 참조하는 **소유자 전용 데이터**다.

### 범위 밖 (Non-goals)

1. **BeanProduct 검증(verify) 관리자 API.** 사용자가 만든 카탈로그 항목을 공용으로 승격하는 기능은 후속 관리자 API 소관이다. 이 스펙에서 `verified`는 항상 `false`로 저장된다.
2. **재고 자동 차감.** 브루잉 로그 작성 시 `remaining_g`을 자동으로 줄이는 연동은 브루잉 로그 스펙의 몫이다. 이 스펙은 `remaining_g`을 사용자가 직접 `PATCH`로만 갱신하게 한다.
3. **사진 첨부.** `attachments` 연동은 Plan 3(Object Storage)이다.
4. **검색·필터링 API.** 목록 조회는 검색 조건 없이 전체 나열만 한다. 로스터/원두 상품이 늘어나 검색이 실제로 필요해지면 QueryDSL 도입 시점에 다룬다.
5. **BeanProduct·Roaster의 수정·삭제 API.** Variety·CoffeeProcess와 동일하게 생성과 조회만 만든다.
6. **레시피와의 연결.** `recipes.bean_product_id` 컬럼은 nullable FK로 추가하지만, 레시피 생성/수정 API는 이 스펙에서 이 필드를 받지 않는다. 레시피 쪽 API 확장은 별도 결정 사항이다.

## 왜

원두 정보를 레시피·재고마다 자유 텍스트로 반복 입력하면 "에티오피아 예가체프"와 "Ethiopia Yirgacheffe"가 서로 다른 원두로 취급되어 비교·검색이 불가능해진다. 로스터·원두 상품을 정규화된 카탈로그로 분리해야, 같은 원두를 여러 사용자가 참조하고 나중에 원두별 레시피 추천 같은 기능도 만들 수 있다.

재고를 원두 상품과 분리하는 이유는 **같은 원두를 여러 번 구매**하기 때문이다. "블루보틀 예가체프"를 이번 달에도, 지난달에도 샀다면 상품은 하나지만 재고(배치)는 둘이고, 로스팅 날짜·가격·잔량이 각각 다르다.

디게싱 상태를 서버가 계산해 내려주는 이유는 사용자가 매번 "오늘이 로스팅 후 며칠째지"를 암산하지 않게 하기 위해서다 — 이게 재고 화면의 핵심 정보다.

## 용어

| 용어 | 정의 |
|---|---|
| 로스터(Roaster) | 원두를 볶아 판매하는 업체 |
| 원두 상품(BeanProduct) | 로스터가 파는 원두 한 종류. 싱글오리진 또는 블렌드 |
| 산지(BeanOrigin) | 원두 상품을 구성하는 산지 1건. 블렌드는 여러 건 |
| 재고 배치(BeanBatch) | 사용자가 실제로 구매한 원두 묶음 1건. 같은 상품도 구매마다 배치가 따로 생긴다 |
| 로스팅 후 경과일(daysOffRoast) | `roastedAt`부터 오늘까지의 일수. 조회 시점마다 다시 계산한다 |
| 디게싱 상태(degassingStatus) | 경과일 기준 원두가 추출에 적합한 시기인지 나타내는 3단계 판정 |

## 데이터

### 새 테이블 `roasters`

| 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|
| `id` | `BIGSERIAL` | X | PK |
| `name` | `VARCHAR(100)` | X | `UNIQUE` |
| `country` | `VARCHAR(100)` | O | |
| `website` | `VARCHAR(500)` | O | |
| `is_system` | `BOOLEAN` | X | 기본 `false` |
| `created_by_user_id` | `BIGINT` | O | `users(id)` FK, `ON DELETE SET NULL` |
| `created_at` | `TIMESTAMPTZ` | X | |
| `updated_at` | `TIMESTAMPTZ` | X | |

### 새 테이블 `bean_products`

| 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|
| `id` | `BIGSERIAL` | X | PK |
| `roaster_id` | `BIGINT` | X | `roasters(id)` FK |
| `name` | `VARCHAR(100)` | X | `UNIQUE(roaster_id, name)` |
| `bean_mix` | `VARCHAR(20)` | X | `SINGLE_ORIGIN` / `BLEND` |
| `roast_level` | `VARCHAR(20)` | X | `LIGHT`/`MEDIUM_LIGHT`/`MEDIUM`/`MEDIUM_DARK`/`DARK` |
| `roast_level_agtron` | `SMALLINT` | O | |
| `roast_level_custom` | `VARCHAR(100)` | O | |
| `decaf` | `BOOLEAN` | X | 기본 `false` |
| `product_url` | `VARCHAR(500)` | O | |
| `description` | `VARCHAR(2000)` | O | |
| `verified` | `BOOLEAN` | X | 기본 `false`. 이 스펙에서는 항상 `false` |
| `created_by_user_id` | `BIGINT` | O | `users(id)` FK, `ON DELETE SET NULL` |
| `created_at` | `TIMESTAMPTZ` | X | |
| `updated_at` | `TIMESTAMPTZ` | X | |

### 새 테이블 `bean_origins`

| 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|
| `id` | `BIGSERIAL` | X | PK |
| `bean_product_id` | `BIGINT` | X | `bean_products(id)` FK, `ON DELETE CASCADE` |
| `country` | `VARCHAR(100)` | X | |
| `region` | `VARCHAR(100)` | O | |
| `farm` | `VARCHAR(100)` | O | |
| `altitude_min_m` | `SMALLINT` | O | |
| `altitude_max_m` | `SMALLINT` | O | |
| `variety_id` | `BIGINT` | O | `varieties(id)` FK |
| `process_id` | `BIGINT` | O | `coffee_processes(id)` FK |
| `ratio_percent` | `NUMERIC(4,1)` | X | 블렌드 비율. 싱글오리진은 서버가 `100.0`으로 고정 |

### 새 테이블 `bean_batches`

| 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|
| `id` | `BIGSERIAL` | X | PK |
| `user_id` | `BIGINT` | X | `users(id)` FK. 소유자 |
| `bean_product_id` | `BIGINT` | X | `bean_products(id)` FK |
| `roasted_at` | `DATE` | X | 미래 날짜 불가 |
| `purchased_at` | `DATE` | O | |
| `opened_at` | `DATE` | O | |
| `weight_g` | `NUMERIC(6,1)` | X | 구매 당시 총량. `10.0`~`5000.0` |
| `remaining_g` | `NUMERIC(6,1)` | X | 생성 시 `weight_g`로 자동 초기화. `0`~`weight_g` |
| `price` | `INTEGER` | O | 원화. `0`~`1000000` |
| `frozen` | `BOOLEAN` | X | 기본 `false` |
| `frozen_at` | `TIMESTAMPTZ` | O | `frozen`이 `true`가 되는 순간 서버가 기록. `false`가 되면 `null`로 초기화 |
| `finished` | `BOOLEAN` | X | 기본 `false`. 사용자가 직접 토글 |
| `memo` | `VARCHAR(500)` | O | |
| `created_at` | `TIMESTAMPTZ` | X | |
| `updated_at` | `TIMESTAMPTZ` | X | |
| `deleted_at` | `TIMESTAMPTZ` | O | 소프트 삭제 |

### 기존 테이블 변경 `recipes`

| 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|
| `bean_product_id` | `BIGINT` | O | `bean_products(id)` FK. **컬럼만 추가** — 이 스펙의 어떤 API도 이 값을 읽거나 쓰지 않는다 |

### 파생값 — 저장하지 않는다

| 값 | 계산식 |
|---|---|
| `daysOffRoast` | `오늘(LocalDate.now()) − roastedAt`, 일 단위 |
| `degassingStatus` | `daysOffRoast`가 `0~2`면 `TOO_FRESH`, `3~14`면 `IDEAL`, `15` 이상이면 `PAST_PEAK` |

## API

| 메서드 | 경로 | 인증 | 성공 상태 | 설명 |
|---|---|---|---|---|
| POST | `/api/v1/roasters` | 필요 | 201 | 로스터 생성 |
| GET | `/api/v1/roasters` | 필요 | 200 | 로스터 전체 목록(이름순) |
| POST | `/api/v1/bean-products` | 필요 | 201 | 원두 상품 + 산지 생성 |
| GET | `/api/v1/bean-products` | 필요 | 200 | 원두 상품 전체 목록(이름순) |
| GET | `/api/v1/bean-products/{id}` | 필요 | 200 | 원두 상품 단건 조회(산지 포함) |
| POST | `/api/v1/bean-batches` | 필요 | 201 | 개인 재고 생성 |
| GET | `/api/v1/bean-batches` | 필요 | 200 | 내 재고 전체 목록(소진분 포함) |
| GET | `/api/v1/bean-batches/{id}` | 필요 | 200 | 내 재고 단건 조회 |
| PATCH | `/api/v1/bean-batches/{id}` | 필요 | 200 | 재고 부분 수정 |
| DELETE | `/api/v1/bean-batches/{id}` | 필요 | 204 | 재고 소프트 삭제 |

**로스터·원두 상품 검증 순서:** `401`(미인증) → `404`(`roasterId`/`varietyId`/`processId` 없음) → `409`(이름 중복) → `400`(값·정합성 검증).
**재고 검증 순서:** `401`(미인증) → `404`(`beanProductId`/배치 없음) → `403`(소유자 아님) → `400`(값 검증).

### 요청 예시 — 로스터 생성

```json
{ "name": "프릳츠커피컴퍼니", "country": "KR", "website": "https://fritzcoffeecompany.com" }
```

### 요청 예시 — 블렌드 원두 상품 생성

```json
{
  "roasterId": 1,
  "name": "시그니처 블렌드",
  "beanMix": "BLEND",
  "roastLevel": "MEDIUM_DARK",
  "origins": [
    { "country": "ET", "region": "예가체프", "varietyId": 1, "processId": 2, "ratioPercent": 50.0 },
    { "country": "CO", "region": "우일라", "ratioPercent": 50.0 }
  ]
}
```

### 응답 예시 (201 / 200)

```json
{
  "id": 1,
  "roasterId": 1,
  "name": "시그니처 블렌드",
  "beanMix": "BLEND",
  "roastLevel": "MEDIUM_DARK",
  "roastLevelAgtron": null,
  "roastLevelCustom": null,
  "decaf": false,
  "verified": false,
  "origins": [
    { "id": 1, "country": "ET", "region": "예가체프", "varietyId": 1, "processId": 2, "ratioPercent": 50.0 },
    { "id": 2, "country": "CO", "region": "우일라", "varietyId": null, "processId": null, "ratioPercent": 50.0 }
  ],
  "createdAt": "2026-08-16T10:00:00Z"
}
```

### 요청 예시 — 재고 생성

```json
{ "beanProductId": 1, "weightG": 200.0, "roastedAt": "2026-08-10", "purchasedAt": "2026-08-12", "price": 18000, "memo": "핸드드립용" }
```

### 응답 예시 — 재고 (201 / 200, `roastedAt`으로부터 6일 경과 시점 조회)

```json
{
  "id": 1,
  "beanProductId": 1,
  "weightG": 200.0,
  "remainingG": 200.0,
  "roastedAt": "2026-08-10",
  "purchasedAt": "2026-08-12",
  "openedAt": null,
  "price": 18000,
  "frozen": false,
  "frozenAt": null,
  "finished": false,
  "memo": "핸드드립용",
  "daysOffRoast": 6,
  "degassingStatus": "IDEAL",
  "createdAt": "2026-08-16T10:00:00Z",
  "updatedAt": "2026-08-16T10:00:00Z"
}
```

### 신설 ErrorCode

| code | HTTP | 언제 |
|---|---|---|
| `BEAN_MIX_ORIGIN_MISMATCH` | 400 | `beanMix=SINGLE_ORIGIN`인데 `origins`가 1개가 아니거나, `BLEND`인데 1개 이하 |
| `BEAN_ORIGIN_RATIO_MISMATCH` | 400 | 블렌드(`origins` 2개 이상)의 `ratioPercent` 합계가 `100.0`이 아님 |
| `BEAN_BATCH_REMAINING_INVALID` | 400 | `remainingG`가 `0` 미만이거나 `weightG` 초과 |

기존 `INVALID_REQUEST`(400)·`UNAUTHORIZED`(401)·`FORBIDDEN`(403)·`NOT_FOUND`(404)·`DUPLICATE_NAME`(409)을 그대로 재사용한다.

---

## 어떻게 동작 — 인수 조건

### 정상 동작

#### AC-BEAN-01 · 최소 입력으로 로스터가 생성된다

- **Given** 인증된 사용자
- **When** `name="프릳츠커피컴퍼니"`만 담아 `POST /api/v1/roasters`
- **Then** HTTP `201`. 저장된 행의 `isSystem=false`, `createdByUserId`는 호출자의 id
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-02 · 로스터 목록은 이름순으로 전체 반환된다

- **Given** 로스터 2건("커피리브레", "프릳츠커피컴퍼니")이 등록돼 있음
- **When** `GET /api/v1/roasters`
- **Then** HTTP `200`, 배열이 `["커피리브레", "프릳츠커피컴퍼니"]` 순서
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-03 · 싱글오리진 원두 상품이 최소 입력으로 생성된다

- **Given** 등록된 로스터, 인증된 사용자
- **When** `roasterId`, `name="예가체프 내추럴"`, `beanMix="SINGLE_ORIGIN"`, `roastLevel="LIGHT"`, `origins=[{country:"ET"}]`로 생성
- **Then** HTTP `201`, `verified=false`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-04 · 블렌드 산지의 ratioPercent 합계가 100이면 생성된다

- **When** `beanMix="BLEND"`, `origins`가 `ratioPercent` `50.0`·`50.0`인 2건으로 생성
- **Then** HTTP `201`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-05 · 싱글오리진은 ratioPercent를 서버가 100.0으로 고정한다

- **When** `beanMix="SINGLE_ORIGIN"`, `origins=[{country:"ET"}]`(ratioPercent 미입력)로 생성
- **Then** HTTP `201`. 저장된 `bean_origins.ratio_percent`가 `100.0`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-06 · 원두 상품 목록은 이름순으로 전체 반환된다

- **Given** 원두 상품 2건이 등록돼 있음
- **When** `GET /api/v1/bean-products`
- **Then** HTTP `200`, 이름순 배열
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-07 · 원두 상품 단건 조회는 산지를 포함한다

- **Given** 산지 2건을 가진 블렌드 상품
- **When** `GET /api/v1/bean-products/{id}`
- **Then** HTTP `200`, `origins` 배열 길이 `2`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-08 · 최소 입력으로 재고가 생성되고 remainingG가 자동 초기화된다

- **Given** 등록된 원두 상품, 인증된 사용자
- **When** `beanProductId`, `weightG=200.0`, `roastedAt="2026-08-10"`만 담아 `POST /api/v1/bean-batches`
- **Then** HTTP `201`. `remainingG=200.0`, `finished=false`, `frozen=false`, `frozenAt=null`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-09 · 재고 목록은 소진된 배치도 포함해 본인 것 전부를 반환한다

- **Given** 사용자 A의 배치 2건(하나는 `finished=true`), 사용자 B의 배치 1건
- **When** 사용자 A가 `GET /api/v1/bean-batches`
- **Then** HTTP `200`, 배열 길이 `2` (finished 포함, B의 배치는 없음)
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-10 · remainingG를 PATCH로 갱신할 수 있다

- **Given** `weightG=200.0`, `remainingG=200.0`인 배치
- **When** 소유자가 `remainingG=120.0`으로 `PATCH /api/v1/bean-batches/{id}`
- **Then** HTTP `200`, `remainingG=120.0`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-11 · finished를 PATCH로 토글할 수 있다

- **Given** `finished=false`인 배치
- **When** 소유자가 `finished=true`로 `PATCH`
- **Then** HTTP `200`, `finished=true`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-12 · frozen을 true로 바꾸면 frozenAt이 서버 시각으로 기록된다

- **Given** `frozen=false`인 배치
- **When** 소유자가 `frozen=true`로 `PATCH`
- **Then** HTTP `200`, `frozenAt`이 `null`이 아니고 요청 처리 시각과 일치
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-13 · frozen을 false로 되돌리면 frozenAt이 null로 초기화된다

- **Given** `frozen=true`, `frozenAt`이 값이 있는 배치
- **When** 소유자가 `frozen=false`로 `PATCH`
- **Then** HTTP `200`, `frozenAt=null`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-14 · 삭제하면 소유자도 조회할 수 없다

- **Given** 소유자의 배치
- **When** `DELETE /api/v1/bean-batches/{id}` 후 같은 사용자가 `GET /api/v1/bean-batches/{id}`
- **Then** DELETE는 HTTP `204`, 이어진 GET은 HTTP `404`와 `code: "NOT_FOUND"`. DB의 `deleted_at`은 `null`이 아니다
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-15 · daysOffRoast는 roastedAt부터 오늘까지의 일수다

- **Given** `roastedAt`이 오늘로부터 5일 전인 배치
- **When** 소유자가 `GET /api/v1/bean-batches/{id}`
- **Then** HTTP `200`, `daysOffRoast=5`, `degassingStatus="IDEAL"`
- **검증** API 테스트 `BeanControllerTest`

### 경계값

> 모든 범위는 **양끝을 포함**한다.

#### AC-BEAN-20 · 로스터 name 100자는 허용된다

- **When** 100자 `name`으로 로스터 생성
- **Then** HTTP `201`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-21 · 로스터 name 101자는 거부된다

- **When** 101자 `name`으로 로스터 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-22 · 원두 상품 name 100자는 허용된다

- **When** 100자 `name`으로 원두 상품 생성
- **Then** HTTP `201`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-23 · 원두 상품 name 101자는 거부된다

- **When** 101자 `name`으로 원두 상품 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-24 · weightG 10.0은 허용된다

- **When** `weightG=10.0`으로 재고 생성
- **Then** HTTP `201`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-25 · weightG 9.9는 거부된다

- **When** `weightG=9.9`로 재고 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-26 · weightG 5000.0은 허용된다

- **When** `weightG=5000.0`으로 재고 생성
- **Then** HTTP `201`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-27 · weightG 5000.1은 거부된다

- **When** `weightG=5000.1`로 재고 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-28 · price 0은 허용된다

- **When** `price=0`으로 재고 생성
- **Then** HTTP `201`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-29 · price -1은 거부된다

- **When** `price=-1`로 재고 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-30 · price 1000000은 허용된다

- **When** `price=1000000`으로 재고 생성
- **Then** HTTP `201`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-31 · price 1000001은 거부된다

- **When** `price=1000001`로 재고 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-32 · 경과 2일은 TOO_FRESH다

- **Given** `roastedAt`이 오늘로부터 2일 전인 배치
- **When** 소유자가 조회
- **Then** `daysOffRoast=2`, `degassingStatus="TOO_FRESH"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-33 · 경과 3일은 IDEAL이다

- **Given** `roastedAt`이 오늘로부터 3일 전인 배치
- **When** 소유자가 조회
- **Then** `daysOffRoast=3`, `degassingStatus="IDEAL"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-34 · 경과 14일은 IDEAL이다

- **Given** `roastedAt`이 오늘로부터 14일 전인 배치
- **When** 소유자가 조회
- **Then** `daysOffRoast=14`, `degassingStatus="IDEAL"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-35 · 경과 15일은 PAST_PEAK이다

- **Given** `roastedAt`이 오늘로부터 15일 전인 배치
- **When** 소유자가 조회
- **Then** `daysOffRoast=15`, `degassingStatus="PAST_PEAK"`
- **검증** API 테스트 `BeanControllerTest`

### 에러

#### AC-BEAN-40 · 로스터 이름이 중복되면 거부된다

- **Given** `name="프릳츠커피컴퍼니"`인 로스터가 이미 존재
- **When** 같은 `name`으로 다시 생성
- **Then** HTTP `409`과 `code: "DUPLICATE_NAME"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-41 · 인증 없이 로스터를 생성할 수 없다

- **When** Authorization 헤더 없이 `POST /api/v1/roasters`
- **Then** HTTP `401`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-42 · 존재하지 않는 roasterId는 404다

- **When** `roasterId=999999`로 원두 상품 생성
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-43 · 같은 로스터 안에서 상품 이름이 중복되면 거부된다

- **Given** 로스터 1의 `name="예가체프 내추럴"` 상품이 이미 존재
- **When** 같은 `roasterId`, 같은 `name`으로 다시 생성
- **Then** HTTP `409`과 `code: "DUPLICATE_NAME"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-44 · roastLevel이 없으면 거부된다

- **When** `roastLevel`을 생략하고 원두 상품 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-45 · SINGLE_ORIGIN인데 origins가 2개면 거부된다

- **When** `beanMix="SINGLE_ORIGIN"`, `origins` 2건으로 생성
- **Then** HTTP `400`과 `code: "BEAN_MIX_ORIGIN_MISMATCH"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-46 · BLEND인데 origins가 1개면 거부된다

- **When** `beanMix="BLEND"`, `origins` 1건으로 생성
- **Then** HTTP `400`과 `code: "BEAN_MIX_ORIGIN_MISMATCH"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-47 · 블렌드 ratioPercent 합계가 100이 아니면 거부된다

- **When** `beanMix="BLEND"`, `origins`가 `ratioPercent` `30.0`·`30.0`인 2건으로 생성
- **Then** HTTP `400`과 `code: "BEAN_ORIGIN_RATIO_MISMATCH"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-48 · origins의 country가 없으면 거부된다

- **When** `origins=[{}]`(country 없음)로 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-49 · 존재하지 않는 varietyId는 404다

- **When** `origins=[{country:"ET", varietyId:999999}]`로 생성
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-50 · 존재하지 않는 processId는 404다

- **When** `origins=[{country:"ET", processId:999999}]`로 생성
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-51 · 인증 없이 원두 상품을 생성할 수 없다

- **When** Authorization 헤더 없이 `POST /api/v1/bean-products`
- **Then** HTTP `401`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-52 · 존재하지 않는 원두 상품 조회는 404다

- **When** `GET /api/v1/bean-products/999999`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-53 · 존재하지 않는 beanProductId는 404다

- **When** `beanProductId=999999`로 재고 생성
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-54 · roastedAt이 미래 날짜면 거부된다

- **When** 내일 날짜를 `roastedAt`으로 재고 생성
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-55 · 인증 없이 재고를 생성할 수 없다

- **When** Authorization 헤더 없이 `POST /api/v1/bean-batches`
- **Then** HTTP `401`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-56 · 남의 재고를 조회할 수 없다

- **Given** 사용자 A의 배치
- **When** 사용자 B의 토큰으로 `GET /api/v1/bean-batches/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-57 · 남의 재고를 수정할 수 없다

- **Given** 사용자 A의 배치
- **When** 사용자 B의 토큰으로 `PATCH /api/v1/bean-batches/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`. 배치는 변경되지 않는다
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-58 · 남의 재고를 삭제할 수 없다

- **Given** 사용자 A의 배치
- **When** 사용자 B의 토큰으로 `DELETE /api/v1/bean-batches/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`. `deleted_at`은 `null`로 남는다
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-59 · 존재하지 않는 재고 조회는 404다

- **When** 인증된 사용자가 `GET /api/v1/bean-batches/999999`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-60 · remainingG가 weightG를 초과하면 거부된다

- **Given** `weightG=200.0`인 배치
- **When** 소유자가 `remainingG=200.1`로 `PATCH`
- **Then** HTTP `400`과 `code: "BEAN_BATCH_REMAINING_INVALID"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-61 · remainingG가 음수면 거부된다

- **When** 소유자가 `remainingG=-0.1`로 `PATCH`
- **Then** HTTP `400`과 `code: "BEAN_BATCH_REMAINING_INVALID"`
- **검증** API 테스트 `BeanControllerTest`

#### AC-BEAN-62 · 이미 삭제된 재고를 다시 삭제하면 404다

- **Given** 이미 소프트 삭제된 배치
- **When** 소유자가 `DELETE /api/v1/bean-batches/{id}`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `BeanControllerTest`

---

## 수동 확인

- [ ] Swagger UI에서 실제 로스터·블렌드 원두 상품을 등록하고, 재고를 만들어 `daysOffRoast`·`degassingStatus`가 오늘 날짜 기준으로 눈으로 봐도 맞는지 확인

## 열어둔 결정

- **디게싱 권장 구간(0~2/3~14/15~)이 원두 상품마다 다를 수 있는지** — 지금은 전역 고정값이다. 로스터별·배전도별로 다르게 두고 싶어지면 그때 `bean_products`에 커스텀 구간 컬럼을 추가한다.
- **레시피 API가 `beanProductId`를 실제로 받는 시점** — 이번 스펙은 컬럼만 추가한다. 레시피 쪽 API 확장은 별도 결정.
- **로스터·원두 상품 검증(verify) 관리자 API** — 관리자 기능이 실제로 필요해지는 시점에 함께 다룬다.

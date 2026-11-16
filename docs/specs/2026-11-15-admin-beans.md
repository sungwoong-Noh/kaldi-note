---
id: ADMINBEAN
title: 관리자 원두 메뉴 — 빠진 정보 채우기 · 확인 · 숨김 · 카탈로그로 올리기
status: 구현중
milestone:
supersedes:
---

# 관리자 원두 메뉴 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 시나리오

관리자가 관리자 콘솔의 「원두」 메뉴에서 수집된 원두를 이름·로스터로 찾고, 상태(확인 필요·확인됨·숨김)·출처·「정보 빠짐」으로
좁혀 본다. 행을 누르면 오른쪽 편집 패널에서 배전도·산지·품종·가공 같은 빠진 정보를 채워 저장한다. 여러 행을 골라 한 번에
확인 처리하거나 숨기고, 사용자가 만든 원두는 「카탈로그로 올리기」로 모두에게 공개한다. 수집 실행 상세의 「매핑하지 못한
원문」에서 「이 원두 편집」을 누르면 그 원두의 패널이 해당 칸을 강조한 채 열린다.

관리자가 고친 원두가 다음 수집에서 되돌아가거나 중복되지 않도록, 크롤러는 기존 원두를 **구매 링크(`product_url`)로** 찾는다.

입력: 시안 `docs/design/admin/design/Admin.dc.html` 「원두」 화면, `docs/design/admin/README.md` 1-1절, 결정
`docs/design/kaldi-note-design/docs/DECISIONS.md` 7절(B1~B10, 관리자 원두 질문 12건), 원두 상세 스펙
`docs/specs/2026-11-15-bean-detail.md`.

**선행(충족 — #230, V20):** 원두 상세 스펙이 만든 `bean_products.hidden` · `manually_edited` 컬럼과 크롤러 규칙(숨김 유지,
수동 수정 원두는 `product_url`만 갱신). 이 스펙은 그 컬럼을 켜고 끄는 관리자 API·화면과, 크롤러의 **찾는 열쇠**만
바꾼다. 원두 상세 스펙의 「열어둔 결정」 중 「관리자가 이름을 바꾼 원두의 다음 수집」과 「플래그를 켜는 API」를 해소한다.

### 범위 밖 (Non-goals)

- 원두 병합 (같은 원두 합치기)
- 품종·가공 마스터 추가 (B10 — 선택지에서 고르기만)
- 「수동 수정됨」 되돌리기, 필드별 수집값 보관 (질문 05)
- 동시 편집 충돌 처리 (관리자 두 명이 같은 원두를 동시에 저장하면 나중 저장이 이긴다)
- 산지 국가 필터 (질문 11)
- 원두 삭제 (B4 — 숨김만)
- 수집 실행 결과에 상품 ID를 저장하는 것 (질문 12 — 조회 시점에 이름으로 찾는다)

## 용어

| 용어 | 정의 |
|---|---|
| 크롤러 원두 | `created_by_user_id IS NULL`인 `bean_products` 행 |
| 사용자 원두 | `created_by_user_id`가 있는 행. `promoted=false`이면 만든 사람에게만 검색된다(B8) |
| 올린 원두 | `promoted=true`인 사용자 원두. 모든 사용자에게 검색된다 |
| 상태 | `HIDDEN`(hidden=true) > `VERIFIED`(verified=true) > `NEEDS_REVIEW`. 숨김이 우선(질문 06) |
| 정보 빠짐 | 배전도(`roast_level`) null, 또는 산지 0행, 또는 산지 중 하나라도 품종 null, 또는 가공 null(질문 01) |
| 내용 필드 | name · roasterId · beanMix · roastLevel · roastLevelAgtron · roastLevelCustom · decaf · productUrl · description · origins. `verified` · `hidden`은 내용 필드가 아니다 |
| 기록 수 | 모든 사용자의 기록 중 `bean_product_id`가 그 원두이거나 `bean_batch_id`의 봉투 상품이 그 원두인 것. 공개 범위 무관(질문 09) |

## 데이터

**마이그레이션 하나** — `V22`(원두 상세 `V20`, 수집 결과 보기 `V21`).

| 테이블 | 컬럼 / 인덱스 | 타입 | Null | 설명 |
|---|---|---|---|---|
| `bean_products` | `promoted` | `BOOLEAN NOT NULL DEFAULT false` | N | **신규.** 카탈로그로 올린 사용자 원두 |
| `bean_products` | `uq_bean_products_crawler_url` | `UNIQUE (product_url) WHERE created_by_user_id IS NULL` | — | **신규.** 부분 유일 인덱스. 크롤러 원두끼리만 구매 링크가 겹치지 않는다 |
| `bean_origins` | `ratio_percent` | `NUMERIC(4,1)` | **Y** | **변경(NOT NULL 해제).** 블렌드 비율을 모를 때 비워 둔다(AC-ADMINBEAN-12②). 구현 중 발견 — 기존 값은 그대로 |

운영 데이터(2026-11-15, #227·#228 모모스 수집 보강 **이전**): 원두 123개, `product_url` 있는 118개 전부 서로 다름, 사용자 원두 5개.
그 뒤 수집이 늘었으므로 **구현 전에 다시 조회한다**(Task 1). 크롤러 원두끼리 겹치는 URL이 하나라도 있으면 마이그레이션이 운영에서 실패한다.
데이터 보정 마이그레이션은 없다.

### 크롤러 매칭 변경 (`docs/specs/2026-10-14-bean-crawler.md` 「저장 규칙」의 「상품 동일성」 대체)

`BeanImportService.importBean`이 기존 원두를 찾는 순서:

| 순서 | 조건 | 결과 |
|---|---|---|
| ① | `product_url`이 같은 행이 있음 (소유자 무관) | 그 행. 사용자 원두면 `SKIPPED(USER_OWNED)` |
| ② | ①이 없고 `(roaster_id, name)`이 같은 행이 있음 | 그 행. 사용자 원두면 `SKIPPED(USER_OWNED)`. 크롤러 원두면 `product_url`을 새 값으로 갱신(사이트 URL이 바뀐 경우) |
| ③ | 둘 다 없음 | 새로 만든다 → `CREATED` |

- 크롤러는 **이름을 바꾸지 않는다** — 관리자가 고친 이름은 다시 수집해도 그대로다(질문 04).
- 찾은 크롤러 원두의 나머지 갱신 규칙(수동 수정 원두는 `product_url`만, `hidden` 유지)은 원두 상세 스펙 그대로다.
- `CrawledBean.productUrl`이 null인 경우는 ①을 건너뛴다.

### 검색 규칙 변경 (원두 상세 스펙 `GET /api/v1/bean-products`)

「항상 빠지는 것: `created_by_user_id`가 있고 호출한 사람이 아닌 원두」 → **「`created_by_user_id`가 있고, 호출한 사람이 아니고,
`promoted=false`인 원두」**.

## 계약

모두 ADMIN 전용 — 기존 `SecurityConfig`의 `/api/v1/admin/**` → `hasRole("ADMIN")`. 인증 없음 401, USER 403 — 보안 필터가 내는 응답이라 본문이 없다(`2026-09-05-http-error-contract.md`).

| 메서드 | 경로 | 성공 | 설명 |
|---|---|---|---|
| GET | `/api/v1/admin/bean-products` | 200 | 목록 + 필터 pill 개수 |
| GET | `/api/v1/admin/bean-products/{id}` | 200 | 상세 |
| PUT | `/api/v1/admin/bean-products/{id}` | 200 | 전체 교체 수정. 응답 = 상세 |
| POST | `/api/v1/admin/bean-products/bulk` | 200 | 일괄 확인·숨김·숨김 해제. 응답 `{ "updated": n }` |
| POST | `/api/v1/admin/bean-products/{id}/promote` | 200 | 카탈로그로 올리기. 응답 = 상세 |
| GET | `/api/v1/admin/crawl-runs/{id}` | 200 | **변경.** `unmapped[]` 항목에 `beanProductId` 추가 |

### 목록 — `GET /api/v1/admin/bean-products`

| 파라미터 | 값 | 규칙 |
|---|---|---|
| `q` | 문자열 | 앞뒤 공백 제거 후 1~50자. 이름 **또는** 로스터 이름 부분 일치, 대소문자 무시. 비었거나 공백뿐이면 조건 없음. 51자 이상 400 `INVALID_REQUEST` |
| `status` | `NEEDS_REVIEW` / `VERIFIED` / `HIDDEN` | 없으면 전체. 그 밖의 값 400 |
| `source` | `CRAWLER` / `USER` | 없으면 전체. 그 밖의 값 400 |
| `missing` | `true` | 「정보 빠짐」만 |
| `decaf` | `true` | 디카페인만 |
| `roasterId` | 정수 | 그 로스터만. 없는 id면 결과 0 (404 아님) |
| `page` / `size` | 정수 | `page` 0부터, `size` 기본 20, 1~100. 범위 밖 400 |

정렬: `updatedAt` 내림차순 → `id` 내림차순. 응답은 `PageResponse`에 `counts`를 더한다.

```json
{
  "content": [
    {
      "id": 231, "name": "에티오피아 반자 위요", "roasterId": 3, "roasterName": "해월커피",
      "beanMix": "SINGLE_ORIGIN", "roastLevel": null, "roastLevelAgtron": null, "roastLevelCustom": null,
      "countries": ["에티오피아"], "originCount": 1,
      "verified": false, "hidden": false, "manuallyEdited": false, "promoted": false,
      "source": "CRAWLER", "creatorNickname": null,
      "missing": ["roastLevel", "process"],
      "brewCount": 4, "updatedAt": "2026-11-15T01:20:00Z"
    }
  ],
  "page": 0, "size": 20, "totalElements": 123, "totalPages": 7,
  "counts": {
    "all": 123, "needsReview": 98, "verified": 20, "hidden": 5, "missing": 61,
    "missingBy": { "roastLevel": 21, "origin": 4, "variety": 40, "process": 12 }
  }
}
```

- `missing[]`는 `roastLevel` → `origin` → `variety` → `process` 순서, 해당하는 것만. `origin`이 있으면(산지 0행) `variety`·`process`는 넣지 않는다.
- `countries`는 산지 순서대로 중복 없이. 산지 0행이면 `[]`.
- `counts`는 `q`·`source`·`decaf`·`roasterId`를 적용하고 `status`·`missing`은 **적용하지 않고** 센다. `missingBy`는 같은 범위에서 항목별 원두 수(한 원두가 여러 항목에 셀 수 있다).
- null 필드는 전역 `non_null` 설정에 따라 빠진다. 위 예시의 `null`은 「없음」.

### 상세 — `GET /api/v1/admin/bean-products/{id}`

목록 행 필드 + 아래.

| 필드 | 타입 | 설명 |
|---|---|---|
| `decaf` | boolean | |
| `productUrl` | string? | |
| `description` | string? | 컵노트 원문 |
| `origins[]` | `{country, region?, farm?, altitudeMinM?, altitudeMaxM?, varietyId?, varietyName?, processId?, processName?, ratioPercent?}` | 산지 순서 |
| `createdAt` | 시각 | |
| `sameNameCount` | int | 이 원두를 뺀, 이름이 정확히 같은(대소문자 무시) 크롤러 원두·올린 원두 수. 올리기 모달 경고용 |

### 수정 — `PUT /api/v1/admin/bean-products/{id}`

```json
{
  "name": "에티오피아 반자 위요", "roasterId": 3, "beanMix": "SINGLE_ORIGIN",
  "roastLevel": "LIGHT", "roastLevelAgtron": 92, "roastLevelCustom": null, "decaf": false,
  "productUrl": "https://unspecialty.com/product/…/231/", "description": "자스민, 복숭아",
  "origins": [{ "country": "에티오피아", "region": "구지", "farm": null, "altitudeMinM": 1900, "altitudeMaxM": 2100,
                "varietyId": 4, "processId": 2, "ratioPercent": null }],
  "verified": false, "hidden": false
}
```

| 항목 | 규칙 |
|---|---|
| 필드 제약 | 기존 `BeanProductCreateRequest` · `OriginRequest`와 같다 — `name` 1~100자 필수, `roasterId` 필수, `beanMix` 필수, `roastLevelCustom` ≤100, `productUrl` ≤500, `description` ≤2000, 산지 `country` 필수 ≤100, `region`·`farm` ≤100. **`roastLevel`은 null 허용** (생성 DTO와 다름) |
| 싱글/블렌드 | `SINGLE_ORIGIN`은 산지 정확히 1행. `BLEND`는 산지 0행 또는 2행 이상. 어긋나면 400 `BEAN_MIX_ORIGIN_MISMATCH` |
| 비율 | 싱글은 `ratioPercent`를 무시하고 `100.0`으로 저장. 블렌드는 모든 행 null이거나, 모든 행 값이 있고 합이 정확히 `100.0`. 어긋나면 400 `BEAN_ORIGIN_RATIO_MISMATCH` (질문 10) |
| `manually_edited` | 내용 필드가 하나라도 저장된 값과 다르면 `true`. 이미 `true`면 그대로(되돌리지 않음). `verified`·`hidden`만 바뀌면 그대로 |
| `verified` | 저장해도 자동으로 `true`가 되지 않는다(질문 03). 요청 값 그대로 |
| 이름 중복 | 같은 `roasterId`에 같은 `name`의 다른 행 → 409 `DUPLICATE_NAME` |
| URL 중복 | 이 원두가 크롤러 원두이고, 다른 크롤러 원두가 같은 `productUrl` → 409 `BEAN_PRODUCT_URL_DUPLICATE` (**신규 ErrorCode**) |
| 참조 | 없는 원두·`roasterId`·`varietyId`·`processId` → 404 `NOT_FOUND` |
| 소유자 | 사용자 원두도 수정할 수 있다. `created_by_user_id`는 바뀌지 않는다 |

### 일괄 — `POST /api/v1/admin/bean-products/bulk`

```json
{ "ids": [231, 232, 240], "action": "HIDE" }
```

- `ids` 1~100개, 중복은 한 번으로 친다. `action`: `VERIFY`(verified=true) / `HIDE`(hidden=true) / `UNHIDE`(hidden=false).
- 한 트랜잭션. 없는 id가 하나라도 있으면 404 `NOT_FOUND`이고 아무것도 바뀌지 않는다.
- `manually_edited`는 바꾸지 않는다. 이미 그 상태인 행도 `updated`에 센다. 응답 `{ "updated": 3 }`.
- `ids` 0개 · 101개 이상 · 잘못된 `action` → 400 `INVALID_REQUEST`.

### 올리기 — `POST /api/v1/admin/bean-products/{id}/promote`

- 사용자 원두 → `promoted=true`, `created_by_user_id` 유지(질문 08). 이미 `true`여도 200(멱등).
- 크롤러 원두 → 400 `INVALID_REQUEST`. 없는 원두 → 404 `NOT_FOUND`.
- 로스터 조건(질문 07 「로스터 필수」)은 `roaster_id NOT NULL`(V7)이라 항상 충족된다 — 시안의 「로스터 없음 → 차단」 상태는 구현하지 않는다.
- 같은 이름 경고는 상세의 `sameNameCount`로 화면이 그린다. 서버는 막지 않는다.

### 실행 상세 연결 — `GET /api/v1/admin/crawl-runs/{id}`

`unmapped[]` 각 항목에 `beanProductId`를 더한다. 조회 시점에 `bean_products.name`이 항목의 `name`과 정확히 같은 행이
**1개**면 그 id, 0개 또는 2개 이상이면 null(응답에서 빠짐 → 화면 「카탈로그에 없음」, 질문 12). 저장 형식(`crawl_runs.unmapped`)은 바꾸지 않는다.

신설 `ErrorCode`: `BEAN_PRODUCT_URL_DUPLICATE`(409). 나머지는 기존 코드를 쓴다.

## 화면

경로 `/admin/beans`. 좌측 메뉴 카탈로그 묶음의 「원두 수집」 바로 아래 「원두」. 시각·문구는 시안(`Admin.dc.html` 「원두」 화면,
README 1-1절)이 정본이다(ADR 0010). 아래는 동작 규칙만.

| 요소 | 규칙 |
|---|---|
| 검색 | 이름·로스터 검색 input. 입력 250ms 뒤 한 번 요청. `보이는 수 / 전체`는 `totalElements / counts.all` |
| 필터 pill | 상태(전체·확인 필요·확인됨·숨김 + `counts`) · 출처(전체·크롤러·사용자) / 좁히기(정보 빠짐 `counts.missing` · 디카페인 토글) · 로스터(전체 + `GET /api/v1/roasters`) |
| 정보 빠짐 배너 | `counts.missing ≥ 40`이면 표 위 배너. 가장 많이 빠진 항목 = `missingBy` 최댓값(동률이면 `roastLevel`→`origin`→`variety`→`process` 순 앞) |
| 표 | 시안 열 순서. 상태 태그는 「용어」의 우선순위. 숨긴 행은 이름이 흐린 색 |
| 선택 바 | `n개 선택` + 「확인 처리」(선택 중 `verified=false`가 있을 때) · 「숨기기」(`hidden=false`가 있을 때) · 「숨김 해제」(`hidden=true`가 있을 때) · 「선택 해제」. 헤더 체크박스 = 현재 페이지 전체 |
| 일괄 숨김 | 확인 모달(원두별 기록 수, `brewCount ≥ 10`인 원두가 있으면 굵은 경고) → 확인 시 `bulk HIDE`. 확인 처리·숨김 해제는 모달 없이 바로 |
| 편집 패널 | 시안 순서. 「저장」은 내용·상태 중 바뀐 값이 있고 비율 오류가 없을 때만 활성. 저장 중 비활성 「저장 중…」. 실패 시 입력 유지 + 장비 화면과 같은 실패 문구. 성공 시 본문 배너 「{이름}을(를) 저장했습니다. 다시 수집해도 이름·링크 외에는 덮어쓰지 않습니다.」 |
| 비율 검사 (화면) | 블렌드에서 비율 칸이 일부만 채워졌거나 합이 100이 아니면 비율 칸 강조 + 문장 `비율 합 n / 100 %`, 저장 비활성 |
| 선택지에 없는 가공 | 「매핑하지 못한 원문」에서 들어왔고 `field=process`이면 가공 칸 아래 안내 「{원문}은 가공 선택지에 없습니다. 이번엔 선택지에서만 고를 수 있어요 — 가장 가까운 값을 고르거나 비워 두세요.」 (`variety`도 같은 형식) |
| 숨긴 원두 패널 | 위에 안내 + 「숨김 해제」(→ `bulk UNHIDE` 1개) |
| 사용자 원두 패널 | 위에 안내 + 하단 「카탈로그로 올리기」 → 모달(만든 사람 · 로스터 · 기록 수, `sameNameCount ≥ 1`이면 「같은 이름의 카탈로그 원두가 n개 있습니다」 경고) → `promote`. 올린 원두는 버튼 대신 「카탈로그에 올림」 표시 |
| 수집 원문 연결 | 실행 상세 「매핑하지 못한 원문」 각 행 오른쪽: `beanProductId`가 있으면 「이 원두 편집」 링크 `/admin/beans?id={id}&run={runId}&field={field}&raw={원문}`, 없으면 「카탈로그에 없음」(링크 아님) |
| 연결 진입 | `id`가 있으면 그 원두 패널을 연다. `run`·`field`·`raw`가 있으면 패널 위 고정 배너 `Run #{run} · 매핑하지 못한 원문 · {field}` + 원문, 해당 칸(`roastLevel`→배전도, `variety`→첫 산지 품종, `process`→첫 산지 가공)을 accent 테두리 + 포커스 링으로 강조하고 그 칸까지 스크롤 |
| 결과 0 | 표 자리에 「조건에 맞는 원두가 없습니다」 + 「필터 초기화」 |
| 1280 미만 | 시안 RESP: 산지·수정일 열 숨김, 로스터는 이름 아래 줄. 패널은 오버레이 420(스크림). 960 미만은 관리자 공통 안내 |

---

## 인수 조건

### 기능 — 목록 · 상세 API

#### AC-ADMINBEAN-01 · 이름 또는 로스터 이름으로 찾는다

- **Given** `에티오피아 구지 함벨라`(로스터 `산책 로스터스`), `케냐 키리냐가`(로스터 `해월커피`), `Ethiopia Guji`(로스터 `산책 로스터스`)
- **When** ① `q=함벨` ② `q=해월` ③ `q=guji`, 원두 이름이 `Ethiopia Guji`인 경우 포함
- **Then** ① 함벨라 1건(부분 일치) ② 키리냐가 1건(로스터 이름) ③ `Ethiopia Guji` 1건(대소문자 무시)
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-02 · 상태 필터는 숨김이 우선이다

- **Given** A(verified=false, hidden=false), B(verified=true, hidden=false), C(verified=true, hidden=true)
- **When** `status=NEEDS_REVIEW` / `VERIFIED` / `HIDDEN`
- **Then** [A] / [B] / [C]. 상태 없음이면 [A, B, C]
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-03 · 출처·디카페인·로스터 필터는 AND다

- **Given** 크롤러 원두 D1(디카페인, 로스터 3), D2(로스터 3), 사용자 원두 U1(디카페인, 로스터 3)
- **When** `source=CRAWLER&decaf=true&roasterId=3`
- **Then** [D1]. `source=USER`면 [U1]
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-04 · 「정보 빠짐」 네 경우와 missing 배열

- **Given** M1 배전도 null(산지 완전) · M2 산지 0행(블렌드, 배전도 있음) · M3 산지 1행 품종 null · M4 산지 2행 중 하나 가공 null · F 모두 채움
- **When** `missing=true`
- **Then** [M1, M2, M3, M4], F 없음. `missing`은 M1 `["roastLevel"]`, M2 `["origin"]`, M3 `["variety"]`, M4 `["process"]`. `missing=true` 없이 조회하면 F의 `missing=[]`
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-05 · 기록 수는 모든 사용자 · 비공개 · 봉투 기록을 센다

- **Given** 원두 45에 대해: 사용자 2의 PRIVATE 기록(`bean_product_id=45`) 1개, 사용자 1의 봉투(상품 45) 기록 1개, 사용자 1의 `bean_product_id=45` 기록 1개, 다른 원두 기록 1개
- **When** 목록 조회
- **Then** 원두 45의 `brewCount=3`
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-06 · counts는 status · missing을 빼고 나머지 필터를 적용한다

- **Given** AC-02의 A·B·C(모두 로스터 3, A만 배전도 null, B·C는 정보 완전) + 로스터 5의 E(verified=false, 배전도 null)
- **When** `roasterId=3&status=VERIFIED&missing=true`
- **Then** `counts = {all:3, needsReview:1, verified:1, hidden:1, missing:1}`, `missingBy.roastLevel=1`, E는 세지 않음
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-07 · 수정일 내림차순 20개

- **Given** 원두 25개, `updatedAt`이 모두 다름
- **When** 파라미터 없이 조회
- **Then** `content` 20개, 첫 행이 가장 최근 `updatedAt`, `totalElements=25`. `updatedAt`이 같으면 `id` 큰 것이 앞
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-08 · 상세에 산지 이름 · 만든 사람 · 같은 이름 수가 온다

- **Given** 사용자 원두 `하늘 블렌드`(만든 사람 닉네임 `원두러버`, 산지 2행: 1행 품종 `에어룸`·가공 `Washed`, 2행 품종·가공 null), 크롤러 원두 `하늘 블렌드`(다른 로스터) 1개
- **When** 상세 조회
- **Then** `source="USER"`, `creatorNickname="원두러버"`, 1행 `varietyName="에어룸"`·`processName="Washed"`, 2행 이름 필드 없음, `sameNameCount=1`, `createdAt` 있음
- **검증** `AdminBeanProductControllerTest`

### 기능 — 수정 · 일괄 · 올리기 API

#### AC-ADMINBEAN-10 · 빠진 배전도를 채우면 수동 수정됨이 된다

- **Given** 크롤러 원두 231, `roastLevel=null`, `manuallyEdited=false`
- **When** 같은 값에 `roastLevel=LIGHT`, `roastLevelAgtron=92`만 바꿔 PUT
- **Then** 200, `roastLevel="LIGHT"`, `roastLevelAgtron=92`, `manuallyEdited=true`, `verified=false`(자동으로 켜지지 않음)
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-11 · 상태만 바꾸면 수동 수정됨은 그대로다

- **Given** 크롤러 원두 231, `manuallyEdited=false`, `verified=false`
- **When** 내용 필드는 저장값 그대로, `verified=true`로 PUT
- **Then** 200, `verified=true`, `manuallyEdited=false`
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-12 · 블렌드는 산지 0행 · 비율 없음 · 합 100을 받는다

- **Given** 블렌드 원두
- **When** ① 산지 0행 ② 산지 2행 비율 모두 null ③ 산지 2행 `50.0`/`50.0`
- **Then** 셋 다 200. ②는 저장된 두 행 `ratioPercent` null, ③은 50.0/50.0
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-13 · 일괄 확인 · 숨김 · 숨김 해제

- **Given** 원두 1·2·3 모두 `verified=false`, `hidden=false`, `manuallyEdited=false`
- **When** ① `VERIFY [1,2,3]` ② `HIDE [1,2]` ③ `UNHIDE [2]`
- **Then** ① `updated=3`, 셋 다 verified ② `updated=2` ③ `updated=1`. 최종 1 hidden, 2·3 visible, 세 원두 `manuallyEdited=false`, 1의 `verified=true` 유지(질문 06)
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-14 · 올린 원두는 다른 사용자 검색에도 나온다

- **Given** 사용자 1이 만든 `하늘 블렌드 A`(`promoted=false`)
- **When** promote 후 사용자 2가 `GET /api/v1/bean-products?q=하늘`
- **Then** promote 응답 `promoted=true`, `source="USER"`(created_by_user_id 유지). 사용자 2의 검색 결과에 `하늘 블렌드 A` 포함. promote 전에는 미포함
- **검증** `AdminBeanProductControllerTest`, `BeanProductControllerTest`

#### AC-ADMINBEAN-15 · 올리기는 멱등이다

- **Given** `promoted=true`인 사용자 원두
- **When** 다시 promote
- **Then** 200, `promoted=true`
- **검증** `AdminBeanProductControllerTest`

### 기능 — 크롤러 · 연결

#### AC-ADMINBEAN-20 · 관리자가 이름을 고친 원두는 같은 링크로 다시 찾는다

- **Given** 크롤러 원두 `(해월커피, 에티오피아 반자 위요 내추)`, `product_url=https://u.example/231`. 관리자가 이름을 `에티오피아 반자 위요 내추럴`로 고침
- **When** 크롤러가 이름 `에티오피아 반자 위요 내추`, URL `https://u.example/231`로 import
- **Then** 결과 `UNCHANGED`(크롤러는 이름을 바꾸지 않아 바뀐 값이 없다 — #236 수집 결과 보기의 「값이 그대로면 UNCHANGED」), 이름은 `에티오피아 반자 위요 내추럴` 그대로, `bean_products` 행 수 변화 없음
- **검증** `BeanImportServiceTest`

#### AC-ADMINBEAN-21 · 링크로 못 찾으면 로스터 · 이름으로 찾고 링크를 갱신한다

- **Given** 크롤러 원두 `(해월커피, 케냐 키리냐가)`, `product_url=https://u.example/old`
- **When** 같은 이름, URL `https://u.example/new`로 import
- **Then** 결과 `UPDATED`, `product_url="https://u.example/new"`, 행 수 변화 없음
- **검증** `BeanImportServiceTest`

#### AC-ADMINBEAN-22 · 사용자 원두와 링크가 같으면 건너뛴다

- **Given** 사용자 원두(이름 `내 키리냐가`), `product_url=https://u.example/77`
- **When** 크롤러가 이름 `케냐 키리냐가`, URL `https://u.example/77`로 import
- **Then** `SKIPPED(USER_OWNED)`, 사용자 원두 변화 없음, 새 행 없음
- **검증** `BeanImportServiceTest`

#### AC-ADMINBEAN-23 · 실행 상세의 원문은 이름이 하나로 맞을 때만 원두로 이어진다

- **Given** 실행 128의 unmapped `[{name:"A"}, {name:"B"}, {name:"C"}]`. 원두 이름 `A` 1개(id 231), `B` 0개, `C` 2개(로스터 다름)
- **When** `GET /api/v1/admin/crawl-runs/128`
- **Then** A 항목 `beanProductId=231`, B·C 항목은 `beanProductId` 없음
- **검증** `CrawlAdminControllerTest`

### 기능 — 화면

#### AC-ADMINBEAN-30 · 필터 pill에 개수가 붙고 선택 바 버튼은 선택에 따라 보인다

- **Given** `counts={all:123, needsReview:98, verified:20, hidden:5, missing:61}`. 선택: ① verified=false·hidden=false 1개 ② hidden=true 1개
- **When** 화면 렌더 / 행 선택
- **Then** pill에 `확인 필요 98`·`확인됨 20`·`숨김 5`·`정보 빠짐 61`. ① 「확인 처리」·「숨기기」 보임, 「숨김 해제」 없음 ② 「숨김 해제」 보임, 「숨기기」 없음, 「확인 처리」 보임(verified=false인 경우)
- **검증** `admin/beans/page.test.tsx`

#### AC-ADMINBEAN-31 · 저장 버튼은 바뀐 값이 있고 비율 오류가 없을 때만 켜진다

- **Given** 패널에 원두 231
- **When** ① 아무것도 안 바꿈 ② 배전도 변경 ③ 블렌드 비율 `60`/빈칸 ④ 저장 클릭 후 응답 대기
- **Then** ① 비활성 ② 활성 ③ 비활성 + `비율 합 60 / 100 %` 강조 ④ 비활성 「저장 중…」 → 성공 후 배너 「에티오피아 반자 위요을(를) 저장했습니다. 다시 수집해도 이름·링크 외에는 덮어쓰지 않습니다.」
- **검증** `admin/beans/BeanEditPanel.test.tsx`

#### AC-ADMINBEAN-32 · 일괄 숨김은 확인 모달을 거치고 기록 10개 이상이면 굵게 경고한다

- **Given** 선택 2개: `brewCount` 3, 12
- **When** 「숨기기」
- **Then** 모달에 두 원두와 기록 수, 굵은 경고 1줄. 「숨기기」 확인 시 `bulk HIDE [두 id]` 1회 호출. 「확인 처리」는 모달 없이 바로 `bulk VERIFY`
- **검증** `admin/beans/page.test.tsx`

#### AC-ADMINBEAN-33 · 사용자 원두는 카탈로그로 올리기 모달을 거친다

- **Given** 사용자 원두 패널, `sameNameCount=1`
- **When** 「카탈로그로 올리기」 → 모달 확인
- **Then** 모달에 만든 사람·로스터·기록 수 + 「같은 이름의 카탈로그 원두가 1개 있습니다」. 확인 시 promote 1회. 이후 버튼 자리에 「카탈로그에 올림」. 크롤러 원두 패널에는 버튼 없음
- **검증** `admin/beans/BeanEditPanel.test.tsx`

#### AC-ADMINBEAN-34 · 수집 원문에서 들어오면 패널이 열리고 칸이 강조된다

- **Given** 실행 상세 unmapped 항목 `{name:"A", field:"process", raw:"카보닉 허니", beanProductId:231}`, `{name:"B", field:"variety", raw:"X"}`(id 없음)
- **When** 실행 상세 렌더 → A의 「이 원두 편집」 클릭
- **Then** A 행 링크 `/admin/beans?id=231&run=128&field=process&raw=카보닉%20허니`, B 행은 링크 없이 「카탈로그에 없음」. 이동 후 원두 231 패널이 열리고 배너 `Run #128 · 매핑하지 못한 원문 · process` + `카보닉 허니`, 첫 산지 가공 칸에 강조 클래스와 포커스, 가공 칸 아래 「카보닉 허니은 가공 선택지에 없습니다. …」
- **검증** `admin/crawl/page.test.tsx`, `admin/beans/page.test.tsx`

#### AC-ADMINBEAN-35 · 숨긴 원두 패널은 안내와 숨김 해제를 보인다

- **Given** `hidden=true` 원두 패널
- **When** 렌더 → 「숨김 해제」
- **Then** 패널 위 숨김 안내, 「숨김 해제」 클릭 시 `bulk UNHIDE [id]` 1회
- **검증** `admin/beans/BeanEditPanel.test.tsx`

#### AC-ADMINBEAN-36 · 결과 0과 정보 빠짐 40건 이상

- **Given** ① `totalElements=0` ② `counts.missing=40`, `missingBy={roastLevel:21, origin:4, variety:21, process:12}` ③ `counts.missing=39`
- **When** 렌더
- **Then** ① 「조건에 맞는 원두가 없습니다」 + 「필터 초기화」 ② 배너에 40건과 가장 많이 빠진 항목 「배전도 21」(동률은 roastLevel 우선) ③ 배너 없음
- **검증** `admin/beans/page.test.tsx`

#### AC-ADMINBEAN-37 · 메뉴에 「원두」가 원두 수집 아래 있다

- **Given** 관리자 레이아웃
- **When** 렌더
- **Then** 카탈로그 묶음 순서 `원두 수집` → `원두`, `원두` 링크 `/admin/beans`
- **검증** `admin/layout.test.tsx`

### 엣지 (경계값)

#### AC-ADMINBEAN-40 · q · size 경계

- **When** `q` 50자 / 51자, `size` 1 / 100 / 0 / 101
- **Then** 200 / 400 `INVALID_REQUEST`, 200 / 200 / 400 `INVALID_REQUEST` / 400 `INVALID_REQUEST`. 공백뿐인 `q`는 조건 없음(전체)
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-41 · 블렌드 비율 합 경계

- **When** 2행 비율 ① `49.9`/`50.0`(99.9) ② `50.1`/`50.0`(100.1) ③ `40.0`/`60.0`
- **Then** ① ② 400 `BEAN_ORIGIN_RATIO_MISMATCH` ③ 200
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-42 · 일괄 ids 개수 경계

- **When** `ids` 0개 / 1개 / 100개 / 101개
- **Then** 400 `INVALID_REQUEST` / 200 / 200 / 400 `INVALID_REQUEST`
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-43 · 싱글 · 블렌드 산지 수 경계

- **When** ① 싱글 산지 0행 ② 싱글 2행 ③ 블렌드 1행
- **Then** 셋 다 HTTP `400`과 `code: "BEAN_MIX_ORIGIN_MISMATCH"`
- **검증** `AdminBeanProductControllerTest`

### 실패

#### AC-ADMINBEAN-50 · 관리자가 아니면 막는다

- **Given** 목록·상세·수정·일괄·올리기 다섯 경로
- **When** ① 인증 없음 ② USER 토큰
- **Then** ① HTTP `401` ② HTTP `403` (다섯 경로 모두). 보안 필터의 401·403은 본문이 없다(`2026-09-05-http-error-contract.md`)
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-51 · 없는 대상은 404이고 일괄은 아무것도 바꾸지 않는다

- **When** ① 없는 원두 상세·수정·올리기 ② 수정에 없는 `roasterId` · `varietyId` · `processId` ③ `bulk HIDE [1, 999999]`
- **Then** 모두 HTTP `404`와 `code: "NOT_FOUND"`. ③ 뒤 원두 1의 `hidden`은 그대로
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-52 · 같은 로스터의 같은 이름

- **Given** 로스터 3에 `케냐 키리냐가`(id 10)와 `케냐 니에리`(id 11)
- **When** 11의 이름을 `케냐 키리냐가`로 PUT
- **Then** HTTP `409`와 `code: "DUPLICATE_NAME"`
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-53 · 다른 크롤러 원두의 구매 링크

- **Given** 크롤러 원두 10(`https://u.example/10`), 11(`https://u.example/11`), 사용자 원두 12
- **When** ① 11의 `productUrl`을 `https://u.example/10`으로 PUT ② 12의 `productUrl`을 `https://u.example/10`으로 PUT
- **Then** ① HTTP `409`와 `code: "BEAN_PRODUCT_URL_DUPLICATE"` ② 200 (사용자 원두는 인덱스 밖)
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-54 · 블렌드 비율 일부만

- **When** 블렌드 2행 비율 `60.0` / null
- **Then** HTTP `400`과 `code: "BEAN_ORIGIN_RATIO_MISMATCH"`
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-55 · 크롤러 원두는 올릴 수 없다

- **When** 크롤러 원두에 promote
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** `AdminBeanProductControllerTest`

#### AC-ADMINBEAN-56 · 저장 실패 시 입력을 유지한다

- **Given** 패널에서 배전도를 바꾼 상태, PUT이 500
- **When** 저장
- **Then** 바꾼 배전도 값 유지, 실패 문구 표시, 「저장」 다시 활성
- **검증** `admin/beans/BeanEditPanel.test.tsx`

### 비기능

#### AC-ADMINBEAN-60 · 목록 쿼리 수는 페이지 크기와 무관하다

- **Given** 원두 500개(산지 1~3행, 기록 0~5개)
- **When** `size=20`과 `size=100`으로 조회하며 Hibernate statement 수를 센다
- **Then** 두 경우 statement 수가 같다 (행마다 산지·기록 수를 따로 조회하지 않는다)
- **검증** `AdminBeanProductQueryTest`

#### AC-ADMINBEAN-61 · 마이그레이션 뒤 기존 원두의 promoted는 false이고 크롤러 URL은 유일하다

- **Given** 마이그레이션 전 크롤러 원두 2개(URL 다름), 사용자 원두 2개(같은 URL)
- **When** 마이그레이션 적용 후 크롤러 원두 하나를 다른 크롤러 원두와 같은 URL로 INSERT
- **Then** 4행 모두 `promoted=false`, 사용자 원두 2개는 그대로 존재, 크롤러 INSERT는 unique 위반
- **검증** `BeanProductMigrationTest`

---

## 구현 순서

각 태스크는 TDD 사이클 하나(실패 테스트 → 실패 확인 → 최소 구현 → 통과 확인 → 커밋). **선행: 원두 상세 스펙의 마이그레이션·크롤러 규칙 — 충족(#230).**

- [x] **Task 1: 마이그레이션** — Covers: AC-ADMINBEAN-61

  **먼저 운영 DB에서 겹치는 구매 링크가 없는지 조회한다** — 결과가 0행이 아니면 멈추고 사람에게 알린다.

  ```sql
  SELECT product_url, count(*) FROM bean_products
  WHERE created_by_user_id IS NULL AND product_url IS NOT NULL
  GROUP BY product_url HAVING count(*) > 1;
  ```

  ```sql
  ALTER TABLE bean_products ADD COLUMN promoted BOOLEAN NOT NULL DEFAULT false;
  CREATE UNIQUE INDEX uq_bean_products_crawler_url ON bean_products (product_url)
    WHERE created_by_user_id IS NULL;
  ```

  `BeanProduct`에 `promoted` 필드와 `promote()`.

- [x] **Task 2: 크롤러 매칭** — Covers: AC-ADMINBEAN-20, 21, 22

  `BeanProductRepository.findByProductUrl(String)` 추가. `importBean`의 `existing`을
  `findByProductUrl(url).or(() -> findByRoasterIdAndName(...))`로 바꾸고, ② 경로로 찾은 크롤러 원두는 `product_url` 갱신.
  `updateFromCrawl`은 이름을 받지 않는다(지금도 그렇다 — 확인만).

- [x] **Task 3: 목록 · 상세 API** — Covers: AC-ADMINBEAN-01~08, 40, 50(목록·상세), 60

  `catalog.presentation.AdminBeanProductController`, `catalog.application.AdminBeanProductService`.
  목록은 원두 id 페이지를 먼저 뽑고, 그 id들로 산지(품종·가공 포함)·기록 수·로스터·닉네임을 각각 **한 번씩** 묶어 조회한다
  (`brewCount`: `brew_logs`를 `bean_product_id`와 `bean_batches.bean_product_id`로 묶은 `GROUP BY`). `missing`은 조회한 산지로 계산.
  `counts`는 같은 WHERE(status·missing 제외)로 집계 쿼리 1개.

- [x] **Task 4: 수정 API** — Covers: AC-ADMINBEAN-10, 11, 12, 41, 43, 51(수정), 52, 53, 54

  `AdminBeanProductUpdateRequest`(생성 DTO 제약 + `roastLevel` nullable + `verified`·`hidden`). 산지 규칙은
  `BeanCatalogService.buildOrigins`와 다르므로(블렌드 0행·비율 null 허용) 관리자 전용 검증을 둔다. 내용 필드 비교로
  `manually_edited`. `ErrorCode.BEAN_PRODUCT_URL_DUPLICATE`(409) 추가 — 저장 전 조회 + unique 위반 예외도 같은 코드로 변환.

- [ ] **Task 5: 일괄 · 올리기 + 검색 규칙** — Covers: AC-ADMINBEAN-13, 14, 15, 42, 51(일괄·올리기), 55, 50(나머지)

  bulk는 `findAllById` 결과 수가 고유 id 수와 다르면 404. 검색(`BeanProductRepository.search` 네이티브 쿼리)의
  `(bp.created_by_user_id is null or bp.created_by_user_id = :userId)`에 `or bp.promoted`를 더한다 — 본 쿼리와 `countQuery` 둘 다.

- [ ] **Task 6: 실행 상세 연결** — Covers: AC-ADMINBEAN-23

  `CrawlRunService.run(id)`에서 unmapped 이름 목록으로 `SELECT name, min(id), count(*) … WHERE name IN (…) GROUP BY name` 1회,
  count=1인 것만 `beanProductId`. `CrawlRunResponse.Unmapped`에 필드 추가. 계약 파일
  `docs/contracts/2026-10-14-bean-crawler.json`의 unmapped 스키마도 갱신.

- [ ] **Task 7: 화면** — Covers: AC-ADMINBEAN-30~37, 56

  `frontend/src/app/admin/beans/page.tsx` + `BeanEditPanel.tsx`, 관리자 레이아웃 메뉴, `admin/crawl` 실행 상세의 원문 행 링크.
  테스트 픽스처는 Task 3~6 API의 실제 응답에서 뜬다(`docs/conventions/frontend.md`). 시각은 `mockup-checker`로 시안 대조.

---

## 수동 확인

- [ ] ★ 운영에서 언스페셜티 원두 1개의 배전도·이름을 고쳐 저장 → 언스페셜티 수집 실행 → 그 원두의 배전도·이름이 고친 값 그대로, 같은 원두의 새 행이 생기지 않음
- [ ] ★ 관리자 콘솔 「원두」 화면을 1440·1280·1024 폭에서 시안과 대조 (`docs/conventions/verification.md`)
- [ ] 사용자 원두 1개를 올린 뒤 다른 계정의 「원두 고르기」 검색에 나오는지

## 열어둔 결정

- **수동 수정 되돌리기 · 필드별 수집값 보관** — 관리자가 고친 값을 수집값으로 되돌릴 필요가 생기면.
- **병합** — 같은 원두가 링크·이름 모두 달라 두 행으로 생긴 경우. 기록 수로 판단할 근거는 이번에 생긴다.
- **실행 결과에 상품 ID 저장** — 이름이 겹치거나 바뀌어 「카탈로그에 없음」이 자주 보이면 `crawl_runs.unmapped`에 `beanProductId`를 저장한다.

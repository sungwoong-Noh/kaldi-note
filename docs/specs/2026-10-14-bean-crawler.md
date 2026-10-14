---
id: CRAWL
title: 원두 크롤러 — 구매처 사이트에서 원두 카탈로그 수집
status: 승인
milestone:
supersedes:
---

# 원두 크롤러 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 시나리오

관리자(우리 둘 중 ADMIN 권한을 가진 사람)가 구매처 하나를 골라 「수집」을 실행하면, 서버가 그
사이트의 원두 상품 페이지를 차례로 읽어 `roasters` / `bean_products` / `bean_origins`(V7)에
넣거나 갱신한다. 원두를 기록할 때 카탈로그를 손으로 채우지 않아도 되게 하는 것이 목적이다.

실행은 비동기다. 실행할 때마다 `crawl_runs`에 한 행이 남고, 상태·생성/갱신 수·건너뛴 상품·
마스터 데이터에 매핑하지 못한 원문을 조회 API로 볼 수 있다. **나중에 만들 관리자 화면은 이
API에 화면만 붙이면 되도록** 설계한다.

첫 구매처는 둘이다.

| key | 사이트 | 목록 | 상세에서 얻는 것 |
|---|---|---|---|
| `momos` | 모모스커피 (imweb, 자체 로스터리) | `https://momos.co.kr/Product_CoffeeBeans` 의 `?idx=N` 링크 | 상품명(국가·농장·품종·가공이 붙어 있음), 컵노트 한 줄. 배전도·고도 없음 |
| `unspecialty` | 언스페셜티 몰 (Cafe24, 여러 로스터리) | `https://unspecialty.com/sitemap.xml` 의 `/product/…/{no}/` | `.uns-detail__spec-key/value` 표: 컵노트·로스팅 포인트·국가·지역·농장·품종·고도·가공방식. 로스터는 상품명 `[…]` |

두 사이트 모두 robots.txt가 상품 경로를 허용한다(2026-10-14 확인).

크롤러는 `crawler` 패키지에 두고, 사이트별 파서(`BeanSource`)는 원문 그대로의 `CrawledBean`만
만든다. 원문 → 표준값 매핑과 저장은 `catalog.application.BeanImportService` 한 곳이 맡는다. 나중에
크롤러를 별도 서버로 뗄 때는 이 경계만 HTTP로 바꾸면 된다.

### 범위 밖 (Non-goals)

- 주기 실행(`@Scheduled`). 나중에 붙일 때는 같은 `CrawlRunService.start(key)`를 부른다
- 관리자 화면. 이번에는 API만 만든다
- 소스별 on/off·주기 설정 저장, 실행 취소
- 가격·품절 여부·판매처 비교 저장 (저장할 칼럼이 없다)
- 컵노트 ↔ `flavor_notes` 연결 (`description`에 원문으로만 넣는다)
- 생산자(`농장주/프로듀서`) 저장
- 마스터 데이터(`varieties`, `coffee_processes`) 자동 추가 — ADR 0006
- 판매처가 다른 같은 원두의 병합, 블렌드 비율 추정
- 모모스·언스페셜티 외 사이트

## 용어

| 용어 | 정의 |
|---|---|
| 소스(source) | 구매처 하나. `BeanSource` 빈 하나에 대응하고 `key`(`momos`, `unspecialty`)로 부른다 |
| 실행(run) | 소스 하나를 한 번 수집한 것. `crawl_runs` 한 행 |
| 원문(raw) | 사이트에 적힌 그대로의 문자열. `CrawledBean`은 원문만 갖는다 |
| 크롤러 소유 행 | `bean_products.created_by_user_id IS NULL`인 행 |
| unmapped | 원문이 있는데 마스터 데이터나 enum에 매핑하지 못한 필드 |

## 데이터

### V17 — `bean_products.roast_level` nullable

| 테이블 | 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|---|
| `bean_products` | `roast_level` | `VARCHAR(20)` | **O** (기존 X) | 배전도를 알 수 없으면 `null`. 모모스는 전부 `null` |

### V18 — 새 테이블 `crawl_runs`

| 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|
| `id` | `BIGSERIAL` PK | X | |
| `source` | `VARCHAR(50)` | X | 소스 key |
| `status` | `VARCHAR(20)` | X | `RUNNING` / `SUCCEEDED` / `FAILED` / `INTERRUPTED` |
| `triggered_by_user_id` | `BIGINT` FK users ON DELETE SET NULL | O | |
| `started_at` | `TIMESTAMPTZ` | X | |
| `finished_at` | `TIMESTAMPTZ` | O | RUNNING이면 `null` |
| `created_count` | `INTEGER` | X | 기본 `0` |
| `updated_count` | `INTEGER` | X | 기본 `0` |
| `skipped` | `JSONB` | X | `[{"name","reason"}]`, 기본 `[]` |
| `unmapped` | `JSONB` | X | `[{"name","field","raw"}]`, 기본 `[]` |
| `error_message` | `VARCHAR(500)` | O | FAILED일 때만 |

인덱스: `(source, started_at DESC)`. JSONB 매핑은 `BrewLog`의 `@JdbcTypeCode(SqlTypes.JSON)`
패턴을 쓴다.

### 저장 규칙

| 항목 | 규칙 |
|---|---|
| 로스터 동일성 | `roasters.name` 완전 일치. 없으면 `is_system=true`, `created_by_user_id=NULL`로 생성 |
| 상품 동일성 | `(roaster_id, name)` — 기존 유일 제약 |
| 신규 상품 | `verified=false`, `created_by_user_id=NULL`, `product_url`=상세 URL, `description`=컵노트 원문 |
| 기존 상품, 크롤러 소유 | 필드 갱신, 산지는 전부 지우고 다시 넣는다 → `updated` |
| 기존 상품, 사용자 소유 | 건드리지 않는다 → skipped `USER_OWNED` |
| 배전도 | 원문 `<단계>[ #N]`. 단계(대소문자 무시): `Light`→`LIGHT`, `Medium Light`→`MEDIUM_LIGHT`, `Medium`→`MEDIUM`, `Medium Dark`→`MEDIUM_DARK`, `Dark`→`DARK`. `#N`은 `roast_level_agtron=N`. 원문 없음 → 둘 다 `null`. 원문 있는데 단계 매핑 실패 → `null` + unmapped `roastLevel` |
| 품종·가공 | 마스터의 `name` 또는 `name_ko`와 대소문자 무시·앞뒤 공백 제거 완전 일치 → FK. 실패 → `null` + unmapped `variety`/`process` |
| 고도 | 쉼표 제거 후 `^(\d+)\s*m$` → min=max. `^(\d+)\s*[-–~]\s*(\d+)\s*m$` → min/max. 그 외 → 둘 다 `null` (unmapped 아님) |
| 블렌드 | 상품명에 `블렌드` 또는 `Blend`(대소문자 무시) → `bean_mix=BLEND`, 산지 0행. 아니면 `SINGLE_ORIGIN`, 산지 1행 `ratio_percent=100.0` |
| 국가·지역·농장 | 원문 그대로. 비어 있으면 `null`. 국가가 `null`인 싱글오리진 → skipped `PARSE_FAILED` (`country` NOT NULL) |

### 모모스 상품명 분해

1. 앞의 `원두 `를 뗀다. 2. 첫 토큰 = 국가. 3. 끝에서 가공 `name_ko`를 최장 일치로 찾는다(2토큰
먼저, 예 `무산소 내추럴`). 4. 그 앞 토큰이 품종 `name_ko`와 일치하면 품종. 5. 남은 토큰 = 농장.
파서는 마스터 목록을 주입받아 분해만 하고, FK 매핑은 `BeanImportService`가 다시 한다.

## 계약

계약 파일: `docs/contracts/2026-10-14-bean-crawler.json` (Task 6에서 작성). 모두 ADMIN 전용 —
기존 `SecurityConfig`의 `/api/v1/admin/**` → `hasRole("ADMIN")`.

| 메서드 | 경로 | 성공 | 설명 |
|---|---|---|---|
| GET | `/api/v1/admin/crawl-sources` | 200 | 소스 목록 + 마지막 실행 |
| POST | `/api/v1/admin/crawl-sources/{key}/runs` | 202 | 실행 시작 |
| GET | `/api/v1/admin/crawl-runs?source=&page=&size=` | 200 | 실행 이력, `started_at` 내림차순, `PageResponse` |
| GET | `/api/v1/admin/crawl-runs/{id}` | 200 | 실행 상세 |

```json
// GET /api/v1/admin/crawl-sources
[
  { "key": "momos", "name": "모모스커피", "listUrl": "https://momos.co.kr/Product_CoffeeBeans", "lastRun": null },
  { "key": "unspecialty", "name": "언스페셜티 몰", "listUrl": "https://unspecialty.com/sitemap.xml",
    "lastRun": { "id": 3, "status": "SUCCEEDED", "startedAt": "2026-10-14T10:00:00Z", "finishedAt": "2026-10-14T10:02:31Z" } }
]

// POST /api/v1/admin/crawl-sources/momos/runs → 202 (응답의 status는 항상 RUNNING)
{ "id": 4, "source": "momos", "status": "RUNNING", "startedAt": "2026-10-14T11:00:00Z" }

// GET /api/v1/admin/crawl-runs/4
{
  "id": 4, "source": "momos", "status": "SUCCEEDED",
  "startedAt": "2026-10-14T11:00:00Z", "finishedAt": "2026-10-14T11:00:24Z",
  "created": 19, "updated": 0,
  "skipped": [ { "name": "원두 …", "reason": "FETCH_FAILED" } ],
  "unmapped": [ { "name": "원두 …", "field": "process", "raw": "허니 무산소" } ],
  "errorMessage": null
}
```

신설 `ErrorCode`: `CRAWL_SOURCE_NOT_FOUND`(404), `CRAWL_ALREADY_RUNNING`(409), `CRAWL_RUN_NOT_FOUND`(404).
skipped `reason`: `USER_OWNED` / `FETCH_FAILED` / `PARSE_FAILED`.

### 실행 동작

- 실행기는 단일 스레드 executor. 테스트는 동기 executor(`Runnable::run`)를 주입한다
- 요청 사이 `1000ms` 대기(주입한 sleeper), 요청 타임아웃 `10s`, `User-Agent: kaldi-note-crawler/1.0`
- 상품 하나 = 트랜잭션 하나. 한 상품의 실패가 실행 전체를 멈추지 않는다
- 목록 요청이 실패하면 실행 전체가 `FAILED`, `error_message`에 원인
- 앱이 뜰 때(`ApplicationReadyEvent`) 남아 있는 `RUNNING` 행은 `INTERRUPTED`, `finished_at`=현재 시각
- `unspecialty`에서 스펙 표에 `로스팅 포인트` 키가 없는 상품은 원두가 아니므로 조용히 제외한다(어느 카운트에도 안 들어감)

---

## 인수 조건

> 파서 AC의 픽스처는 2026-10-14에 받은 실제 HTML이다(`backend/src/test/resources/fixtures/crawler/`).
> 픽스처를 받을 때 목록 개수가 아래 숫자와 다르면, 테스트를 쓰기 전에 이 스펙의 숫자를 실측값으로
> 고친다(status가 `초안`·`승인`인 동안만).

### 기능

#### AC-CRAWL-01 · 모모스 목록에서 상세 URL을 모은다

- **Given** 픽스처 `momos-list.html`
- **When** `MomosSource.parseList(html)`
- **Then** 중복 없는 URL `21`개, 모두 `https://momos.co.kr/Product_CoffeeBeans/?idx=` 로 시작
- **검증** 단위 테스트 `MomosSourceTest`

#### AC-CRAWL-02 · 모모스 상세에서 상품명을 분해한다

- **Given** 픽스처 `momos-4938.html`, 품종·가공 마스터(V3 시드)
- **When** `MomosSource.parseDetail(url, html)`
- **Then** `roasterName="모모스커피"`, `name="원두 에콰도르 산 어거스틴 파카마라 내추럴"`, `roastLevelRaw=null`,
  `cupNotes="적포도, 블랙커런트, 건 무화과, 발효차, 와인같은"`, 산지 1개: `country="에콰도르"`,
  `farm="산 어거스틴"`, `varietyRaw="파카마라"`, `processRaw="내추럴"`, `region=null`, `altitudeRaw=null`
- **검증** 단위 테스트 `MomosSourceTest`

#### AC-CRAWL-03 · 언스페셜티 sitemap에서 상품 URL을 모은다

- **Given** 픽스처 `unspecialty-sitemap.xml`
- **When** `UnspecialtySource.parseList(xml)`
- **Then** `/product/`를 포함하는 `<loc>` URL `132`개
- **검증** 단위 테스트 `UnspecialtySourceTest`

#### AC-CRAWL-04 · 언스페셜티 상세의 스펙 표를 읽는다

- **Given** 픽스처 `unspecialty-920.html`
- **When** `UnspecialtySource.parseDetail(url, html)`
- **Then** `roasterName="커피화 로스터스"`,
  `name="[커피화 로스터스] 콜롬비아 나리뇨 벨라비스타 게이샤 맥주 효모 & 모스토 무산소 발효"`,
  `roastLevelRaw="Light #92"`, `cupNotes="로즈마리, 라벤더, 패션프루트, 오렌지 껍질, 스파이시, 라운드"`,
  산지 1개: `country="Colombia"`, `region="Buesaco, Narino"`, `farm="Bellavista"`, `varietyRaw="Geisha"`,
  `altitudeRaw="2,200m"`, `processRaw="Beer Yeast & Mosto Anaerobic"`
- **검증** 단위 테스트 `UnspecialtySourceTest`

#### AC-CRAWL-05 · 언스페셜티의 원두 아닌 상품은 결과가 없다

- **Given** 픽스처 `unspecialty-211.html`(센서리 잔 — 스펙 표에 `로스팅 포인트` 없음)
- **When** `UnspecialtySource.parseDetail(url, html)`
- **Then** `Optional.empty()`
- **검증** 단위 테스트 `UnspecialtySourceTest`

#### AC-CRAWL-10 · 새 상품은 크롤러 소유로 생성된다

- **Given** DB에 `커피화 로스터스` 로스터와 상품이 없다
- **When** AC-CRAWL-04의 `CrawledBean`으로 `BeanImportService.importBean`
- **Then** 결과 `CREATED`. 로스터 `is_system=true`·`created_by_user_id=NULL`, 상품 `verified=false`·
  `created_by_user_id=NULL`·`bean_mix=SINGLE_ORIGIN`·`description`=컵노트 원문·`product_url`=입력 URL,
  산지 1행 `ratio_percent=100.0`
- **검증** 통합 테스트 `BeanImportServiceTest`

#### AC-CRAWL-11 · 같은 입력을 두 번 넣어도 행 수가 같다

- **Given** AC-CRAWL-10 이후
- **When** 같은 `CrawledBean`으로 한 번 더
- **Then** 결과 `UPDATED`. `roasters`·`bean_products`·`bean_origins` 행 수가 첫 실행 뒤와 같다
- **검증** 통합 테스트 `BeanImportServiceTest`

#### AC-CRAWL-12 · `Light #92` → LIGHT + Agtron 92

- **Given** `roastLevelRaw="Light #92"`
- **When** 가져오기
- **Then** `roast_level=LIGHT`, `roast_level_agtron=92`
- **검증** 통합 테스트 `BeanImportServiceTest`

#### AC-CRAWL-15 · 품종·가공 원문이 마스터와 맞으면 FK로 들어간다

- **Given** `varietyRaw="파카마라"`, `processRaw="내추럴"`
- **When** 가져오기
- **Then** 산지 `variety_id`=Pacamara의 id, `process_id`=Natural의 id, unmapped 없음
- **검증** 통합 테스트 `BeanImportServiceTest`

#### AC-CRAWL-19 · 블렌드는 산지 없이 들어간다

- **Given** `name="[무우수 커피 로스터스] 패터슨 블렌드 (하우스 블렌드)"`, 산지 원문 1개
- **When** 가져오기
- **Then** `bean_mix=BLEND`, `bean_origins` 0행
- **검증** 통합 테스트 `BeanImportServiceTest`

#### AC-CRAWL-20 · 소스 목록은 마지막 실행을 함께 준다

- **Given** `crawl_runs`가 비어 있다
- **When** ADMIN이 `GET /api/v1/admin/crawl-sources`
- **Then** HTTP `200`, 길이 `2`, key `momos`·`unspecialty`, 둘 다 `lastRun=null`
- **검증** API 테스트 `CrawlAdminControllerTest`

#### AC-CRAWL-21 · 실행을 시작하면 202, 끝나면 SUCCEEDED

- **Given** 동기 executor, `momos` 목록·상세 2개를 `MockRestServiceServer`가 픽스처로 응답
- **When** ADMIN이 `POST /api/v1/admin/crawl-sources/momos/runs` 후 `GET /api/v1/admin/crawl-runs/{id}`
- **Then** POST는 HTTP `202`, `status="RUNNING"`, `id` 있음. GET은 `status="SUCCEEDED"`, `created=2`,
  `finishedAt`이 `null` 아님, `triggered_by_user_id`=호출자 id
- **검증** API 테스트 `CrawlAdminControllerTest`

#### AC-CRAWL-22 · 실행 이력은 최신순이다

- **Given** `momos` 실행 3건(started_at 10:00, 11:00, 12:00), `unspecialty` 1건
- **When** `GET /api/v1/admin/crawl-runs?source=momos`
- **Then** HTTP `200`, `content` 길이 `3`, `startedAt` 순서 12:00 → 11:00 → 10:00, `size=20`
- **검증** API 테스트 `CrawlAdminControllerTest`

#### AC-CRAWL-23 · 앱이 뜰 때 남은 RUNNING은 INTERRUPTED가 된다

- **Given** `status=RUNNING`인 행 1개
- **When** `ApplicationReadyEvent` 처리
- **Then** 그 행 `status=INTERRUPTED`, `finished_at`이 `null` 아님
- **검증** 통합 테스트 `CrawlRunServiceTest`

### 엣지 (경계값)

#### AC-CRAWL-13 · `Medium Light`는 MEDIUM이 아니라 MEDIUM_LIGHT다

- **Given** `roastLevelRaw="medium light"`
- **When** 가져오기
- **Then** `roast_level=MEDIUM_LIGHT`, `roast_level_agtron=null`
- **검증** 통합 테스트 `BeanImportServiceTest`

#### AC-CRAWL-14 · 배전도 원문이 없으면 null로 들어간다

- **Given** `roastLevelRaw=null` (모모스)
- **When** 가져오기
- **Then** 결과 `CREATED`, `roast_level=null`, `roast_level_agtron=null`, unmapped 없음
- **검증** 통합 테스트 `BeanImportServiceTest`

#### AC-CRAWL-16 · 마스터에 없는 가공은 null + unmapped

- **Given** `processRaw="Beer Yeast & Mosto Anaerobic"`
- **When** 가져오기
- **Then** `process_id=null`, unmapped 1건 `{field:"process", raw:"Beer Yeast & Mosto Anaerobic"}`
- **검증** 통합 테스트 `BeanImportServiceTest`

#### AC-CRAWL-17 · 고도 원문 세 가지

- **Given** `altitudeRaw`가 각각 `"2,200m"`, `"1,900-2,100m"`, `"약 2천m"`
- **When** 가져오기
- **Then** 각각 (min,max) = (`2200`,`2200`), (`1900`,`2100`), (`null`,`null`)
- **검증** 통합 테스트 `BeanImportServiceTest` (파라미터화)

#### AC-CRAWL-18 · 사용자가 만든 같은 이름의 상품은 건드리지 않는다

- **Given** 사용자 id `1`이 만든 `(커피화 로스터스, 같은 이름)` 상품, `description="내 메모"`
- **When** 같은 이름으로 가져오기
- **Then** 결과 `SKIPPED(USER_OWNED)`, `description="내 메모"` 그대로, 산지 행 그대로
- **검증** 통합 테스트 `BeanImportServiceTest`

### 실패

#### AC-CRAWL-30 · 모르는 소스

- **When** ADMIN이 `POST /api/v1/admin/crawl-sources/nope/runs`
- **Then** HTTP `404`와 `code: "CRAWL_SOURCE_NOT_FOUND"`. `crawl_runs` 행이 생기지 않는다
- **검증** API 테스트 `CrawlAdminControllerTest`

#### AC-CRAWL-31 · 같은 소스가 실행 중이면 거부

- **Given** `source=momos`, `status=RUNNING` 행
- **When** ADMIN이 `POST /api/v1/admin/crawl-sources/momos/runs`
- **Then** HTTP `409`와 `code: "CRAWL_ALREADY_RUNNING"`. `crawl_runs` 행 수 그대로
- **검증** API 테스트 `CrawlAdminControllerTest`

#### AC-CRAWL-32 · 없는 실행

- **When** ADMIN이 `GET /api/v1/admin/crawl-runs/999999`
- **Then** HTTP `404`와 `code: "CRAWL_RUN_NOT_FOUND"`
- **검증** API 테스트 `CrawlAdminControllerTest`

#### AC-CRAWL-34 · 목록 요청이 실패하면 실행이 FAILED

- **Given** 목록 URL이 HTTP `500`
- **When** `momos` 실행
- **Then** 실행 `status=FAILED`, `error_message`가 비어 있지 않음, `created=0`
- **검증** 통합 테스트 `CrawlRunServiceTest`

#### AC-CRAWL-35 · 상세 하나가 실패해도 나머지는 들어간다

- **Given** 목록에 상세 3개, 그중 1개가 HTTP `500`
- **When** `momos` 실행
- **Then** `status=SUCCEEDED`, `created=2`, skipped 1건 `reason="FETCH_FAILED"`
- **검증** 통합 테스트 `CrawlRunServiceTest`

#### AC-CRAWL-36 · ADMIN이 아니면 403

- **Given** `role=USER` 토큰
- **When** 계약의 네 API 각각
- **Then** HTTP `403`
- **검증** API 테스트 `CrawlAdminControllerTest`

### 비기능

#### AC-CRAWL-40 · 요청 사이에 1000ms 쉰다

- **Given** 목록 1 + 상세 2 = 요청 3회, 기록용 sleeper 주입
- **When** 실행
- **Then** sleeper가 `2`회, 매번 `Duration.ofMillis(1000)`으로 불린다
- **검증** 통합 테스트 `CrawlRunServiceTest`

#### AC-CRAWL-41 · 배전도 없는 상품을 저장할 수 있다 (V17)

- **When** `roast_level=NULL`로 `bean_products` insert
- **Then** 예외 없이 저장된다
- **검증** 리포지토리 테스트 `BeanProductRepositoryTest`

#### AC-CRAWL-42 · 프론트 스키마가 `roastLevel: null`을 받는다

- **Given** `roastLevel: null`인 원두 상품 응답
- **When** `beanProductSchema.parse`
- **Then** 예외 없이 `roastLevel === null`
- **검증** 단위 테스트 `frontend/src/features/catalog/schema.test.ts`

#### AC-CRAWL-43 · `RoastDot`은 null이면 아무것도 그리지 않는다

- **When** `<RoastDot roastLevel={null} />`
- **Then** `[data-roast-dot]` 요소 `0`개
- **검증** 단위 테스트 `RoastDot.test.tsx`

---

## 구현 순서

- [x] **Task 1: 픽스처 저장** — Covers: (AC-01~05의 입력)
  `curl -A "kaldi-note-crawler/1.0"`로 `momos-list.html`, `momos-4938.html`, `unspecialty-sitemap.xml`,
  `unspecialty-920.html`, `unspecialty-211.html`을 `backend/src/test/resources/fixtures/crawler/`에 저장.
  목록 개수를 다시 세어 AC-01(21)·AC-03(132)과 다르면 스펙을 먼저 고친다.

- [x] **Task 2: V17 + roast_level nullable** — Covers: AC-CRAWL-41

  ```sql
  ALTER TABLE bean_products ALTER COLUMN roast_level DROP NOT NULL;
  ```
  `BeanProduct.roastLevel`의 `nullable=false` 제거, 응답 DTO는 그대로 null 통과.

- [x] **Task 3: 파서** — Covers: AC-CRAWL-01~05
  jsoup 추가. `crawler.domain.CrawledBean` / `CrawledOrigin` record, `BeanSource` 인터페이스.

  ```java
  public interface BeanSource {
    String key(); String name(); URI listUrl();
    List<URI> parseList(String body);
    Optional<CrawledBean> parseDetail(URI url, String body);
  }
  ```

- [ ] **Task 4: 가져오기** — Covers: AC-CRAWL-10~19
  `catalog.application.BeanImportService.importBean(CrawledBean) → ImportResult(CREATED|UPDATED|SKIPPED, reason, unmapped)`.
  `BeanCatalogService.buildOrigins`의 블렌드 검증은 쓰지 않고 `BeanOrigin.of`를 직접 쓴다. 상품 단위
  `@Transactional`.

- [ ] **Task 5: 실행** — Covers: AC-CRAWL-23, 34, 35, 40
  V18 `crawl_runs`, `CrawlRun` 엔티티, `CrawlRunService.start(key, userId)`(executor·sleeper·`RestClient`
  주입), 중복 실행 거부, `ApplicationReadyEvent` 리스너.

- [ ] **Task 6: 관리 API** — Covers: AC-CRAWL-20~22, 30~32, 36
  `CrawlAdminController`, `ErrorCode` 3개, `docs/contracts/2026-10-14-bean-crawler.json`.

- [ ] **Task 7: 프론트 null 수용** — Covers: AC-CRAWL-42, 43
  `features/catalog/schema.ts`의 `roastLevel`에 `.nullable()`, `RoastDot`은 `roastLevel == null`이면 `null` 반환.
  타입 오류가 나는 호출부(`useRoastLevel` 등)는 `?? undefined`로 맞춘다.

---

## 수동 확인

- [ ] ★ 로컬 실제 사이트 실행: `docker compose up -d` → `bootRun` → 로컬 유저 ADMIN 승격 →
  `POST /api/v1/admin/crawl-sources/momos/runs` → `GET /crawl-runs/{id}`가 `SUCCEEDED`가 될 때까지
  폴링 → `SELECT count(*) FROM bean_products WHERE created_by_user_id IS NULL`이 `created`와 같다 →
  한 번 더 실행하면 `created=0` → `unspecialty`도 같은 순서로, 실행 중에 POST를 한 번 더 보내 `409` 확인
- [ ] ★ 로컬에서 원두 고르기 다이얼로그를 열어 배전도 `null` 상품이 목록에 보이고 콘솔 에러가 없다
- [ ] 운영 배포 후 운영 DB에서 `UPDATE users SET role='ADMIN' WHERE email=…` 1회 (운영 코드에 승격 경로 없음)

## 열어둔 결정

- 주기 실행 여부·주기 — 수동 실행을 몇 번 써 본 뒤 정한다
- 관리자 화면 디자인 — 관리자 화면 스펙에서
- unmapped 원문을 마스터 별칭으로 보강하는 방법 — unmapped가 쌓인 걸 보고 정한다

---
id: CRAWLRESULT
title: 수집 결과 보기 — 실행마다 생성 · 갱신된 원두 목록
status: 구현중
milestone:
supersedes:
---

# 수집 결과 보기 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 시나리오

관리자가 관리자 콘솔 「원두 수집」에서 실행을 누르면, 실행 상세에 **이번 실행에서 새로 생긴 원두와 값이 바뀐 원두의
이름 목록**이 보인다. 지금은 `생성 13 · 갱신 21` 같은 건수만 남고, 「갱신」은 값이 하나도 안 바뀐 원두까지 센다
(운영 실행 #5: 갱신 21 = 모모스 기존 원두 전부). 이 스펙은 ① 실행마다 생성 · 갱신된 원두를 `crawl_runs`에 저장하고,
② 「갱신」을 **저장 값이 실제로 바뀐 원두**로 좁히며, 바뀐 것이 없는 원두는 「변화 없음」으로 따로 센다.

이어지는 스펙: [`2026-10-14-bean-crawler.md`](2026-10-14-bean-crawler.md)(수집 · 가져오기),
[`2026-10-19-admin-crawl-console.md`](2026-10-19-admin-crawl-console.md)(실행 상세 화면).

### 범위 밖 (Non-goals)

- 갱신된 원두의 **필드별 변경 내역**(이전 → 이후 값) — 이름 목록만 남긴다
- 목록 행에서 원두로 가는 **링크** — 원두 화면이 프론트에 아직 없다. 관리자 원두 화면(PR #220) 이후에 붙인다
- unmapped 항목에 `beanProductId` 저장 — PR #220 Task 6(이름으로 조회 시점에 붙이기)이 다룬다
- 실행 이력 표에 「변화 없음」 열 추가 — 표 열 구성(목업 `docs/design/admin/README.md`)은 그대로 둔다
- 과거 실행(#1~#5) 목록 소급 — 무엇을 만들었는지 사후에 알 수 없다

## 용어

| 용어 | 정의 |
|---|---|
| CREATED | `(roaster, name)`으로 기존 원두를 찾지 못해 새로 저장한 원두 |
| UPDATED | 기존 크롤러 원두인데 **비교 대상 값** 중 하나 이상이 이번 수집 값과 달라 저장한 원두 |
| UNCHANGED | 기존 크롤러 원두인데 비교 대상 값이 전부 같아 **저장하지 않은** 원두. 건수만 센다 |
| 비교 대상 값 | `bean_mix`, `roast_level`, `roast_level_agtron`, `description`(컵노트), `product_url`, 그리고 산지 목록(순서대로 `country`, `region`, `farm`, `altitude_min_m`, `altitude_max_m`, `variety_id`, `process_id`, `ratio_percent`). 산지는 개수가 다르거나 같은 자리의 값이 하나라도 다르면 다르다. `ratio_percent`는 `BigDecimal.compareTo`로 비교한다(`100.0` = `100.00`) |
| 수동 수정 원두 | `manually_edited = true`. 가져오기가 `product_url`만 따라간다(AC-BEAN-03). 비교 대상 값은 `product_url` 하나 |

## 데이터

마이그레이션 `V21__crawl_runs_imported.sql` — 관리자 원두 구현보다 먼저 머지돼 V21을 쓴다(관리자 원두 쪽이 V22로 옮긴다).

| 테이블 | 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|---|
| `crawl_runs` | `imported` | `jsonb` | NOT NULL, DEFAULT `'[]'` | `[{beanProductId, name, outcome}]`. `outcome`은 `CREATED` \| `UPDATED`. 처리 순서. `name`은 수집 시점 이름 그대로(조인하지 않는다) |
| `crawl_runs` | `unchanged_count` | `int` | NOT NULL, DEFAULT `0` | UNCHANGED 건수 |

기존 행은 DEFAULT로 `imported='[]'`, `unchanged_count=0`이 된다. FAILED · INTERRUPTED 실행은 그대로 `[]`, `0`이다
(`succeed()`에서만 채운다).

## 계약

| 메서드 | 경로 | 인증 | 계약 파일 |
|---|---|---|---|
| GET | `/api/v1/admin/crawl-runs/{id}` | ADMIN | `docs/contracts/2026-10-14-bean-crawler.json` |
| GET | `/api/v1/admin/crawl-runs` | ADMIN | 같은 파일 — 항목이 같은 `CrawlRun` 스키마 |
| POST | `/api/v1/admin/crawl-runs` | ADMIN | 같은 파일 — 응답이 같은 `CrawlRun` 스키마 |

`CrawlRun` 스키마에 두 필드를 더한다(둘 다 required). 새 에러 코드는 없다 — 인증 · 인가 실패는 기존 규약(401 · 403) 그대로다.

```json
{
  "id": 6,
  "source": "momos",
  "status": "SUCCEEDED",
  "created": 2,
  "updated": 1,
  "unchanged": 3,
  "imported": [
    { "beanProductId": 140, "name": "원두 케냐 카구뉴 워시드", "outcome": "CREATED" },
    { "beanProductId": 112, "name": "원두 에티오피아 단체 워시드", "outcome": "UPDATED" },
    { "beanProductId": 141, "name": "원두 콜롬비아 엘 투르피알 라우리나 내추럴", "outcome": "CREATED" }
  ],
  "skipped": [],
  "unmapped": []
}
```

---

## 인수 조건

### 기능

#### AC-CRAWLRESULT-01 · 새 원두는 CREATED와 저장된 id를 돌려준다

- **Given** 로스터 「모모스커피」에 `원두 케냐 카구뉴 워시드`가 없다
- **When** `importBean`에 그 원두를 넘긴다
- **Then** `outcome=CREATED`, `beanProductId`는 저장된 `bean_products.id`와 같다
- **검증** 통합 테스트 `BeanImportServiceTest`

#### AC-CRAWLRESULT-02 · 컵노트만 바뀌면 UPDATED

- **Given** 크롤러 원두 X의 `description="자두, 꿀"`, 나머지 비교 대상 값은 이번 수집과 같다
- **When** `description="자두, 꿀, 홍차"`로 `importBean`
- **Then** `outcome=UPDATED`, `beanProductId`=X의 id, 저장 후 `description="자두, 꿀, 홍차"`, `updated_at`이 호출 전보다 크다
- **검증** 통합 테스트 `BeanImportServiceTest`

#### AC-CRAWLRESULT-03 · 값이 전부 같으면 UNCHANGED이고 저장하지 않는다

- **Given** 크롤러 원두 X를 한 번 가져왔다
- **When** 같은 `CrawledBean`으로 다시 `importBean`
- **Then** `outcome=UNCHANGED`, `beanProductId`=X의 id, `updated_at`과 `bean_origins`의 id가 호출 전과 같다
- **검증** 통합 테스트 `BeanImportServiceTest`

#### AC-CRAWLRESULT-04 · 산지 가공만 바뀌어도 UPDATED

- **Given** 크롤러 원두 X의 산지 1개 `process=워시드`
- **When** 산지 `process=내추럴`(다른 값은 같음)로 `importBean`
- **Then** `outcome=UPDATED`, 저장 후 산지 `process`가 내추럴
- **검증** 통합 테스트 `BeanImportServiceTest`

#### AC-CRAWLRESULT-05 · 수동 수정 원두는 구매 링크가 바뀔 때만 UPDATED

- **Given** `manually_edited=true`인 원두 X, `product_url=".../?idx=1"`, `description="관리자 값"`
- **When** ① `product_url=".../?idx=1"`, `description="크롤러 값"`으로 `importBean` ② `product_url=".../?idx=2"`로 `importBean`
- **Then** ① `UNCHANGED`, `description="관리자 값"` 그대로 ② `UPDATED`, `product_url=".../?idx=2"`, `description="관리자 값"` 그대로
- **검증** 통합 테스트 `BeanImportServiceTest`

#### AC-CRAWLRESULT-06 · 실행이 생성 · 갱신 목록과 변화 없음 건수를 저장한다

- **Given** 목록 순서대로 상세 6개: A(새), B(새), C(컵노트 바뀜), D · E · F(값 같음)
- **When** 실행이 끝난다
- **Then** `status=SUCCEEDED`, `created=2`, `updated=1`, `unchanged_count=3`, `imported`=`[A CREATED, B CREATED, C UPDATED]`(이 순서, 각 항목에 그 원두의 `beanProductId`와 수집 시점 `name`)
- **검증** 통합 테스트 `CrawlRunServiceTest`

#### AC-CRAWLRESULT-07 · API가 imported와 unchanged를 돌려준다

- **Given** AC-CRAWLRESULT-06의 실행
- **When** `GET /api/v1/admin/crawl-runs/{id}`, `GET /api/v1/admin/crawl-runs`
- **Then** 둘 다 그 실행 항목에 `unchanged: 3`, `imported` 3개(`beanProductId` · `name` · `outcome`)가 있다
- **검증** API 테스트 `CrawlAdminControllerTest`

#### AC-CRAWLRESULT-08 · 실행 상세가 새로 생긴 원두 · 갱신된 원두를 순서대로 보여 준다

- **Given** 실행 응답 `imported`=`[A CREATED, B CREATED, C UPDATED]`
- **When** 실행 상세를 연다
- **Then** 「건너뛴 상품」 위에 제목 「새로 생긴 원두 2」 아래 A, B 행(이 순서), 그 아래 「갱신된 원두 1」 아래 C 행이 있다. 행은 이름 텍스트이고 링크가 아니다
- **검증** 컴포넌트 테스트 `frontend/src/app/admin/crawl/page.test.tsx`

#### AC-CRAWLRESULT-09 · 히어로 줄에 변화 없음 건수가 들어간다

- **Given** 실행 응답 `created=2, updated=1, unchanged=3, skipped=[], unmapped=[]`
- **When** 실행 상세를 연다
- **Then** 히어로 아래 줄이 정확히 `갱신 1 · 변화 없음 3 · 건너뜀 0 · 미매핑 0`. RUNNING이면 `갱신 — · 변화 없음 — · 건너뜀 — · 미매핑 —`
- **검증** 컴포넌트 테스트 `page.test.tsx`

### 엣지 (경계값)

#### AC-CRAWLRESULT-10 · 0건인 절은 그리지 않는다

- **Given** `imported`=`[C UPDATED]`(CREATED 0개)
- **When** 실행 상세를 연다
- **Then** 「새로 생긴 원두」 제목이 없고 「갱신된 원두 1」만 있다. `imported=[]`이고 `created+updated=0`이면 두 절 모두 없다
- **검증** 컴포넌트 테스트 `page.test.tsx`

#### AC-CRAWLRESULT-11 · 목록을 남기지 않은 과거 실행

- **Given** `status=SUCCEEDED`, `created=21`, `updated=0`, `imported=[]` (이 스펙 이전 실행)
- **When** 실행 상세를 연다
- **Then** 두 절 대신 문장 「이 실행은 원두 목록을 남기지 않았습니다」가 한 번 보인다
- **검증** 컴포넌트 테스트 `page.test.tsx`

#### AC-CRAWLRESULT-12 · 이름은 수집 시점 값이다

- **Given** AC-CRAWLRESULT-06 실행 후 원두 A의 `bean_products.name`을 「바뀐 이름」으로 고쳤다
- **When** `GET /api/v1/admin/crawl-runs/{id}`
- **Then** `imported[0].name`은 수집 시점 이름 그대로다
- **검증** 통합 테스트 `CrawlRunServiceTest`

### 실패

#### AC-CRAWLRESULT-20 · 실패한 실행은 목록이 비어 있다

- **Given** 목록 요청이 500으로 실패한다
- **When** 실행이 끝난다
- **Then** `status=FAILED`, `imported=[]`, `unchanged_count=0`
- **검증** 통합 테스트 `CrawlRunServiceTest`

#### AC-CRAWLRESULT-21 · 건너뛴 원두는 imported에 없다

- **Given** 상세 2개: A(새), B(사용자 소유 → `USER_OWNED`)
- **When** 실행이 끝난다
- **Then** `imported`=`[A CREATED]`, `skipped`=`[{name: B, reason: USER_OWNED}]`, `unchanged_count=0`
- **검증** 통합 테스트 `CrawlRunServiceTest`

### 비기능

#### AC-CRAWLRESULT-30 · 마이그레이션이 기존 행을 기본값으로 채운다

- **Given** 마이그레이션 전 `crawl_runs` 행 1개(SUCCEEDED, created 21)
- **When** V21을 적용한다
- **Then** 그 행의 `imported='[]'::jsonb`, `unchanged_count=0`이고 다른 칼럼 값은 그대로다
- **검증** 통합 테스트 `CrawlRunMigrationTest`(Flyway `target` V20 → V21)

---

## 구현 순서

PR #220(관리자 원두 — `importBean`의 `product_url` 매칭)이 먼저 머지되면 그 위에서 시작한다. 같은 메서드를 바꾼다.

- [x] **Task 1: 스키마 · 엔티티** — Covers: AC-CRAWLRESULT-30

  ```sql
  ALTER TABLE crawl_runs
      ADD COLUMN imported        JSONB NOT NULL DEFAULT '[]',
      ADD COLUMN unchanged_count INT   NOT NULL DEFAULT 0;
  ```

  `CrawlRun`에 `List<ImportedItem> imported`(`@JdbcTypeCode(SqlTypes.JSON)`), `int unchangedCount`. 새 record
  `crawler/domain/ImportedItem(Long beanProductId, String name, String outcome)`.

- [ ] **Task 2: 가져오기 결과에 id와 UNCHANGED** — Covers: AC-CRAWLRESULT-01~05

  ```java
  public record ImportResult(Outcome outcome, Long beanProductId, String reason, List<Unmapped> unmapped) {
    public enum Outcome { CREATED, UPDATED, UNCHANGED, SKIPPED }
  }
  // BeanImportService.importBean — 기존 원두면 비교 후 같으면 저장하지 않는다
  if (existing.isPresent() && existing.get().isManuallyEdited()) {
    boolean changed = !Objects.equals(existing.get().getProductUrl(), bean.productUrl());
    if (changed) existing.get().updateProductUrl(bean.productUrl());
    return new ImportResult(changed ? UPDATED : UNCHANGED, existing.get().getId(), null, unmapped);
  }
  if (existing.isPresent() && existing.get().sameAs(mix, roastLevel, agtron, bean.productUrl(), bean.cupNotes(), origins)) {
    return new ImportResult(UNCHANGED, existing.get().getId(), null, unmapped);
  }
  ```

  `BeanProduct.sameAs(...)`는 용어 「비교 대상 값」을 그대로 비교한다(산지는 `BeanOrigin.sameValues(other)`).

- [ ] **Task 3: 실행이 목록을 모은다 + API · 계약** — Covers: AC-CRAWLRESULT-06, 07, 12, 20, 21

  `CrawlRunService.crawl`의 `switch`에 `UNCHANGED -> unchanged++`, CREATED · UPDATED면
  `imported.add(new ImportedItem(result.beanProductId(), name, outcome.name()))`.
  `run.succeed(created, updated, unchanged, imported, skipped, unmapped, now)`.
  `CrawlRunResponse`에 `int unchanged`, `List<ImportedItem> imported`. 계약 파일 `CrawlRun` 스키마에
  `unchanged`(integer) · `imported`(array of `ImportedItem` {beanProductId integer, name string, outcome enum}) 추가 →
  `frontend/src/types/generated/2026-10-14-bean-crawler.ts` 재생성.

- [ ] **Task 4: 실행 상세 화면** — Covers: AC-CRAWLRESULT-08~11

  `frontend/src/features/admin/components/RunPanel.tsx` — 히어로 줄에 `변화 없음 {run.unchanged}`, 「건너뛴 상품」 절 위에
  「새로 생긴 원두 n」 · 「갱신된 원두 n」 절(기존 `<h3 className="text-[16px] font-semibold">` 형식), 0건이면 절 생략,
  `imported.length === 0 && created + updated > 0`이면 문장 「이 실행은 원두 목록을 남기지 않았습니다」.

---

## 수동 확인

- [ ] ★ 운영에서 모모스 수집을 한 번 더 실행해 실행 상세에 `갱신 0 · 변화 없음 32`가 보이고, 사이트에 새 원두가 있으면
      「새로 생긴 원두」에 그 이름이 나온다

## 열어둔 결정

- 목록 행 링크 — 관리자 원두 화면(PR #220) 구현 후 `/admin/beans?id={beanProductId}`로 붙일지 그 스펙에서 정한다

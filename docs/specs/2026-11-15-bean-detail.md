---
id: BEANDETAIL
title: 원두 검색 · 원두 상세 — 11 Beans
status: 구현중
milestone: P1
supersedes:
---

# 원두 검색 · 원두 상세 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 시나리오

빠른 기록의 「원두 고르기」에서 이름이나 로스터로 원두를 찾으면, 서버가 숨기지 않은 카탈로그 원두만 골라 20개씩
돌려준다. 결과 행의 「정보」나 기록 · 오늘 화면의 원두 이름을 누르면 「원두 상세」가 열려, 그 원두가 어떤 원두인지와
**내가 그 원두로 어떻게 내렸는지**(잔 수 · 평균 별점 · 자주 쓴 비율 · 최근 3잔)를 보여 준다. 「이 원두로 기록하기」를
누르면 그 원두와 그 원두의 지난 값이 채워진 빠른 기록이 열린다.

관리자가 숨긴 원두와 손으로 고친 원두를 크롤러가 되살리거나 덮어쓰지 않도록, `bean_products`에 두 플래그를 둔다.
플래그를 켜는 화면(관리자 원두 메뉴)은 별도 스펙이다.

입력: 시안 `docs/design/kaldi-note-design/screens/11 Beans.dc.html`(U1 원두 상세, U2 원두 고르기 결과 행),
`10 Brew First.dc.html` B8~B10(원두 고르기), 결정 `docs/design/kaldi-note-design/docs/DECISIONS.md` 7절,
요청문 `docs/design/requests/2026-11-15-bean-screens-request.md` 2·6절.

### 범위 밖 (Non-goals)

- 관리자 원두 화면 — 숨김 · 수동 수정 플래그를 켜는 API 포함(시안 대기, 별도 스펙)
- 원두 사진 · 원두 둘러보기 목록(B2) · 원두 병합
- 기록 목록의 원두 필터 — 그래서 11 Beans의 「이 원두 기록 모두 보기」 링크는 이번에 그리지 않는다
- 직접 적은 원두 ↔ 카탈로그 원두 합치기(11 Beans 질문 9)
- 크롤러가 기존 원두를 찾는 열쇠 변경(`product_url`) — 관리자 원두 스펙 `docs/specs/2026-11-15-admin-beans.md`(DECISIONS 7절 질문 04)

## 용어

| 용어 | 정의 |
|---|---|
| 카탈로그 원두 | `bean_products` 행. 크롤러가 넣은 것(`created_by_user_id` null)과 사용자가 만든 것이 함께 있다 |
| 사용자 원두 | `created_by_user_id`가 있는 `bean_products` 행. **검색에는 만든 사람에게만** 나온다(B8). 상세는 로그인한 누구나 |
| 직접 적은 원두 | 카탈로그 원두를 고르지 않고 이름만 적은 원두. `brew_logs.bean_name` 문자열이며 `bean_products` 행이 없다 |
| 숨긴 원두 | `hidden=true`. 검색 · 최근 원두에서 빠지고, 상세 진입과 그 원두로 기록하기는 된다(11 Beans 질문 3) |
| 수동 수정 원두 | `manually_edited=true`. 크롤러가 `product_url`만 갱신한다(B7 정정) |
| 이 원두의 기록 | 호출한 사람 본인의 기록 중 `bean_product_id`가 그 원두이거나, `bean_batch_id`의 봉투 상품이 그 원두인 것. 직접 적은 원두는 `bean_name`이 정확히 같은 것 |

## 데이터

**마이그레이션 하나**(번호는 구현 시점의 다음 번호).

| 테이블 | 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|---|
| `bean_products` | `hidden` | `BOOLEAN NOT NULL DEFAULT false` | N | **신규.** 숨긴 원두. 크롤러는 읽지도 쓰지도 않는다 |
| `bean_products` | `manually_edited` | `BOOLEAN NOT NULL DEFAULT false` | N | **신규.** 관리자가 손으로 고친 원두 |

- 인덱스는 추가하지 않는다 — 카탈로그가 수백 건 규모다. 1,000건을 넘으면 「열어둔 결정」.
- 기존 행은 두 값 모두 `false`로 시작한다.

### 크롤러 규칙 변경 (`docs/specs/2026-10-14-bean-crawler.md` 「저장 규칙」에 추가)

| 기존 상품 | 동작 |
|---|---|
| 크롤러 소유, `manually_edited=false` | 지금과 같다 — 배전도 · Agtron · 구매 링크 · 설명 · 산지를 갱신, 결과 `UPDATED` |
| 크롤러 소유, `manually_edited=true` | **`product_url`만 갱신.** 배전도 · Agtron · 설명 · 산지 · `bean_mix`는 그대로. 결과 `UPDATED`. 미매핑 원문은 지금처럼 집계한다 |
| 사용자 소유 | 지금과 같다 — `SKIPPED(USER_OWNED)` |
| 모든 경우 | `hidden`은 바꾸지 않는다 |

이름은 수집으로 바뀌지 않는다. 지금 크롤러는 `(roaster_id, name)`으로 기존 상품을 찾는다 — 찾는 열쇠를 `product_url`로 바꾸는 것은
관리자 원두 스펙의 몫이다.

## API

| 메서드 | 경로 | 인증 | 변경 |
|---|---|---|---|
| `GET` | `/api/v1/bean-products` | 필요 | **대체** — 배열 전체 반환 → 검색 · 필터 · 페이지. 응답이 배열에서 페이지 객체로 바뀐다(깨지는 변경, 프론트 사용처를 같은 PR에서 옮긴다) |
| `GET` | `/api/v1/bean-products/{id}` | 필요 | 응답에 `roasterName` · `hidden`, 산지에 `varietyName` · `processName` 추가. 숨긴 원두도 200 |
| `GET` | `/api/v1/brew-logs/bean-summary` | 필요 | **신규.** 호출한 사람의 「이 원두의 기록」 요약 |

### 검색 — `GET /api/v1/bean-products`

| 파라미터 | 형식 | 규칙 |
|---|---|---|
| `q` | 문자열 | 앞뒤 공백 제거 후 1~50자. 이름 **또는** 로스터 이름에 부분 일치, 대소문자 무시. 비었거나 공백뿐이면 조건 없음. 51자 이상 400 |
| `roasterId` | 정수 1개 | 그 로스터의 원두만 |
| `roastLevel` | 반복 가능 · `LIGHT`·`MEDIUM_LIGHT`·`MEDIUM`·`MEDIUM_DARK`·`DARK` | 그중 하나인 원두만. 배전도가 없는 원두는 이 필터를 주면 빠진다 |
| `decaf` | `true`·`false` | 그 값인 원두만 |
| `country` | 문자열 1개 | 산지 중 하나의 `country`가 정확히 같은 원두만 |
| `page` | 정수 | 기본 0, 0 이상 |
| `size` | 정수 | 기본 20, 1~50 |

- 필터는 모두 AND. 정렬은 `name` 오름차순 → `id` 오름차순.
- **항상 빠지는 것:** `hidden=true`, 그리고 `created_by_user_id`가 있고 호출한 사람이 아닌 원두.

```json
// GET /api/v1/bean-products?q=구지&size=20
{
  "content": [
    {
      "id": 41,
      "name": "에티오피아 구지 함벨라",
      "roasterId": 3,
      "roasterName": "산책 로스터스",
      "beanMix": "SINGLE_ORIGIN",
      "roastLevel": "LIGHT",
      "roastLevelAgtron": 92,
      "roastLevelCustom": null,
      "decaf": false,
      "countries": ["에티오피아"]
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```

`countries`는 산지의 `country`를 산지 순서대로, 같은 값은 한 번만. 산지가 없으면 `[]`.

### 상세 — `GET /api/v1/bean-products/{id}`

기존 필드는 그대로 두고 아래만 더한다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `roasterName` | string | 로스터 이름 |
| `hidden` | boolean | 숨긴 원두면 `true` |
| `origins[].varietyName` | string · nullable | 품종 `name_ko`, 없으면 `name`. 품종이 없으면 null |
| `origins[].processName` | string · nullable | 가공 `name_ko`, 없으면 `name`. 가공이 없으면 null |

### 내 기록 요약 — `GET /api/v1/brew-logs/bean-summary`

`beanProductId` 또는 `beanName` 중 **정확히 하나**. 대상은 호출한 사람 본인의 「이 원두의 기록」(공개 범위와 무관).

```json
// GET /api/v1/brew-logs/bean-summary?beanProductId=41
{
  "brewCount": 5,
  "ratedCount": 4,
  "averageRating": 4.1,
  "frequentRatio": 15.6,
  "frequentDoseG": 16.0,
  "frequentWaterG": 250.0,
  "recent": [
    { "id": 912, "brewedAt": "2026-11-13T23:05:00Z", "actualDoseG": 16.0, "actualWaterG": 250.0, "brewRatio": 15.6, "rating": 4.0 }
  ]
}
```

| 필드 | 규칙 |
|---|---|
| `brewCount` | 이 원두의 기록 수 |
| `ratedCount` | 그중 `rating`이 있는 기록 수 |
| `averageRating` | 별점 있는 기록 **전체**의 평균, 소수 1자리 HALF_UP. `ratedCount=0`이면 null |
| `frequentRatio` | `brewedAt` 최신순 **최근 10잔**의 `brewRatio`(물/원두, 소수 1자리 — 기존 계산) 중 최빈값. 동률이면 그중 가장 최근 기록의 비율. 0잔이면 null |
| `frequentDoseG` · `frequentWaterG` | `frequentRatio`를 쓴 가장 최근 기록의 원두량 · 물량. 0잔이면 null |
| `recent` | `brewedAt` 최신순 최대 3개. 0잔이면 `[]` |

`beanName`은 앞뒤 공백을 지운 뒤 `brew_logs.bean_name`과 정확히 같아야 한다(대소문자 구분). 저장할 때도 공백을 지우므로 같은 규칙이다.

## 계약

| 메서드 | 경로 | 인증 | 계약 파일 |
|---|---|---|---|
| `GET` | `/api/v1/bean-products` | 필요 | `docs/contracts/2026-11-15-bean-detail.json` |
| `GET` | `/api/v1/bean-products/{id}` | 필요 | 〃 |
| `GET` | `/api/v1/brew-logs/bean-summary` | 필요 | 〃 |

## 화면

시안 `11 Beans.dc.html`을 그대로 따르고, 표시 규칙은 DECISIONS 7절 「11 Beans 질문 10건」이다.

| 라우트 · 자리 | 시안 | 내용 |
|---|---|---|
| `/beans/[id]` | U1a · U1c~U1f · U1h~U1k · UW | 카탈로그 원두 상세(모바일 · 웹 1440) |
| `/beans/named?name=…` | U1g | 직접 적은 원두 — 이름 + 내 기록만 |
| 원두 고르기 위에 쌓이는 시트 | U1b | 요약판. 주 버튼 「이 원두 고르기」 |
| 원두 고르기 결과 행 | U2 | 이름(+디카페인 태그) · 로스터 · 배전도 · 국가, 오른쪽 「정보」 |

**들어오는 곳:** ① 원두 고르기 결과 행의 「정보」 → 시트 ② 기록 상세의 원두 행 → 페이지 ③ 오늘
「지난번과 같게」 카드의 원두 이름 → 페이지.

**「이 원두로 기록하기」:** 빠른 기록 ①을 연다. 원두는 이 원두, 원두량 · 물량은 요약의 `recent[0]` 값, 없으면 「지난번」 값.

**원두 고르기 검색:** 입력 후 250ms 디바운스, 1글자부터, 20개까지. `totalElements`가 20보다 크면 목록 아래
「20개까지 보여요 — 더 좁혀 보세요」. 빈 입력이면 지금처럼 최근 원두만(카탈로그를 늘어놓지 않는다 — B2).

**최근 원두:** 지금처럼 내 기록에서 뽑되, 상세 응답 `hidden=true`인 카탈로그 원두는 뺀다. 「지난번과 같게」 미리 채우기는
숨긴 원두여도 그대로 둔다.

**표시 문구(시안 그대로):**

| 상태 | 문구 |
|---|---|
| 내 기록 0잔 | 「아직 이 원두로 내린 기록이 없어요」 |
| 숨긴 원두 | 「카탈로그에서 내려간 원두예요. 내 기록은 그대로 남아 있어요.」 |
| 정보가 이름 · 로스터뿐 | 「로스터가 알려 준 정보가 아직 많지 않습니다.」 |
| 직접 적은 원두 | 「내가 이름만 적어 만든 원두 · 나만 보여요」 |
| 불러오기 실패 | 「원두 정보를 불러오지 못했어요」 + 「다시 시도」 |
| 평균 별점 기준이 다름 | 「★ 4.1 · 4잔 기준」 (`ratedCount ≠ brewCount`일 때만) |

---

## 인수 조건

### 기능 — 데이터 · 크롤러

#### AC-BEANDETAIL-01 · 마이그레이션 뒤 기존 원두의 두 플래그는 false다

- **Given** 마이그레이션 직전 버전으로 `bean_products` 3행
- **When** 마이그레이션을 적용하면
- **Then** 3행 모두 `hidden=false`, `manually_edited=false`이고 다른 컬럼 값은 같다
- **검증** 통합 테스트 `BeanProductFlagsMigrationTest`

#### AC-BEANDETAIL-02 · 크롤러는 숨김을 건드리지 않는다

- **Given** 크롤러 소유 원두 `(모모스커피, 콜롬비아 엘 파라이소 리치)`, `hidden=true`
- **When** 같은 로스터 · 이름의 원두를 다시 가져오면
- **Then** 결과 `UPDATED`, `hidden`은 `true` 그대로
- **검증** 통합 테스트 `BeanImportServiceTest`

#### AC-BEANDETAIL-03 · 수동 수정 원두는 구매 링크만 갱신된다

- **Given** 크롤러 소유 원두, `manually_edited=true`, `roast_level=MEDIUM_LIGHT`, `description="관리자 메모"`, 산지 1행 `country="콜롬비아"`, `product_url="https://a.example/1"`
- **When** 같은 원두를 `roastLevelRaw="Light"`, `cupNotes="새 설명"`, 산지 `country="페루"`, `productUrl="https://a.example/2"`로 가져오면
- **Then** 결과 `UPDATED`. `product_url="https://a.example/2"`, `roast_level=MEDIUM_LIGHT`, `description="관리자 메모"`, 산지 `country="콜롬비아"` 그대로
- **검증** 통합 테스트 `BeanImportServiceTest`

### 기능 — 검색 API

#### AC-BEANDETAIL-04 · 이름 일부로 찾는다(대소문자 무시)

- **Given** 원두 `에티오피아 구지 함벨라`, `Guji Uraga`, `케냐 키린야가 AA`
- **When** `GET /bean-products?q=guji` / `?q=구지`
- **Then** 200, `content` 이름이 `["Guji Uraga"]` / `["에티오피아 구지 함벨라"]`
- **검증** API 테스트 `BeanProductControllerTest`

#### AC-BEANDETAIL-05 · 로스터 이름으로도 찾는다

- **Given** 로스터 `산책 로스터스`의 원두 2개, 다른 로스터의 원두 1개
- **When** `GET /bean-products?q=산책`
- **Then** `content` 2개, 모두 `roasterName="산책 로스터스"`
- **검증** API 테스트 `BeanProductControllerTest`

#### AC-BEANDETAIL-06 · 필터는 AND로 걸린다

- **Given** 원두 A(로스터 3, `LIGHT`, 디카페인 아님, 에티오피아) · B(로스터 3, `MEDIUM`, 디카페인, 콜롬비아) · C(로스터 4, `LIGHT`, 디카페인 아님, 에티오피아)
- **When** `?roasterId=3&roastLevel=LIGHT&roastLevel=MEDIUM` / `?decaf=true` / `?country=에티오피아&roasterId=4`
- **Then** `[A, B]` / `[B]` / `[C]`
- **검증** API 테스트 `BeanProductControllerTest`

#### AC-BEANDETAIL-07 · 이름순으로 페이지를 나눈다

- **Given** 숨기지 않은 원두 25개
- **When** `GET /bean-products` / `?page=1`
- **Then** `size=20`, `totalElements=25`, `totalPages=2`. `page=0`은 이름 오름차순 앞 20개, `page=1`은 나머지 5개. 이름이 같으면 `id` 오름차순
- **검증** API 테스트 `BeanProductControllerTest`

#### AC-BEANDETAIL-08 · 숨긴 원두는 검색에 나오지 않는다

- **Given** `에티오피아 구지 함벨라`(`hidden=false`), `에티오피아 예가체프 (2025 수확)`(`hidden=true`)
- **When** `GET /bean-products?q=에티오피아`
- **Then** `content` 이름이 `["에티오피아 구지 함벨라"]`
- **검증** API 테스트 `BeanProductControllerTest`

#### AC-BEANDETAIL-09 · 남이 만든 사용자 원두는 검색에 나오지 않는다

- **Given** 크롤러 원두 `하늘 커피 시즌`, 사용자 1이 만든 `하늘 블렌드 A`, 사용자 2가 만든 `하늘 블렌드 B`
- **When** 사용자 1이 `GET /bean-products?q=하늘`
- **Then** `content` 이름이 `["하늘 블렌드 A", "하늘 커피 시즌"]`
- **검증** API 테스트 `BeanProductControllerTest`

#### AC-BEANDETAIL-10 · 결과 항목의 국가는 중복 없이 산지 순서다

- **Given** 블렌드 원두, 산지 `브라질` · `콜롬비아` · `브라질` 순서 / 산지 없는 원두
- **When** 검색 결과에서 그 원두
- **Then** `countries=["브라질", "콜롬비아"]` / `countries=[]`
- **검증** API 테스트 `BeanProductControllerTest`

### 기능 — 상세 · 요약 API

#### AC-BEANDETAIL-11 · 상세에 로스터 이름 · 숨김 · 품종 · 가공 이름이 온다

- **Given** 원두 41(로스터 `산책 로스터스`), 산지 1행: 품종 `name="Heirloom"`·`name_ko="에어룸"`, 가공 `name="Washed"`·`name_ko=null` / 산지 2행은 품종 · 가공 없음
- **When** `GET /bean-products/41`
- **Then** `roasterName="산책 로스터스"`, `hidden=false`. 1행 `varietyName="에어룸"`, `processName="Washed"`. 2행 `varietyName=null`, `processName=null`. 기존 필드(`varietyId` 등)는 그대로
- **검증** API 테스트 `BeanProductControllerTest`

#### AC-BEANDETAIL-12 · 숨긴 원두도 상세는 열린다

- **Given** 원두 45, `hidden=true`
- **When** `GET /bean-products/45`
- **Then** 200, `hidden=true`
- **검증** API 테스트 `BeanProductControllerTest`

#### AC-BEANDETAIL-13 · 요약은 내 기록만 세고, 봉투로 고른 예전 기록도 센다

- **Given** 사용자 1의 기록: `beanProductId=41` 2건, `beanBatchId`가 상품 41의 봉투인 예전 기록 1건, `beanProductId=42` 1건. 사용자 2의 `beanProductId=41` 기록 3건(`PUBLIC`)
- **When** 사용자 1이 `GET /brew-logs/bean-summary?beanProductId=41`
- **Then** `brewCount=3`
- **검증** 통합 테스트 `BeanSummaryServiceTest`

#### AC-BEANDETAIL-14 · 직접 적은 원두는 이름이 정확히 같은 기록만 센다

- **Given** 사용자 1의 기록 `beanName="하늘 블렌드"` 2건, `"하늘 블렌드 2"` 1건, `"하늘블렌드"` 1건
- **When** `GET /brew-logs/bean-summary?beanName=%20하늘%20블렌드%20`
- **Then** `brewCount=2`
- **검증** 통합 테스트 `BeanSummaryServiceTest`

#### AC-BEANDETAIL-15 · 자주 쓴 비율은 최근 10잔의 최빈값이다

- **Given** 원두 41 기록 12건, `brewedAt` 최신순 비율 `15.6, 16.0, 15.6, 16.0, 15.6, 15.0, 15.0, 15.0, 15.0, 16.0, 15.0, 15.0`(11 · 12번째가 가장 오래됨). 1번째 기록 원두량 16.0 · 물량 250.0
- **When** 요약을 부르면
- **Then** 최근 10잔에서 `15.0` 4번 · `15.6` 3번 · `16.0` 3번 → `frequentRatio=15.0`. 11 · 12번째는 세지 않는다. `frequentDoseG` · `frequentWaterG`는 `15.0`을 쓴 가장 최근 기록(6번째)의 값
- **검증** 단위 테스트 `BeanSummaryTest`

#### AC-BEANDETAIL-16 · 최빈값이 동률이면 가장 최근 기록의 비율이다

- **Given** 최신순 비율 `16.0, 15.6, 16.0, 15.6`
- **When** 요약을 부르면
- **Then** `frequentRatio=16.0`, `frequentDoseG` · `frequentWaterG`는 1번째 기록의 값
- **검증** 단위 테스트 `BeanSummaryTest`

#### AC-BEANDETAIL-17 · 평균 별점은 별점 없는 기록을 빼고 소수 1자리 반올림이다

- **Given** 기록 5건, 별점 `4.0, 4.5, 4.0, 4.0, 없음`
- **When** 요약을 부르면
- **Then** `brewCount=5`, `ratedCount=4`, `averageRating=4.1`(4.125 → HALF_UP)
- **검증** 단위 테스트 `BeanSummaryTest`

#### AC-BEANDETAIL-18 · 최근 3개는 최신순이다

- **Given** 기록 5건, `brewedAt` `11.13`, `11.11`, `11.08`, `11.05`, `11.01`
- **When** 요약을 부르면
- **Then** `recent`의 `brewedAt`이 `11.13`, `11.11`, `11.08` 순서, 각 항목에 `id`·`actualDoseG`·`actualWaterG`·`brewRatio`·`rating`
- **검증** 통합 테스트 `BeanSummaryServiceTest`

#### AC-BEANDETAIL-19 · 기록이 없으면 0과 빈 값이다

- **Given** 원두 41, 내 기록 0건
- **When** 요약을 부르면
- **Then** 200, `brewCount=0`, `ratedCount=0`, `averageRating`·`frequentRatio`·`frequentDoseG`·`frequentWaterG`는 null, `recent=[]`
- **검증** 통합 테스트 `BeanSummaryServiceTest`

### 기능 — 화면

#### AC-BEANDETAIL-20 · 원두 고르기 결과 행에 원두 정보와 「정보」가 있다

- **Given** 검색 결과 `{ name: "하우스 블렌드 디카페인", roasterName: "북쪽 커피", roastLevel: "MEDIUM_DARK", decaf: true, countries: ["브라질", "콜롬비아", "에티오피아"], beanMix: "BLEND" }`, `{ name: "구지 시즌 블렌드", roasterName: "하늘 커피", roastLevel: null, decaf: false, countries: [] }`
- **When** 원두 고르기에서 `구지`를 입력하고 250ms가 지나면
- **Then** 1행: 이름 옆 「디카페인」 태그, 보조 줄 「북쪽 커피 · 중강배전 · 블렌드 · 3개국」. 2행: 점선 점, 보조 줄 「하늘 커피」. 각 행 오른쪽에 접근 이름 「<원두 이름> 정보」 버튼(44×44 이상)
- **검증** 컴포넌트 테스트 `BeanPickSheet.test.tsx`

#### AC-BEANDETAIL-21 · 「정보」는 시트를 쌓고, 「이 원두 고르기」로 고른다

- **Given** 원두 고르기 결과 행 원두 41
- **When** 「정보」를 누른 뒤 「이 원두 고르기」를 누르면
- **Then** 원두 정보 시트가 열리고(제목 = 원두 이름), 고르면 두 시트가 닫히고 빠른 기록 ①의 원두 줄이 원두 41의 이름. 행 자체를 누르면 시트 없이 바로 고른다
- **검증** 컴포넌트 테스트 `BeanPickSheet.test.tsx`

#### AC-BEANDETAIL-22 · 원두 상세는 있는 정보만 그린다

- **Given** ① 원두 41: `decaf=false`, `roastLevel=LIGHT`, `roastLevelAgtron=92`, `roastLevelCustom="Light #92"`, 산지 1행 고도 `1900~2100` ② 원두 50: `decaf=true`, `roastLevel=null`, `roastLevelCustom="Light #92"`, 산지 고도 `1750~1750` ③ 원두 60: 설명 · 산지 · 배전도 모두 없음
- **When** `/beans/41`, `/beans/50`, `/beans/60`
- **Then** ① 칩 「싱글」 · 「약배전」 · 「Agtron 92」, 「디카페인」 칩 없음, 「Light #92」 없음, 고도 「1,900–2,100 m」 ② 「디카페인」 칩, 배전도 칩 「Light #92」, 고도 「1,750 m」 ③ 칩 · 컵노트 · 산지 블록이 없고 「로스터가 알려 준 정보가 아직 많지 않습니다.」
- **검증** 컴포넌트 테스트 `BeanDetail.test.tsx`

#### AC-BEANDETAIL-23 · 블렌드는 산지마다 비율을 보인다

- **Given** 블렌드 원두, 산지 `브라질 · 세하도 50` · `콜롬비아 · 우일라 30` · `에티오피아 · 시다마 20`
- **When** 상세를 열면
- **Then** 산지 3줄이 이 순서로, 각 줄 오른쪽 `50%` · `30%` · `20%`, 비율 막대의 접근 이름 「브라질 50%, 콜롬비아 30%, 에티오피아 20%」
- **검증** 컴포넌트 테스트 `BeanDetail.test.tsx`

#### AC-BEANDETAIL-24 · 긴 컵노트는 2줄에서 접히고 누르면 펼쳐진다

- **Given** 설명 300자
- **When** 상세를 열고 컵노트를 누르면
- **Then** 처음에는 `-webkit-line-clamp: 2`, 누른 뒤에는 clamp 없음. `aria-expanded`가 `false` → `true`
- **검증** 컴포넌트 테스트 `BeanDetail.test.tsx`

#### AC-BEANDETAIL-25 · 구매처 링크는 새 탭으로, 없으면 줄이 없다

- **Given** `productUrl="https://momos.co.kr/shop/x"` / `productUrl=null`
- **When** 상세를 열면
- **Then** 「구매처에서 보기 ↗」 링크 `href` 그 값 · `target="_blank"` · `rel="noopener noreferrer"` / 링크 없음
- **검증** 컴포넌트 테스트 `BeanDetail.test.tsx`

#### AC-BEANDETAIL-26 · 내 기록 요약을 보인다

- **Given** 요약 `{ brewCount: 5, ratedCount: 4, averageRating: 4.1, frequentRatio: 15.6, frequentDoseG: 16.0, frequentWaterG: 250.0, recent: 3건 }` / `{ brewCount: 4, ratedCount: 4, averageRating: 4.0, ... }`
- **When** 상세를 열면
- **Then** 큰 숫자 `5` + 「잔」, 평균 별점 「★ 4.1 · 4잔 기준」, 자주 쓴 비율 `1:15.6`, 원두량→물량 `16→250`, 최근 기록 3행 / 평균 별점 「★ 4.0」(기준 문구 없음)
- **검증** 컴포넌트 테스트 `BeanDetail.test.tsx`

#### AC-BEANDETAIL-27 · 내 기록이 0잔이면 안내와 주 버튼만

- **Given** 요약 `brewCount=0`
- **When** 상세를 열면
- **Then** 「아직 이 원두로 내린 기록이 없어요」가 보이고 숫자 카드 · 최근 기록 행은 없다. 「이 원두로 기록하기」는 있다
- **검증** 컴포넌트 테스트 `BeanDetail.test.tsx`

#### AC-BEANDETAIL-28 · 숨긴 원두는 안내와 내 기록만 보인다

- **Given** 원두 45 `hidden=true`, 설명 · 산지 있음, 요약 `brewCount=4`
- **When** `/beans/45`
- **Then** 「카탈로그에서 내려간 원두예요. 내 기록은 그대로 남아 있어요.」, 이름 · 로스터 · 내 기록 카드만 보이고 칩 · 컵노트 · 산지 · 구매처 링크는 없다. 「이 원두로 기록하기」는 있다
- **검증** 컴포넌트 테스트 `BeanDetail.test.tsx`

#### AC-BEANDETAIL-29 · 직접 적은 원두는 이름과 내 기록만

- **Given** 내 기록 `beanName="하늘 블렌드"` 2건
- **When** `/beans/named?name=하늘%20블렌드`
- **Then** 제목 「하늘 블렌드」, 「내가 이름만 적어 만든 원두 · 나만 보여요」, 요약 `brewCount` 2. `GET /bean-products/*`는 부르지 않고 `GET /brew-logs/bean-summary?beanName=하늘 블렌드`만 부른다
- **검증** 컴포넌트 테스트 `BeanNamedPage.test.tsx`

#### AC-BEANDETAIL-30 · 「이 원두로 기록하기」는 이 원두의 지난 값을 채운다

- **Given** 원두 41 요약 `recent[0]` 원두량 18.0 · 물량 270.0, 전체 「지난번」 기록은 다른 원두 · 16.0 · 250.0 / 원두 42 요약 `recent=[]`
- **When** `/beans/41`에서 「이 원두로 기록하기」 / `/beans/42`에서 같은 버튼
- **Then** 빠른 기록 ①이 열리고 원두 줄 = 원두 41 이름, 원두량 18 · 물량 270 / 원두 줄 = 원두 42 이름, 원두량 16 · 물량 250
- **검증** 컴포넌트 테스트 `BeanDetail.test.tsx`

#### AC-BEANDETAIL-31 · 숨긴 원두는 최근 원두에서 빠진다

- **Given** 내 기록(최신순) `beanProductId=45`(`hidden=true`), `beanProductId=41`, `beanName="하늘 블렌드"`
- **When** 원두 고르기를 열면
- **Then** 「최근 고른 원두」가 「상품 41 이름」, 「하늘 블렌드」 순서. 상품 45는 없다. 빠른 기록 ①의 「지난번」 원두 줄은 상품 45 그대로
- **검증** 컴포넌트 테스트 `BeanPickSheet.test.tsx`

#### AC-BEANDETAIL-32 · 오늘 「지난번과 같게」의 원두 이름은 원두 상세로 간다

- **Given** 지난 기록 `beanProductId=41` / `beanName="하늘 블렌드"`
- **When** 오늘 홈의 「지난번과 같게」 카드에서 원두 이름을 누르면
- **Then** `/beans/41` / `/beans/named?name=하늘%20블렌드`로 이동한다. 「이대로 기록」 버튼 동작은 그대로
- **검증** 컴포넌트 테스트 `TodayLastCard.test.tsx`

#### AC-BEANDETAIL-33 · 기록 상세의 원두 행은 원두 상세로 간다

- **Given** 기록 상세, `beanProductId=41` / `beanName="하늘 블렌드"` / 원두 없음
- **When** 원두 행을 누르면
- **Then** `/beans/41` / `/beans/named?name=하늘%20블렌드` / 원두 행이 링크가 아니다
- **검증** 컴포넌트 테스트 `app/brews/[id]/page.test.tsx`

#### AC-BEANDETAIL-34 · 검색 결과가 20개를 넘으면 좁히라고 안내한다

- **Given** 검색 응답 `totalElements=37`, `content` 20개
- **When** 원두 고르기 결과를 보면
- **Then** 행 20개 + 「20개까지 보여요 — 더 좁혀 보세요」. `totalElements=20`이면 안내 없음
- **검증** 컴포넌트 테스트 `BeanPickSheet.test.tsx`

### 엣지 (경계값)

#### AC-BEANDETAIL-40 · 공백뿐인 q는 조건이 없다

- **Given** 숨기지 않은 원두 3개
- **When** `GET /bean-products?q=%20%20`
- **Then** 200, `totalElements=3`
- **검증** API 테스트 `BeanProductControllerTest`

#### AC-BEANDETAIL-41 · q 길이 경계

- **When** `q`가 앞뒤 공백 제외 50자 / 51자
- **Then** 200 / 400 `INVALID_REQUEST`
- **검증** API 테스트 `BeanProductControllerTest`

#### AC-BEANDETAIL-42 · size · page 경계

- **When** `size=1` / `size=50` / `size=0` / `size=51` / `page=-1`
- **Then** 200 / 200 / 400 `INVALID_REQUEST` / 400 `INVALID_REQUEST` / 400 `INVALID_REQUEST`
- **검증** API 테스트 `BeanProductControllerTest`

#### AC-BEANDETAIL-43 · 배전도가 없는 원두는 배전도 필터에서 빠진다

- **Given** 원두 A `roastLevel=LIGHT`, 원두 B `roastLevel=null`
- **When** `?roastLevel=LIGHT` / 필터 없이
- **Then** `[A]` / `[A, B]`
- **검증** API 테스트 `BeanProductControllerTest`

#### AC-BEANDETAIL-44 · 검색어는 1글자부터, 250ms 뒤 한 번만 부른다

- **Given** 원두 고르기, 검색 칸 비어 있음
- **When** `구`, `지`를 100ms 간격으로 입력하고 250ms 기다린다 / 칸을 모두 지운다
- **Then** `GET /bean-products?q=구지`가 정확히 1번 / 검색 요청 없이 최근 원두 목록으로 돌아간다
- **검증** 컴포넌트 테스트 `BeanPickSheet.test.tsx`

### 실패

#### AC-BEANDETAIL-50 · 잘못된 배전도 값

- **When** `GET /bean-products?roastLevel=LIGHTEST`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `BeanProductControllerTest`

#### AC-BEANDETAIL-51 · 없는 원두 상세

- **Given** `bean_products`에 id 999999 없음
- **When** `GET /bean-products/999999`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **검증** API 테스트 `BeanProductControllerTest`

#### AC-BEANDETAIL-52 · 요약 파라미터는 정확히 하나

- **When** `GET /brew-logs/bean-summary` / `?beanProductId=41&beanName=구지` / `?beanName=%20%20`
- **Then** 셋 모두 HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BEANDETAIL-53 · 없는 원두의 요약

- **When** `GET /brew-logs/bean-summary?beanProductId=999999`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-BEANDETAIL-54 · 인증 없이 검색 · 요약

- **When** 토큰 없이 `GET /bean-products?q=구지` / `GET /brew-logs/bean-summary?beanProductId=41`
- **Then** HTTP `401`을 반환한다 — 보안 필터의 401은 본문이 없다(`2026-09-05-http-error-contract.md`)
- **검증** API 테스트 `BeanProductControllerTest` · `BrewLogControllerTest`

#### AC-BEANDETAIL-55 · 상세를 불러오지 못하면 다시 시도할 수 있다

- **Given** `GET /bean-products/41`이 500
- **When** `/beans/41`
- **Then** 「원두 정보를 불러오지 못했어요」와 「다시 시도」 버튼. 누르면 같은 요청을 1번 더 보낸다. 「이 원두로 기록하기」는 없다
- **검증** 컴포넌트 테스트 `BeanDetail.test.tsx`

#### AC-BEANDETAIL-56 · 상세 경로에 없는 원두

- **Given** `GET /bean-products/999999`가 404
- **When** `/beans/999999`
- **Then** 「원두 정보를 불러오지 못했어요」 대신 「찾을 수 없는 원두입니다.」, 「다시 시도」 없음
- **검증** 컴포넌트 테스트 `BeanDetail.test.tsx`

### 비기능

#### AC-BEANDETAIL-60 · 검색은 1,000건에서 p95 300ms 이하

- **Given** 숨기지 않은 원두 1,000건(산지 1~3행), 로컬 Testcontainers PostgreSQL
- **When** `GET /bean-products?q=에티&roastLevel=LIGHT`를 워밍업 10번 뒤 100번 부르면
- **Then** 응답 시간 95번째 값이 300ms 이하
- **검증** 통합 테스트 `BeanProductSearchPerformanceTest`

#### AC-BEANDETAIL-61 · 프론트는 원두 전체 목록을 부르지 않는다

- **Given** `frontend/src` 전체(테스트 제외)
- **When** 소스를 검사하면
- **Then** `useBeanProducts` 정의 · 사용 0건. `/api/v1/bean-products`를 쿼리 문자열 없이 `GET`하는 곳 0건(`POST` 등록은 남는다)
- **검증** 단위 테스트 `noFullBeanList.test.ts`(소스 파일을 읽어 정규식 검사)

---

## 구현 순서

- [x] **Task 1: 플래그 컬럼 + 크롤러 규칙** — Covers: AC-BEANDETAIL-01, 02, 03

  ```java
  // BeanProduct
  @Column(nullable = false) private boolean hidden;
  @Column(name = "manually_edited", nullable = false) private boolean manuallyEdited;

  // BeanImportService.importBean — existing가 있고 크롤러 소유일 때
  if (product.isManuallyEdited()) {
    product.updateProductUrl(bean.productUrl());   // 산지 attachOrigins도 건너뛴다
    return new ImportResult(Outcome.UPDATED, null, unmapped);
  }
  ```

- [x] **Task 2: 검색 API** — Covers: AC-BEANDETAIL-04, 05, 06, 07, 08, 09, 10, 40, 41, 42, 43, 50, 54, 60
  `GET /bean-products`를 네이티브 쿼리 `BeanProductRepository.search`(q · roasterId · roastLevel[] · decaf · country +
  페이지)로 바꾼다 — 로스터 이름 검색에 조인이 필요해 `RecipeRepository.searchPublic`과 같은 null-safe 패턴을 따랐다. 응답 `PageResponse<BeanProductSummaryResponse>`. 로스터 이름은 한 번에 읽어 붙인다(N+1 금지).
  `findAllBeanProducts()`는 지운다.

- [x] **Task 3: 상세 응답 확장** — Covers: AC-BEANDETAIL-11, 12, 51
  `BeanProductResponse`에 `roasterName` · `hidden`, `BeanOriginResponse`에 `varietyName` · `processName`(`name_ko ?? name`).

- [x] **Task 4: 내 기록 요약 API** — Covers: AC-BEANDETAIL-13, 14, 15, 16, 17, 18, 19, 52, 53, 54
  계산은 순수 함수 `BeanSummary.of(List<BrewLog> newestFirst)`로 떼서 단위 테스트한다. 봉투 경유 기록은
  `bean_batch_id IN (그 상품의 봉투 id)`로 함께 읽는다.

- [x] **Task 5: 계약 · 프론트 API 층 이전** — Covers: AC-BEANDETAIL-61
  `node scripts/generate-contract-types.mjs`. `features/catalog/api.ts`에 `useBeanSearch(params)` ·
  `useBeanProductsByIds(ids)`, 상세 Zod 스키마에 새 필드(`useBeanSummary`는 쓰는 곳인 Task 7에서). 전체 목록을 쓰던
  곳(`QuickBrewSheet` · `BrewLogForm`→`BeanPickerDialog` · `BeanBatchDialog`)을 검색 API / id별 단건 조회로 옮기고
  `useBeanProducts`를 지운다.
  테스트 픽스처는 로컬 실제 응답에서 뜬다.

- [x] **Task 6: 원두 고르기 행 보강 · 정보 시트** — Covers: AC-BEANDETAIL-20, 21, 31, 34, 44
  결과 행(U2) · 쌓이는 시트(U1b) · 최근 원두에서 숨김 제외.

- [ ] **Task 7: 원두 상세 화면** — Covers: AC-BEANDETAIL-22, 23, 24, 25, 26, 27, 28, 29, 55, 56
  `/beans/[id]` · `/beans/named` — 모바일 + 웹 2열(UW), 로딩 뼈대 · 다크는 시안 그대로.

- [ ] **Task 8: 「이 원두로 기록하기」 · 오늘 카드 진입** — Covers: AC-BEANDETAIL-30, 32

- [ ] **Task 9: 기록 상세 진입** — Covers: AC-BEANDETAIL-33

---

## 수동 확인

- [ ] ★ `mockup-checker`로 11 Beans U1a · U1b · U1c · U1g · U1h · U2 · UW와 실제 화면을 390×844 · 1440×900에서 대조
- [ ] ★ 운영 카탈로그로 원두 고르기에서 `구지` · `디카페인` · 로스터 이름을 검색해 결과가 기대와 같은지
- [ ] PWA 설치본에서 「구매처에서 보기 ↗」가 시스템 브라우저로 열리는지(11 Beans 질문 10)

## 열어둔 결정

- **플래그를 켜는 API · 관리자가 이름을 바꾼 원두의 다음 수집** — 관리자 원두 스펙(`docs/specs/2026-11-15-admin-beans.md`)이
  맡는다. 크롤러가 `product_url`로 먼저 찾도록 바꿔 중복을 막는다(DECISIONS 7절 질문 04 — B7 정정의 `source_name` 열 안을 대체).
- **검색 인덱스** — 카탈로그가 1,000건을 넘거나 AC-BEANDETAIL-60이 실패하면 `lower(name)` trigram 인덱스를 별도 PR로.
- **「이 원두 기록 모두 보기」** — 기록 목록에 `beanProductId` · `beanName` 필터가 생기면 링크를 되살린다.

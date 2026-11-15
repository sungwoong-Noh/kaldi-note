---
id: QUICKBREW
title: 빠른 기록 — 오늘 홈 · 빠른 기록 시트 · 기록 탭
status: 구현중
milestone: P1
supersedes: docs/specs/2026-09-19-home-calendar.md
---

# 빠른 기록 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 시나리오

커피를 내린 사람이 홈 「오늘」에서 「기록하기」를 눌러, 원두량과 물량만 적고 기록을 남긴다. 지난번과 같게
내렸으면 「이대로 기록」 → 별점 → 저장, 탭 3번으로 끝난다. 레시피·원두·그라인더는 없어도 되고, 원두는
카탈로그에서 고르거나 이름만 적는다. 남긴 기록은 「기록」 탭에서 목록과 달력으로 다시 본다.

방향: `docs/decisions/0011-brew-first-minimal-input.md` · 시안: `docs/design/kaldi-note-design/screens/10 Brew First.dc.html`
(A 오늘 · B 빠른 기록 · C 기록 상세 · F 기록 탭 · G 탭 바 · H 규격) · 결정: `docs/design/kaldi-note-design/docs/DECISIONS.md` 1·6절.

### 범위 밖 (Non-goals)

- 「레시피로 저장」(시안 D, C1·B5·BW3의 버튼) — P2. **이 스펙에서는 버튼을 그리지 않는다**
- 4칸 레시피 작성(시안 E), 레시피 상세의 「이걸로 내리기」(B13) — P2
- 타이머 — P3
- 오프라인 보내기 대기(B16) — 저장은 온라인 필요(DECISIONS 6절 추가 결정)
- 시안의 커스텀 숫자 키패드 — OS 기본 키패드를 쓴다
- 팔로우 레일 · 친구 피드 — 보류(M4)
- 원두 카탈로그 검색 API — 기존 `GET /bean-products` 전체 목록을 프론트가 거른다
- 원두 봉투(batch) 등록 흐름의 변경 — 기존 화면은 그대로 두고, 새 기록이 쓰지 않을 뿐이다

## 용어

| 용어 | 정의 |
|---|---|
| 빠른 기록 | 시트(모바일) · 오른쪽 패널(웹)로 여는 3단계 기록 입력. ① 원두·양 → ② 맛 → ③ 완료 |
| 지난번 | 호출자 본인의 기록 중 `brewedAt`이 가장 늦은 1건(`GET /brew-logs?userId={me}&size=1`의 첫 항목) |
| 이번 주 | KST 기준 **월요일 00:00:00 이상, 다음 월요일 00:00:00 미만** |
| 직접 입력 원두 | 카탈로그 상품을 고르지 않고 이름만 적은 원두. `brew_logs.bean_name`에 남는다 |
| 3탭 경로 | 홈 「이대로 기록」(1) → ② 별(2) → 「저장」(3) |

## 데이터

**마이그레이션 하나**(번호는 구현 시점의 다음 번호 — 「열어둔 결정」). 카탈로그(`bean_products`)·재고(`bean_batches`) 테이블은 바꾸지 않는다.

| 테이블 | 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|---|
| `brew_logs` | `bean_product_id` | `BIGINT REFERENCES bean_products(id)` | Y | **신규.** 카탈로그에서 고른 원두 |
| `brew_logs` | `bean_name` | `VARCHAR(100)` | Y | **신규.** 직접 입력 원두 이름(`bean_products.name`과 같은 길이) |
| `brew_logs` | `roasted_at` | `DATE` | Y | **신규.** 로스팅 날짜. 봉투 없이 기록에 직접 |
| `brew_logs` | `bean_batch_id` | 그대로 | **N → Y** | 기존 기록은 값 유지. 새 빠른 기록은 null |
| `brew_logs` | `recipe_snapshot` | 그대로 | **N → Y** | 레시피 없는 기록은 null(ADR 0002 「연결하면 스냅샷」은 그대로) |
| `brew_logs` | `actual_water_temp_c` | 그대로 | **N → Y** | |
| `brew_logs` | `user_grinder_id` | 그대로 | **N → Y** | |
| `brew_logs` | `actual_grind_setting_value` | 그대로 | **N → Y** | |
| `brew_logs` | `days_off_roast` | 그대로 | **N → Y** | 로스팅 날짜를 모르면 null |
| `brew_logs` | `degassing_status` | 그대로 | **N → Y** | 같음 |

- `recipe_id`는 V14에서 이미 nullable이다.
- 인덱스: `CREATE INDEX idx_brew_logs_bean_product ON brew_logs (bean_product_id)`.
- 기존 행은 값을 바꾸지 않는다(AC-QUICKBREW-06). 새 컬럼은 기존 행에서 null이다.
- **원두 표시 우선순위:** `bean_product_id`(상품 이름) → `bean_name` → `bean_batch_id`의 상품 이름 → 없음.
- **로스팅 날짜 우선순위:** `roasted_at` → `bean_batch_id`의 `roasted_at`. 경과일 계산은 기존 `computeDaysOffRoast`·`DegassingStatus.of`를 그대로 쓴다.
- `docs/design/kaldi-note-design/docs/DECISIONS.md` 4절의 「`recipeSnapshot` 항상 채움」은 이 스펙 구현 시 「레시피가 연결된 기록만」으로 고친다.

## 계약

| 메서드 | 경로 | 인증 | 바뀌는 것 |
|---|---|---|---|
| `POST` | `/api/v1/brew-logs` | 필요 | 필수값 축소 · 원두 필드 3개 추가 |
| `PATCH` | `/api/v1/brew-logs/{id}` | 필요 | `beanProductId`·`beanName`·`roastedAt`을 고칠 수 있다. **null은 기존 규칙대로 「변경 없음」** — 값 지우기는 하지 않는다(2026-11-14 승인 후 정정, AC-08) |
| `GET` | `/api/v1/brew-logs` · `/{id}` | 필요 | 응답에 `beanProductId`·`beanName`·`roastedAt` 추가. 「지난번」은 `?userId={me}&size=1` |
| `GET` | `/api/v1/brew-logs/calendar` | 필요 | 변경 없음 — 「이번 주」·「지난주」·요일 점을 프론트가 계산 |

계약 파일: `docs/contracts/2026-11-14-quick-brew.json` — 구현 Task 1에서 만든다(`docs/contracts/README.md` 규칙).

**요청 — 필수는 `actualDoseG`·`actualWaterG` 둘뿐**

```json
{
  "actualDoseG": 16.0,
  "actualWaterG": 250.0
}
```

**요청 — 전부 채운 예**

```json
{
  "brewedAt": "2026-11-13T23:20:00Z",
  "visibility": "PRIVATE",
  "actualDoseG": 16.0,
  "actualWaterG": 250.0,
  "actualWaterTempC": 92.0,
  "actualTotalTimeSeconds": 165,
  "actualDrawdownSeconds": 35,
  "beanProductId": 41,
  "roastedAt": "2026-11-02",
  "userGrinderId": 3,
  "actualGrindSettingValue": 24.0,
  "recipeId": 12,
  "rating": 4.0,
  "overallNote": "단맛이 길게 남음"
}
```

| 필드 | 필수 | 규칙 |
|---|---|---|
| `actualDoseG` · `actualWaterG` | **Y** | `> 0`, 소수 1자리(기존 `NUMERIC(5,1)`·`(6,1)`) |
| `brewedAt` | N | 없으면 서버가 저장 시각. 있으면 `@PastOrPresent`(기존) |
| `visibility` | N | 없으면 `PRIVATE`(기존 DB 기본값). 「지난번 값」 기본은 **프론트가** 채운다 |
| `beanProductId` | N | 없는 id면 404 |
| `beanName` | N | 앞뒤 공백 제거 후 1~100자. 공백뿐이면 null로 저장 |
| `beanProductId` + `beanName` 동시 | — | 400 |
| `beanBatchId` | N | 기존 의미 그대로(남의 봉투면 403) |
| `roastedAt` | N | `brewedAt`의 날짜 이하(경과일과 같은 기준 — 기존 `computeDaysOffRoast`의 UTC 날짜). 늦으면 400 |
| `userGrinderId` | N | 남의 그라인더면 403(기존) |
| `actualGrindSettingValue` | N | **`userGrinderId` 없이 주면 400.** 추정 µm은 그라인더가 있을 때만 계산 |
| `actualWaterTempC` · 시간 · TDS · 맛 5축 · `rating` · `overallNote` | N | 기존 검증 그대로(`rating` 0.5~5.0 · `overallNote` ≤1000자) |
| `recipeId` | N | 주면 스냅샷을 박는다(기존). 남의 볼 수 없는 레시피면 403(기존) |

---

## 인수 조건

> 각 조건은 리터럴 값을 쓴다. 테스트에 `AC-QUICKBREW-<번호>`를 남긴다.

### 기능 — 백엔드

#### AC-QUICKBREW-01 · 원두량·물량만으로 기록이 생긴다

- **Given** 로그인한 사용자, 다른 기록 0건
- **When** `POST /api/v1/brew-logs` `{ "actualDoseG": 16.0, "actualWaterG": 250.0 }`
- **Then** 201. 응답 `brewedAt`은 요청 시각과 5초 이내. `recipeId`·`beanBatchId`·`beanProductId`·`beanName`·`userGrinderId`·`actualGrindSettingValue`·`actualWaterTempC`·`daysOffRoast`·`degassingStatus`는 null(non_null 직렬화로 키 없음). `visibility`는 `"PRIVATE"`. `brewRatio`는 `15.6`
- **검증** API 테스트 `QuickBrewControllerTest`

#### AC-QUICKBREW-02 · 원두 이름만 직접 적어 기록한다

- **Given** 로그인한 사용자
- **When** `POST` `{ "actualDoseG": 16.0, "actualWaterG": 260.0, "beanName": "  하늘 블렌드 " }`
- **Then** 201, `beanName`은 `"하늘 블렌드"`, `beanProductId`·`beanBatchId`는 없다. `bean_products` 행 수는 변하지 않는다
- **검증** API 테스트 `QuickBrewControllerTest`

#### AC-QUICKBREW-03 · 카탈로그 원두를 고른다

- **Given** `bean_products` id 41 존재
- **When** `POST` `{ "actualDoseG": 16.0, "actualWaterG": 250.0, "beanProductId": 41 }`
- **Then** 201, 응답 `beanProductId`는 41. `bean_batches` 행 수는 변하지 않는다
- **검증** API 테스트 `QuickBrewControllerTest`

#### AC-QUICKBREW-04 · 로스팅 날짜로 경과일을 계산한다

- **Given** —
- **When** `POST` `{ ..., "brewedAt": "2026-11-14T03:00:00Z", "roastedAt": "2026-11-02" }` (UTC·KST 모두 11.14)
- **Then** `daysOffRoast`는 12, `degassingStatus`는 기존 `DegassingStatus.of(12)`의 값. `roastedAt`이 없으면 둘 다 null
- **검증** API 테스트 `QuickBrewControllerTest`

#### AC-QUICKBREW-05 · 레시피를 연결할 때만 스냅샷이 생긴다

- **Given** 내 레시피 id 12
- **When** `recipeId: 12`로 1건, `recipeId` 없이 1건 저장
- **Then** 앞 건은 `recipeSnapshot`이 채워지고(기존 규칙 그대로), 뒷 건은 `recipeSnapshot`이 없다
- **검증** API 테스트 `QuickBrewControllerTest`

#### AC-QUICKBREW-06 · 기존 기록은 마이그레이션 전후로 같다

- **Given** 마이그레이션 직전 버전으로 `recipeId`·`beanBatchId`·`userGrinderId`가 모두 있는 기록 1건
- **When** 마이그레이션 후 `GET /api/v1/brew-logs/{id}`
- **Then** 기존 필드 값이 전부 같고, 새 필드 `beanProductId`·`beanName`·`roastedAt`은 없다
- **검증** API 테스트 `QuickBrewControllerTest`(기존 방식 기록의 응답) + 수동 확인(로컬 DB의 기존 행에 V19 적용)

#### AC-QUICKBREW-07 · 「지난번」은 목록의 첫 항목이다

- **Given** 내 기록 3건(`brewedAt` 11.10 · 11.13 · 11.12), 다른 사용자 기록 1건(11.14)
- **When** `GET /api/v1/brew-logs?userId={me}&size=1`
- **Then** `content`는 1건이고 그 `brewedAt`은 11.13 기록이다. `totalElements`는 3
- **검증** API 테스트 `QuickBrewControllerTest`

#### AC-QUICKBREW-08 · 수정의 null은 「변경 없음」이다 — 새 필드도 같다

> **정정 (2026-11-14, 승인 후):** 처음에는 「null로 선택값을 비운다」였으나, 기존 `BrewLogPatchRequest`의
> 「null = 변경 없음, 값 지우기 미지원」 규칙과 충돌해 사용자 결정으로 바꿨다. 값 지우기는 「열어둔 결정」.

- **Given** `beanName: "하늘 블렌드"`·`userGrinderId: 3`·`actualGrindSettingValue: 24.0`인 내 기록
- **When** `PATCH` `{ "beanName": null, "userGrinderId": null, "rating": 4.5 }` / `PATCH` `{ "beanName": "구지" }`
- **Then** 200, `rating`만 4.5로 바뀌고 나머지는 그대로 / 200, `beanName`이 `"구지"`
- **검증** API 테스트 `QuickBrewControllerTest`

### 기능 — 화면

#### AC-QUICKBREW-20 · ★ 지난번과 같으면 탭 3번으로 저장된다

- **Given** 지난번 기록 `{ beanProductId: 41, actualDoseG: 16.0, actualWaterG: 250.0, userGrinderId: 3, actualGrindSettingValue: 24.0, actualWaterTempC: 92.0, visibility: "FRIENDS" }`, 뷰포트 390×844 와 1440×900
- **When** 홈 `/`에서 클릭을 정확히 3번 — 「이대로 기록」 → 별 4번째(오른쪽 절반) → 「저장」
- **Then** `POST /api/v1/brew-logs`가 정확히 1번 나가고 본문의 `beanProductId` 41 · `actualDoseG` 16.0 · `actualWaterG` 250.0 · `userGrinderId` 3 · `actualGrindSettingValue` 24.0 · `actualWaterTempC` 92.0 · `visibility` `"FRIENDS"` · `rating` 4.0. 그 뒤 「기록했어요」가 보인다
- **검증** e2e `quick-brew.spec.ts` (클릭 수를 세는 헬퍼로 3을 단언)

#### AC-QUICKBREW-21 · 첫 사용자 홈은 할 일 하나만

- **Given** 내 기록 0건
- **When** `/`
- **Then** 「첫 잔을 기록해 보세요」와 「기록하기」 버튼만 보이고, 「지난번과 같게」 · 「이번 주」 · 「최근 기록」 카드는 없다
- **검증** 페이지 테스트 `page.test.tsx`

#### AC-QUICKBREW-22 · 「이번 주」 카드는 2잔째부터, 주는 월요일 시작

- **Given** 오늘 2026-11-14(토) KST. 기록 날짜 11.08(일), 11.09(월) 각 1건
- **When** `/`
- **Then** 「이번 주」 카드가 없다(이번 주 = 11.09~11.15에 1잔). 11.12(목) 1건을 더하면 카드가 보이고 숫자는 `2`, 「지난주 1잔」
- **검증** 단위 테스트 `weekSummary.test.ts` + 페이지 테스트

#### AC-QUICKBREW-23 · 시작 단계

- **Given** 지난번 기록 있음
- **When** 「기록하기」 / 「이대로 기록」
- **Then** 「기록하기」는 ① 「지난번과 같은가요?」(1 / 3)로, 「이대로 기록」은 ② 「맛은 어땠나요?」(2 / 3)로 열린다. 지난번 기록이 없으면 「기록하기」는 ① 「얼마나 내렸나요?」(입력 상태)로 열린다
- **검증** 컴포넌트 테스트 `QuickBrewSheet.test.tsx`

#### AC-QUICKBREW-24 · 미리 채우는 값

- **Given** 지난번 기록(AC-20의 값) + `rating: 3.5`, `overallNote: "쓴맛"`
- **When** 「기록하기」 → 「바꿀래요」
- **Then** 원두·원두량 16·물량 250·그라인더·분쇄도 24·온도 92·공개 범위 「맞팔로우」가 채워져 있고, 별점·메모·맛 5축·TDS는 비어 있다
- **검증** 컴포넌트 테스트

#### AC-QUICKBREW-25 · 공개 범위 기본값

- **Given** 지난번 `visibility: "PUBLIC"` / 지난번 없음
- **When** ② 「자세히」를 편다
- **Then** 「전체」 / 「나만」이 선택돼 있다
- **검증** 컴포넌트 테스트

#### AC-QUICKBREW-26 · 직접 입력한 원두가 최근 원두에 남는다

- **Given** `beanName: "하늘 블렌드"` 기록 1건(가장 최근), `beanProductId: 41` 기록 1건
- **When** ① → 원두 「고르기」
- **Then** 「최근 고른 원두」 첫 행이 「하늘 블렌드」, 둘째 행이 상품 41의 이름. 같은 원두는 한 번만 나온다
- **검증** 컴포넌트 테스트 `BeanPickSheet.test.tsx`

#### AC-QUICKBREW-27 · 카탈로그에 없으면 이름으로 기록

- **Given** 검색어 「하늘 블렌드」, 일치하는 상품 0개
- **When** 「「하늘 블렌드」로 기록」을 누른다
- **Then** ①로 돌아가고 원두 줄이 「하늘 블렌드」. 저장 요청 본문에 `beanName: "하늘 블렌드"`, `beanProductId` 없음
- **검증** 컴포넌트 테스트

#### AC-QUICKBREW-28 · 별 반 개

- **Given** ② 맛
- **When** 별 4번째의 왼쪽 절반 / 오른쪽 절반을 누른다
- **Then** 표시가 `3.5` / `4.0`이고 저장 본문 `rating`이 3.5 / 4.0
- **검증** 컴포넌트 테스트

#### AC-QUICKBREW-29 · 탭 바

- **Given** 모바일 390
- **When** 아무 화면
- **Then** 하단 탭 라벨이 순서대로 `오늘` · `기록` · `레시피` · `더보기`, `href`는 `/` · `/brews` · `/recipes` · `/more`. 웹 상단 바 링크는 `오늘` · `기록` · `레시피` + 「기록하기」 버튼
- **검증** 컴포넌트 테스트 `BottomNav.test.tsx` · `WebTopBar.test.tsx`

#### AC-QUICKBREW-30 · 「레시피로 저장」이 없다

- **Given** 빠른 기록 완료(③), 레시피 없는 기록 상세(C1)
- **When** 화면을 본다
- **Then** 이름이 「레시피로 저장」인 버튼·링크가 0개
- **검증** 컴포넌트 테스트

#### AC-QUICKBREW-31 · 「기록」 탭

- **Given** 내 기록 142건
- **When** `/brews`
- **Then** 제목 옆 숫자 `142잔`(목록 응답 `totalElements`), 세그먼트 「목록」 · 「달력」. 목록에서 600px 스크롤 → 「달력」 → 「목록」이면 스크롤 위치가 600px
- **검증** 페이지 테스트 + e2e

#### AC-QUICKBREW-32 · 기록 상세 두 모양

- **Given** 레시피 없는 기록(C1) / `recipeId`가 있는 기록(C2)
- **When** `/brews/{id}`
- **Then** 앞(C1)은 `h1`이 `원두명(카탈로그 → 직접 입력 → 배치) → "{dose}g → {water}g" → "레시피 없이 기록"` 순(링크 아님), 부제 `"레시피 없이 기록"`, 비교표 대신 실측 원장 행(`원두량`·`물량`·선택 `물 온도`/`추출 시간`), `원두` 원장 행은 `beanProductId`·`beanName`·`roastedAt`까지 표시한다(기존 메타 헬퍼 `useBeanMetadataSources`·`resolveBeanSummary` 재사용). 뒤(C2)는 「항목 · 레시피 · 실제」 비교표(기존). 두 모양 모두 상세 히어로 대표 수치는 기존 우선순위(수율 → 비율 → 물 온도)를 유지한다
- **검증** 페이지 테스트

#### AC-QUICKBREW-33 · C1의 「다시 내리기」는 그 값으로 ①을 연다

- **Given** 레시피 없는 기록(C1) 상세(원두량 15 · 물량 240 등 선택값 포함) / `recipeId`가 있는 기록(C2) 상세
- **When** 「다시 내리기」
- **Then** C1은 `button`이며 누르면 `openQuickBrew()`로 그 기록의 값(원두·원두량·물량·온도·공개 범위, 내 기록이면 그라인더·분쇄도)을 채운 빠른 기록 ①(`amount`)이 열려 원두량 15 · 물량 240이 보인다. C2는 기존 `/brews/new?recipeId=...` 링크를 유지한다(`AC-BDETAIL-11·12·13·18·21`, `AC-SMALL-10` 그대로)
- **검증** 컴포넌트 테스트 + 페이지 테스트

#### AC-QUICKBREW-34 · 선택값이 빈 기록도 편집 화면이 열린다

- **Given** AC-01로 만든 기록(또는 `recipeId` 없음·`beanProductId`/`beanName`만 있는 기록)
- **When** `/brews/{id}/edit`를 열고 (a) 별점을 바꿔 저장한다 / (b) 아무것도 바꾸지 않고 저장한다
- **Then** 오류 없이 열리고 원두량 16 · 물량 250이 채워져 있다. `recipeId`가 없으면 레시피 행은 `"레시피 없이 기록"`으로 보이고, `beanProductId`·`beanName`은 읽기 전용 원두 행에 표시되며 `beanBatchId`가 없으면 `useBeanLabel`은 조회하지 않는다. (a) 별점을 바꿔 저장하면 다른 빈 선택 칸을 채우지 않아도 `PATCH`가 200으로 성공하고, (b) 아무것도 바꾸지 않고 저장하면 요청 0회로 상세로 돌아간다(`AC-WEBLOGEDIT-11` 유지)
- **검증** 페이지 테스트

#### AC-QUICKBREW-35 · 웹 「달력」 모드는 720px 달력 카드와 선택 날짜 목록이다

- **Given** 뷰포트 `1440×900`, `/brews`, `2026-11` 달력(`days` 8일 · `totalCount` 12)과 선택 날짜 `2026-11-14` 기록 1건
- **When** 세그먼트 `달력`을 누른다
- **Then** 우측 `300px` 사이드 카드가 사라지고 본문에 최대 폭 `720px`의 점 기반 달력 카드(`2026.11` · `8일 · 12잔`)가 렌더되며, 그 아래 선택 날짜 목록 헤더 `11.14 토 · 1잔`과 해당 날짜의 기록 행이 모바일 F2와 같은 구성으로 보인다
- **검증** 페이지 테스트 `brews/page.test.tsx` + e2e

#### AC-QUICKBREW-36 · 웹 300px 달력 카드의 월 이동과 날짜 클릭 스크롤·전환

- **Given** 뷰포트 `1440×900`, `/brews` 목록 모드(우측 `300px` 달력 카드, 로드된 목록에 `2026-11-12` 기록 있음 · `2026-10-05` 기록은 로드된 목록에 없음)
- **When** 카드 헤더의 `‹` / `›` 버튼을 누른다 / 로드된 날짜 `2026-11-12`를 누른다 / 로드된 목록에 없는 날짜 `2026-10-05`를 누른다
- **Then** `‹` / `›`를 누르면 `GET /api/v1/brew-logs/calendar?month=…`를 불러 달력 월이 바뀐다. 로드된 날짜 `2026-11-12`를 누르면 `목록` 모드를 유지한 채 왼쪽 원장의 `11.12 목` 날짜 그룹으로 `scrollIntoView` 한다. 로드된 목록에 없는 날짜 `2026-10-05`를 누르면 추가 `GET /api/v1/brew-logs` 페이지 요청 없이 `달력` 모드로 전환해 `10.05` `DayList`를 보여준다
- **검증** 페이지 테스트 `brews/page.test.tsx` + e2e

#### AC-QUICKBREW-37 · 760–1023px에서 달력 카드는 이번 주 한 줄로 접혀 시작해 탭으로 펼친다

- **Given** 뷰포트 `900×900`, `/brews` 목록 모드(참고: `1280px` 이상은 우측 사이드 `300px`, `1024–1279px`은 `280px`)
- **When** `900×900`에서 `/brews`를 열고, 이어서 접힌 이번 주 줄을 누른다
- **Then** 처음에는 1열 배치로 원장 위에 **이번 주 한 줄(7일 셀 1행)** 만 접힌 상태로 보이며 별도 펼치기 토글 버튼은 없다. 그 주 줄을 누르면 해당 달 전체 달력 그리드로 펼쳐진다
- **검증** 페이지 테스트 `brews/page.test.tsx` + e2e

### 엣지 (경계값)

#### AC-QUICKBREW-40 · 원두량·물량 경계

- **Given** —
- **When** `actualDoseG`가 `0.0` / `0.1`
- **Then** 400 `INVALID_REQUEST` / 201. 물량도 같다. 둘 중 하나가 없으면 400 `INVALID_REQUEST`
- **검증** API 테스트 `QuickBrewControllerTest`

#### AC-QUICKBREW-41 · 원두 이름 길이

- **Given** —
- **When** `beanName`이 100자 / 101자 / `"   "`
- **Then** 201 / 400 `INVALID_REQUEST` / 201이고 `beanName` 없음
- **검증** API 테스트 `QuickBrewControllerTest`

#### AC-QUICKBREW-42 · 로스팅 날짜 경계

- **Given** `brewedAt` `2026-11-14T03:00:00Z`(UTC·KST 모두 11.14)
- **When** `roastedAt`이 `2026-11-14` / `2026-11-15`
- **Then** 201(`daysOffRoast` 0) / 400 `INVALID_REQUEST`
- **검증** API 테스트 `QuickBrewControllerTest`

#### AC-QUICKBREW-43 · 필수 칸이 비면 「다음」이 잠긴다

- **Given** ① 「얼마나 내렸나요?」, 원두량 16 · 물량 빈 칸
- **When** 「다음」을 누른다
- **Then** 「다음」은 `aria-disabled="true"`이고 요청이 나가지 않는다. 포커스가 물량 칸으로 가고 칸 바로 아래 「물량을 적어 주세요」. 비율 자리는 `1:—`
- **검증** 컴포넌트 테스트

#### AC-QUICKBREW-44 · 바뀐 것이 없으면 묻지 않고 닫는다

- **Given** ① 열고 아무것도 바꾸지 않음 / 별점 4.0을 누름
- **When** 「닫기」
- **Then** 바로 닫힘 / 「기록을 그만둘까요?」 카드(주 버튼 「계속 쓰기」, 보조 「그만두기」)
- **검증** 컴포넌트 테스트

### 실패

#### AC-QUICKBREW-50 · 원두를 두 방식으로 동시에 주면 거부

- **Given** —
- **When** `POST` `{ ..., "beanProductId": 41, "beanName": "구지" }`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `QuickBrewControllerTest`

#### AC-QUICKBREW-51 · 그라인더 없이 분쇄도만

- **Given** —
- **When** `POST` `{ ..., "actualGrindSettingValue": 24.0 }` (`userGrinderId` 없음)
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `QuickBrewControllerTest`

#### AC-QUICKBREW-52 · 없는 원두 상품

- **Given** `bean_products`에 id 999999 없음
- **When** `POST` `{ ..., "beanProductId": 999999 }`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `QuickBrewControllerTest`

#### AC-QUICKBREW-53 · 남의 그라인더

- **Given** 다른 사용자의 `user_grinders` id
- **When** `POST` `{ ..., "userGrinderId": <그 id> }`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`(기존 규칙이 필수값 축소 뒤에도 유지)
- **검증** API 테스트 `QuickBrewControllerTest`

#### AC-QUICKBREW-54 · 저장 실패 — 입력 유지

- **Given** ② 별점 4.0 · 메모 「단맛이 길게 남음」, `POST`가 500
- **When** 「저장」
- **Then** 시트가 열린 채 별점·메모가 그대로, 문구 「저장하지 못했어요. 입력한 내용은 그대로 있어요.」, 주 버튼 이름 「다시 시도」. 누르면 같은 본문으로 다시 요청한다
- **검증** 컴포넌트 테스트

### 비기능 (모션 · 타이밍)

> 시안 H 표의 값. PR #196(기본 모션)이 넣은 시트·패널 `200ms ease-out`은 이 스펙에서 아래 값으로 바뀐다.

#### AC-QUICKBREW-60 · 시트·패널

- **Given** 모바일 390 / 웹 1440
- **When** 빠른 기록을 연다 / 닫는다
- **Then** 시트(아래에서)·패널(오른쪽에서) 이동이 열기 `240ms` · 닫기 `200ms`, 곡선 `cubic-bezier(0.2, 0.8, 0.2, 1)`. 스크림은 `--scrim` 토큰(라이트 `ink` 32%, 다크 명도 0.1 · 55%)
- **검증** e2e `quick-brew.spec.ts` — `getAnimations()`의 `effect.getTiming()`으로 `duration`·`easing` 단언

#### AC-QUICKBREW-61 · 동작 줄이기

- **Given** `prefers-reduced-motion: reduce`
- **When** 시트를 연다 · 단계를 넘긴다 · 버튼을 누른다 · 완료 화면
- **Then** 시트는 이동 애니메이션 0개(스크림만 `120ms` 페이드), 단계 이동은 교차 페이드 `100ms`만, 누름 scale 없음, 완료 체크는 처음부터 그려진 상태
- **검증** e2e (`page.emulateMedia({ reducedMotion: "reduce" })`)

#### AC-QUICKBREW-62 · 단계 이동

- **Given** ① → ②
- **When** 「네, 같아요」
- **Then** 내용 `24px` 수평 이동 + 교차 페이드 `200ms ease-out`, 진행 막대 채움 `200ms ease-out`
- **검증** e2e

#### AC-QUICKBREW-63 · 누름 피드백

- **Given** 「기록하기」 · 「이대로 기록」 · 기록 카드
- **When** 누른다
- **Then** `scale(0.98)`, 누를 때 `80ms` · 뗄 때 `120ms`
- **검증** 단위 테스트(클래스) + e2e(계산된 `transition-duration`)

#### AC-QUICKBREW-64 · 완료 체크와 숫자

- **Given** ③ 완료
- **When** 화면이 뜬다
- **Then** 체크 선이 `120ms` 지연 뒤 `360ms` 동안 그려진다. 「이번 주 N번째 잔」 숫자는 `120ms ease-out` 세로 넘기기
- **검증** e2e

#### AC-QUICKBREW-65 · 뼈대 300ms 규칙

- **Given** 홈 데이터 응답 지연 `250ms` / `600ms`
- **When** `/`
- **Then** 뼈대가 한 번도 그려지지 않는다 / 뼈대가 그려지고 내용으로 바뀔 때 `120ms` 페이드
- **검증** e2e (route 지연)

#### AC-QUICKBREW-66 · 「저장하는 중…」 400ms 규칙

- **Given** `POST` 응답 지연 `200ms` / `800ms`
- **When** 「저장」
- **Then** 「저장하는 중…」 문구가 DOM에 나타나지 않고 ③으로 / 「저장하는 중…」이 보인 뒤 ③으로
- **검증** 컴포넌트 테스트(가짜 타이머)

#### AC-QUICKBREW-67 · 웹 패널 폭

- **Given** 뷰포트 `1440` / `1100` / `900`
- **When** 「기록하기」
- **Then** 패널 폭 `440px` / `400px` / `min(100vw, 520px)`
- **검증** e2e

#### AC-QUICKBREW-68 · 끌어 닫기 30%

- **Given** 모바일 시트, 바뀐 입력 없음
- **When** 손잡이를 시트 높이의 `29%` / `31%`만큼 아래로 끈다
- **Then** 제자리로 돌아온다 / 닫힌다
- **검증** e2e (`page.mouse` 드래그)

### 기능 — 달력 부품 (기존 홈 스펙에서 승계)

> 홈(`/`) 달력은 「오늘」 화면(시안 A)으로 대체되지만, 기존 달력 부품(`Calendar`·`MonthNav`·`DayList` 모바일)은
> 「기록」 탭(`/brews` 달력, Task 12 시안 F2·FW)에서 다시 쓴다. 테스트 코드의 기존 AC ID 역참조를 유지하기 위해
> 원래 ID(`AC-HOMECAL-*`) 그대로 아래 30건(`Calendar` 19 · `MonthNav` 6 · `DayList` 모바일 5)을 이 스펙으로 옮겨
> 살린다. 원래 조건에 적힌 「홈」 맥락은 `/brews` 달력 부품 기준으로 해석한다.

#### AC-HOMECAL-25 · 주 시작이 월요일이다

- **Given** 달력 부품
- **When** 달력을 렌더한다
- **Then** 요일 헤더의 첫 칸이 `월`이고 마지막 칸이 `일`이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-26 · 기록이 2건인 날에도 점은 1개다

- **Given** `2026-09-05`의 `count`가 `2`인 달력 응답
- **When** 달력을 렌더한다
- **Then** `2026-09-05` 셀 안의 점 요소가 `1`개다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-34 · 좌우 스와이프로 월이 바뀐다

- **Given** `2026-09`를 보는 중
- **When** 달력 영역에서 좌우로 스와이프한다
- **Then** `onSwipeLeft`·`onSwipeRight`가 불려 월 헤더가 바뀐다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx` (Task 12 e2e 포함)

#### AC-HOMECAL-35 · 화살표 키로 날짜가 이동한다

- **Given** `2026-09-19` 셀에 포커스가 있다
- **When** `→`를 한 번, `↓`를 한 번 누른다
- **Then** 포커스가 `2026-09-20`을 거쳐 `2026-09-27`에 있다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-45 · 날짜 셀의 aria-label이 건수를 말한다

- **Given** `2026-09-19`에 기록 2건, `2026-09-03`에 기록 없음
- **When** 두 셀의 `aria-label`을 읽는다
- **Then** 각각 `"9월 19일, 기록 2건"`, `"9월 3일, 기록 없음"`이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-46 · 선택된 셀에 aria-current가 있다

- **Given** `2026-09-05`를 선택한 상태
- **When** DOM을 본다
- **Then** `aria-current="date"`인 요소가 정확히 1개이고 그것이 `2026-09-05` 셀이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-53 · signal-record 토큰이 라이트·다크에서 각각 지정값이다

- **Given** `globals.css`
- **When** 라이트와 다크에서 `--signal-record`를 읽는다
- **Then** 각각 `oklch(0.55 0.16 30)`, `oklch(0.65 0.17 30)`이다
- **검증** 단위 테스트 `signalRecordToken.test.ts`

#### AC-HOMECAL-92 · 요일 헤더가 mono 10px·대문자·자간 0.08em으로 렌더된다

- **Given** 달력 부품(모바일)
- **When** 요일 헤더(`월 화 수 목 금 토 일`) 7칸을 렌더한다
- **Then** 각 칸의 `font-family`가 mono, `font-size`가 10px, `text-transform`이 uppercase,
  `letter-spacing`이 0.08em이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-93 · 요일 헤더 평일 색이 oklch(0.58 0.02 70)이다

- **Given** 요일 헤더의 월~금 칸
- **When** 렌더한다
- **Then** 글자 색이 `oklch(0.58 0.02 70)`(라이트)이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-94 · 요일 헤더 주말 색이 oklch(0.62 0.02 70)이다

- **Given** 요일 헤더의 토·일 칸
- **When** 렌더한다
- **Then** 글자 색이 `oklch(0.62 0.02 70)`(라이트)이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-95 · 이번 달 지난 날짜(평일) 색이 oklch(0.3 0.015 60)이다

- **Given** 이번 달 안의 오늘보다 이전 날짜이고 평일(월~금)인 셀
- **When** 렌더한다
- **Then** 날짜 숫자 색이 `oklch(0.3 0.015 60)`이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-96 · 이번 달 지난 날짜(주말) 색이 oklch(0.5 0.015 60)이다

- **Given** 이번 달 안의 오늘보다 이전 날짜이고 주말(토·일)인 셀
- **When** 렌더한다
- **Then** 날짜 숫자 색이 `oklch(0.5 0.015 60)`이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-97 · 미래 날짜(평일) 색이 oklch(0.72 0.012 70)이다

- **Given** 오늘보다 미래인 날짜이고 평일인 셀(같은 달 안)
- **When** 렌더한다
- **Then** 날짜 숫자 색이 `oklch(0.72 0.012 70)`이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-98 · 미래 날짜(주말) 색이 oklch(0.78 0.012 70)이다

- **Given** 오늘보다 미래인 날짜이고 주말인 셀(같은 달 안)
- **When** 렌더한다
- **Then** 날짜 숫자 색이 `oklch(0.78 0.012 70)`이다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-98a · 다크 모드 날짜 색은 기존 ink 스케일을 재사용한다

- **Given** 다크 모드
- **When** AC-HOMECAL-95~98의 4가지 상태를 각각 렌더한다
- **Then** 지난날-평일은 `--ink`(다크, `oklch(0.95 0.005 85)`), 지난날-주말은 `--ink-2`(다크,
  `oklch(0.82 0.008 78)`), 미래-평일은 `--ink-3`(다크, `oklch(0.68 0.01 70)`), 미래-주말은
  새 토큰 `--date-future-weekend`(다크, `oklch(0.55 0.012 70)`)를 쓴다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-98b · 다크 모드 요일 헤더 색은 평일·주말 모두 ink-3를 쓴다

- **Given** 다크 모드
- **When** 요일 헤더를 렌더한다
- **Then** 평일·주말 모두 `--ink-3`(다크, `oklch(0.68 0.01 70)`)를 쓴다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-99 · 오늘 날짜는 위 4색 규칙을 따르지 않고 선택/오늘 스타일이 우선한다

- **Given** 오늘 날짜 셀
- **When** 선택되지 않은 상태로 렌더한다
- **Then** AC-HOMECAL-95~98의 색 대신 28px 원 + 1px `border` 링 스타일이 적용된다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-100 · 기록 점과 날짜 숫자 사이 gap이 4px다(선택 여부 무관)

- **Given** 기록이 1건 이상인 날짜 셀(모바일)
- **When** 렌더한다
- **Then** 날짜 숫자와 기록 점 사이 `gap`이 선택 여부와 관계없이 4px다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-101 · 기록이 없는 날짜도 점과 같은 크기의 투명 자리를 유지한다

- **Given** 기록이 0건인 날짜 셀
- **When** 렌더한다
- **Then** 점 위치에 5px 크기의 요소가 존재하되 `background`가 없다 — 기록 있는 날과 없는 날의 날짜 숫자 baseline이 같다
- **검증** 컴포넌트 테스트 `Calendar.test.tsx`

#### AC-HOMECAL-32 · 이번 달에서 다음 달 버튼이 비활성이다

- **Given** 오늘이 `2026-09-19`이고 `2026-09`를 보는 중
- **When** `MonthNav`를 렌더한다
- **Then** 다음 달 버튼이 `disabled`다
- **검증** 컴포넌트 테스트 `MonthNav.test.tsx`

#### AC-HOMECAL-40 · 월 헤더 라벨이 달력 주인과 표시 모드에 따라 다르다

- **Given** `2026-11` 달력(`days` 길이 `8`, `totalCount` `12`)과 팔로우 대상 `지연`의 달력(`days` 길이 `4`, `totalCount` `6`)
- **When** 웹 카드/확장 헤더로 내 달력과 `지연`의 달력을 각각 본다(`ownerNickname` prop)
- **Then** 각각 `8일 · 12잔`(`{days.length}일 · {totalCount}잔`), `지연 · 6잔`이다(P1에서는 내 달력만 쓰지만 `MonthNav` 부품 API는 M4까지 유지)
- **When** 모바일 `/brews` 달력(시안 F2)으로 `MonthNav`를 본다
- **Then** `2026.11`과 `‹` `›` 이동 버튼만 보이고 건수 라벨(`8일 · 12잔`)은 생략된다
- **검증** 컴포넌트 테스트 `MonthNav.test.tsx`

> **표기 갱신 (2026-11-15):** 시안 F(F2·FW)에 맞춰 월 헤더 건수 라벨을 한국어(`8일 · 12잔`, 팔로우 대상 `지연 · 6잔`)로 바꾸고 모바일 F2에서는 건수를 생략한다.

#### AC-HOMECAL-41 · 1건은 `1잔`, 0건은 `0잔`이다

- **Given** `totalCount`가 각각 `1`, `0`인 달력 응답(또는 `activeDays: 8`, `totalCount: 12`)
- **When** `brewCountLabel`로 월 헤더 건수를 포맷한다
- **Then** 각각 `1잔`, `0잔`이며 `activeDays`가 함께 주어지면 `8일 · 12잔`이다
- **검증** 단위 테스트 `brewCountLabel.test.ts`

> **표기 갱신 (2026-11-15):** 시안 F(FW) 한국어 일괄 교체에 맞춰 영문 `1 BREW` / `0 BREWS`를 `1잔` / `0잔`과 `{activeDays}일 · {totalCount}잔`으로 갱신했다.

#### AC-HOMECAL-105 · 월 이동 버튼의 클릭 영역이 44×44px다

- **Given** 월 이동 버튼(‹, ›) 2개
- **When** `MonthNav`를 렌더한다
- **Then** 각 버튼(`<button>`)의 누르는 영역(`hit-44`)이 44px 이상이다(2026-10-11 `AC-HOMEFIT-06`으로 hit area 기준 갱신)
- **검증** 컴포넌트 테스트 `MonthNav.test.tsx`

#### AC-HOMECAL-106 · 월 이동 버튼의 시각 박스가 32×32px다

- **Given** 월 이동 버튼
- **When** `MonthNav`를 렌더한다
- **Then** 버튼 자신의 `height`·`width`가 32px, `border-radius`가 7px이고 안쪽 테두리 상자 없는 한 겹이다(2026-10-11 `AC-HOMEFIT-06` 반영)
- **검증** 컴포넌트 테스트 `MonthNav.test.tsx`

#### AC-HOMECAL-107 · 월 라벨이 새 타입 스케일 `month-label`(mono 22px)로 렌더된다

- **Given** 월 헤더의 `2026.09` 라벨
- **When** `MonthNav`를 렌더한다
- **Then** `font-family`가 mono, `font-size`가 22px, `font-weight`가 500, `letter-spacing`이 -0.03em이다
- **검증** 컴포넌트 테스트 `MonthNav.test.tsx` + `src/test/typography.test.ts`

#### AC-HOMECAL-42 · 목록 헤더가 날짜·요일·건수를 담는다

- **Given** `2026-11-14`(토)에 기록 1건
- **When** 모바일 `DayList`를 렌더한다
- **Then** 목록 헤더가 `11.14 토 · 1잔`이다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`

> **표기 갱신 (2026-11-15):** 시안 F2에 맞춰 영문 `09.19 SAT · 2 BREWS`를 한국어 `11.14 토 · 1잔` 형식으로 갱신했다.

#### AC-HOMECAL-43 · 수율이 없으면 비율을 보여준다

- **Given** `extractionYieldPercent`가 `20.4`인 기록과, 그 키가 없고 `brewRatio`가 `15.6`인 기록
- **When** `DayList` 목록을 본다
- **Then** 각각 `20.4 %`, `1:15.6`이다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`

#### AC-HOMECAL-76 · 원두를 연결하지 않은 기록은 roast dot이 없다

- **Given** `beanBatchId` 키가 없는 기록 1건
- **When** `DayList` 목록을 본다
- **Then** 그 행에 roast dot 요소가 없다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`

#### AC-HOMECAL-108 · 목록 행에 시각·별점 캡션 줄이 새 타입 스케일 `caption`(sans 11.5px)으로 렌더된다

- **Given** 날짜별 목록의 브루 로그 행 1개(별점이 있는 경우)
- **When** 모바일 `DayList`를 렌더한다
- **Then** 레시피명 아래에 `{HH:mm} · ★ {rating}` 형식의 캡션 줄이 `font-size` 11.5px, 색 `ink-3`로 렌더된다
- **검증** 컴포넌트 테스트 `DayList.test.tsx` + `src/test/typography.test.ts`

#### AC-HOMECAL-109 · 별점이 없으면 캡션 줄에 시각만 렌더된다

- **Given** 별점이 `null`인 브루 로그 행
- **When** 모바일 `DayList`를 렌더한다
- **Then** 캡션 줄이 `{HH:mm}`만 표시하고 `· ★`는 생략된다
- **검증** 컴포넌트 테스트 `DayList.test.tsx`

### 기능 — 이전 스펙에서 승계한 현행 AC

> 달력 부품 30건 외에, 아래 45건(백엔드 달력·목록·맞팔로우 API 33건 + 공용 `kstDate`·`RoastDot`·`Avatar`·`formatLedgerDate` 및 프로필 `/u/[id]`·`/brews` 현행 규칙 12건)도
> 이 스펙으로 대체되지 않고 코드·테스트가 현행 유지된다. 기존 4개 스펙(`home-calendar` 3종 + `my-cups-ledger`)을 `status: 대체됨`으로 닫으면서
> [`check-spec-coverage.sh`](../../scripts/check-spec-coverage.sh) 감시에서 빠지지 않도록 원래 ID 그대로 이 소절로 옮겨 소유한다.

#### AC-HOMECAL-01 · 기록이 있는 날짜만 담는다

- **Given** 2026-09에 `2026-09-02`와 `2026-09-05`(KST)에만 기록이 있는 사용자
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `days`의 길이가 `2`이고 `date`가 각각 `"2026-09-02"`, `"2026-09-05"`다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-02 · UTC 전날 23시 기록은 KST 다음 날에 집계된다

- **Given** `brewedAt`이 `2026-09-18T23:00:00Z`인 기록 1건만 있는 사용자
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `days`가 `[{ "date": "2026-09-19", "count": 1, ... }]`다 — `2026-09-18`이 아니다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-03 · KST 자정 경계가 `15:00:00Z`에서 갈린다

- **Given** `brewedAt`이 각각 `2026-09-19T14:59:59Z`, `2026-09-19T15:00:00Z`인 기록 2건
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `days`가 `[{"date":"2026-09-19","count":1,...},{"date":"2026-09-20","count":1,...}]`다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-04 · 같은 날 2건이면 항목은 1개이고 count가 2다

- **Given** `2026-09-05`(KST)에 기록 2건이 있는 사용자
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `date`가 `"2026-09-05"`인 항목이 **1개**이고 그 `count`가 `2`다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-05 · totalCount는 그 달 전체 건수다

- **Given** `2026-09-02`에 1건, `2026-09-05`에 2건이 있는 사용자
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `totalCount`가 `3`이고 `month`가 `"2026-09"`다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-06 · days는 date 오름차순이다

- **Given** `2026-09-20`, `2026-09-02`, `2026-09-11` 순으로 저장된 기록 3건
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `days[*].date`가 `["2026-09-02", "2026-09-11", "2026-09-20"]`이다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-07 · 소프트 삭제된 기록은 집계되지 않는다

- **Given** `2026-09-02`에 기록 2건이 있고 그중 1건의 `deleted_at`이 `NULL`이 아니다
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `date`가 `"2026-09-02"`인 항목의 `count`가 `1`이고 `totalCount`가 `1`이다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-08 · 맞팔로우 상대의 FRIENDS 기록이 집계된다

- **Given** 호출자와 상호 팔로우한 사용자 `12`가 `2026-09-05`에 `visibility=FRIENDS` 기록 1건
- **When** `GET /api/v1/brew-logs/calendar?userId=12&month=2026-09`
- **Then** `totalCount`가 `1`이고 `days`에 `"2026-09-05"`가 있다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-09 · 맞팔로우가 아니면 PUBLIC만 집계된다

- **Given** 호출자와 팔로우 관계가 없는 사용자 `12`가 `2026-09-05`에 `PUBLIC` 1건,
  `2026-09-06`에 `FRIENDS` 1건, `2026-09-07`에 `PRIVATE` 1건
- **When** `GET /api/v1/brew-logs/calendar?userId=12&month=2026-09`
- **Then** `totalCount`가 `1`이고 `days`가 `2026-09-05` 하나뿐이다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-10 · 존재하지 않는 userId는 200과 빈 결과다

- **Given** 어떤 사용자도 갖지 않는 `userId=999999`
- **When** `GET /api/v1/brew-logs/calendar?userId=999999&month=2026-09`
- **Then** HTTP `200`, `days`가 `[]`, `totalCount`가 `0`이다 — `403`도 `404`도 아니다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-11 · month 형식이 틀리면 400이다

- **Given** 인증된 호출자
- **When** `GET /api/v1/brew-logs/calendar?month=2026-13`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-12 · 미래 달은 200과 빈 결과다

- **Given** 오늘이 `2026-09-19`
- **When** `GET /api/v1/brew-logs/calendar?month=2027-01`
- **Then** HTTP `200`, `days`가 `[]`, `totalCount`가 `0`이다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-13 · 토큰이 없으면 401이다

- **Given** `Authorization` 헤더 없음
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** HTTP `401`을 반환한다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-14 · userId를 생략하면 호출자 본인의 달력이다

- **Given** 호출자가 `2026-09-02`에 기록 1건, 다른 사용자가 `2026-09-03`에 `PUBLIC` 1건
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09` (`userId` 없음)
- **Then** `days`가 `2026-09-02` 하나뿐이다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-66 · primaryRecipeName은 그날 가장 늦게 내린 기록의 레시피명이다

- **Given** `2026-09-05`(KST)에 `08:00`에 「Hoffmann V60」, `14:00`에 「Kasuya 4:6」으로 내린 기록 2건
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `date`가 `"2026-09-05"`인 항목의 `primaryRecipeName`이 `"Kasuya 4:6"`이다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-67 · 기록이 없는 날은 days에 항목 자체가 없다

- **Given** `2026-09-02`에만 기록이 있는 사용자
- **When** `GET /api/v1/brew-logs/calendar?month=2026-09`
- **Then** `days`에 `"2026-09-03"`을 `date`로 갖는 항목이 없다 — `count: 0` 항목이 아니다
- **검증** API 테스트 `BrewLogCalendarControllerTest`

#### AC-HOMECAL-15 · date는 KST 기준 하루로 필터한다

- **Given** `brewedAt`이 `2026-09-18T23:00:00Z`, `2026-09-19T14:59:59Z`,
  `2026-09-19T15:00:00Z`인 기록 3건
- **When** `GET /api/v1/brew-logs?date=2026-09-19`
- **Then** `content`의 길이가 `2`이고 `2026-09-19T15:00:00Z` 기록이 빠진다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-HOMECAL-16 · date와 userId는 AND로 결합된다

- **Given** `2026-09-19`에 호출자 기록 1건, 맞팔로우 사용자 `12`의 기록 1건
- **When** `GET /api/v1/brew-logs?userId=12&date=2026-09-19`
- **Then** `content`의 길이가 `1`이고 그 `userId`가 `12`다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-HOMECAL-17 · date 형식이 틀리면 400이다

- **Given** 인증된 호출자
- **When** `GET /api/v1/brew-logs?date=2026-9-19`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-HOMECAL-73 · 목록 요약 응답에 overallNote가 담긴다

- **Given** `overallNote`가 `"산미가 강했다"`인 기록 1건
- **When** `GET /api/v1/brew-logs`
- **Then** `content[0].overallNote`가 `"산미가 강했다"`다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-HOMECAL-18 · 맞팔로우인 사람만 담긴다

- **Given** 호출자가 `12`와 상호 팔로우, `13`을 일방 팔로우, `14`에게 일방 팔로우당한 상태
- **When** `GET /api/v1/users/me/mutual-follows`
- **Then** 배열의 길이가 `1`이고 `[0].id`가 `12`다
- **검증** API 테스트 `MutualFollowControllerTest`

#### AC-HOMECAL-19 · 마지막 기록이 최근인 순으로 정렬된다

- **Given** 맞팔로우 `12`의 마지막 기록이 `2026-09-10`, `13`의 마지막 기록이 `2026-09-18`
- **When** `GET /api/v1/users/me/mutual-follows`
- **Then** `[*].id`가 `[13, 12]`다
- **검증** API 테스트 `MutualFollowControllerTest`

#### AC-HOMECAL-20 · 기록이 없는 맞팔로우는 맨 뒤에 닉네임 오름차순으로 놓인다

- **Given** 맞팔로우 `12`(닉네임 `지연`, 기록 있음), `13`(닉네임 `하은`, 기록 없음),
  `14`(닉네임 `민재`, 기록 없음)
- **When** `GET /api/v1/users/me/mutual-follows`
- **Then** `[*].id`가 `[12, 14, 13]`이다 — 무기록자끼리 `민재` → `하은` 순이다
- **검증** API 테스트 `MutualFollowControllerTest`

#### AC-HOMECAL-21 · 마지막 기록 시각이 같으면 닉네임 오름차순이다

- **Given** 맞팔로우 `12`(닉네임 `하은`), `13`(닉네임 `민재`)의 마지막 기록 `brewedAt`이 동일하다
- **When** `GET /api/v1/users/me/mutual-follows`
- **Then** `[*].id`가 `[13, 12]`다
- **검증** API 테스트 `MutualFollowControllerTest`

#### AC-HOMECAL-22 · 응답에 email과 role이 없다

- **Given** `email`과 `role`을 가진 맞팔로우 사용자 1명
- **When** `GET /api/v1/users/me/mutual-follows`
- **Then** `[0]`의 키가 `id`·`nickname`·`profileImageUrl`뿐이고 `email`·`role`·`createdAt` 키가 없다
- **검증** API 테스트 `MutualFollowControllerTest`

#### AC-HOMECAL-23 · 자기 자신은 목록에 없다

- **Given** 맞팔로우가 `12` 한 명인 호출자 `11`
- **When** `GET /api/v1/users/me/mutual-follows`
- **Then** `[*].id`에 `11`이 없다
- **검증** API 테스트 `MutualFollowControllerTest`

#### AC-HOMECAL-24 · 맞팔로우 목록도 토큰이 없으면 401이다

- **Given** `Authorization` 헤더 없음
- **When** `GET /api/v1/users/me/mutual-follows`
- **Then** HTTP `401`을 반환한다
- **검증** API 테스트 `MutualFollowControllerTest`

#### AC-HOMECAL-54 · 기존 목록과 상세가 KST 날짜로 표시된다

- **Given** `brewedAt`이 `2026-09-18T23:00:00Z`인 기록
- **When** `/brews` 목록과 `/brews/[id]` 상세를 본다
- **Then** 두 곳 모두 `2026-09-19`를 보여준다 — `2026-09-18`이 아니다
- **검증** 단위·컴포넌트 테스트 `kstDate.test.ts`, `BrewLogCard.test.tsx`, `app/brews/[id]/page.test.tsx`
- **(일부 대체됨)** 상세 쪽 표기는 `09.19 토 · 08:00`(KST)이다 — [`2026-10-11-brew-detail-fidelity.md`](2026-10-11-brew-detail-fidelity.md) `AC-BDETAIL-04`. KST로 바꾼다는 요점은 그대로다.

#### AC-HOMECAL-75 · roast dot 색이 로스팅 강도에 따라 다르다

- **Given** `roastLevel`이 각각 `LIGHT`, `DARK`인 원두를 쓴 기록 2건
- **When** 목록을 본다
- **Then** 두 행의 roast dot `background-color`가 서로 다르다
- **검증** 컴포넌트 테스트 `RoastDot.test.tsx`

#### AC-HOMECAL-111 · 프로필 화면의 관계 문구도 동일하게 닉네임을 보간한다

- **Given** `/u/[id]` 프로필 화면, 맞팔로우 상태
- **When** 관계 문구를 렌더한다
- **Then** 문구가 `"맞팔로우 상태여서 {닉네임} 님의 기록이 보입니다."` 형식으로 렌더된다(기존
  고정 문구 `"맞팔로우 — 서로의 기록이 보입니다"`를 대체)
- **검증** 페이지 테스트 `app/u/[id]/page.test.tsx`

#### AC-HOMECAL-119 · 아바타 배경색이 userId 기반으로 3색 중 하나로 결정된다

- **Given** 프로필 사진이 없는 사용자 A(id=1)·B(id=2)·C(id=3)
- **When** 각각의 이니셜 아바타를 렌더한다
- **Then** 배경색이 `oklch(0.88 0.02 60)`·`oklch(0.88 0.008 80)`·`oklch(0.88 0.015 70)` 중
  하나이고, 계산식은 `userId % 3`이다(백엔드 필드 추가 없음, 프론트에서만 계산)
- **검증** 컴포넌트 테스트 `Avatar.test.tsx`

#### AC-HOMECAL-120 · 같은 사용자는 항상 같은 아바타 색을 받는다

- **Given** 사용자 A(id=1)
- **When** 아바타를 두 번(예: 팔로우 레일과 프로필 화면) 렌더한다
- **Then** 두 렌더링의 배경색이 같다(같은 `userId → color` 함수 사용)
- **검증** 컴포넌트 테스트 `Avatar.test.tsx`

#### AC-HOMEFIT-14 · 아바타 사진은 고정 박스다

- **Given** `profileImageUrl`이 있는 아바타, `size` `32`·`36`·`50` 각각
- **When** 렌더한다
- **Then** `img`의 computed `width`·`height`가 각각 `size`px이고 `object-fit`이 `cover`다(#179)
- **검증** 컴포넌트 테스트 `Avatar.test.tsx`

#### AC-HOMEFIT-20 · 아바타 사진이 실패하면 이니셜 원이다

- **Given** `profileImageUrl`이 있지만 이미지 로드가 실패한다(`error` 이벤트)
- **When** 아바타를 렌더한다
- **Then** `img`가 사라지고 닉네임 첫 글자 원이 같은 `size`로 그려진다
- **검증** 컴포넌트 테스트 `Avatar.test.tsx`

#### AC-MYCUPS-01 · 목록은 본인 잔만 부른다

- **Given** 로그인 사용자 `me.id = 11`
- **When** `/brews`를 연다
- **Then** 목록 요청 URL에 `userId=11`이 있다
- **검증** 페이지 테스트 `app/brews/page.test.tsx`

#### AC-MYCUPS-02 · month는 KST 그 달의 잔만 준다

- **Given** 같은 사용자의 잔 `2026-09-30T14:59:59Z`(KST 9/30 23:59:59) · `2026-09-30T15:00:00Z`(KST 10/01 00:00) · `2026-10-31T14:59:59Z` · `2026-10-31T15:00:00Z`
- **When** `GET /api/v1/brew-logs?month=2026-10`
- **Then** 가운데 둘(`2026-09-30T15:00:00Z`, `2026-10-31T14:59:59Z`)만 온다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-MYCUPS-03 · minRating은 그 값 이상만 주고 별점 없는 잔은 뺀다

- **Given** 별점 `5` · `4` · `3` · 없음인 잔 4개
- **When** `GET /api/v1/brew-logs?minRating=4`
- **Then** `5`·`4` 두 개만 오고 `totalElements`가 `2`다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-MYCUPS-12 · 행 전체가 기록 상세 링크다

- **Given** 모바일·웹 `/brews` (시안 F 목록 원장 행 및 달력 `DayList` 행)
- **When** 첫 행(id 2)의 날짜/시각·제목 영역을 누른다
- **Then** `/brews/2`로 이동한다
- **검증** 페이지 테스트 + e2e
- **(해석 갱신 2026-11-15):** BM1/BW1 표 행에서 시안 F1/F2/FW 원장 행 전체 링크 기준으로 해석한다.

#### AC-MYCUPS-13 · 올해가 아닌 잔은 연도를 붙인다

- **Given** `brewedAt: "2025-09-19T00:00:00Z"`, 오늘 `2026-10-10`
- **When** `formatLedgerDate`로 날짜를 포맷한다
- **Then** 날짜가 `2025.09.19 금`이다. 올해 잔은 `08.31 월`(연도 없음)이다
- **검증** 단위 테스트 `format.test.ts`

#### AC-MYCUPS-16 · minRating·month의 양끝은 허용된다

- **Given** 로그인 사용자
- **When** `minRating=1`, `minRating=5`, `month=2026-01`, `month=2026-12`로 각각 부른다
- **Then** 넷 다 `200`이다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-MYCUPS-17 · date가 month 밖이면 빈 목록이다

- **Given** 로그인 사용자
- **When** `GET /api/v1/brew-logs?month=2026-10&date=2026-09-30`
- **Then** `200`, `content: []`, `totalElements: 0`
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-MYCUPS-19 · month 형식이 틀리면 400이다

- **Given** 로그인 사용자
- **When** `month=2026-13`, `month=2026-1`, `month=202610`으로 각각 부른다
- **Then** 셋 다 HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-MYCUPS-20 · minRating이 범위 밖이거나 정수가 아니면 400이다

- **Given** 로그인 사용자
- **When** `minRating=0`, `minRating=6`, `minRating=abc`로 각각 부른다
- **Then** 셋 다 HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-MYCUPS-23 · 가로 스크롤이 없다

- **Given** 로그인 사용자
- **When** `390×844`와 `1440×900`(및 `760×1024`)에서 `/brews`를 연다
- **Then** `document.documentElement.scrollWidth`가 각각 뷰포트 폭 이하이고, 시안 F 원장·달력 카드 컨테이너의 가로 넘침이 없다
- **검증** e2e
- **(해석 갱신 2026-11-15):** 웹 `<table>` 대신 시안 F 원장·달력 카드 레이아웃 기준으로 해석한다.

#### AC-MYCUPS-24 · 라벨 표시에 새 API를 만들지 않는다

- **Given** `/brews` 시안 F 구현
- **When** 목록 한 페이지를 렌더한다
- **Then** 레시피·원두 라벨은 기존 조회 훅·캐시(`useRecipeLabels`·`useBeanBatchLabels`·카탈로그 목록 등)만 쓰고, `/brew-logs`·`/brew-logs/calendar` 외 새 백엔드 API를 부르지 않는다
- **검증** 페이지 테스트 `app/brews/page.test.tsx`(등록되지 않은 경로 요청 시 실패)
- **(해석 갱신 2026-11-15):** 시안 F 행에서 배전도 점·드리퍼 보조줄이 빠졌으나 원두·레시피명 표시에 기존 캐시 재사용·백엔드 무추가 원칙을 유지한다.

---

## 대체하는 이전 스펙과 AC

이 스펙이 `/`를 시안 A(「오늘」)로, `/brews`를 시안 F(「기록」 목록/달력)로 바꾸므로 기존 달력 홈 스펙 3개와 내 잔 목록 스펙을 모두
`status: 대체됨`으로 닫는다. (`check-docs.sh`가 frontmatter `supersedes:`에 경로 하나만 허용하므로
대표 스펙 `docs/specs/2026-09-19-home-calendar.md`만 frontmatter에 적고, 4개 전체 관계를 여기에 명시한다.)

- [`2026-09-19-home-calendar.md`](2026-09-19-home-calendar.md) (`status: 대체됨`, 83개 + 기 대체 `AC-HOMECAL-77`)
- [`2026-09-20-home-calendar-mockup-fidelity.md`](2026-09-20-home-calendar-mockup-fidelity.md) (`status: 대체됨`, 39개)
- [`2026-10-11-home-fidelity.md`](2026-10-11-home-fidelity.md) (`status: 대체됨`, 23개)
- [`2026-10-10-my-cups-ledger.md`](2026-10-10-my-cups-ledger.md) (`status: 대체됨`, 24개)

### 어떤 AC가 어디로 가는지

| 이전 AC (출발 스펙) | 개수 | 처리 | 근거 · 현재 테스트 위치 |
|---|---|---|---|
| `AC-HOMECAL-25·26·34·35·45·46·53·92~101·98a·98b` (`09-19`, `09-20`) | 19 | **승계 (살림)** → 이 스펙 `Calendar` 부품 | Task 12 「기록」 탭 달력 재사용. `Calendar.test.tsx`, `signalRecordToken.test.ts` |
| `AC-HOMECAL-32·40·41·105·106·107` (`09-19`, `09-20`) | 6 | **승계 (살림)** → 이 스펙 `MonthNav` 부품 | Task 12 월 헤더 재사용(`40·41` 시안 F 한국어 헤더 일괄 교체 반영). `MonthNav.test.tsx`, `brewCountLabel.test.ts` |
| `AC-HOMEFIT-06` (`10-11`) | 1 | **통합 유지** → `AC-HOMECAL-105·106` | `MonthNav.test.tsx`가 `AC-HOMECAL-105·106`에 함께 태그해 동일 규칙 검증 |
| `AC-HOMECAL-42·43·76·108·109` (`09-19`, `09-20`) | 5 | **승계 (살림)** → 이 스펙 `DayList` 모바일 | Task 12 시안 F2·FW 날짜별 원장 행 재사용(`42` 시안 F2 한국어 헤더 `11.14 토 · 1잔` 반영). `DayList.test.tsx` |
| `AC-HOMECAL-01~17·66·67·73` (`09-19`) | 20 | **승계 (살림)** → 이 스펙 「이전 스펙에서 승계한 현행 AC」 | `/` 오늘·`/brews` 달력이 계약 그대로 사용. `BrewLogCalendarControllerTest`, `BrewLogControllerTest`, `CalendarMonthTest` |
| `AC-HOMECAL-18~24` (`09-19`) | 7 | **승계 (살림)** → 이 스펙 「이전 스펙에서 승계한 현행 AC」 | UI 팔로우 레일은 M4 보류, 백엔드 API·`MutualFollowControllerTest`는 유지 |
| `AC-HOMECAL-54·75·111·119·120`, `AC-HOMEFIT-14·20` (`09-19`, `09-20`, `10-11`) | 7 | **승계 (살림)** → 이 스펙 「이전 스펙에서 승계한 현행 AC」 | KST 표기(`kstDate.test.ts`, `BrewLogCard`, `/brews/[id]`), `RoastDot`, `Avatar`, `/u/[id]`(`UserProfile`) 현행 유지 |
| `AC-MYCUPS-01·02·03·12·13·16·17·19·20·23·24` (`10-10`) | 11 | **승계 (살림)** → 이 스펙 「이전 스펙에서 승계한 현행 AC」 | 본인 `userId` 조회, 백엔드 필터 계약 6건(`BrewLogControllerTest`), `formatLedgerDate`(`format.test.ts`), 행 상세 링크·가로 스크롤·무추가 API(`12·23·24` 시안 F 기준) |
| `AC-MYCUPS-04·05·06·07·08·09·10·11·14·15·18·21·22` (`10-10`) | 13 | **대체됨** → `AC-QUICKBREW-31·35~37` | BM1·BW1 `내 잔` 헤더·알약 필터·통계 타일·7열 테이블·모바일 2줄 행·하단 CTA가 시안 F1·F2·FW(날짜 그룹 원장·`목록`/`달력`·상단 `기록하기`·우측 달력 카드)로 교체 |
| `AC-RECIPESBREWS-76·77·86·87` + `91·93`의 `/brews` 부분 (`09-25`) | 4+2일부 | **대체됨 (개별 AC 정리)** → `AC-QUICKBREW-31·37` | `recipe-drawer-screens.md`는 `구현완료` 유지. 통계·내 잔 테이블·수율 열/2줄 행만 대체(그리드 `/recipes` 부분 유지). `AC-GRAMMAR-22`는 `/brews` `table` → FW 원장 `20 g`로 본문 갱신 |
| `AC-HOMECAL-36~39·44·47·71·102~104·110·126`, `AC-HOMEFIT-01~04` (`09-19`, `09-20`, `10-11`) | 16 | **대체됨 (M4 보류)** | 팔로우 레일·남의 달력 UI. `quick-brew` Non-goals(M4 친구 피드로 이동). `FollowRail.test.tsx`, `DayList.test.tsx`, `page.test.tsx`, e2e |
| `AC-HOMECAL-27~31·33·48~52·55~62·78~84·127·128`, `AC-HOMEFIT-05·08·09·13·18·19·22·23` (`09-19`, `09-20`, `10-11`) | 36 | **대체됨** → `AC-QUICKBREW-20~22·29·31·65` | 구 `/` 달력 홈 레이아웃·네비·CTA·e2e가 시안 A(오늘)·시안 G(탭 바)·시안 F(기록 탭)로 교체 |
| `AC-HOMECAL-63~65·68~70·72·74·112~118·121~125`, `AC-HOMEFIT-07·10~12·15~17·21` (`09-19`, `09-20`, `10-11`) | 28 | **대체됨** (웹 2컬럼 홈 셀·우측 카드 `DayCard`) | 구 홈 웹 2컬럼(셀 내 레시피명 + 우측 420px `DayCard` 패널)이 시안 A(오늘) + FW(원장 + 300px/720px 점 달력 카드)로 교체 (`Calendar variant="web"` 및 `Calendar.test.tsx` 잔존 `63·118·121` 제거) |

> **관련 스펙 비고 (2026-11-15):** [`2026-09-20-calendar-grid-responsive.md`](2026-09-20-calendar-grid-responsive.md)(`AC-HOMECAL-85~91`)는
> 구 `/` 웹 2컬럼 풀높이 달력(`fillHeight`) 전용 요구사항으로 테스트가 `home-calendar-web.spec.ts`에만 존재했다.
> Task 10에서 `/`를 「오늘」로 전환해 `home-calendar-web.spec.ts`를 제거하면서, `/brews` 웹 사이드바(시안 FW, 300px)는
> 뷰포트 높이 채움 그리드를 쓰지 않으므로 함께 `status: 대체됨`으로 정리했다.

---

## 구현 순서

- [x] **Task 1: 마이그레이션 + 계약** — Covers: AC-QUICKBREW-06
  새 컬럼 3개 · NOT NULL 해제 7개 · 인덱스. 계약 `docs/contracts/2026-11-14-quick-brew.json` 작성.

- [x] **Task 2: 생성 요청 필수값 축소** — Covers: AC-QUICKBREW-01, 05, 40, 51, 53
  `BrewLogCreateRequest`의 `@NotNull`을 원두량·물량에만 남긴다. `brewedAt` null → `clock.instant()`. 그라인더 없는 분쇄도는 400. 추정 µm은 그라인더가 있을 때만.

  ```java
  if (request.actualGrindSettingValue() != null && request.userGrinderId() == null) {
    throw new BusinessException(ErrorCode.INVALID_REQUEST, "분쇄도는 그라인더와 함께 보내야 합니다");
  }
  Instant brewedAt = request.brewedAt() != null ? request.brewedAt() : clock.instant();
  ```

- [x] **Task 3: 원두 필드 3개** — Covers: AC-QUICKBREW-02, 03, 04, 41, 42, 50, 52
  `beanProductId`·`beanName`(trim, 공백 → null, ≤100)·`roastedAt`. 경과일은 `roasted_at` → 배치 순서로 고른다.

- [x] **Task 4: 조회·수정 응답** — Covers: AC-QUICKBREW-07, 08
  `BrewLogResponse`·`BrewLogSummaryResponse`에 세 필드. `BrewLogPatchRequest`로 선택값 비우기.

- [x] **Task 5: 탭 바 · 웹 상단 바** — Covers: AC-QUICKBREW-29
  `BottomNav` TABS를 `오늘 · 기록 · 레시피 · 더보기`로, 웹 상단 바에 「기록하기」. 기존 「내 잔」 문구 검사 테스트를 함께 고친다.

- [x] **Task 6: 모션 토큰** — Covers: AC-QUICKBREW-60, 61, 62, 63, 64
  `globals.css`에 `--scrim`, 시트·패널 `240ms/200ms cubic-bezier(0.2, 0.8, 0.2, 1)`, 누름 `80ms/120ms`. #196의 `useExitPresence`·`sheet-slide-*`를 값만 바꿔 재사용한다.

- [x] **Task 7: 빠른 기록 시트 ① 원두·양** — Covers: AC-QUICKBREW-23, 24, 43
  `features/brewlog/components/QuickBrewSheet.tsx`. 「지난번」은 `GET /brew-logs?userId={me}&size=1`. 숫자는 `NumberCell`(`inputmode="decimal"`).

- [x] **Task 8: 원두 고르기 시트** — Covers: AC-QUICKBREW-26, 27
  최근 원두 = 내 기록 목록에서 `beanProductId`/`beanName`을 중복 없이. 검색은 `GET /bean-products`를 프론트에서 이름·로스터로 거른다.

- [x] **Task 9: ② 맛 · 자세히 · ③ 완료** — Covers: AC-QUICKBREW-25, 28, 30, 44, 54, 66
  별 반 개, 「자세히」(온도·시간·장비·분쇄도·맛 5축·TDS·공개 범위·로스팅 날짜·레시피 연결), 저장 중 400ms 규칙, 실패 유지, 닫기 확인.
  > **구현 메모 (2026-11-14):** 「자세히」에는 온도·그라인더·분쇄도·로스팅 날짜·공개 범위만 넣었다. 맛 5축·TDS·총 시간·레시피 연결은 저장 후 「수정」(기존 편집 화면)으로 채울 수 있어 Task 13에서 함께 다룬다. 별은 하나당 44×44 버튼 하나이고, 누른 위치가 왼쪽 절반이면 0.5다(누르는 영역 잠금 때문에 반쪽 버튼 둘로 나누지 않았다).

- [x] **Task 10: 오늘 홈** — Covers: AC-QUICKBREW-20, 21, 22, 65
  `app/page.tsx`를 시안 A로. `weekSummary`(월요일 시작, KST)는 순수 함수 + `/brew-logs/calendar` 두 달. 「관찰」은 기존 홈 관찰 문장 재사용. 기존 달력 홈 테스트(`app/page.test.tsx`, `home-calendar*.spec.ts`, `home-fidelity.spec.ts`) 정리(별도 `2026-09-20-calendar-grid-responsive.md` 포함 확인).

- [x] **Task 11: 웹 패널** — Covers: AC-QUICKBREW-67, 68
  같은 `QuickBrewSheet`를 1024px 이상에서 오른쪽 패널로. Esc · 바깥 클릭 · Enter. 모바일 끌어 닫기 30%.

- [x] **Task 12: 「기록」 탭** — Covers: AC-QUICKBREW-31, 35, 36, 37 (승계 부품 AC 30건 `AC-HOMECAL-25~109` 재사용 + 승계 `AC-MYCUPS-01·02·03·12·13·16·17·19·20·23·24`)
  `/brews`를 시안 F(F1·F2·FW·H)로. 목록/달력 세그먼트, 모드별 스크롤 유지, 웹 300px(1024px~ 280px) 우측 달력 카드(‹ › 월 이동, 날짜 클릭 시 로드분 내 스크롤 / 미로드 시 달력 모드 전환), 웹 「달력」 모드 720px 카드+`DayList`, 760–1023px 이번 주 한 줄 접힘(탭 시 펼침), `MonthNav`·`DayList` 헤더 한국어 일괄 교체(`AC-HOMECAL-40~42`), `Calendar variant="web"` 및 `63·118·121` 제거.

- [ ] **Task 13: 기록 상세 · 편집** — Covers: AC-QUICKBREW-32, 33, 34
  C1/C2 분기, 「다시 내리기」 → 빠른 기록 ①, 편집 화면이 선택값 null을 견딘다. DECISIONS 4절 「스냅샷 항상 채움」 문구 갱신.

---

## 수동 확인

- [ ] ★ 두 사람 폰(PWA 설치본)에서 지난번과 다르게 원두량을 바꿔 저장 — **30초 안**
- [ ] ★ iOS·Android에서 숫자 칸에 OS 숫자 키패드(소수점 포함)가 뜬다
- [ ] 다크 모드에서 시트 스크림과 완료 화면이 시안 A5 · B14와 같은 인상
- [ ] 시안 A · B · C · F와 나란히 대조(390 · 1440, 라이트·다크) — 비차단, 격차는 갈래 B 이슈로

## 열어둔 결정

- **마이그레이션 번호** — `V19`(2026-11-14 확인: `origin/main`의 마지막은 `V18__create_crawl_runs.sql`). Task 1 시작 시 다시 확인한다.
- **경과일의 날짜 기준(UTC vs KST)** — 기존 `computeDaysOffRoast`는 `brewedAt`의 **UTC 날짜**로 센다(`2026-08-17-brew-log.md`). KST 00:00~08:59에 내린 기록은 하루 적게 나온다. 이 스펙은 기존 규칙을 따르고(구현 중 정정, AC-04·42 예시를 UTC·KST 날짜가 같은 시각으로 바꿈), KST로 바꿀지는 도메인 숫자 변경이라 별도 이슈로 판단한다.
- **수정에서 값 지우기** — 기존 PATCH는 null을 「변경 없음」으로 본다(AC-08). 잘못 고른 그라인더·원두를 비워야 하는 불편이 P1 실사용에서 나오면 JSON Merge Patch 방식으로 별도 스펙.
- **카탈로그 검색 성능** — `GET /bean-products` 전체를 프론트가 거른다. 카탈로그가 1,000건을 넘으면 서버 검색(`?q=`)을 별도 스펙으로.
- **기존 「원두 봉투」 화면** — 새 기록이 봉투를 쓰지 않게 된 뒤 남길지 숨길지는 P1 1주 실사용 뒤 불편 목록에서 정한다.

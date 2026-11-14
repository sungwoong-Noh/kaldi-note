---
id: QUICKBREW
title: 빠른 기록 — 오늘 홈 · 빠른 기록 시트 · 기록 탭
status: 구현중
milestone: P1
supersedes:
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

- **Given** 오늘 2026-11-14(토) KST. 기록 날짜 11.09(일), 11.10(월) 각 1건
- **When** `/`
- **Then** 「이번 주」 카드가 없다(이번 주 = 11.10~11.16에 1잔). 11.12(목) 1건을 더하면 카드가 보이고 숫자는 `2`, 「지난주 1잔」
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

- **Given** 레시피 없는 기록 / `recipeId`가 있는 기록
- **When** `/brews/{id}`
- **Then** 앞은 부제 「레시피 없이 기록」, 비교표 없음. 뒤는 「항목 · 레시피 · 실제」 비교표(기존). 대표 수치는 TDS가 있으면 수율, 없으면 별점(기존 우선순위)
- **검증** 페이지 테스트

#### AC-QUICKBREW-33 · 「다시 내리기」는 그 값으로 ①을 연다

- **Given** 기록 상세(원두량 15 · 물량 240)
- **When** 「다시 내리기」
- **Then** 빠른 기록 ①이 열리고 원두량 15 · 물량 240이 보인다
- **검증** 컴포넌트 테스트

#### AC-QUICKBREW-34 · 선택값이 빈 기록도 편집 화면이 열린다

- **Given** AC-01로 만든 기록
- **When** `/brews/{id}/edit`
- **Then** 오류 없이 열리고 원두량 16 · 물량 250이 채워져 있다. 그대로 저장하면 `PATCH`가 200
- **검증** 페이지 테스트

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

- [ ] **Task 5: 탭 바 · 웹 상단 바** — Covers: AC-QUICKBREW-29
  `BottomNav` TABS를 `오늘 · 기록 · 레시피 · 더보기`로, 웹 상단 바에 「기록하기」. 기존 「내 잔」 문구 검사 테스트를 함께 고친다.

- [ ] **Task 6: 모션 토큰** — Covers: AC-QUICKBREW-60, 61, 62, 63, 64
  `globals.css`에 `--scrim`, 시트·패널 `240ms/200ms cubic-bezier(0.2, 0.8, 0.2, 1)`, 누름 `80ms/120ms`. #196의 `useExitPresence`·`sheet-slide-*`를 값만 바꿔 재사용한다.

- [ ] **Task 7: 빠른 기록 시트 ① 원두·양** — Covers: AC-QUICKBREW-23, 24, 43
  `features/brewlog/components/QuickBrewSheet.tsx`. 「지난번」은 `GET /brew-logs?userId={me}&size=1`. 숫자는 `NumberCell`(`inputmode="decimal"`).

- [ ] **Task 8: 원두 고르기 시트** — Covers: AC-QUICKBREW-26, 27
  최근 원두 = 내 기록 목록에서 `beanProductId`/`beanName`을 중복 없이. 검색은 `GET /bean-products`를 프론트에서 이름·로스터로 거른다.

- [ ] **Task 9: ② 맛 · 자세히 · ③ 완료** — Covers: AC-QUICKBREW-25, 28, 30, 44, 54, 66
  별 반 개, 「자세히」(온도·시간·장비·분쇄도·맛 5축·TDS·공개 범위·로스팅 날짜·레시피 연결), 저장 중 400ms 규칙, 실패 유지, 닫기 확인.

- [ ] **Task 10: 오늘 홈** — Covers: AC-QUICKBREW-20, 21, 22, 65
  `app/page.tsx`를 시안 A로. `weekSummary`(월요일 시작, KST)는 순수 함수 + `/brew-logs/calendar` 두 달. 「관찰」은 기존 홈 관찰 문장 재사용.

- [ ] **Task 11: 웹 패널** — Covers: AC-QUICKBREW-67, 68
  같은 `QuickBrewSheet`를 1024px 이상에서 오른쪽 패널로. Esc · 바깥 클릭 · Enter. 모바일 끌어 닫기 30%.

- [ ] **Task 12: 「기록」 탭** — Covers: AC-QUICKBREW-31
  `/brews`를 시안 F로. 목록/달력 세그먼트, 모드별 스크롤 유지, 웹은 오른쪽 300px 달력 카드.

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

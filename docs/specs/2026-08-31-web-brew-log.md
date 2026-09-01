---
id: WEBBREW
title: 브루잉 로그 화면 — 기록하고 다시 보기 (선행 데이터 등록 포함)
status: 초안
plan: docs/plans/2026-08-31-plan-web-brew-log.md
---

# 브루잉 로그 화면 스펙

> 2026-08-31 `/interview`로 확정. 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md).
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

**사용자가 레시피로 실제 커피를 내린 뒤 그 기록을 남기고, 나중에 다시 본다.** 레시피 상세의 "이 레시피로 내렸다"에서 시작해 실측값·평가를 적어 저장하고, 목록과 상세에서 되돌아본다. 홈은 최근 기록을 보여주는 자리가 된다.

**선행 데이터 등록 화면을 함께 만든다.** `POST /api/v1/brew-logs`는 `recipeId`·`beanBatchId`·`userGrinderId`를 **셋 다 필수**로 받는데(브루로그 스펙이 즉흥 추출을 의도적으로 닫았다), 지금 화면으로 만들 수 있는 것은 레시피뿐이다. **내 그라인더와 원두 재고를 등록할 수단이 없으면 이 화면은 아무도 쓸 수 없다.**

**백엔드는 손대지 않는다.** 필요한 엔드포인트가 전부 있다 — `POST/GET /roasters`, `POST/GET /bean-products`, `POST/GET /bean-batches`, `POST/GET /gear/user-grinders`, `POST/GET/DELETE /brew-logs`.

### 범위 밖 (Non-goals)

1. **로그 수정(`PATCH /brew-logs/{id}`).** 부분 갱신은 "어떤 필드를 보내고 어떤 걸 생략하는가"를 필드마다 정해야 해서 분량이 이 슬라이스의 절반만큼 더 붙는다. 삭제는 넣는다 — 잘못 남긴 기록을 지울 수단이 없으면 목록이 오염된 채로 남는다.
2. **SCA Brewing Control Chart.** 추출 분석은 숫자와 구간 이름으로만 보여준다. 리프랙토미터가 없어 TDS 입력 자체가 드물고, 데이터가 없는 차트는 자리만 차지한다.
3. **5축 평가를 항상 펼쳐 두는 것.** 접어두고, 펼치지 않으면 그 다섯 값을 요청에 담지 않는다.
4. **임시저장.** 쓰기 슬라이스의 결정을 유지한다. 대신 선행 데이터 등록을 **모달**로 띄워 페이지를 떠나지 않게 한다.
5. **`brew_log_steps`(스텝별 실제 푸어 기록)와 추출 타이머.** 백엔드에도 없다.
6. **사진 첨부.** `POST /attachments/upload-url`이 있으나 이 화면에서 부르지 않는다.
7. **원두 재고 자동 차감.** 로그를 남겨도 `remainingG`를 줄이지 않는다 — 백엔드가 이미 그렇게 정했다.
8. **즉흥 추출(레시피 없는 기록).** `recipeId`는 계속 필수다.
9. **원두 재고 목록·수정·삭제 화면.** 이번에는 **등록**과 **로그 작성 시 선택**만 다룬다.
10. **로그의 공개 범위.** 백엔드가 `PRIVATE`으로 고정하므로 요청에 담지 않는다.
11. **블렌드 원두 등록(`BLEND`).** 서버가 `origins` 2개 이상을 요구해 입력칸이 가변 개수가 된다. 이번에는 `SINGLE_ORIGIN`만 만들고, 블렌드는 원두 재고 화면을 제대로 만들 때 연다. (2026-08-31 구현 세션에서 결정 — 아래 「원두 등록 모달」 참조)

## 왜

**레시피만 있고 실행 기록이 없다.** 이 서비스의 존재 이유는 "같은 레시피를 여러 번 내렸을 때 결과 차이를 추적하는 것"인데(「뒤집으면 안 되는 결정」 1번), 지금은 설계도만 그릴 수 있고 무엇이 나왔는지 남길 수단이 없다.

**홈이 비어 있다.** `app/page.tsx`는 6줄짜리 빈 페이지다. `frontend/CLAUDE.md`의 구조도는 홈을 "최근 브루잉 로그"로 적어놨는데 그 자리가 계속 비어 있었다.

**선행 데이터를 함께 만드는 이유**는 로그 하나를 남기는 데 로스터 → 원두 제품 → 원두 재고 → 내 그라인더가 전부 필요하기 때문이다. 시드에는 품종·가공법·향미노트만 있고 **로스터와 제품은 비어 있다.** 로그 화면만 만들면 첫 화면에서 고를 것이 하나도 없다.

## 용어

| 용어 | 정의 |
|---|---|
| 선행 데이터 | 로그를 남기기 전에 존재해야 하는 것 — 내 그라인더(`user_grinders`)와 원두 재고(`bean_batches`) |
| 3단 생성 | 원두 재고 등록 한 번에 로스터 → 제품 → 재고를 차례로 만드는 것. 요청이 최대 3번 나간다 |
| 실측값 | 이번에 실제로 쓴 값(`actualDoseG` 등). 레시피 값에서 미리 채우지만 저장되는 순간 로그의 스냅샷이 된다 |
| 추출 분석 | 서버가 조회 시점에 계산해 주는 `extractionYieldPercent`·`strengthZone`·`extractionZone`·`diagnosis` |
| 로스팅 후 경과일 | 재고 응답의 `daysOffRoast`. 서버가 계산해 준다 |

## 화면

| 경로 | 인증 | 하는 일 |
|---|---|---|
| `/brews/new?recipeId=<id>` | 필요 | 실측값·평가를 적어 로그를 만든다. 선행 데이터가 없으면 모달로 등록한다 |
| `/brews` | 필요 | 내 로그를 최신순으로 훑는다. "더 보기"로 이어붙인다 |
| `/brews/[id]` | 필요 | 실측값·추출 분석·평가를 보고, 삭제한다 |
| `/` (변경) | 필요 | 최근 로그 **3개**와 "전체 보기" 링크 |
| `/recipes/[id]` (변경) | 필요 | "이 레시피로 내렸다"가 붙는다 |

## 폼의 라벨과 값

**테스트는 이 문자열로 찾는다.** 문구를 바꾸면 인수 조건이 깨진다.

### 로그 작성

| 라벨 | 필드 | 필수 | 초기값 |
|---|---|---|---|
| 내린 시각 | `brewedAt` | O | 화면이 열린 시각 |
| 원두 | `beanBatchId` | O | 없음(선택) |
| 그라인더 | `userGrinderId` | O | 레시피와 같은 모델이 있으면 자동 |
| 분쇄도 값 | `actualGrindSettingValue` | O | 레시피의 `grindSettingValue` |
| 원두량 | `actualDoseG` | O | 레시피의 `doseG` |
| 물량 | `actualWaterG` | O | 레시피의 `waterG` |
| 물 온도 | `actualWaterTempC` | O | 레시피의 `waterTempC` |
| 추출 시간 | `actualTotalTimeSeconds` | X | **빈칸** |
| 드로다운 시간 | `actualDrawdownSeconds` | X | 빈칸 |
| 음료 중량 | `beverageWeightG` | X | 빈칸 |
| TDS | `tdsPercent` | X | 빈칸 |
| 별점 | `rating` | X | 없음 |
| 메모 | `overallNote` | X | 빈칸 |
| 산미 · 단맛 · 바디 · 쓴맛 · 여운 | `acidity`·`sweetness`·`body`·`bitterness`·`aftertaste` | X | 접혀 있음 |

- **별점은 별 5개를 탭해 정수만 넣는다.** 읽기 화면은 `4.5` 같은 값도 그대로 표시한다. 백엔드는 `0.5` 단위를 계속 허용하므로, 나중에 반개 입력을 열려면 화면만 고치면 된다.
- **5축은 `맛 자세히` 버튼으로 펼친다.** 펼치지 않으면 그 다섯 키를 요청 본문에 담지 않는다.

### 버튼·링크 접근명

| 요소 | 접근명 |
|---|---|
| 레시피 상세 → 로그 작성 | `이 레시피로 내렸다` |
| 저장 | `기록하기` |
| 5축 펼치기 | `맛 자세히` |
| 그라인더 등록 모달 열기 | `+ 그라인더 등록` |
| 원두 등록 모달 열기 | `+ 원두 등록` |
| 모달의 등록 확정 | `등록` |
| 모달의 취소 | `취소` |
| 로그 삭제 | `삭제` |
| 삭제 확인 | `삭제합니다` |
| 홈 → 목록 | `전체 보기` |
| 목록의 다음 페이지 | `더 보기` |

### 원두 등록 모달 (3단 생성)

| 라벨 | 대상 | 필수 |
|---|---|---|
| 로스터 | 기존 선택 또는 `로스터 이름` 입력 | O |
| 제품 | 기존 선택 또는 `제품 이름`·`배전도`·`원산지 국가` | O |
| 중량 | `weightG` | O |
| 로스팅일 | `roastedAt` | O |

`배전도`는 `RoastLevel`(`LIGHT`·`MEDIUM_LIGHT`·`MEDIUM`·`MEDIUM_DARK`)을 그대로 쓴다.

**`origins`는 서버가 반드시 요구한다.** 2026-08-31 구현 세션에서 실제 백엔드로 확인했다 — `BeanCatalogService.buildOrigins()`가 `SINGLE_ORIGIN`이면 정확히 1개, `BLEND`면 2개 이상을 요구하고, 키를 빼거나 빈 배열을 보내면 `400 BEAN_MIX_ORIGIN_MISMATCH`가 난다. 스펙 작성 시점의 "서버가 생략을 허용한다"는 전제는 틀렸다.

그래서 모달은 **`원산지 국가` 한 칸을 필수로 받고** `beanMix`는 `SINGLE_ORIGIN`으로 고정해 보낸다(구성 선택란을 두지 않는다). 요청 본문은 `{ roasterId, name, beanMix: "SINGLE_ORIGIN", roastLevel, origins: [{ country }] }`다. `varietyId`·`processId`는 선택이라 담지 않는다.

## 요청 흐름

### 3단 생성

```
로스터를 새로 만들 때:  POST /roasters → POST /bean-products → POST /bean-batches
기존 로스터를 고를 때:              POST /bean-products → POST /bean-batches
기존 제품을 고를 때:                                     POST /bean-batches
```

**중간에 실패하면 이미 만들어진 것을 선택 상태로 바꾼다.** 로스터가 만들어진 뒤 제품에서 400이 나면, 로스터 입력란이 "새로 만들기"에서 "방금 만든 로스터가 선택된 상태"로 바뀐다. 사용자가 제품 이름을 고쳐 다시 누르면 **로스터 POST는 다시 나가지 않는다.** 로스터·제품에는 삭제 API가 없어 되돌릴 수 없으므로, 중복을 만들지 않는 것이 유일한 방어다.

### 그라인더 자동 선택

레시피의 `grinderModelId`와 같은 `grinderModelId`를 가진 내 그라인더가 있으면 그것을 고르고, `actualGrindSettingValue`에 레시피의 `grindSettingValue`를 넣는다. **같은 모델을 둘 이상 등록했으면 `id`가 작은 것**(먼저 등록한 것)을 고른다. 없으면 빈 상태로 둔다.

## 검증은 서버가 한다

쓰기 슬라이스와 같은 원칙이다. 화면은 값을 보내고, 거부는 서버가 한다.

| 화면이 하는 일 | 화면이 하지 않는 일 |
|---|---|
| 서버의 `message`와 `fieldErrors`를 각 입력칸에 붙인다(`lib/fieldErrors.ts` 재사용) | 범위 검증을 다시 구현하지 않는다 |
| 필수값이 비면 브라우저 기본 검증에 맡긴다 | 값의 상·하한을 화면에서 판정하지 않는다 |

`code`별 처리는 첫 슬라이스(`docs/specs/2026-08-21-web-recipe-read.md`「에러 처리」)를 따른다. **`message` 문자열로 분기하지 않는다.**

## 추출 분석 표시

**음료 중량과 TDS가 둘 다 있을 때만** 상세에 이 영역이 나온다. 서버가 `extractionYieldPercent`·`strengthZone`·`extractionZone`·`diagnosis`를 주고, 없으면 `non_null` 정책에 따라 키 자체가 없다.

| 값 | 표시 |
|---|---|
| `extractionYieldPercent` | `20.5 %` |
| `strengthZone` · `extractionZone` | 서버 값 그대로(`IDEAL` 등) |
| `diagnosis` | 서버 문구 그대로 |

**TDS 없이도 화면이 온전해야 한다**(「뒤집으면 안 되는 결정」 4번). 분석 영역이 없다고 해서 다른 것이 깨지지 않는다.

---

## 어떻게 동작 — 인수 조건

> Vitest + Testing Library + MSW로 검증한다. 백엔드를 실제로 호출하지 않는다.
> 조회는 `getByRole`·`getByLabelText`로 한다. `getByTestId`는 최후 수단이다.
> **픽스처는 실행 중인 백엔드 응답에서 뜬다**(`src/test/fixtures.ts`).

### 내 그라인더 등록

#### AC-WEBBREW-01 · 등록된 그라인더가 없으면 그 사실을 알린다

- **Given** `GET /api/v1/gear/user-grinders`가 `[]`를 반환한다
- **When** `/brews/new?recipeId=1`을 연다
- **Then** `등록된 그라인더가 없습니다`가 보이고 이름이 `+ 그라인더 등록`인 버튼이 있다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-02 · 모델을 골라 등록하면 그 본문으로 요청한다

- **Given** `GET /gear/grinders`가 id `1`인 C40을 반환하고 그라인더 등록 모달이 열려 있다
- **When** 모델로 C40을 고르고 `별명`에 `집`을 넣고 `등록`을 누른다
- **Then** `POST /api/v1/gear/user-grinders` 본문이 `{ "grinderModelId": 1, "nickname": "집" }`이다
- **검증** 컴포넌트 테스트 `UserGrinderDialog.test.tsx`

#### AC-WEBBREW-03 · 등록에 성공하면 그 그라인더가 선택된 상태가 된다

- **Given** 등록 요청이 `{ id: 5, grinderModelId: 1, nickname: "집" }`을 반환한다
- **When** 모달이 닫힌다
- **Then** `그라인더` 선택란의 값이 `5`다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-04 · 별명 없이도 등록된다

- **Given** 그라인더 등록 모달이 열려 있고 모델만 골랐다
- **When** `별명`을 비운 채 `등록`을 누른다
- **Then** 요청 본문에 `nickname` 키가 없다
- **검증** 컴포넌트 테스트 `UserGrinderDialog.test.tsx`

### 원두 재고 등록 — 3단 생성

#### AC-WEBBREW-05 · 전부 새로 만들면 요청이 세 번 순서대로 나간다

- **Given** 원두 등록 모달에서 로스터·제품을 모두 "새로 만들기"로 골랐다
- **When** 로스터 이름 `프릿츠`, 제품 이름 `예가체프`, 배전도 `LIGHT`, 원산지 국가 `에티오피아`, 중량 `200`, 로스팅일 `2026-08-28`로 `등록`을 누른다
- **Then** 호출 순서가 `POST /roasters` → `POST /bean-products` → `POST /bean-batches`이고, `POST /bean-products` 본문이 `{ "roasterId": <생성된 로스터 id>, "name": "예가체프", "beanMix": "SINGLE_ORIGIN", "roastLevel": "LIGHT", "origins": [{ "country": "에티오피아" }] }`, 마지막 본문이 `{ "beanProductId": <생성된 제품 id>, "weightG": 200, "roastedAt": "2026-08-28" }`이다
- **검증** 컴포넌트 테스트 `BeanBatchDialog.test.tsx`

#### AC-WEBBREW-06 · 기존 로스터를 고르면 로스터 요청은 나가지 않는다

- **Given** `GET /roasters`가 id `3`인 `프릿츠`를 반환한다
- **When** 로스터로 `프릿츠`를 고르고 제품만 새로 만들어 `등록`을 누른다
- **Then** `POST /roasters`가 한 번도 호출되지 않고, `POST /bean-products` 본문의 `roasterId`가 `3`이다
- **검증** 컴포넌트 테스트 `BeanBatchDialog.test.tsx`

#### AC-WEBBREW-07 · 제품에서 실패하면 로스터는 선택 상태로 남고 다시 만들지 않는다

- **Given** `POST /roasters`는 `{ id: 3 }`으로 성공하고 `POST /bean-products`는 `400`과 `{ code: "INVALID_REQUEST", message: "입력값이 올바르지 않습니다.", fieldErrors: [{ field: "name", message: "100자 이하여야 합니다" }] }`를 반환한다
- **When** `등록`을 누른 뒤, 제품 이름을 고쳐 다시 `등록`을 누른다
- **Then** `POST /roasters`는 **총 1회만** 호출되고, 두 번째 `POST /bean-products` 본문의 `roasterId`가 `3`이다
- **검증** 컴포넌트 테스트 `BeanBatchDialog.test.tsx`

#### AC-WEBBREW-08 · 실패한 필드의 오류가 그 입력칸에 붙는다

- **Given** AC-WEBBREW-07과 같은 응답이다
- **When** `등록`을 누른다
- **Then** `제품 이름` 입력칸의 `aria-describedby`가 가리키는 요소에 `100자 이하여야 합니다`가 있다
- **검증** 컴포넌트 테스트 `BeanBatchDialog.test.tsx`

#### AC-WEBBREW-09 · 등록에 성공하면 그 재고가 선택된 상태가 된다

- **Given** `POST /bean-batches`가 `{ id: 9, beanProductId: 4, weightG: 200.0, roastedAt: "2026-08-28", daysOffRoast: 3, degassingStatus: "IDEAL" }`을 반환한다
- **When** 모달이 닫힌다
- **Then** `원두` 선택란의 값이 `9`다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-10 · 원두 선택란은 로스터·제품·경과일을 함께 보여준다

- **Given** `GET /bean-batches`가 `{ id: 9, beanProductId: 4, daysOffRoast: 3, ... }`을, `GET /bean-products`가 `{ id: 4, roasterId: 3, name: "예가체프" }`를, `GET /roasters`가 `{ id: 3, name: "프릿츠" }`를 반환한다
- **When** `/brews/new?recipeId=1`을 연다
- **Then** `원두` 선택란에 `프릿츠 예가체프 · 3일차`라는 선택지가 있다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

### 로그 작성 — 초기값

#### AC-WEBBREW-11 · 레시피의 원두량·물량·물온도가 미리 채워진다

- **Given** `GET /recipes/1`이 `doseG=20.0`, `waterG=300.0`, `waterTempC=92.0`을 반환한다
- **When** `/brews/new?recipeId=1`을 연다
- **Then** `원두량`이 `20`, `물량`이 `300`, `물 온도`가 `92`다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-12 · 추출 시간은 빈칸으로 시작한다

- **Given** 레시피의 `totalTimeSeconds`가 `210`이다
- **When** `/brews/new?recipeId=1`을 연다
- **Then** `추출 시간` 입력칸이 비어 있다 (계획 시간을 실측인 양 저장하지 않는다)
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-13 · 내린 시각의 기본값은 화면이 열린 시각이다

- **Given** 시스템 시각이 `2026-08-31T09:00:00Z`로 고정돼 있다
- **When** `/brews/new?recipeId=1`을 연다
- **Then** `내린 시각` 입력칸의 값이 `2026-08-31T09:00`이다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-14 · 레시피와 같은 모델의 그라인더가 자동 선택된다

- **Given** 레시피의 `grinderModelId`가 `1`이고, 내 그라인더가 `[{ id: 5, grinderModelId: 1 }, { id: 6, grinderModelId: 2 }]`다
- **When** `/brews/new?recipeId=1`을 연다
- **Then** `그라인더` 선택란의 값이 `5`다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-15 · 같은 모델이 없으면 비어 있다

- **Given** 레시피의 `grinderModelId`가 `1`이고, 내 그라인더가 `[{ id: 6, grinderModelId: 2 }]`뿐이다
- **When** `/brews/new?recipeId=1`을 연다
- **Then** `그라인더` 선택란의 값이 빈 문자열이다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-16 · 같은 모델이 둘이면 먼저 등록한 것을 고른다

- **Given** 내 그라인더가 `[{ id: 8, grinderModelId: 1 }, { id: 5, grinderModelId: 1 }]` 순서로 온다
- **When** `/brews/new?recipeId=1`을 연다
- **Then** `그라인더` 선택란의 값이 `5`다 (`id`가 작은 쪽)
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-17 · 레시피의 분쇄도 설정값이 복사된다

- **Given** 레시피의 `grindSettingValue`가 `22.0`이고 같은 모델의 그라인더가 있다
- **When** `/brews/new?recipeId=1`을 연다
- **Then** `분쇄도 값`이 `22`다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

### 로그 작성 — 저장

#### AC-WEBBREW-18 · 필수값만 채워 저장하면 그 본문으로 요청한다

- **Given** 초기값이 채워져 있고 원두 `9`, 그라인더 `5`가 선택돼 있다
- **When** `기록하기`를 누른다
- **Then** `POST /api/v1/brew-logs` 본문이 `{ "recipeId": 1, "beanBatchId": 9, "brewedAt": "2026-08-31T09:00:00.000Z", "actualDoseG": 20, "actualWaterG": 300, "actualWaterTempC": 92, "userGrinderId": 5, "actualGrindSettingValue": 22 }`이고 `visibility` 키가 없다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-19 · 저장하는 동안 버튼이 잠긴다

- **Given** `POST /brew-logs` 응답이 지연된다
- **When** `기록하기`를 누르고 한 번 더 누른다
- **Then** 그 사이 버튼이 `disabled`이고 요청이 한 번만 나간다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-20 · 성공하면 그 로그의 상세로 간다

- **Given** `POST /brew-logs`가 `201`과 `{ id: 42, ... }`를 반환한다
- **When** `기록하기`를 누른다
- **Then** `/brews/42`로 이동한다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-21 · 빈칸인 선택 항목은 본문에서 빠진다

- **Given** `추출 시간`·`TDS`·`메모`를 비운 채로 둔다
- **When** `기록하기`를 누른다
- **Then** 본문에 `actualTotalTimeSeconds`·`tdsPercent`·`overallNote` 키가 없다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-22 · 미래 시각이면 서버 문구가 보이고 화면이 유지된다

- **Given** `POST /brew-logs`가 `400`과 `{ code: "INVALID_REQUEST", message: "입력값이 올바르지 않습니다.", fieldErrors: [{ field: "brewedAt", message: "과거 또는 현재여야 합니다" }] }`를 반환한다
- **When** `기록하기`를 누른다
- **Then** 경로가 `/brews/new` 그대로이고 `내린 시각` 입력칸의 `aria-describedby`가 가리키는 요소에 `과거 또는 현재여야 합니다`가 있으며 `기록하기`가 다시 `disabled`가 아니다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

### 빈 상태와 모달

#### AC-WEBBREW-23 · 원두가 없으면 등록 버튼이 보인다

- **Given** `GET /bean-batches`가 빈 페이지를 반환한다
- **When** `/brews/new?recipeId=1`을 연다
- **Then** `등록된 원두가 없습니다`가 보이고 이름이 `+ 원두 등록`인 버튼이 있다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-24 · 그라인더를 모달에서 등록해도 작성 중인 값이 남는다

- **Given** `원두량`을 `21`로 고친 상태다
- **When** `+ 그라인더 등록`으로 모달을 열어 등록을 마친다
- **Then** `원두량`이 여전히 `21`이다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-25 · 원두를 모달에서 등록해도 작성 중인 값이 남는다

- **Given** `메모`에 `단맛이 좋았다`를 적은 상태다
- **When** `+ 원두 등록`으로 모달을 열어 3단 생성을 마친다
- **Then** `메모`가 여전히 `단맛이 좋았다`다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-26 · 모달을 취소하면 아무 요청도 나가지 않는다

- **Given** 원두 등록 모달에서 로스터 이름까지 입력했다
- **When** `취소`를 누른다
- **Then** `POST /roasters`·`POST /bean-products`·`POST /bean-batches`가 한 번도 호출되지 않고 모달이 닫힌다
- **검증** 컴포넌트 테스트 `BeanBatchDialog.test.tsx`

### 평가

#### AC-WEBBREW-27 · 별 네 번째를 누르면 별점이 4가 된다

- **Given** `/brews/new?recipeId=1`이 열려 있다
- **When** 이름이 `별점 4`인 버튼을 누르고 `기록하기`를 누른다
- **Then** 본문의 `rating`이 `4`다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-28 · 5축은 접혀 있다

- **When** `/brews/new?recipeId=1`을 연다
- **Then** `산미` 입력이 화면에 없고 이름이 `맛 자세히`인 버튼이 있다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-29 · 펼치지 않으면 5축 키를 보내지 않는다

- **Given** `맛 자세히`를 누르지 않았다
- **When** `기록하기`를 누른다
- **Then** 본문에 `acidity`·`sweetness`·`body`·`bitterness`·`aftertaste` 키가 하나도 없다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-30 · 펼쳐서 고른 값이 본문에 담긴다

- **Given** `맛 자세히`를 눌러 펼쳤다
- **When** `산미`를 `3`으로 고르고 `기록하기`를 누른다
- **Then** 본문의 `acidity`가 `3`이고, 고르지 않은 `body` 키는 없다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

#### AC-WEBBREW-31 · 메모 길이 초과는 서버 문구로 알린다

- **Given** `POST /brew-logs`가 `400`과 `fieldErrors: [{ field: "overallNote", message: "1000자 이하여야 합니다" }]`를 반환한다
- **When** `기록하기`를 누른다
- **Then** `메모` 입력칸의 `aria-describedby`가 가리키는 요소에 `1000자 이하여야 합니다`가 있다
- **검증** 페이지 테스트 `BrewNewPage.test.tsx`

### 목록

#### AC-WEBBREW-32 · 목록은 20개씩 최신순으로 부른다

- **Given** 로그인한 사용자가 `/brews`를 연다
- **When** 첫 요청이 나간다
- **Then** `GET /api/v1/brew-logs`의 쿼리가 `page=0&size=20`이다
- **검증** 페이지 테스트 `BrewsPage.test.tsx`

#### AC-WEBBREW-33 · hasNext가 true면 더 보기가 있다

- **Given** 첫 페이지 응답의 `hasNext`가 `true`다
- **When** `/brews`를 연다
- **Then** 이름이 `더 보기`인 버튼이 있다
- **검증** 페이지 테스트 `BrewsPage.test.tsx`

#### AC-WEBBREW-34 · 기록이 없으면 안내가 보인다

- **Given** 응답의 `content`가 `[]`다
- **When** `/brews`를 연다
- **Then** `아직 기록이 없습니다`가 보인다
- **검증** 페이지 테스트 `BrewsPage.test.tsx`

#### AC-WEBBREW-35 · 항목에 날짜·레시피 제목·별점이 있다

- **Given** 로그 하나의 `brewedAt`이 `2026-08-31T09:00:00Z`, `recipeId`가 `1`, `rating`이 `4.5`이고 `GET /recipes/1`이 제목 `Kasuya 4:6`을 준다
- **When** `/brews`를 연다
- **Then** 그 항목에 `2026-08-31`과 `Kasuya 4:6`과 `4.5`가 있다
- **검증** 페이지 테스트 `BrewsPage.test.tsx`

#### AC-WEBBREW-36 · EY가 없는 항목은 그 자리가 비어 있다

- **Given** 로그 응답에 `extractionYieldPercent` 키가 없다
- **When** `/brews`를 연다
- **Then** 그 항목에 `%`를 포함한 텍스트가 없다
- **검증** 페이지 테스트 `BrewsPage.test.tsx`

### 홈

#### AC-WEBBREW-37 · 홈은 최근 3개를 부른다

- **Given** 로그인한 사용자가 `/`를 연다
- **When** 첫 요청이 나간다
- **Then** `GET /api/v1/brew-logs`의 쿼리가 `page=0&size=3`이다
- **검증** 페이지 테스트 `HomePage.test.tsx`

#### AC-WEBBREW-38 · 홈에서 목록으로 갈 수 있다

- **When** `/`를 연다
- **Then** 이름이 `전체 보기`인 링크의 `href`가 `/brews`다
- **검증** 페이지 테스트 `HomePage.test.tsx`

#### AC-WEBBREW-39 · 기록이 없으면 홈이 레시피로 안내한다

- **Given** 응답의 `content`가 `[]`다
- **When** `/`를 연다
- **Then** `아직 기록이 없습니다`가 보이고 이름이 `레시피 보러 가기`인 링크의 `href`가 `/recipes`다
- **검증** 페이지 테스트 `HomePage.test.tsx`

### 상세

#### AC-WEBBREW-40 · 실측값이 서버 값 그대로 보인다

- **Given** `GET /brew-logs/42`가 `actualDoseG=20.0`, `actualWaterG=300.0`, `actualWaterTempC=92.0`을 반환한다
- **When** `/brews/42`를 연다
- **Then** `20.0g`과 `300.0g`과 `92°C`가 보인다
- **검증** 페이지 테스트 `BrewDetailPage.test.tsx`

#### AC-WEBBREW-41 · TDS가 있으면 추출 분석이 보인다

- **Given** 응답에 `tdsPercent=1.35`, `extractionYieldPercent=20.5`, `strengthZone="IDEAL"`, `extractionZone="IDEAL"`, `diagnosis="균형 있는 추출입니다"`가 있다
- **When** `/brews/42`를 연다
- **Then** `20.5 %`와 `균형 있는 추출입니다`가 보인다
- **검증** 페이지 테스트 `BrewDetailPage.test.tsx`

#### AC-WEBBREW-42 · TDS가 없으면 추출 분석 영역이 아예 없다

- **Given** 응답에 `tdsPercent`·`extractionYieldPercent` 키가 없다
- **When** `/brews/42`를 연다
- **Then** `추출 분석`이라는 제목이 화면에 없고, 나머지 실측값은 그대로 보인다
- **검증** 페이지 테스트 `BrewDetailPage.test.tsx`

#### AC-WEBBREW-43 · 어떤 레시피로 내렸는지 링크된다

- **Given** 로그의 `recipeId`가 `1`이고 `GET /recipes/1`이 제목 `Kasuya 4:6`을 준다
- **When** `/brews/42`를 연다
- **Then** 이름이 `Kasuya 4:6`인 링크의 `href`가 `/recipes/1`이다
- **검증** 페이지 테스트 `BrewDetailPage.test.tsx`

#### AC-WEBBREW-44 · 삭제를 확인하면 요청 후 목록으로 간다

- **Given** `DELETE /api/v1/brew-logs/42`가 `204`를 반환한다
- **When** `삭제`를 누르고 `삭제합니다`를 누른다
- **Then** `DELETE`가 한 번 호출되고 `/brews`로 이동한다
- **검증** 페이지 테스트 `BrewDetailPage.test.tsx`

#### AC-WEBBREW-45 · 삭제를 취소하면 아무 요청도 나가지 않는다

- **When** `삭제`를 누르고 `취소`를 누른다
- **Then** `DELETE`가 한 번도 호출되지 않고 경로가 `/brews/42` 그대로다
- **검증** 페이지 테스트 `BrewDetailPage.test.tsx`

### 레시피 상세에서의 진입

#### AC-WEBBREW-46 · 레시피 상세에서 기록을 시작할 수 있다

- **Given** `/recipes/1`이 열려 있다
- **When** 화면을 확인한다
- **Then** 이름이 `이 레시피로 내렸다`인 링크의 `href`가 `/brews/new?recipeId=1`이다
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

---

## 수동 확인

- [ ] 폰에서 레시피 상세 → 기록 → 저장까지 한 번에 해본다
- [ ] 그라인더도 원두도 없는 상태에서 시작해 모달 둘로 채우고 저장까지 간다
- [ ] 저장한 로그가 홈과 목록에 나타나는지 본다
- [ ] 운영(`kaldi-note.today`)에서 기록·조회·삭제가 동작하는지 확인한다

> **2026-09-02 로컬 확인 결과.** 로컬 실물을 375×812 브라우저로 밟았고 **앞 세 항목의 흐름은 전부 통과했다.**
>
> - 레시피 상세 → 기록 → 저장 → 로그 상세(`/brews/4`), 수율 17.6% 계산.
> - 빈 계정으로 그라인더 모달(모델+별명)과 원두 모달(로스터·제품·배전도·원산지·중량·로스팅일)을 채워 저장까지 갔다.
> - 저장한 로그가 홈의 최근 기록과 `/brews` 목록에 모두 나타났다.
>
> **위 체크박스는 그대로 둔다.** 폰 실물의 조작 감각과 운영 확인이 남았다.

## 열어둔 결정

- **원두 재고 목록·수정 화면.** 이번엔 등록과 선택만 한다. 재고가 쌓이면 "남은 양"과 "소진 처리"가 필요해지는데, 그때 원두 재고 스펙과 함께 정한다.
- **로그 수정(PATCH).** 부분 갱신 규칙을 정해야 한다. 다음 슬라이스 후보.
- **SCA 차트.** TDS 데이터가 실제로 쌓인 뒤에 판단한다.
- **로그 목록의 필터.** 백엔드에 `recipeId` 필터가 있으나 이번 화면은 쓰지 않는다. 레시피 상세에 "이 레시피의 기록" 목록을 붙일 때 함께 정한다.

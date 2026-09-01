---
id: WEBLOGEDIT
title: 브루잉 로그 편집 화면
status: 초안
plan: docs/plans/2026-09-02-plan-web-brew-log-edit.md
---

# 브루잉 로그 편집 화면 스펙

> 2026-09-02 `/interview`로 확정. 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md).
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

**저장한 브루잉 로그를 고칠 수 있게 한다.** 지금은 만들고 지우는 것만 되고, 오타 하나를 고치려면 기록을 지우고 처음부터 다시 써야 한다. `/brews/[id]/edit`를 만들어 작성 폼을 수정 모드로 재사용한다.

**공개범위를 사후에 바꿀 수 있게 한다.** 백엔드는 생성 시 `visibility`를 `PRIVATE`으로 고정하고 `PATCH`로만 바꿀 수 있는데, 그것을 부르는 화면이 없어 모든 로그가 영원히 `PRIVATE`이다. "일단 비공개로 적어두고 마음에 드는 결과만 친구에게 연다"는 흐름이 화면상 닫혀 있다.

**남의 로그에서 파괴적 버튼을 감춘다.** 로그 상세가 소유 판정을 하지 않아 남의 `PUBLIC` 로그에도 `삭제`가 보인다. 누르면 403이 난다.

> **백엔드 변경은 없다.** `PATCH /api/v1/brew-logs/{id}`는 [`2026-08-19-list-query-api.md`](2026-08-19-list-query-api.md)가 이미 규정했고(그 문서의 `BLEDIT` 계열 인수 조건 19개) 구현·테스트가 끝나 있다. 이 스펙은 그것을 부르는 화면만 다룬다.

### 범위 밖 (Non-goals)

1. **백엔드 변경.** `PATCH`도 `DELETE`도 이미 있다. 이 스펙에서 서버 코드를 건드리지 않는다.
2. **값 지우기.** 백엔드는 `null`을 언제나 "변경 없음"으로 읽는다 — `list-query-api` 스펙이 `JsonNullable` 도입을 명시적으로 배제했다(Jackson 3 패키지 재편과 얽힌다). 넣어둔 `tdsPercent`를 다시 비울 수는 없고, 화면은 그 사실을 **숨기지 않고 드러낸다**(AC-WEBLOGEDIT-12·13).
3. **레시피와 원두 바꾸기.** `recipeId`·`beanBatchId`는 `PATCH` 요청 DTO에 없어 서버가 무시한다. 다른 레시피로 내린 것이라면 그것은 다른 기록이다.
4. **동시 수정 충돌 처리.** 낙관적 잠금을 두지 않는다. 두 기기에서 같은 로그를 고치면 마지막 저장이 이긴다. 1인 사용이 전제다.
5. **목록 카드에서의 바로 편집.** 진입점은 상세 하나다. 카드가 이미 전체가 링크라 중첩 링크가 된다.
6. **작성 화면 이탈 확인 대화상자.** `취소`는 명시적 행동이라 곧바로 나간다 — 앱 셸 스펙의 결정을 따른다.

## 왜

**기록은 한 번에 완성되지 않는다.** 추출 직후에는 원두량·물량·시간만 적고, 마시면서 별점과 5축을 채우고, 리프랙토미터가 있으면 그 뒤에 TDS를 넣는다. 지금은 그 어느 것도 나중에 더할 수 없어 한 번에 다 적거나 포기해야 한다.

**모든 로그가 `PRIVATE`에 갇혀 있다.** 백엔드가 사후 변경을 허용하도록 `visibility` 스펙의 결정까지 뒤집었는데(`2026-08-17-visibility-authorization.md`의 정정 주석), 정작 그 값을 바꿀 화면이 없다. 공유 기능 전체가 화면상 닫혀 있다.

**남의 로그에서 `삭제`를 누르면 403이 난다.** 앱 셸 스펙이 시드 레시피의 `이 레시피로 내렸다`에서 고친 것과 같은 결함이 로그 상세에 남아 있다.

## 용어

| 용어 | 정의 |
|---|---|
| 수정 가능한 18개 | `PATCH` 요청 DTO가 받는 필드. 실측값 9 · 관능 7 · `brewedAt` · `visibility` |
| 잠긴 필드 | 화면에 값은 보이나 바꿀 수 없는 것 — 레시피와 원두 |
| 더러운 필드 | 화면을 연 시점의 값과 현재 입력값이 다른 필드. `PATCH` 본문에 이것만 담는다 |
| 지우기 시도 | 열었을 때 값이 있던 칸을 빈칸으로 만든 상태. 서버가 반영할 수 없다 |

## API

**새 API는 없다.** 전부 기존 엔드포인트를 부른다.

| 메서드 | 경로 | 인증 | 이 스펙에서의 쓰임 |
|---|---|---|---|
| GET | `/api/v1/brew-logs/{id}` | 필요 | 편집 화면의 초기값 |
| PATCH | `/api/v1/brew-logs/{id}` | 필요 | 저장 |
| GET | `/api/v1/users/me` | 필요 | 소유 판정(`userId` 비교) |
| GET | `/api/v1/gear/user-grinders` | 필요 | 그라인더 선택란 |

### 요청 예시

별점만 `3.5`에서 `4.0`으로 고쳐 저장했을 때:

```json
PATCH /api/v1/brew-logs/42
{ "rating": 4.0 }
```

**바뀐 필드만 담는다.** 고치지 않은 값을 함께 보내면 본문만 보고는 무엇이 바뀌었는지 알 수 없다.

## 화면

| 경로 | 인증 | 탭바 | 하는 일 |
|---|---|---|---|
| `/brews/[id]/edit` | 필요 | **X** | 로그 편집. `/edit`로 끝나 탭바가 스스로 숨는다(앱 셸 스펙이 정한 판정 규칙) |
| `/brews/[id]` | 필요 | O | (기존) + `편집` 링크. `편집`·`삭제`를 소유자에게만 보인다 |

### 편집 화면의 필드

작성 화면(`BrewLogForm`)과 같은 순서·같은 라벨을 쓴다. **테스트는 이 문자열로 찾는다.**

| 그룹 | 라벨 | 필드 | 편집 |
|---|---|---|---|
| 잠금 | `레시피` | `recipeId` | **X** |
| 잠금 | `원두` | `beanBatchId` | **X** |
| 시각 | `내린 시각` | `brewedAt` | O |
| 실측 | `원두량` | `actualDoseG` | O |
| 실측 | `물량` | `actualWaterG` | O |
| 실측 | `물 온도` | `actualWaterTempC` | O |
| 실측 | `추출 시간` | `actualTotalTimeSeconds` | O |
| 실측 | `드로다운 시간` | `actualDrawdownSeconds` | O |
| 실측 | `그라인더` | `userGrinderId` | O |
| 실측 | `분쇄도 값` | `actualGrindSettingValue` | O |
| 실측 | `음료 중량` | `beverageWeightG` | O |
| 실측 | `TDS` | `tdsPercent` | O |
| 관능 | `별점`·`산미`·`단맛`·`바디`·`쓴맛`·`여운`·`메모` | 7개 | O |
| 공개 | `공개 범위` | `visibility` | O |

### 공개범위 선택란

편집 화면에서 처음 생기는 입력칸이다. **레시피 폼의 `VISIBILITY_LABELS`를 그대로 쓴다** — 같은 값이 두 화면에서 다른 이름으로 보이면 안 된다.

| 값 | 라벨 |
|---|---|
| `PRIVATE` | `나만 보기` |
| `FRIENDS` | `맞팔로우만` |
| `PUBLIC` | `전체 공개` |

### 지우기 시도의 처리

열었을 때 값이 있던 칸을 비우면 **그 칸에 안내를 붙이고 `저장`을 비활성화한다.**

```
TDS  [        ]  ← 비움
     ⚠ 값을 지울 수 없습니다. 고치거나 기록을 삭제하세요

[저장]  ← 비활성
```

문구는 정확히 `값을 지울 수 없습니다. 고치거나 기록을 삭제하세요`다.

**저장한 뒤에 알리지 않고 저장 전에 막는다.** 서버가 조용히 무시하면 사용자는 지워졌다고 믿는다. 원래 비어 있던 칸을 비운 채로 두는 것은 지우기 시도가 아니다.

---

## 어떻게 동작 — 인수 조건

> 픽스처는 실제 응답에서 뜬다. 아래 `brewLogWithTds`는 `test/fixtures.ts`에 이미 있는 것이다.

### 진입점과 소유 판정

#### AC-WEBLOGEDIT-01 · 내 로그 상세에 편집 링크가 있다

- **Given** `GET /brew-logs/42`의 `userId`가 `11`이고 `GET /users/me`의 `id`가 `11`이다
- **When** `/brews/42`를 연다
- **Then** 이름이 `편집`인 링크의 `href`가 `/brews/42/edit`다
- **검증** 페이지 테스트 `BrewDetailPage.test.tsx`

#### AC-WEBLOGEDIT-02 · 남의 로그에는 편집도 삭제도 없다

- **Given** `GET /brew-logs/42`의 `userId`가 `99`이고 `GET /users/me`의 `id`가 `11`이다
- **When** `/brews/42`를 연다
- **Then** 이름이 `편집`인 링크가 없고 이름이 `삭제`인 버튼도 없다
- **검증** 페이지 테스트 `BrewDetailPage.test.tsx`

#### AC-WEBLOGEDIT-03 · 내 로그에는 삭제가 그대로 있다

- **Given** AC-WEBLOGEDIT-01과 같은 전제
- **When** `/brews/42`를 연다
- **Then** 이름이 `삭제`인 버튼이 있다
- **검증** 페이지 테스트 `BrewDetailPage.test.tsx`

### 초기값

#### AC-WEBLOGEDIT-04 · 저장된 값이 채워진 채로 열린다

- **Given** `GET /brew-logs/42`가 `actualDoseG=20.0`, `actualWaterG=300.0`, `actualWaterTempC=92.0`, `actualTotalTimeSeconds=210`, `tdsPercent=1.35`, `rating=4.0`인 로그를 반환한다
- **When** `/brews/42/edit`를 연다
- **Then** `원두량`이 `20`, `물량`이 `300`, `물 온도`가 `92`, `추출 시간`이 `210`, `TDS`가 `1.35`다
- **검증** 페이지 테스트 `BrewEditPage.test.tsx`

#### AC-WEBLOGEDIT-05 · 공개범위 세 옵션이 있고 저장된 값이 골라져 있다

- **Given** `GET /brew-logs/42`의 `visibility`가 `PRIVATE`이다
- **When** `/brews/42/edit`를 연다
- **Then** `공개 범위` 선택란에 `나만 보기`·`맞팔로우만`·`전체 공개` 세 항목이 있고 값이 `PRIVATE`이다
- **검증** 페이지 테스트 `BrewEditPage.test.tsx`

#### AC-WEBLOGEDIT-06 · 레시피와 원두는 바꿀 수 없다

- **Given** `/brews/42/edit`가 열려 있다
- **When** 화면을 확인한다
- **Then** `레시피`와 `원두`에 해당하는 `combobox` 역할의 요소가 없다
- **검증** 페이지 테스트 `BrewEditPage.test.tsx`

### 저장

#### AC-WEBLOGEDIT-07 · 바뀐 필드만 본문에 담긴다

- **Given** `/brews/42/edit`가 `rating=3.5`인 로그로 열려 있다
- **When** `별점 4`를 누르고 `저장`을 누른다
- **Then** `PATCH /brew-logs/42` 본문이 정확히 `{ "rating": 4.0 }`이다
- **검증** 페이지 테스트 `BrewEditPage.test.tsx`

#### AC-WEBLOGEDIT-08 · 공개범위를 바꾸면 그것만 담긴다

- **Given** `/brews/42/edit`가 `visibility=PRIVATE`인 로그로 열려 있다
- **When** `공개 범위`를 `FRIENDS`로 고르고 `저장`을 누른다
- **Then** `PATCH` 본문이 정확히 `{ "visibility": "FRIENDS" }`다
- **검증** 페이지 테스트 `BrewEditPage.test.tsx`

#### AC-WEBLOGEDIT-09 · 저장에 성공하면 그 로그 상세로 간다

- **Given** `PATCH /brew-logs/42`가 `200`과 수정된 로그를 반환한다
- **When** `저장`을 누른다
- **Then** `/brews/42`로 이동한다
- **검증** 페이지 테스트 `BrewEditPage.test.tsx`

#### AC-WEBLOGEDIT-10 · 취소하면 그 로그 상세로 간다

- **When** `취소`를 누른다
- **Then** `/brews/42`로 이동하고 `PATCH` 요청이 **0회** 나간다
- **검증** 페이지 테스트 `BrewEditPage.test.tsx`

### 경계값

#### AC-WEBLOGEDIT-11 · 아무것도 고치지 않고 저장하면 요청이 나가지 않는다

- **Given** `/brews/42/edit`가 열려 있고 어떤 입력칸도 건드리지 않았다
- **When** `저장`을 누른다
- **Then** `PATCH` 요청이 **0회** 나가고 `/brews/42`로 이동한다
- **검증** 페이지 테스트 `BrewEditPage.test.tsx`

#### AC-WEBLOGEDIT-12 · 값이 있던 칸을 비우면 그 칸에 안내가 붙는다

- **Given** `/brews/42/edit`가 `tdsPercent=1.35`인 로그로 열려 있다
- **When** `TDS` 입력칸을 비운다
- **Then** `TDS` 입력칸의 `aria-describedby`가 가리키는 요소에 `값을 지울 수 없습니다. 고치거나 기록을 삭제하세요`가 있다
- **검증** 페이지 테스트 `BrewEditPage.test.tsx`

#### AC-WEBLOGEDIT-13 · 지우기 시도 중에는 저장이 비활성이다

- **Given** AC-WEBLOGEDIT-12의 상태다
- **When** `저장` 버튼을 확인한다
- **Then** `disabled`다
- **검증** 페이지 테스트 `BrewEditPage.test.tsx`

#### AC-WEBLOGEDIT-14 · 값을 다시 넣으면 저장이 살아난다

- **Given** AC-WEBLOGEDIT-12의 상태다
- **When** `TDS`에 `1.40`을 넣는다
- **Then** `저장` 버튼이 `disabled`가 아니고, 누르면 본문이 `{ "tdsPercent": 1.4 }`다
- **검증** 페이지 테스트 `BrewEditPage.test.tsx`

#### AC-WEBLOGEDIT-15 · 원래 비어 있던 칸은 비어 있어도 막지 않는다

- **Given** `/brews/42/edit`가 `tdsPercent` 키가 **없는** 로그로 열려 있다
- **When** `TDS`를 비운 채로 `별점 4`를 누르고 `저장`을 누른다
- **Then** 안내 문구가 없고 본문이 정확히 `{ "rating": 4.0 }`이다
- **검증** 페이지 테스트 `BrewEditPage.test.tsx`

### 에러

#### AC-WEBLOGEDIT-16 · 서버 검증 실패는 그 입력칸에 붙는다

- **Given** `PATCH /brew-logs/42`가 HTTP `400`과 `fieldErrors: [{ field: "tdsPercent", message: "100 미만이어야 합니다" }]`를 반환한다
- **When** `저장`을 누른다
- **Then** `TDS` 입력칸의 `aria-describedby`가 가리키는 요소에 `100 미만이어야 합니다`가 있고 화면이 `/brews/42/edit`에 머문다
- **검증** 페이지 테스트 `BrewEditPage.test.tsx`

#### AC-WEBLOGEDIT-17 · 없는 로그를 편집하려 하면 오류 화면이 뜬다

- **Given** `GET /brew-logs/999`가 HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **When** `/brews/999/edit`를 연다
- **Then** `다시 시도` 버튼을 가진 오류 화면이 보이고 입력칸이 하나도 없다
- **검증** 페이지 테스트 `BrewEditPage.test.tsx`

#### AC-WEBLOGEDIT-18 · 편집 화면에는 탭바가 없다

- **Given** 현재 경로가 `/brews/42/edit`다
- **When** 탭바를 확인한다
- **Then** 이름이 `기록`인 링크가 화면에 없다
- **검증** 컴포넌트 테스트 `BottomNav.test.tsx` (경로를 `/brews/42/edit`로 주입)

> 이 조건은 이미 통과한다 — 앱 셸의 탭바가 `/edit`로 끝나는 경로를 숨기기 때문이다. **회귀 방지용으로 남긴다.** 새 편집 경로가 그 규칙에 실제로 걸리는지는 확인해야 한다.

---

## 수동 확인

- [ ] 폰에서 기록 하나를 열어 별점만 고치고 저장 → 상세에 반영되는지
- [ ] TDS를 나중에 넣어 추출 수율·SCA 영역이 새로 나타나는지
- [ ] 공개범위를 `맞팔로우만`으로 바꾼 뒤 상호 팔로우 계정에서 보이는지
- [ ] 운영(`kaldi-note.today`)에서 편집·저장이 도는지

> **2026-09-02 로컬 확인 결과.** 로컬 실물을 375×812 브라우저로 밟았다.
>
> - 별점만 ★4 → ★5로 고쳐 저장했고 상세에 반영됐다.
> - TDS를 나중에 넣으면 추출 분석 영역이 새로 나타난다. **다만 음료 중량이 없으면 수율이 계산되지 않고 문구도 틀렸다** — 추출 분석 스펙(`docs/specs/2026-08-14-extraction-analysis.md`)의 「음료 중량이 없으면 수율을 계산하지 않는다」 조건을 정정해 고쳤다. **수율·SCA까지 보려면 음료 중량도 함께 넣어야 한다.**
> - 공개범위를 `맞팔로우만`으로 바꾼 뒤, 팔로우가 없는 계정은 "볼 권한이 없습니다" 화면을 받고 상호 팔로우 계정은 열렸다. 남의 로그이므로 `편집`·`삭제`가 없다.
>
> **관찰:** 남이 보는 화면에서 레시피 제목이 `레시피 12`로 뜬다. 로그는 `FRIENDS`인데 그 레시피가 `PRIVATE`이라 제목을 못 읽고 id로 폴백한다. 이번 스펙의 AC가 다루지 않는 영역이라 남겨둔다.
>
> **위 체크박스는 그대로 둔다.** 폰 실물과 운영 확인이 남았다.

## 열어둔 결정

- **값 지우기.** `JsonNullable` 도입이 필요하고 Jackson 3 패키지 재편과 얽힌다. TDS를 잘못 넣어 지우고 싶다는 요구가 실제로 나오면 그때 백엔드 스펙으로 다룬다.
- **동시 수정.** 기기를 두 대 이상 쓰기 시작하면 낙관적 잠금(`version` 컬럼)을 검토한다.

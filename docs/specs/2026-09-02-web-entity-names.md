---
id: WEBNAME
title: 브루잉 로그 화면의 레시피·원두를 이름으로 보여준다
status: 구현완료
plan: docs/plans/2026-09-02-plan-web-entity-names.md
---

# 브루잉 로그 화면의 레시피·원두를 이름으로 보여준다 스펙

> 2026-09-02 `/interview`로 확정. 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md).
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

브루잉 로그 화면 셋에서 레시피와 원두를 **id 숫자가 아니라 이름으로** 보여준다. 편집 화면은 지금 `12`·`3`을 그대로 찍고, 목록과 상세는 이름을 못 읽으면 `레시피 12`로 떨어진다.

이름을 읽지 못하는 경우가 정상 동작으로 존재하므로, **왜 못 읽었는지에 따라 다른 문구를 보여준다.** 백엔드는 바꾸지 않는다 — 화면이 기존 엔드포인트를 조합한다.

### 범위 밖 (Non-goals)

- **백엔드 변경 전부.** 로그 응답에 `recipeTitle` 같은 필드를 싣지도, 제목 스냅샷 컬럼을 더하지도 않는다. 「왜」에 적은 인가 규칙을 그대로 둔다.
- **목록 카드의 원두 이름.** 카드 한 장마다 배치·제품·로스터 조회가 늘어난다. 필요해지면 별도로 다룬다.
- **그라인더 이름 표시.** 로그가 `userGrinderId`를 갖고 있지만 상세 화면은 지금도 그라인더를 보여주지 않는다. id가 노출된 곳이 아니라 이번 결함과 무관하다.
- **로스팅 경과일 표시.** 로그가 `daysOffRoast` 스냅샷을 갖고 있으나 어느 화면에도 보이지 않는다. 이번 원두 표기를 이름만으로 정했으므로 그대로 둔다.
- **작성 화면(`/brews/new`).** 그곳의 원두 선택란은 이미 이름을 보여준다.

## 왜

**2026-09-02 수동 확인에서 남이 보는 로그의 레시피 제목이 `레시피 12`로 떴다.** 그리고 편집 화면은 남의 로그가 아닌 내 로그인데도 레시피와 원두를 `12`·`3`으로 보여준다 — 자기가 무엇으로 내렸는지 화면만 봐서는 알 수 없다.

두 증상의 원인이 다르다.

- **편집 화면**은 이름을 **아예 부르지 않는다.** 내 로그이므로 권한 문제가 없고, 조회만 더하면 끝난다.
- **목록과 상세**는 부르지만 **403을 받을 수 있다.** 공개범위 인가 스펙(`docs/specs/2026-08-17-visibility-authorization.md`)의 「PRIVATE 레시피를 참조하는 PUBLIC 로그는 타인에게 200이다」가 이 상황을 의도적으로 규정한다 — 로그는 보이되 그 레시피는 못 읽는 것이 정상이다.

그래서 이 결함은 "이름을 보여준다"로 끝나지 않는다. 로그 응답에 제목을 실으면 **볼 권한이 없는 사람에게 PRIVATE 레시피의 제목이 새어 나가** 그 인가 규칙을 뒤집게 된다. 이번 스펙은 그것을 하지 않고, **못 읽었을 때 사용자가 이유를 알 수 있는 문구**를 보여주는 쪽을 택한다.

`레시피 12`가 나쁜 이유는 정확히 그 지점이다 — 사용자는 그것이 비공개인지, 삭제됐는지, 통신이 실패한 것인지 구분할 수 없다.

## 용어

| 용어 | 정의 |
|---|---|
| 이름 | 레시피는 `title`, 원두는 `{로스터명} {제품명}`을 공백 하나로 이은 것 |
| 폴백 문구 | 이름을 읽지 못했을 때 그 자리에 대신 넣는 한국어 문구 |
| 조회 상태 | 이름을 얻으려 부른 요청의 결과. `성공` / `조회 중` / 실패(`code`로 구분) |

## 화면과 표시 대상

| 화면 | 경로 | 레시피 | 원두 |
|---|---|---|---|
| 홈 | `/` | O | X |
| 목록 | `/brews` | O | X |
| 상세 | `/brews/{id}` | O (링크) | **O — 새로 넣는 줄** |
| 편집 | `/brews/{id}/edit` | **O — 지금 id** | **O — 지금 id** |

## 이름을 만드는 방법

백엔드를 바꾸지 않으므로 화면이 기존 엔드포인트를 조합한다.

| 대상 | 부르는 것 |
|---|---|
| 레시피 이름 | `GET /recipes/{recipeId}` → `title` |
| 원두 이름 | `GET /bean-batches/{beanBatchId}` → `beanProductId` → `GET /bean-products/{beanProductId}` → `name`·`roasterId` → `GET /roasters`에서 그 id의 `name` |

`GET /roasters`는 목록만 있고 `/{id}`가 없다. 목록에서 찾는다.

## 폴백 문구

프론트는 백엔드의 `code`로 분기한다(`docs/conventions/frontend.md`「에러는 `code` 필드로 분기한다」). `message` 문자열로 판단하지 않는다.

| 조회 상태 | 레시피 | 원두 |
|---|---|---|
| 성공 | `title` 값 | `{로스터명} {제품명}` |
| `code: "FORBIDDEN"` (HTTP 403) | `비공개 레시피` | `비공개 원두` |
| `code: "NOT_FOUND"` (HTTP 404) | `삭제된 레시피` | `삭제된 원두` |
| 그 밖의 실패 | `레시피를 불러오지 못했습니다` | `원두를 불러오지 못했습니다` |
| 조회 중 | `` (빈 문자열) | `` (빈 문자열) |

**조회 중에 폴백 문구를 보여주지 않는다.** 보여주면 성공하는 경우에도 `비공개 레시피`가 한 번 깜빡였다가 제목으로 바뀐다.

원두는 조회가 3단계라 **먼저 실패한 단계의 `code`로 판정한다.** 남의 로그면 첫 단계(`GET /bean-batches/{id}`)가 403이므로 언제나 `비공개 원두`다 — 원두 재고는 개인 소유라 남이 읽을 수 없다.

---

## 어떻게 동작 — 인수 조건

> 판정은 순수 함수 하나로 뽑는다. 화면마다 네 갈래를 재현하는 대신, 문구는 함수 단위로 검증하고 화면은 그 결과를 쓰는지만 본다.

### 정상 동작

#### AC-WEBNAME-01 · 편집 화면이 레시피 제목을 보여준다

- **Given** `/brews/2/edit`를 연다. 로그의 `recipeId`가 `12`이고 `GET /recipes/12`가 `title: "Tetsu Kasuya 4:6 Method"`을 준다
- **When** 화면이 그려진다
- **Then** `레시피` 항목의 값이 `Tetsu Kasuya 4:6 Method`이다. 화면에 `12`라는 텍스트가 그 자리에 없다
- **검증** 화면 테스트 `src/app/brews/[id]/edit/page.test.tsx`

#### AC-WEBNAME-02 · 편집 화면이 원두를 `로스터 제품` 형식으로 보여준다

- **Given** `/brews/2/edit`를 연다. 로그의 `beanBatchId`가 `3`이고, `GET /bean-batches/3`이 `beanProductId: 3`을, `GET /bean-products/3`이 `name: "예가체프"`·`roasterId: 3`을, `GET /roasters`가 `[{ id: 3, name: "프릿츠" }]`를 준다
- **When** 화면이 그려진다
- **Then** `원두` 항목의 값이 `프릿츠 예가체프`다
- **검증** 화면 테스트 `src/app/brews/[id]/edit/page.test.tsx`

#### AC-WEBNAME-03 · 상세 화면에 원두 줄이 있다

- **Given** `/brews/2`를 연다. 위와 같은 응답이 온다
- **When** 화면이 그려진다
- **Then** `원두`라는 라벨과 값 `프릿츠 예가체프`가 화면에 있다
- **검증** 화면 테스트 `src/app/brews/[id]/page.test.tsx`

### 폴백 — 레시피

#### AC-WEBNAME-10 · `FORBIDDEN`이면 `비공개 레시피`

- **Given** 레시피 조회가 HTTP `403`, `code: "FORBIDDEN"`으로 실패했다
- **When** 레시피 이름 판정 함수를 부른다
- **Then** `비공개 레시피`를 돌려준다
- **검증** 단위 테스트 `src/features/brewlog/entityLabel.test.ts`

#### AC-WEBNAME-11 · `NOT_FOUND`면 `삭제된 레시피`

- **Given** 레시피 조회가 HTTP `404`, `code: "NOT_FOUND"`로 실패했다
- **When** 레시피 이름 판정 함수를 부른다
- **Then** `삭제된 레시피`를 돌려준다
- **검증** 단위 테스트 `src/features/brewlog/entityLabel.test.ts`

#### AC-WEBNAME-12 · 그 밖의 실패면 `레시피를 불러오지 못했습니다`

- **Given** 레시피 조회가 HTTP `500`, `code: "INTERNAL_ERROR"`로 실패했다
- **When** 레시피 이름 판정 함수를 부른다
- **Then** `레시피를 불러오지 못했습니다`를 돌려준다
- **검증** 단위 테스트 `src/features/brewlog/entityLabel.test.ts`

#### AC-WEBNAME-13 · 조회 중이면 빈 문자열

- **Given** 레시피 조회가 아직 끝나지 않았다
- **When** 레시피 이름 판정 함수를 부른다
- **Then** `` (빈 문자열)을 돌려준다
- **검증** 단위 테스트 `src/features/brewlog/entityLabel.test.ts`

### 폴백 — 원두

#### AC-WEBNAME-20 · 배치가 `FORBIDDEN`이면 `비공개 원두`

- **Given** `GET /bean-batches/{id}`가 HTTP `403`, `code: "FORBIDDEN"`으로 실패했다
- **When** 원두 이름 판정 함수를 부른다
- **Then** `비공개 원두`를 돌려준다
- **검증** 단위 테스트 `src/features/brewlog/entityLabel.test.ts`

#### AC-WEBNAME-21 · 배치가 `NOT_FOUND`면 `삭제된 원두`

- **Given** `GET /bean-batches/{id}`가 HTTP `404`, `code: "NOT_FOUND"`로 실패했다
- **When** 원두 이름 판정 함수를 부른다
- **Then** `삭제된 원두`를 돌려준다
- **검증** 단위 테스트 `src/features/brewlog/entityLabel.test.ts`

#### AC-WEBNAME-22 · 그 밖의 실패면 `원두를 불러오지 못했습니다`

- **Given** `GET /bean-batches/{id}`는 성공했으나 `GET /bean-products/{id}`가 HTTP `500`, `code: "INTERNAL_ERROR"`로 실패했다
- **When** 원두 이름 판정 함수를 부른다
- **Then** `원두를 불러오지 못했습니다`를 돌려준다
- **검증** 단위 테스트 `src/features/brewlog/entityLabel.test.ts`

#### AC-WEBNAME-23 · 조회 중이면 빈 문자열

- **Given** 세 조회 중 하나라도 아직 끝나지 않았고, 끝난 것 중 실패가 없다
- **When** 원두 이름 판정 함수를 부른다
- **Then** `` (빈 문자열)을 돌려준다
- **검증** 단위 테스트 `src/features/brewlog/entityLabel.test.ts`

#### AC-WEBNAME-24 · 로스터를 못 찾으면 제품명만 쓴다

- **Given** 세 조회가 모두 성공했으나 `GET /roasters` 응답에 `roasterId: 3`인 항목이 없다
- **When** 원두 이름 판정 함수를 부른다
- **Then** `예가체프`를 돌려준다. 앞에 공백이 붙지 않는다
- **검증** 단위 테스트 `src/features/brewlog/entityLabel.test.ts`

### 링크

#### AC-WEBNAME-30 · 제목을 읽었으면 상세의 제목이 레시피 링크다

- **Given** `/brews/2`를 열고 `GET /recipes/12`가 `title: "Tetsu Kasuya 4:6 Method"`을 준다
- **When** 화면이 그려진다
- **Then** 텍스트 `Tetsu Kasuya 4:6 Method`을 가진 링크가 있고 그 `href`가 `/recipes/12`다
- **검증** 화면 테스트 `src/app/brews/[id]/page.test.tsx`

#### AC-WEBNAME-31 · 폴백 문구는 링크가 아니다

- **Given** `/brews/2`를 열고 `GET /recipes/12`가 HTTP `403`, `code: "FORBIDDEN"`으로 실패한다
- **When** 화면이 그려진다
- **Then** 텍스트 `비공개 레시피`가 화면에 있고, 그 텍스트를 가진 링크는 없다
- **검증** 화면 테스트 `src/app/brews/[id]/page.test.tsx`

### 다른 것을 망가뜨리지 않는다

#### AC-WEBNAME-40 · 이름 조회가 실패해도 편집 저장은 된다

- **Given** `/brews/2/edit`를 열고 `GET /recipes/12`가 HTTP `403`으로 실패한다. 별점을 `4`에서 `5`로 바꾼다
- **When** `저장`을 누른다
- **Then** `PATCH /brew-logs/2`가 `{"rating":5}`를 본문으로 한 번 호출된다
- **검증** 화면 테스트 `src/app/brews/[id]/edit/page.test.tsx`

#### AC-WEBNAME-41 · 한 레시피가 실패해도 나머지 카드는 제목을 보여준다

- **Given** `/brews`를 연다. 로그 둘의 `recipeId`가 각각 `12`와 `17`이고, `GET /recipes/12`는 HTTP `403`으로 실패하며 `GET /recipes/17`은 `title: "Tetsu Kasuya 4:6 Method"`을 준다
- **When** 화면이 그려진다
- **Then** 카드 하나는 `비공개 레시피`를, 다른 하나는 `Tetsu Kasuya 4:6 Method`을 보여준다
- **검증** 화면 테스트 `src/app/brews/page.test.tsx`

#### AC-WEBNAME-42 · 같은 레시피를 쓴 로그가 여럿이어도 조회는 1회다

- **Given** `/brews`를 연다. 로그 셋의 `recipeId`가 모두 `12`다
- **When** 화면이 그려진다
- **Then** `GET /recipes/12`가 정확히 `1`회 호출된다
- **검증** 화면 테스트 `src/app/brews/page.test.tsx`

---

## 수동 확인

- [x] 상호 팔로우 계정으로 남의 `FRIENDS` 로그를 열어 `비공개 레시피`가 뜨는지 본다
- [ ] 폰에서 편집 화면을 열어 레시피·원두 이름이 한 줄에 들어가는지, 넘치면 어떻게 보이는지 본다

> **2026-09-03 확인 (첫째 항목).** 사용자 11로 로그인해 **12가 남긴 `FRIENDS` 로그**(`/brews/6`, 레시피 18은 12의 `PRIVATE`)를 390×844로 열었다. 화면 텍스트 그대로:
>
> ```
> 2026-09-01
> 비공개 레시피
> 원두  비공개 원두
> 실측값  원두량 16.0g  물 256.0g  온도 91°C  비율 1:16.0  분쇄도 25
> ```
>
> **`레시피 12` 같은 id 폴백이 더 이상 나오지 않는다.** 2026-09-02 브루잉 로그 편집 확인에서 관찰됐던 그 문구가 이 스펙으로 해소된 것이 실물에서 확인됐다. 원두도 `비공개 원두`로 뜬다(재고는 개인 소유라 언제나 403).
>
> 덤으로 **푸어 스텝 절이 그려지지 않는 것**도 같은 화면에서 확인됐다 — 푸어 스텝 스펙(`docs/specs/2026-09-03-web-brew-log-steps.md`)의 「권한이 없으면 스텝 절이 없다」에 해당한다. 남의 로그라 `편집`·`삭제`도 없다.
>
> **AC ID를 산문에 그대로 적지 않는다.** 처음에는 그 조건의 ID를 적었는데, `check-spec-coverage.sh`가 그것을 **이 스펙이 소유한 AC**로 세어 개수가 17 → 18로 늘었다. 다른 스펙의 조건을 가리킬 때는 문서 경로와 제목으로 쓴다.
>
> **둘째 항목(폰 실물)은 그대로 둔다.** 여기서 본 것은 데스크톱 브라우저의 모바일 에뮬레이션이지 실물이 아니다 — 긴 로스터명이 넘칠 때의 모습은 실제 기기에서 봐야 한다.

## 열어둔 결정

- **긴 이름의 줄바꿈.** `프릿츠 예가체프` 정도는 360px에 들어가지만 로스터명이 길면 넘칠 수 있다. 실물에서 넘치는 것을 본 뒤 자를지 줄바꿈할지 정한다.
- **목록 카드의 원두 이름.** 카드당 조회 3건이 늘어난다. 목록에서 원두를 비교하고 싶다는 요구가 실제로 생기면 그때 다룬다.
- **로그 응답에 이름을 싣는 백엔드 변경.** 화면마다 조회가 늘어나는 것이 실제로 느려지면 재검토한다. 그때는 PRIVATE 레시피 제목의 노출 범위를 먼저 정해야 한다.

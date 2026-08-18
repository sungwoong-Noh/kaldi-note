---
id: VIS
title: 공개범위 인가 + 팔로우
status: 구현완료
plan: docs/plans/2026-08-17-plan-visibility.md
---

# 공개범위 인가 + 팔로우 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

**이 스펙은 AC 접두사를 둘 쓴다** — `AC-FOLLOW-nn`(팔로우 API)과 `AC-VIS-nn`(공개범위 인가). 두 기능이 하나로 묶여야만 검증이 가능하기 때문이다. `check-spec-coverage.sh`의 패턴(`AC-[A-Z][A-Z0-9_]*-[0-9]+`)이 둘 다 잡는다.

## 무엇을

사용자가 서로를 팔로우하고, 그 관계를 근거로 레시피와 브루잉 로그를 남에게 열어준다.

`recipes.visibility`·`brew_logs.visibility` 컬럼은 이미 존재하지만 지금은 값이 저장만 되고 판정에 전혀 쓰이지 않는다. 단건 조회는 `PUBLIC`이든 `PRIVATE`이든 소유자가 아니면 403이다. 이 스펙은 그 컬럼을 실제 인가 규칙으로 바꾸고, `FRIENDS`를 성립시키는 데 필요한 팔로우 등록·해제·상태 조회 API를 함께 만든다.

`FRIENDS`는 **상호 팔로우**로 판정한다. 판정 쿼리 `FollowRepository.existsMutualFollow(a, b)`는 이미 작성돼 있고 아무도 호출하지 않는 상태다.

### 범위 밖 (Non-goals)

- **목록 조회(피드) API.** 정렬·페이지네이션·필터 결정이 통째로 딸려와 스펙이 두 배가 된다. 판정 로직을 먼저 확정하고 목록은 그 위에 얹는다. 이번 스펙의 인가는 전부 **단건 조회 기준**이다.
- **브루잉 로그 수정 API.** `visibility`는 생성 시점에만 정한다. 만든 뒤 공개로 전환할 수 없다. `PATCH /brew-logs/{id}`는 후속이다.
- **포크.** 별도 스펙에서 다룬다. 남의 `PUBLIC` 레시피를 볼 수 있게 되는 것까지가 이번 범위이고, 그것을 복제하는 동작은 포함하지 않는다.
- **원두 재고(`bean_batches`)와 카탈로그.** `visibility` 컬럼 자체가 없다. 재고는 소유자 전용 403을 그대로 유지한다.
- **비로그인 접근.** `PUBLIC`이어도 JWT가 없으면 401이다. 링크만으로 열리는 공유는 공개 서비스 전환 시 다룬다.
- **팔로워/팔로잉 목록 조회.** 상태 조회는 특정 상대 한 명에 대한 불리언 3개만 돌려준다.

## 왜

`docs/design/2026-08-14-architecture.md:253`의 핵심 시나리오는 **"여자친구 계정으로 로그인해 FRIENDS 레시피 조회"**로 끝난다. 지금은 이 시나리오가 실행되지 않는다. 레시피에 `visibility: "FRIENDS"`를 저장해도 상대는 403을 받는다.

더 근본적으로, **팔로우 관계를 만들 방법이 서버에 없다.** `follows` 테이블과 `Follow` 엔티티, `FollowRepository`가 V1부터 존재하지만 이를 쓰는 컨트롤러가 하나도 없다. 실사용자는 SQL을 직접 치지 않는 한 상호 팔로우 상태에 도달할 수 없다. 브루잉 로그 계획에서 `user_grinders`가 같은 상태였고, 태스크 착수 후에야 발견해 선행 태스크를 급히 얹었다. 같은 실패를 반복하지 않기 위해 팔로우 API를 이 스펙에 함께 넣는다.

## 용어

| 용어 | 정의 |
|---|---|
| 소유자 | 레시피는 `recipes.owner_user_id`, 브루잉 로그는 `brew_logs.user_id`가 호출자와 같은 사람 |
| 타인 | 인증은 됐으나 소유자가 아닌 사용자 |
| 상호 팔로우 | `follows`에 `(a→b)`와 `(b→a)` 두 행이 **모두** 있는 상태 |
| 단방향 팔로우 | 두 행 중 하나만 있는 상태. `FRIENDS` 판정에서는 관계 없음과 동일하게 취급한다 |
| 주인 없는 레시피 | `recipes.owner_user_id IS NULL`. CURATED 시드 레시피와 탈퇴 사용자의 유기물(`ON DELETE SET NULL`) |

## 데이터

**스키마 변경 없음.** `follows`(V1)·`recipes.visibility`(V6)·`brew_logs.visibility`(V8)가 이미 있다. 마이그레이션 파일을 추가하지 않는다.

참고용 기존 스키마:

| 테이블 | 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|---|
| `follows` | `follower_user_id` | `BIGINT` | X | PK 일부. `users(id)` FK, `ON DELETE CASCADE` |
| `follows` | `followee_user_id` | `BIGINT` | X | PK 일부. `chk_no_self_follow` CHECK로 자기 자신 금지 |
| `recipes` | `owner_user_id` | `BIGINT` | **O** | `ON DELETE SET NULL` |
| `recipes` | `visibility` | `VARCHAR(20)` | X | `PRIVATE` / `FRIENDS` / `PUBLIC`. 기본 `PRIVATE` |
| `brew_logs` | `visibility` | `VARCHAR(20)` | X | 같음. 지금까지 항상 `PRIVATE`로 고정돼 있었다 |

## API

| 메서드 | 경로 | 인증 | 성공 상태 | 설명 |
|---|---|---|---|---|
| POST | `/api/v1/users/{userId}/follow` | 필요 | 204 | 팔로우 등록 (멱등) |
| DELETE | `/api/v1/users/{userId}/follow` | 필요 | 204 | 팔로우 해제 (멱등) |
| GET | `/api/v1/users/{userId}/follow` | 필요 | 200 | 나와 `{userId}` 사이의 팔로우 상태 |

기존 엔드포인트의 **동작만 바뀐다** (경로·메서드 변경 없음):

| 메서드 | 경로 | 바뀌는 것 |
|---|---|---|
| GET | `/api/v1/recipes/{id}` | 소유자 전용 → `visibility` 판정 |
| GET | `/api/v1/brew-logs/{id}` | 소유자 전용 → `visibility` 판정 |
| POST | `/api/v1/brew-logs` | `visibility`를 선택 필드로 받는다 (생략 시 `PRIVATE`) |

`PUT`/`DELETE /api/v1/recipes/{id}`는 **바뀌지 않는다.** `visibility`와 무관하게 소유자 전용 403이다.

**검증 순서:** `401`(미인증) → `404`(대상 없음 / 소프트 삭제됨) → `403`(볼 권한 없음) → `400`(필드 검증). 기존 레시피·브루잉 로그 스펙과 같다.

### 조회 인가 판정 규칙

호출자를 `viewer`, 대상을 `target`이라 할 때 다음 순서로 판정한다. 먼저 참이 되는 항목에서 멈춘다.

1. `target`의 소유자 id가 `viewer`와 같으면 → **허용**
2. `target.visibility == PUBLIC` → **허용**
3. `target.visibility == FRIENDS` **그리고** `existsMutualFollow(viewer, 소유자)` → **허용**
4. 그 밖에는 → **403 `FORBIDDEN`**

소유자 id가 `null`이면 1번을 통과할 수 없을 뿐, 2·3번은 그대로 적용된다. 3번에서 소유자가 `null`이면 상호 팔로우 상대가 존재할 수 없으므로 항상 거짓이다.

판정은 **요청 시점에 실시간으로** 한다. 팔로우가 끊기면 다음 요청부터 즉시 403이 된다. 판정 결과를 저장하거나 캐시하지 않는다.

### 요청 / 응답 예시

**팔로우 상태 조회**

```
GET /api/v1/users/7/follow
Authorization: Bearer <내 토큰. 내 id는 3>
```

```json
{
  "following": true,
  "followedBy": true,
  "mutual": true
}
```

- `following` — 내가 `{userId}`를 팔로우하고 있다 (`3→7` 행 존재)
- `followedBy` — `{userId}`가 나를 팔로우하고 있다 (`7→3` 행 존재)
- `mutual` — 둘 다 참. `FRIENDS` 판정과 같은 값이다

**브루잉 로그 생성 — `visibility` 추가**

```json
{
  "recipeId": 12,
  "beanBatchId": 5,
  "userGrinderId": 2,
  "brewedAt": "2026-08-17T05:03:00Z",
  "visibility": "PUBLIC",
  "actualDoseG": 15.0,
  "actualWaterG": 250.0,
  "actualWaterTempC": 92.0,
  "actualTotalTimeSeconds": 180,
  "actualGrindSettingValue": 22
}
```

`visibility`를 생략하면 `PRIVATE`로 저장된다. 허용값은 `PRIVATE` / `FRIENDS` / `PUBLIC` 셋뿐이다.

### 에러 코드

새 `ErrorCode`를 추가하지 않는다. 기존 `INVALID_REQUEST`(400)·`UNAUTHORIZED`(401)·`FORBIDDEN`(403)·`NOT_FOUND`(404)를 재사용한다.

---

## 어떻게 동작 — 인수 조건

### 팔로우 등록 — 정상 동작

#### AC-FOLLOW-01 · 팔로우하면 follows에 행이 하나 생긴다

- **Given** 사용자 `a`(호출자)와 `b`가 존재하고 `follows`가 비어 있다
- **When** `a`의 토큰으로 `POST /api/v1/users/{b}/follow`
- **Then** HTTP `204`, 응답 본문 없음. `follows`에 `(follower=a, followee=b)` 행이 정확히 1개
- **검증** API 테스트 `FollowControllerTest`

#### AC-FOLLOW-02 · 같은 팔로우를 두 번 해도 행은 하나다

- **Given** `a`가 이미 `b`를 팔로우한 상태 (`follows` 행 1개)
- **When** `a`의 토큰으로 `POST /api/v1/users/{b}/follow`를 다시 호출
- **Then** HTTP `204`. `follows`의 `(a, b)` 행은 여전히 1개
- **검증** API 테스트 `FollowControllerTest`

### 팔로우 해제 — 정상 동작

#### AC-FOLLOW-03 · 해제하면 행이 사라진다

- **Given** `a`가 `b`를 팔로우한 상태
- **When** `a`의 토큰으로 `DELETE /api/v1/users/{b}/follow`
- **Then** HTTP `204`. `follows`에 `(a, b)` 행이 0개
- **검증** API 테스트 `FollowControllerTest`

#### AC-FOLLOW-04 · 팔로우하지 않은 상대를 해제해도 204다

- **Given** `a`와 `b` 사이에 `follows` 행이 없다
- **When** `a`의 토큰으로 `DELETE /api/v1/users/{b}/follow`
- **Then** HTTP `204`. `follows` 행 수는 0으로 그대로
- **검증** API 테스트 `FollowControllerTest`

#### AC-FOLLOW-05 · 해제는 내 방향만 지운다

- **Given** `a→b`와 `b→a` 두 행이 모두 있다 (상호 팔로우)
- **When** `a`의 토큰으로 `DELETE /api/v1/users/{b}/follow`
- **Then** HTTP `204`. `(a, b)` 행은 0개, `(b, a)` 행은 1개로 남는다
- **검증** API 테스트 `FollowControllerTest`

### 팔로우 상태 조회 — 정상 동작

#### AC-FOLLOW-06 · 아무 관계도 없으면 셋 다 false다

- **Given** `a`와 `b` 사이에 `follows` 행이 없다
- **When** `a`의 토큰으로 `GET /api/v1/users/{b}/follow`
- **Then** HTTP `200`, `{"following": false, "followedBy": false, "mutual": false}`
- **검증** API 테스트 `FollowControllerTest`

#### AC-FOLLOW-07 · 내가 팔로우만 했으면 following만 true다

- **Given** `a→b` 행만 있다
- **When** `a`의 토큰으로 `GET /api/v1/users/{b}/follow`
- **Then** HTTP `200`, `{"following": true, "followedBy": false, "mutual": false}`
- **검증** API 테스트 `FollowControllerTest`

#### AC-FOLLOW-08 · 상대만 나를 팔로우했으면 followedBy만 true다

- **Given** `b→a` 행만 있다
- **When** `a`의 토큰으로 `GET /api/v1/users/{b}/follow`
- **Then** HTTP `200`, `{"following": false, "followedBy": true, "mutual": false}`
- **검증** API 테스트 `FollowControllerTest`

#### AC-FOLLOW-09 · 상호 팔로우면 셋 다 true다

- **Given** `a→b`와 `b→a` 두 행이 모두 있다
- **When** `a`의 토큰으로 `GET /api/v1/users/{b}/follow`
- **Then** HTTP `200`, `{"following": true, "followedBy": true, "mutual": true}`
- **검증** API 테스트 `FollowControllerTest`

### 팔로우 — 에러

#### AC-FOLLOW-10 · 자기 자신을 팔로우하면 400이다

- **Given** 호출자 `a`가 존재한다
- **When** `a`의 토큰으로 `POST /api/v1/users/{a}/follow`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`. `follows` 행 수는 0으로 그대로
- **검증** API 테스트 `FollowControllerTest`

#### AC-FOLLOW-11 · 자기 자신을 해제하면 400이다

- **Given** 호출자 `a`가 존재한다
- **When** `a`의 토큰으로 `DELETE /api/v1/users/{a}/follow`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `FollowControllerTest`

#### AC-FOLLOW-12 · 자기 자신의 상태를 조회하면 400이다

- **Given** 호출자 `a`가 존재한다
- **When** `a`의 토큰으로 `GET /api/v1/users/{a}/follow`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`
- **검증** API 테스트 `FollowControllerTest`

#### AC-FOLLOW-13 · 없는 사용자를 팔로우하면 404다

- **Given** `users`에 id `999999`가 없다
- **When** 유효한 토큰으로 `POST /api/v1/users/999999/follow`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `FollowControllerTest`

#### AC-FOLLOW-14 · 없는 사용자를 해제하면 404다

- **Given** `users`에 id `999999`가 없다
- **When** 유효한 토큰으로 `DELETE /api/v1/users/999999/follow`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `FollowControllerTest`

#### AC-FOLLOW-15 · 없는 사용자의 상태를 조회하면 404다

- **Given** `users`에 id `999999`가 없다
- **When** 유효한 토큰으로 `GET /api/v1/users/999999/follow`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `FollowControllerTest`

#### AC-FOLLOW-16 · 토큰 없이 팔로우하면 401이다

- **Given** 사용자 `b`가 존재한다
- **When** `Authorization` 헤더 없이 `POST /api/v1/users/{b}/follow`
- **Then** HTTP `401`과 `code: "UNAUTHORIZED"`
- **검증** API 테스트 `FollowControllerTest`

#### AC-FOLLOW-17 · 토큰 없이 해제하면 401이다

- **Given** 사용자 `b`가 존재한다
- **When** `Authorization` 헤더 없이 `DELETE /api/v1/users/{b}/follow`
- **Then** HTTP `401`과 `code: "UNAUTHORIZED"`
- **검증** API 테스트 `FollowControllerTest`

#### AC-FOLLOW-18 · 토큰 없이 상태를 조회하면 401이다

- **Given** 사용자 `b`가 존재한다
- **When** `Authorization` 헤더 없이 `GET /api/v1/users/{b}/follow`
- **Then** HTTP `401`과 `code: "UNAUTHORIZED"`
- **검증** API 테스트 `FollowControllerTest`

---

### 레시피 조회 인가 — 소유자

#### AC-VIS-01 · 소유자는 PRIVATE 레시피를 본다

- **Given** `a`가 소유한 `visibility="PRIVATE"` 레시피가 있다
- **When** `a`의 토큰으로 `GET /api/v1/recipes/{id}`
- **Then** HTTP `200`. 응답의 `visibility`는 `"PRIVATE"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-VIS-02 · 소유자는 FRIENDS 레시피를 본다

- **Given** `a`가 소유한 `visibility="FRIENDS"` 레시피가 있고, `a`는 아무도 팔로우하지 않았다
- **When** `a`의 토큰으로 `GET /api/v1/recipes/{id}`
- **Then** HTTP `200`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-VIS-03 · 소유자는 PUBLIC 레시피를 본다

- **Given** `a`가 소유한 `visibility="PUBLIC"` 레시피가 있다
- **When** `a`의 토큰으로 `GET /api/v1/recipes/{id}`
- **Then** HTTP `200`
- **검증** API 테스트 `RecipeControllerTest`

### 레시피 조회 인가 — 타인

#### AC-VIS-04 · 타인은 PUBLIC 레시피를 본다

- **Given** `a`가 소유한 `visibility="PUBLIC"` 레시피가 있고, `b`는 `a`와 아무 팔로우 관계가 없다
- **When** `b`의 토큰으로 `GET /api/v1/recipes/{id}`
- **Then** HTTP `200`. 응답의 `ownerUserId`는 `a`의 id
- **검증** API 테스트 `RecipeControllerTest`

#### AC-VIS-05 · 상호 팔로우면 타인이 FRIENDS 레시피를 본다

- **Given** `a`가 소유한 `visibility="FRIENDS"` 레시피가 있고, `follows`에 `a→b`와 `b→a` 두 행이 모두 있다
- **When** `b`의 토큰으로 `GET /api/v1/recipes/{id}`
- **Then** HTTP `200`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-VIS-06 · 타인의 PRIVATE 레시피는 403이다

- **Given** `a`가 소유한 `visibility="PRIVATE"` 레시피가 있고, `a`와 `b`는 상호 팔로우 상태다
- **When** `b`의 토큰으로 `GET /api/v1/recipes/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`
- **검증** API 테스트 `RecipeControllerTest`

### 레시피 조회 인가 — FRIENDS 경계

> 상호 팔로우의 두 방향 각각이 단독으로는 부족하다는 것을 양쪽 모두 확인한다.

#### AC-VIS-07 · 내가 소유자를 팔로우만 한 상태면 FRIENDS는 403이다

- **Given** `a`가 소유한 `visibility="FRIENDS"` 레시피가 있고, `follows`에 `b→a` 행만 있다 (`a→b`는 없다)
- **When** `b`의 토큰으로 `GET /api/v1/recipes/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-VIS-08 · 소유자가 나를 팔로우만 한 상태면 FRIENDS는 403이다

- **Given** `a`가 소유한 `visibility="FRIENDS"` 레시피가 있고, `follows`에 `a→b` 행만 있다 (`b→a`는 없다)
- **When** `b`의 토큰으로 `GET /api/v1/recipes/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-VIS-09 · 팔로우 관계가 전혀 없으면 FRIENDS는 403이다

- **Given** `a`가 소유한 `visibility="FRIENDS"` 레시피가 있고, `follows`에 `a`·`b` 사이 행이 하나도 없다
- **When** `b`의 토큰으로 `GET /api/v1/recipes/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-VIS-10 · 상호 팔로우가 끊기면 다음 요청부터 403이다

- **Given** `a`가 소유한 `visibility="FRIENDS"` 레시피를 `b`가 상호 팔로우 상태에서 `200`으로 조회한 뒤, `b`가 `DELETE /api/v1/users/{a}/follow`를 호출했다
- **When** `b`의 토큰으로 같은 `GET /api/v1/recipes/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`
- **검증** API 테스트 `RecipeControllerTest`

### 레시피 조회 인가 — 주인 없는 레시피

#### AC-VIS-11 · owner가 null이고 PUBLIC이면 누구나 본다

- **Given** `owner_user_id IS NULL`이고 `visibility="PUBLIC"`인 레시피가 있다
- **When** 임의의 사용자 `b`의 토큰으로 `GET /api/v1/recipes/{id}`
- **Then** HTTP `200`. 응답의 `ownerUserId`는 `null`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-VIS-12 · owner가 null이고 FRIENDS면 403이다

- **Given** `owner_user_id IS NULL`이고 `visibility="FRIENDS"`인 레시피가 있다
- **When** 임의의 사용자 `b`의 토큰으로 `GET /api/v1/recipes/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-VIS-13 · owner가 null이고 PRIVATE면 403이다

- **Given** `owner_user_id IS NULL`이고 `visibility="PRIVATE"`인 레시피가 있다
- **When** 임의의 사용자 `b`의 토큰으로 `GET /api/v1/recipes/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`
- **검증** API 테스트 `RecipeControllerTest`

### 레시피 — 쓰기는 소유자 전용

#### AC-VIS-14 · PUBLIC 레시피여도 타인은 수정할 수 없다

- **Given** `a`가 소유한 `visibility="PUBLIC"` 레시피가 있고, `a`와 `b`는 상호 팔로우 상태다
- **When** `b`의 토큰으로 `PUT /api/v1/recipes/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`. 레시피의 어떤 컬럼도 변경되지 않는다
- **검증** API 테스트 `RecipeControllerTest`

#### AC-VIS-15 · PUBLIC 레시피여도 타인은 삭제할 수 없다

- **Given** `a`가 소유한 `visibility="PUBLIC"` 레시피가 있고, `a`와 `b`는 상호 팔로우 상태다
- **When** `b`의 토큰으로 `DELETE /api/v1/recipes/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`. `deleted_at`은 `null`로 남는다
- **검증** API 테스트 `RecipeControllerTest`

### 레시피 — 없음 / 미인증

#### AC-VIS-16 · 소프트 삭제된 PUBLIC 레시피는 404다

- **Given** `a`가 소유한 `visibility="PUBLIC"` 레시피의 `deleted_at`이 설정돼 있다
- **When** `b`의 토큰으로 `GET /api/v1/recipes/{id}`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`
- **검증** API 테스트 `RecipeControllerTest`

#### AC-VIS-17 · 토큰 없이 PUBLIC 레시피를 조회하면 401이다

- **Given** `visibility="PUBLIC"`인 레시피가 있다
- **When** `Authorization` 헤더 없이 `GET /api/v1/recipes/{id}`
- **Then** HTTP `401`과 `code: "UNAUTHORIZED"`
- **검증** API 테스트 `RecipeControllerTest`

---

### 브루잉 로그 — visibility 입력

#### AC-VIS-18 · visibility를 생략하면 PRIVATE으로 저장된다

- **Given** 유효한 브루잉 로그 생성 요청에서 `visibility` 필드를 뺐다
- **When** `POST /api/v1/brew-logs`
- **Then** HTTP `201`. 응답과 저장된 행의 `visibility`가 모두 `"PRIVATE"`
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-VIS-19 · visibility에 PUBLIC을 주면 그대로 저장된다

- **Given** 유효한 브루잉 로그 생성 요청의 `visibility`가 `"PUBLIC"`이다
- **When** `POST /api/v1/brew-logs`
- **Then** HTTP `201`. 응답과 저장된 행의 `visibility`가 모두 `"PUBLIC"`
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-VIS-20 · visibility에 FRIENDS를 주면 그대로 저장된다

- **Given** 유효한 브루잉 로그 생성 요청의 `visibility`가 `"FRIENDS"`이다
- **When** `POST /api/v1/brew-logs`
- **Then** HTTP `201`. 응답과 저장된 행의 `visibility`가 모두 `"FRIENDS"`
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-VIS-21 · 허용값 밖의 visibility는 400이다

- **Given** 브루잉 로그 생성 요청의 `visibility`가 `"SECRET"`이다
- **When** `POST /api/v1/brew-logs`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`. `brew_logs`에 행이 생기지 않는다
- **검증** API 테스트 `BrewLogControllerTest`

### 브루잉 로그 조회 인가

#### AC-VIS-22 · 소유자는 PRIVATE 로그를 본다

- **Given** `a`가 소유한 `visibility="PRIVATE"` 브루잉 로그가 있다
- **When** `a`의 토큰으로 `GET /api/v1/brew-logs/{id}`
- **Then** HTTP `200`
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-VIS-23 · 타인의 PRIVATE 로그는 403이다

- **Given** `a`가 소유한 `visibility="PRIVATE"` 브루잉 로그가 있고, `a`와 `b`는 상호 팔로우 상태다
- **When** `b`의 토큰으로 `GET /api/v1/brew-logs/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-VIS-24 · 타인은 PUBLIC 로그를 본다

- **Given** `a`가 소유한 `visibility="PUBLIC"` 브루잉 로그가 있고, `b`는 `a`와 아무 팔로우 관계가 없다
- **When** `b`의 토큰으로 `GET /api/v1/brew-logs/{id}`
- **Then** HTTP `200`. `extractionYieldPercent`·`strengthZone` 등 재계산 필드가 소유자가 조회했을 때와 동일한 값이다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-VIS-25 · 상호 팔로우면 타인이 FRIENDS 로그를 본다

- **Given** `a`가 소유한 `visibility="FRIENDS"` 브루잉 로그가 있고, `follows`에 `a→b`와 `b→a` 두 행이 모두 있다
- **When** `b`의 토큰으로 `GET /api/v1/brew-logs/{id}`
- **Then** HTTP `200`
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-VIS-26 · 단방향 팔로우면 FRIENDS 로그는 403이다

- **Given** `a`가 소유한 `visibility="FRIENDS"` 브루잉 로그가 있고, `follows`에 `b→a` 행만 있다
- **When** `b`의 토큰으로 `GET /api/v1/brew-logs/{id}`
- **Then** HTTP `403`과 `code: "FORBIDDEN"`
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-VIS-27 · PRIVATE 레시피를 참조하는 PUBLIC 로그는 타인에게 200이다

- **Given** `a`가 소유한 `visibility="PRIVATE"` 레시피를 `recipeId`로 참조하는, `a` 소유의 `visibility="PUBLIC"` 브루잉 로그가 있다. `b`는 `a`와 아무 팔로우 관계가 없다
- **When** `b`의 토큰으로 `GET /api/v1/brew-logs/{id}`
- **Then** HTTP `200`. 응답의 `recipeId`는 그 레시피의 id 그대로다. 같은 `b`가 `GET /api/v1/recipes/{그 recipeId}`를 호출하면 `403`을 받는다
- **검증** API 테스트 `BrewLogControllerTest`

#### AC-VIS-28 · 토큰 없이 PUBLIC 로그를 조회하면 401이다

- **Given** `visibility="PUBLIC"`인 브루잉 로그가 있다
- **When** `Authorization` 헤더 없이 `GET /api/v1/brew-logs/{id}`
- **Then** HTTP `401`과 `code: "UNAUTHORIZED"`
- **검증** API 테스트 `BrewLogControllerTest`

---

## 수동 확인

- [ ] `bootRun` + curl로 두 계정을 만들어 서로 팔로우한 뒤, `FRIENDS` 레시피가 상대 계정에서 `200`으로 열리는 것을 확인한다 (`docs/design/2026-08-14-architecture.md:253`의 핵심 시나리오 6단계)
- [ ] 한쪽이 팔로우를 해제한 직후 같은 요청이 `403`으로 바뀌는 것을 확인한다

## 열어둔 결정

- **목록 조회(피드) API** — 정렬 기준, 페이지네이션 방식, `visibility` 필터를 함께 정해야 한다. 이 스펙의 판정 규칙이 구현된 뒤 별도 인터뷰로 다룬다.
- **브루잉 로그의 `visibility` 사후 변경** — `PATCH /brew-logs/{id}`가 필요해지는 시점에 수정 범위(전체 필드인지 `visibility`만인지)와 함께 정한다.
- **팔로워/팔로잉 목록** — 사용자가 3명 이상이 되어 "누구를 팔로우했더라"가 실제 문제가 될 때 다룬다.
- **CURATED 시드 레시피의 투입** — 이 스펙은 `owner_user_id IS NULL` + `PUBLIC` 조합이 조회되는 것까지만 정의한다. 시드 데이터를 실제로 넣는 것은 포크 스펙의 몫이다.
- **계정 연동(account linking)** — 같은 사람이 카카오·구글로 각각 로그인하면 별개 계정이 되어 서로 팔로우해야 하는 상황이 생긴다. 공개 서비스 전환 검토 시 함께 정한다 (`docs/JOURNAL.md` 2026-08-17).

---
id: WEBFOLLOW
title: 초대 링크로 서로 팔로우하기
status: 초안
plan: docs/plans/2026-09-05-plan-web-follow.md
---

# 초대 링크로 서로 팔로우하기 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

**둘이 서로를 팔로우할 수 있게 한다.** 「더보기」에서 자기 초대 링크(`/u/{id}`)를 복사해 상대에게
보내고, 상대가 그 링크를 열면 닉네임과 팔로우 버튼이 있는 프로필 화면이 뜬다. 백엔드에는
`GET /api/v1/users/{id}` 하나만 새로 만든다 — 팔로우 등록·해제·상태 API는 이미 있다.

### 범위 밖 (Non-goals)

- **닉네임 검색.** 사람을 이름으로 찾지 않는다. 2인 서비스에서 계정을 열거할 수 있게 만드는 것이
  얻는 것보다 크다. 사람이 늘면 그때 별도 스펙으로 연다.
- **팔로워/팔로잉 목록.** `visibility-authorization`이 「사용자가 3명 이상이 되어 '누구를
  팔로우했더라'가 실제 문제가 될 때」로 미뤄둔 것이다. 2인이면 그 조건이 아직 아니다.
- **프로필에 그 사람의 레시피 목록을 그리지 않는다.** 상호 팔로우가 성립하면 그 사람의 `FRIENDS`
  레시피는 **이미 `/recipes` 목록에 섞여 나온다**(`list-query-api.md:126`). 같은 것을 두 곳에서
  그리지 않는다.
- **피드·알림·차단·프로필 편집.** 전부 「모르는 사람이 가입한다」가 전제인 기능이다.
- **팔로우 API를 고치지 않는다.** `FollowController`의 셋은 그대로 쓴다.

## 왜

**`FRIENDS` 공개범위가 운영에서 도달 불가능하다.** 백엔드는 상호 팔로우를 판정하고
(`FollowService.isMutual`), 목록도 그 판정을 태우고 있는데, **상호 팔로우 상태를 만들 경로가
화면에도 API에도 없다.** 팔로우 API는 숫자 `userId`를 받는데 **사용자를 찾는 API가 없어서**
그 숫자를 알아낼 방법이 없다.

지금까지 `FRIENDS`를 확인한 방법은 전부 `follows` 테이블에 직접 `INSERT`하는 것이었다
(`docs/JOURNAL.md` 2026-09-05). 운영에서는 그 수단이 없다 — SSH 키가 GitHub Secrets에만 있다.

**이 서비스의 성공 기준은 「우리 둘이 실제로 매일 쓴다」**(`docs/design/2026-08-14-architecture.md:11`)
인데, **둘이 서로의 기록을 볼 수 없다.** 레시피를 나누는 것이 포크 기능의 전제인데 그 앞단이 막혀 있다.

## 용어

| 용어 | 정의 |
|---|---|
| 초대 링크 | `<origin>/u/{id}`. 내 프로필 화면의 주소이자 상대가 나를 팔로우하는 입구 |
| 맞팔로우 | 서로 팔로우한 상태. `FollowStatusResponse.mutual`이 `true`이며 `FRIENDS` 공개범위 판정과 같은 값 |
| 공개 프로필 | `GET /api/v1/users/{id}`가 주는 것. **내 프로필(`/me`)과 달리 `email`·`role`을 담지 않는다** |

## 데이터

**스키마 변경 없음.** `follows` 테이블(V1)과 `users`가 이미 있다. 마이그레이션을 추가하지 않는다.

## API

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| `GET` | `/api/v1/users/{id}` | 필요 | **신규.** 공개 프로필 |
| `POST` | `/api/v1/users/{id}/follow` | 필요 | 기존 — 멱등, 204 |
| `DELETE` | `/api/v1/users/{id}/follow` | 필요 | 기존 — 멱등, 204 |
| `GET` | `/api/v1/users/{id}/follow` | 필요 | 기존 — `{following, followedBy, mutual}` |

### 요청 / 응답 예시

```
GET /api/v1/users/12
```

```json
{
  "id": 12,
  "nickname": "확인용친구",
  "profileImageUrl": "https://k.kakaocdn.net/dn/xxxx/profile.jpg"
}
```

`profileImageUrl`은 null일 수 있다 — 카카오 프로필 사진은 선택이다. `non_null` 직렬화라 null이면
키가 통째로 빠진다(`MeResponse`와 같은 방식).

**`email`·`role`·`createdAt`을 담지 않는다.** `MeResponse`를 재사용하고 싶어질 수 있으나 그것은
`email`과 `role`을 갖고 있다. 별도 DTO를 만든다.

### 자기 자신을 대상으로 했을 때

| API | 자기 자신 | 이유 |
|---|---|---|
| `GET /users/{id}` | **200** | 프로필을 보는 것뿐이다. 막을 이유가 없다 |
| `GET /users/{id}/follow` | **400** (기존) | `FollowService.validateTarget`이 이미 그렇다. **고치지 않는다** |

**그래서 화면은 내 id일 때 상태 조회를 아예 부르지 않는다.** 내 초대 링크가 제대로 됐는지 눌러
확인하는 것은 흔한 행동이고, 그때 에러 화면이 뜨면 안 된다.

### 화면

| 경로 | 무엇 |
|---|---|
| `/u/{id}` | 프로필. 닉네임·사진·팔로우 버튼 |
| `/more` | **수정.** `내 초대 링크` 줄과 `복사` 버튼을 더한다 |

### 문구

| 관계 | 버튼 | 안내 문구 |
|---|---|---|
| 아무 관계 없음 | `팔로우` | (없음) |
| 나만 팔로우 중 | `팔로우 취소` | `상대도 나를 팔로우하면 서로의 기록이 보입니다` |
| 상대만 나를 팔로우 | `팔로우` | `나를 팔로우하고 있습니다` |
| 맞팔로우 | `팔로우 취소` | `맞팔로우 — 서로의 기록이 보입니다` |
| 내 프로필 | (버튼 없음) | `나` |

「더보기」의 복사 버튼은 누르면 `복사했습니다`로 바뀐다.

---

## 어떻게 동작 — 인수 조건

### 정상 동작 — 공개 프로필 API

#### AC-WEBFOLLOW-01 · 공개 프로필을 준다

- **Given** id `12`, 닉네임 `확인용친구`인 사용자가 있고 요청자가 인증돼 있다
- **When** `GET /api/v1/users/12`
- **Then** HTTP `200`과 `{"id":12,"nickname":"확인용친구"}`를 반환한다
- **검증** API 테스트 `UserControllerTest`

#### AC-WEBFOLLOW-02 · 이메일과 역할을 내보내지 않는다

- **Given** id `12` 사용자의 `email`이 `friend@example.com`이고 `role`이 `USER`다
- **When** `GET /api/v1/users/12`
- **Then** 응답 본문에 `email`·`role`·`createdAt` 키가 **하나도 없다**
- **검증** API 테스트 `UserControllerTest`

#### AC-WEBFOLLOW-03 · 자기 자신도 200이다

- **Given** id `11`로 인증돼 있다
- **When** `GET /api/v1/users/11`
- **Then** HTTP `200`과 `id: 11`을 반환한다 (`400`이 아니다)
- **검증** API 테스트 `UserControllerTest`

### 정상 동작 — 「더보기」의 초대 링크

#### AC-WEBFOLLOW-04 · 내 초대 링크가 보인다

- **Given** id `11`로 로그인해 `/more`를 연다
- **When** 화면이 그려진다
- **Then** `내 초대 링크`와 `복사` 버튼이 화면에 있다
- **검증** 화면 테스트 `app/more/page.test.tsx`

#### AC-WEBFOLLOW-05 · 복사하면 링크가 클립보드에 들어간다

- **Given** id `11`로 로그인해 `/more`를 열었다
- **When** `복사`를 누른다
- **Then** 클립보드 값이 `<origin>/u/11`이고 버튼 자리에 `복사했습니다`가 나타난다
- **검증** 화면 테스트 `app/more/page.test.tsx`

### 정상 동작 — 프로필 화면의 네 가지 관계

#### AC-WEBFOLLOW-06 · 아무 관계도 없으면 팔로우 버튼만 있다

- **Given** `GET /users/12/follow`가 `{following:false, followedBy:false, mutual:false}`를 준다
- **When** `/u/12`를 연다
- **Then** 버튼 `팔로우`가 있고, `나를 팔로우하고 있습니다`·`맞팔로우 — 서로의 기록이 보입니다`·`상대도 나를 팔로우하면 서로의 기록이 보입니다`가 **모두 없다**
- **검증** 화면 테스트 `app/u/[id]/page.test.tsx`

#### AC-WEBFOLLOW-07 · 나만 팔로우 중이면 기다리는 중임을 알린다

- **Given** `{following:true, followedBy:false, mutual:false}`
- **When** `/u/12`를 연다
- **Then** 버튼 `팔로우 취소`와 `상대도 나를 팔로우하면 서로의 기록이 보입니다`가 화면에 있다
- **검증** 화면 테스트 `app/u/[id]/page.test.tsx`

#### AC-WEBFOLLOW-08 · 상대만 나를 팔로우하면 그렇게 말한다

- **Given** `{following:false, followedBy:true, mutual:false}`
- **When** `/u/12`를 연다
- **Then** 버튼 `팔로우`와 `나를 팔로우하고 있습니다`가 화면에 있다
- **검증** 화면 테스트 `app/u/[id]/page.test.tsx`

#### AC-WEBFOLLOW-09 · 맞팔로우면 서로 보인다고 말한다

- **Given** `{following:true, followedBy:true, mutual:true}`
- **When** `/u/12`를 연다
- **Then** 버튼 `팔로우 취소`와 `맞팔로우 — 서로의 기록이 보입니다`가 화면에 있다
- **검증** 화면 테스트 `app/u/[id]/page.test.tsx`

#### AC-WEBFOLLOW-10 · 내 프로필에는 버튼이 없다

- **Given** id `11`로 로그인해 있다
- **When** `/u/11`을 연다
- **Then** `나`가 화면에 있고, `팔로우`·`팔로우 취소` 버튼이 **없으며**, `GET /users/11/follow` 요청이 **0건**이다
- **검증** 화면 테스트 `app/u/[id]/page.test.tsx`

### 정상 동작 — 버튼

#### AC-WEBFOLLOW-11 · 팔로우하면 버튼이 바뀐다

- **Given** `/u/12`가 `{following:false, followedBy:false, mutual:false}`로 그려져 있다
- **When** `팔로우`를 누르고, `POST /users/12/follow`가 `204`를 반환한 뒤 상태 조회가 `{following:true, followedBy:false, mutual:false}`를 준다
- **Then** `POST /api/v1/users/12/follow`가 **1번** 호출되고, 버튼이 `팔로우 취소`가 된다
- **검증** 화면 테스트 `app/u/[id]/page.test.tsx`

#### AC-WEBFOLLOW-12 · 응답 전에는 버튼을 누를 수 없다

- **Given** `/u/12`가 그려져 있고 `POST /users/12/follow`가 아직 응답하지 않았다
- **When** `팔로우`를 누른다
- **Then** 그 버튼이 `disabled`다
- **검증** 화면 테스트 `app/u/[id]/page.test.tsx`

#### AC-WEBFOLLOW-13 · 팔로우를 취소하면 버튼이 되돌아온다

- **Given** `/u/12`가 `{following:true, followedBy:false, mutual:false}`로 그려져 있다
- **When** `팔로우 취소`를 누르고 `DELETE`가 `204`를 반환한 뒤 상태 조회가 `{following:false, followedBy:false, mutual:false}`를 준다
- **Then** `DELETE /api/v1/users/12/follow`가 **1번** 호출되고, 버튼이 `팔로우`가 된다
- **검증** 화면 테스트 `app/u/[id]/page.test.tsx`

### 경계값

#### AC-WEBFOLLOW-14 · 맞팔로우가 깨지면 문구가 즉시 내려간다

- **Given** `/u/12`가 `{following:true, followedBy:true, mutual:true}`로 그려져 `맞팔로우 — 서로의 기록이 보입니다`가 있다
- **When** `팔로우 취소`를 누르고 상태 조회가 `{following:false, followedBy:true, mutual:false}`를 준다
- **Then** `맞팔로우 — 서로의 기록이 보입니다`가 **없고** `나를 팔로우하고 있습니다`가 있다
- **검증** 화면 테스트 `app/u/[id]/page.test.tsx`

### 에러

#### AC-WEBFOLLOW-15 · 없는 사용자는 404다

- **Given** id `999` 사용자가 없다
- **When** `GET /api/v1/users/999`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **검증** API 테스트 `UserControllerTest`

#### AC-WEBFOLLOW-16 · 인증 없이 부르면 401이다

- **Given** `Authorization` 헤더가 없다
- **When** `GET /api/v1/users/12`
- **Then** HTTP `401`을 반환한다
- **검증** API 테스트 `UserControllerTest`

#### AC-WEBFOLLOW-17 · 없는 사용자의 프로필 화면

- **Given** `GET /users/999`가 `404`와 `{code:"NOT_FOUND"}`를 반환한다
- **When** `/u/999`를 연다
- **Then** `사용자를 찾을 수 없습니다`가 화면에 있고 `팔로우` 버튼이 없다
- **검증** 화면 테스트 `app/u/[id]/page.test.tsx`

#### AC-WEBFOLLOW-18 · 로그인하지 않고 초대 링크를 열면 로그인으로 보낸다

- **Given** 세션이 없고 `/api/auth/refresh`가 `401`을 반환한다
- **When** `/u/12`를 연다
- **Then** 경로가 `/login?next=%2Fu%2F12`가 된다
- **검증** 화면 테스트 `app/u/[id]/page.test.tsx`

#### AC-WEBFOLLOW-19 · 팔로우가 실패하면 다시 누를 수 있다

- **Given** `/u/12`가 그려져 있고 `POST /users/12/follow`가 `500`을 반환한다
- **When** `팔로우`를 누른다
- **Then** 버튼이 `disabled`가 **아니고**, 문구가 `팔로우 취소`로 바뀌지 **않았으며**, 오류 안내가 화면에 있다
- **검증** 화면 테스트 `app/u/[id]/page.test.tsx`

---

## 수동 확인

- [ ] ★ **운영에서 둘이 실제로 맞팔로우가 된다.** 한쪽이 「더보기」에서 링크를 복사해 카톡으로 보내고, 상대가 열어 팔로우한 뒤, 반대로도 한다. **이 스펙이 존재하는 이유이고 자동 테스트는 실계정 둘을 만들 수 없다**
- [ ] ★ 맞팔로우가 된 뒤 상대의 `FRIENDS` 레시피가 내 `/recipes` 목록에 실제로 나타난다
- [ ] 폰에서 「복사」가 실제로 클립보드에 들어가고 카톡에 붙여넣어진다 (iOS 사파리는 클립보드 권한이 다르다)

## 열어둔 결정

- **닉네임 검색.** 사용자가 3명을 넘어 「링크를 어디 뒀더라」가 실제 문제가 될 때 연다.
- **팔로워/팔로잉 목록.** 위와 같은 시점에 함께 정한다. 그때 `GET /users/me`에 팔로워·팔로잉 수를
  넣을지도 같이 본다(`list-query-api.md`의 열어둔 결정).
- **프로필 사진이 깨졌을 때.** 카카오 CDN URL은 만료될 수 있다. 지금은 `<img>`가 깨진 채로 둔다.
  실제로 깨지는 것을 보면 그때 대체 이미지를 정한다.
- **초대 링크에 토큰을 붙일지.** 지금 `/u/12`는 id를 바꿔 가며 남의 프로필을 열어볼 수 있다.
  닉네임과 사진만 나오고 2인 서비스라 실익이 없어 두지만, 사람이 늘면 다시 본다.

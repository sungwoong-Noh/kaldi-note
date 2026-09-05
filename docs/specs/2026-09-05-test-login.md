---
id: TESTLOGIN
title: 테스트 로그인 (OAuth 없이 세션 발급)
status: 초안
plan: docs/plans/2026-09-05-plan-test-login.md
---

# 테스트 로그인 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

---

> ## ⚠ 이 스펙은 인증 우회를 만든다
>
> `POST /api/v1/auth/login/test`는 **OAuth를 거치지 않고 세션을 발급한다.** 그리고 사람의 결정으로
> **임의의 `userId`를 대상으로 삼을 수 있다**(2026-09-05 대화).
>
> **그래서 `KALDI_TEST_LOGIN_SECRET`이 유출되면 운영의 모든 계정 — 실제 카카오·구글 계정을 포함해 —
> 으로 로그인할 수 있다.** 공개범위·소유자 인가가 전부 무의미해진다.
>
> **만료도 두지 않기로 했다.** `.env`에서 그 줄을 지울 때까지 유효하다.
>
> 이 두 가지는 대안(구글 로그인 버튼 추가, 카카오 계정 생성)을 제시한 뒤 **사람이 명시적으로 고른 것**이다.
> 나중에 「왜 이렇게 위험한 걸 만들었나」가 나오면 이 문단을 먼저 본다.
>
> **그리고 「role은 언제나 USER」는 반쪽짜리다.** `AuthService.refresh`가 역할을 DB에서 다시 읽으므로
> (`issueTokens(user)` → `user.getRole()`), 이 제한은 **로그인 응답의 첫 access token에만** 걸린다.
> 그 토큰으로 한 번 갱신하면 대상 사용자의 진짜 역할이 실린다. 지금은 `ADMIN` 사용자도 관리자
> 화면도 없어 실제 영향이 없지만, **이 제한을 보안 경계로 삼으면 안 된다.**

---

## 무엇을

**OAuth 계정 없이 운영에서 로그인할 수 있게 한다.** 백엔드에 `POST /api/v1/auth/login/test`를 만들고,
프론트에 `/login/test` 화면을 둔다. 시크릿은 **사람이 그 화면에서 입력한다** — 프론트 번들이나
Worker 환경변수에 넣지 않는다.

두 가지로 부른다.

- `{"userId": 12}` — **이미 있는 사용자로** 로그인한다
- `{"handle": "friend", "nickname": "확인용친구"}` — `provider=TEST` 계정을 **없으면 만들고 있으면 재사용**한다

### 범위 밖 (Non-goals)

- **자동 만료.** 날짜를 박아 스스로 꺼지게 하지 않는다(사람 결정). 끄려면 `.env`에서 지운다.
- **요청 수 제한.** 무차별 대입 방어를 넣지 않는다. 시크릿 길이(32자 이상)로만 막는다.
- **`ADMIN` 역할 발급.** 대상이 `ADMIN`이어도 발급 토큰의 role은 언제나 `USER`다.
- **`scripts/open-as.mjs` 대체.** 로컬은 그대로 그것을 쓴다 — 로컬은 이 기능이 없어도 이미 된다.
- **테스트 계정 정리 API.** 만든 `TEST` 계정을 지우는 경로는 만들지 않는다. `psql`로 지운다.

## 왜

**운영에서 로그인할 수단이 없다.** 서비스는 카카오·구글 OAuth만 받는데 **사람에게 카카오 계정이
없고**, 프론트 로그인 화면에는 구글 버튼이 아직 없다(백엔드 `GoogleOAuthClient`는 완성돼 있다).

그래서 **운영에 계정이 몇 개인지조차 모른다.** 실계정 로그인은 `oci-deploy` 스펙의 차단형 수동
확인으로 남아 있고, 배포 이후 한 번도 검증된 적이 없다.

그리고 이것이 다음 두 가지를 막고 있다.

- **팔로우 기능을 운영에서 검증할 수 없다**(`2026-09-05-web-follow.md`의 차단형 수동 확인 둘).
  맞팔로우에는 계정이 둘 필요한데 하나도 없다.
- **사진 업로드 OCI 실연동**(`media-attachment.md`의 차단형)도 로그인이 있어야 밟는다.

## 용어

| 용어 | 정의 |
|---|---|
| 테스트 시크릿 | `KALDI_TEST_LOGIN_SECRET`. **32자 이상**이어야 기능이 켜진다 |
| 기능이 꺼져 있다 | 시크릿이 없거나 32자 미만인 상태. 이때 경로는 **없는 것처럼 행동한다** |
| `TEST` 계정 | `user_oauth_accounts.provider = 'TEST'`인 계정. 카카오·구글 계정과 섞이지 않는다 |

## 데이터

**마이그레이션 없음.** `user_oauth_accounts.provider`는 `varchar(20)`이고 CHECK 제약이 없어
`'TEST'`가 그대로 들어간다. `UNIQUE(provider, provider_user_id)`가 **`TEST` 계정과 실제 계정의
충돌을 구조적으로 막는다.**

| 대상 | 변경 |
|---|---|
| `OAuthProvider` enum | `TEST` 추가 (`KAKAO`, `GOOGLE`, **`TEST`**) |

> `OAuthProvider`에 `TEST`를 더하면 `POST /api/v1/auth/login/test`가 **기존 OAuth 경로로도** 들어올 수
> 있게 된다(`AuthController.toProvider`가 `valueOf`를 쓴다). **그 경로는 막아야 한다** — `TEST`는
> `OAuthClientRegistry`에 클라이언트가 없어 지금은 예외가 나겠지만, 그것을 우연에 맡기지 않는다.
> AC-TESTLOGIN-17이 이것을 잡는다.

## API

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| `POST` | `/api/v1/auth/login/test` | 헤더 시크릿 | **신규.** OAuth 없이 세션 발급 |
| `POST` | `/api/auth/test-login` (BFF) | 헤더 시크릿 통과 | **신규.** 위를 부르고 refresh 쿠키를 심는다 |

### 요청

```
POST /api/v1/auth/login/test
X-Test-Login-Secret: <32자 이상>
Content-Type: application/json

{ "userId": 12 }
```

또는

```json
{ "handle": "friend", "nickname": "확인용친구" }
```

**`userId`와 `handle`은 정확히 하나만 준다.** 둘 다 주거나 둘 다 없으면 `400 INVALID_REQUEST`다.

### 응답

기존 `POST /api/v1/auth/login/{provider}`와 **같은 모양이다**(`LoginResponse`).

```json
{
  "tokens": { "accessToken": "...", "refreshToken": "...", "expiresInSeconds": 1800 },
  "userId": 12,
  "nickname": "확인용친구",
  "newUser": false
}
```

### 기능이 꺼져 있거나 시크릿이 틀렸을 때

**없는 경로와 구별되지 않아야 한다.** 셋 다 같은 응답이다.

```json
{ "code": "ENDPOINT_NOT_FOUND", "message": "요청하신 주소를 찾을 수 없습니다.", "fieldErrors": [] }
```

| 상황 | 응답 |
|---|---|
| 시크릿 미설정 | `404` · `ENDPOINT_NOT_FOUND` |
| 시크릿이 32자 미만 | `404` · `ENDPOINT_NOT_FOUND` |
| 헤더 없음 | `404` · `ENDPOINT_NOT_FOUND` |
| 헤더 값이 틀림 | `404` · `ENDPOINT_NOT_FOUND` (**`401`이 아니다**) |

**비교는 상수 시간으로 한다**(`MessageDigest.isEqual`). 문자열 `equals`는 앞자리부터 달라지는
시점에 따라 시간이 달라져 시크릿을 한 글자씩 알아낼 수 있다.

### 화면

`/login/test` — 입력칸 넷과 버튼 하나.

| 자리 | 라벨 |
|---|---|
| 시크릿 | `테스트 시크릿` |
| 사용자 id | `사용자 id` |
| 핸들 | `핸들` |
| 닉네임 | `닉네임` |
| 버튼 | `테스트 로그인` |
| 실패 문구 | `테스트 로그인을 쓸 수 없습니다` |

**시크릿은 프론트 어디에도 저장하지 않는다.** 입력값을 BFF로 넘기고, BFF가 백엔드 헤더로 전달한다.
`NEXT_PUBLIC_` 환경변수를 만들지 않는다 — 그것은 번들에 박혀 누구나 읽을 수 있다.

---

## 어떻게 동작 — 인수 조건

### 정상 동작

#### AC-TESTLOGIN-01 · userId로 로그인한다

- **Given** 시크릿이 `0123456789abcdef0123456789abcdef`(32자)로 설정돼 있고, id `12` 사용자가 있다
- **When** 그 시크릿 헤더와 `{"userId":12}`로 `POST /api/v1/auth/login/test`
- **Then** HTTP `200`, `userId`가 `12`, `newUser`가 `false`, `tokens.accessToken`과 `tokens.refreshToken`이 비어 있지 않다
- **검증** API 테스트 `AuthControllerTest`

#### AC-TESTLOGIN-02 · handle로 처음 부르면 계정이 생긴다

- **Given** 시크릿이 설정돼 있고 `provider='TEST'`이며 `provider_user_id='friend'`인 행이 없다
- **When** `{"handle":"friend","nickname":"확인용친구"}`로 호출한다
- **Then** HTTP `200`, `newUser`가 `true`, `nickname`이 `확인용친구`이고, `user_oauth_accounts`에 `(provider='TEST', provider_user_id='friend')` 행이 **1개** 생긴다
- **검증** API 테스트 `AuthControllerTest`

#### AC-TESTLOGIN-03 · 같은 handle을 다시 부르면 재사용한다

- **Given** `handle`이 `friend`인 `TEST` 계정이 이미 있고 그 `userId`가 `N`이다
- **When** 같은 `{"handle":"friend","nickname":"다른이름"}`으로 다시 호출한다
- **Then** `userId`가 `N`으로 같고 `newUser`가 `false`이며, `users` 행 수가 늘지 않는다
- **검증** API 테스트 `AuthControllerTest`

#### AC-TESTLOGIN-04 · 대상이 ADMIN이어도 로그인 응답 토큰은 USER다

**이 조건이 보장하는 범위는 로그인 응답의 첫 토큰뿐이다.** 갱신 뒤에는 진짜 역할이 실린다(AC-TESTLOGIN-05).

- **Given** id `12` 사용자의 `role`이 `ADMIN`이다
- **When** `{"userId":12}`로 호출한다
- **Then** 응답 `accessToken`을 디코딩한 `role` claim이 `USER`다
- **검증** API 테스트 `AuthControllerTest`

#### AC-TESTLOGIN-05 · 갱신하면 진짜 역할로 돌아온다 (알려진 한계)

**이 조건은 결함을 고치는 것이 아니라 못박는 것이다.** 다음 사람이 「테스트 로그인은 ADMIN이 될 수
없다」고 잘못 가정하는 것을 막는다.

- **Given** id `12` 사용자의 `role`이 `ADMIN`이고, 테스트 로그인으로 받은 `refreshToken`이 있다
- **When** 그 값으로 `POST /api/v1/auth/refresh`를 부른다
- **Then** 새 `accessToken`의 `role` claim이 `ADMIN`이다
- **검증** API 테스트 `AuthControllerTest`

#### AC-TESTLOGIN-06 · 발급된 refresh 토큰이 실제로 동작한다

- **Given** `{"userId":12}`로 로그인해 `refreshToken`을 받았다
- **When** 그 값으로 `POST /api/v1/auth/refresh`를 부른다
- **Then** HTTP `200`과 새 `accessToken`을 받는다
- **검증** API 테스트 `AuthControllerTest`

### 경계값 — 시크릿 길이

#### AC-TESTLOGIN-07 · 정확히 32자면 켜진다

- **Given** 시크릿이 `0123456789abcdef0123456789abcdef`(**32자**)다
- **When** 그 값을 헤더로 `{"userId":12}`를 호출한다
- **Then** HTTP `200`이다
- **검증** API 테스트 `AuthControllerTest`

#### AC-TESTLOGIN-08 · 31자면 켜지지 않는다

- **Given** 시크릿이 `0123456789abcdef0123456789abcde`(**31자**)다
- **When** 그 값을 헤더로 `{"userId":12}`를 호출한다
- **Then** HTTP `404`와 `code: "ENDPOINT_NOT_FOUND"`를 반환한다
- **검증** API 테스트 `AuthControllerTest`

### 에러 — 잠금

#### AC-TESTLOGIN-09 · 시크릿이 설정돼 있지 않으면 없는 경로다

- **Given** `KALDI_TEST_LOGIN_SECRET`이 설정돼 있지 않다
- **When** 아무 헤더로나 `{"userId":12}`를 호출한다
- **Then** HTTP `404`와 `{"code":"ENDPOINT_NOT_FOUND","message":"요청하신 주소를 찾을 수 없습니다.","fieldErrors":[]}`를 반환한다
- **검증** API 테스트 `AuthControllerTest`

#### AC-TESTLOGIN-10 · 헤더가 없으면 404다

- **Given** 시크릿이 32자로 설정돼 있다
- **When** `X-Test-Login-Secret` 헤더 없이 `{"userId":12}`를 호출한다
- **Then** HTTP `404`와 `code: "ENDPOINT_NOT_FOUND"`를 반환한다
- **검증** API 테스트 `AuthControllerTest`

#### AC-TESTLOGIN-11 · 헤더가 틀리면 401이 아니라 404다

- **Given** 시크릿이 `0123456789abcdef0123456789abcdef`다
- **When** 헤더 값 `wrongwrongwrongwrongwrongwrongwr`(32자)로 호출한다
- **Then** HTTP `404`와 `code: "ENDPOINT_NOT_FOUND"`를 반환한다 (`401`이 아니다)
- **검증** API 테스트 `AuthControllerTest`

### 에러 — 요청 형태

#### AC-TESTLOGIN-12 · userId와 handle을 둘 다 주면 400이다

- **Given** 시크릿이 설정돼 있다
- **When** `{"userId":12,"handle":"friend"}`로 호출한다
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `AuthControllerTest`

#### AC-TESTLOGIN-13 · 둘 다 없으면 400이다

- **Given** 시크릿이 설정돼 있다
- **When** `{}`로 호출한다
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `AuthControllerTest`

#### AC-TESTLOGIN-14 · 없는 userId면 404 NOT_FOUND다

- **Given** 시크릿이 설정돼 있고 id `999999` 사용자가 없다
- **When** `{"userId":999999}`로 호출한다
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다 (`ENDPOINT_NOT_FOUND`가 아니다)
- **검증** API 테스트 `AuthControllerTest`

### 흔적과 회귀

#### AC-TESTLOGIN-15 · 쓰면 WARN 로그가 남는다

- **Given** 시크릿이 설정돼 있다
- **When** `{"userId":12}`로 로그인에 성공한다
- **Then** `AuthService` 로거에 레벨 `WARN`인 기록이 1건 있고 그 메시지에 `12`가 들어 있다
- **검증** API 테스트 `AuthControllerTest` (logback `ListAppender`)

#### AC-TESTLOGIN-16 · 기존 OAuth 로그인이 그대로다

- **Given** 시크릿이 설정돼 있다
- **When** `POST /api/v1/auth/login/kakao`를 기존 테스트와 같은 방식으로 호출한다
- **Then** 기존 `AC-AUTH-*` 테스트가 전부 초록이다
- **검증** API 테스트 `AuthControllerTest` (기존 테스트 재실행)

#### AC-TESTLOGIN-17 · `/login/test`는 언제나 테스트 핸들러가 받는다

`OAuthProvider`에 `TEST`를 더하는 순간 `/api/v1/auth/login/test`는 **두 매핑의 후보가 된다** —
리터럴 `/login/test`와 템플릿 `/login/{provider}`다. 스프링은 리터럴을 먼저 고르지만, **그것을
우연에 맡기지 않고 조건으로 못박는다.** 템플릿이 이기면 `toProvider("test")`가 `TEST`를 만들어
`OAuthClientRegistry`에서 클라이언트를 찾다 실패하고, **404가 아닌 다른 응답**이 나간다.

- **Given** 시크릿이 설정돼 있지 **않다**
- **When** OAuth 로그인 본문 모양(`{"code":"anything"}`)으로 `POST /api/v1/auth/login/test`를 호출한다
- **Then** HTTP `404`와 `code: "ENDPOINT_NOT_FOUND"`를 반환한다 — 다른 어떤 code도 아니다
- **검증** API 테스트 `AuthControllerTest`

> 실패하면 **구현이 아니라 매핑을 고친다.** `toProvider`가 `TEST`를 명시적으로 거부하게 만든다.

### 화면

#### AC-TESTLOGIN-18 · 입력칸과 버튼이 있다

- **Given** `/login/test`를 연다
- **When** 화면이 그려진다
- **Then** `테스트 시크릿`·`사용자 id`·`핸들`·`닉네임` 입력칸과 `테스트 로그인` 버튼이 있다
- **검증** 화면 테스트 `app/login/test/page.test.tsx`

#### AC-TESTLOGIN-19 · 제출하면 시크릿이 헤더로 넘어간다

- **Given** `/login/test`에서 시크릿 `0123456789abcdef0123456789abcdef`와 사용자 id `12`를 채웠다
- **When** `테스트 로그인`을 누른다
- **Then** BFF가 백엔드에 보낸 요청의 `X-Test-Login-Secret` 헤더가 `0123456789abcdef0123456789abcdef`이고, 본문이 `{"userId":12}`다
- **검증** 라우트 테스트 `app/api/auth/test-login/route.test.ts`

#### AC-TESTLOGIN-20 · 성공하면 쿠키가 심기고 홈으로 간다

- **Given** 백엔드가 `200`과 토큰쌍을 반환한다
- **When** `테스트 로그인`을 누른다
- **Then** 응답의 `Set-Cookie`에 `kaldi_refresh`가 `HttpOnly`로 있고, 화면의 경로가 `/`가 된다
- **검증** 라우트 테스트 `route.test.ts` + 화면 테스트 `page.test.tsx`

#### AC-TESTLOGIN-21 · 실패하면 쿠키를 심지 않는다

- **Given** 백엔드가 `404`와 `code: "ENDPOINT_NOT_FOUND"`를 반환한다
- **When** `테스트 로그인`을 누른다
- **Then** 화면에 `테스트 로그인을 쓸 수 없습니다`가 있고, 응답에 `Set-Cookie`가 **없다**
- **검증** 라우트 테스트 `route.test.ts` + 화면 테스트 `page.test.tsx`

#### AC-TESTLOGIN-22 · 시크릿이 프론트에 박히지 않는다

- **Given** `frontend/` 전체
- **When** `NEXT_PUBLIC_TEST_LOGIN`·`NEXT_PUBLIC_.*SECRET`을 검색한다
- **Then** `src/`·`.env.example`·`wrangler.jsonc` 어디에도 **0건**이다
- **검증** 단위 테스트 `test/no-public-secret.test.ts`

---

## 수동 확인

- [ ] ★ **운영 `.env`에 `KALDI_TEST_LOGIN_SECRET`을 32자 이상으로 채우고 배포한다.** 값은 비밀번호 관리자에 둔다 — 이 값이 곧 모든 계정의 열쇠다
- [ ] ★ 폰에서 `https://kaldi-note.today/login/test`로 실제 로그인이 되고, 「더보기」에 닉네임이 뜬다
- [ ] ★ 계정 둘을 만들어(`handle`을 둘로) 서로 팔로우해 맞팔로우가 된다 — `web-follow` 스펙의 차단형 확인이 이걸로 풀린다
- [ ] 시크릿을 틀리게 넣으면 `테스트 로그인을 쓸 수 없습니다`가 뜬다
- [ ] **다 쓰고 나면 `.env`에서 그 줄을 지울지 판단한다.** 만료가 없으므로 지우는 것 말고 꺼지는 방법이 없다

## 열어둔 결정

- **언제 이 기능을 없앨지.** 만료를 두지 않기로 했으므로 사람이 판단한다. **구글 로그인 버튼이 생기면
  이 기능의 존재 이유가 대부분 사라진다** — 그때 다시 본다.
- **구글 로그인 버튼.** 백엔드는 이미 완성이고 프론트에 `google.ts`·버튼·`NEXT_PUBLIC_GOOGLE_*`만 없다.
  이번엔 범위 밖이지만, 이 기능보다 훨씬 안전한 길이다.
- **요청 수 제한.** 시크릿 무차별 대입을 막지 않는다. 32자 이상이라 현실적으로 어렵다는 판단이지만,
  운영 로그에 404가 쌓이는 것이 보이면 그때 다시 본다.
- **`TEST` 계정 정리.** 만든 계정을 지우는 경로가 없다. 쌓이면 `psql`로 지운다.

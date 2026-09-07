---
id: GOOGLE
title: 구글 로그인 버튼
status: 구현완료
plan: docs/plans/2026-09-07-plan-google-login.md
---

# 구글 로그인 버튼 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

**프론트에 구글 OAuth 진입점을 만든다.** 로그인 화면에 「구글로 로그인」을 더하고, 구글이 되돌려
보내는 `/auth/callback/google`을 새로 만들어 BFF에 `provider: "google"`로 넘긴다.

**백엔드는 이미 완성돼 있다.** `GoogleOAuthClient`가 토큰 교환과 `userinfo` 조회를 하고,
`application.yml`에 `oauth.google` 블록이 있으며, BFF `/api/auth/login`은 **이미**
`provider: "kakao" | "google"`을 받는다. 이 스펙이 더하는 백엔드 변경은 **설정 기본값 한 줄**뿐이다.

### 범위 밖 (Non-goals)

- **테스트 로그인 제거.** 이 기능의 목적은 `test-login`의 존재 이유를 없애는 것이지만, **끄는 것은
  이번에 하지 않는다.** 구글이 운영에서 실제로 되는 것을 본 뒤에 끄는 것이 안전하다. 끄는 방법은
  `2026-09-05-test-login.md`의 수동 확인에 있다(`.env`에서 그 줄을 지우고 재기동).
- **계정 병합.** 카카오로 가입한 사람이 **같은 이메일의** 구글 계정으로 로그인하면 **별개 계정이
  생긴다.** `user_oauth_accounts`의 `UNIQUE(provider, provider_user_id)`가 그렇게 동작한다.
  묶으려면 이메일 소유 검증을 믿는 설계가 되는데, **카카오 이메일은 null일 수 있어** 병합 키로
  쓰기에 불안하다. 2인 서비스라 실익도 없다.
- **백엔드 인증 로직 변경.** `AuthService`·`AuthController`·`GoogleOAuthClient`를 고치지 않는다.
  바뀌는 것은 `application.yml`의 `oauth.google.redirect-uri` 기본값 한 줄이다.
- **구글 계정으로 이미 만들어진 `TEST` 계정 정리.** 확인용 계정(id 3·4·5)은 그대로 둔다.

## 왜

**운영에 살아 있는 인증 우회를 끌 수 있게 된다.** `KALDI_TEST_LOGIN_SECRET`은 지금 운영 `.env`에
들어 있고, **그 값이 유출되면 실제 카카오 계정을 포함한 모든 계정으로 로그인할 수 있다**
(`2026-09-05-test-login.md`의 경고 상자). 그 기능이 존재하는 이유는 「사람에게 카카오 계정이 없고
프론트에 구글 버튼이 없다」였다. 구글 버튼이 생기면 이유의 절반이 사라진다.

**구글 경로는 한 번도 확인된 적이 없다.** `GoogleOAuthClient`는 2026-08 초에 만들어졌지만
`oci-deploy`의 「카카오/구글 실계정 로그인」 상자의 근거는 **카카오뿐이다**(`infra/README.md`
2026-08-19: "구글은 미확인 — provider만 다른 같은 경로다"). **provider만 다른 같은 경로라는 것은
가정이지 관측이 아니다.**

## 용어

| 용어 | 정의 |
|---|---|
| 인가 URL | 구글 동의 화면 주소. `https://accounts.google.com/o/oauth2/v2/auth` |
| `state` | 인가 요청에 실어 보내면 구글이 그대로 되돌려주는 값. **로그인 후 돌아갈 앱 내부 경로**를 담는다 |
| 취소 | 사용자가 동의 화면에서 거부한 것. 구글이 `code` 없이 `?error=access_denied`로 되돌려보낸다 |

## 데이터

**마이그레이션 없음.** `OAuthProvider.GOOGLE`은 이미 있고 `user_oauth_accounts`도 그대로다.

## 설정

| 대상 | 키 | 로컬 기본값 | 운영 |
|---|---|---|---|
| 프론트(빌드 타임) | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | 없음(빈 문자열) | GitHub Secrets |
| 프론트(빌드 타임) | `NEXT_PUBLIC_GOOGLE_REDIRECT_URI` | `http://localhost:3000/auth/callback/google` | `https://kaldi-note.today/auth/callback/google` |
| 백엔드 | `GOOGLE_REDIRECT_URI` | `http://localhost:3000/auth/callback/google` | 위와 같은 값 |

> **셋이 문자 하나까지 같아야 한다.** 구글 클라우드 콘솔에 등록한 값·프론트가 인가 URL에 싣는
> 값·백엔드가 토큰 교환 때 보내는 값이 하나라도 다르면 구글이 교환을 거부한다. 카카오에서 이미
> 겪은 함정이라 `infra/.env.example`이 그렇게 경고하고 있다.

### 콜백 경로를 나누는 이유

카카오와 구글의 `redirect-uri` 기본값이 **둘 다 `/auth/callback`**이었다. 경로가 같으면 콜백 화면이
어느 provider인지 알 수 없어 `state`에 provider를 실어야 하는데, 그러면 `state` 하나가 **「돌아갈
경로」와 「provider」 둘을 동시에 나르게 된다.** 경로를 나누면 **경로가 곧 계약**이고
`safeNextPath`를 건드리지 않아도 된다.

---

## 어떻게 동작 — 인수 조건

### 진입 — 로그인 화면

#### AC-GOOGLE-01 · 로그인 화면에 구글 링크가 카카오 아래에 있다

- **Given** `/login`을 연다
- **When** 화면이 그려진다
- **Then** 「카카오로 로그인」과 「구글로 로그인」이 **그 순서로** 있다
- **검증** 화면 테스트 `app/login/page.test.tsx`

#### AC-GOOGLE-02 · 구글 인가 URL의 모양

- **Given** `NEXT_PUBLIC_GOOGLE_CLIENT_ID`가 `test-google-id`다
- **When** `/login`을 연다
- **Then** 「구글로 로그인」의 `href`가 `https://accounts.google.com/o/oauth2/v2/auth`로 시작하고
  질의 문자열에 `client_id=test-google-id`, `redirect_uri`, `response_type=code`,
  `scope=openid email profile`, `state`가 있다
- **검증** 화면 테스트 `app/login/page.test.tsx`

> `scope`가 `openid email profile`인 이유: `GoogleOAuthClient.fetchUserInfo`가 `sub`·`email`·
> `name`·`picture`를 읽는다. `openid`가 없으면 `sub`가, `profile`이 없으면 `name`·`picture`가
> 비어 돌아온다.

#### AC-GOOGLE-03 · next가 없으면 state는 `/recipes`다

- **Given** `/login`을 `next` 없이 연다
- **When** 구글 링크가 그려진다
- **Then** `state`가 `/recipes`다
- **검증** 화면 테스트 `app/login/page.test.tsx`

#### AC-GOOGLE-04 · 외부 경로는 state에 실리지 않는다

- **Given** `/login?next=//evil.com`을 연다
- **When** 구글 링크가 그려진다
- **Then** `state`가 `/recipes`다 (`safeNextPath`를 그대로 쓴다)
- **검증** 화면 테스트 `app/login/page.test.tsx`

### 콜백

#### AC-GOOGLE-05 · 구글 콜백은 provider를 google로 보낸다

- **Given** `/auth/callback/google?code=abc&state=/recipes`를 연다
- **When** 화면이 BFF를 부른다
- **Then** `POST /api/auth/login`의 본문이 `{"code":"abc","provider":"google"}`이다
- **검증** 화면 테스트 `app/auth/callback/google/page.test.tsx`

#### AC-GOOGLE-06 · 성공하면 토큰을 저장하고 state 경로로 이동한다

- **Given** BFF가 `accessToken`을 돌려준다
- **When** 교환이 끝난다
- **Then** `setAccessToken`이 그 값으로 불리고 `state`에 실려 온 경로로 이동한다
- **검증** 화면 테스트 `app/auth/callback/google/page.test.tsx`

#### AC-GOOGLE-07 · 기존 카카오 콜백은 provider를 kakao로 보낸다

- **Given** `/auth/callback?code=abc`를 연다
- **When** 화면이 BFF를 부른다
- **Then** 본문의 `provider`가 `"kakao"`다
- **검증** 화면 테스트 `app/auth/callback/page.test.tsx`

> **회귀 방지용이다.** 지금은 `{code}`만 보내고 BFF의 기본값이 `kakao`라서 동작한다. 구글을
> 더하면서 **명시적으로** 보내게 바뀌므로, 이 조건이 없으면 카카오가 조용히 깨져도 모른다.

### 취소와 실패

#### AC-GOOGLE-08 · 구글에서 취소하면 전용 문구가 뜬다

- **Given** `/auth/callback/google?error=access_denied`를 연다
- **When** 화면이 그려진다
- **Then** 「로그인을 취소했습니다」가 보이고 **`POST /api/auth/login`을 부르지 않는다**
- **검증** 화면 테스트 `app/auth/callback/google/page.test.tsx`

#### AC-GOOGLE-09 · 카카오에서 취소해도 같은 문구다

- **Given** `/auth/callback?error=access_denied`를 연다
- **When** 화면이 그려진다
- **Then** 「로그인을 취소했습니다」가 보이고 **`POST /api/auth/login`을 부르지 않는다**
- **검증** 화면 테스트 `app/auth/callback/page.test.tsx`

#### AC-GOOGLE-10 · code도 error도 없으면 기존 문구를 유지한다

- **Given** `/auth/callback/google`을 질의 문자열 없이 연다
- **When** 화면이 그려진다
- **Then** 「인가 코드가 없습니다. 다시 로그인해 주세요.」가 보인다
- **검증** 화면 테스트 `app/auth/callback/google/page.test.tsx`

#### AC-GOOGLE-11 · BFF가 실패하면 그 message를 보여준다

- **Given** BFF가 `401`과 `{"code":"OAUTH_TOKEN_EXCHANGE_FAILED","message":"로그인에 실패했습니다."}`를 돌려준다
- **When** 구글 콜백이 교환을 시도한다
- **Then** 그 `message`가 화면에 보인다
- **검증** 화면 테스트 `app/auth/callback/google/page.test.tsx`

### 설정 기본값

#### AC-GOOGLE-12 · 클라이언트 id가 없으면 빈 문자열이다

- **Given** `NEXT_PUBLIC_GOOGLE_CLIENT_ID`가 설정돼 있지 않다
- **When** 구글 인가 URL을 만든다
- **Then** `client_id`가 빈 문자열이고 **링크는 그대로 그려진다**
- **검증** 단위 테스트 `features/auth/google.test.ts`

> `kakaoAuthorizeUrl`이 `?? ""`로 같은 선례를 남겼다. 버튼을 감추면 「왜 안 보이지」가 되고,
> 두면 구글이 자기 화면에서 무엇이 잘못됐는지 알려준다.

#### AC-GOOGLE-13 · 리디렉션 URI 기본값 (프론트)

- **Given** `NEXT_PUBLIC_GOOGLE_REDIRECT_URI`가 설정돼 있지 않다
- **When** 구글 인가 URL을 만든다
- **Then** `redirect_uri`가 `http://localhost:3000/auth/callback/google`이다
- **검증** 단위 테스트 `features/auth/google.test.ts`

#### AC-GOOGLE-14 · 리디렉션 URI 기본값 (백엔드)

- **Given** `GOOGLE_REDIRECT_URI` 환경변수가 없다
- **When** `OAuthProperties`를 읽는다
- **Then** `google().redirectUri()`가 `http://localhost:3000/auth/callback/google`이다
- **검증** 통합 테스트 `auth/infrastructure/oauth/OAuthPropertiesTest`

---

## 수동 확인

- [x] ★ **운영에서 실제 구글 계정으로 로그인되고 「더보기」에 닉네임이 뜬다.** 자동 테스트는 구글의
      동의 화면을 밟을 수 없다. **이것이 `oci-deploy`의 「구글은 미확인」도 함께 푼다**
- [x] 사전 준비 — 구글 클라우드 콘솔에 리디렉션 URI 둘(`http://localhost:3000/auth/callback/google`,
      `https://kaldi-note.today/auth/callback/google`)을 등록하고, 운영 `.env`의 `GOOGLE_CLIENT_ID`·
      `GOOGLE_CLIENT_SECRET`을 채우고, **`GOOGLE_REDIRECT_URI`를 `/auth/callback/google`로 고치고**,
      GitHub Secrets에 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`를 넣은 뒤 **앱 컨테이너를 재기동한다**
      (`.env`는 파일일 뿐이라 다시 띄워야 앱이 읽는다)
- [x] 폰에서 구글 동의 화면을 **취소**하면 「로그인을 취소했습니다」가 뜬다
- [ ] 카카오 로그인이 여전히 된다 (기존 계정으로)

> **2026-09-07 확인 — 차단형이 풀렸다. 운영에서 실제 구글 계정으로 로그인된다.**
> 「더보기」에 구글 계정 닉네임이 뜨고, 동의 화면에서 취소하면 「로그인을 취소했습니다」가 뜬다.
> **이것이 `2026-08-18-oci-deploy.md`의 「구글은 미확인」도 함께 닫았다.**
>
> **★ 처음 두 번은 실패했고, 원인은 `.env`의 값이 아니라 「고치지 않은 값」이었다.**
> `GOOGLE_REDIRECT_URI`가 `.../auth/callback`(구글 전용 경로가 아닌 옛 값)으로 **이미 적혀
> 있었다.** `application.yml`의 기본값을 바꿨지만 **환경변수가 있으면 기본값은 아무 역할도 하지
> 않는다.** 이 스펙의 「사전 준비」가 「채운다」라고만 적어 그 함정을 드러내지 못했다 — **새로
> 채우는 것과 이미 있는 값을 고치는 것은 다른 일이다.** 문구를 고쳤다.
>
> **세 번째 실패는 재기동을 안 해서였다.** `.env`를 고쳐도 컨테이너가 다시 뜨지 않으면 앱은 옛
> 값을 들고 있다. `docker inspect --format '{{.State.StartedAt}}'`이 실패 시각보다 **앞선다는
> 것**으로 그 사실을 확정했다 — 밖에서는 알 수 없었다(actuator가 `health`·`info`만 연다).
>
> **원인은 추측이 아니라 구글이 직접 말해줬다.** `docker logs`에 `구글 토큰 교환 실패`와 함께
> `{"error":"redirect_uri_mismatch"}`가 찍혀 있었다. **`GlobalExceptionHandler`의 한 줄
> (`OAUTH_TOKEN_EXCHANGE_FAILED`)만 보면 원인이 셋 중 무엇인지 알 수 없다** — 그 위의
> `GoogleOAuthClient` 로그까지 봐야 한다.
>
> **인가코드는 1회용이다.** 콜백 URL을 새로고침해 재시도하면 `invalid_grant`가 난다. 재시도는
> 반드시 `/login`부터 한다.

## 열어둔 결정

- **테스트 로그인을 언제 끌지.** 구글이 운영에서 확인되면 그때 판단한다. 끄면
  `docs/specs/2026-09-05-test-login.md`의 마지막 수동 확인 항목이 닫힌다.
- **계정 병합.** 같은 사람이 카카오·구글 계정을 둘 다 갖게 되면 그때 다시 본다. 지금은 「내
  레시피」가 계정별로 갈리는 것이 유일한 증상이다.
- **`prompt`·`access_type` 파라미터.** 재동의 강제나 refresh token 발급이 필요해지면 그때 넣는다.
  지금은 백엔드가 구글 refresh token을 쓰지 않는다.

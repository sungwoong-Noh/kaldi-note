# 구글 로그인 버튼 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-07-google-login.md`

**Goal:** 로그인 화면에서 구글로 로그인할 수 있게 되고, 그 결과 운영에 살아 있는 테스트 로그인
시크릿을 끌 근거가 생긴다.

**Architecture:** 백엔드는 이미 완성돼 있고 BFF도 `provider`를 받으므로, **이 계획은 거의 전부
프론트다.** 콜백 경로를 provider별로 나눠(`/auth/callback` · `/auth/callback/google`) **경로가 곧
provider 계약**이 되게 한다. 기존 `AuthCallback` 컴포넌트를 두 경로가 공유하고, provider와 error를
prop으로 받는다 — 화면을 복제하지 않는다.

**작업 위치:** `frontend/` (Task 4만 `backend/`·`infra/`·`.github/`)

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-GOOGLE-01 | 구글 링크가 카카오 아래에 있다 | Task 1 | 화면 테스트 |
| AC-GOOGLE-02 | 인가 URL의 모양 | Task 1 | 화면 테스트 |
| AC-GOOGLE-03 | next 없으면 state=/recipes | Task 1 | 화면 테스트 |
| AC-GOOGLE-04 | 외부 경로는 state에 안 실린다 | Task 1 | 화면 테스트 |
| AC-GOOGLE-12 | client_id 미설정이면 빈 문자열 | Task 1 | 단위 테스트 |
| AC-GOOGLE-13 | redirect_uri 기본값(프론트) | Task 1 | 단위 테스트 |
| AC-GOOGLE-05 | 구글 콜백은 provider=google | Task 2 | 화면 테스트 |
| AC-GOOGLE-06 | 성공 시 토큰 저장 + 이동 | Task 2 | 화면 테스트 |
| AC-GOOGLE-07 | 카카오 콜백은 provider=kakao | Task 2 | 화면 테스트 |
| AC-GOOGLE-10 | code도 error도 없을 때 문구 | Task 2 | 화면 테스트 |
| AC-GOOGLE-11 | BFF 실패 message 노출 | Task 2 | 화면 테스트 |
| AC-GOOGLE-08 | 구글 취소 문구 | Task 3 | 화면 테스트 |
| AC-GOOGLE-09 | 카카오 취소 문구 | Task 3 | 화면 테스트 |
| AC-GOOGLE-14 | redirect-uri 기본값(백엔드) | Task 4 | 통합 테스트 |

**14개 전부 배정됐다.**

---

## Global Constraints

- **백엔드 인증 로직을 고치지 않는다.** `AuthService`·`AuthController`·`GoogleOAuthClient`·
  `OAuthProperties`는 읽기만 한다. Task 4가 바꾸는 것은 `application.yml`의 기본값 문자열 하나다.
- **`safeNextPath`와 `kakaoAuthorizeUrl`의 시그니처를 바꾸지 않는다.** 기존 테스트 셋이 의존한다.
- **`safeNextPath`를 공용 모듈로 옮기지 않는다.** 구글 쪽에서도 쓰게 되어 `features/auth/kakao.ts`
  에서 import하는 모양이 어색해지지만, **이동은 계획에 없는 리팩터링이다.** 어색함은
  「열어둔 결정」에 적고 넘어간다.
- **기존 AC를 깨뜨리지 않는다.** `AC-WEB-03`(로그인 화면), `AC-WEB-04`·`AC-WEB-06`(콜백)이
  같은 파일에 있다. 각 태스크의 마지막 Step에서 그 ID들이 여전히 초록인지 확인한다.
- 사람과의 대화는 한국어, 코드 식별자는 영어, 주석·커밋은 한국어.

---

## File Structure

```
frontend/src/features/auth/
  google.ts                         Create — googleAuthorizeUrl()
  google.test.ts                    Create — AC-12, 13
  components/AuthCallback.tsx       Modify — provider·error prop을 받는다
frontend/src/app/login/
  page.tsx                          Modify — 구글 링크 추가
  page.test.tsx                     Modify — AC-01~04
frontend/src/app/auth/callback/
  page.tsx                          Modify — provider="kakao"·error 전달
  page.test.tsx                     Modify — AC-07, 09
  google/page.tsx                   Create — provider="google"
  google/page.test.tsx              Create — AC-05, 06, 08, 10, 11
frontend/.env.example               Modify — NEXT_PUBLIC_GOOGLE_*
backend/src/main/resources/application.yml
                                    Modify — google.redirect-uri 기본값
backend/src/test/java/com/kaldinote/auth/infrastructure/oauth/
  OAuthPropertiesTest.java          Create — AC-14
infra/.env.example                  Modify — GOOGLE_REDIRECT_URI 주석
.github/workflows/frontend.yml      Modify — NEXT_PUBLIC_GOOGLE_* 주입
```

---

## Task 1: 구글 인가 URL과 로그인 버튼

**Files:**
- Create: `frontend/src/features/auth/google.ts`
- Create: `frontend/src/features/auth/google.test.ts`
- Modify: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/app/login/page.test.tsx`

**Covers:** AC-GOOGLE-01, 02, 03, 04, 12, 13

**Interfaces:**
- Produces: `googleAuthorizeUrl(next: string): string` — `kakaoAuthorizeUrl`과 **같은 시그니처**
- Consumes: `safeNextPath` (`features/auth/kakao.ts`에서 그대로 import)

- [x] **Step 1: 시작 전 초록을 확인한다**

Run: `cd frontend && pnpm test`
Expected: PASS. **숫자를 적어둔다**(312개일 것).

- [x] **Step 2: 실패하는 테스트 작성 — `google.test.ts`**

`process.env`를 테스트 안에서 바꾼다. `googleAuthorizeUrl`이 **호출 시점에** 읽으므로 가능하다
(`kakaoAuthorizeUrl`도 같은 구조다).

```ts
import { afterEach, describe, expect, it } from "vitest";
import { googleAuthorizeUrl } from "./google";

const ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("googleAuthorizeUrl", () => {
  it("AC-GOOGLE-12 · 클라이언트 id가 없으면 빈 문자열이다", () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    const url = new URL(googleAuthorizeUrl("/recipes"));

    expect(url.searchParams.get("client_id")).toBe("");
  });

  it("AC-GOOGLE-13 · 리디렉션 URI 기본값은 로컬 콜백이다", () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI;

    const url = new URL(googleAuthorizeUrl("/recipes"));

    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/auth/callback/google",
    );
  });
});
```

- [x] **Step 3: 실행 — 실패 확인**

Run: `cd frontend && pnpm test google`
Expected: FAIL — `google.ts`가 없다. **「모듈을 찾을 수 없다」가 아닌 다른 이유로 실패하면 멈춘다.**

- [x] **Step 4: `google.ts` 최소 구현**

```ts
const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/**
 * 구글 인가 URL을 만든다.
 *
 * <p>`redirect_uri`는 구글 클라우드 콘솔에 등록한 값·백엔드의 `GOOGLE_REDIRECT_URI`와 문자 하나까지
 * 같아야 한다. 카카오와 **경로가 다르다**(`/auth/callback/google`) — 콜백 화면이 경로로 provider를
 * 판정하기 때문이다.
 */
export function googleAuthorizeUrl(next: string): string {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
    redirect_uri:
      process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ??
      "http://localhost:3000/auth/callback/google",
    response_type: "code",
    // GoogleOAuthClient가 sub·email·name·picture를 읽는다. openid가 없으면 sub가,
    // profile이 없으면 name·picture가 비어 돌아온다.
    scope: "openid email profile",
    state: next,
  });

  return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
}
```

- [x] **Step 5: 실행 — 통과 확인**

Run: `cd frontend && pnpm test google`
Expected: PASS 2개.

- [x] **Step 6: 로그인 화면 테스트 추가**

`page.test.tsx`에 더한다. **기존 테스트 셋은 건드리지 않는다.**

```ts
  it("AC-GOOGLE-01 · 구글 링크가 카카오 아래에 있다", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    const links = screen.getAllByRole("link");
    const names = links.map((l) => l.textContent);

    expect(names).toEqual(["카카오로 로그인", "구글로 로그인"]);
  });

  it("AC-GOOGLE-02 · 구글 인가 URL의 모양", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "test-google-id";

    render(
      await LoginPage({ searchParams: Promise.resolve({ next: "/recipes/1" }) }),
    );

    const href =
      screen.getByRole("link", { name: "구글로 로그인" }).getAttribute("href") ??
      "";
    const url = new URL(href);

    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("test-google-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("redirect_uri")).toContain(
      "/auth/callback/google",
    );
    expect(url.searchParams.get("state")).toBe("/recipes/1");
  });

  it("AC-GOOGLE-03 · next가 없으면 state가 /recipes다", async () => { /* state === "/recipes" */ });

  it("AC-GOOGLE-04 · 외부 주소는 state에 실리지 않는다", async () => {
    // next="//evil.example/steal" → state === "/recipes", href에 evil.example이 없다
  });
```

> **`process.env`를 건드리는 테스트는 뒷정리를 한다.** `page.test.tsx`에도
> `afterEach(() => { process.env = { ...ORIGINAL }; })`를 넣는다 — 넣지 않으면 AC-02가 설정한
> `test-google-id`가 뒤 테스트로 샌다.

- [x] **Step 7: 실행 — 실패 확인**

Run: `cd frontend && pnpm test login`
Expected: FAIL 4개. **AC-01은 「링크가 1개뿐」으로, 나머지는 「구글로 로그인을 찾을 수 없다」로
실패해야 한다.**

- [x] **Step 8: 로그인 화면에 링크 추가**

`page.tsx`에서 `googleAuthorizeUrl`을 import하고 카카오 `<a>` **아래**에 더한다. 카카오 링크의
클래스는 그대로 두고, 구글은 흰 배경 + 테두리로 구분한다.

```tsx
      <a
        href={googleAuthorizeUrl(next)}
        className="w-full max-w-xs rounded-md border border-neutral-300 px-4 py-3 text-center font-medium dark:border-neutral-700"
      >
        구글로 로그인
      </a>
```

- [x] **Step 9: 실행 — 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS. **318개**(312 + 6). `AC-WEB-03`이 여전히 초록인지 눈으로 확인한다.

- [x] **Step 10: 커밋**

`feat(web): 구글 인가 URL과 로그인 버튼 (AC-GOOGLE 01~04·12·13)`

---

## Task 2: 콜백이 provider를 명시한다

**Files:**
- Modify: `frontend/src/features/auth/components/AuthCallback.tsx`
- Modify: `frontend/src/app/auth/callback/page.tsx`
- Modify: `frontend/src/app/auth/callback/page.test.tsx`
- Create: `frontend/src/app/auth/callback/google/page.tsx`
- Create: `frontend/src/app/auth/callback/google/page.test.tsx`

**Covers:** AC-GOOGLE-05, 06, 07, 10, 11

**Interfaces:**
- Produces: `AuthCallback({ code, next, provider })` — `provider: "kakao" | "google"`
- **Consumes:** `safeNextPath` (kakao.ts), `sessionSchema`, `setAccessToken` — 전부 기존 것

- [x] **Step 1: 카카오 회귀 테스트를 먼저 쓴다 (AC-GOOGLE-07)**

`app/auth/callback/page.test.tsx`에 더한다. **지금은 `provider` 키가 아예 없으므로 실패해야 한다.**

```ts
  it("AC-GOOGLE-07 · 카카오 콜백은 provider를 kakao로 보낸다", async () => {
    let forwarded: unknown = null;
    server.use(
      http.post("/api/auth/login", async ({ request }) => {
        forwarded = await request.json();
        return HttpResponse.json(SESSION);
      }),
    );

    render(
      await AuthCallbackPage({
        searchParams: Promise.resolve({ code: "test-code", state: "/recipes" }),
      }),
    );

    await waitFor(() => expect(forwarded).toEqual({
      code: "test-code",
      provider: "kakao",
    }));
  });
```

- [x] **Step 2: 실행 — 실패 확인**

Run: `cd frontend && pnpm test auth/callback`
Expected: FAIL 1개 — 본문이 `{code}`뿐이라 `provider` 키가 없다.

- [x] **Step 3: `AuthCallback`에 provider prop을 더한다**

```tsx
export function AuthCallback({
  code,
  next,
  provider,
}: {
  code: string | null;
  next: string;
  provider: "kakao" | "google";
}) {
```

`AuthCallbackExchange`까지 내려보내고 본문에 싣는다.

```tsx
          body: JSON.stringify({ code, provider }),
```

`app/auth/callback/page.tsx`는 `provider="kakao"`를 넘긴다.

- [x] **Step 4: 실행 — 통과 확인**

Run: `cd frontend && pnpm test auth/callback`
Expected: PASS. `AC-WEB-04`·`AC-WEB-06`도 초록이어야 한다.

- [x] **Step 5: 구글 콜백 테스트 작성 (AC-05, 06, 10, 11)**

`app/auth/callback/google/page.test.tsx`를 만든다. **카카오 테스트를 복사해 `provider`와
문구만 바꾼다** — 하네스(`msw`, `vi.mock("next/navigation")`, `SESSION`)는 그대로 쓴다.

```ts
  it("AC-GOOGLE-05 · 구글 콜백은 provider를 google로 보낸다", async () => {
    // forwarded === { code: "test-code", provider: "google" }
  });

  it("AC-GOOGLE-06 · 성공하면 토큰을 저장하고 state 경로로 이동한다", async () => {
    // getAccessToken() === "a.b.c" 이고 replace가 "/recipes/1"로 불린다
  });

  it("AC-GOOGLE-10 · code도 error도 없으면 기존 문구다", async () => {
    // searchParams {} → "인가 코드가 없습니다. 다시 로그인해 주세요."
  });

  it("AC-GOOGLE-11 · BFF가 실패하면 그 message를 보여준다", async () => {
    // 401 + {code:"OAUTH_TOKEN_EXCHANGE_FAILED", message:"로그인에 실패했습니다."}
    // → 화면에 "로그인에 실패했습니다."
  });
```

- [x] **Step 6: 실행 — 실패 확인**

Run: `cd frontend && pnpm test callback/google`
Expected: FAIL — 페이지가 없다.

- [x] **Step 7: 구글 콜백 페이지 생성**

```tsx
import { AuthCallback } from "@/features/auth/components/AuthCallback";
import { safeNextPath } from "@/features/auth/kakao";

/** 구글이 되돌려보내는 곳. 경로가 곧 provider 계약이다 — 스펙의 「콜백 경로를 나누는 이유」. */
export default async function GoogleAuthCallbackPage({
  searchParams,
}: {
  params?: never;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const code = Array.isArray(params.code) ? params.code[0] : (params.code ?? null);
  const next = safeNextPath(params.state ?? params.next);

  return <AuthCallback code={code} next={next} provider="google" />;
}
```

- [x] **Step 8: 실행 — 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS. **323개**(318 + 5).

- [x] **Step 9: 커밋**

`feat(web): 구글 콜백 경로와 provider 명시 (AC-GOOGLE 05~07·10·11)`

---

## Task 3: 취소를 장애와 구분한다

**Files:**
- Modify: `frontend/src/features/auth/components/AuthCallback.tsx`
- Modify: `frontend/src/app/auth/callback/page.tsx`
- Modify: `frontend/src/app/auth/callback/google/page.tsx`
- Modify: `frontend/src/app/auth/callback/page.test.tsx`
- Modify: `frontend/src/app/auth/callback/google/page.test.tsx`

**Covers:** AC-GOOGLE-08, 09

**Interfaces:**
- Produces: `AuthCallback({ code, next, provider, error })` — `error: string | null`

- [x] **Step 1: 실패하는 테스트 작성 (양쪽)**

각 콜백 테스트에 더한다. **BFF를 부르지 않는 것까지 단언한다** — 문구만 보면 「불렀는데 실패해서
문구가 떴다」와 구별되지 않는다.

```ts
  it("AC-GOOGLE-08 · 취소하면 전용 문구가 뜨고 BFF를 부르지 않는다", async () => {
    let called = false;
    server.use(
      http.post("/api/auth/login", () => {
        called = true;
        return HttpResponse.json(SESSION);
      }),
    );

    render(
      await GoogleAuthCallbackPage({
        searchParams: Promise.resolve({ error: "access_denied" }),
      }),
    );

    expect(screen.getByText("로그인을 취소했습니다")).toBeInTheDocument();
    expect(called).toBe(false);
  });
```

카카오 쪽은 같은 모양으로 `AC-GOOGLE-09`.

- [x] **Step 2: 실행 — 실패 확인**

Run: `cd frontend && pnpm test auth/callback`
Expected: FAIL 2개. **문구가 「인가 코드가 없습니다…」로 뜬다** — `code`가 없어 그 분기를 타기
때문이다. `called`는 이미 `false`이므로 **그 단언은 지금도 통과한다.** 실패 이유가 문구 하나뿐인지
확인한다.

- [x] **Step 3: `AuthCallback`에 error 분기를 넣는다**

**`code` 없음 분기보다 먼저 판정한다.** 취소는 `code`가 없는 상태로 오므로, 순서가 뒤바뀌면
영영 「인가 코드가 없습니다」가 뜬다.

```tsx
export function AuthCallback({ code, next, provider, error }: { … }) {
  // 취소는 장애가 아니다. code가 없는 것은 같지만 사용자가 한 일이다.
  if (error) {
    return <CallbackMessage message="로그인을 취소했습니다" />;
  }

  if (!code) {
    return <CallbackMessage message="인가 코드가 없습니다. 다시 로그인해 주세요." />;
  }

  return <AuthCallbackExchange code={code} next={next} provider={provider} />;
}
```

두 페이지에서 `error`를 꺼내 넘긴다.

```tsx
  const error = Array.isArray(params.error) ? params.error[0] : (params.error ?? null);
```

- [x] **Step 4: 실행 — 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS. **325개**(323 + 2).

- [x] **Step 5: 돌연변이 검사**

`AuthCallback`에서 `error` 분기를 **일시적으로 아래로** 내려 `!code` 뒤에 둔다.
Expected: `AC-GOOGLE-08`·`09` 둘 다 FAIL. **초록이면 그 순서를 지키는 조건이 없다는 뜻이다.**
확인 후 되돌린다.

- [x] **Step 6: 커밋**

`feat(web): 취소를 장애와 구분한다 (AC-GOOGLE-08·09)`

---

## Task 4: 설정 기본값과 배포 배선

**Files:**
- Modify: `backend/src/main/resources/application.yml`
- Create: `backend/src/test/java/com/kaldinote/auth/infrastructure/oauth/OAuthPropertiesTest.java`
- Modify: `frontend/.env.example`
- Modify: `infra/.env.example`
- Modify: `.github/workflows/frontend.yml`

**Covers:** AC-GOOGLE-14

- [x] **Step 1: 실패하는 테스트 작성**

`application-test.yml`은 `google.client-id`·`client-secret`만 덮고 **`redirect-uri`는 덮지
않는다.** 그래서 `application.yml`의 기본값이 그대로 보인다.

```java
@DisplayName("AC-GOOGLE-14 · 구글 리디렉션 URI 기본값은 구글 전용 콜백 경로다")
@Test
void 구글_리디렉션_기본값() {
  assertThat(properties.google().redirectUri())
      .isEqualTo("http://localhost:3000/auth/callback/google");
}
```

> **셸에 `GOOGLE_REDIRECT_URI`가 떠 있으면 이 테스트가 그 값을 본다.** 실패하면 먼저
> `echo $GOOGLE_REDIRECT_URI`를 확인한다.

- [x] **Step 2: 실행 — 실패 확인**

Run: `cd backend && ./gradlew test --tests '*OAuthPropertiesTest*'`
Expected: FAIL — 실제값이 `http://localhost:3000/auth/callback`이다.

- [x] **Step 3: 기본값 변경**

`application.yml`의 한 줄만 바꾼다. **카카오 줄은 건드리지 않는다.**

```yaml
      redirect-uri: ${GOOGLE_REDIRECT_URI:http://localhost:3000/auth/callback/google}
```

- [x] **Step 4: 실행 — 통과 확인**

Run: `cd backend && ./gradlew clean check`
Expected: PASS. **505개**(503 + 2). — **계획은 504(503+1)로 적었으나 실제로는 카카오 기본값 회귀 테스트를 함께 넣어 2개가 늘었다.**

- [x] **Step 5: 배포 배선**

`frontend/.env.example`에 키 둘을 더한다(값은 비운다).

```
# 구글 클라우드 콘솔의 OAuth 클라이언트 ID
NEXT_PUBLIC_GOOGLE_CLIENT_ID=

# 구글 콘솔에 등록한 것·백엔드 GOOGLE_REDIRECT_URI와 문자 하나까지 같아야 한다.
# 카카오와 경로가 다르다 — 콜백 화면이 경로로 provider를 판정한다.
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback/google
```

`infra/.env.example`의 `GOOGLE_REDIRECT_URI=` 옆에 같은 경고를 단다.

`.github/workflows/frontend.yml`의 빌드 `env:`에 두 줄을 더한다.

```yaml
          NEXT_PUBLIC_GOOGLE_REDIRECT_URI: https://kaldi-note.today/auth/callback/google
          NEXT_PUBLIC_GOOGLE_CLIENT_ID: ${{ secrets.NEXT_PUBLIC_GOOGLE_CLIENT_ID }}
```

> **시크릿이 비어 있어도 빌드는 성공한다.** 빈 `client_id`로 번들이 구워질 뿐이다(AC-12).
> **그래서 배포됐다고 되는 것이 아니다** — 수동 확인이 그것을 잡는다.

- [x] **Step 6: 전체 검증**

Run: `cd backend && ./gradlew clean check` · `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` · `./scripts/check-spec-coverage.sh`
Expected: 백엔드 505 · 프론트 325 · 커버리지 **692개**(678 + 14).

- [x] **Step 7: 커밋**

`chore: 구글 리디렉션 기본값과 배포 배선 (AC-GOOGLE-14)`

---

## 완료 기준

- [x] `cd backend && ./gradlew clean check` 통과 (505개 — 계획의 504는 카카오 회귀 테스트를 세지 않은 예측이었다)
- [x] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 (325개)
- [x] `./scripts/check-spec-coverage.sh` 통과 (692개)
- [x] 스펙의 `status`를 `구현완료`로 변경 — **차단형 수동 확인이 남으므로, 그것을 밟은 뒤에만 올린다**
- [x] 사람이 구글 콘솔·운영 `.env`·GitHub Secrets를 채운다
- [x] ★ 운영에서 실제 구글 계정으로 로그인된다

---

## 검증되지 않은 가정

- **`process.env`를 테스트에서 바꾸면 `googleAuthorizeUrl`이 그 값을 읽는다.** `kakaoAuthorizeUrl`이
  호출 시점에 읽으므로 참일 것이다. **거짓이면** Next가 빌드 타임에 치환하는 탓이므로,
  `vi.stubEnv`로 바꾼다.
- **`AuthCallbackPage`를 테스트에서 직접 `await`해 렌더하는 방식이 새 하위 경로에서도 된다.**
  기존 카카오 테스트가 그렇게 하고 있으므로 참일 것이다.
- **`getAllByRole("link")`가 로그인 화면에서 정확히 2개를 돌려준다.** 지금 화면에 다른 링크가 없다.
  **거짓이면** AC-01을 `getAllByRole` 순서 비교 대신 DOM 순서 단언으로 바꾼다.
- **구글 콘솔이 `http://localhost:3000/...`를 리디렉션 URI로 받아준다.** 구글은 `http`를
  `localhost`에 한해 허용한다. **거짓이면** 로컬 확인은 포기하고 운영에서만 밟는다.

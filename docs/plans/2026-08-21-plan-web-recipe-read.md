# 프론트 첫 슬라이스 — 로그인 + 레시피 읽기 + 포크 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-08-21-web-recipe-read.md`

**Goal:** 브라우저에서 카카오로 로그인해 레시피 목록을 훑고, 상세에서 푸어 스텝을 본 뒤, 시드 레시피를 포크해 내 것으로 만들 수 있다.

**Architecture:** 인증만 **Next Route Handler를 BFF로** 경유한다. 백엔드가 `refreshToken`을 JSON 본문으로 주고 `Set-Cookie`를 쓰지 않는데 `httpOnly` 쿠키는 브라우저 JS가 만들 수 없기 때문이다. 레시피 조회는 `frontend/CLAUDE.md`의 "기본은 백엔드 직접 호출"을 따라 직호출하고, 그래서 **백엔드에 CORS 설정을 추가하는 것이 이 계획의 첫 태스크**가 된다. 서버 상태는 전부 TanStack Query가 들고, 응답 타입은 Zod 스키마에서 `z.infer`로 뽑는다.

**작업 위치:** `backend/`(Task 1) → `frontend/`(Task 2~6)

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`. Task 1만 `backend/CLAUDE.md` → `docs/conventions/backend.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-CORS-01 | 허용 출처 프리플라이트 200 | Task 1 | 백엔드 통합 테스트 |
| AC-CORS-02 | 미허용 출처엔 허용 헤더 없음 | Task 1 | 백엔드 통합 테스트 |
| AC-CORS-03 | 프리플라이트는 인증 불필요 | Task 1 | 백엔드 통합 테스트 |
| AC-WEB-03 | 카카오 인가 URL로 이동 | Task 3 | 페이지 테스트 |
| AC-WEB-04 | 콜백이 코드를 넘기고 복귀 | Task 3 | 페이지 테스트 |
| AC-WEB-05 | refreshToken은 httpOnly 쿠키 | Task 3 | Route Handler 테스트 |
| AC-WEB-06 | accessToken을 저장소에 안 씀 | Task 3 | 페이지 테스트 |
| AC-WEB-01 | 미인증 목록 → /login?next= | Task 4 | 페이지 테스트 |
| AC-WEB-02 | 미인증 상세 → /login?next= | Task 4 | 페이지 테스트 |
| AC-WEB-07 | 401 → refresh 1회 → 재시도 | Task 4 | 페이지 테스트 |
| AC-WEB-08 | refresh 무효 → 즉시 /login | Task 4 | 페이지 테스트 |
| AC-WEB-09 | 카드에 추출 파라미터 | Task 5 | 페이지 테스트 |
| AC-WEB-10 | hasNext true면 더 보기 | Task 5 | 페이지 테스트 |
| AC-WEB-11 | hasNext false면 더 보기 없음 | Task 5 | 페이지 테스트 |
| AC-WEB-12 | 더 보기가 뒤에 이어붙임 | Task 5 | 페이지 테스트 |
| AC-WEB-13 | 빈 목록 안내 | Task 5 | 페이지 테스트 |
| AC-WEB-14 | 제목·출처·파라미터 | Task 6 | 페이지 테스트 |
| AC-WEB-15 | 스텝 순서와 m:ss | Task 6 | 컴포넌트 테스트 |
| AC-WEB-16 | 누적 물량 60→300→500 | Task 6 | 컴포넌트 테스트 |
| AC-WEB-17 | 붓지 않는 스텝엔 물량 없음 | Task 6 | 컴포넌트 테스트 |
| AC-WEB-18 | 분쇄도 null이면 영역 숨김 | Task 6 | 페이지 테스트 |
| AC-WEB-19 | 장비를 이름으로 표시 | Task 6 | 페이지 테스트 |
| AC-WEB-20 | CURATED 배지 | Task 6 | 페이지 테스트 |
| AC-WEB-21 | NOT_FOUND 안내 | Task 6 | 페이지 테스트 |
| AC-WEB-22 | 남의 것에 포크 버튼 | Task 6 | 페이지 테스트 |
| AC-WEB-23 | 내 것엔 포크 버튼 없음 | Task 6 | 페이지 테스트 |
| AC-WEB-24 | 포크 성공 시 이동 | Task 6 | 페이지 테스트 |
| AC-WEB-25 | 포크 실패 시 유지 | Task 6 | 페이지 테스트 |

스펙의 AC 28개 중 28개가 매핑됐다. (Task 2는 스캐폴딩으로 AC를 직접 담당하지 않고 Task 3~6의 전제를 만든다.)

---

## Global Constraints

- **`any` 금지, `as` 단언 금지.** 응답 타입은 Zod 스키마에서 `z.infer`로 뽑는다.
- **API는 MSW로 모킹한다.** 테스트에서 실제 백엔드를 호출하지 않는다.
- **조회는 `getByRole`·`getByText`·`getByLabelText`로.** `getByTestId`는 최후 수단이다.
- **`'use client'`는 필요한 최말단 컴포넌트에만** 붙인다. 파일 최상단에 습관적으로 붙이지 않는다.
- **리스트 `key`에 배열 인덱스를 쓰지 않는다.** 푸어 스텝은 순서가 바뀌므로 인덱스 key는 확실한 버그다.
- 커밋 전 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. **`pnpm build`를 빠뜨리지 않는다.**
- `.env.local`은 커밋하지 않는다. `.env.example`에 키 이름만 남긴다.

---

## File Structure

```
backend/src/main/java/com/kaldinote/common/
├── security/SecurityConfig.java            Modify — .cors(...) 추가
└── config/CorsProperties.java              Create — 허용 출처 바인딩
backend/src/main/resources/application.yml  Modify — kaldi.cors.allowed-origins
backend/src/test/java/com/kaldinote/common/security/
└── CorsConfigTest.java                     Create — AC-CORS-01~03

.github/workflows/frontend.yml              Modify — ★ 임시 가드 제거

frontend/
├── package.json  next.config.ts  tsconfig.json  tailwind.config.ts
├── vitest.config.ts  vitest.setup.ts  .env.example  .eslintrc / eslint.config.mjs
├── public/
└── src/
    ├── app/
    │   ├── layout.tsx                      Provider 조립
    │   ├── page.tsx                        → /recipes 리다이렉트
    │   ├── login/page.tsx                  AC-WEB-03
    │   ├── auth/callback/page.tsx          AC-WEB-04·06
    │   ├── recipes/page.tsx                AC-WEB-01·07·08·09~13
    │   ├── recipes/[id]/page.tsx           AC-WEB-02·14·18~25
    │   └── api/auth/
    │       ├── login/route.ts              AC-WEB-05
    │       ├── refresh/route.ts
    │       └── logout/route.ts
    ├── features/
    │   ├── auth/{api,queries,schema}.ts  components/KakaoLoginButton.tsx
    │   ├── recipe/{api,queries,schema}.ts
    │   │   └── components/{RecipeCard,RecipeStepList,ForkButton}.tsx
    │   └── gear/{api,queries,schema}.ts    장비 id→이름 매핑
    ├── components/ui/                      shadcn 생성물
    ├── lib/{api-client,query-client,utils,session}.ts
    └── test/{msw-server.ts,fixtures.ts}
```

---

## Task 1: 백엔드 CORS 설정

**Files:**
- Create: `backend/src/main/java/com/kaldinote/common/config/CorsProperties.java`
- Modify: `backend/src/main/java/com/kaldinote/common/security/SecurityConfig.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `backend/src/test/java/com/kaldinote/common/security/CorsConfigTest.java`

**Covers:** AC-CORS-01, AC-CORS-02, AC-CORS-03

**Interfaces:**
- Produces: `http://localhost:3000` 출처의 브라우저 요청이 통과하는 백엔드 — Task 4~6의 직호출이 이것에 의존한다

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.kaldinote.common.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 프론트가 브라우저에서 백엔드를 직접 부르므로 CORS가 필요하다. Swagger UI는 동일 출처이고 MockMvc는 실제 프리플라이트를 보내지 않아, 이 설정이
 * 없다는 사실이 지금까지 드러나지 않았다.
 */
class CorsConfigTest extends AbstractIntegrationTest {

  private static final String ALLOWED = "http://localhost:3000";

  @Test
  @DisplayName("AC-CORS-01 · 허용된 출처의 프리플라이트가 통과한다")
  void 허용된_출처의_프리플라이트가_통과한다() throws Exception {
    mockMvc
        .perform(
            options("/api/v1/recipes")
                .header("Origin", ALLOWED)
                .header("Access-Control-Request-Method", "GET"))
        .andExpect(status().isOk())
        .andExpect(header().string("Access-Control-Allow-Origin", ALLOWED));
  }

  @Test
  @DisplayName("AC-CORS-02 · 허용되지 않은 출처는 허용 헤더를 받지 못한다")
  void 허용되지_않은_출처는_허용_헤더가_없다() throws Exception {
    mockMvc
        .perform(
            options("/api/v1/recipes")
                .header("Origin", "http://evil.example")
                .header("Access-Control-Request-Method", "GET"))
        .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
  }

  @Test
  @DisplayName("AC-CORS-03 · 프리플라이트는 인증 없이 통과한다")
  void 프리플라이트는_인증_없이_통과한다() throws Exception {
    mockMvc
        .perform(
            options("/api/v1/recipes")
                .header("Origin", ALLOWED)
                .header("Access-Control-Request-Method", "GET"))
        .andExpect(status().isOk());
  }
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd backend && ./gradlew test --tests '*CorsConfigTest'`
Expected: FAIL — `AC-CORS-01`이 실패한다. CORS 설정이 없어 `Access-Control-Allow-Origin` 헤더가 붙지 않는다. `AC-CORS-03`은 상태 코드에 따라 통과할 수도 있다(Spring이 `OPTIONS`를 어떻게 처리하는지에 달림) — **그 경우에도 `01`이 빨간 것이 이 태스크의 Red다.**

- [ ] **Step 3: 최소 구현**

`CorsProperties.java`:

```java
package com.kaldinote.common.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** 허용 출처는 환경마다 다르다. 운영 도메인은 프론트 배포 슬라이스에서 추가한다. */
@ConfigurationProperties(prefix = "kaldi.cors")
public record CorsProperties(List<String> allowedOrigins) {}
```

`application.yml`에 추가:

```yaml
kaldi:
  cors:
    # 브라우저에서 백엔드를 직접 부르는 출처. 운영 도메인은 프론트 배포 시 추가한다.
    allowed-origins: ${KALDI_CORS_ALLOWED_ORIGINS:http://localhost:3000}
```

`SecurityConfig.java` — `.csrf(...)` 앞에 `.cors(...)`를 넣고 빈을 추가한다:

```java
        .cors(cors -> cors.configurationSource(corsConfigurationSource(corsProperties)))
```

```java
  @Bean
  public CorsConfigurationSource corsConfigurationSource(CorsProperties properties) {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(properties.allowedOrigins());
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    // 백엔드는 쿠키를 쓰지 않고 Authorization: Bearer만 받는다.
    // refresh 쿠키는 Next 서버 도메인에만 존재하므로 여기서 credentials는 필요 없다.
    config.setAllowCredentials(false);
    config.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    return source;
  }
```

`@ConfigurationProperties`를 쓰므로 `KaldiNoteApplication`에 `@ConfigurationPropertiesScan`이 있는지 확인하고, 없으면 `@EnableConfigurationProperties(CorsProperties.class)`를 `SecurityConfig`에 붙인다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd backend && ./gradlew clean check`
Expected: PASS — `CorsConfigTest` 3개 포함, 기존 456개도 그대로 초록

- [ ] **Step 5: 커밋**

```bash
cd backend && ./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(cors): 브라우저 직호출을 위한 CORS 설정 (AC-CORS-01~03)"
```

---

## Task 2: Next.js 스캐폴딩 + CI 가드 제거

**Files:**
- Create: `frontend/` 프로젝트 일습 (`package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `.env.example`, ESLint/Prettier 설정)
- Create: `frontend/src/lib/{api-client,query-client,utils}.ts`, `frontend/src/test/{msw-server,fixtures}.ts`
- Create: `frontend/src/app/layout.tsx`, `frontend/src/app/page.tsx`
- Modify: `.github/workflows/frontend.yml` — **임시 가드 제거**

**Covers:** (인프라 태스크 — AC는 Task 3~6이 담당한다)

**Interfaces:**
- Produces: `apiClient`(fetch 래퍼), `queryClient`, MSW 서버 — Task 3~6이 전부 이것을 쓴다

- [ ] **Step 1: 프로젝트 생성**

```bash
cd frontend
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --use-pnpm --import-alias "@/*"
pnpm add @tanstack/react-query zod react-hook-form @hookform/resolvers
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom msw prettier
pnpm dlx shadcn@latest init
```

> `create-next-app`이 `frontend/`에 이미 있는 `CLAUDE.md`를 지우지 않는지 확인한다. 비어 있지 않은 디렉터리라 경고가 나올 수 있는데, **`CLAUDE.md`를 잃으면 안 된다.** 불안하면 임시로 옮겨두고 생성 후 되돌린다.

`package.json`의 scripts를 `frontend/CLAUDE.md`의 명령어 표에 맞춘다:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: 테스트 하네스 구성**

`vitest.config.ts`(jsdom + setup), `vitest.setup.ts`(`@testing-library/jest-dom`, MSW 서버 `beforeAll`/`afterEach`/`afterAll`), `src/test/msw-server.ts`를 만든다.

**스모크 테스트 하나를 먼저 통과시킨다** — 하네스가 실제로 도는지 확인하지 않고 다음 태스크로 가면, 이후 모든 실패가 하네스 문제인지 코드 문제인지 구분되지 않는다.

```tsx
// src/app/page.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('테스트 하네스', () => {
  it('컴포넌트를 렌더링하고 조회할 수 있다', () => {
    render(<p>렌더링 확인</p>);
    expect(screen.getByText('렌더링 확인')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: `.env.example`과 API 클라이언트**

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_KAKAO_CLIENT_ID=
NEXT_PUBLIC_KAKAO_REDIRECT_URI=http://localhost:3000/auth/callback
```

`lib/api-client.ts`는 이 태스크에서 **뼈대만** 만든다(baseUrl 결합, JSON 파싱, `{code, message}` 에러를 던지는 것까지). 401 재시도는 Task 4에서 붙인다.

- [ ] **Step 4: CI 가드 제거 ★**

`.github/workflows/frontend.yml`에서 **`프론트엔드 프로젝트 존재 확인` step 전체와 각 step의 `if: steps.guard.outputs.ready == 'true'` 조건을 전부 지운다.**

> **이걸 빠뜨리면 CI가 초록인데 아무것도 검사하지 않는 상태가 된다.** 백엔드에서 같은 함정을 겪었고 `docs/JOURNAL.md` 2026-08-14 항목이 경고로 남겨뒀다.

- [ ] **Step 5: 검증 + 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "chore(web): Next.js 스캐폴딩 + 테스트 하네스, CI 가드 제거"
```

---

## Task 3: 로그인과 BFF 토큰 교환

**Files:**
- Create: `frontend/src/app/login/page.tsx`, `frontend/src/app/auth/callback/page.tsx`
- Create: `frontend/src/app/api/auth/{login,refresh,logout}/route.ts`
- Create: `frontend/src/features/auth/{api,queries,schema}.ts`, `components/KakaoLoginButton.tsx`
- Create: `frontend/src/lib/session.ts` — accessToken 메모리 보관
- Test: `LoginPage.test.tsx`, `AuthCallbackPage.test.tsx`, `auth-login-route.test.ts`

**Covers:** AC-WEB-03, AC-WEB-04, AC-WEB-05, AC-WEB-06

**Interfaces:**
- Consumes: `apiClient`(Task 2)
- Produces: `getAccessToken()`/`setAccessToken()`(메모리), `POST /api/auth/login|refresh|logout` — Task 4의 401 재시도가 refresh를 쓴다

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// src/app/login/LoginPage.test.tsx
describe('LoginPage', () => {
  it('AC-WEB-03 · 카카오 로그인 버튼이 카카오 인가 URL로 보낸다', async () => {
    render(<LoginPage searchParams={{ next: '/recipes/1' }} />);

    await userEvent.click(screen.getByRole('button', { name: '카카오로 로그인' }));

    expect(assignedUrl).toContain('https://kauth.kakao.com/oauth/authorize');
    expect(assignedUrl).toContain('response_type=code');
    expect(assignedUrl).toContain('client_id=');
    expect(assignedUrl).toContain('redirect_uri=');
  });
});
```

```tsx
// src/app/auth/callback/AuthCallbackPage.test.tsx
it('AC-WEB-04 · 인가코드를 BFF에 넘기고 next 경로로 돌아간다', async () => {
  server.use(
    http.post('/api/auth/login', async ({ request }) => {
      expect(await request.json()).toEqual({ code: 'test-code' });
      return HttpResponse.json({ accessToken: 'a.b.c', userId: 7, nickname: '테스터' });
    }),
  );

  render(<AuthCallbackPage searchParams={{ code: 'test-code', next: '/recipes/1' }} />);

  await waitFor(() => expect(pushed).toBe('/recipes/1'));
});

it('AC-WEB-06 · accessToken을 브라우저 저장소에 쓰지 않는다', async () => {
  // 로그인 성공 후
  const all = [
    ...Object.values({ ...localStorage }),
    ...Object.values({ ...sessionStorage }),
  ].join('|');
  expect(all).not.toContain('a.b.c');
});
```

```ts
// src/app/api/auth/login/auth-login-route.test.ts
it('AC-WEB-05 · refreshToken은 본문에 없고 httpOnly 쿠키로 나간다', async () => {
  server.use(
    http.post('http://localhost:8080/api/v1/auth/login/kakao', () =>
      HttpResponse.json({
        tokens: { accessToken: 'a.b.c', refreshToken: 'r.e.f', expiresInSeconds: 1800 },
        userId: 7,
        nickname: '테스터',
        newUser: false,
      }),
    ),
  );

  const res = await POST(new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ code: 'test-code' }),
  }));

  const body = await res.json();
  expect(body).not.toHaveProperty('refreshToken');
  expect(body.accessToken).toBe('a.b.c');

  const setCookie = res.headers.get('set-cookie') ?? '';
  expect(setCookie).toContain('kaldi_refresh=');
  expect(setCookie).toContain('HttpOnly');
  expect(setCookie).toContain('SameSite=Lax');
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- auth`
Expected: FAIL — 모듈이 없어 import 단계에서 깨진다

- [ ] **Step 3: 최소 구현**

- `features/auth/schema.ts` — `LoginResponse`·`TokenPair`를 Zod로 정의하고 `z.infer`로 타입을 뽑는다
- `app/api/auth/login/route.ts` — 백엔드를 부르고, `tokens.refreshToken`을 `kaldi_refresh` 쿠키(`httpOnly`, `sameSite: 'lax'`, `path: '/'`, `maxAge`는 14일)로 심고, 본문에는 `accessToken`·`userId`·`nickname`만 담아 돌려준다
- `lib/session.ts` — 모듈 스코프 변수에 accessToken을 보관한다. **저장소에 쓰지 않는다**
- `app/login/page.tsx` — `next`를 인가 URL의 `state`나 `redirect_uri` 쿼리로 보존한다

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- auth`
Expected: PASS, 4 tests

- [ ] **Step 5: 커밋**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 카카오 로그인 + BFF 토큰 교환 (AC-WEB-03~06)" && cd frontend
```

---

## Task 4: 인증 가드와 401 재시도

**Files:**
- Modify: `frontend/src/lib/api-client.ts` — 401 → refresh 1회 → 재시도
- Create: `frontend/src/features/auth/guard.ts` 또는 `middleware.ts`
- Test: `RecipesPage.test.tsx`(가드·재시도 부분)

**Covers:** AC-WEB-01, AC-WEB-02, AC-WEB-07, AC-WEB-08

**Interfaces:**
- Consumes: `POST /api/auth/refresh`(Task 3), `apiClient`(Task 2)
- Produces: 401을 스스로 처리하는 `apiClient` — Task 5·6은 이걸 그냥 쓰기만 하면 된다

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it('AC-WEB-01 · 미인증으로 목록에 접근하면 로그인으로 보낸다', async () => {
  setAccessToken(null);
  render(<RecipesPage />);
  await waitFor(() => expect(pushed).toBe('/login?next=%2Frecipes'));
});

it('AC-WEB-07 · 401을 받으면 refresh를 1회 하고 원 요청을 재시도한다', async () => {
  let listCalls = 0;
  let refreshCalls = 0;
  server.use(
    http.get('http://localhost:8080/api/v1/recipes', () => {
      listCalls += 1;
      return listCalls === 1
        ? HttpResponse.json({ code: 'UNAUTHORIZED', message: '인증이 필요합니다.' }, { status: 401 })
        : HttpResponse.json(emptyPage);
    }),
    http.post('/api/auth/refresh', () => {
      refreshCalls += 1;
      return HttpResponse.json({ accessToken: 'new.token' });
    }),
  );

  render(<RecipesPage />);

  await waitFor(() => expect(refreshCalls).toBe(1));
  expect(listCalls).toBe(2);
});

it('AC-WEB-08 · refresh가 무효면 재시도 없이 로그인으로 보낸다', async () => {
  // refresh가 REFRESH_TOKEN_INVALID → listCalls는 1에 머물고 pushed는 /login?next=%2Frecipes
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- RecipesPage`
Expected: FAIL — 재시도 로직이 없어 `refreshCalls`가 0이다

- [ ] **Step 3: 최소 구현**

`apiClient`에 401 처리를 넣는다. **재시도는 정확히 1회**이고, refresh 자체가 실패하거나 `code`가 `REFRESH_TOKEN_INVALID`면 재시도하지 않고 `/login?next=<현재경로>`로 보낸다.

> **동시에 여러 요청이 401을 받는 경우를 주의한다.** 상세 화면은 레시피·브루어·필터를 함께 부르므로 refresh가 3번 호출될 수 있다. 진행 중인 refresh Promise를 공유해 1회로 합친다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- RecipesPage`
Expected: PASS, 4 tests

- [ ] **Step 5: 커밋**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 인증 가드와 401 자동 갱신 (AC-WEB-01·02·07·08)" && cd frontend
```

---

## Task 5: 레시피 목록

**Files:**
- Create: `frontend/src/app/recipes/page.tsx`
- Create: `frontend/src/features/recipe/{api,queries,schema}.ts`, `components/RecipeCard.tsx`
- Test: `RecipesPage.test.tsx`(목록 부분), `RecipeCard.test.tsx`

**Covers:** AC-WEB-09, AC-WEB-10, AC-WEB-11, AC-WEB-12, AC-WEB-13

**Interfaces:**
- Consumes: `apiClient`(Task 4)
- Produces: `recipeSummarySchema`, `useRecipeList()` — Task 6이 같은 스키마 모듈을 쓴다

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
it('AC-WEB-09 · 카드에 추출 파라미터가 표시된다', async () => {
  server.use(http.get('http://localhost:8080/api/v1/recipes', () =>
    HttpResponse.json(pageOf([hoffmannSummary]))));

  render(<RecipesPage />);

  expect(await screen.findByText('James Hoffmann Ultimate V60')).toBeInTheDocument();
  expect(screen.getByText(/30\.0g/)).toBeInTheDocument();
  expect(screen.getByText(/500\.0g/)).toBeInTheDocument();
  expect(screen.getByText('1:16.7')).toBeInTheDocument();
  expect(screen.getByText('100°C')).toBeInTheDocument();
  expect(screen.getByText('3:30')).toBeInTheDocument();
});

it('AC-WEB-12 · 더 보기가 다음 페이지를 뒤에 이어붙인다', async () => {
  // page=0 → 20건 hasNext:true, page=1 → 20건 hasNext:false
  render(<RecipesPage />);
  await userEvent.click(await screen.findByRole('button', { name: '더 보기' }));

  await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(40));
  expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- Recipe`
Expected: FAIL — 페이지가 없다

- [ ] **Step 3: 최소 구현**

`useInfiniteQuery`로 `getNextPageParam`을 `hasNext ? page + 1 : undefined`로 둔다. 카드는 `<Link href={`/recipes/${id}`}>`로 감싼다(AC-WEB-12가 `getAllByRole('link')`로 센다).

`m:ss` 포맷과 `1:16.7` 조립은 `lib/utils.ts`에 순수 함수로 두고 별도 단위 테스트를 붙인다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test -- Recipe`
Expected: PASS, 5 tests

- [ ] **Step 5: 커밋**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 레시피 목록 + 더 보기 (AC-WEB-09~13)" && cd frontend
```

---

## Task 6: 레시피 상세와 포크

**Files:**
- Create: `frontend/src/app/recipes/[id]/page.tsx`
- Create: `frontend/src/features/recipe/components/{RecipeStepList,ForkButton}.tsx`
- Create: `frontend/src/features/gear/{api,queries,schema}.ts`
- Test: `RecipeDetailPage.test.tsx`, `RecipeStepList.test.tsx`

**Covers:** AC-WEB-14 ~ AC-WEB-25 (12개)

**Interfaces:**
- Consumes: `recipeSchema`(Task 5), `apiClient`(Task 4), 로그인 응답의 `userId`(Task 3)

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// RecipeStepList.test.tsx
it('AC-WEB-16 · 붓는 스텝의 누적 물량이 표시된다', () => {
  render(<RecipeStepList steps={hoffmannSteps} />);

  expect(screen.getByText('누적 60g')).toBeInTheDocument();
  expect(screen.getByText('누적 300g')).toBeInTheDocument();
  expect(screen.getByText('누적 500g')).toBeInTheDocument();
});

it('AC-WEB-17 · 붓지 않는 스텝에는 물량이 표시되지 않는다', () => {
  render(<RecipeStepList steps={[waitStep]} />);
  expect(screen.queryByText(/\dg/)).not.toBeInTheDocument();
});
```

```tsx
// RecipeDetailPage.test.tsx
it('AC-WEB-18 · 분쇄도가 없으면 그 영역이 렌더링되지 않는다', async () => {
  render(<RecipeDetailPage params={{ id: '1' }} />);
  await screen.findByText('James Hoffmann Ultimate V60');
  expect(screen.queryByText('분쇄도')).not.toBeInTheDocument();
});

it('AC-WEB-23 · 내 레시피에는 포크 버튼이 없다', async () => {
  setCurrentUserId(7);
  server.use(http.get('http://localhost:8080/api/v1/recipes/1', () =>
    HttpResponse.json({ ...hoffmann, ownerUserId: 7 })));

  render(<RecipeDetailPage params={{ id: '1' }} />);
  await screen.findByText('James Hoffmann Ultimate V60');
  expect(screen.queryByRole('button', { name: '내 레시피로 가져오기' })).not.toBeInTheDocument();
});

it('AC-WEB-24 · 포크에 성공하면 새 레시피로 이동한다', async () => {
  server.use(http.post('http://localhost:8080/api/v1/recipes/1/fork', () =>
    HttpResponse.json({ ...hoffmann, id: 42, ownerUserId: 7 }, { status: 201 })));

  render(<RecipeDetailPage params={{ id: '1' }} />);
  await userEvent.click(await screen.findByRole('button', { name: '내 레시피로 가져오기' }));

  await waitFor(() => expect(pushed).toBe('/recipes/42'));
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm test -- RecipeDetail RecipeStepList`
Expected: FAIL — 컴포넌트가 없다

- [ ] **Step 3: 최소 구현**

- `RecipeStepList` — `stepOrder` 순으로 렌더링하고, 붓는 스텝만 누적 물량을 계산한다. **`key`는 `step.id`를 쓴다**(인덱스 금지)
- 장비 이름은 `useQuery`로 `/gear/brewers`·`/gear/filters`를 부르고 `staleTime: Infinity`로 둔다(마스터 데이터다)
- 포크 버튼은 `ownerUserId !== currentUserId`일 때만 렌더링한다. `ownerUserId`가 없으면(주인 없는 CURATED) 항상 보인다
- 포크 실패 시 `mutation.error`의 `message`를 표시하고 버튼을 다시 활성화한다

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `pnpm test`
Expected: PASS — 전체 테스트 초록

- [ ] **Step 5: 커밋**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd .. && git add . && git commit -m "feat(web): 레시피 상세 + 푸어 스텝 + 포크 (AC-WEB-14~25)" && cd frontend
```

---

## 완료 기준

- [ ] `cd backend && ./gradlew clean check` 통과
- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 전부 통과
- [ ] `./scripts/check-spec-coverage.sh` 통과 — AC 28개가 모두 테스트에서 발견된다
- [ ] `.github/workflows/frontend.yml`의 임시 가드가 **제거**되어 CI가 실제로 검사한다
- [ ] 스펙 `docs/specs/2026-08-21-web-recipe-read.md`의 `status`를 `구현완료`로 변경
- [ ] `frontend/CLAUDE.md`의 "현재 상태: 미착수" 문구를 갱신한다
- [ ] 실제 카카오 계정으로 로그인 → 목록 → 상세 → 포크가 끝까지 동작한다
- [ ] 375px 뷰포트에서 네 화면 모두 가로 스크롤이 없다
- [ ] 개발자도구 Application 탭에서 `kaldi_refresh`에 `HttpOnly`가 켜져 있고 `localStorage`가 비어 있다

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 28개 중 28개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** 백엔드 응답 필드명을 실제 OpenAPI 문서에서 확인해 반영함 — `LoginResponse{tokens:{accessToken,refreshToken,expiresInSeconds},userId,nickname,newUser}`, `RecipeResponse`에 장비는 `brewerId`·`filterId`만(이름 없음), `PageResponse{content,page,size,totalElements,totalPages,hasNext}`, `ErrorResponse{code,message,fieldErrors}`

**검증되지 않은 가정:**

1. **`create-next-app`을 비어 있지 않은 `frontend/`에 돌릴 때 `CLAUDE.md`가 보존되는가.** 덮어쓰기 경고가 날 수 있다. Task 2 Step 1에서 확인하고, 위험하면 파일을 옮겼다가 되돌린다.
2. **Next 15/16의 `searchParams`·`params`가 Promise인가.** App Router의 최신 버전은 이 둘을 비동기로 넘긴다. 테스트에서 동기 객체로 렌더링하면 어긋난다 — Task 3 Step 2에서 실제 버전을 확인하고 테스트 시그니처를 맞춘다.
3. **Route Handler를 Vitest에서 직접 import해 호출할 수 있는가.** `NextResponse.cookies` API가 jsdom 환경에서 동작하는지 확인이 필요하다. 안 되면 `environment: 'node'`를 그 테스트 파일에만 지정한다.
4. **`OPTIONS` 프리플라이트가 Spring Security 인가 필터보다 앞서는가.** `.cors()`를 넣으면 `CorsFilter`가 앞단에서 처리하는 것이 정상이지만, 순서가 어긋나면 `AC-CORS-03`이 401로 실패한다. 그 경우 `authorizeHttpRequests`에 `OPTIONS` permitAll을 추가한다.
5. **MSW가 상대 경로(`/api/auth/login`)를 jsdom에서 가로채는가.** BFF 호출은 상대 경로라 절대 URL 핸들러와 다르게 동작할 수 있다. Task 3에서 확인하고, 안 되면 테스트에서 `http://localhost:3000`을 명시한다.

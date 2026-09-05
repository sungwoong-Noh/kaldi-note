# 테스트 로그인 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-05-test-login.md`

**Goal:** 카카오 계정 없이 운영에 로그인할 수 있고, 계정 둘을 만들어 맞팔로우를 검증할 수 있다.

**Architecture:** **잠금을 먼저 만들고 기능을 나중에 붙인다.** Task 1이 `POST /api/v1/auth/login/test`를 만들되 **언제나 404를 내는 상태**로 두고 시크릿 판정만 완성한다. Task 2가 그 뒤에 실제 발급을 얹는다. 이 순서라야 「잠금이 없는 채로 동작하는 엔드포인트」가 저장소에 단 한 커밋도 존재하지 않는다. 프론트는 시크릿을 **저장하지 않고 사람이 입력한 값을 흘려보내기만** 한다.

**작업 위치:** `backend/`(Task 1~2) → `frontend/`(Task 3~4)

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → **`docs/specs/2026-09-05-test-login.md`의 맨 위 경고 상자** → `backend/CLAUDE.md` → `frontend/CLAUDE.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-TESTLOGIN-07 | 32자면 켜진다 | Task 1 | API 테스트 |
| AC-TESTLOGIN-08 | 31자면 안 켜진다 | Task 1 | API 테스트 |
| AC-TESTLOGIN-09 | 미설정이면 404 | Task 1 | API 테스트 |
| AC-TESTLOGIN-10 | 헤더 없으면 404 | Task 1 | API 테스트 |
| AC-TESTLOGIN-11 | 헤더 틀리면 404 | Task 1 | API 테스트 |
| AC-TESTLOGIN-17 | `/login/test` 매핑이 이긴다 | Task 1 | API 테스트 |
| AC-TESTLOGIN-01 | userId로 로그인 | Task 2 | API 테스트 |
| AC-TESTLOGIN-02 | handle로 생성 | Task 2 | API 테스트 |
| AC-TESTLOGIN-03 | handle 재사용 | Task 2 | API 테스트 |
| AC-TESTLOGIN-04 | 첫 토큰은 USER | Task 2 | API 테스트 |
| AC-TESTLOGIN-05 | 갱신하면 진짜 역할 (한계) | Task 2 | API 테스트 |
| AC-TESTLOGIN-06 | refresh가 동작한다 | Task 2 | API 테스트 |
| AC-TESTLOGIN-12 | 둘 다 주면 400 | Task 2 | API 테스트 |
| AC-TESTLOGIN-13 | 둘 다 없으면 400 | Task 2 | API 테스트 |
| AC-TESTLOGIN-14 | 없는 userId면 404 NOT_FOUND | Task 2 | API 테스트 |
| AC-TESTLOGIN-15 | WARN 로그가 남는다 | Task 2 | API 테스트 |
| AC-TESTLOGIN-16 | 기존 OAuth 회귀 | Task 2 | API 테스트 |
| AC-TESTLOGIN-19 | 헤더를 백엔드로 전달 | Task 3 | 라우트 테스트 |
| AC-TESTLOGIN-20 | 성공하면 쿠키·홈 | Task 3·4 | 라우트+화면 |
| AC-TESTLOGIN-21 | 실패하면 쿠키 없음 | Task 3·4 | 라우트+화면 |
| AC-TESTLOGIN-18 | 입력칸과 버튼 | Task 4 | 화면 |
| AC-TESTLOGIN-22 | 시크릿이 프론트에 없다 | Task 4 | 단위 |

**스펙의 AC 22개 중 22개가 매핑됐다.**

---

## Global Constraints

- **★ 잠금 없이 동작하는 커밋을 만들지 않는다.** Task 1이 끝날 때까지 이 엔드포인트는 언제나 404다.
- **★ `@Valid`를 쓰지 않는다.** 검증이 시크릿 검사보다 먼저 돌면, 400이 나오는 것만으로 **경로가 존재한다는 사실이 새어 나간다.** 본문은 시크릿 검사 뒤에 손으로 파싱한다.
- **★ 본문을 `String`으로 받는다.** `@RequestBody TestLoginRequest`로 받으면 잘못된 JSON이 시크릿 검사 전에 400을 낸다 — 같은 누출이다.
- **시크릿 비교는 `MessageDigest.isEqual`로 한다.** `String.equals`는 앞자리부터 갈리는 지점에 따라 시간이 달라진다.
- **프론트에 `NEXT_PUBLIC_` 시크릿을 만들지 않는다.** 번들에 박혀 누구나 읽는다. AC-TESTLOGIN-22가 이것을 잡는다.
- **`AuthService.login`(OAuth)을 고치지 않는다.** 새 메서드를 더한다. AC-TESTLOGIN-16이 회귀를 잡는다.
- **`any` 금지, `as` 단언 금지, `!` 금지.**
- 백엔드 커밋 전 `./gradlew spotlessApply && ./gradlew clean check`. 프론트 커밋 전 `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

---

## File Structure

```
backend/src/
├── main/
│   ├── java/com/kaldinote/auth/
│   │   ├── domain/OAuthProvider.java                      Modify — TEST 추가
│   │   ├── application/AuthService.java                   Modify — testLogin()
│   │   ├── infrastructure/TestLoginProperties.java        Create
│   │   ├── infrastructure/TestLoginConfig.java            Create — @EnableConfigurationProperties
│   │   └── presentation/AuthController.java               Modify — POST /login/test
│   └── resources/application.yml                          Modify — kaldi.test-login.secret
└── test/java/com/kaldinote/auth/presentation/
    └── AuthControllerTest.java                            Modify — AC 17개

frontend/src/
├── app/
│   ├── api/auth/test-login/route.ts                       Create — BFF
│   ├── api/auth/test-login/route.test.ts                  Create
│   └── login/test/
│       ├── page.tsx                                       Create
│       └── page.test.tsx                                  Create
└── test/no-public-secret.test.ts                          Create — AC-22

infra/.env.example                                         Modify — KALDI_TEST_LOGIN_SECRET
docs/specs/2026-09-05-test-login.md                        Modify — status
```

---

## Task 1: 잠금 — 언제나 404인 엔드포인트

**Files:**
- Create: `backend/src/main/java/com/kaldinote/auth/infrastructure/TestLoginProperties.java`
- Create: `backend/src/main/java/com/kaldinote/auth/infrastructure/TestLoginConfig.java`
- Modify: `backend/src/main/java/com/kaldinote/auth/domain/OAuthProvider.java`
- Modify: `backend/src/main/java/com/kaldinote/auth/presentation/AuthController.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/test/java/com/kaldinote/auth/presentation/AuthControllerTest.java`

**Covers:** AC-TESTLOGIN-07, 08, 09, 10, 11, 17

**Interfaces:**
- Produces: `TestLoginProperties.enabled(): boolean` — 시크릿이 32자 이상일 때만 true
- Produces: `TestLoginProperties.matches(String candidate): boolean` — 꺼져 있으면 언제나 false
- Produces: `POST /api/v1/auth/login/test` — **이 태스크에서는 통과해도 404를 낸다.** Task 2가 채운다

- [ ] **Step 1: 시작 전 초록을 확인한다**

Run: `docker compose up -d && cd backend && ./gradlew clean check`
Expected: PASS. **숫자를 적어둔다**(482개일 것).

- [ ] **Step 2: 실패하는 테스트 작성**

Modify `AuthControllerTest.java`. **시크릿을 테스트마다 바꿔야 하므로 `@SpringBootTest`의 프로퍼티를 갈아끼우는 중첩 클래스로 나눈다.** 기존 테스트는 건드리지 않는다.

```java
  private static final String SECRET_32 = "0123456789abcdef0123456789abcdef";
  private static final String SECRET_31 = "0123456789abcdef0123456789abcde";

  @Nested
  @TestPropertySource(properties = "kaldi.test-login.secret=" + SECRET_32)
  class 시크릿이_32자일_때 {

    @Test
    @DisplayName("AC-TESTLOGIN-10 · 헤더가 없으면 404다")
    void 헤더가_없으면_404다() throws Exception {
      mockMvc
          .perform(
              post("/api/v1/auth/login/test")
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"userId\":1}"))
          .andExpect(status().isNotFound())
          .andExpect(jsonPath("$.code").value("ENDPOINT_NOT_FOUND"));
    }

    @Test
    @DisplayName("AC-TESTLOGIN-11 · 헤더가 틀리면 401이 아니라 404다")
    void 헤더가_틀리면_404다() throws Exception {
      mockMvc
          .perform(
              post("/api/v1/auth/login/test")
                  .header("X-Test-Login-Secret", "wrongwrongwrongwrongwrongwrongwr")
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"userId\":1}"))
          .andExpect(status().isNotFound())
          .andExpect(jsonPath("$.code").value("ENDPOINT_NOT_FOUND"));
    }
  }

  @Nested
  @TestPropertySource(properties = "kaldi.test-login.secret=" + SECRET_31)
  class 시크릿이_31자일_때 {

    @Test
    @DisplayName("AC-TESTLOGIN-08 · 31자면 켜지지 않는다")
    void 켜지지_않는다() throws Exception {
      mockMvc
          .perform(
              post("/api/v1/auth/login/test")
                  .header("X-Test-Login-Secret", SECRET_31)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"userId\":1}"))
          .andExpect(status().isNotFound())
          .andExpect(jsonPath("$.code").value("ENDPOINT_NOT_FOUND"));
    }
  }

  @Nested
  @TestPropertySource(properties = "kaldi.test-login.secret=")
  class 시크릿이_없을_때 {

    @Test
    @DisplayName("AC-TESTLOGIN-09 · 미설정이면 없는 경로처럼 답한다")
    void 없는_경로처럼_답한다() throws Exception {
      mockMvc
          .perform(
              post("/api/v1/auth/login/test")
                  .header("X-Test-Login-Secret", SECRET_32)
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"userId\":1}"))
          .andExpect(status().isNotFound())
          .andExpect(jsonPath("$.code").value("ENDPOINT_NOT_FOUND"))
          .andExpect(jsonPath("$.message").value("요청하신 주소를 찾을 수 없습니다."));
    }

    @Test
    @DisplayName("AC-TESTLOGIN-17 · OAuth 본문 모양으로 불러도 테스트 핸들러가 받는다")
    void 오어스_본문으로_불러도_테스트_핸들러가_받는다() throws Exception {
      // OAuthProvider에 TEST를 더하면 /login/{provider} 템플릿도 이 경로의 후보가 된다.
      // 템플릿이 이기면 code가 ENDPOINT_NOT_FOUND가 아닌 다른 값이 된다.
      mockMvc
          .perform(
              post("/api/v1/auth/login/test")
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"code\":\"anything\"}"))
          .andExpect(status().isNotFound())
          .andExpect(jsonPath("$.code").value("ENDPOINT_NOT_FOUND"));
    }
  }
```

**AC-TESTLOGIN-07(32자면 켜진다)은 Task 2에서 200을 단언한다** — 지금은 켜져도 404라 구별되지 않는다. 이 태스크에서는 쓰지 않는다.

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `cd backend && ./gradlew test --tests '*AuthControllerTest'`
Expected: FAIL — 4개. 매핑이 없어 `ENDPOINT_NOT_FOUND`가 나오긴 하지만, **AC-TESTLOGIN-17만 통과하고 나머지 셋도 우연히 통과할 수 있다.** 그러면 **빨간불을 못 본 것이므로** Step 4를 하고 다시 확인한다.

- [ ] **Step 4: 프로퍼티와 매핑을 만든다**

Create `TestLoginProperties.java`:

```java
package com.kaldinote.auth.infrastructure;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 테스트 로그인의 잠금.
 *
 * <p><b>이 클래스가 인증 우회의 유일한 문지기다.</b> 스펙(docs/specs/2026-09-05-test-login.md)의 경고
 * 상자를 먼저 읽는다 — 이 시크릿이 새면 운영의 모든 계정으로 로그인할 수 있다.
 */
@ConfigurationProperties(prefix = "kaldi.test-login")
public record TestLoginProperties(String secret) {

  /** 짧은 시크릿은 없는 것보다 나쁘다 — 있다고 안심하게 만든다. */
  private static final int MIN_SECRET_LENGTH = 32;

  public boolean enabled() {
    return secret != null && secret.length() >= MIN_SECRET_LENGTH;
  }

  /**
   * 상수 시간 비교.
   *
   * <p>String.equals는 앞자리부터 갈리는 지점에 따라 걸리는 시간이 달라져, 한 글자씩 맞춰 가며
   * 시크릿을 복원할 수 있다.
   */
  public boolean matches(String candidate) {
    if (!enabled() || candidate == null) {
      return false;
    }
    return MessageDigest.isEqual(
        secret.getBytes(StandardCharsets.UTF_8), candidate.getBytes(StandardCharsets.UTF_8));
  }
}
```

Create `TestLoginConfig.java` — `JwtConfig`와 같은 모양으로 `@Configuration @EnableConfigurationProperties(TestLoginProperties.class)`만 둔다.

Modify `application.yml` — `kaldi:` 아래에 더한다:

```yaml
  # 테스트 로그인. 비워두면 기능이 꺼지고 경로가 없는 것처럼 행동한다.
  # 32자 미만이면 켜지지 않는다. 이 값이 곧 모든 계정의 열쇠다.
  test-login:
    secret: ${KALDI_TEST_LOGIN_SECRET:}
```

Modify `OAuthProvider.java`:

```java
public enum OAuthProvider {
  KAKAO,
  GOOGLE,
  /** 테스트 로그인 전용. OAuth 클라이언트가 없다 — user_oauth_accounts를 구분하기 위한 값이다. */
  TEST
}
```

Modify `AuthController.java`:

```java
  /**
   * 테스트 로그인. **잠금은 여기 한 곳에만 있다.**
   *
   * <p>@Valid를 쓰지 않고 본문을 String으로 받는 이유: 검증이나 JSON 파싱이 시크릿 검사보다 먼저 돌면,
   * 400이 나오는 것만으로 이 경로가 존재한다는 사실이 새어 나간다.
   */
  @PostMapping("/login/test")
  public LoginResponse testLogin(
      @RequestHeader(value = "X-Test-Login-Secret", required = false) String secret,
      @RequestBody(required = false) String rawBody) {
    if (!testLoginProperties.matches(secret)) {
      throw new BusinessException(ErrorCode.ENDPOINT_NOT_FOUND);
    }
    throw new BusinessException(ErrorCode.ENDPOINT_NOT_FOUND); // Task 2에서 채운다
  }
```

`private final TestLoginProperties testLoginProperties;`를 필드에 더한다.

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `cd backend && ./gradlew test --tests '*AuthControllerTest'`
Expected: PASS. 기존 `AC-AUTH-*`도 전부 초록이어야 한다.

- [ ] **Step 6: 돌연변이로 잠금을 확인한다 — 이 태스크에서는 불가능하다**

`TestLoginProperties.MIN_SECRET_LENGTH`를 `31`로 바꿔 **실제로 돌려봤고, 5개가 전부 그대로 초록이었다**(2026-09-05).

**당연한 결과다.** 이 태스크의 핸들러는 **잠금을 통과해도 404를 던진다.** 길이 판정이 뒤집혀도 응답이 같아서 어떤 테스트도 구별하지 못한다. `AC-TESTLOGIN-08`이 Step 3에서 빨갰던 것은 길이 판정 때문이 아니라 **매핑이 없어 400이 났기 때문**이다.

**그러므로 잠금의 돌연변이 검사는 Task 2에서 밟는다** — 거기서 `AC-TESTLOGIN-07`이 200을 단언하므로 404와 구별된다. Task 2 Step 7(role 돌연변이) 옆에서 함께 밟는다.

- [ ] **Step 7: 커밋**

```bash
cd backend && ./gradlew spotlessApply && ./gradlew clean check
cd .. && git add backend && git commit -m "feat(backend): 테스트 로그인의 잠금 — 아직 언제나 404다 (AC-TESTLOGIN 6개)"
```

---

## Task 2: 발급

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/auth/application/AuthService.java`
- Modify: `backend/src/main/java/com/kaldinote/auth/presentation/AuthController.java`
- Create: `backend/src/main/java/com/kaldinote/auth/presentation/dto/TestLoginRequest.java`
- Modify: `backend/src/test/java/com/kaldinote/auth/presentation/AuthControllerTest.java`
- Modify: `infra/.env.example`

**Covers:** AC-TESTLOGIN-01, 02, 03, 04, 05, 06, 07, 12, 13, 14, 15, 16

**Interfaces:**
- Produces: `record TestLoginRequest(Long userId, String handle, String nickname)`
- Produces: `AuthService.testLogin(TestLoginRequest request): LoginResult`
  - `userId`와 `handle`이 **정확히 하나**여야 한다. 아니면 `BusinessException(INVALID_REQUEST)`
  - `userId` 경로: 없으면 `BusinessException(NOT_FOUND)`
  - `handle` 경로: `(TEST, handle)`로 찾고 없으면 `User.create(null, nickname, null)` + `UserOAuthAccount.of(id, TEST, handle)`
  - **access token의 role은 언제나 `UserRole.USER`다**
- Consumes: Task 1의 `TestLoginProperties.matches`

- [ ] **Step 1: 실패하는 테스트 작성**

Modify `AuthControllerTest.java`의 `시크릿이_32자일_때` 중첩 클래스 안에 더한다.

```java
    private ResultActions callTestLogin(String body) throws Exception {
      return mockMvc.perform(
          post("/api/v1/auth/login/test")
              .header("X-Test-Login-Secret", SECRET_32)
              .contentType(MediaType.APPLICATION_JSON)
              .content(body));
    }

    @Test
    @DisplayName("AC-TESTLOGIN-01 · userId로 로그인한다")
    void userId로_로그인한다() throws Exception {
      User user = userRepository.save(User.create("me@example.com", "노성웅", null));

      callTestLogin("{\"userId\":" + user.getId() + "}")
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.userId").value(user.getId()))
          .andExpect(jsonPath("$.newUser").value(false))
          .andExpect(jsonPath("$.tokens.accessToken").isNotEmpty())
          .andExpect(jsonPath("$.tokens.refreshToken").isNotEmpty());
    }

    @Test
    @DisplayName("AC-TESTLOGIN-07 · 시크릿이 정확히 32자면 켜진다")
    void 시크릿이_정확히_32자면_켜진다() throws Exception {
      User user = userRepository.save(User.create(null, "노성웅", null));

      callTestLogin("{\"userId\":" + user.getId() + "}").andExpect(status().isOk());
    }

    @Test
    @DisplayName("AC-TESTLOGIN-02 · handle로 처음 부르면 계정이 생긴다")
    void handle로_처음_부르면_계정이_생긴다() throws Exception {
      callTestLogin("{\"handle\":\"friend\",\"nickname\":\"확인용친구\"}")
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.newUser").value(true))
          .andExpect(jsonPath("$.nickname").value("확인용친구"));

      assertThat(
              oauthAccountRepository.findByProviderAndProviderUserId(
                  OAuthProvider.TEST, "friend"))
          .isPresent();
    }

    @Test
    @DisplayName("AC-TESTLOGIN-03 · 같은 handle을 다시 부르면 재사용한다")
    void 같은_handle을_다시_부르면_재사용한다() throws Exception {
      String first =
          callTestLogin("{\"handle\":\"friend\",\"nickname\":\"확인용친구\"}")
              .andReturn()
              .getResponse()
              .getContentAsString();
      long firstId = JsonPath.read(first, "$.userId");
      long before = userRepository.count();

      callTestLogin("{\"handle\":\"friend\",\"nickname\":\"다른이름\"}")
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.userId").value(firstId))
          .andExpect(jsonPath("$.newUser").value(false));

      assertThat(userRepository.count()).isEqualTo(before);
    }

    @Test
    @DisplayName("AC-TESTLOGIN-04 · 대상이 ADMIN이어도 로그인 응답 토큰은 USER다")
    void 대상이_ADMIN이어도_로그인_토큰은_USER다() throws Exception {
      User admin = userRepository.save(User.createAdmin(null, "관리자", null));

      String body =
          callTestLogin("{\"userId\":" + admin.getId() + "}")
              .andExpect(status().isOk())
              .andReturn()
              .getResponse()
              .getContentAsString();

      String access = JsonPath.read(body, "$.tokens.accessToken");
      assertThat(tokenProvider.parseRole(access)).isEqualTo(UserRole.USER);
    }

    @Test
    @DisplayName("AC-TESTLOGIN-05 · 갱신하면 진짜 역할로 돌아온다 (알려진 한계)")
    void 갱신하면_진짜_역할로_돌아온다() throws Exception {
      // 결함을 고치는 조건이 아니라 못박는 조건이다.
      // AuthService.refresh가 역할을 DB에서 다시 읽는다.
      User admin = userRepository.save(User.createAdmin(null, "관리자", null));
      String body =
          callTestLogin("{\"userId\":" + admin.getId() + "}")
              .andReturn()
              .getResponse()
              .getContentAsString();
      String refresh = JsonPath.read(body, "$.tokens.refreshToken");

      String refreshed =
          mockMvc
              .perform(
                  post("/api/v1/auth/refresh")
                      .contentType(MediaType.APPLICATION_JSON)
                      .content("{\"refreshToken\":\"" + refresh + "\"}"))
              .andExpect(status().isOk())
              .andReturn()
              .getResponse()
              .getContentAsString();

      assertThat(tokenProvider.parseRole(JsonPath.read(refreshed, "$.accessToken")))
          .isEqualTo(UserRole.ADMIN);
    }

    @Test
    @DisplayName("AC-TESTLOGIN-06 · 발급된 refresh 토큰이 실제로 동작한다")
    void 발급된_refresh_토큰이_동작한다() throws Exception {
      User user = userRepository.save(User.create(null, "노성웅", null));
      String body =
          callTestLogin("{\"userId\":" + user.getId() + "}")
              .andReturn()
              .getResponse()
              .getContentAsString();
      String refresh = JsonPath.read(body, "$.tokens.refreshToken");

      mockMvc
          .perform(
              post("/api/v1/auth/refresh")
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"refreshToken\":\"" + refresh + "\"}"))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    @DisplayName("AC-TESTLOGIN-12 · userId와 handle을 둘 다 주면 400이다")
    void 둘_다_주면_400이다() throws Exception {
      callTestLogin("{\"userId\":1,\"handle\":\"friend\"}")
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("AC-TESTLOGIN-13 · 둘 다 없으면 400이다")
    void 둘_다_없으면_400이다() throws Exception {
      callTestLogin("{}")
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("AC-TESTLOGIN-14 · 없는 userId면 404 NOT_FOUND다")
    void 없는_userId면_404다() throws Exception {
      callTestLogin("{\"userId\":999999}")
          .andExpect(status().isNotFound())
          .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("AC-TESTLOGIN-15 · 쓰면 WARN 로그가 남는다")
    void 쓰면_WARN_로그가_남는다() throws Exception {
      User user = userRepository.save(User.create(null, "노성웅", null));
      Logger logger = (Logger) LoggerFactory.getLogger(AuthService.class);
      ListAppender<ILoggingEvent> appender = new ListAppender<>();
      appender.start();
      logger.addAppender(appender);

      callTestLogin("{\"userId\":" + user.getId() + "}").andExpect(status().isOk());

      logger.detachAppender(appender);
      assertThat(appender.list)
          .anySatisfy(
              event -> {
                assertThat(event.getLevel()).isEqualTo(Level.WARN);
                assertThat(event.getFormattedMessage())
                    .contains(String.valueOf(user.getId()));
              });
    }
```

> **`tokenProvider.parseRole`이 없을 수 있다.** 먼저 `JwtTokenProvider`를 읽고, 없으면 **테스트 안에서 JWT payload를 직접 디코딩한다**(`Base64.getUrlDecoder()`로 두 번째 세그먼트). **프로덕션 코드에 테스트용 메서드를 만들지 않는다.**
>
> **`User.createAdmin`이 없을 수 있다.** `User.java:45`에 `role = UserRole.ADMIN`을 세팅하는 자리가 있으니 그 팩터리 이름을 그대로 쓴다.

**AC-TESTLOGIN-16(기존 OAuth 회귀)은 새 테스트를 쓰지 않는다** — 기존 `AC-AUTH-*`가 전부 초록인지 확인하는 것이 그 조건이다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd backend && ./gradlew test --tests '*AuthControllerTest'`
Expected: FAIL — 11개. Task 1이 남긴 `throw ENDPOINT_NOT_FOUND`가 그대로 걸린다.

- [ ] **Step 3: 요청 DTO를 만든다**

Create `TestLoginRequest.java`:

```java
package com.kaldinote.auth.presentation.dto;

/**
 * 테스트 로그인 요청. **Bean Validation 애노테이션을 붙이지 않는다** — 검증이 시크릿 검사보다 먼저
 * 돌면 400이 나오는 것만으로 경로의 존재가 새어 나간다. 검사는 AuthService가 한다.
 */
public record TestLoginRequest(Long userId, String handle, String nickname) {}
```

- [ ] **Step 4: 서비스를 만든다**

Modify `AuthService.java` — 클래스에 `@Slf4j`를 더하고 메서드를 넣는다.

```java
  /**
   * OAuth 없이 세션을 발급한다. **인증 우회다** — docs/specs/2026-09-05-test-login.md의 경고 상자를 읽는다.
   *
   * <p>호출자(AuthController)가 시크릿을 이미 검사했다. 이 메서드는 잠금을 다시 하지 않는다 —
   * 문지기를 두 곳에 두면 한 곳만 고치는 사고가 난다.
   */
  @Transactional
  public LoginResult testLogin(Long userId, String handle, String nickname) {
    boolean byId = userId != null;
    boolean byHandle = handle != null && !handle.isBlank();
    if (byId == byHandle) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST, "userId와 handle 중 정확히 하나를 준다.");
    }

    boolean newUser = false;
    User user;
    if (byId) {
      user =
          userRepository
              .findById(userId)
              .orElseThrow(
                  () -> new BusinessException(ErrorCode.NOT_FOUND, "사용자를 찾을 수 없습니다: " + userId));
    } else {
      Optional<UserOAuthAccount> existing =
          oauthAccountRepository.findByProviderAndProviderUserId(OAuthProvider.TEST, handle);
      newUser = existing.isEmpty();
      if (newUser) {
        user = userRepository.save(User.create(null, nickname, null));
        oauthAccountRepository.save(UserOAuthAccount.of(user.getId(), OAuthProvider.TEST, handle));
      } else {
        user =
            userRepository
                .findById(existing.get().getUserId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
      }
    }

    // 흔적을 남긴다. 이 줄이 없으면 누가 언제 무엇으로 들어왔는지 알 방법이 없다.
    log.warn("테스트 로그인으로 세션을 발급했다: userId={}", user.getId());

    return new LoginResult(issueTestTokens(user), user.getId(), user.getNickname(), newUser);
  }

  /**
   * 첫 access token의 role을 USER로 고정한다.
   *
   * <p><b>이것은 보안 경계가 아니다.</b> refresh가 역할을 DB에서 다시 읽으므로 한 번 갱신하면 진짜
   * 역할이 실린다(AC-TESTLOGIN-05가 이 한계를 못박는다).
   */
  private TokenPair issueTestTokens(User user) {
    String access = tokenProvider.createAccessToken(user.getId(), UserRole.USER);
    String refresh = tokenProvider.createRefreshToken(user.getId());
    refreshTokenRepository.save(
        RefreshToken.issue(
            user.getId(), hash(refresh), Instant.now().plus(tokenProvider.getRefreshTokenTtl())));
    return new TokenPair(access, refresh, tokenProvider.getAccessTokenTtl().toSeconds());
  }
```

> `issueTokens`와 거의 같지만 **합치지 않는다.** 역할 인자를 받는 하나로 만들면 OAuth 경로에서 실수로 `USER`를 넘길 수 있다. 두 개로 두는 편이 안전하다.

- [ ] **Step 5: 컨트롤러의 `throw`를 채운다**

Modify `AuthController.java`:

```java
  @PostMapping("/login/test")
  public LoginResponse testLogin(
      @RequestHeader(value = "X-Test-Login-Secret", required = false) String secret,
      @RequestBody(required = false) String rawBody) {
    if (!testLoginProperties.matches(secret)) {
      throw new BusinessException(ErrorCode.ENDPOINT_NOT_FOUND);
    }

    TestLoginRequest request = parseTestLoginBody(rawBody);
    return LoginResponse.from(
        authService.testLogin(request.userId(), request.handle(), request.nickname()));
  }

  /** 시크릿 검사 뒤에만 부른다. 파싱 실패도 여기서 400이 된다 — 경로 존재는 이미 드러난 뒤다. */
  private TestLoginRequest parseTestLoginBody(String rawBody) {
    if (rawBody == null || rawBody.isBlank()) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "요청 본문이 없다.");
    }
    try {
      return objectMapper.readValue(rawBody, TestLoginRequest.class);
    } catch (JsonProcessingException e) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "요청 본문을 읽을 수 없다.");
    }
  }
```

`private final ObjectMapper objectMapper;`를 필드에 더한다.

- [ ] **Step 6: 테스트 실행 — 통과 확인**

Run: `cd backend && ./gradlew test --tests '*AuthControllerTest'`
Expected: PASS. 기존 `AC-AUTH-*`가 전부 초록이어야 한다(AC-TESTLOGIN-16).

- [ ] **Step 7: 돌연변이로 role 고정을 확인한다**

`issueTestTokens`의 `UserRole.USER`를 `user.getRole()`로 잠시 바꾼다.
Expected: **AC-TESTLOGIN-04만** 빨갛다. AC-TESTLOGIN-05는 초록 그대로다 — 갱신 뒤 동작은 원래 그렇다. 되돌린다.

- [ ] **Step 8: `.env.example`에 자리를 만든다**

Modify `infra/.env.example` — 파일 끝에 더한다.

```bash
# 테스트 로그인. OAuth 없이 세션을 발급하는 인증 우회다.
#
# ★ 이 값이 유출되면 운영의 모든 계정 — 실제 카카오·구글 계정 포함 — 으로 로그인할 수 있다.
#   32자 미만이면 기능이 켜지지 않는다. 만료가 없으므로 끄려면 이 줄을 지우고 재배포한다.
#   자세한 내용: docs/specs/2026-09-05-test-login.md의 경고 상자
KALDI_TEST_LOGIN_SECRET=
```

- [ ] **Step 9: 커밋**

```bash
cd backend && ./gradlew spotlessApply && ./gradlew clean check
cd .. && git add backend infra && git commit -m "feat(backend): 테스트 로그인 발급 (AC-TESTLOGIN 12개)"
```

---

## Task 3: BFF 라우트

**Files:**
- Create: `frontend/src/app/api/auth/test-login/route.ts`
- Create: `frontend/src/app/api/auth/test-login/route.test.ts`

**Covers:** AC-TESTLOGIN-19, 20(쿠키), 21(쿠키 없음)

**Interfaces:**
- Produces: `POST /api/auth/test-login` — 본문 `{secret, userId?, handle?, nickname?}`
  - `secret`은 **백엔드 헤더로만** 나가고 응답에 담기지 않는다
  - 성공하면 `kaldi_refresh` httpOnly 쿠키를 심고 `{accessToken, expiresInSeconds, userId, nickname, newUser}`를 준다
  - 실패하면 백엔드의 상태·본문을 그대로 넘기고 **쿠키를 심지 않는다**
- Consumes: 기존 `REFRESH_COOKIE_NAME`·`refreshCookieOptions`·`loginResponseSchema`·`backendUrl`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `frontend/src/app/api/auth/test-login/route.test.ts`. **`app/api/auth/login/route.test.ts`의 모양을 그대로 베껴 온다.**

```ts
it("AC-TESTLOGIN-19 · 시크릿을 헤더로 백엔드에 넘긴다", async () => {
  let seenHeader: string | null = null;
  let seenBody: unknown = null;
  server.use(
    http.post("*/api/v1/auth/login/test", async ({ request }) => {
      seenHeader = request.headers.get("X-Test-Login-Secret");
      seenBody = await request.json();
      return HttpResponse.json(loginPayload);
    }),
  );

  await POST(
    new Request("http://localhost:3000/api/auth/test-login", {
      method: "POST",
      body: JSON.stringify({ secret: SECRET_32, userId: 12 }),
    }),
  );

  expect(seenHeader).toBe(SECRET_32);
  expect(seenBody).toEqual({ userId: 12 });
});

it("AC-TESTLOGIN-20 · 성공하면 refresh 쿠키를 HttpOnly로 심는다", async () => {
  server.use(
    http.post("*/api/v1/auth/login/test", () => HttpResponse.json(loginPayload)),
  );

  const response = await POST(
    new Request("http://localhost:3000/api/auth/test-login", {
      method: "POST",
      body: JSON.stringify({ secret: SECRET_32, userId: 12 }),
    }),
  );

  const setCookie = response.headers.get("set-cookie") ?? "";
  expect(setCookie).toContain("kaldi_refresh=");
  expect(setCookie).toContain("HttpOnly");
  expect(await response.json()).not.toHaveProperty("secret");
});

it("AC-TESTLOGIN-21 · 404면 쿠키를 심지 않고 그대로 넘긴다", async () => {
  server.use(
    http.post("*/api/v1/auth/login/test", () =>
      HttpResponse.json(
        { code: "ENDPOINT_NOT_FOUND", message: "요청하신 주소를 찾을 수 없습니다." },
        { status: 404 },
      ),
    ),
  );

  const response = await POST(
    new Request("http://localhost:3000/api/auth/test-login", {
      method: "POST",
      body: JSON.stringify({ secret: "wrong", userId: 12 }),
    }),
  );

  expect(response.status).toBe(404);
  expect(response.headers.get("set-cookie")).toBeNull();
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test test-login`
Expected: FAIL — 모듈을 찾지 못한다.

- [ ] **Step 3: 라우트를 만든다**

Create `frontend/src/app/api/auth/test-login/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from "@/features/auth/cookie";
import { loginResponseSchema } from "@/features/auth/schema";
import { backendUrl } from "@/lib/api-client";

/**
 * 테스트 로그인을 백엔드에 중계하고 refresh 쿠키를 심는다.
 *
 * <p><b>시크릿을 여기 저장하지 않는다.</b> 사람이 `/login/test`에서 입력한 값을 받아 백엔드 헤더로
 * 흘려보내기만 한다. 환경변수에 두면 이 경로가 곧 잠금 없는 로그인이 된다 — 아무나 URL만 치면 된다.
 */
const requestSchema = z.object({
  secret: z.string().min(1),
  userId: z.number().optional(),
  handle: z.string().optional(),
  nickname: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "요청 값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const { secret, ...body } = parsed.data;

  const upstream = await fetch(backendUrl("/api/v1/auth/login/test"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Test-Login-Secret": secret,
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    // 백엔드의 code와 상태를 그대로 넘긴다. 쿠키는 심지 않는다.
    const failure = await upstream.json().catch(() => ({
      code: "CLIENT_ERROR",
      message: "일시적인 오류가 발생했습니다.",
    }));
    return NextResponse.json(failure, { status: upstream.status });
  }

  const login = loginResponseSchema.parse(await upstream.json());

  const response = NextResponse.json({
    accessToken: login.tokens.accessToken,
    expiresInSeconds: login.tokens.expiresInSeconds,
    userId: login.userId,
    nickname: login.nickname,
    newUser: login.newUser,
  });
  response.cookies.set(
    REFRESH_COOKIE_NAME,
    login.tokens.refreshToken,
    refreshCookieOptions,
  );
  return response;
}
```

> `const { secret, ...body }`가 핵심이다 — 시크릿이 백엔드 **본문**에 섞여 들어가지 않는다. AC-TESTLOGIN-19가 본문을 `{userId: 12}`로 정확히 대조한다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test test-login`
Expected: PASS, 3 tests.

- [ ] **Step 5: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && cd ..
git add frontend/src/app/api
git commit -m "feat(web): 테스트 로그인 BFF 라우트 (AC-TESTLOGIN 3개)"
```

---

## Task 4: `/login/test` 화면

**Files:**
- Create: `frontend/src/app/login/test/page.tsx`
- Create: `frontend/src/app/login/test/page.test.tsx`
- Create: `frontend/src/test/no-public-secret.test.ts`

**Covers:** AC-TESTLOGIN-18, 20(이동), 21(문구), 22

**Interfaces:**
- Consumes: Task 3의 `POST /api/auth/test-login`
- Consumes: `setAccessToken`(`lib/session.ts`) — 로그인 화면이 쓰는 것과 같은 방식을 따른다. **`AuthCallback.tsx`를 먼저 읽고 그대로 맞춘다.**

- [ ] **Step 1: 실패하는 테스트 작성**

Create `frontend/src/app/login/test/page.test.tsx`:

```tsx
it("AC-TESTLOGIN-18 · 입력칸과 버튼이 있다", () => {
  render(<TestLoginPage />);

  expect(screen.getByLabelText("테스트 시크릿")).toBeInTheDocument();
  expect(screen.getByLabelText("사용자 id")).toBeInTheDocument();
  expect(screen.getByLabelText("핸들")).toBeInTheDocument();
  expect(screen.getByLabelText("닉네임")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "테스트 로그인" })).toBeInTheDocument();
});

it("AC-TESTLOGIN-20 · 성공하면 홈으로 간다", async () => {
  server.use(
    http.post("/api/auth/test-login", () =>
      HttpResponse.json({
        accessToken: "a.b.c",
        expiresInSeconds: 1800,
        userId: 12,
        nickname: "확인용친구",
        newUser: false,
      }),
    ),
  );

  render(<TestLoginPage />);
  await userEvent.type(screen.getByLabelText("테스트 시크릿"), SECRET_32);
  await userEvent.type(screen.getByLabelText("사용자 id"), "12");
  await userEvent.click(screen.getByRole("button", { name: "테스트 로그인" }));

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
});

it("AC-TESTLOGIN-21 · 실패하면 문구를 보여준다", async () => {
  server.use(
    http.post("/api/auth/test-login", () =>
      HttpResponse.json(
        { code: "ENDPOINT_NOT_FOUND", message: "요청하신 주소를 찾을 수 없습니다." },
        { status: 404 },
      ),
    ),
  );

  render(<TestLoginPage />);
  await userEvent.type(screen.getByLabelText("테스트 시크릿"), "wrong");
  await userEvent.type(screen.getByLabelText("사용자 id"), "12");
  await userEvent.click(screen.getByRole("button", { name: "테스트 로그인" }));

  expect(await screen.findByText("테스트 로그인을 쓸 수 없습니다")).toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});
```

Create `frontend/src/test/no-public-secret.test.ts`:

```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** 시크릿을 NEXT_PUBLIC_으로 두면 번들에 박혀 누구나 읽는다. 그 실수를 여기서 막는다. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("AC-TESTLOGIN-22 · 시크릿이 프론트에 박히지 않는다", () => {
  it("NEXT_PUBLIC_ 시크릿이 0건이다", () => {
    const targets = [
      ...walk("src"),
      ".env.example",
      "wrangler.jsonc",
    ].filter((path) => /\.(ts|tsx|mjs|json|jsonc|example)$/.test(path) || path === ".env.example");

    const offenders = targets.filter((path) =>
      /NEXT_PUBLIC_[A-Z_]*(SECRET|TEST_LOGIN)/.test(readFileSync(path, "utf8")),
    );

    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test login/test no-public-secret`
Expected: FAIL — 화면 3개는 모듈을 못 찾고, `no-public-secret`은 **초록일 수 있다**(아직 아무것도 안 만들었으므로). 그 경우 **`NEXT_PUBLIC_TEST_LOGIN_SECRET=x`를 `.env.example`에 잠시 넣어 빨간불을 확인한 뒤 지운다** — 검사가 실제로 도는지 본 적 없는 테스트는 없는 것과 같다.

- [ ] **Step 3: 화면을 만든다**

Create `frontend/src/app/login/test/page.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setAccessToken } from "@/lib/session";

/**
 * 테스트 로그인 화면. **인증 우회의 입구다** — docs/specs/2026-09-05-test-login.md를 읽는다.
 *
 * <p>시크릿을 이 앱 어디에도 저장하지 않는다. 사람이 매번 입력한다.
 */
export default function TestLoginPage() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [userId, setUserId] = useState("");
  const [handle, setHandle] = useState("");
  const [nickname, setNickname] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setFailed(false);

    const response = await fetch("/api/auth/test-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        ...(userId === "" ? {} : { userId: Number(userId) }),
        ...(handle === "" ? {} : { handle }),
        ...(nickname === "" ? {} : { nickname }),
      }),
    }).catch(() => null);

    setPending(false);

    if (response === null || !response.ok) {
      setFailed(true);
      return;
    }

    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "accessToken" in body &&
      typeof body.accessToken === "string"
    ) {
      setAccessToken(body.accessToken);
    }
    router.replace("/");
  }

  return (
    <main className="flex flex-col gap-5 px-4 py-6">
      <h1 className="text-2xl font-bold">테스트 로그인</h1>
      <p className="text-neutral-500 dark:text-neutral-400">
        OAuth 없이 세션을 발급합니다. 시크릿은 저장되지 않습니다.
      </p>

      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
        <Field label="테스트 시크릿" value={secret} onChange={setSecret} type="password" />
        <Field label="사용자 id" value={userId} onChange={setUserId} inputMode="numeric" />
        <Field label="핸들" value={handle} onChange={setHandle} />
        <Field label="닉네임" value={nickname} onChange={setNickname} />

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-neutral-900 px-4 py-3 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          테스트 로그인
        </button>

        {failed && (
          <p className="text-red-600 dark:text-red-400">테스트 로그인을 쓸 수 없습니다</p>
        )}
      </form>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  type?: string;
  inputMode?: "numeric";
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-neutral-500 dark:text-neutral-400">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700"
      />
    </label>
  );
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test`
Expected: PASS. 283 + 3(Task 3) + 4(Task 4) = **290개**.

- [ ] **Step 5: 스펙 status를 올린다**

Modify `docs/specs/2026-09-05-test-login.md` — `status: 초안` → `status: 구현완료`, `plan:` 채우기.

**수동 확인 5개 중 셋이 차단형(`★`)이다.** `docs/conventions/verification.md`는 「차단형이 하나라도 남아 있으면 올리지 않는다」이다. **운영에 시크릿을 넣고 실제로 로그인해 보기 전에는 `초안`으로 둔다.**

- [ ] **Step 6: 커밋**

```bash
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e && cd ..
./scripts/check-spec-coverage.sh
git add frontend/src docs/specs/2026-09-05-test-login.md
git commit -m "feat(web): 테스트 로그인 화면 (AC-TESTLOGIN 4개)"
```

---

## 완료 기준

- [ ] `cd backend && ./gradlew clean check` 통과 — 482 + 17 = **499개**
- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 — **290개**
- [ ] `./scripts/check-spec-coverage.sh` 통과
- [ ] **`git log -p`에 잠금 없이 동작하는 커밋이 없다** — Task 1 커밋에서 이 경로는 언제나 404여야 한다
- [ ] `grep -rn "NEXT_PUBLIC_.*SECRET" frontend/`가 **0건**
- [ ] 스펙 「수동 확인」 5개 — **차단형 3개를 밟기 전에는 `status`를 올리지 않는다**

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC **22개** 중 **22개**가 태스크에 매핑됐다.

**자리표시자 검사:** `TODO`·`TBD`·「나중에」 없음. Task 2 Step 1의 `parseRole`·`createAdmin`은 **기존 코드에서 확인하고 없으면 대안을 쓰라는 지시**이며 대안을 함께 적었다.

**타입 일관성:**
- `TestLoginProperties.matches`는 Task 1에서 정의하고 Task 2의 컨트롤러가 같은 이름으로 쓴다.
- `AuthService.testLogin(Long, String, String)`의 인자 순서가 Task 2 정의와 컨트롤러 호출부에서 같다.
- BFF의 `{secret, ...body}` 분해가 백엔드 `TestLoginRequest(userId, handle, nickname)`와 정확히 맞는다.

**검증되지 않은 가정:**
- **`@Nested` + `@TestPropertySource`가 이 프로젝트의 통합 테스트 베이스(`AbstractIntegrationTest`)에서 컨텍스트를 새로 띄우는가.** 띄우지 않으면 시크릿이 갈리지 않아 Task 1의 세 중첩 클래스가 서로를 오염시킨다. **Task 1 Step 3에서 세 클래스가 서로 다른 결과를 내는지 먼저 본다** — 다 같으면 컨텍스트가 공유된 것이고, 그때는 `@DirtiesContext`나 프로퍼티 대신 빈 교체로 바꾼다.
- **`JwtTokenProvider.parseRole`이 있는가.** 없으면 테스트에서 JWT payload를 직접 디코딩한다. **프로덕션 코드에 테스트용 메서드를 만들지 않는다.**
- **`User.createAdmin` 팩터리의 정확한 이름.** `User.java:45`에 `role = UserRole.ADMIN`을 세팅하는 자리가 있다. 이름이 다르면 그것을 쓴다.
- **`@RequestBody(required = false) String`이 Spring 7에서 그대로 동작하는가.** 문자열 메시지 컨버터가 등록돼 있어야 한다. Task 1 Step 5에서 404가 정상적으로 나오면 확인된 것이다.
- **MSW가 Next 라우트 핸들러 테스트에서 상대경로(`/api/auth/test-login`)를 가로채는가.** Task 4의 화면 테스트가 그것에 기댄다. `app/api/auth/login/route.test.ts`가 이미 같은 일을 하고 있으므로 선례를 따른다.

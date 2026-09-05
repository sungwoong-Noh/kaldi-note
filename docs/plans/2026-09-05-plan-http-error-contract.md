# 라우팅 오류의 HTTP 응답 규약 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-05-http-error-contract.md`

**Goal:** 매핑되지 않은 경로·메서드·미디어 타입과 타입 변환 실패가 500이 아니라 각각 404·405·415·400을 반환하고,
그 응답이 `ErrorResponse` 형식(`code`·`message`·`fieldErrors`)을 갖는다.

**Architecture:** `GlobalExceptionHandler`에 스프링의 라우팅 예외 넷을 받는 `@ExceptionHandler` 메서드를 추가한다.
`ResponseEntityExceptionHandler`를 상속하지 **않는다** — 그쪽은 응답 본문을 `ProblemDetail`(RFC 9457)로 만들기 때문에
전 API가 쓰는 `ErrorResponse` 형식(`docs/conventions/backend.md`「에러 응답」)과 어긋나고, 이미 잘 도는 핸들러 6개의
동작까지 상속 계층에 얹히게 된다. 예외 넷을 명시적으로 잡는 쪽이 바뀌는 범위가 작고 읽기 쉽다.

**작업 위치:** `backend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-HTTPERR-01 | 매핑 없는 `/api/v1` 경로는 404 | Task 1 | API 테스트 |
| AC-HTTPERR-02 | 404 본문의 문구 | Task 1 | API 테스트 |
| AC-HTTPERR-03 | `/api/v1` 밖의 경로도 404 | Task 1 | API 테스트 |
| AC-HTTPERR-04 | 없는 리소스는 `NOT_FOUND`로 남는다 | Task 5 | API 테스트 |
| AC-HTTPERR-05 | 매핑 없는 메서드는 405 | Task 2 | API 테스트 |
| AC-HTTPERR-06 | 405 본문의 문구 | Task 2 | API 테스트 |
| AC-HTTPERR-07 | 405는 `Allow` 헤더를 갖는다 | Task 2 | API 테스트 |
| AC-HTTPERR-08 | JSON이 아닌 본문은 415 | Task 3 | API 테스트 |
| AC-HTTPERR-09 | 415 본문의 문구 | Task 3 | API 테스트 |
| AC-HTTPERR-10 | 숫자 파라미터에 문자열이 오면 400 | Task 4 | API 테스트 |
| AC-HTTPERR-11 | `fieldErrors`가 파라미터명을 알린다 | Task 4 | API 테스트 |
| AC-HTTPERR-12 | 기존 페이지 파라미터 검증은 그대로 | Task 5 | API 테스트 |
| AC-HTTPERR-13 | 미인증은 401 (404가 아니다) | Task 5 | API 테스트 |
| AC-HTTPERR-14 | 핸들러 없는 예외는 여전히 500 | Task 5 | API 테스트 |
| AC-HTTPERR-15 | 깨진 JSON 본문은 그대로 400 | Task 5 | API 테스트 |

**스펙의 AC 15개 중 15개가 매핑됨.**

---

## Global Constraints

- **`frontend/`를 건드리지 않는다.** 이 계획을 다 실행한 뒤 `git diff --stat main...HEAD`에 `frontend/`가 0줄이어야 한다.
- **기존 `@ExceptionHandler` 메서드 6개를 수정하지 않는다.** 추가만 한다. Task 5의 불변식 테스트가 이것을 지킨다.
- **`ErrorResponse` 레코드의 형태를 바꾸지 않는다.** 프론트 283개 테스트가 이 형태에 묶여 있다.
- 새 예외 핸들러는 모두 `log.warn`이고 **스택트레이스를 넘기지 않는다**(`log.warn(msg, e)` 금지 — 두 번째 인자로
  예외를 주면 스택트레이스가 찍힌다).

---

## File Structure

```
backend/src/
├── main/java/com/kaldinote/common/error/
│   ├── ErrorCode.java                          Modify — 상수 3개 추가
│   └── GlobalExceptionHandler.java             Modify — 핸들러 4개 추가
└── test/java/com/kaldinote/
    ├── common/error/GlobalExceptionHandlerTest.java   Create — AC 15개
    └── testsupport/DummyController.java        Modify — /boom 엔드포인트 (AC-14용)
```

---

## Task 1: 없는 경로는 404

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/common/error/ErrorCode.java`
- Modify: `backend/src/main/java/com/kaldinote/common/error/GlobalExceptionHandler.java`
- Test: `backend/src/test/java/com/kaldinote/common/error/GlobalExceptionHandlerTest.java`

**Covers:** AC-HTTPERR-01, AC-HTTPERR-02, AC-HTTPERR-03

**Interfaces:**
- Produces: `ErrorCode.ENDPOINT_NOT_FOUND` (404, `"요청하신 주소를 찾을 수 없습니다."`)
- Produces: 테스트 클래스 `GlobalExceptionHandlerTest`와 그 안의 `token()` 헬퍼 — Task 2~5가 그대로 쓴다

- [ ] **Step 1: 실패하는 테스트 작성**

새 파일 `backend/src/test/java/com/kaldinote/common/error/GlobalExceptionHandlerTest.java`:

```java
package com.kaldinote.common.error;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.transaction.annotation.Transactional;

/** 라우팅 오류의 응답 규약 — docs/specs/2026-09-05-http-error-contract.md */
@Transactional
class GlobalExceptionHandlerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;

  private String token() {
    User user = userRepository.save(User.create(null, "테스터", null));
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  @Test
  @DisplayName("AC-HTTPERR-01 · 매핑 없는 /api/v1 경로는 404다")
  void 매핑_없는_api_경로는_404다() throws Exception {
    mockMvc
        .perform(get("/api/v1/grinder-models").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("ENDPOINT_NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-HTTPERR-02 · 404 본문의 문구")
  void 없는_경로_404의_문구() throws Exception {
    mockMvc
        .perform(get("/api/v1/grinder-models").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(jsonPath("$.message").value("요청하신 주소를 찾을 수 없습니다."));
  }

  @Test
  @DisplayName("AC-HTTPERR-03 · /api/v1 밖의 경로도 404다")
  void api_밖의_경로도_404다() throws Exception {
    mockMvc
        .perform(get("/nope").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("ENDPOINT_NOT_FOUND"));
  }
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*GlobalExceptionHandlerTest'`
Expected: FAIL 3개. 세 테스트 모두 `Status expected:<404> but was:<500>`
(AC-02는 `$.message`가 `"서버 오류가 발생했습니다."`로 나와 실패).
**컴파일 실패가 아니라 이 사유로 실패해야 한다.** 컴파일이 깨지면 `ErrorCode` 상수를 먼저 넣은 것이다.

- [ ] **Step 3: 최소 구현**

`ErrorCode.java` — `NOT_FOUND` 바로 아래에 추가:

```java
  NOT_FOUND(HttpStatus.NOT_FOUND, "대상을 찾을 수 없습니다."),
  // 라우팅 오류 — docs/specs/2026-09-05-http-error-contract.md
  // 없는 '경로'다. 없는 '리소스'(NOT_FOUND)와 구분하지 않으면 프론트가
  // 오타 난 URL을 「삭제된 레시피」로 표시한다 (entityLabel.ts).
  ENDPOINT_NOT_FOUND(HttpStatus.NOT_FOUND, "요청하신 주소를 찾을 수 없습니다."),
```

`GlobalExceptionHandler.java` — `handleUnexpected` **위**에 추가:

```java
  /**
   * 매핑되지 않은 경로. 스프링은 이 요청을 정적 리소스 핸들러로 보내고 거기서 이 예외가 난다.
   * 잡지 않으면 handleUnexpected로 떨어져 오타 URL 하나가 500 + 스택트레이스가 된다.
   */
  @ExceptionHandler(NoResourceFoundException.class)
  public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException e) {
    log.warn("매핑되지 않은 경로: {} {}", e.getHttpMethod(), e.getResourcePath());
    ErrorCode code = ErrorCode.ENDPOINT_NOT_FOUND;
    return toResponse(code, code.getDefaultMessage());
  }
```

import 추가: `org.springframework.web.servlet.resource.NoResourceFoundException`

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*GlobalExceptionHandlerTest'`
Expected: PASS, 3 tests

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(backend): 없는 경로는 404 ENDPOINT_NOT_FOUND — AC 3개" && cd backend
```

---

## Task 2: 매핑 없는 메서드는 405 + `Allow` 헤더

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/common/error/ErrorCode.java`
- Modify: `backend/src/main/java/com/kaldinote/common/error/GlobalExceptionHandler.java`
- Test: `backend/src/test/java/com/kaldinote/common/error/GlobalExceptionHandlerTest.java`

**Covers:** AC-HTTPERR-05, AC-HTTPERR-06, AC-HTTPERR-07

**Interfaces:**
- Consumes: Task 1의 `token()` 헬퍼
- Produces: `ErrorCode.METHOD_NOT_ALLOWED` (405, `"이 주소에서 지원하지 않는 방식입니다."`)

> `/api/v1/recipes/{id}`는 `RecipeController`에 `@GetMapping("/{id}")`·`@PutMapping("/{id}")`·
> `@DeleteMapping("/{id}")` 셋만 있다. `@PostMapping`은 `/{id}/fork`라 이 경로의 허용 목록에 들어가지 않는다.
> **`Allow` 헤더의 기대값은 이 사실에서 나온다.** 컨트롤러에 `PATCH`가 추가되면 AC-07이 빨개지는 것이 맞다.

- [ ] **Step 1: 실패하는 테스트 작성**

`GlobalExceptionHandlerTest`에 추가 (import: `patch`, `header`):

```java
  @Test
  @DisplayName("AC-HTTPERR-05 · 매핑되지 않은 메서드는 405다")
  void 매핑되지_않은_메서드는_405다() throws Exception {
    mockMvc
        .perform(patch("/api/v1/recipes/19").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isMethodNotAllowed())
        .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
  }

  @Test
  @DisplayName("AC-HTTPERR-06 · 405 본문의 문구")
  void 메서드_405의_문구() throws Exception {
    mockMvc
        .perform(patch("/api/v1/recipes/19").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(jsonPath("$.message").value("이 주소에서 지원하지 않는 방식입니다."));
  }

  @Test
  @DisplayName("AC-HTTPERR-07 · 405는 Allow 헤더를 갖는다")
  void 메서드_405는_Allow_헤더를_갖는다() throws Exception {
    mockMvc
        .perform(patch("/api/v1/recipes/19").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(header().stringValues(HttpHeaders.ALLOW, org.hamcrest.Matchers.hasItem(
            org.hamcrest.Matchers.allOf(
                org.hamcrest.Matchers.containsString("GET"),
                org.hamcrest.Matchers.containsString("PUT"),
                org.hamcrest.Matchers.containsString("DELETE"),
                org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("PATCH"))))));
  }
```

> `Allow`는 `GET,PUT,DELETE`처럼 한 헤더에 콤마로 붙는다. 순서를 고정하지 않는 이유는 스프링이
> `Set<HttpMethod>`를 돌려주기 때문이다 — **순서까지 기대값에 넣으면 스프링 구현이 바뀔 때 이유 없이 빨개진다.**
> `POST`를 검사하지 않는 이유: `DELETE`가 `POST`를 부분 문자열로 포함하지 않으므로 `PATCH` 부재만으로 충분하다.
> (`/{id}/fork`의 POST가 이 경로 목록에 새어 들어오면 `POST` 문자열이 생기지만, 그건 `PATCH` 검사가 잡지 못한다 —
> Step 3 뒤에 실제 헤더 값을 한 번 눈으로 찍어 `GET,PUT,DELETE` 셋뿐인지 확인할 것.)

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*GlobalExceptionHandlerTest'`
Expected: FAIL 3개 — `Status expected:<405> but was:<500>`, `Allow` 헤더 없음

- [ ] **Step 3: 최소 구현**

`ErrorCode.java`:

```java
  METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "이 주소에서 지원하지 않는 방식입니다."),
```

`GlobalExceptionHandler.java`:

```java
  /** 경로는 있으나 그 메서드가 매핑되지 않았다. RFC 9110은 405에 Allow 헤더를 요구한다. */
  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  public ResponseEntity<ErrorResponse> handleMethodNotSupported(
      HttpRequestMethodNotSupportedException e) {
    log.warn("지원하지 않는 메서드: {} (허용: {})", e.getMethod(), e.getSupportedHttpMethods());
    ErrorCode code = ErrorCode.METHOD_NOT_ALLOWED;
    ResponseEntity.BodyBuilder builder = ResponseEntity.status(code.getStatus());
    Set<HttpMethod> supported = e.getSupportedHttpMethods();
    if (supported != null && !supported.isEmpty()) {
      builder.allow(supported.toArray(new HttpMethod[0]));
    }
    return builder.body(ErrorResponse.of(code, code.getDefaultMessage()));
  }
```

import 추가: `java.util.Set`, `org.springframework.http.HttpMethod`,
`org.springframework.web.HttpRequestMethodNotSupportedException`

> `supported`가 null일 수 있다 — 스프링이 허용 목록을 모를 때다. null 검사를 빼면
> `NullPointerException`이 나고, 그건 `handleUnexpected`가 잡아 **다시 500이 된다.**

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*GlobalExceptionHandlerTest'`
Expected: PASS, 6 tests

그리고 `Allow` 헤더 실제 값을 한 번 확인한다(위 Step 1의 단서):

```bash
./gradlew test --tests '*GlobalExceptionHandlerTest' --info 2>&1 | grep -i "허용:"
```
Expected: `허용: [GET, PUT, DELETE]` — 셋뿐이어야 한다. `POST`가 섞여 있으면 AC-07의 기대값을 다시 쓴다.

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(backend): 매핑 없는 메서드는 405 + Allow 헤더 — AC 3개" && cd backend
```

---

## Task 3: 미지원 미디어 타입은 415

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/common/error/ErrorCode.java`
- Modify: `backend/src/main/java/com/kaldinote/common/error/GlobalExceptionHandler.java`
- Test: `backend/src/test/java/com/kaldinote/common/error/GlobalExceptionHandlerTest.java`

**Covers:** AC-HTTPERR-08, AC-HTTPERR-09

**Interfaces:**
- Consumes: Task 1의 `token()` 헬퍼
- Produces: `ErrorCode.UNSUPPORTED_MEDIA_TYPE` (415, `"지원하지 않는 형식입니다."`)

- [ ] **Step 1: 실패하는 테스트 작성**

```java
  @Test
  @DisplayName("AC-HTTPERR-08 · JSON이 아닌 본문은 415다")
  void JSON이_아닌_본문은_415다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/recipes")
                .header(HttpHeaders.AUTHORIZATION, token())
                .contentType(MediaType.TEXT_PLAIN)
                .content("아침 레시피"))
        .andExpect(status().isUnsupportedMediaType())
        .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));
  }

  @Test
  @DisplayName("AC-HTTPERR-09 · 415 본문의 문구")
  void 미디어타입_415의_문구() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/recipes")
                .header(HttpHeaders.AUTHORIZATION, token())
                .contentType(MediaType.TEXT_PLAIN)
                .content("아침 레시피"))
        .andExpect(jsonPath("$.message").value("지원하지 않는 형식입니다."));
  }
```

import 추가: `post`, `org.springframework.http.MediaType`

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*GlobalExceptionHandlerTest'`
Expected: FAIL 2개 — `Status expected:<415> but was:<500>`

- [ ] **Step 3: 최소 구현**

`ErrorCode.java`:

```java
  UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "지원하지 않는 형식입니다."),
```

`GlobalExceptionHandler.java`:

```java
  /** Content-Type이 application/json이 아니다. 본문을 읽기 전에 걸린다. */
  @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
  public ResponseEntity<ErrorResponse> handleMediaTypeNotSupported(
      HttpMediaTypeNotSupportedException e) {
    log.warn("지원하지 않는 Content-Type: {}", e.getContentType());
    ErrorCode code = ErrorCode.UNSUPPORTED_MEDIA_TYPE;
    return toResponse(code, code.getDefaultMessage());
  }
```

import 추가: `org.springframework.web.HttpMediaTypeNotSupportedException`

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*GlobalExceptionHandlerTest'`
Expected: PASS, 8 tests

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(backend): 미지원 미디어 타입은 415 — AC 2개" && cd backend
```

---

## Task 4: 쿼리 파라미터 타입 변환 실패는 400

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/common/error/GlobalExceptionHandler.java`
- Test: `backend/src/test/java/com/kaldinote/common/error/GlobalExceptionHandlerTest.java`

**Covers:** AC-HTTPERR-10, AC-HTTPERR-11

**Interfaces:**
- Consumes: Task 1의 `token()` 헬퍼, 기존 `ErrorCode.INVALID_REQUEST`
- Produces: 없음 (새 `ErrorCode` 상수 없이 기존 400 경로를 재사용한다)

- [ ] **Step 1: 실패하는 테스트 작성**

```java
  @Test
  @DisplayName("AC-HTTPERR-10 · 숫자 파라미터에 문자열이 오면 400이다")
  void 숫자_파라미터에_문자열이_오면_400이다() throws Exception {
    mockMvc
        .perform(get("/api/v1/recipes").param("size", "abc").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-HTTPERR-11 · 어떤 파라미터가 틀렸는지 fieldErrors로 알린다")
  void 틀린_파라미터를_fieldErrors로_알린다() throws Exception {
    mockMvc
        .perform(get("/api/v1/recipes").param("size", "abc").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(jsonPath("$.fieldErrors.length()").value(1))
        .andExpect(jsonPath("$.fieldErrors[0].field").value("size"));
  }
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*GlobalExceptionHandlerTest'`
Expected: FAIL 2개 — `Status expected:<400> but was:<500>`, `fieldErrors` 길이가 0

- [ ] **Step 3: 최소 구현**

`GlobalExceptionHandler.java`:

```java
  /**
   * `?size=abc`처럼 쿼리 파라미터를 선언된 타입으로 바꾸지 못했다. 컨트롤러 본문에 들어가기 전에 걸리므로
   * 본문 검증(MethodArgumentNotValid)과는 다른 예외다. 형식은 같게 맞춘다 — 프론트가 fieldErrors 하나로 다룬다.
   */
  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
    log.warn("파라미터 타입 변환 실패: {}={}", e.getName(), e.getValue());
    ErrorCode code = ErrorCode.INVALID_REQUEST;
    Class<?> required = e.getRequiredType();
    String detail =
        required != null && Number.class.isAssignableFrom(required)
            ? "숫자여야 합니다."
            : "형식이 올바르지 않습니다.";
    return ResponseEntity.status(code.getStatus())
        .body(
            ErrorResponse.of(
                code,
                code.getDefaultMessage(),
                List.of(new ErrorResponse.FieldError(e.getName(), detail))));
  }
```

import 추가: `org.springframework.web.method.annotation.MethodArgumentTypeMismatchException`
(`java.util.List`는 이미 import돼 있다)

> `required`가 `int`(원시 타입)면 `Number.class.isAssignableFrom`이 `false`다. `RecipeController`의
> 파라미터가 `Integer`인지 `int`인지에 따라 문구가 갈린다 — **Step 4에서 실제 응답을 찍어 확인한다.**
> `int`로 판명되면 조건을 `required.isPrimitive() || Number.class.isAssignableFrom(required)`로 넓힌다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*GlobalExceptionHandlerTest'`
Expected: PASS, 10 tests

문구 확인 (위 단서):

```bash
./gradlew test --tests '*GlobalExceptionHandlerTest' --info 2>&1 | grep "타입 변환 실패"
```
그리고 `fieldErrors[0].message`가 `"숫자여야 합니다."`인지 임시로 `andExpect`를 하나 걸어 확인한 뒤 지운다.
스펙의 응답 예시가 이 문구이므로, 다르면 **스펙 쪽 예시를 고치는 것이 아니라 구현을 맞춘다.**

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(backend): 쿼리 파라미터 타입 변환 실패는 400 — AC 2개" && cd backend
```

---

## Task 5: 불변식 고정 — 이 변경으로 깨지면 안 되는 것

**Files:**
- Modify: `backend/src/test/java/com/kaldinote/testsupport/DummyController.java`
- Test: `backend/src/test/java/com/kaldinote/common/error/GlobalExceptionHandlerTest.java`

**Covers:** AC-HTTPERR-04, AC-HTTPERR-12, AC-HTTPERR-13, AC-HTTPERR-14, AC-HTTPERR-15

**Interfaces:**
- Consumes: Task 1의 `token()` 헬퍼
- Produces: `GET /test-support/boom` — `RuntimeException`을 던지는 테스트 전용 엔드포인트

> **★ 이 태스크는 TDD 빨강이 나오지 않는다.** 다섯 조건 모두 지금 이미 맞게 동작한다.
> 처음부터 통과하는 테스트는 **자기가 무엇을 지키는지 스스로 증명하지 못한다**(`docs/JOURNAL.md` 2026-09-03).
> 그래서 Step 3에서 **돌연변이를 실제로 심어** 각 테스트가 빨개지는지 확인한다. 하나도 안 빨개지면
> 그 테스트는 아무것도 지키지 않는 것이므로 조건을 다시 쓴다.

- [ ] **Step 1: `/boom` 엔드포인트 추가**

`DummyController.java`에 추가:

```java
  /** 핸들러가 없는 예외가 여전히 500인지 확인하는 용도. 운영 코드가 아니다. */
  @GetMapping("/boom")
  public String boom() {
    throw new IllegalStateException("의도적으로 터뜨린다");
  }
```

> `IllegalStateException`을 쓰는 이유: `IllegalArgumentException`은 이미 `handleIllegalArgument`가
> 잡아 400을 낸다. 그걸 쓰면 AC-14가 검사하려는 500 경로를 타지 않는다.

`SecurityConfig`는 `/test-support/public`과 `/test-support/admin`만 따로 다루고 나머지는
`anyRequest().authenticated()`이므로 `/boom`은 토큰이 필요하다. **`SecurityConfig`를 수정하지 않는다.**

- [ ] **Step 2: 불변식 테스트 5개 작성**

```java
  @Test
  @DisplayName("AC-HTTPERR-04 · 없는 리소스는 NOT_FOUND로 남는다")
  void 없는_리소스는_NOT_FOUND로_남는다() throws Exception {
    mockMvc
        .perform(get("/api/v1/recipes/999999").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-HTTPERR-12 · 기존 페이지 파라미터 검증은 그대로다")
  void 기존_페이지_파라미터_검증은_그대로다() throws Exception {
    mockMvc
        .perform(get("/api/v1/recipes").param("page", "-1").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
        .andExpect(jsonPath("$.message").value("page는 0 이상이어야 합니다: -1"));
  }

  @Test
  @DisplayName("AC-HTTPERR-13 · 미인증 요청은 경로 존재 여부를 알려주지 않는다")
  void 미인증_요청은_경로_존재_여부를_알려주지_않는다() throws Exception {
    mockMvc.perform(get("/nope")).andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("AC-HTTPERR-14 · 핸들러가 없는 예외는 여전히 500이다")
  void 핸들러가_없는_예외는_여전히_500이다() throws Exception {
    mockMvc
        .perform(get("/test-support/boom").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isInternalServerError())
        .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"));
  }

  @Test
  @DisplayName("AC-HTTPERR-15 · 깨진 JSON 본문은 그대로 400이다")
  void 깨진_JSON_본문은_그대로_400이다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/recipes")
                .header(HttpHeaders.AUTHORIZATION, token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
        .andExpect(jsonPath("$.message").value("요청 본문을 읽을 수 없습니다."));
  }
```

Run: `./gradlew test --tests '*GlobalExceptionHandlerTest'`
Expected: PASS, 15 tests — **여기서 초록인 것이 정상이다.**

- [ ] **Step 3: 돌연변이 검사 — 각 테스트가 실제로 무언가를 지키는지 확인**

아래 넷을 **하나씩** 적용해 예상한 테스트가 빨개지는지 보고, 확인 후 **반드시 되돌린다.**

| # | 심을 돌연변이 | 빨개져야 할 것 |
|---|---|---|
| 1 | `handleNoResource`의 `ENDPOINT_NOT_FOUND`를 `NOT_FOUND`로 바꾼다 | AC-01, AC-03 (AC-04는 **초록으로 남아야** 정상 — 그래야 둘이 실제로 다른 경로임이 증명된다) |
| 2 | `handleUnreadable`(깨진 JSON) 메서드를 통째로 지운다 | AC-15 |
| 3 | `handleBusiness`를 지운다 | AC-12, AC-04 |
| 4 | `handleUnexpected`의 `INTERNAL_ERROR`를 `ENDPOINT_NOT_FOUND`로 바꾼다 | AC-14 |

각 돌연변이마다:
```bash
./gradlew test --tests '*GlobalExceptionHandlerTest'   # 빨간불 확인
git checkout backend/src/main/java/com/kaldinote/common/error/GlobalExceptionHandler.java
```

**하나라도 예상과 다르면 멈추고 그 사실을 `docs/JOURNAL.md`에 적는다.** 특히 돌연변이 1에서 AC-04까지
빨개진다면 두 code가 실제로는 같은 경로를 타고 있다는 뜻이고, 그러면 AC-04는 아무것도 지키지 않는다.

AC-13에는 돌연변이를 심지 않는다 — `SecurityConfig`를 건드려야 하는데 그건 이 계획의 범위 밖이다.
대신 이 테스트는 **나중에 누군가 "없는 경로는 404가 맞지 않나"로 바꾸는 것**을 막는 것이 목적이므로,
스펙의 AC-13이 그 판단 근거를 갖고 있다.

- [ ] **Step 4: 전체 검증**

```bash
./gradlew clean check
cd .. && ./scripts/check-spec-coverage.sh
git diff --stat main...HEAD | grep frontend/ && echo "★ 프론트를 건드렸다 — 되돌릴 것" || echo "프론트 0줄 확인"
```
Expected: `clean check` 초록(백엔드 테스트 462 + 15 = **477개**), 커버리지 초록,
`frontend/` 0줄.

> 477은 이 계획이 예상하는 값이다. 실제 수가 다르면 그 차이를 세어보고 `docs/JOURNAL.md`에 적는다 —
> 「대충 늘었다」로 넘어가지 않는다.

- [ ] **Step 5: 스펙 `status`를 `구현완료`로 바꾸고 커밋**

수동 확인이 0개이므로 이 태스크가 끝나면 바로 올린다(`docs/conventions/verification.md`).

```bash
# docs/specs/2026-09-05-http-error-contract.md 의 status: 초안 → 구현완료
cd backend && ./gradlew spotlessApply && ./gradlew clean check && cd ..
./scripts/check-spec-coverage.sh     # AC 15개가 강제 검사 대상이 된다
git add . && git commit -m "test(backend): 오류 응답의 불변식 고정 + 스펙 구현완료 — AC 5개"
```

---

## 완료 기준

- [ ] `cd backend && ./gradlew clean check` 통과
- [ ] `./scripts/check-spec-coverage.sh` 통과 — `HTTPERR` 15개가 **건너뜀이 아니라 확인됨**으로 나온다
- [ ] 스펙의 `status`를 `구현완료`로 변경
- [ ] `git diff --stat main...HEAD`에 `frontend/`가 0줄
- [ ] 수동 확인: 없음 (스펙에 항목이 0개다)

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 15개 중 15개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** Task 2~5가 쓰는 `token()` 헬퍼는 Task 1이 정의한다. `ErrorCode` 상수 3개는
정의한 태스크에서만 쓰인다. `toResponse(ErrorCode, String)`는 기존 private 헬퍼를 그대로 쓴다.

**확인된 사실 (추측이 아니다):**

Spring 7.0.8 jar을 직접 열어 클래스 경로와 메서드 시그니처를 확인했다. 계획의 import와 호출은 이 결과에 근거한다.

- `org.springframework.web.servlet.resource.NoResourceFoundException` — `getHttpMethod()`, `getResourcePath()`
- `org.springframework.web.HttpRequestMethodNotSupportedException` — `getMethod()`, `getSupportedHttpMethods()` → `Set<HttpMethod>`
- `org.springframework.web.HttpMediaTypeNotSupportedException` — `getContentType()`
- `org.springframework.web.method.annotation.MethodArgumentTypeMismatchException` — `getName()`, `getRequiredType()`(부모 `TypeMismatchException`)

현재 동작 5가지도 로컬 백엔드에 유효한 토큰으로 실제 요청을 보내 측정했다(스펙의 「왜」 표).

**검증되지 않은 가정:**

1. **`NoResourceFoundException`이 `@RestControllerAdvice`에 도달한다** — 도달한다고 판단하는 근거는
   지금 이 요청이 `{"code":"INTERNAL_ERROR",...}` JSON을 돌려준다는 것이다. 그 본문을 만드는 곳은
   `GlobalExceptionHandler.handleUnexpected` 하나뿐이다. Task 1 Step 4에서 확정된다.
2. **`Allow` 헤더에 `GET,PUT,DELETE` 셋만 들어간다** — `/{id}/fork`의 POST가 섞이지 않을 것으로 본다.
   Task 2 Step 4에서 로그로 확인한다.
3. **`RecipeController`의 `size` 파라미터가 `Integer`다**(`int`가 아니다) — 문구가 갈린다.
   Task 4 Step 3의 단서와 Step 4에서 확인한다.
4. **`/test-support/boom`이 401이 아니라 500을 낸다** — `SecurityConfig`의 `anyRequest().authenticated()`에
   걸리므로 토큰을 붙이면 통과할 것으로 본다. Task 5 Step 2에서 확정된다.
5. **백엔드 테스트 총계가 477개가 된다** — 462 + 15. Task 5 Step 4에서 대조한다.

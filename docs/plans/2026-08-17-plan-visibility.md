# 공개범위 인가 + 팔로우 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-08-17-visibility-authorization.md`

**Goal:** 사용자가 서로를 팔로우할 수 있게 되고, `recipes.visibility`·`brew_logs.visibility` 값이 실제 조회 인가로 작동한다. 상호 팔로우한 두 계정이 `FRIENDS` 레시피와 브루잉 로그를 서로 볼 수 있고, `PUBLIC`은 누구에게나, `PRIVATE`은 소유자에게만 열린다.

**Architecture:** 새 도메인을 만들지 않는다. 팔로우는 기존 `user` 도메인에 application·presentation 계층만 얹는다(`Follow` 엔티티·`FollowRepository`·`follows` 테이블은 V1부터 있다). 인가 판정은 `FollowService.isMutual(a, b)` 하나만 공유하고, 4단계 판정 규칙은 `RecipeService`·`BrewLogService`가 각자 구현한다 — `RecipeVisibility`와 `BrewLogVisibility`가 별개 enum이라 공통 함수로 묶으면 억지 추상화가 되고, 판정 자체는 4줄이라 중복 비용이 추상화 비용보다 작다. 두 서비스가 `FollowRepository`를 직접 주입하는 것은 `RecipeService`가 `GrinderModelRepository`를 직접 주입하는 기존 패턴과 같다.

**스키마 변경 없음.** 마이그레이션 파일을 추가하지 않는다.

**작업 위치:** `backend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-FOLLOW-01 | 팔로우하면 행 1개 생성 | Task 1 | API 테스트 |
| AC-FOLLOW-02 | 중복 팔로우해도 행 1개 (멱등) | Task 1 | API 테스트 |
| AC-FOLLOW-03 | 해제하면 행 0개 | Task 1 | API 테스트 |
| AC-FOLLOW-04 | 관계 없는 해제도 204 (멱등) | Task 1 | API 테스트 |
| AC-FOLLOW-05 | 해제는 내 방향만 지운다 | Task 1 | API 테스트 |
| AC-FOLLOW-06 | 관계 없음 → 셋 다 false | Task 1 | API 테스트 |
| AC-FOLLOW-07 | 내가 팔로우만 → following만 true | Task 1 | API 테스트 |
| AC-FOLLOW-08 | 상대만 팔로우 → followedBy만 true | Task 1 | API 테스트 |
| AC-FOLLOW-09 | 상호 팔로우 → 셋 다 true | Task 1 | API 테스트 |
| AC-FOLLOW-10~12 | 자기 자신 POST/DELETE/GET → 400 | Task 1 | API 테스트 |
| AC-FOLLOW-13~15 | 없는 사용자 POST/DELETE/GET → 404 | Task 1 | API 테스트 |
| AC-FOLLOW-16~18 | 토큰 없이 POST/DELETE/GET → 401 | Task 1 | API 테스트 |
| AC-VIS-01~03 | 소유자는 PRIVATE/FRIENDS/PUBLIC 전부 조회 | Task 2 | API 테스트 |
| AC-VIS-04 | 타인 + PUBLIC → 200 | Task 2 | API 테스트 |
| AC-VIS-05 | 타인 + FRIENDS + 상호 팔로우 → 200 | Task 2 | API 테스트 |
| AC-VIS-06 | 타인 + PRIVATE → 403 | Task 2 | API 테스트 |
| AC-VIS-07~09 | FRIENDS 단방향(양쪽)·관계없음 → 403 | Task 2 | API 테스트 |
| AC-VIS-10 | 팔로우 끊기면 즉시 403 (실시간 판정) | Task 2 | API 테스트 |
| AC-VIS-11~13 | owner null + PUBLIC(200)/FRIENDS(403)/PRIVATE(403) | Task 2 | API 테스트 |
| AC-VIS-14~15 | PUBLIC이어도 타인은 PUT/DELETE 불가 → 403 | Task 2 | API 테스트 |
| AC-VIS-16 | 소프트 삭제된 PUBLIC → 404 | Task 2 | API 테스트 |
| AC-VIS-17 | 토큰 없이 PUBLIC 조회 → 401 | Task 2 | API 테스트 |
| AC-VIS-18~20 | visibility 생략(PRIVATE)/PUBLIC/FRIENDS 저장 | Task 3 | API 테스트 |
| AC-VIS-21 | 허용값 밖 visibility → 400 | Task 3 | API 테스트 |
| AC-VIS-22 | 소유자 + PRIVATE 로그 → 200 | Task 3 | API 테스트 |
| AC-VIS-23 | 타인 + PRIVATE 로그 → 403 | Task 3 | API 테스트 |
| AC-VIS-24 | 타인 + PUBLIC 로그 → 200, 재계산 필드 동일 | Task 3 | API 테스트 |
| AC-VIS-25 | 타인 + FRIENDS + 상호 팔로우 → 200 | Task 3 | API 테스트 |
| AC-VIS-26 | 타인 + FRIENDS + 단방향 → 403 | Task 3 | API 테스트 |
| AC-VIS-27 | PRIVATE 레시피 참조 PUBLIC 로그 → 타인 200 | Task 3 | API 테스트 |
| AC-VIS-28 | 토큰 없이 PUBLIC 로그 조회 → 401 | Task 3 | API 테스트 |

**46개 전부 매핑됨** (Task 1: 18 + Task 2: 17 + Task 3: 11 = 46, 스펙과 동일).

---

## Global Constraints

- **스키마 변경 없음.** `V9__` 이후 마이그레이션을 만들지 않는다. `follows`·`recipes.visibility`·`brew_logs.visibility`가 전부 이미 존재한다.
- **새 `ErrorCode` 없음.** `INVALID_REQUEST`(400)·`UNAUTHORIZED`(401)·`FORBIDDEN`(403)·`NOT_FOUND`(404)만 쓴다.
- **판정 순서는 스펙 그대로:** 소유자 → `PUBLIC` → `FRIENDS` + 상호 팔로우 → 403. 먼저 참이 되는 항목에서 멈춘다.
- **판정은 요청 시점 실시간.** 결과를 필드에 저장하거나 캐시하지 않는다. `AC-VIS-10`이 이것을 검증한다.
- **소유자 판정과 조회 인가를 분리한다.** 기존 `findOwned(...)`는 쓰기(`PUT`/`DELETE`) 전용으로 그대로 두고, 조회용 `findViewable(...)`을 새로 만든다. `findOwned`를 고치면 `AC-VIS-14`·`AC-VIS-15`가 깨진다.
- **`FollowService.isMutual`만 공유한다.** `RecipeVisibility`와 `BrewLogVisibility`는 별개 enum으로 유지한다. 두 enum을 합치는 것은 이 계획의 범위가 아니다.
- **DB에 쓰는 컨트롤러 테스트에는 클래스 레벨 `@Transactional`을 붙인다.** 새로 만드는 `FollowControllerTest`가 `users`·`follows`에 실제로 쓴다. 이 누락으로 `UserRepositoryTest`가 깨진 사고가 브루잉 로그 Task 1에서 있었고, 같은 패턴이 이미 네 번 반복됐다(`docs/JOURNAL.md` 2026-08-17).
- **테스트에서 두 사용자의 id가 필요하다.** 기존 `token(nickname)` 헬퍼는 토큰만 돌려주므로, `User`를 그대로 돌려주는 헬퍼를 함께 만든다. 팔로우 픽스처는 **`follows`에 직접 insert하지 않고 팔로우 API를 호출해 만든다** — Task 1이 Task 2·3의 선행인 이유다.
- `AuthenticatedUser` 컨트롤러 파라미터는 `@AuthenticationPrincipal` 없이 타입만으로 받는다.
- 팔로우 API는 `SecurityConfig`의 `anyRequest().authenticated()`에 자동으로 걸린다. **`SecurityConfig`를 수정하지 않는다.**

---

## File Structure

```
backend/src/main/java/com/kaldinote/
├── user/
│   ├── infrastructure/FollowRepository.java        (Modify — Task 1, 단방향 조회 2개 추가)
│   ├── application/FollowService.java              (Create — Task 1)
│   └── presentation/
│       ├── FollowController.java                   (Create — Task 1)
│       └── dto/FollowStatusResponse.java           (Create — Task 1)
├── common/error/GlobalExceptionHandler.java        (Modify — Task 3, enum 파싱 실패 핸들러)
├── recipe/application/RecipeService.java           (Modify — Task 2, findViewable 추가)
└── brewlog/
    ├── domain/BrewLog.java                         (Modify — Task 3, create에 visibility 파라미터)
    ├── application/BrewLogService.java             (Modify — Task 3, findViewable + visibility 전달)
    └── presentation/dto/BrewLogCreateRequest.java  (Modify — Task 3, visibility 필드)

backend/src/test/java/com/kaldinote/
├── user/presentation/FollowControllerTest.java     (Create — Task 1)
├── recipe/presentation/RecipeControllerTest.java   (Modify — Task 2)
└── brewlog/presentation/BrewLogControllerTest.java (Modify — Task 3)
```

---

## Task 1: 팔로우 API (등록 · 해제 · 상태 조회)

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/user/infrastructure/FollowRepository.java`
- Create: `backend/src/main/java/com/kaldinote/user/application/FollowService.java`
- Create: `backend/src/main/java/com/kaldinote/user/presentation/FollowController.java`
- Create: `backend/src/main/java/com/kaldinote/user/presentation/dto/FollowStatusResponse.java`
- Test: `backend/src/test/java/com/kaldinote/user/presentation/FollowControllerTest.java`

**Covers:** AC-FOLLOW-01 ~ AC-FOLLOW-18 (18개)

**Interfaces:**
- Consumes: `UserRepository`(`existsById`), `FollowRepository.existsMutualFollow(Long, Long)`(이미 존재), `AuthenticatedUser`
- Produces: `FollowService.isMutual(Long viewerId, Long ownerId)` — **Task 2·3이 인가 판정에 쓴다**

- [x] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/kaldinote/user/presentation/FollowControllerTest.java`

```java
package com.kaldinote.user.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.user.domain.FollowId;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.FollowRepository;
import com.kaldinote.user.infrastructure.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.transaction.annotation.Transactional;

/**
 * users·follows에 실제로 쓰므로 클래스 레벨 @Transactional이 필수다.
 * 빠뜨리면 커밋된 사용자가 남아 UserRepositoryTest의 건수 단언이 깨진다
 * (docs/JOURNAL.md 2026-08-17, 브루잉 로그 Task 1).
 */
@Transactional
class FollowControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private FollowRepository followRepository;

  /** 팔로우 픽스처를 만들려면 상대의 id가 필요해 User를 그대로 돌려준다. */
  private User newUser(String nickname) {
    return userRepository.save(User.create(null, nickname, null));
  }

  private String tokenOf(User user) {
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private boolean followExists(User follower, User followee) {
    return followRepository.existsById(new FollowId(follower.getId(), followee.getId()));
  }

  private void follow(User follower, User followee) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/users/{id}/follow", followee.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(follower)))
        .andExpect(status().isNoContent());
  }

  // ---------- 등록 ----------

  @Test
  @DisplayName("AC-FOLLOW-01 · 팔로우하면 follows에 행이 하나 생긴다")
  void 팔로우하면_행이_하나_생긴다() throws Exception {
    User a = newUser("a-01");
    User b = newUser("b-01");

    mockMvc
        .perform(
            post("/api/v1/users/{id}/follow", b.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isNoContent());

    assertThat(followExists(a, b)).isTrue();
  }

  @Test
  @DisplayName("AC-FOLLOW-02 · 같은 팔로우를 두 번 해도 행은 하나다")
  void 중복_팔로우는_멱등이다() throws Exception {
    User a = newUser("a-02");
    User b = newUser("b-02");
    follow(a, b);

    mockMvc
        .perform(
            post("/api/v1/users/{id}/follow", b.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isNoContent());

    assertThat(followRepository.count()).isEqualTo(1);
  }

  // ---------- 해제 ----------

  @Test
  @DisplayName("AC-FOLLOW-03 · 해제하면 행이 사라진다")
  void 해제하면_행이_사라진다() throws Exception {
    User a = newUser("a-03");
    User b = newUser("b-03");
    follow(a, b);

    mockMvc
        .perform(
            delete("/api/v1/users/{id}/follow", b.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isNoContent());

    assertThat(followExists(a, b)).isFalse();
  }

  @Test
  @DisplayName("AC-FOLLOW-04 · 팔로우하지 않은 상대를 해제해도 204다")
  void 관계없는_해제도_멱등이다() throws Exception {
    User a = newUser("a-04");
    User b = newUser("b-04");

    mockMvc
        .perform(
            delete("/api/v1/users/{id}/follow", b.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isNoContent());

    assertThat(followRepository.count()).isZero();
  }

  @Test
  @DisplayName("AC-FOLLOW-05 · 해제는 내 방향만 지운다")
  void 해제는_내_방향만_지운다() throws Exception {
    User a = newUser("a-05");
    User b = newUser("b-05");
    follow(a, b);
    follow(b, a);

    mockMvc
        .perform(
            delete("/api/v1/users/{id}/follow", b.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isNoContent());

    assertThat(followExists(a, b)).isFalse();
    assertThat(followExists(b, a)).isTrue();
  }

  // ---------- 상태 조회 ----------

  @Test
  @DisplayName("AC-FOLLOW-06 · 아무 관계도 없으면 셋 다 false다")
  void 관계없으면_셋_다_false다() throws Exception {
    User a = newUser("a-06");
    User b = newUser("b-06");

    mockMvc
        .perform(
            get("/api/v1/users/{id}/follow", b.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.following").value(false))
        .andExpect(jsonPath("$.followedBy").value(false))
        .andExpect(jsonPath("$.mutual").value(false));
  }

  @Test
  @DisplayName("AC-FOLLOW-07 · 내가 팔로우만 했으면 following만 true다")
  void 내가_팔로우만_했으면_following만_true다() throws Exception {
    User a = newUser("a-07");
    User b = newUser("b-07");
    follow(a, b);

    mockMvc
        .perform(
            get("/api/v1/users/{id}/follow", b.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.following").value(true))
        .andExpect(jsonPath("$.followedBy").value(false))
        .andExpect(jsonPath("$.mutual").value(false));
  }

  @Test
  @DisplayName("AC-FOLLOW-08 · 상대만 나를 팔로우했으면 followedBy만 true다")
  void 상대만_나를_팔로우했으면_followedBy만_true다() throws Exception {
    User a = newUser("a-08");
    User b = newUser("b-08");
    follow(b, a);

    mockMvc
        .perform(
            get("/api/v1/users/{id}/follow", b.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.following").value(false))
        .andExpect(jsonPath("$.followedBy").value(true))
        .andExpect(jsonPath("$.mutual").value(false));
  }

  @Test
  @DisplayName("AC-FOLLOW-09 · 상호 팔로우면 셋 다 true다")
  void 상호_팔로우면_셋_다_true다() throws Exception {
    User a = newUser("a-09");
    User b = newUser("b-09");
    follow(a, b);
    follow(b, a);

    mockMvc
        .perform(
            get("/api/v1/users/{id}/follow", b.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.following").value(true))
        .andExpect(jsonPath("$.followedBy").value(true))
        .andExpect(jsonPath("$.mutual").value(true));
  }

  // ---------- 자기 자신 ----------

  @Test
  @DisplayName("AC-FOLLOW-10 · 자기 자신을 팔로우하면 400이다")
  void 자기_자신_팔로우는_400이다() throws Exception {
    User a = newUser("a-10");

    mockMvc
        .perform(
            post("/api/v1/users/{id}/follow", a.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

    assertThat(followRepository.count()).isZero();
  }

  @Test
  @DisplayName("AC-FOLLOW-11 · 자기 자신을 해제하면 400이다")
  void 자기_자신_해제는_400이다() throws Exception {
    User a = newUser("a-11");

    mockMvc
        .perform(
            delete("/api/v1/users/{id}/follow", a.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-FOLLOW-12 · 자기 자신의 상태를 조회하면 400이다")
  void 자기_자신_상태조회는_400이다() throws Exception {
    User a = newUser("a-12");

    mockMvc
        .perform(
            get("/api/v1/users/{id}/follow", a.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  // ---------- 없는 사용자 ----------

  @Test
  @DisplayName("AC-FOLLOW-13 · 없는 사용자를 팔로우하면 404다")
  void 없는_사용자_팔로우는_404다() throws Exception {
    User a = newUser("a-13");

    mockMvc
        .perform(
            post("/api/v1/users/{id}/follow", 999999L)
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-FOLLOW-14 · 없는 사용자를 해제하면 404다")
  void 없는_사용자_해제는_404다() throws Exception {
    User a = newUser("a-14");

    mockMvc
        .perform(
            delete("/api/v1/users/{id}/follow", 999999L)
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-FOLLOW-15 · 없는 사용자의 상태를 조회하면 404다")
  void 없는_사용자_상태조회는_404다() throws Exception {
    User a = newUser("a-15");

    mockMvc
        .perform(
            get("/api/v1/users/{id}/follow", 999999L)
                .header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  // ---------- 미인증 ----------

  @Test
  @DisplayName("AC-FOLLOW-16 · 토큰 없이 팔로우하면 401이다")
  void 토큰_없는_팔로우는_401이다() throws Exception {
    User b = newUser("b-16");

    mockMvc
        .perform(post("/api/v1/users/{id}/follow", b.getId()))
        .andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("AC-FOLLOW-17 · 토큰 없이 해제하면 401이다")
  void 토큰_없는_해제는_401이다() throws Exception {
    User b = newUser("b-17");

    mockMvc
        .perform(delete("/api/v1/users/{id}/follow", b.getId()))
        .andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("AC-FOLLOW-18 · 토큰 없이 상태를 조회하면 401이다")
  void 토큰_없는_상태조회는_401이다() throws Exception {
    User b = newUser("b-18");

    mockMvc
        .perform(get("/api/v1/users/{id}/follow", b.getId()))
        .andExpect(status().isUnauthorized());
  }
}
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*FollowControllerTest'`

Expected: FAIL — 18개 전부. `FollowController`가 없어 `/api/v1/users/{id}/follow`가 매핑되지 않는다. 미인증 3개(16~18)는 `SecurityConfig`의 `anyRequest().authenticated()` 덕에 **먼저 통과할 수도 있다** — 인증 필터가 매핑보다 앞서기 때문이다. 나머지 15개는 404 또는 500으로 실패한다.

> 브루잉 로그 Task 1·3에서 "컴파일 실패"를 예상했으나 실제로는 런타임 500이었다. 이 테스트도 raw JSON + MockMvc만 쓰고 새 클래스를 직접 참조하지 않으므로 **컴파일은 성공한다.** RED로서는 유효하다.

- [x] **Step 3: 리포지토리 · 서비스 · 컨트롤러 · DTO 작성**

`FollowRepository.java` (Modify — 메서드 2개 추가)

```java
package com.kaldinote.user.infrastructure;

import com.kaldinote.user.domain.Follow;
import com.kaldinote.user.domain.FollowId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FollowRepository extends JpaRepository<Follow, FollowId> {

  /** 양방향 팔로우가 모두 존재할 때만 true. FRIENDS 공개범위 판정에 쓴다. */
  @Query(
      """
      select count(f) = 2 from Follow f
      where (f.followerUserId = :a and f.followeeUserId = :b)
         or (f.followerUserId = :b and f.followeeUserId = :a)
      """)
  boolean existsMutualFollow(@Param("a") Long a, @Param("b") Long b);

  boolean existsByFollowerUserIdAndFolloweeUserId(Long followerUserId, Long followeeUserId);

  void deleteByFollowerUserIdAndFolloweeUserId(Long followerUserId, Long followeeUserId);
}
```

`FollowService.java` (Create)

```java
package com.kaldinote.user.application;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.user.domain.Follow;
import com.kaldinote.user.infrastructure.FollowRepository;
import com.kaldinote.user.infrastructure.UserRepository;
import com.kaldinote.user.presentation.dto.FollowStatusResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FollowService {

  private final FollowRepository followRepository;
  private final UserRepository userRepository;

  /** 인가 판정이 쓰는 유일한 공개 지점. RecipeService·BrewLogService가 주입해 호출한다. */
  public boolean isMutual(Long viewerId, Long ownerId) {
    if (viewerId == null || ownerId == null || viewerId.equals(ownerId)) {
      return false;
    }
    return followRepository.existsMutualFollow(viewerId, ownerId);
  }

  @Transactional
  public void follow(Long followerId, Long followeeId) {
    validateTarget(followerId, followeeId);
    if (followRepository.existsByFollowerUserIdAndFolloweeUserId(followerId, followeeId)) {
      return; // 멱등 — 이미 있으면 아무것도 하지 않는다
    }
    followRepository.save(Follow.of(followerId, followeeId));
  }

  @Transactional
  public void unfollow(Long followerId, Long followeeId) {
    validateTarget(followerId, followeeId);
    followRepository.deleteByFollowerUserIdAndFolloweeUserId(followerId, followeeId);
  }

  public FollowStatusResponse status(Long viewerId, Long targetId) {
    validateTarget(viewerId, targetId);
    boolean following =
        followRepository.existsByFollowerUserIdAndFolloweeUserId(viewerId, targetId);
    boolean followedBy =
        followRepository.existsByFollowerUserIdAndFolloweeUserId(targetId, viewerId);
    return new FollowStatusResponse(following, followedBy, following && followedBy);
  }

  /** 검증 순서: 404(대상 없음) → 400(자기 자신). 스펙의 401 → 404 → 403 → 400을 따른다. */
  private void validateTarget(Long viewerId, Long targetId) {
    if (!userRepository.existsById(targetId)) {
      throw new BusinessException(ErrorCode.NOT_FOUND, "사용자를 찾을 수 없습니다: " + targetId);
    }
    if (viewerId.equals(targetId)) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "자기 자신을 대상으로 할 수 없습니다.");
    }
  }
}
```

`FollowStatusResponse.java` (Create)

```java
package com.kaldinote.user.presentation.dto;

/**
 * @param following 내가 상대를 팔로우하고 있다
 * @param followedBy 상대가 나를 팔로우하고 있다
 * @param mutual 둘 다 참. FRIENDS 공개범위 판정과 같은 값이다
 */
public record FollowStatusResponse(boolean following, boolean followedBy, boolean mutual) {}
```

`FollowController.java` (Create)

```java
package com.kaldinote.user.presentation;

import com.kaldinote.common.security.AuthenticatedUser;
import com.kaldinote.user.application.FollowService;
import com.kaldinote.user.presentation.dto.FollowStatusResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users/{userId}/follow")
@RequiredArgsConstructor
@Tag(name = "팔로우", description = "팔로우 등록·해제·상태 조회. FRIENDS 공개범위의 근거가 된다")
public class FollowController {

  private final FollowService followService;

  @PostMapping
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void follow(@PathVariable Long userId, AuthenticatedUser user) {
    followService.follow(user.id(), userId);
  }

  @DeleteMapping
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void unfollow(@PathVariable Long userId, AuthenticatedUser user) {
    followService.unfollow(user.id(), userId);
  }

  @GetMapping
  public FollowStatusResponse status(@PathVariable Long userId, AuthenticatedUser user) {
    return followService.status(user.id(), userId);
  }
}
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*FollowControllerTest'`
Expected: PASS, 18 tests

전체도 확인한다: `./gradlew clean check` — 특히 `UserRepositoryTest`가 깨지지 않았는지 본다. 깨졌다면 `@Transactional`이 빠진 것이다.

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(user): 팔로우 등록·해제·상태 조회 API" && cd backend
```

---

## Task 2: 레시피 조회 인가

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Test: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`

**Covers:** AC-VIS-01 ~ AC-VIS-17 (17개)

**Interfaces:**
- Consumes: `FollowService.isMutual(Long, Long)` (Task 1)
- Produces: `RecipeService.findViewable(Long userId, Long recipeId)` — 판정 규칙의 참조 구현. Task 3이 같은 모양으로 `BrewLogService`에 만든다

**주의:** `findOwned`는 **그대로 둔다.** `update`·`delete`가 계속 써야 `AC-VIS-14`·`AC-VIS-15`가 통과한다.

- [x] **Step 1: 실패하는 테스트 작성**

`RecipeControllerTest`에 헬퍼와 테스트를 추가한다. 기존 테스트는 건드리지 않는다.

```java
  // ===== 공개범위 인가 (AC-VIS-01~17) =====

  @Autowired private FollowRepository followRepository;
  @Autowired private RecipeRepository recipeRepository;

  /** 팔로우 픽스처는 API로 만든다 — Task 1이 선행인 이유다. */
  private void follow(User follower, User followee) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/users/{id}/follow", followee.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(follower)))
        .andExpect(status().isNoContent());
  }

  private void mutualFollow(User a, User b) throws Exception {
    follow(a, b);
    follow(b, a);
  }

  /** visibility를 지정해 레시피를 만들고 id를 돌려준다. */
  private Long recipeWith(String token, String visibility) throws Exception {
    return createdId(
        mockMvc.perform(
            post("/api/v1/recipes")
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"title":"인가 테스트","doseG":15.0,"waterG":250.0,"visibility":"%s"}
                    """
                        .formatted(visibility))));
  }

  private ResultActions getRecipe(String token, Long recipeId) throws Exception {
    return mockMvc.perform(
        get("/api/v1/recipes/{id}", recipeId).header(HttpHeaders.AUTHORIZATION, token));
  }

  // ---------- 소유자 ----------

  @Test
  @DisplayName("AC-VIS-01 · 소유자는 PRIVATE 레시피를 본다")
  void 소유자는_PRIVATE_레시피를_본다() throws Exception {
    User a = newUser("vis-01");
    Long id = recipeWith(tokenOf(a), "PRIVATE");

    getRecipe(tokenOf(a), id)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.visibility").value("PRIVATE"));
  }

  @Test
  @DisplayName("AC-VIS-02 · 소유자는 FRIENDS 레시피를 본다")
  void 소유자는_FRIENDS_레시피를_본다() throws Exception {
    User a = newUser("vis-02");
    Long id = recipeWith(tokenOf(a), "FRIENDS");

    getRecipe(tokenOf(a), id).andExpect(status().isOk());
  }

  @Test
  @DisplayName("AC-VIS-03 · 소유자는 PUBLIC 레시피를 본다")
  void 소유자는_PUBLIC_레시피를_본다() throws Exception {
    User a = newUser("vis-03");
    Long id = recipeWith(tokenOf(a), "PUBLIC");

    getRecipe(tokenOf(a), id).andExpect(status().isOk());
  }

  // ---------- 타인 ----------

  @Test
  @DisplayName("AC-VIS-04 · 타인은 PUBLIC 레시피를 본다")
  void 타인은_PUBLIC_레시피를_본다() throws Exception {
    User a = newUser("vis-04a");
    User b = newUser("vis-04b");
    Long id = recipeWith(tokenOf(a), "PUBLIC");

    getRecipe(tokenOf(b), id)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerUserId").value(a.getId()));
  }

  @Test
  @DisplayName("AC-VIS-05 · 상호 팔로우면 타인이 FRIENDS 레시피를 본다")
  void 상호_팔로우면_FRIENDS_레시피를_본다() throws Exception {
    User a = newUser("vis-05a");
    User b = newUser("vis-05b");
    Long id = recipeWith(tokenOf(a), "FRIENDS");
    mutualFollow(a, b);

    getRecipe(tokenOf(b), id).andExpect(status().isOk());
  }

  @Test
  @DisplayName("AC-VIS-06 · 타인의 PRIVATE 레시피는 403이다")
  void 타인의_PRIVATE_레시피는_403이다() throws Exception {
    User a = newUser("vis-06a");
    User b = newUser("vis-06b");
    Long id = recipeWith(tokenOf(a), "PRIVATE");
    mutualFollow(a, b);

    getRecipe(tokenOf(b), id)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  // ---------- FRIENDS 경계 ----------

  @Test
  @DisplayName("AC-VIS-07 · 내가 소유자를 팔로우만 한 상태면 FRIENDS는 403이다")
  void 내가_팔로우만_하면_FRIENDS는_403이다() throws Exception {
    User a = newUser("vis-07a");
    User b = newUser("vis-07b");
    Long id = recipeWith(tokenOf(a), "FRIENDS");
    follow(b, a);

    getRecipe(tokenOf(b), id)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-VIS-08 · 소유자가 나를 팔로우만 한 상태면 FRIENDS는 403이다")
  void 소유자가_나를_팔로우만_하면_FRIENDS는_403이다() throws Exception {
    User a = newUser("vis-08a");
    User b = newUser("vis-08b");
    Long id = recipeWith(tokenOf(a), "FRIENDS");
    follow(a, b);

    getRecipe(tokenOf(b), id).andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("AC-VIS-09 · 팔로우 관계가 전혀 없으면 FRIENDS는 403이다")
  void 관계없으면_FRIENDS는_403이다() throws Exception {
    User a = newUser("vis-09a");
    User b = newUser("vis-09b");
    Long id = recipeWith(tokenOf(a), "FRIENDS");

    getRecipe(tokenOf(b), id).andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("AC-VIS-10 · 상호 팔로우가 끊기면 다음 요청부터 403이다")
  void 팔로우가_끊기면_즉시_403이다() throws Exception {
    User a = newUser("vis-10a");
    User b = newUser("vis-10b");
    Long id = recipeWith(tokenOf(a), "FRIENDS");
    mutualFollow(a, b);
    getRecipe(tokenOf(b), id).andExpect(status().isOk());

    mockMvc
        .perform(
            delete("/api/v1/users/{id}/follow", a.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(b)))
        .andExpect(status().isNoContent());

    getRecipe(tokenOf(b), id).andExpect(status().isForbidden());
  }

  // ---------- 주인 없는 레시피 ----------

  @Test
  @DisplayName("AC-VIS-11 · owner가 null이고 PUBLIC이면 누구나 본다")
  void owner가_null이고_PUBLIC이면_누구나_본다() throws Exception {
    User a = newUser("vis-11a");
    User b = newUser("vis-11b");
    Long id = recipeWith(tokenOf(a), "PUBLIC");
    orphan(id);

    getRecipe(tokenOf(b), id)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ownerUserId").doesNotExist());
  }

  @Test
  @DisplayName("AC-VIS-12 · owner가 null이고 FRIENDS면 403이다")
  void owner가_null이고_FRIENDS면_403이다() throws Exception {
    User a = newUser("vis-12a");
    User b = newUser("vis-12b");
    Long id = recipeWith(tokenOf(a), "FRIENDS");
    orphan(id);

    getRecipe(tokenOf(b), id).andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("AC-VIS-13 · owner가 null이고 PRIVATE면 403이다")
  void owner가_null이고_PRIVATE면_403이다() throws Exception {
    User a = newUser("vis-13a");
    User b = newUser("vis-13b");
    Long id = recipeWith(tokenOf(a), "PRIVATE");
    orphan(id);

    getRecipe(tokenOf(b), id).andExpect(status().isForbidden());
  }

  // ---------- 쓰기는 소유자 전용 ----------

  @Test
  @DisplayName("AC-VIS-14 · PUBLIC 레시피여도 타인은 수정할 수 없다")
  void PUBLIC이어도_타인은_수정할_수_없다() throws Exception {
    User a = newUser("vis-14a");
    User b = newUser("vis-14b");
    Long id = recipeWith(tokenOf(a), "PUBLIC");
    mutualFollow(a, b);

    mockMvc
        .perform(
            put("/api/v1/recipes/{id}", id)
                .header(HttpHeaders.AUTHORIZATION, tokenOf(b))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"title":"남이 바꾼 제목","doseG":15.0,"waterG":250.0}
                    """))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));

    getRecipe(tokenOf(a), id).andExpect(jsonPath("$.title").value("인가 테스트"));
  }

  @Test
  @DisplayName("AC-VIS-15 · PUBLIC 레시피여도 타인은 삭제할 수 없다")
  void PUBLIC이어도_타인은_삭제할_수_없다() throws Exception {
    User a = newUser("vis-15a");
    User b = newUser("vis-15b");
    Long id = recipeWith(tokenOf(a), "PUBLIC");
    mutualFollow(a, b);

    mockMvc
        .perform(
            delete("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, tokenOf(b)))
        .andExpect(status().isForbidden());

    getRecipe(tokenOf(a), id).andExpect(status().isOk());
  }

  // ---------- 없음 / 미인증 ----------

  @Test
  @DisplayName("AC-VIS-16 · 소프트 삭제된 PUBLIC 레시피는 404다")
  void 삭제된_PUBLIC_레시피는_404다() throws Exception {
    User a = newUser("vis-16a");
    User b = newUser("vis-16b");
    Long id = recipeWith(tokenOf(a), "PUBLIC");
    mockMvc
        .perform(delete("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
        .andExpect(status().isNoContent());

    getRecipe(tokenOf(b), id)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-VIS-17 · 토큰 없이 PUBLIC 레시피를 조회하면 401이다")
  void 토큰_없이_PUBLIC_조회는_401이다() throws Exception {
    User a = newUser("vis-17");
    Long id = recipeWith(tokenOf(a), "PUBLIC");

    mockMvc.perform(get("/api/v1/recipes/{id}", id)).andExpect(status().isUnauthorized());
  }
```

`orphan(id)`는 `owner_user_id`를 null로 만드는 헬퍼다. 사용자 삭제(`ON DELETE SET NULL`)를 흉내내되 실제 삭제는 하지 않는다:

```java
  /** owner_user_id를 null로 만든다. 탈퇴자 유기물·CURATED 시드와 같은 상태를 재현한다. */
  private void orphan(Long recipeId) {
    entityManager
        .createNativeQuery("update recipes set owner_user_id = null where id = :id")
        .setParameter("id", recipeId)
        .executeUpdate();
    entityManager.flush();
    entityManager.clear();
  }
```

`@PersistenceContext private EntityManager entityManager;`를 필드에 추가한다. `newUser`·`tokenOf`는 Task 1의 `FollowControllerTest`와 같은 모양으로 이 클래스에도 만든다(기존 `token(...)` 헬퍼가 있으면 그것을 감싼다).

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`

Expected: FAIL — `AC-VIS-04`·`05`·`11`이 403으로 실패한다(현재 `get()`이 `findOwned`를 써서 소유자가 아니면 무조건 403). `AC-VIS-01~03`·`06~10`·`12~17`은 **이미 통과한다** — 현재 동작이 우연히 기대와 같기 때문이다. RED가 3개뿐인 것이 정상이며, 이 3개가 판정 규칙 전체를 끌어낸다.

- [x] **Step 3: RecipeService에 조회 인가 추가**

```java
  private final FollowService followService;   // 필드 추가

  public RecipeResponse get(Long userId, Long recipeId) {
    return RecipeResponse.from(findViewable(userId, recipeId));
  }

  /**
   * 조회 인가. 스펙의 판정 순서를 그대로 따른다:
   * 소유자 → PUBLIC → FRIENDS+상호팔로우 → 403.
   *
   * <p>쓰기(update/delete)는 findOwned를 계속 쓴다. 여기서 갈라놓지 않으면
   * PUBLIC 레시피를 남이 수정할 수 있게 된다(AC-VIS-14·15).
   */
  private Recipe findViewable(Long userId, Long recipeId) {
    Recipe recipe =
        recipeRepository
            .findByIdAndDeletedAtIsNull(recipeId)
            .orElseThrow(
                () -> new BusinessException(ErrorCode.NOT_FOUND, "레시피를 찾을 수 없습니다: " + recipeId));
    if (isViewable(userId, recipe)) {
      return recipe;
    }
    throw new BusinessException(ErrorCode.FORBIDDEN, "이 레시피를 볼 권한이 없습니다.");
  }

  private boolean isViewable(Long userId, Recipe recipe) {
    if (recipe.isOwnedBy(userId)) {
      return true;
    }
    if (recipe.getVisibility() == RecipeVisibility.PUBLIC) {
      return true;
    }
    return recipe.getVisibility() == RecipeVisibility.FRIENDS
        && followService.isMutual(userId, recipe.getOwnerUserId());
  }
```

`FollowService`가 `user.application`에 있으므로 import를 추가한다. `RecipeService`가 `user` 도메인의 서비스를 주입하는 것은 `gear` 리포지토리를 직접 주입하는 기존 패턴과 같은 결이다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: PASS — 기존 테스트 + 신규 17개 전부

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 공개범위 기반 조회 인가" && cd backend
```

---

## Task 3: 브루잉 로그 visibility 입력 + 조회 인가

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/brewlog/presentation/dto/BrewLogCreateRequest.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/domain/BrewLog.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java`
- Modify: `backend/src/main/java/com/kaldinote/common/error/GlobalExceptionHandler.java`
- Test: `backend/src/test/java/com/kaldinote/brewlog/presentation/BrewLogControllerTest.java`

**Covers:** AC-VIS-18 ~ AC-VIS-28 (11개)

**Interfaces:**
- Consumes: `FollowService.isMutual(Long, Long)` (Task 1), Task 2의 `findViewable` 판정 구조
- Produces: 없음 (마지막 태스크)

- [ ] **Step 1: 실패하는 테스트 작성**

`BrewLogControllerTest`에 추가한다. 기존 헬퍼(`token`, `recipeId`, `beanBatchId`, `userGrinderId`, `minimalBody`, `bodyWith`)를 그대로 쓴다.

```java
  // ===== 공개범위 인가 (AC-VIS-18~28) =====

  private void follow(User follower, User followee) throws Exception {
    mockMvc
        .perform(
            post("/api/v1/users/{id}/follow", followee.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(follower)))
        .andExpect(status().isNoContent());
  }

  private void mutualFollow(User a, User b) throws Exception {
    follow(a, b);
    follow(b, a);
  }

  /** visibility를 지정해 브루잉 로그를 만들고 id를 돌려준다. */
  private Long brewLogWith(String token, String visibility) throws Exception {
    Long recipe = recipeId(token);
    Long batch = beanBatchId(token, BREWED_AT, 6);
    Long grinder = userGrinderId(token, c40Id());
    return createdId(
        createBrewLog(
            token,
            bodyWith(recipe, batch, BREWED_AT, grinder, "\"visibility\":\"%s\"".formatted(visibility))));
  }

  private ResultActions getBrewLog(String token, Long id) throws Exception {
    return mockMvc.perform(
        get("/api/v1/brew-logs/{id}", id).header(HttpHeaders.AUTHORIZATION, token));
  }

  // ---------- visibility 입력 ----------

  @Test
  @DisplayName("AC-VIS-18 · visibility를 생략하면 PRIVATE으로 저장된다")
  void visibility를_생략하면_PRIVATE이다() throws Exception {
    String token = token("vis-18");
    Long recipe = recipeId(token);
    Long batch = beanBatchId(token, BREWED_AT, 6);
    Long grinder = userGrinderId(token, c40Id());

    createBrewLog(token, minimalBody(recipe, batch, BREWED_AT, grinder))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.visibility").value("PRIVATE"));
  }

  @Test
  @DisplayName("AC-VIS-19 · visibility에 PUBLIC을 주면 그대로 저장된다")
  void visibility_PUBLIC은_그대로_저장된다() throws Exception {
    String token = token("vis-19");
    Long id = brewLogWith(token, "PUBLIC");

    getBrewLog(token, id).andExpect(jsonPath("$.visibility").value("PUBLIC"));
  }

  @Test
  @DisplayName("AC-VIS-20 · visibility에 FRIENDS를 주면 그대로 저장된다")
  void visibility_FRIENDS는_그대로_저장된다() throws Exception {
    String token = token("vis-20");
    Long id = brewLogWith(token, "FRIENDS");

    getBrewLog(token, id).andExpect(jsonPath("$.visibility").value("FRIENDS"));
  }

  @Test
  @DisplayName("AC-VIS-21 · 허용값 밖의 visibility는 400이다")
  void 허용값_밖_visibility는_400이다() throws Exception {
    String token = token("vis-21");
    Long recipe = recipeId(token);
    Long batch = beanBatchId(token, BREWED_AT, 6);
    Long grinder = userGrinderId(token, c40Id());

    createBrewLog(token, bodyWith(recipe, batch, BREWED_AT, grinder, "\"visibility\":\"SECRET\""))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  // ---------- 조회 인가 ----------

  @Test
  @DisplayName("AC-VIS-22 · 소유자는 PRIVATE 로그를 본다")
  void 소유자는_PRIVATE_로그를_본다() throws Exception {
    String token = token("vis-22");
    Long id = brewLogWith(token, "PRIVATE");

    getBrewLog(token, id).andExpect(status().isOk());
  }

  @Test
  @DisplayName("AC-VIS-23 · 타인의 PRIVATE 로그는 403이다")
  void 타인의_PRIVATE_로그는_403이다() throws Exception {
    User a = newUser("vis-23a");
    User b = newUser("vis-23b");
    Long id = brewLogWith(tokenOf(a), "PRIVATE");
    mutualFollow(a, b);

    getBrewLog(tokenOf(b), id)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-VIS-24 · 타인은 PUBLIC 로그를 본다")
  void 타인은_PUBLIC_로그를_본다() throws Exception {
    User a = newUser("vis-24a");
    User b = newUser("vis-24b");
    Long id = brewLogWith(tokenOf(a), "PUBLIC");

    String ownerBody = getBrewLog(tokenOf(a), id).andReturn().getResponse().getContentAsString();

    getBrewLog(tokenOf(b), id)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.brewRatio").value(JsonPath.read(ownerBody, "$.brewRatio")))
        .andExpect(jsonPath("$.daysOffRoast").value(JsonPath.read(ownerBody, "$.daysOffRoast")));
  }

  @Test
  @DisplayName("AC-VIS-25 · 상호 팔로우면 타인이 FRIENDS 로그를 본다")
  void 상호_팔로우면_FRIENDS_로그를_본다() throws Exception {
    User a = newUser("vis-25a");
    User b = newUser("vis-25b");
    Long id = brewLogWith(tokenOf(a), "FRIENDS");
    mutualFollow(a, b);

    getBrewLog(tokenOf(b), id).andExpect(status().isOk());
  }

  @Test
  @DisplayName("AC-VIS-26 · 단방향 팔로우면 FRIENDS 로그는 403이다")
  void 단방향_팔로우면_FRIENDS_로그는_403이다() throws Exception {
    User a = newUser("vis-26a");
    User b = newUser("vis-26b");
    Long id = brewLogWith(tokenOf(a), "FRIENDS");
    follow(b, a);

    getBrewLog(tokenOf(b), id).andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("AC-VIS-27 · PRIVATE 레시피를 참조하는 PUBLIC 로그는 타인에게 200이다")
  void PRIVATE_레시피를_참조하는_PUBLIC_로그는_타인에게_200이다() throws Exception {
    User a = newUser("vis-27a");
    User b = newUser("vis-27b");
    String tokenA = tokenOf(a);

    Long recipe = recipeId(tokenA); // 기본값 PRIVATE
    Long batch = beanBatchId(tokenA, BREWED_AT, 6);
    Long grinder = userGrinderId(tokenA, c40Id());
    Long logId =
        createdId(
            createBrewLog(
                tokenA,
                bodyWith(recipe, batch, BREWED_AT, grinder, "\"visibility\":\"PUBLIC\"")));

    getBrewLog(tokenOf(b), logId)
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.recipeId").value(recipe));

    // 같은 사람이 그 레시피를 직접 열면 여전히 막힌다 — 둘의 visibility는 독립이다
    mockMvc
        .perform(
            get("/api/v1/recipes/{id}", recipe).header(HttpHeaders.AUTHORIZATION, tokenOf(b)))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("AC-VIS-28 · 토큰 없이 PUBLIC 로그를 조회하면 401이다")
  void 토큰_없이_PUBLIC_로그_조회는_401이다() throws Exception {
    String token = token("vis-28");
    Long id = brewLogWith(token, "PUBLIC");

    mockMvc.perform(get("/api/v1/brew-logs/{id}", id)).andExpect(status().isUnauthorized());
  }
```

`newUser`·`tokenOf` 헬퍼를 이 클래스에도 추가한다(기존 `token(String)`은 토큰만 돌려줘 팔로우 픽스처에 쓸 수 없다):

```java
  private User newUser(String nickname) {
    return userRepository.save(User.create(null, nickname, null));
  }

  private String tokenOf(User user) {
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`

Expected: FAIL — 11개 중 최소 9개.
- `AC-VIS-19`·`20`: `visibility`를 요청으로 받지 않아 항상 `PRIVATE`이 저장돼 단언이 깨진다
- `AC-VIS-21`: **500 `INTERNAL_ERROR`가 나올 것으로 예상한다.** `GlobalExceptionHandler`에 `HttpMessageNotReadableException` 핸들러가 없어 Jackson 역직렬화 실패가 `handleUnexpected(Exception)`으로 떨어진다
- `AC-VIS-24`·`25`·`27`: 타인 조회가 403
- `AC-VIS-18`·`22`·`23`·`26`·`28`은 이미 통과한다

- [ ] **Step 3: DTO · 엔티티 · 서비스 · 예외 핸들러 수정**

`BrewLogCreateRequest`에 필드 추가 — **위치는 `brewedAt` 다음**(스펙의 요청 예시 순서와 맞춘다):

```java
    @NotNull @PastOrPresent Instant brewedAt,
    BrewLogVisibility visibility,
```

`BrewLog`의 팩토리에 파라미터를 추가한다. `visibility`가 null이면 `PRIVATE`으로 떨어뜨린다 — 기본값을 DTO가 아니라 도메인이 정하게 해서, 다른 경로로 만들어도 같은 기본값이 되게 한다:

```java
  public static BrewLog create(
      Long userId,
      Long recipeId,
      Long beanBatchId,
      Instant brewedAt,
      BrewLogVisibility visibility,
      // ... 나머지 파라미터 그대로
      ) {
    BrewLog log = new BrewLog(/* 기존 인자 그대로 */);
    log.visibility = (visibility == null) ? BrewLogVisibility.PRIVATE : visibility;
    return log;
  }
```

> 기존 private 생성자가 `this.visibility = BrewLogVisibility.PRIVATE;`로 하드코딩하고 있다(`BrewLog.java:133`). 그 줄을 지우고 위처럼 팩토리에서 정한다.

`BrewLogService`:

```java
  private final FollowService followService;   // 필드 추가

  public BrewLogResponse get(Long userId, Long brewLogId) {
    BrewLog log = findViewable(userId, brewLogId);
    ExtractionAnalysis analysis =
        extractionAnalyzer.analyze(
            new BrewMeasurement(
                log.getActualDoseG(),
                log.getActualWaterG(),
                log.getBeverageWeightG(),
                log.getTdsPercent()));
    return BrewLogResponse.from(log, analysis);
  }

  /** 판정 규칙은 RecipeService.findViewable과 같다. enum이 달라 공통 함수로 묶지 않는다. */
  private BrewLog findViewable(Long userId, Long brewLogId) {
    BrewLog log =
        brewLogRepository
            .findById(brewLogId)
            .orElseThrow(
                () ->
                    new BusinessException(ErrorCode.NOT_FOUND, "브루잉 로그를 찾을 수 없습니다: " + brewLogId));
    if (isViewable(userId, log)) {
      return log;
    }
    throw new BusinessException(ErrorCode.FORBIDDEN, "이 브루잉 로그를 볼 권한이 없습니다.");
  }

  private boolean isViewable(Long userId, BrewLog log) {
    if (log.isOwnedBy(userId)) {
      return true;
    }
    if (log.getVisibility() == BrewLogVisibility.PUBLIC) {
      return true;
    }
    return log.getVisibility() == BrewLogVisibility.FRIENDS
        && followService.isMutual(userId, log.getUserId());
  }
```

`create(...)`에서 `BrewLog.create(...)` 호출에 `request.visibility()`를 넘긴다.

`GlobalExceptionHandler`에 핸들러 추가 — **Step 2에서 500이 확인된 경우에만**:

```java
  /**
   * 잘못된 enum 값·깨진 JSON 등 역직렬화 실패. 핸들러가 없으면 handleUnexpected로 떨어져
   * 클라이언트 입력 오류가 500이 된다.
   */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException e) {
    log.warn("요청 본문을 읽을 수 없음: {}", e.getMessage());
    return toResponse(ErrorCode.INVALID_REQUEST, "요청 본문을 읽을 수 없습니다.");
  }
```

> 이 핸들러는 `visibility` 밖에도 영향을 준다 — 지금까지 500이던 모든 깨진 JSON 요청이 400이 된다. 기존 테스트 중 500을 기대하는 것이 없는지 `clean check`로 확인한다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: PASS — 기존 39개 + 신규 11개

- [ ] **Step 5: 스펙 status 전환 + 전체 검증**

`docs/specs/2026-08-17-visibility-authorization.md`의 `status: 초안` → `status: 구현완료`.

```bash
./gradlew clean check
cd .. && ./scripts/check-spec-coverage.sh
```

`check-spec-coverage.sh`가 AC 46개를 전부 찾아야 한다. 하나라도 빠지면 실패한다.

- [ ] **Step 6: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(brewlog): visibility 입력과 공개범위 조회 인가" && cd backend
```

---

## 완료 기준

- [ ] `cd backend && ./gradlew clean check` 통과
- [ ] `./scripts/check-spec-coverage.sh` 통과 — `docs/specs/2026-08-17-visibility-authorization.md`가 `[구현완료] — AC 46개 전부`
- [ ] 스펙의 `status`를 `구현완료`로 변경
- [ ] **수동 확인 1:** `bootRun` + curl로 두 계정을 만들어 서로 팔로우한 뒤, `FRIENDS` 레시피가 상대 계정에서 `200`으로 열리는 것을 확인 (`docs/design/2026-08-14-architecture.md:253`의 핵심 시나리오 6단계)
- [ ] **수동 확인 2:** 한쪽이 팔로우를 해제한 직후 같은 요청이 `403`으로 바뀌는 것을 확인

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 46개 중 46개가 태스크에 매핑됨 (Task 1: 18, Task 2: 17, Task 3: 11)

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** Task 2·3이 쓰는 `FollowService.isMutual(Long, Long)`은 Task 1에서 정의한 시그니처와 일치. `findViewable`은 두 서비스에서 각각 private으로 정의되며 서로 참조하지 않는다.

**검증되지 않은 가정:**

1. **`HttpMessageNotReadableException` 핸들러가 없어 잘못된 enum이 500이 될 것이다.** `GlobalExceptionHandler`를 확인한 결과 해당 핸들러가 없고 `@ExceptionHandler(Exception.class)`가 있어 그리로 떨어질 것으로 보이나, Spring Boot 4의 `ProblemDetail` 기본 처리가 먼저 잡을 가능성이 남아 있다. **Task 3 Step 2에서 실제 상태 코드를 확인하고, 이미 400이면 핸들러 추가를 건너뛴다.**
2. **`AC-VIS-11`의 `ownerUserId` 단언 방식.** `jsonPath("$.ownerUserId").doesNotExist()`는 Jackson이 null 필드를 응답에서 빼는 경우에만 맞는다. 포함시키는 설정이면 `.value(nullValue())`로 바꿔야 한다. Step 2에서 실제 응답을 보고 정한다.
3. **`orphan()` 네이티브 쿼리와 영속성 컨텍스트.** `@Transactional` 테스트 안에서 네이티브 update를 한 뒤 `flush`/`clear`를 해야 이후 조회가 갱신된 값을 본다. 이 순서가 맞는지는 Step 2에서 확인한다.
4. **`RecipeControllerTest`에 `@Transactional`이 이미 있는지.** 없다면 Task 2에서 추가해야 하고, 추가하는 순간 기존 테스트의 커밋 의존성이 드러날 수 있다. 브루잉 로그 Task 1에서 `GearControllerTest`가 정확히 이 문제를 냈다.
5. **`Follow.of()`가 자기 팔로우에 `IllegalArgumentException`을 던진다.** `FollowService`가 그 앞에서 `BusinessException(INVALID_REQUEST)`로 막으므로 도달하지 않지만, 만약 순서가 뒤바뀌면 `handleIllegalArgument`가 잡아 같은 400 `INVALID_REQUEST`를 낸다 — 어느 쪽이든 AC는 통과한다.

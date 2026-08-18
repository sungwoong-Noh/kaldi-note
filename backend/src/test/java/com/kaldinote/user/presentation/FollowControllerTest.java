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
 * users·follows에 실제로 쓰므로 클래스 레벨 @Transactional이 필수다. 빠뜨리면 커밋된 사용자가 남아 UserRepositoryTest의 건수 단언이
 * 깨진다 (docs/JOURNAL.md 2026-08-17, 브루잉 로그 Task 1).
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
            get("/api/v1/users/{id}/follow", 999999L).header(HttpHeaders.AUTHORIZATION, tokenOf(a)))
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

package com.kaldinote.user.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class UserControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;

  private String tokenOf(User user) {
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  @Test
  @DisplayName("AC-ME-01 · 내 프로필은 여섯 필드를 반환한다")
  void 내_프로필은_여섯_필드를_반환한다() throws Exception {
    // email·profileImageUrl이 null이면 non_null 직렬화로 키가 빠져 집합이 달라진다
    User user =
        userRepository.save(User.create("me@example.com", "노성웅", "https://example.com/avatar.png"));

    String body =
        mockMvc
            .perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, tokenOf(user)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(user.getId()))
            .andExpect(jsonPath("$.nickname").value("노성웅"))
            .andExpect(jsonPath("$.role").value("USER"))
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(JsonPath.<Map<String, Object>>read(body, "$").keySet())
        .containsExactlyInAnyOrder(
            "id", "email", "nickname", "profileImageUrl", "role", "createdAt");
  }

  @Test
  @DisplayName("AC-ME-02 · 이메일이 없는 사용자도 200이다")
  void 이메일이_없는_사용자도_200이다() throws Exception {
    // 카카오는 이메일 제공 동의가 선택이라 null이 정상이다
    User user = userRepository.save(User.create(null, "이메일없음", null));

    mockMvc
        .perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, tokenOf(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").doesNotExist())
        .andExpect(jsonPath("$.nickname").value("이메일없음"));
  }

  @Test
  @DisplayName("AC-ME-03 · JWT 없이 내 프로필을 부르면 401이다")
  void JWT_없이_내_프로필을_부르면_401이다() throws Exception {
    mockMvc.perform(get("/api/v1/users/me")).andExpect(status().isUnauthorized());
  }

  // ---------- 공개 프로필 ----------

  @Test
  @DisplayName("AC-WEBFOLLOW-01 · 공개 프로필은 id·nickname·profileImageUrl을 반환한다")
  void 공개_프로필은_세_필드를_반환한다() throws Exception {
    User viewer = userRepository.save(User.create("me@example.com", "노성웅", null));
    User target =
        userRepository.save(
            User.create("friend@example.com", "확인용친구", "https://example.com/f.png"));

    mockMvc
        .perform(
            get("/api/v1/users/" + target.getId())
                .header(HttpHeaders.AUTHORIZATION, tokenOf(viewer)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(target.getId()))
        .andExpect(jsonPath("$.nickname").value("확인용친구"))
        .andExpect(jsonPath("$.profileImageUrl").value("https://example.com/f.png"));
  }

  @Test
  @DisplayName("AC-WEBFOLLOW-02 · 공개 프로필은 email·role·createdAt을 담지 않는다")
  void 공개_프로필은_민감한_필드를_담지_않는다() throws Exception {
    User viewer = userRepository.save(User.create("me@example.com", "노성웅", null));
    User target =
        userRepository.save(
            User.create("friend@example.com", "확인용친구", "https://example.com/f.png"));

    String body =
        mockMvc
            .perform(
                get("/api/v1/users/" + target.getId())
                    .header(HttpHeaders.AUTHORIZATION, tokenOf(viewer)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();

    assertThat(JsonPath.<Map<String, Object>>read(body, "$").keySet())
        .containsExactlyInAnyOrder("id", "nickname", "profileImageUrl");
  }

  @Test
  @DisplayName("AC-WEBFOLLOW-03 · 자기 자신의 공개 프로필도 200이다")
  void 자기_자신의_공개_프로필도_200이다() throws Exception {
    // 내 초대 링크가 제대로 됐는지 눌러 확인하는 것은 흔한 행동이다.
    // FollowService.status는 자기 자신에 400을 내지만 이 엔드포인트는 막지 않는다.
    User user = userRepository.save(User.create("me@example.com", "노성웅", null));

    mockMvc
        .perform(
            get("/api/v1/users/" + user.getId()).header(HttpHeaders.AUTHORIZATION, tokenOf(user)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(user.getId()));
  }

  @Test
  @DisplayName("AC-WEBFOLLOW-15 · 없는 사용자는 404와 NOT_FOUND다")
  void 없는_사용자는_404다() throws Exception {
    User viewer = userRepository.save(User.create("me@example.com", "노성웅", null));

    mockMvc
        .perform(get("/api/v1/users/999999").header(HttpHeaders.AUTHORIZATION, tokenOf(viewer)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-WEBFOLLOW-16 · 인증 없이 공개 프로필을 부르면 401이다")
  void 인증_없이_공개_프로필을_부르면_401이다() throws Exception {
    User target = userRepository.save(User.create("friend@example.com", "확인용친구", null));

    mockMvc.perform(get("/api/v1/users/" + target.getId())).andExpect(status().isUnauthorized());
  }
}

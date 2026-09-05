package com.kaldinote.common.error;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

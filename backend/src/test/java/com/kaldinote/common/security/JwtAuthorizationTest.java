package com.kaldinote.common.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.user.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;

class JwtAuthorizationTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;

  private String bearer(String token) {
    return "Bearer " + token;
  }

  @Test
  void 유효한_토큰이면_보호된_엔드포인트에_접근할_수_있다() throws Exception {
    String token = tokenProvider.createAccessToken(1L, UserRole.USER);

    mockMvc
        .perform(get("/test-support/secured").header(HttpHeaders.AUTHORIZATION, bearer(token)))
        .andExpect(status().isOk());
  }

  @Test
  void 잘못된_토큰이면_401이다() throws Exception {
    mockMvc
        .perform(get("/test-support/secured").header(HttpHeaders.AUTHORIZATION, bearer("garbage")))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 일반_사용자는_관리자_엔드포인트에서_403이다() throws Exception {
    String token = tokenProvider.createAccessToken(1L, UserRole.USER);

    mockMvc
        .perform(get("/test-support/admin").header(HttpHeaders.AUTHORIZATION, bearer(token)))
        .andExpect(status().isForbidden());
  }

  @Test
  void 관리자는_관리자_엔드포인트에_접근할_수_있다() throws Exception {
    String token = tokenProvider.createAccessToken(1L, UserRole.ADMIN);

    mockMvc
        .perform(get("/test-support/admin").header(HttpHeaders.AUTHORIZATION, bearer(token)))
        .andExpect(status().isOk());
  }
}

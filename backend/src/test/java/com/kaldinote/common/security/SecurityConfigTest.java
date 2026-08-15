package com.kaldinote.common.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;

class SecurityConfigTest extends AbstractIntegrationTest {

  @Test
  void 헬스체크는_인증_없이_접근할_수_있다() throws Exception {
    mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
  }

  @Test
  void 인증이_필요한_엔드포인트는_토큰_없이_401이다() throws Exception {
    mockMvc.perform(get("/test-support/secured")).andExpect(status().isUnauthorized());
  }

  @Test
  void CSRF_토큰_없는_POST가_403이_아니어야_한다() throws Exception {
    // Spring Security 7은 CSRF가 기본 활성이다. 끄지 않으면 403이 뜬다.
    // stateless REST API이므로 반드시 비활성화해야 한다.
    mockMvc.perform(post("/test-support/secured")).andExpect(status().isUnauthorized());
  }
}

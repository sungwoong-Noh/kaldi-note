package com.kaldinote.auth.presentation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * 테스트 로그인의 잠금.
 *
 * <p><b>시크릿을 테스트마다 바꿔야 하므로 중첩 클래스로 나눈다.</b> @TestPropertySource가 컨텍스트 캐시 키를 갈라서 중첩 클래스마다 별도 컨텍스트가
 * 뜬다 — 갈리지 않으면 세 클래스가 서로를 오염시킨다.
 *
 * <p>스펙(docs/specs/2026-09-05-test-login.md)의 경고 상자를 먼저 읽는다.
 */
@Transactional
class AuthControllerTest extends AbstractIntegrationTest {

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
}

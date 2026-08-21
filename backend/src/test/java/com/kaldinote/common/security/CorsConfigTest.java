package com.kaldinote.common.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 프론트가 브라우저에서 백엔드를 직접 부르므로 CORS가 필요하다.
 *
 * <p>Swagger UI는 동일 출처이고 MockMvc는 실제 프리플라이트를 보내지 않아, 이 설정이 없다는 사실이 지금까지 드러나지 않았다.
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

package com.kaldinote.common.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * AuthenticatedUser는 서버가 JWT에서 채우는 값이라 사람이 입력할 수 없다. springdoc이 이것을 쿼리 파라미터로 노출하면 Swagger UI에 채울 수
 * 없는 필수 입력란이 모든 인증 엔드포인트에 생긴다.
 */
class OpenApiDocsTest extends AbstractIntegrationTest {

  @Test
  @DisplayName("AC-SWAGGER-01 · API 문서에 user 쿼리 파라미터가 하나도 없다")
  void user_쿼리_파라미터가_없다() throws Exception {
    mockMvc
        .perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$..parameters[?(@.name == 'user' && @.in == 'query')]", Matchers.empty()));
  }

  @Test
  @DisplayName("AC-SWAGGER-02 · 숨김이 엔드포인트를 지우지 않는다")
  void 엔드포인트가_사라지지_않는다() throws Exception {
    mockMvc
        .perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.paths['/api/v1/recipes']").exists())
        .andExpect(jsonPath("$.paths['/api/v1/recipes/{id}']").exists())
        .andExpect(jsonPath("$.paths['/api/v1/brew-logs']").exists())
        .andExpect(jsonPath("$.paths['/api/v1/users/me']").exists())
        .andExpect(jsonPath("$.paths['/api/v1/gear/user-grinders']").exists());
  }

  @Test
  @DisplayName("AC-SWAGGER-03 · bearerAuth 보안 스키마가 유지된다")
  void bearerAuth_스키마가_유지된다() throws Exception {
    mockMvc
        .perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.type").value("http"))
        .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme").value("bearer"))
        .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.bearerFormat").value("JWT"));
  }
}

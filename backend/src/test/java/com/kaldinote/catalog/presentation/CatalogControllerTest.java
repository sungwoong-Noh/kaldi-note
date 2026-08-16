package com.kaldinote.catalog.presentation;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class CatalogControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;

  private String token() {
    User user = userRepository.save(User.create(null, "테스터", null));
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  @Test
  void 인증_없이_품종_목록을_조회하면_401이다() throws Exception {
    mockMvc.perform(get("/api/v1/catalog/varieties")).andExpect(status().isUnauthorized());
  }

  @Test
  void 품종_목록을_조회한다() throws Exception {
    mockMvc
        .perform(get("/api/v1/catalog/varieties").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(greaterThanOrEqualTo(15)));
  }

  @Test
  void 품종을_추가하면_시스템_소유가_아니다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/catalog/varieties")
                .header(HttpHeaders.AUTHORIZATION, token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Sidra\",\"nameKo\":\"시드라\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.name").value("Sidra"))
        .andExpect(jsonPath("$.isSystem").value(false));
  }

  @Test
  void 중복된_이름으로_품종을_추가하면_409다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/catalog/varieties")
                .header(HttpHeaders.AUTHORIZATION, token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Geisha\",\"nameKo\":\"게이샤2\"}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DUPLICATE_NAME"));
  }
}

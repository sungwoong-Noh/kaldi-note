package com.kaldinote.recipe;

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

/**
 * 시드가 test 프로파일에 새어 들어오지 않는지 지킨다.
 *
 * <p>이 테스트가 깨지면 db/seed가 test 프로파일 Flyway에 포함된 것이고, 그 순간 AC-LIST-03·05·09·13·14·32의 기대값이 전부 어긋난다.
 * {@code @Sql}이 없는 것이 이 테스트의 핵심이다 — 실수로 붙이지 말 것.
 */
@Transactional
class SeedIsolationTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;

  @Test
  @DisplayName("AC-SEED-13 · test 프로파일에는 시드가 적용되지 않는다")
  void test_프로파일에는_시드가_없다() throws Exception {
    User user = userRepository.save(User.create(null, "격리테스터", null));
    String token = "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());

    mockMvc
        .perform(get("/api/v1/recipes").header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(0));
  }
}

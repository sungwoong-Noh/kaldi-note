package com.kaldinote.common.error;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
import org.springframework.http.MediaType;
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

  @Test
  @DisplayName("AC-HTTPERR-05 · 매핑되지 않은 메서드는 405다")
  void 매핑되지_않은_메서드는_405다() throws Exception {
    mockMvc
        .perform(patch("/api/v1/recipes/19").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isMethodNotAllowed())
        .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
  }

  @Test
  @DisplayName("AC-HTTPERR-06 · 405 본문의 문구")
  void 메서드_405의_문구() throws Exception {
    mockMvc
        .perform(patch("/api/v1/recipes/19").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(jsonPath("$.message").value("이 주소에서 지원하지 않는 방식입니다."));
  }

  /**
   * 순서를 고정하지 않는 이유: 스프링이 Set<HttpMethod>를 돌려주므로 순서까지 기대값에 넣으면 구현이 바뀔 때 이유 없이 빨개진다. POST를 따로 검사하지 않는
   * 이유: DELETE가 POST를 부분 문자열로 포함하지 않아 PATCH 부재만으로 충분하다.
   */
  @Test
  @DisplayName("AC-HTTPERR-07 · 405는 Allow 헤더를 갖는다")
  void 메서드_405는_Allow_헤더를_갖는다() throws Exception {
    mockMvc
        .perform(patch("/api/v1/recipes/19").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(
            header()
                .stringValues(
                    HttpHeaders.ALLOW,
                    hasItem(
                        allOf(
                            containsString("GET"),
                            containsString("PUT"),
                            containsString("DELETE"),
                            not(containsString("PATCH"))))));
  }

  @Test
  @DisplayName("AC-HTTPERR-08 · JSON이 아닌 본문은 415다")
  void JSON이_아닌_본문은_415다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/recipes")
                .header(HttpHeaders.AUTHORIZATION, token())
                .contentType(MediaType.TEXT_PLAIN)
                .content("아침 레시피"))
        .andExpect(status().isUnsupportedMediaType())
        .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));
  }

  @Test
  @DisplayName("AC-HTTPERR-09 · 415 본문의 문구")
  void 미디어타입_415의_문구() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/recipes")
                .header(HttpHeaders.AUTHORIZATION, token())
                .contentType(MediaType.TEXT_PLAIN)
                .content("아침 레시피"))
        .andExpect(jsonPath("$.message").value("지원하지 않는 형식입니다."));
  }

  @Test
  @DisplayName("AC-HTTPERR-10 · 숫자 파라미터에 문자열이 오면 400이다")
  void 숫자_파라미터에_문자열이_오면_400이다() throws Exception {
    mockMvc
        .perform(
            get("/api/v1/recipes").param("size", "abc").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-HTTPERR-11 · 어떤 파라미터가 틀렸는지 fieldErrors로 알린다")
  void 틀린_파라미터를_fieldErrors로_알린다() throws Exception {
    mockMvc
        .perform(
            get("/api/v1/recipes").param("size", "abc").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(jsonPath("$.fieldErrors.length()").value(1))
        .andExpect(jsonPath("$.fieldErrors[0].field").value("size"))
        .andExpect(jsonPath("$.fieldErrors[0].message").value("숫자여야 합니다."));
  }
}

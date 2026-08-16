package com.kaldinote.catalog.presentation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BeanControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;

  private Long userIdRef;

  private String token() {
    User user = userRepository.save(User.create(null, "테스터", null));
    userIdRef = user.getId();
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private String otherUserToken() {
    User other = userRepository.save(User.create(null, "다른사람", null));
    return "Bearer " + tokenProvider.createAccessToken(other.getId(), other.getRole());
  }

  private ResultActions createRoaster(String token, String body) throws Exception {
    return mockMvc.perform(
        post("/api/v1/roasters")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  @Test
  @DisplayName("AC-BEAN-01 · 최소 입력으로 로스터가 생성된다")
  void 최소_입력으로_로스터가_생성된다() throws Exception {
    String token = token();
    createRoaster(
            token,
            """
        {"name":"프릳츠커피컴퍼니"}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.isSystem").value(false))
        .andExpect(jsonPath("$.createdByUserId").value(userIdRef));
  }

  @Test
  @DisplayName("AC-BEAN-02 · 로스터 목록은 이름순으로 전체 반환된다")
  void 로스터_목록은_이름순으로_반환된다() throws Exception {
    String token = token();
    createRoaster(
            token,
            """
        {"name":"프릳츠커피컴퍼니"}
        """)
        .andExpect(status().isCreated());
    createRoaster(
            token,
            """
        {"name":"커피리브레"}
        """)
        .andExpect(status().isCreated());

    mockMvc
        .perform(get("/api/v1/roasters").header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].name").value("커피리브레"))
        .andExpect(jsonPath("$[1].name").value("프릳츠커피컴퍼니"));
  }

  @Test
  @DisplayName("AC-BEAN-20 · 로스터 name 100자는 허용된다")
  void 로스터_name_100자는_허용된다() throws Exception {
    String name = "가".repeat(100);
    createRoaster(
            token(),
            """
        {"name":"%s"}
        """
                .formatted(name))
        .andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-BEAN-21 · 로스터 name 101자는 거부된다")
  void 로스터_name_101자는_거부된다() throws Exception {
    String name = "가".repeat(101);
    createRoaster(
            token(),
            """
        {"name":"%s"}
        """
                .formatted(name))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BEAN-40 · 로스터 이름이 중복되면 거부된다")
  void 로스터_이름이_중복되면_거부된다() throws Exception {
    String token = token();
    createRoaster(
            token,
            """
        {"name":"프릳츠커피컴퍼니"}
        """)
        .andExpect(status().isCreated());

    createRoaster(
            token,
            """
        {"name":"프릳츠커피컴퍼니"}
        """)
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DUPLICATE_NAME"));
  }

  @Test
  @DisplayName("AC-BEAN-41 · 인증 없이 로스터를 생성할 수 없다")
  void 인증_없이_로스터를_생성할_수_없다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/roasters")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                {"name":"프릳츠커피컴퍼니"}
                """))
        .andExpect(status().isUnauthorized());
  }
}

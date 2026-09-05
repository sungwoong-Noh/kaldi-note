package com.kaldinote.auth.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.jayway.jsonpath.JsonPath;
import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.application.AuthService;
import com.kaldinote.auth.domain.OAuthProvider;
import com.kaldinote.auth.infrastructure.UserOAuthAccountRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.domain.UserRole;
import com.kaldinote.user.infrastructure.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.ResultActions;
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

  @Autowired private UserRepository userRepository;
  @Autowired private UserOAuthAccountRepository oauthAccountRepository;

  /** JwtTokenProvider에는 role을 읽는 메서드가 없다. <b>프로덕션에 테스트용 메서드를 만들지 않고</b> 이미 빈으로 있는 디코더를 쓴다. */
  @Autowired private JwtDecoder jwtDecoder;

  private UserRole roleOf(String accessToken) {
    return UserRole.valueOf(jwtDecoder.decode(accessToken).getClaimAsString("role"));
  }

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

    private ResultActions callTestLogin(String body) throws Exception {
      return mockMvc.perform(
          post("/api/v1/auth/login/test")
              .header("X-Test-Login-Secret", SECRET_32)
              .contentType(MediaType.APPLICATION_JSON)
              .content(body));
    }

    @Test
    @DisplayName("AC-TESTLOGIN-01 · userId로 로그인한다")
    void userId로_로그인한다() throws Exception {
      User user = userRepository.save(User.create("me@example.com", "노성웅", null));

      callTestLogin("{\"userId\":" + user.getId() + "}")
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.userId").value(user.getId()))
          .andExpect(jsonPath("$.newUser").value(false))
          .andExpect(jsonPath("$.tokens.accessToken").isNotEmpty())
          .andExpect(jsonPath("$.tokens.refreshToken").isNotEmpty());
    }

    @Test
    @DisplayName("AC-TESTLOGIN-07 · 시크릿이 정확히 32자면 켜진다")
    void 시크릿이_정확히_32자면_켜진다() throws Exception {
      User user = userRepository.save(User.create(null, "노성웅", null));

      callTestLogin("{\"userId\":" + user.getId() + "}").andExpect(status().isOk());
    }

    @Test
    @DisplayName("AC-TESTLOGIN-02 · handle로 처음 부르면 계정이 생긴다")
    void handle로_처음_부르면_계정이_생긴다() throws Exception {
      callTestLogin("{\"handle\":\"friend\",\"nickname\":\"확인용친구\"}")
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.newUser").value(true))
          .andExpect(jsonPath("$.nickname").value("확인용친구"));

      assertThat(
              oauthAccountRepository.findByProviderAndProviderUserId(OAuthProvider.TEST, "friend"))
          .isPresent();
    }

    @Test
    @DisplayName("AC-TESTLOGIN-03 · 같은 handle을 다시 부르면 재사용한다")
    void 같은_handle을_다시_부르면_재사용한다() throws Exception {
      String first =
          callTestLogin("{\"handle\":\"friend\",\"nickname\":\"확인용친구\"}")
              .andReturn()
              .getResponse()
              .getContentAsString();
      long firstId = ((Number) JsonPath.read(first, "$.userId")).longValue();
      long before = userRepository.count();

      callTestLogin("{\"handle\":\"friend\",\"nickname\":\"다른이름\"}")
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.userId").value(firstId))
          .andExpect(jsonPath("$.newUser").value(false));

      assertThat(userRepository.count()).isEqualTo(before);
    }

    @Test
    @DisplayName("AC-TESTLOGIN-04 · 대상이 ADMIN이어도 로그인 응답 토큰은 USER다")
    void 대상이_ADMIN이어도_로그인_토큰은_USER다() throws Exception {
      User admin = User.create(null, "관리자", null);
      admin.promoteToAdmin();
      userRepository.save(admin);

      String body =
          callTestLogin("{\"userId\":" + admin.getId() + "}")
              .andExpect(status().isOk())
              .andReturn()
              .getResponse()
              .getContentAsString();

      assertThat(roleOf(JsonPath.read(body, "$.tokens.accessToken"))).isEqualTo(UserRole.USER);
    }

    @Test
    @DisplayName("AC-TESTLOGIN-05 · 갱신하면 진짜 역할로 돌아온다 (알려진 한계)")
    void 갱신하면_진짜_역할로_돌아온다() throws Exception {
      // 결함을 고치는 조건이 아니라 못박는 조건이다.
      // AuthService.refresh가 역할을 DB에서 다시 읽는다.
      User admin = User.create(null, "관리자", null);
      admin.promoteToAdmin();
      userRepository.save(admin);
      String body =
          callTestLogin("{\"userId\":" + admin.getId() + "}")
              .andReturn()
              .getResponse()
              .getContentAsString();
      String refresh = JsonPath.read(body, "$.tokens.refreshToken");

      String refreshed =
          mockMvc
              .perform(
                  post("/api/v1/auth/refresh")
                      .contentType(MediaType.APPLICATION_JSON)
                      .content("{\"refreshToken\":\"" + refresh + "\"}"))
              .andExpect(status().isOk())
              .andReturn()
              .getResponse()
              .getContentAsString();

      assertThat(roleOf(JsonPath.read(refreshed, "$.accessToken"))).isEqualTo(UserRole.ADMIN);
    }

    @Test
    @DisplayName("AC-TESTLOGIN-06 · 발급된 refresh 토큰이 실제로 동작한다")
    void 발급된_refresh_토큰이_동작한다() throws Exception {
      User user = userRepository.save(User.create(null, "노성웅", null));
      String body =
          callTestLogin("{\"userId\":" + user.getId() + "}")
              .andReturn()
              .getResponse()
              .getContentAsString();
      String refresh = JsonPath.read(body, "$.tokens.refreshToken");

      mockMvc
          .perform(
              post("/api/v1/auth/refresh")
                  .contentType(MediaType.APPLICATION_JSON)
                  .content("{\"refreshToken\":\"" + refresh + "\"}"))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    @DisplayName("AC-TESTLOGIN-12 · userId와 handle을 둘 다 주면 400이다")
    void 둘_다_주면_400이다() throws Exception {
      callTestLogin("{\"userId\":1,\"handle\":\"friend\"}")
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("AC-TESTLOGIN-13 · 둘 다 없으면 400이다")
    void 둘_다_없으면_400이다() throws Exception {
      callTestLogin("{}")
          .andExpect(status().isBadRequest())
          .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    @DisplayName("AC-TESTLOGIN-14 · 없는 userId면 404 NOT_FOUND다")
    void 없는_userId면_404다() throws Exception {
      callTestLogin("{\"userId\":999999}")
          .andExpect(status().isNotFound())
          .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("AC-TESTLOGIN-15 · 쓰면 WARN 로그가 남는다")
    void 쓰면_WARN_로그가_남는다() throws Exception {
      User user = userRepository.save(User.create(null, "노성웅", null));
      Logger logger = (Logger) LoggerFactory.getLogger(AuthService.class);
      ListAppender<ILoggingEvent> appender = new ListAppender<>();
      appender.start();
      logger.addAppender(appender);

      callTestLogin("{\"userId\":" + user.getId() + "}").andExpect(status().isOk());

      logger.detachAppender(appender);
      assertThat(appender.list)
          .anySatisfy(
              event -> {
                assertThat(event.getLevel()).isEqualTo(Level.WARN);
                assertThat(event.getFormattedMessage()).contains(String.valueOf(user.getId()));
              });
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

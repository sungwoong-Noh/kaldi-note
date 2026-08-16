package com.kaldinote.auth.infrastructure.oauth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.kaldinote.auth.application.OAuthUserProfile;
import com.kaldinote.auth.domain.OAuthProvider;
import com.kaldinote.common.error.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class KakaoOAuthClientTest {

  private static final String TOKEN_URI = "https://kauth.kakao.com/oauth/token";
  private static final String USER_INFO_URI = "https://kapi.kakao.com/v2/user/me";

  private MockRestServiceServer server;
  private KakaoOAuthClient client;

  @BeforeEach
  void setUp() {
    RestClient.Builder builder = RestClient.builder();
    server = MockRestServiceServer.bindTo(builder).build();
    OAuthProperties.Registration registration =
        new OAuthProperties.Registration(
            "test-client-id",
            "test-secret",
            "http://localhost:3000/auth/callback",
            TOKEN_URI,
            USER_INFO_URI);
    client = new KakaoOAuthClient(builder, registration);
  }

  @Test
  void 인가코드로_사용자_프로필을_가져온다() {
    server
        .expect(requestTo(TOKEN_URI))
        .andRespond(
            withSuccess("{\"access_token\":\"kakao-access-token\"}", MediaType.APPLICATION_JSON));
    server
        .expect(requestTo(USER_INFO_URI))
        .andRespond(
            withSuccess(
                """
                {
                  "id": 987654321,
                  "kakao_account": {
                    "email": "user@kakao.com",
                    "profile": {
                      "nickname": "커피러버",
                      "profile_image_url": "https://img.kakao.com/p.jpg"
                    }
                  }
                }
                """,
                MediaType.APPLICATION_JSON));

    OAuthUserProfile profile = client.fetchProfile("auth-code");

    assertThat(profile.provider()).isEqualTo(OAuthProvider.KAKAO);
    assertThat(profile.providerUserId()).isEqualTo("987654321");
    assertThat(profile.email()).isEqualTo("user@kakao.com");
    assertThat(profile.nickname()).isEqualTo("커피러버");
    assertThat(profile.profileImageUrl()).isEqualTo("https://img.kakao.com/p.jpg");
    server.verify();
  }

  @Test
  void 이메일_제공에_동의하지_않아도_프로필을_만든다() {
    // 카카오는 이메일 제공이 선택 동의라 필드 자체가 없을 수 있다
    server
        .expect(requestTo(TOKEN_URI))
        .andRespond(withSuccess("{\"access_token\":\"t\"}", MediaType.APPLICATION_JSON));
    server
        .expect(requestTo(USER_INFO_URI))
        .andRespond(
            withSuccess(
                "{\"id\":111,\"kakao_account\":{\"profile\":{\"nickname\":\"익명\"}}}",
                MediaType.APPLICATION_JSON));

    OAuthUserProfile profile = client.fetchProfile("auth-code");

    assertThat(profile.providerUserId()).isEqualTo("111");
    assertThat(profile.email()).isNull();
    assertThat(profile.nickname()).isEqualTo("익명");
  }

  @Test
  void 토큰_교환에_실패하면_업무_예외를_던진다() {
    server.expect(requestTo(TOKEN_URI)).andRespond(withServerError());

    assertThatThrownBy(() -> client.fetchProfile("bad-code")).isInstanceOf(BusinessException.class);
  }
}

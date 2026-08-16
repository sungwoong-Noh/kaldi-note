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

class GoogleOAuthClientTest {

  private static final String TOKEN_URI = "https://oauth2.googleapis.com/token";
  private static final String USER_INFO_URI = "https://www.googleapis.com/oauth2/v3/userinfo";

  private MockRestServiceServer server;
  private GoogleOAuthClient client;

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
    client = new GoogleOAuthClient(builder, registration);
  }

  @Test
  void 인가코드로_사용자_프로필을_가져온다() {
    server
        .expect(requestTo(TOKEN_URI))
        .andRespond(
            withSuccess("{\"access_token\":\"google-access-token\"}", MediaType.APPLICATION_JSON));
    server
        .expect(requestTo(USER_INFO_URI))
        .andRespond(
            withSuccess(
                """
                {
                  "sub": "108123456789",
                  "email": "user@gmail.com",
                  "name": "홍길동",
                  "picture": "https://lh3.googleusercontent.com/p.jpg"
                }
                """,
                MediaType.APPLICATION_JSON));

    OAuthUserProfile profile = client.fetchProfile("auth-code");

    assertThat(profile.provider()).isEqualTo(OAuthProvider.GOOGLE);
    assertThat(profile.providerUserId()).isEqualTo("108123456789");
    assertThat(profile.email()).isEqualTo("user@gmail.com");
    assertThat(profile.nickname()).isEqualTo("홍길동");
    assertThat(profile.profileImageUrl()).isEqualTo("https://lh3.googleusercontent.com/p.jpg");
    server.verify();
  }

  @Test
  void 닉네임이_없으면_기본값을_쓴다() {
    server
        .expect(requestTo(TOKEN_URI))
        .andRespond(withSuccess("{\"access_token\":\"t\"}", MediaType.APPLICATION_JSON));
    server
        .expect(requestTo(USER_INFO_URI))
        .andRespond(
            withSuccess(
                "{\"sub\":\"222\",\"email\":\"nobody@gmail.com\"}", MediaType.APPLICATION_JSON));

    OAuthUserProfile profile = client.fetchProfile("auth-code");

    assertThat(profile.providerUserId()).isEqualTo("222");
    assertThat(profile.nickname()).isEqualTo("커피러버");
  }

  @Test
  void 토큰_교환에_실패하면_업무_예외를_던진다() {
    server.expect(requestTo(TOKEN_URI)).andRespond(withServerError());

    assertThatThrownBy(() -> client.fetchProfile("bad-code")).isInstanceOf(BusinessException.class);
  }
}

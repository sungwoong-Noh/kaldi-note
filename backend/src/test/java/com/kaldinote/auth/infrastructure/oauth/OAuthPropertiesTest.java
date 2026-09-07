package com.kaldinote.auth.infrastructure.oauth;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * OAuth 설정 기본값의 잠금.
 *
 * <p>{@code application-test.yml}은 client-id·client-secret만 덮고 redirect-uri는 덮지 않는다. 그래서 여기서 보이는 값은
 * {@code application.yml}의 기본값이다.
 *
 * <p><b>셸에 GOOGLE_REDIRECT_URI가 떠 있으면 이 테스트가 그 값을 본다.</b> 실패하면 먼저 {@code echo
 * $GOOGLE_REDIRECT_URI}를 확인한다.
 */
class OAuthPropertiesTest extends AbstractIntegrationTest {

  @Autowired private OAuthProperties properties;

  @Test
  @DisplayName("AC-GOOGLE-14 · 구글 리디렉션 URI 기본값은 구글 전용 콜백 경로다")
  void 구글_리디렉션_기본값은_구글_전용_경로다() {
    assertThat(properties.google().redirectUri())
        .isEqualTo("http://localhost:3000/auth/callback/google");
  }

  @Test
  @DisplayName("카카오 리디렉션 URI 기본값은 그대로다")
  void 카카오_리디렉션_기본값은_그대로다() {
    assertThat(properties.kakao().redirectUri()).isEqualTo("http://localhost:3000/auth/callback");
  }
}

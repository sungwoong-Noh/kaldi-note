package com.kaldinote.auth.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.domain.OAuthProvider;
import com.kaldinote.auth.infrastructure.RefreshTokenRepository;
import com.kaldinote.auth.infrastructure.oauth.OAuthClient;
import com.kaldinote.auth.infrastructure.oauth.OAuthClientRegistry;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.user.infrastructure.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class AuthServiceTest extends AbstractIntegrationTest {

  @Autowired private AuthService authService;
  @Autowired private UserRepository userRepository;
  @Autowired private RefreshTokenRepository refreshTokenRepository;

  @MockitoBean private OAuthClientRegistry registry;

  private OAuthClient kakaoClient;

  @BeforeEach
  void setUp() {
    kakaoClient = org.mockito.Mockito.mock(OAuthClient.class);
    given(registry.get(OAuthProvider.KAKAO)).willReturn(kakaoClient);
  }

  private void stubProfile(String providerUserId, String email, String nickname) {
    given(kakaoClient.fetchProfile(anyString()))
        .willReturn(
            new OAuthUserProfile(OAuthProvider.KAKAO, providerUserId, email, nickname, null));
  }

  @Test
  void 처음_로그인하면_사용자가_생성된다() {
    stubProfile("kakao-1", "a@kakao.com", "커피러버");

    LoginResult result = authService.login(OAuthProvider.KAKAO, "code");

    assertThat(result.newUser()).isTrue();
    assertThat(result.tokens().accessToken()).isNotBlank();
    assertThat(userRepository.count()).isEqualTo(1);
  }

  @Test
  void 같은_소셜_계정으로_다시_로그인하면_사용자가_늘지_않는다() {
    stubProfile("kakao-2", "b@kakao.com", "커피러버");
    authService.login(OAuthProvider.KAKAO, "code");

    LoginResult second = authService.login(OAuthProvider.KAKAO, "code");

    assertThat(second.newUser()).isFalse();
    assertThat(userRepository.count()).isEqualTo(1);
  }

  @Test
  void 이메일_없는_카카오_계정도_가입된다() {
    stubProfile("kakao-3", null, "익명");

    LoginResult result = authService.login(OAuthProvider.KAKAO, "code");

    assertThat(result.newUser()).isTrue();
  }

  @Test
  void 갱신하면_새_토큰_쌍이_발급되고_기존_토큰은_폐기된다() {
    stubProfile("kakao-4", "d@kakao.com", "커피러버");
    TokenPair first = authService.login(OAuthProvider.KAKAO, "code").tokens();

    TokenPair renewed = authService.refresh(first.refreshToken());

    assertThat(renewed.refreshToken()).isNotEqualTo(first.refreshToken());
    assertThatThrownBy(() -> authService.refresh(first.refreshToken()))
        .isInstanceOf(BusinessException.class);
  }

  @Test
  void 폐기된_토큰이_재사용되면_해당_사용자의_모든_토큰을_폐기한다() {
    stubProfile("kakao-5", "e@kakao.com", "커피러버");
    TokenPair first = authService.login(OAuthProvider.KAKAO, "code").tokens();
    TokenPair second = authService.refresh(first.refreshToken());

    // 탈취된 옛 토큰 재사용 시도
    assertThatThrownBy(() -> authService.refresh(first.refreshToken()))
        .isInstanceOf(BusinessException.class);

    // 정상 토큰까지 함께 무효화되어야 한다
    assertThatThrownBy(() -> authService.refresh(second.refreshToken()))
        .isInstanceOf(BusinessException.class);
  }

  @Test
  void 로그아웃하면_리프레시_토큰이_폐기된다() {
    stubProfile("kakao-6", "f@kakao.com", "커피러버");
    TokenPair tokens = authService.login(OAuthProvider.KAKAO, "code").tokens();

    authService.logout(tokens.refreshToken());

    assertThatThrownBy(() -> authService.refresh(tokens.refreshToken()))
        .isInstanceOf(BusinessException.class);
  }
}

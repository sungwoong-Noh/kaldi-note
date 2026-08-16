package com.kaldinote.auth.infrastructure.jwt;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.user.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

class JwtTokenProviderTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private JwtDecoder jwtDecoder;

  @Test
  void 액세스_토큰에_사용자_ID와_역할이_담긴다() {
    String token = tokenProvider.createAccessToken(42L, UserRole.ADMIN);

    Jwt decoded = jwtDecoder.decode(token);
    assertThat(decoded.getSubject()).isEqualTo("42");
    assertThat(decoded.getClaimAsString("role")).isEqualTo("ADMIN");
  }

  @Test
  void 일반_사용자_토큰의_역할은_USER다() {
    String token = tokenProvider.createAccessToken(1L, UserRole.USER);

    assertThat(jwtDecoder.decode(token).getClaimAsString("role")).isEqualTo("USER");
  }

  @Test
  void 토큰에서_사용자_ID를_읽을_수_있다() {
    String token = tokenProvider.createAccessToken(7L, UserRole.USER);

    assertThat(tokenProvider.parseUserId(token)).isEqualTo(7L);
  }

  @Test
  void 리프레시_토큰은_액세스_토큰보다_오래_유효하다() {
    String access = tokenProvider.createAccessToken(1L, UserRole.USER);
    String refresh = tokenProvider.createRefreshToken(1L);

    assertThat(jwtDecoder.decode(refresh).getExpiresAt())
        .isAfter(jwtDecoder.decode(access).getExpiresAt());
  }

  @Test
  void 리프레시_토큰에는_역할이_담기지_않는다() {
    // 역할은 갱신 시점의 DB 값을 다시 읽는다. 토큰에 박아두면 권한 변경이 반영되지 않는다.
    String refresh = tokenProvider.createRefreshToken(1L);

    assertThat(jwtDecoder.decode(refresh).getClaimAsString("role")).isNull();
  }
}

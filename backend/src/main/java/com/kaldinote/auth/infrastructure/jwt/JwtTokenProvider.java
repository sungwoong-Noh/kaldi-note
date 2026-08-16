package com.kaldinote.auth.infrastructure.jwt;

import com.kaldinote.user.domain.UserRole;
import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JwtTokenProvider {

  private final JwtEncoder encoder;
  private final JwtDecoder decoder;
  private final JwtProperties properties;

  /** 액세스 토큰. sub=userId, role=역할. */
  public String createAccessToken(Long userId, UserRole role) {
    return encode(userId, properties.accessTokenTtl(), role);
  }

  /** 리프레시 토큰. 역할을 담지 않는다 — 갱신 시점에 DB에서 다시 읽어야 권한 변경이 반영된다. */
  public String createRefreshToken(Long userId) {
    return encode(userId, properties.refreshTokenTtl(), null);
  }

  public Long parseUserId(String token) {
    return Long.valueOf(decoder.decode(token).getSubject());
  }

  public Duration getAccessTokenTtl() {
    return properties.accessTokenTtl();
  }

  public Duration getRefreshTokenTtl() {
    return properties.refreshTokenTtl();
  }

  private String encode(Long userId, Duration ttl, UserRole role) {
    Instant now = Instant.now();
    JwtClaimsSet.Builder claims =
        JwtClaimsSet.builder()
            .issuer(properties.issuer())
            .issuedAt(now)
            .expiresAt(now.plus(ttl))
            .subject(String.valueOf(userId));
    if (role != null) {
      claims.claim("role", role.name());
    }
    JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
    return encoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
  }
}

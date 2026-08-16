package com.kaldinote.auth.infrastructure.jwt;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "kaldi.jwt")
public record JwtProperties(
    String secret, Duration accessTokenTtl, Duration refreshTokenTtl, String issuer) {

  public JwtProperties {
    if (secret == null || secret.getBytes().length < 32) {
      throw new IllegalStateException("kaldi.jwt.secret은 최소 32바이트여야 합니다 (HS256 요구사항)");
    }
  }
}

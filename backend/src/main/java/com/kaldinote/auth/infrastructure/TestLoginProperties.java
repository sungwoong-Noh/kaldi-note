package com.kaldinote.auth.infrastructure;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 테스트 로그인의 잠금.
 *
 * <p><b>이 클래스가 인증 우회의 유일한 문지기다.</b> 스펙(docs/specs/2026-09-05-test-login.md)의 경고 상자를 먼저 읽는다 — 이 시크릿이
 * 새면 운영의 모든 계정으로 로그인할 수 있다.
 */
@ConfigurationProperties(prefix = "kaldi.test-login")
public record TestLoginProperties(String secret) {

  /** 짧은 시크릿은 없는 것보다 나쁘다 — 있다고 안심하게 만든다. */
  private static final int MIN_SECRET_LENGTH = 32;

  public boolean enabled() {
    return secret != null && secret.length() >= MIN_SECRET_LENGTH;
  }

  /**
   * 상수 시간 비교.
   *
   * <p>String.equals는 앞자리부터 갈리는 지점에 따라 걸리는 시간이 달라져, 한 글자씩 맞춰 가며 시크릿을 복원할 수 있다.
   */
  public boolean matches(String candidate) {
    if (!enabled() || candidate == null) {
      return false;
    }
    return MessageDigest.isEqual(
        secret.getBytes(StandardCharsets.UTF_8), candidate.getBytes(StandardCharsets.UTF_8));
  }
}

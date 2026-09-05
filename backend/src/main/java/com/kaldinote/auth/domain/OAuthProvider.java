package com.kaldinote.auth.domain;

public enum OAuthProvider {
  KAKAO,
  GOOGLE,
  /** 테스트 로그인 전용. OAuth 클라이언트가 없다 — user_oauth_accounts를 구분하기 위한 값이다. */
  TEST
}

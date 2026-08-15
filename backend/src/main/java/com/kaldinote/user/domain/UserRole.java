package com.kaldinote.user.domain;

/**
 * 사용자 역할. 관리자 API·화면은 후속 단계지만 이 컬럼과 JWT role claim은 MVP에 포함한다. 나중에 추가하면 발급된 토큰이 전부 무효화되고 전체 인가 정책을
 * 다시 훑어야 한다.
 */
public enum UserRole {
  USER,
  ADMIN
}

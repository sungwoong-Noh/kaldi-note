package com.kaldinote.auth.application;

import com.kaldinote.auth.domain.OAuthProvider;

/**
 * 소셜 프로바이더가 알려준 사용자 정보.
 *
 * @param email 카카오는 이메일 제공이 선택 동의라 null일 수 있다. 식별자로 쓰지 않는다.
 */
public record OAuthUserProfile(
    OAuthProvider provider,
    String providerUserId,
    String email,
    String nickname,
    String profileImageUrl) {}

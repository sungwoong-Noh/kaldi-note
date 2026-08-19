package com.kaldinote.user.presentation.dto;

import com.kaldinote.user.domain.User;
import java.time.Instant;

/**
 * 내 프로필.
 *
 * <p>email은 null일 수 있다 — 카카오는 이메일 제공 동의가 선택이며, 사용자 식별은 (provider, provider_user_id)가 맡는다. non_null
 * 직렬화라 null이면 키가 통째로 빠진다.
 *
 * <p>role은 JWT claim에도 있지만 여기서도 내려준다. 프론트가 토큰을 디코딩하지 않고도 관리자 메뉴를 분기할 수 있게 하기 위해서다.
 */
public record MeResponse(
    Long id,
    String email,
    String nickname,
    String profileImageUrl,
    String role,
    Instant createdAt) {

  public static MeResponse from(User user) {
    return new MeResponse(
        user.getId(),
        user.getEmail(),
        user.getNickname(),
        user.getProfileImageUrl(),
        user.getRole().name(),
        user.getCreatedAt());
  }
}

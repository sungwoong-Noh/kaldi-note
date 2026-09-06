package com.kaldinote.user.presentation.dto;

import com.kaldinote.user.domain.User;

/**
 * 남에게 보여줄 프로필.
 *
 * <p><b>{@link MeResponse}를 재사용하지 않는 이유:</b> 그쪽은 email과 role을 갖고 있다. 초대 링크는 상대에게 보내는 것이라 같은 DTO를 쓰면
 * 이메일이 그대로 새어 나간다.
 *
 * <p>profileImageUrl은 null일 수 있다 — 카카오 프로필 사진은 선택이다. non_null 직렬화라 null이면 키가 통째로 빠진다.
 */
public record PublicProfileResponse(Long id, String nickname, String profileImageUrl) {

  public static PublicProfileResponse from(User user) {
    return new PublicProfileResponse(user.getId(), user.getNickname(), user.getProfileImageUrl());
  }
}

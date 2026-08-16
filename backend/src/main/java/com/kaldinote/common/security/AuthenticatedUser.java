package com.kaldinote.common.security;

import com.kaldinote.user.domain.UserRole;

/**
 * 컨트롤러 파라미터로 {@code AuthenticatedUser user}를 받으면 된다. {@code AuthenticatedUserArgumentResolver}가
 * JWT의 sub·role 클레임에서 채워준다. {@code JwtAuthenticationToken}의 principal은 원본 {@code Jwt}라
 * {@code @AuthenticationPrincipal}로는 바로 못 받는다.
 */
public record AuthenticatedUser(Long id, UserRole role) {}

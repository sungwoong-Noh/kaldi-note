package com.kaldinote.common.security;

import com.kaldinote.user.domain.UserRole;

/** 컨트롤러에서 {@code @AuthenticationPrincipal AuthenticatedUser user}로 받는다. */
public record AuthenticatedUser(Long id, UserRole role) {}

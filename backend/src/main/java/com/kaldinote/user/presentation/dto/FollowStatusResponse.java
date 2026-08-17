package com.kaldinote.user.presentation.dto;

/**
 * @param following 내가 상대를 팔로우하고 있다
 * @param followedBy 상대가 나를 팔로우하고 있다
 * @param mutual 둘 다 참. FRIENDS 공개범위 판정과 같은 값이다
 */
public record FollowStatusResponse(boolean following, boolean followedBy, boolean mutual) {}

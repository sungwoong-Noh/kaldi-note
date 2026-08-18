package com.kaldinote.user.application;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.user.domain.Follow;
import com.kaldinote.user.infrastructure.FollowRepository;
import com.kaldinote.user.infrastructure.UserRepository;
import com.kaldinote.user.presentation.dto.FollowStatusResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FollowService {

  private final FollowRepository followRepository;
  private final UserRepository userRepository;

  /** 인가 판정이 쓰는 유일한 공개 지점. RecipeService·BrewLogService가 주입해 호출한다. */
  public boolean isMutual(Long viewerId, Long ownerId) {
    if (viewerId == null || ownerId == null || viewerId.equals(ownerId)) {
      return false;
    }
    return followRepository.existsMutualFollow(viewerId, ownerId);
  }

  @Transactional
  public void follow(Long followerId, Long followeeId) {
    validateTarget(followerId, followeeId);
    if (followRepository.existsByFollowerUserIdAndFolloweeUserId(followerId, followeeId)) {
      return; // 멱등 — 이미 있으면 아무것도 하지 않는다
    }
    followRepository.save(Follow.of(followerId, followeeId));
  }

  @Transactional
  public void unfollow(Long followerId, Long followeeId) {
    validateTarget(followerId, followeeId);
    followRepository.deleteByFollowerUserIdAndFolloweeUserId(followerId, followeeId);
  }

  public FollowStatusResponse status(Long viewerId, Long targetId) {
    validateTarget(viewerId, targetId);
    boolean following =
        followRepository.existsByFollowerUserIdAndFolloweeUserId(viewerId, targetId);
    boolean followedBy =
        followRepository.existsByFollowerUserIdAndFolloweeUserId(targetId, viewerId);
    return new FollowStatusResponse(following, followedBy, following && followedBy);
  }

  /** 검증 순서: 404(대상 없음) → 400(자기 자신). 스펙의 401 → 404 → 403 → 400을 따른다. */
  private void validateTarget(Long viewerId, Long targetId) {
    if (!userRepository.existsById(targetId)) {
      throw new BusinessException(ErrorCode.NOT_FOUND, "사용자를 찾을 수 없습니다: " + targetId);
    }
    if (viewerId.equals(targetId)) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "자기 자신을 대상으로 할 수 없습니다.");
    }
  }
}

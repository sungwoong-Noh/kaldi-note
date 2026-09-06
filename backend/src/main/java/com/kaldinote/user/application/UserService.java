package com.kaldinote.user.application;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.user.infrastructure.UserRepository;
import com.kaldinote.user.presentation.dto.MeResponse;
import com.kaldinote.user.presentation.dto.PublicProfileResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

  private final UserRepository userRepository;

  public MeResponse me(Long userId) {
    return userRepository
        .findById(userId)
        .map(MeResponse::from)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "사용자를 찾을 수 없습니다: " + userId));
  }

  /** 남의 프로필. 자기 자신을 조회해도 막지 않는다 — 내 초대 링크를 눌러 확인하는 흔한 경로다. */
  public PublicProfileResponse profile(Long userId) {
    return userRepository
        .findById(userId)
        .map(PublicProfileResponse::from)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "사용자를 찾을 수 없습니다: " + userId));
  }
}

package com.kaldinote.user.presentation;

import com.kaldinote.common.security.AuthenticatedUser;
import com.kaldinote.user.application.UserService;
import com.kaldinote.user.presentation.dto.MeResponse;
import com.kaldinote.user.presentation.dto.PublicProfileResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "사용자", description = "내 프로필")
public class UserController {

  private final UserService userService;

  @GetMapping("/me")
  public MeResponse me(AuthenticatedUser user) {
    return userService.me(user.id());
  }

  /** 홈 달력 레일에 세울 맞팔로우 목록. 리터럴 /me/mutual-follows가 세그먼트 둘이라 /{id}(하나)와 매칭되지 않는다. */
  @GetMapping("/me/mutual-follows")
  @Operation(summary = "맞팔로우 목록", description = "마지막 기록이 최근인 순. 무기록자는 맨 뒤에 닉네임 오름차순.")
  public List<PublicProfileResponse> mutualFollows(AuthenticatedUser user) {
    return userService.mutualFollows(user.id());
  }

  /** 남의 공개 프로필. 리터럴 /me가 이 템플릿보다 먼저 매칭된다 — AC-ME-01이 그 회귀를 잡는다. */
  @GetMapping("/{id}")
  public PublicProfileResponse profile(@PathVariable Long id) {
    return userService.profile(id);
  }
}

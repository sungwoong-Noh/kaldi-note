package com.kaldinote.user.presentation;

import com.kaldinote.common.security.AuthenticatedUser;
import com.kaldinote.user.application.FollowService;
import com.kaldinote.user.presentation.dto.FollowStatusResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users/{userId}/follow")
@RequiredArgsConstructor
@Tag(name = "팔로우", description = "팔로우 등록·해제·상태 조회. FRIENDS 공개범위의 근거가 된다")
public class FollowController {

  private final FollowService followService;

  @PostMapping
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void follow(@PathVariable Long userId, AuthenticatedUser user) {
    followService.follow(user.id(), userId);
  }

  @DeleteMapping
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void unfollow(@PathVariable Long userId, AuthenticatedUser user) {
    followService.unfollow(user.id(), userId);
  }

  @GetMapping
  public FollowStatusResponse status(@PathVariable Long userId, AuthenticatedUser user) {
    return followService.status(user.id(), userId);
  }
}

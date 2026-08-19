package com.kaldinote.user.presentation;

import com.kaldinote.common.security.AuthenticatedUser;
import com.kaldinote.user.application.UserService;
import com.kaldinote.user.presentation.dto.MeResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
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
}

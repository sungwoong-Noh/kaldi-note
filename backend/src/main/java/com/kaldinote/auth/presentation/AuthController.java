package com.kaldinote.auth.presentation;

import com.kaldinote.auth.application.AuthService;
import com.kaldinote.auth.application.TokenPair;
import com.kaldinote.auth.domain.OAuthProvider;
import com.kaldinote.auth.infrastructure.TestLoginProperties;
import com.kaldinote.auth.presentation.dto.LoginRequest;
import com.kaldinote.auth.presentation.dto.LoginResponse;
import com.kaldinote.auth.presentation.dto.RefreshRequest;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import jakarta.validation.Valid;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

  private final AuthService authService;
  private final TestLoginProperties testLoginProperties;

  @PostMapping("/login/{provider}")
  public LoginResponse login(
      @PathVariable String provider, @Valid @RequestBody LoginRequest request) {
    return LoginResponse.from(authService.login(toProvider(provider), request.code()));
  }

  /**
   * 테스트 로그인. <b>잠금은 여기 한 곳에만 있다.</b>
   *
   * <p>@Valid를 쓰지 않고 본문을 String으로 받는 이유: 검증이나 JSON 파싱이 시크릿 검사보다 먼저 돌면, 400이 나오는 것만으로 이 경로가 존재한다는
   * 사실이 새어 나간다.
   */
  @PostMapping("/login/test")
  public LoginResponse testLogin(
      @RequestHeader(value = "X-Test-Login-Secret", required = false) String secret,
      @RequestBody(required = false) String rawBody) {
    if (!testLoginProperties.matches(secret)) {
      throw new BusinessException(ErrorCode.ENDPOINT_NOT_FOUND);
    }
    throw new BusinessException(ErrorCode.ENDPOINT_NOT_FOUND); // Task 2에서 채운다
  }

  @PostMapping("/refresh")
  public TokenPair refresh(@Valid @RequestBody RefreshRequest request) {
    return authService.refresh(request.refreshToken());
  }

  @PostMapping("/logout")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void logout(@Valid @RequestBody RefreshRequest request) {
    authService.logout(request.refreshToken());
  }

  private OAuthProvider toProvider(String provider) {
    return OAuthProvider.valueOf(provider.toUpperCase(Locale.ROOT));
  }
}

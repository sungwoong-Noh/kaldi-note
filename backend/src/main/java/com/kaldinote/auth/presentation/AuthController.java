package com.kaldinote.auth.presentation;

import com.kaldinote.auth.application.AuthService;
import com.kaldinote.auth.application.TokenPair;
import com.kaldinote.auth.domain.OAuthProvider;
import com.kaldinote.auth.presentation.dto.LoginRequest;
import com.kaldinote.auth.presentation.dto.LoginResponse;
import com.kaldinote.auth.presentation.dto.RefreshRequest;
import jakarta.validation.Valid;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

  private final AuthService authService;

  @PostMapping("/login/{provider}")
  public LoginResponse login(
      @PathVariable String provider, @Valid @RequestBody LoginRequest request) {
    return LoginResponse.from(authService.login(toProvider(provider), request.code()));
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

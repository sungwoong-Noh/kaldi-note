package com.kaldinote.auth.presentation.dto;

import com.kaldinote.auth.application.LoginResult;
import com.kaldinote.auth.application.TokenPair;

public record LoginResponse(TokenPair tokens, Long userId, String nickname, boolean newUser) {

  public static LoginResponse from(LoginResult result) {
    return new LoginResponse(result.tokens(), result.userId(), result.nickname(), result.newUser());
  }
}

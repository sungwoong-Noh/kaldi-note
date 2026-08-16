package com.kaldinote.auth.application;

public record LoginResult(TokenPair tokens, Long userId, String nickname, boolean newUser) {}

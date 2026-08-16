package com.kaldinote.auth.application;

public record TokenPair(String accessToken, String refreshToken, long expiresInSeconds) {}

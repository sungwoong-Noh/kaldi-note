package com.kaldinote.auth.presentation.dto;

/**
 * 테스트 로그인 요청.
 *
 * <p><b>Bean Validation 애노테이션을 붙이지 않는다</b> — 검증이 시크릿 검사보다 먼저 돌면 400이 나오는 것만으로 경로의 존재가 새어 나간다. 검사는
 * AuthService가 한다.
 */
public record TestLoginRequest(Long userId, String handle, String nickname) {}

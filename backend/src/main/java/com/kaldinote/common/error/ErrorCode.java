package com.kaldinote.common.error;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/** 프론트가 분기하는 기준. 문구가 아니라 code로 판단하게 한다. */
@Getter
@RequiredArgsConstructor
public enum ErrorCode {
  INVALID_REQUEST(HttpStatus.BAD_REQUEST, "요청 값이 올바르지 않습니다."),
  UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
  FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다."),
  NOT_FOUND(HttpStatus.NOT_FOUND, "대상을 찾을 수 없습니다."),
  INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다."),

  DUPLICATE_NAME(HttpStatus.CONFLICT, "이미 등록된 이름입니다."),

  // 분쇄도 환산 — docs/specs/2026-08-14-grind-conversion.md
  GRIND_NOT_CONVERTIBLE(HttpStatus.UNPROCESSABLE_CONTENT, "클릭당 마이크론 정보가 없어 분쇄도를 환산할 수 없습니다."),
  GRIND_SETTING_OUT_OF_RANGE(HttpStatus.BAD_REQUEST, "이 그라인더에서 쓸 수 없는 설정값입니다."),

  // 추출 분석 — docs/specs/2026-08-14-extraction-analysis.md
  INVALID_BREW_MEASUREMENT(HttpStatus.BAD_REQUEST, "추출 측정값이 올바르지 않습니다."),

  OAUTH_TOKEN_EXCHANGE_FAILED(HttpStatus.UNAUTHORIZED, "소셜 로그인에 실패했습니다."),
  REFRESH_TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "다시 로그인해 주세요.");

  private final HttpStatus status;
  private final String defaultMessage;
}

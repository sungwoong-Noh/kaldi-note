package com.kaldinote.common.error;

import java.util.List;

/** 전 API 공통 에러 형식. message는 사용자에게 그대로 보여줄 수 있는 한국어다. */
public record ErrorResponse(String code, String message, List<FieldError> fieldErrors) {

  public record FieldError(String field, String message) {}

  public static ErrorResponse of(ErrorCode code, String message) {
    return new ErrorResponse(code.name(), message, List.of());
  }

  public static ErrorResponse of(ErrorCode code, String message, List<FieldError> fieldErrors) {
    return new ErrorResponse(code.name(), message, fieldErrors);
  }
}

package com.kaldinote.common.error;

import com.kaldinote.extraction.domain.InvalidBrewMeasurementException;
import com.kaldinote.grind.domain.GrindNotConvertibleException;
import com.kaldinote.grind.domain.GrindSettingOutOfRangeException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(BusinessException.class)
  public ResponseEntity<ErrorResponse> handleBusiness(BusinessException e) {
    ErrorCode code = e.getErrorCode();
    log.warn("업무 예외 code={} message={}", code.name(), e.getMessage());
    return ResponseEntity.status(code.getStatus()).body(ErrorResponse.of(code, e.getMessage()));
  }

  @ExceptionHandler(GrindNotConvertibleException.class)
  public ResponseEntity<ErrorResponse> handleGrindNotConvertible(GrindNotConvertibleException e) {
    return toResponse(ErrorCode.GRIND_NOT_CONVERTIBLE, e.getMessage());
  }

  @ExceptionHandler(GrindSettingOutOfRangeException.class)
  public ResponseEntity<ErrorResponse> handleGrindOutOfRange(GrindSettingOutOfRangeException e) {
    return toResponse(ErrorCode.GRIND_SETTING_OUT_OF_RANGE, e.getMessage());
  }

  @ExceptionHandler(InvalidBrewMeasurementException.class)
  public ResponseEntity<ErrorResponse> handleBrewMeasurement(InvalidBrewMeasurementException e) {
    return toResponse(ErrorCode.INVALID_BREW_MEASUREMENT, e.getMessage());
  }

  private ResponseEntity<ErrorResponse> toResponse(ErrorCode code, String message) {
    return ResponseEntity.status(code.getStatus()).body(ErrorResponse.of(code, message));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
    List<ErrorResponse.FieldError> fieldErrors =
        e.getBindingResult().getFieldErrors().stream()
            .map(f -> new ErrorResponse.FieldError(f.getField(), f.getDefaultMessage()))
            .toList();
    ErrorCode code = ErrorCode.INVALID_REQUEST;
    return ResponseEntity.status(code.getStatus())
        .body(ErrorResponse.of(code, code.getDefaultMessage(), fieldErrors));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
    log.error("처리되지 않은 예외", e);
    ErrorCode code = ErrorCode.INTERNAL_ERROR;
    return ResponseEntity.status(code.getStatus())
        .body(ErrorResponse.of(code, code.getDefaultMessage()));
  }
}

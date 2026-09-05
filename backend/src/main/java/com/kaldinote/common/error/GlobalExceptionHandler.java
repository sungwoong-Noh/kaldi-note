package com.kaldinote.common.error;

import com.kaldinote.extraction.domain.InvalidBrewMeasurementException;
import com.kaldinote.grind.domain.GrindNotConvertibleException;
import com.kaldinote.grind.domain.GrindSettingOutOfRangeException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

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

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException e) {
    return toResponse(ErrorCode.INVALID_REQUEST, e.getMessage());
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

  /** 잘못된 enum 값·깨진 JSON 등 역직렬화 실패. 핸들러가 없으면 handleUnexpected로 떨어져 클라이언트 입력 오류가 500이 된다. */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ErrorResponse> handleUnreadable(HttpMessageNotReadableException e) {
    log.warn("요청 본문을 읽을 수 없음: {}", e.getMessage());
    return toResponse(ErrorCode.INVALID_REQUEST, "요청 본문을 읽을 수 없습니다.");
  }

  /**
   * 매핑되지 않은 경로. 스프링은 이 요청을 정적 리소스 핸들러로 보내고 거기서 이 예외가 난다. 잡지 않으면 handleUnexpected로 떨어져 오타 URL 하나가
   * 500 + 스택트레이스가 된다.
   */
  @ExceptionHandler(NoResourceFoundException.class)
  public ResponseEntity<ErrorResponse> handleNoResource(NoResourceFoundException e) {
    log.warn("매핑되지 않은 경로: {} {}", e.getHttpMethod(), e.getResourcePath());
    ErrorCode code = ErrorCode.ENDPOINT_NOT_FOUND;
    return toResponse(code, code.getDefaultMessage());
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
    log.error("처리되지 않은 예외", e);
    ErrorCode code = ErrorCode.INTERNAL_ERROR;
    return ResponseEntity.status(code.getStatus())
        .body(ErrorResponse.of(code, code.getDefaultMessage()));
  }
}

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

  // 라우팅 오류 — docs/specs/2026-09-05-http-error-contract.md
  // 없는 '경로'다. 없는 '리소스'(NOT_FOUND)와 구분하지 않으면 프론트가
  // 오타 난 URL을 「삭제된 레시피」로 표시한다 (entityLabel.ts).
  ENDPOINT_NOT_FOUND(HttpStatus.NOT_FOUND, "요청하신 주소를 찾을 수 없습니다."),
  METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "이 주소에서 지원하지 않는 방식입니다."),

  DUPLICATE_NAME(HttpStatus.CONFLICT, "이미 등록된 이름입니다."),

  // 분쇄도 환산 — docs/specs/2026-08-14-grind-conversion.md
  GRIND_NOT_CONVERTIBLE(HttpStatus.UNPROCESSABLE_CONTENT, "클릭당 마이크론 정보가 없어 분쇄도를 환산할 수 없습니다."),
  GRIND_SETTING_OUT_OF_RANGE(HttpStatus.BAD_REQUEST, "이 그라인더에서 쓸 수 없는 설정값입니다."),

  // 추출 분석 — docs/specs/2026-08-14-extraction-analysis.md
  INVALID_BREW_MEASUREMENT(HttpStatus.BAD_REQUEST, "추출 측정값이 올바르지 않습니다."),

  OAUTH_TOKEN_EXCHANGE_FAILED(HttpStatus.UNAUTHORIZED, "소셜 로그인에 실패했습니다."),
  REFRESH_TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "다시 로그인해 주세요."),

  // 레시피 — docs/specs/2026-08-16-recipe-crud.md
  RECIPE_STEP_WATER_MISMATCH(HttpStatus.BAD_REQUEST, "스텝 물량 합계가 레시피 총 물량과 다릅니다."),
  RECIPE_STEP_OVERLAP(HttpStatus.BAD_REQUEST, "앞 스텝과 시간이 겹칩니다."),
  RECIPE_STEP_WATER_INVALID(HttpStatus.BAD_REQUEST, "스텝 타입과 물량이 맞지 않습니다."),

  // 원두 카탈로그 — docs/specs/2026-08-16-bean-inventory.md
  BEAN_MIX_ORIGIN_MISMATCH(HttpStatus.BAD_REQUEST, "beanMix와 origins 개수가 맞지 않습니다."),
  BEAN_ORIGIN_RATIO_MISMATCH(HttpStatus.BAD_REQUEST, "블렌드 산지의 ratioPercent 합계가 100이 아닙니다."),
  BEAN_BATCH_REMAINING_INVALID(HttpStatus.BAD_REQUEST, "remainingG가 0 미만이거나 weightG를 초과합니다.");

  private final HttpStatus status;
  private final String defaultMessage;
}

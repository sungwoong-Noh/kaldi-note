package com.kaldinote.common.response;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * 목록 조회의 page/size를 검증해 담는다. page는 0-based다.
 *
 * <p>검증을 Bean Validation 애노테이션으로 하지 않는 이유: 컨트롤러 파라미터에 걸면 ConstraintViolationException이 나는데
 * GlobalExceptionHandler에 그 핸들러가 없어 500이 된다. 여기서 BusinessException을 던져 기존 400 경로를 그대로 탄다.
 */
public record PageParams(int page, int size) {

  private static final int DEFAULT_SIZE = 20;
  private static final int MIN_SIZE = 1;
  private static final int MAX_SIZE = 100;

  public static PageParams of(Integer page, Integer size) {
    int resolvedPage = page == null ? 0 : page;
    int resolvedSize = size == null ? DEFAULT_SIZE : size;

    if (resolvedPage < 0) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "page는 0 이상이어야 합니다: " + resolvedPage);
    }
    if (resolvedSize < MIN_SIZE || resolvedSize > MAX_SIZE) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST,
          "size는 %d 이상 %d 이하여야 합니다: %d".formatted(MIN_SIZE, MAX_SIZE, resolvedSize));
    }
    return new PageParams(resolvedPage, resolvedSize);
  }

  public Pageable toPageable(Sort sort) {
    return PageRequest.of(page, size, sort);
  }
}

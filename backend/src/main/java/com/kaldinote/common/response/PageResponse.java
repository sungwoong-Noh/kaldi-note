package com.kaldinote.common.response;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/**
 * 목록 응답 봉투.
 *
 * <p>Spring Data의 Page를 그대로 직렬화하면 pageable·sort·empty 같은 내부 필드가 노출되고 Spring 버전에 따라 형태가 바뀐다. 여기서 여섯
 * 키로 고정한다.
 */
public record PageResponse<T>(
    List<T> content, int page, int size, long totalElements, int totalPages, boolean hasNext) {

  public static <E, T> PageResponse<T> from(Page<E> page, Function<E, T> mapper) {
    return new PageResponse<>(
        page.getContent().stream().map(mapper).toList(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages(),
        page.hasNext());
  }
}

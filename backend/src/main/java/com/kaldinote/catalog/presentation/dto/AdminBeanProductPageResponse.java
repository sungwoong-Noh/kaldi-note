package com.kaldinote.catalog.presentation.dto;

import java.util.List;

/** 백엔드 `PageResponse` 여섯 키 + 필터 pill 개수. */
public record AdminBeanProductPageResponse(
    List<AdminBeanProductRowResponse> content,
    int page,
    int size,
    long totalElements,
    int totalPages,
    boolean hasNext,
    Counts counts) {

  public record Counts(
      long all, long needsReview, long verified, long hidden, long missing, MissingBy missingBy) {}

  public record MissingBy(long roastLevel, long origin, long variety, long process) {}
}

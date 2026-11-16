package com.kaldinote.catalog.presentation.dto;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.time.Instant;
import java.util.List;

/** 관리자 원두 상세 = 목록 행 + 편집 패널이 쓰는 필드. */
public record AdminBeanProductDetailResponse(
    @JsonUnwrapped AdminBeanProductRowResponse row,
    boolean decaf,
    String productUrl,
    String description,
    List<BeanOriginResponse> origins,
    Instant createdAt,
    long sameNameCount) {}

package com.kaldinote.catalog.presentation.dto;

import com.kaldinote.catalog.domain.BeanMix;
import com.kaldinote.catalog.domain.RoastLevel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 관리자 원두 수정 — 전체 교체. 제약은 생성 DTO와 같고 {@code roastLevel}만 null을 허용한다(모르는 배전도). 블렌드 산지 0행 · 비율 전부
 * null도 받는다(docs/specs/2026-11-15-admin-beans.md 「수정」).
 */
public record AdminBeanProductUpdateRequest(
    @NotNull Long roasterId,
    @NotBlank @Size(max = 100) String name,
    @NotNull BeanMix beanMix,
    RoastLevel roastLevel,
    Short roastLevelAgtron,
    @Size(max = 100) String roastLevelCustom,
    boolean decaf,
    @Size(max = 500) String productUrl,
    @Size(max = 2000) String description,
    @Valid List<OriginRequest> origins,
    boolean verified,
    boolean hidden) {

  public AdminBeanProductUpdateRequest {
    if (origins == null) {
      origins = List.of();
    }
  }
}

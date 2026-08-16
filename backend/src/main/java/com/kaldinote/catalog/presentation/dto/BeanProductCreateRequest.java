package com.kaldinote.catalog.presentation.dto;

import com.kaldinote.catalog.domain.BeanMix;
import com.kaldinote.catalog.domain.RoastLevel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BeanProductCreateRequest(
    @NotNull Long roasterId,
    @NotBlank @Size(max = 100) String name,
    @NotNull BeanMix beanMix,
    @NotNull RoastLevel roastLevel,
    Short roastLevelAgtron,
    @Size(max = 100) String roastLevelCustom,
    Boolean decaf,
    @Size(max = 500) String productUrl,
    @Size(max = 2000) String description,
    @Valid List<OriginRequest> origins) {

  public BeanProductCreateRequest {
    if (origins == null) {
      origins = List.of();
    }
  }
}

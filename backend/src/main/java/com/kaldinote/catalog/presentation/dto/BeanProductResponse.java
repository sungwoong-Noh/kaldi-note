package com.kaldinote.catalog.presentation.dto;

import com.kaldinote.catalog.domain.BeanProduct;
import java.time.Instant;
import java.util.List;

public record BeanProductResponse(
    Long id,
    Long roasterId,
    String name,
    String beanMix,
    String roastLevel,
    Short roastLevelAgtron,
    String roastLevelCustom,
    boolean decaf,
    String productUrl,
    String description,
    boolean verified,
    List<BeanOriginResponse> origins,
    Instant createdAt) {

  public static BeanProductResponse from(BeanProduct p) {
    return new BeanProductResponse(
        p.getId(),
        p.getRoasterId(),
        p.getName(),
        p.getBeanMix().name(),
        p.getRoastLevel().name(),
        p.getRoastLevelAgtron(),
        p.getRoastLevelCustom(),
        p.isDecaf(),
        p.getProductUrl(),
        p.getDescription(),
        p.isVerified(),
        BeanOriginResponse.listFrom(p.getOrigins()),
        p.getCreatedAt());
  }
}

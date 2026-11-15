package com.kaldinote.catalog.presentation.dto;

import com.kaldinote.catalog.domain.BeanProduct;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public record BeanProductResponse(
    Long id,
    Long roasterId,
    String roasterName,
    String name,
    String beanMix,
    String roastLevel,
    Short roastLevelAgtron,
    String roastLevelCustom,
    boolean decaf,
    String productUrl,
    String description,
    boolean verified,
    boolean hidden,
    List<BeanOriginResponse> origins,
    Instant createdAt) {

  public static BeanProductResponse from(
      BeanProduct p,
      String roasterName,
      Map<Long, String> varietyNames,
      Map<Long, String> processNames) {
    return new BeanProductResponse(
        p.getId(),
        p.getRoasterId(),
        roasterName,
        p.getName(),
        p.getBeanMix().name(),
        p.getRoastLevel() == null ? null : p.getRoastLevel().name(),
        p.getRoastLevelAgtron(),
        p.getRoastLevelCustom(),
        p.isDecaf(),
        p.getProductUrl(),
        p.getDescription(),
        p.isVerified(),
        p.isHidden(),
        BeanOriginResponse.listFrom(p.getOrigins(), varietyNames, processNames),
        p.getCreatedAt());
  }
}

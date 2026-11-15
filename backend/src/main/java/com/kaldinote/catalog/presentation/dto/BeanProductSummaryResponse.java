package com.kaldinote.catalog.presentation.dto;

import com.kaldinote.catalog.domain.BeanOrigin;
import com.kaldinote.catalog.domain.BeanProduct;
import java.util.List;

/** 원두 검색 결과 행. {@code countries}는 산지 순서대로, 같은 값은 한 번만. */
public record BeanProductSummaryResponse(
    Long id,
    String name,
    Long roasterId,
    String roasterName,
    String beanMix,
    String roastLevel,
    Short roastLevelAgtron,
    String roastLevelCustom,
    boolean decaf,
    List<String> countries) {

  public static BeanProductSummaryResponse from(BeanProduct p, String roasterName) {
    return new BeanProductSummaryResponse(
        p.getId(),
        p.getName(),
        p.getRoasterId(),
        roasterName,
        p.getBeanMix().name(),
        p.getRoastLevel() == null ? null : p.getRoastLevel().name(),
        p.getRoastLevelAgtron(),
        p.getRoastLevelCustom(),
        p.isDecaf(),
        p.getOrigins().stream().map(BeanOrigin::getCountry).distinct().toList());
  }
}

package com.kaldinote.catalog.presentation.dto;

import com.kaldinote.catalog.domain.BeanOrigin;
import java.math.BigDecimal;
import java.util.List;

public record BeanOriginResponse(
    Long id,
    String country,
    String region,
    String farm,
    Short altitudeMinM,
    Short altitudeMaxM,
    Long varietyId,
    Long processId,
    BigDecimal ratioPercent) {

  public static List<BeanOriginResponse> listFrom(List<BeanOrigin> origins) {
    return origins.stream()
        .map(
            o ->
                new BeanOriginResponse(
                    o.getId(),
                    o.getCountry(),
                    o.getRegion(),
                    o.getFarm(),
                    o.getAltitudeMinM(),
                    o.getAltitudeMaxM(),
                    o.getVarietyId(),
                    o.getProcessId(),
                    o.getRatioPercent()))
        .toList();
  }
}

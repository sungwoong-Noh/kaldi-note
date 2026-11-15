package com.kaldinote.catalog.presentation.dto;

import com.kaldinote.catalog.domain.BeanOrigin;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record BeanOriginResponse(
    Long id,
    String country,
    String region,
    String farm,
    Short altitudeMinM,
    Short altitudeMaxM,
    Long varietyId,
    Long processId,
    BigDecimal ratioPercent,
    String varietyName,
    String processName) {

  /** 이름 맵은 id → 표시 이름({@code name_ko ?? name}). 품종·가공이 없으면 이름도 null. */
  public static List<BeanOriginResponse> listFrom(
      List<BeanOrigin> origins, Map<Long, String> varietyNames, Map<Long, String> processNames) {
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
                    o.getRatioPercent(),
                    varietyNames.get(o.getVarietyId()),
                    processNames.get(o.getProcessId())))
        .toList();
  }
}

package com.kaldinote.gear.presentation.dto;

import com.kaldinote.gear.domain.UserGrinder;
import java.math.BigDecimal;

public record UserGrinderResponse(
    Long id,
    Long grinderModelId,
    String nickname,
    BigDecimal calibrationOffsetClicks,
    boolean isDefault) {

  public static UserGrinderResponse from(UserGrinder g) {
    return new UserGrinderResponse(
        g.getId(),
        g.getGrinderModelId(),
        g.getNickname(),
        g.getCalibrationOffsetClicks(),
        g.isDefault());
  }
}

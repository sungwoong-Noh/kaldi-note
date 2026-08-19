package com.kaldinote.gear.presentation.dto;

import com.kaldinote.gear.domain.GrinderModel;
import com.kaldinote.gear.domain.UserGrinder;
import java.math.BigDecimal;

/**
 * 내 그라인더. 모델 정보를 함께 펼쳐 담는다.
 *
 * <p>id만 내려주면 화면이 모델명을 보여주려고 /gear/grinders를 따로 불러 클라이언트에서 조인해야 한다. 사람당 몇 개뿐이라 펼쳐 담는 비용이 작다.
 *
 * <p>micronsPerClick은 환산 불가 그라인더(클릭당 마이크론 정보가 없는 모델)에서 null이다.
 */
public record UserGrinderResponse(
    Long id,
    Long grinderModelId,
    String brand,
    String grinderModelName,
    BigDecimal micronsPerClick,
    String nickname,
    BigDecimal calibrationOffsetClicks,
    boolean isDefault) {

  public static UserGrinderResponse of(UserGrinder g, GrinderModel model) {
    return new UserGrinderResponse(
        g.getId(),
        g.getGrinderModelId(),
        model == null ? null : model.getBrand(),
        model == null ? null : model.getName(),
        model == null ? null : model.getMicronsPerClick(),
        g.getNickname(),
        g.getCalibrationOffsetClicks(),
        g.isDefault());
  }
}

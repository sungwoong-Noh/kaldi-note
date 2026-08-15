package com.kaldinote.grind.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 그라인더 설정값 ↔ 마이크론 환산.
 *
 * <p>micron = (setting - zeroPointOffsetClicks) × micronsPerClick
 *
 * <p>converted = micron / target.micronsPerClick + target.zeroPointOffsetClicks
 *
 * <p>버 형상과 입도 분포가 그라인더마다 달라 정확한 등가 변환은 물리적으로 불가능하다. 결과는 언제나 추정치이며 시작점으로만 사용해야 한다.
 */
public class GrindConverter {

  public static final String ESTIMATE_WARNING = "버 형상과 입도 분포가 달라 정확한 등가 변환은 불가능합니다. 시작점으로만 사용하세요.";

  private static final int MICRON_SCALE = 0;
  private static final int SETTING_SCALE = 1;

  /** 나눗셈 중간 정밀도. 최종 반올림 전 오차를 흡수한다. */
  private static final int DIVISION_SCALE = 6;

  public BigDecimal toMicron(GrindSpec spec, BigDecimal setting) {
    requireConvertible(spec, "원본");
    requireInRange(spec, setting);

    return setting
        .subtract(spec.zeroPointOffsetClicks())
        .multiply(spec.micronsPerClick())
        .setScale(MICRON_SCALE, RoundingMode.HALF_UP);
  }

  public GrindConversion convert(GrindSpec source, BigDecimal sourceSetting, GrindSpec target) {
    requireConvertible(target, "대상");

    BigDecimal micron = toMicron(source, sourceSetting);
    BigDecimal targetSetting =
        micron
            .divide(target.micronsPerClick(), DIVISION_SCALE, RoundingMode.HALF_UP)
            .add(target.zeroPointOffsetClicks())
            .setScale(SETTING_SCALE, RoundingMode.HALF_UP);

    return new GrindConversion(
        sourceSetting,
        micron,
        targetSetting,
        outOfRange(target, targetSetting),
        true,
        ESTIMATE_WARNING);
  }

  private void requireConvertible(GrindSpec spec, String label) {
    if (!spec.convertible()) {
      throw new GrindNotConvertibleException(
          "%s 그라인더의 클릭당 마이크론 정보가 없어 환산할 수 없습니다.".formatted(label));
    }
  }

  /** 경계는 양쪽 포함. 사양을 모르는 그라인더(rangeChecked=false)는 검증하지 않는다. */
  private void requireInRange(GrindSpec spec, BigDecimal setting) {
    BigDecimal min = spec.effectiveMinSetting();
    if (setting.compareTo(min) < 0) {
      throw new GrindSettingOutOfRangeException(
          "설정값 %s는 이 그라인더의 하한 %s보다 낮습니다.".formatted(setting, min));
    }
    if (spec.rangeChecked() && setting.compareTo(spec.maxSetting()) > 0) {
      throw new GrindSettingOutOfRangeException(
          "설정값 %s는 이 그라인더의 상한 %s를 넘습니다.".formatted(setting, spec.maxSetting()));
    }
  }

  /** 결과가 대상 범위를 벗어났는지. 막지 않고 알려주기만 한다. */
  private boolean outOfRange(GrindSpec target, BigDecimal targetSetting) {
    if (!target.rangeChecked()) {
      return false;
    }
    return targetSetting.compareTo(target.effectiveMinSetting()) < 0
        || targetSetting.compareTo(target.maxSetting()) > 0;
  }
}

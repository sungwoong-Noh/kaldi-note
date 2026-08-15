package com.kaldinote.grind.domain;

import java.math.BigDecimal;

/**
 * 그라인더 간 분쇄도 환산 결과.
 *
 * @param targetOutOfRange 환산 결과가 대상 그라인더의 사양 범위를 벗어났는가. "내 그라인더로는 이 굵기가 안 나온다"는 정보이므로 막지 않고 알려준다.
 * @param estimated 항상 true. 버 형상·입도 분포가 달라 정확한 등가 변환은 성립하지 않는다.
 * @param warning UI가 반드시 노출해야 하는 경고 문구
 */
public record GrindConversion(
    BigDecimal sourceSetting,
    BigDecimal micron,
    BigDecimal targetSetting,
    boolean targetOutOfRange,
    boolean estimated,
    String warning) {}

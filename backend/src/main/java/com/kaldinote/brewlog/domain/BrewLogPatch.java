package com.kaldinote.brewlog.domain;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 수정할 필드 묶음. 모든 값이 nullable이고 null은 "변경 없음"이다.
 *
 * <p>presentation의 요청 DTO를 domain이 참조하지 않도록 서비스가 이 레코드로 옮겨 넘긴다(의존 방향은 presentation → application →
 * domain).
 *
 * <p>파생 값(마이크론·경과일·디게싱)은 여기 없다. 원두 재고와 그라인더 모델을 읽어야 계산할 수 있어 서비스가 따로 넘긴다.
 */
public record BrewLogPatch(
    Instant brewedAt,
    BrewLogVisibility visibility,
    BigDecimal actualDoseG,
    BigDecimal actualWaterG,
    BigDecimal actualWaterTempC,
    Integer actualTotalTimeSeconds,
    Integer actualDrawdownSeconds,
    Long userGrinderId,
    BigDecimal actualGrindSettingValue,
    BigDecimal beverageWeightG,
    BigDecimal tdsPercent,
    BigDecimal rating,
    Short acidity,
    Short sweetness,
    Short body,
    Short bitterness,
    Short aftertaste,
    String overallNote) {}

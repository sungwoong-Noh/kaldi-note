package com.kaldinote.brewlog.domain;

import java.math.BigDecimal;
import java.util.List;

/** 브루잉 시점의 레시피 값을 고정한 스냅샷. 레시피가 나중에 바뀌거나 삭제돼도 과거 기록은 이 값 그대로 남는다. */
public record RecipeSnapshot(
    String title,
    String authorName,
    BigDecimal doseG,
    BigDecimal waterG,
    BigDecimal temperatureC,
    String grinder,
    GrindValueSnapshot grindValue,
    List<StepSnapshot> steps) {

  public record GrindValueSnapshot(BigDecimal value, String unit) {}

  public record StepSnapshot(String type, BigDecimal waterG, Integer seconds, String note) {}
}

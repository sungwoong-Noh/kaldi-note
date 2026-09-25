package com.kaldinote.recipe.domain;

/**
 * 둘러보기(scope=PUBLIC)의 기구 필터. 실제 {@code Brewer}(brand+name+type)와는 이름 체계가 다르다 — "V60"은 브랜드가 아니라
 * Hario의 제품 라인명이라 이름으로 매칭하고, 나머지는 브랜드로 매칭한다.
 */
public enum DripperFilter {
  V60,
  KALITA,
  ORIGAMI,
  CLEVER
}

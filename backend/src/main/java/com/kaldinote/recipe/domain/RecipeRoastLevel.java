package com.kaldinote.recipe.domain;

/** 레시피에 어울리는 권장 배전도. 원두의 실제 배전도(catalog.RoastLevel, 5단계)와는 별개 필드다. */
public enum RecipeRoastLevel {
  LIGHT,
  MEDIUM,
  DARK
}

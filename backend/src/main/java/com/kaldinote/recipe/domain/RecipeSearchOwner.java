package com.kaldinote.recipe.domain;

/** 내 서랍(scope=DRAWER) 안에서 "내가 만든 것"과 "담아온(포크한) 것"을 가르는 필터. */
public enum RecipeSearchOwner {
  ALL,
  MINE,
  SAVED
}

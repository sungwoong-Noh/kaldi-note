package com.kaldinote.recipe.domain;

/**
 * 둘러보기(scope=PUBLIC) 전용 정렬. POPULAR(기본) = CURATED desc, savedCount desc, createdAt desc. RECENT =
 * createdAt desc 단일 기준.
 */
public enum RecipeSearchSort {
  POPULAR,
  RECENT
}

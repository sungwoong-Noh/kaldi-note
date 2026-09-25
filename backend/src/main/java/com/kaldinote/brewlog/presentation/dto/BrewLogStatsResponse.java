package com.kaldinote.brewlog.presentation.dto;

import java.math.BigDecimal;

/** 내 잔 통계 4칸. 기록이 0건이면 monthCount만 0이고 나머지는 전부 null이다(AC-RECIPESBREWS-28). */
public record BrewLogStatsResponse(
    int monthCount,
    BigDecimal averageRating,
    BigDecimal favoriteDoseG,
    Long favoriteRecipeId,
    String favoriteRecipeTitle) {}

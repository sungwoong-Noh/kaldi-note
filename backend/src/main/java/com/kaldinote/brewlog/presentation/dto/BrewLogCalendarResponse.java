package com.kaldinote.brewlog.presentation.dto;

import java.util.List;

/**
 * 한 달치 기록일 집계.
 *
 * <p>{@code days}는 희소 배열이다 — date 오름차순이고 기록이 없는 날은 담기지 않는다. {@code totalCount}는 {@code
 * days[*].count}의 합과 같다.
 */
public record BrewLogCalendarResponse(
    String month, long totalCount, List<CalendarDayResponse> days) {}

package com.kaldinote.brewlog.presentation.dto;

import java.time.LocalDate;

/** 달력의 한 칸. 기록이 있는 날만 만들어진다 — 빈 날은 항목 자체가 없다(AC-HOMECAL-67). */
public record CalendarDayResponse(LocalDate date, long count, String primaryRecipeName) {}

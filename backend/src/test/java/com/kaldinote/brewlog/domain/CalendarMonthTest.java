package com.kaldinote.brewlog.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kaldinote.common.error.BusinessException;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CalendarMonthTest {

  @Test
  @DisplayName("KST 9월의 시작은 UTC 8월 31일 15시다")
  void 시작_경계는_전날_15시다() {
    CalendarMonth month = CalendarMonth.parse("2026-09");

    assertThat(month.startInclusive()).isEqualTo(Instant.parse("2026-08-31T15:00:00Z"));
    assertThat(month.endExclusive()).isEqualTo(Instant.parse("2026-09-30T15:00:00Z"));
  }

  @Test
  @DisplayName("AC-HOMECAL-11 · month 형식이 틀리면 INVALID_REQUEST다")
  void 형식이_틀리면_거부한다() {
    assertThatThrownBy(() -> CalendarMonth.parse("2026-13")).isInstanceOf(BusinessException.class);
    assertThatThrownBy(() -> CalendarMonth.parse("26-09")).isInstanceOf(BusinessException.class);
    assertThatThrownBy(() -> CalendarMonth.parse(null)).isInstanceOf(BusinessException.class);
  }

  @Test
  @DisplayName("toKstDate — UTC 순간을 KST 날짜로 바꾼다")
  void utc_순간을_kst_날짜로_바꾼다() {
    assertThat(CalendarMonth.toKstDate(Instant.parse("2026-09-18T23:00:00Z")))
        .isEqualTo(java.time.LocalDate.of(2026, 9, 19));
    assertThat(CalendarMonth.toKstDate(Instant.parse("2026-09-19T14:59:59Z")))
        .isEqualTo(java.time.LocalDate.of(2026, 9, 19));
    assertThat(CalendarMonth.toKstDate(Instant.parse("2026-09-19T15:00:00Z")))
        .isEqualTo(java.time.LocalDate.of(2026, 9, 20));
  }
}

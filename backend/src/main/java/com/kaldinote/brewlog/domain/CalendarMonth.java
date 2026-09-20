package com.kaldinote.brewlog.domain;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;

/**
 * 달력이 다루는 「KST 기준의 한 달」.
 *
 * <p><b>오프셋을 여기 한 곳에만 둔다.</b> 한국은 서머타임이 없어 언제나 +9다. 값을 두 곳에 적으면 언젠가 한쪽만 고쳐져 달력과 목록의 날짜가 갈라진다.
 */
public record CalendarMonth(YearMonth value) {

  public static final ZoneOffset KST = ZoneOffset.ofHours(9);

  public static CalendarMonth parse(String raw) {
    if (raw == null) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "month는 필수입니다: YYYY-MM");
    }
    try {
      return new CalendarMonth(YearMonth.parse(raw));
    } catch (DateTimeParseException e) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "month는 YYYY-MM 형식이어야 합니다: " + raw);
    }
  }

  /** KST 그 달 1일 00:00을 UTC 순간으로. */
  public Instant startInclusive() {
    return value.atDay(1).atStartOfDay(KST).toInstant();
  }

  /** KST 다음 달 1일 00:00을 UTC 순간으로. 상한은 제외다. */
  public Instant endExclusive() {
    return value.plusMonths(1).atDay(1).atStartOfDay(KST).toInstant();
  }

  /** UTC 순간을 KST 날짜로. 집계 결과를 날짜로 묶을 때 쓴다. */
  public static LocalDate toKstDate(Instant instant) {
    return instant.atOffset(KST).toLocalDate();
  }

  public String format() {
    return value.toString();
  }
}

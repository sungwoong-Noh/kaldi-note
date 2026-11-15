package com.kaldinote.brewlog.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.brewlog.domain.BeanSummary.Cup;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BeanSummaryTest {

  private static final Instant T0 = Instant.parse("2026-11-13T00:00:00Z");

  /** 최신순 i번째(0부터) 잔. 원두량은 i로 구분할 수 있게 10+i, 물량 = 원두량 × 비율. */
  private static List<Cup> cups(String... ratios) {
    List<Cup> cups = new ArrayList<>();
    for (int i = 0; i < ratios.length; i++) {
      BigDecimal dose = new BigDecimal(10 + i).setScale(1);
      BigDecimal ratio = new BigDecimal(ratios[i]);
      cups.add(
          new Cup(
              (long) i + 1, T0.minusSeconds(3600L * i), dose, dose.multiply(ratio), ratio, null));
    }
    return cups;
  }

  @Test
  @DisplayName("AC-BEANDETAIL-15 · 자주 쓴 비율은 최근 10잔의 최빈값이다")
  void 자주_쓴_비율은_최근_10잔의_최빈값이다() {
    List<Cup> cups =
        cups(
            "15.6", "16.0", "15.6", "16.0", "15.6", "15.0", "15.0", "15.0", "15.0", "16.0", "15.0",
            "15.0");

    BeanSummary s = BeanSummary.of(cups);

    assertThat(s.frequentRatio()).isEqualByComparingTo("15.0");
    // 15.0을 쓴 가장 최근 기록 = 6번째(인덱스 5)
    assertThat(s.frequentDoseG()).isEqualByComparingTo(cups.get(5).actualDoseG());
    assertThat(s.frequentWaterG()).isEqualByComparingTo(cups.get(5).actualWaterG());
    assertThat(s.brewCount()).isEqualTo(12);
  }

  @Test
  @DisplayName("AC-BEANDETAIL-16 · 최빈값이 동률이면 가장 최근 기록의 비율이다")
  void 최빈값이_동률이면_가장_최근_기록의_비율이다() {
    List<Cup> cups = cups("16.0", "15.6", "16.0", "15.6");

    BeanSummary s = BeanSummary.of(cups);

    assertThat(s.frequentRatio()).isEqualByComparingTo("16.0");
    assertThat(s.frequentDoseG()).isEqualByComparingTo(cups.get(0).actualDoseG());
    assertThat(s.frequentWaterG()).isEqualByComparingTo(cups.get(0).actualWaterG());
  }

  @Test
  @DisplayName("AC-BEANDETAIL-17 · 평균 별점은 별점 없는 기록을 빼고 소수 1자리 반올림이다")
  void 평균_별점은_별점_없는_기록을_빼고_소수_1자리_반올림이다() {
    String[] ratings = {"4.0", "4.5", "4.0", "4.0", null};
    List<Cup> cups = new ArrayList<>();
    for (int i = 0; i < ratings.length; i++) {
      Cup c = cups("15.0").get(0);
      cups.add(
          new Cup(
              (long) i,
              T0.minusSeconds(i),
              c.actualDoseG(),
              c.actualWaterG(),
              c.brewRatio(),
              ratings[i] == null ? null : new BigDecimal(ratings[i])));
    }

    BeanSummary s = BeanSummary.of(cups);

    assertThat(s.brewCount()).isEqualTo(5);
    assertThat(s.ratedCount()).isEqualTo(4);
    assertThat(s.averageRating()).isEqualByComparingTo("4.1");
  }

  @Test
  void 기록이_없으면_0과_빈_값이다() {
    BeanSummary s = BeanSummary.of(List.of());

    assertThat(s.brewCount()).isZero();
    assertThat(s.ratedCount()).isZero();
    assertThat(s.averageRating()).isNull();
    assertThat(s.frequentRatio()).isNull();
    assertThat(s.frequentDoseG()).isNull();
    assertThat(s.frequentWaterG()).isNull();
    assertThat(s.recent()).isEmpty();
  }

  @Test
  void 최근은_최대_3개다() {
    assertThat(BeanSummary.of(cups("15.0", "15.0", "15.0", "15.0", "15.0")).recent())
        .extracting(Cup::id)
        .containsExactly(1L, 2L, 3L);
  }
}

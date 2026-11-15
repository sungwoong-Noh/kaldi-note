package com.kaldinote.brewlog.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 「이 원두의 기록」 요약 — 순수 계산. 규칙은 docs/specs/2026-11-15-bean-detail.md 「내 기록 요약」.
 *
 * @param recent 최신순 최대 3잔
 */
public record BeanSummary(
    int brewCount,
    int ratedCount,
    BigDecimal averageRating,
    BigDecimal frequentRatio,
    BigDecimal frequentDoseG,
    BigDecimal frequentWaterG,
    List<Cup> recent) {

  private static final int FREQUENT_WINDOW = 10;
  private static final int RECENT_SIZE = 3;

  /** 요약에 쓰는 한 잔. {@code brewRatio}는 기존 계산(물/원두, 소수 1자리) 결과다. */
  public record Cup(
      Long id,
      Instant brewedAt,
      BigDecimal actualDoseG,
      BigDecimal actualWaterG,
      BigDecimal brewRatio,
      BigDecimal rating) {}

  /** {@code newestFirst}는 brewedAt 최신순이어야 한다. */
  public static BeanSummary of(List<Cup> newestFirst) {
    List<BigDecimal> ratings =
        newestFirst.stream().map(Cup::rating).filter(Objects::nonNull).toList();
    BigDecimal average =
        ratings.isEmpty()
            ? null
            : ratings.stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(ratings.size()), 6, RoundingMode.HALF_UP)
                .setScale(1, RoundingMode.HALF_UP);

    Cup frequent =
        frequentCup(newestFirst.subList(0, Math.min(FREQUENT_WINDOW, newestFirst.size())));
    return new BeanSummary(
        newestFirst.size(),
        ratings.size(),
        average,
        frequent == null ? null : frequent.brewRatio(),
        frequent == null ? null : frequent.actualDoseG(),
        frequent == null ? null : frequent.actualWaterG(),
        newestFirst.subList(0, Math.min(RECENT_SIZE, newestFirst.size())));
  }

  /** 최빈 비율을 쓴 가장 최근 잔. 동률이면 더 최근에 처음 나온 비율이 이긴다. */
  private static Cup frequentCup(List<Cup> window) {
    // 키 = 비율(스케일과 무관하게 같게 보려고 stripTrailingZeros). 비율별 횟수와 그 비율의 가장 최근 잔
    Map<BigDecimal, Integer> counts = new LinkedHashMap<>();
    Map<BigDecimal, Cup> latest = new LinkedHashMap<>();
    for (Cup c : window) {
      BigDecimal key = c.brewRatio().stripTrailingZeros();
      counts.merge(key, 1, Integer::sum);
      latest.putIfAbsent(key, c);
    }
    Cup best = null;
    int bestCount = 0;
    for (var e : counts.entrySet()) { // 삽입 순서 = 최근에 처음 나온 순서라 동률이면 앞이 남는다
      if (e.getValue() > bestCount) {
        bestCount = e.getValue();
        best = latest.get(e.getKey());
      }
    }
    return best;
  }
}

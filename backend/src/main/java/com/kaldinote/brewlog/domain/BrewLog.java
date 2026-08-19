package com.kaldinote.brewlog.domain;

import com.kaldinote.common.entity.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 실제로 커피를 내린 기록.
 *
 * <p>레시피(설계도)와 분리된 실행 기록이며, 실측값은 전부 스냅샷이다. 레시피나 원두 재고가 나중에 바뀌거나 삭제돼도 이 값들은 변하지 않아야 한다 — 그래야 과거 추출을
 * 그때 조건 그대로 비교할 수 있다.
 *
 * <p>추출 수율·SCA 구간은 저장하지 않는다. 조회할 때마다 {@code ExtractionAnalyzer}로 다시 계산한다.
 */
@Entity
@Table(name = "brew_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewLog extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(name = "recipe_id", nullable = false)
  private Long recipeId;

  @Column(name = "bean_batch_id", nullable = false)
  private Long beanBatchId;

  @Column(name = "brewed_at", nullable = false)
  private Instant brewedAt;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private BrewLogVisibility visibility;

  @Column(name = "actual_dose_g", nullable = false, precision = 5, scale = 1)
  private BigDecimal actualDoseG;

  @Column(name = "actual_water_g", nullable = false, precision = 6, scale = 1)
  private BigDecimal actualWaterG;

  @Column(name = "actual_water_temp_c", nullable = false, precision = 4, scale = 1)
  private BigDecimal actualWaterTempC;

  @Column(name = "actual_total_time_seconds")
  private Integer actualTotalTimeSeconds;

  @Column(name = "actual_drawdown_seconds")
  private Integer actualDrawdownSeconds;

  @Column(name = "user_grinder_id", nullable = false)
  private Long userGrinderId;

  @Column(name = "actual_grind_setting_value", nullable = false, precision = 7, scale = 1)
  private BigDecimal actualGrindSettingValue;

  @Column(name = "actual_grind_micron_estimated", precision = 6, scale = 0)
  private BigDecimal actualGrindMicronEstimated;

  @Column(name = "beverage_weight_g", precision = 6, scale = 1)
  private BigDecimal beverageWeightG;

  @Column(name = "tds_percent", precision = 4, scale = 2)
  private BigDecimal tdsPercent;

  /** 재고가 삭제돼도 남아야 하므로 파생 계산이 아니라 스냅샷으로 저장한다. */
  @Column(name = "days_off_roast", nullable = false)
  private Integer daysOffRoast;

  @Column(name = "degassing_status", nullable = false, length = 20)
  private String degassingStatus;

  @Column(precision = 2, scale = 1)
  private BigDecimal rating;

  private Short acidity;

  private Short sweetness;

  private Short body;

  private Short bitterness;

  private Short aftertaste;

  @Column(name = "overall_note", length = 1000)
  private String overallNote;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  private BrewLog(
      Long userId,
      Long recipeId,
      Long beanBatchId,
      Instant brewedAt,
      BigDecimal actualDoseG,
      BigDecimal actualWaterG,
      BigDecimal actualWaterTempC,
      Integer actualTotalTimeSeconds,
      Integer actualDrawdownSeconds,
      Long userGrinderId,
      BigDecimal actualGrindSettingValue,
      BigDecimal actualGrindMicronEstimated,
      BigDecimal beverageWeightG,
      BigDecimal tdsPercent,
      Integer daysOffRoast,
      String degassingStatus,
      BigDecimal rating,
      Short acidity,
      Short sweetness,
      Short body,
      Short bitterness,
      Short aftertaste,
      String overallNote) {
    this.userId = userId;
    this.recipeId = recipeId;
    this.beanBatchId = beanBatchId;
    this.brewedAt = brewedAt;
    this.actualDoseG = actualDoseG;
    this.actualWaterG = actualWaterG;
    this.actualWaterTempC = actualWaterTempC;
    this.actualTotalTimeSeconds = actualTotalTimeSeconds;
    this.actualDrawdownSeconds = actualDrawdownSeconds;
    this.userGrinderId = userGrinderId;
    this.actualGrindSettingValue = actualGrindSettingValue;
    this.actualGrindMicronEstimated = actualGrindMicronEstimated;
    this.beverageWeightG = beverageWeightG;
    this.tdsPercent = tdsPercent;
    this.daysOffRoast = daysOffRoast;
    this.degassingStatus = degassingStatus;
    this.rating = rating;
    this.acidity = acidity;
    this.sweetness = sweetness;
    this.body = body;
    this.bitterness = bitterness;
    this.aftertaste = aftertaste;
    this.overallNote = overallNote;
  }

  public static BrewLog create(
      Long userId,
      Long recipeId,
      Long beanBatchId,
      Instant brewedAt,
      BrewLogVisibility visibility,
      BigDecimal actualDoseG,
      BigDecimal actualWaterG,
      BigDecimal actualWaterTempC,
      Integer actualTotalTimeSeconds,
      Integer actualDrawdownSeconds,
      Long userGrinderId,
      BigDecimal actualGrindSettingValue,
      BigDecimal actualGrindMicronEstimated,
      BigDecimal beverageWeightG,
      BigDecimal tdsPercent,
      Integer daysOffRoast,
      String degassingStatus,
      BigDecimal rating,
      Short acidity,
      Short sweetness,
      Short body,
      Short bitterness,
      Short aftertaste,
      String overallNote) {
    BrewLog log =
        new BrewLog(
            userId,
            recipeId,
            beanBatchId,
            brewedAt,
            actualDoseG,
            actualWaterG,
            actualWaterTempC,
            actualTotalTimeSeconds,
            actualDrawdownSeconds,
            userGrinderId,
            actualGrindSettingValue,
            actualGrindMicronEstimated,
            beverageWeightG,
            tdsPercent,
            daysOffRoast,
            degassingStatus,
            rating,
            acidity,
            sweetness,
            body,
            bitterness,
            aftertaste,
            overallNote);
    // 기본값을 DTO가 아니라 도메인이 정한다. 다른 경로로 만들어도 같은 기본값이 되도록.
    log.visibility = (visibility == null) ? BrewLogVisibility.PRIVATE : visibility;
    return log;
  }

  public boolean isOwnedBy(Long userId) {
    return this.userId != null && this.userId.equals(userId);
  }

  public void softDelete() {
    this.deletedAt = Instant.now();
  }

  /**
   * 부분 수정. null은 변경 없음이며 값 지우기는 지원하지 않는다.
   *
   * <p>파생 값 셋은 서비스가 계산해 넘긴다. 넘어온 값이 null이면 그대로 둔다 — 원두 재고가 삭제돼 경과일을 다시 셀 수 없을 때 과거 기록을 보존하는 경로다.
   */
  public void applyPatch(
      BrewLogPatch patch,
      BigDecimal recomputedMicron,
      Integer recomputedDaysOffRoast,
      String recomputedDegassingStatus) {
    if (patch.brewedAt() != null) {
      this.brewedAt = patch.brewedAt();
    }
    if (patch.visibility() != null) {
      this.visibility = patch.visibility();
    }
    if (patch.actualDoseG() != null) {
      this.actualDoseG = patch.actualDoseG();
    }
    if (patch.actualWaterG() != null) {
      this.actualWaterG = patch.actualWaterG();
    }
    if (patch.actualWaterTempC() != null) {
      this.actualWaterTempC = patch.actualWaterTempC();
    }
    if (patch.actualTotalTimeSeconds() != null) {
      this.actualTotalTimeSeconds = patch.actualTotalTimeSeconds();
    }
    if (patch.actualDrawdownSeconds() != null) {
      this.actualDrawdownSeconds = patch.actualDrawdownSeconds();
    }
    if (patch.userGrinderId() != null) {
      this.userGrinderId = patch.userGrinderId();
    }
    if (patch.actualGrindSettingValue() != null) {
      this.actualGrindSettingValue = patch.actualGrindSettingValue();
    }
    if (patch.beverageWeightG() != null) {
      this.beverageWeightG = patch.beverageWeightG();
    }
    if (patch.tdsPercent() != null) {
      this.tdsPercent = patch.tdsPercent();
    }
    if (patch.rating() != null) {
      this.rating = patch.rating();
    }
    if (patch.acidity() != null) {
      this.acidity = patch.acidity();
    }
    if (patch.sweetness() != null) {
      this.sweetness = patch.sweetness();
    }
    if (patch.body() != null) {
      this.body = patch.body();
    }
    if (patch.bitterness() != null) {
      this.bitterness = patch.bitterness();
    }
    if (patch.aftertaste() != null) {
      this.aftertaste = patch.aftertaste();
    }
    if (patch.overallNote() != null) {
      this.overallNote = patch.overallNote();
    }
    if (recomputedMicron != null) {
      this.actualGrindMicronEstimated = recomputedMicron;
    }
    if (recomputedDaysOffRoast != null) {
      this.daysOffRoast = recomputedDaysOffRoast;
    }
    if (recomputedDegassingStatus != null) {
      this.degassingStatus = recomputedDegassingStatus;
    }
  }
}

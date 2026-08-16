package com.kaldinote.gear.domain;

import com.kaldinote.common.entity.BaseTimeEntity;
import com.kaldinote.grind.domain.GrindSpec;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "grinder_models")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GrinderModel extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 50)
  private String brand;

  @Column(nullable = false, length = 100)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(name = "adjustment_type", nullable = false, length = 20)
  private AdjustmentType adjustmentType;

  @Column(name = "microns_per_click", precision = 6, scale = 2)
  private BigDecimal micronsPerClick;

  @Column(name = "zero_point_offset_clicks", nullable = false, precision = 6, scale = 2)
  private BigDecimal zeroPointOffsetClicks;

  @Column(name = "min_setting", precision = 6, scale = 2)
  private BigDecimal minSetting;

  @Column(name = "max_setting", precision = 6, scale = 2)
  private BigDecimal maxSetting;

  @Enumerated(EnumType.STRING)
  @Column(name = "burr_type", length = 20)
  private BurrType burrType;

  @Column(name = "is_system", nullable = false)
  private boolean isSystem;

  @Column(name = "created_by_user_id")
  private Long createdByUserId;

  private GrinderModel(
      String brand,
      String name,
      AdjustmentType adjustmentType,
      BigDecimal micronsPerClick,
      BigDecimal zeroPointOffsetClicks,
      BigDecimal minSetting,
      BigDecimal maxSetting,
      BurrType burrType,
      Long createdByUserId) {
    this.brand = brand;
    this.name = name;
    this.adjustmentType = adjustmentType;
    this.micronsPerClick = micronsPerClick;
    this.zeroPointOffsetClicks = zeroPointOffsetClicks;
    this.minSetting = minSetting;
    this.maxSetting = maxSetting;
    this.burrType = burrType;
    this.isSystem = false;
    this.createdByUserId = createdByUserId;
  }

  public static GrinderModel createByUser(
      String brand,
      String name,
      AdjustmentType adjustmentType,
      BigDecimal micronsPerClick,
      BigDecimal zeroPointOffsetClicks,
      BigDecimal minSetting,
      BigDecimal maxSetting,
      BurrType burrType,
      Long userId) {
    return new GrinderModel(
        brand,
        name,
        adjustmentType,
        micronsPerClick,
        zeroPointOffsetClicks,
        minSetting,
        maxSetting,
        burrType,
        userId);
  }

  /**
   * 순수 계산 도메인이 쓸 값 객체로 변환한다.
   *
   * <p>min·max까지 넘겨야 범위 검증도 순수 도메인에서 단위 테스트로 검증된다.
   */
  public GrindSpec toGrindSpec() {
    return new GrindSpec(micronsPerClick, zeroPointOffsetClicks, minSetting, maxSetting);
  }
}

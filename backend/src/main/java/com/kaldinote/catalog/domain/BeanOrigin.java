package com.kaldinote.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "bean_origins")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BeanOrigin {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "bean_product_id")
  private BeanProduct beanProduct;

  @Column(nullable = false, length = 100)
  private String country;

  @Column(length = 100)
  private String region;

  @Column(length = 100)
  private String farm;

  @Column(name = "altitude_min_m")
  private Short altitudeMinM;

  @Column(name = "altitude_max_m")
  private Short altitudeMaxM;

  @Column(name = "variety_id")
  private Long varietyId;

  @Column(name = "process_id")
  private Long processId;

  @Column(name = "ratio_percent", nullable = false, precision = 4, scale = 1)
  private BigDecimal ratioPercent;

  private BeanOrigin(
      String country,
      String region,
      String farm,
      Short altitudeMinM,
      Short altitudeMaxM,
      Long varietyId,
      Long processId,
      BigDecimal ratioPercent) {
    this.country = country;
    this.region = region;
    this.farm = farm;
    this.altitudeMinM = altitudeMinM;
    this.altitudeMaxM = altitudeMaxM;
    this.varietyId = varietyId;
    this.processId = processId;
    this.ratioPercent = ratioPercent;
  }

  public static BeanOrigin of(
      String country,
      String region,
      String farm,
      Short altitudeMinM,
      Short altitudeMaxM,
      Long varietyId,
      Long processId,
      BigDecimal ratioPercent) {
    return new BeanOrigin(
        country, region, farm, altitudeMinM, altitudeMaxM, varietyId, processId, ratioPercent);
  }

  void assignTo(BeanProduct product) {
    this.beanProduct = product;
  }
}

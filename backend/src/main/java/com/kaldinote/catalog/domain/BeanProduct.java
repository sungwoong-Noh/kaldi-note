package com.kaldinote.catalog.domain;

import com.kaldinote.common.entity.BaseTimeEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "bean_products")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BeanProduct extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "roaster_id", nullable = false)
  private Long roasterId;

  @Column(nullable = false, length = 100)
  private String name;

  @Enumerated(EnumType.STRING)
  @Column(name = "bean_mix", nullable = false, length = 20)
  private BeanMix beanMix;

  @Enumerated(EnumType.STRING)
  @Column(name = "roast_level", nullable = false, length = 20)
  private RoastLevel roastLevel;

  @Column(name = "roast_level_agtron")
  private Short roastLevelAgtron;

  @Column(name = "roast_level_custom", length = 100)
  private String roastLevelCustom;

  @Column(nullable = false)
  private boolean decaf;

  @Column(name = "product_url", length = 500)
  private String productUrl;

  @Column(length = 2000)
  private String description;

  @Column(nullable = false)
  private boolean verified;

  @Column(name = "created_by_user_id")
  private Long createdByUserId;

  @OneToMany(mappedBy = "beanProduct", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<BeanOrigin> origins = new ArrayList<>();

  private BeanProduct(
      Long roasterId,
      String name,
      BeanMix beanMix,
      RoastLevel roastLevel,
      Short roastLevelAgtron,
      String roastLevelCustom,
      boolean decaf,
      String productUrl,
      String description,
      Long createdByUserId) {
    this.roasterId = roasterId;
    this.name = name;
    this.beanMix = beanMix;
    this.roastLevel = roastLevel;
    this.roastLevelAgtron = roastLevelAgtron;
    this.roastLevelCustom = roastLevelCustom;
    this.decaf = decaf;
    this.productUrl = productUrl;
    this.description = description;
    this.verified = false;
    this.createdByUserId = createdByUserId;
  }

  public static BeanProduct createByUser(
      Long roasterId,
      String name,
      BeanMix beanMix,
      RoastLevel roastLevel,
      Short roastLevelAgtron,
      String roastLevelCustom,
      boolean decaf,
      String productUrl,
      String description,
      Long createdByUserId) {
    return new BeanProduct(
        roasterId,
        name,
        beanMix,
        roastLevel,
        roastLevelAgtron,
        roastLevelCustom,
        decaf,
        productUrl,
        description,
        createdByUserId);
  }

  public void attachOrigins(List<BeanOrigin> newOrigins) {
    newOrigins.forEach(o -> o.assignTo(this));
    this.origins.clear();
    this.origins.addAll(newOrigins);
  }
}

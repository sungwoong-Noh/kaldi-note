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
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.BatchSize;

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
  @Column(name = "roast_level", length = 20)
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

  /** 숨긴 원두. 크롤러는 읽지도 쓰지도 않는다. */
  @Column(nullable = false)
  private boolean hidden;

  /** 관리자가 손으로 고친 원두. 크롤러는 구매 링크만 갱신한다. */
  @Column(name = "manually_edited", nullable = false)
  private boolean manuallyEdited;

  /** 관리자가 카탈로그로 올린 사용자 원두. 만든 사람이 아니어도 검색된다. */
  @Column(nullable = false)
  private boolean promoted;

  @OneToMany(mappedBy = "beanProduct", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("id ASC")
  @BatchSize(size = 50) // 검색 결과 한 페이지(최대 50개)의 산지를 한 번에 읽는다
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

  /** 크롤러가 가져온 상품. {@code createdByUserId}가 null이라 다음 수집 때 갱신할 수 있다. */
  public static BeanProduct createByCrawler(
      Long roasterId,
      String name,
      BeanMix beanMix,
      RoastLevel roastLevel,
      Short roastLevelAgtron,
      String productUrl,
      String description) {
    return new BeanProduct(
        roasterId,
        name,
        beanMix,
        roastLevel,
        roastLevelAgtron,
        null,
        false,
        productUrl,
        description,
        null);
  }

  public boolean isCrawled() {
    return createdByUserId == null;
  }

  public void updateFromCrawl(
      BeanMix beanMix,
      RoastLevel roastLevel,
      Short roastLevelAgtron,
      String productUrl,
      String description) {
    this.beanMix = beanMix;
    this.roastLevel = roastLevel;
    this.roastLevelAgtron = roastLevelAgtron;
    this.productUrl = productUrl;
    this.description = description;
  }

  /** 카탈로그로 올린다. 사용자 원두만 — 크롤러 원두는 이미 모두에게 보인다. 이미 올렸어도 그대로(멱등). */
  public void promote() {
    this.promoted = true;
  }

  /**
   * 관리자 수정 — 내용 필드 전체 교체. 내용이 하나라도 바뀌면 {@code manuallyEdited}를 켠다(이미 켜져 있으면 그대로). {@code verified}
   * · {@code hidden}은 내용이 아니라 수정 여부와 무관하다. 저장할 산지는 {@code origins}로 교체한다.
   */
  public void editByAdmin(
      Long roasterId,
      String name,
      BeanMix beanMix,
      RoastLevel roastLevel,
      Short roastLevelAgtron,
      String roastLevelCustom,
      boolean decaf,
      String productUrl,
      String description,
      List<BeanOrigin> newOrigins,
      boolean verified,
      boolean hidden) {
    boolean changed =
        !Objects.equals(this.roasterId, roasterId)
            || !Objects.equals(this.name, name)
            || !Objects.equals(this.roastLevelCustom, roastLevelCustom)
            || this.decaf != decaf
            || !sameAs(beanMix, roastLevel, roastLevelAgtron, productUrl, description, newOrigins);
    if (changed) {
      this.roasterId = roasterId;
      this.name = name;
      this.beanMix = beanMix;
      this.roastLevel = roastLevel;
      this.roastLevelAgtron = roastLevelAgtron;
      this.roastLevelCustom = roastLevelCustom;
      this.decaf = decaf;
      this.productUrl = productUrl;
      this.description = description;
      attachOrigins(newOrigins);
      this.manuallyEdited = true;
    }
    this.verified = verified;
    this.hidden = hidden;
  }

  public void updateProductUrl(String productUrl) {
    this.productUrl = productUrl;
  }

  public void attachOrigins(List<BeanOrigin> newOrigins) {
    newOrigins.forEach(o -> o.assignTo(this));
    this.origins.clear();
    this.origins.addAll(newOrigins);
  }

  /** 크롤러 비교 대상 값(혼합, 배전도, 애그트론, URL, 컵노트, 산지 순서·값)이 모두 같은지 판정한다. */
  public boolean sameAs(
      BeanMix beanMix,
      RoastLevel roastLevel,
      Short roastLevelAgtron,
      String productUrl,
      String description,
      List<BeanOrigin> otherOrigins) {
    if (this.beanMix != beanMix
        || this.roastLevel != roastLevel
        || !Objects.equals(this.roastLevelAgtron, roastLevelAgtron)
        || !Objects.equals(this.productUrl, productUrl)
        || !Objects.equals(this.description, description)) {
      return false;
    }
    if (otherOrigins == null || this.origins.size() != otherOrigins.size()) {
      return false;
    }
    for (int i = 0; i < this.origins.size(); i++) {
      if (!this.origins.get(i).sameValues(otherOrigins.get(i))) {
        return false;
      }
    }
    return true;
  }
}

package com.kaldinote.inventory.domain;

import com.kaldinote.common.entity.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "bean_batches")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BeanBatch extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(name = "bean_product_id", nullable = false)
  private Long beanProductId;

  @Column(name = "roasted_at", nullable = false)
  private LocalDate roastedAt;

  @Column(name = "purchased_at")
  private LocalDate purchasedAt;

  @Column(name = "opened_at")
  private LocalDate openedAt;

  @Column(name = "weight_g", nullable = false, precision = 6, scale = 1)
  private BigDecimal weightG;

  @Column(name = "remaining_g", nullable = false, precision = 6, scale = 1)
  private BigDecimal remainingG;

  private Integer price;

  @Column(nullable = false)
  private boolean frozen;

  @Column(name = "frozen_at")
  private Instant frozenAt;

  @Column(nullable = false)
  private boolean finished;

  @Column(length = 500)
  private String memo;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  private BeanBatch(
      Long userId,
      Long beanProductId,
      LocalDate roastedAt,
      LocalDate purchasedAt,
      BigDecimal weightG,
      Integer price,
      String memo) {
    this.userId = userId;
    this.beanProductId = beanProductId;
    this.roastedAt = roastedAt;
    this.purchasedAt = purchasedAt;
    this.weightG = weightG;
    this.remainingG = weightG;
    this.price = price;
    this.frozen = false;
    this.finished = false;
    this.memo = memo;
  }

  public static BeanBatch create(
      Long userId,
      Long beanProductId,
      LocalDate roastedAt,
      LocalDate purchasedAt,
      BigDecimal weightG,
      Integer price,
      String memo) {
    return new BeanBatch(userId, beanProductId, roastedAt, purchasedAt, weightG, price, memo);
  }

  public void applyPatch(BigDecimal remainingG, Boolean finished, Boolean frozen) {
    if (remainingG != null) {
      this.remainingG = remainingG;
    }
    if (finished != null) {
      this.finished = finished;
    }
    if (frozen != null && frozen != this.frozen) {
      this.frozen = frozen;
      this.frozenAt = frozen ? Instant.now() : null;
    }
  }

  public void softDelete() {
    this.deletedAt = Instant.now();
  }

  public boolean isOwnedBy(Long userId) {
    return this.userId != null && this.userId.equals(userId);
  }
}

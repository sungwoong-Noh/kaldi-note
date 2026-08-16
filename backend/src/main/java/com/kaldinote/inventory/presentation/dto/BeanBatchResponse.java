package com.kaldinote.inventory.presentation.dto;

import com.kaldinote.inventory.domain.BeanBatch;
import com.kaldinote.inventory.domain.DegassingStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public record BeanBatchResponse(
    Long id,
    Long beanProductId,
    BigDecimal weightG,
    BigDecimal remainingG,
    LocalDate roastedAt,
    LocalDate purchasedAt,
    LocalDate openedAt,
    Integer price,
    boolean frozen,
    Instant frozenAt,
    boolean finished,
    String memo,
    long daysOffRoast,
    String degassingStatus,
    Instant createdAt,
    Instant updatedAt) {

  public static BeanBatchResponse from(BeanBatch b) {
    long daysOffRoast = ChronoUnit.DAYS.between(b.getRoastedAt(), LocalDate.now());
    return new BeanBatchResponse(
        b.getId(),
        b.getBeanProductId(),
        b.getWeightG(),
        b.getRemainingG(),
        b.getRoastedAt(),
        b.getPurchasedAt(),
        b.getOpenedAt(),
        b.getPrice(),
        b.isFrozen(),
        b.getFrozenAt(),
        b.isFinished(),
        b.getMemo(),
        daysOffRoast,
        DegassingStatus.of(daysOffRoast).name(),
        b.getCreatedAt(),
        b.getUpdatedAt());
  }
}

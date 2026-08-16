package com.kaldinote.inventory.presentation.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record BeanBatchCreateRequest(
    @NotNull Long beanProductId,
    @NotNull @DecimalMin("10.0") @DecimalMax("5000.0") BigDecimal weightG,
    @NotNull @PastOrPresent LocalDate roastedAt,
    LocalDate purchasedAt,
    @Min(0) @Max(1000000) Integer price,
    @Size(max = 500) String memo) {}

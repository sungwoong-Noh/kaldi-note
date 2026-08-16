package com.kaldinote.catalog.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record OriginRequest(
    @NotBlank @Size(max = 100) String country,
    @Size(max = 100) String region,
    @Size(max = 100) String farm,
    Short altitudeMinM,
    Short altitudeMaxM,
    Long varietyId,
    Long processId,
    BigDecimal ratioPercent) {}

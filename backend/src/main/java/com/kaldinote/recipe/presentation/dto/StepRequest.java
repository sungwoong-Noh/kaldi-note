package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.Agitation;
import com.kaldinote.recipe.domain.PourTechnique;
import com.kaldinote.recipe.domain.StepType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record StepRequest(
    @NotNull StepType stepType,
    @NotNull @Min(0) @Max(3600) Integer startAtSeconds,
    @NotNull @Min(0) @Max(3600) Integer durationSeconds,
    @DecimalMin("0.0") @DecimalMax("3000.0") BigDecimal waterG,
    PourTechnique pourTechnique,
    Agitation agitation,
    @Size(max = 500) String note) {}

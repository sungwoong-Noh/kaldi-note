package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.Agitation;
import com.kaldinote.recipe.domain.PourTechnique;
import com.kaldinote.recipe.domain.StepType;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record StepRequest(
    @NotNull StepType stepType,
    @NotNull Integer startAtSeconds,
    @NotNull Integer durationSeconds,
    BigDecimal waterG,
    PourTechnique pourTechnique,
    Agitation agitation,
    String note) {}

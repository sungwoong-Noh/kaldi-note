package com.kaldinote.inventory.presentation.dto;

import java.math.BigDecimal;

public record BeanBatchPatchRequest(BigDecimal remainingG, Boolean finished, Boolean frozen) {}

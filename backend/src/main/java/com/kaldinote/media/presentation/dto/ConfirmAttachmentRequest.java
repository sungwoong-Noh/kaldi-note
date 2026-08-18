package com.kaldinote.media.presentation.dto;

import com.kaldinote.media.domain.TargetType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ConfirmAttachmentRequest(
    @NotNull TargetType targetType,
    @NotNull Long targetId,
    @NotBlank String objectKey,
    @NotNull @Positive Integer width,
    @NotNull @Positive Integer height) {}

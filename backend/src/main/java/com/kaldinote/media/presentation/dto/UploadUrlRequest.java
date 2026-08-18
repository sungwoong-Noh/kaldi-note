package com.kaldinote.media.presentation.dto;

import com.kaldinote.media.domain.TargetType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UploadUrlRequest(
    @NotNull TargetType targetType, @NotNull Long targetId, @NotBlank String contentType) {}

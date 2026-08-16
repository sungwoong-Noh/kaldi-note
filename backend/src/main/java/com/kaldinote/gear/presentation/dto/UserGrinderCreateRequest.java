package com.kaldinote.gear.presentation.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UserGrinderCreateRequest(
    @NotNull Long grinderModelId, @Size(max = 50) String nickname) {}

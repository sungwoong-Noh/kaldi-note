package com.kaldinote.auth.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(@NotBlank String code) {}

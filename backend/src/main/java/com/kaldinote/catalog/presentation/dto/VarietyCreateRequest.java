package com.kaldinote.catalog.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record VarietyCreateRequest(@NotBlank String name, String nameKo) {}

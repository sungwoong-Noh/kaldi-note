package com.kaldinote.catalog.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RoasterCreateRequest(
    @NotBlank @Size(max = 100) String name,
    @Size(max = 100) String country,
    @Size(max = 500) String website) {}

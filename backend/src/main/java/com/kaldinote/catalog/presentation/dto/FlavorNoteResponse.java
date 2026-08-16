package com.kaldinote.catalog.presentation.dto;

import java.util.List;

public record FlavorNoteResponse(
    Long id, String nameEn, String nameKo, List<FlavorNoteResponse> children) {}

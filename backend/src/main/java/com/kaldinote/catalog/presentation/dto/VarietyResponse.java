package com.kaldinote.catalog.presentation.dto;

import com.kaldinote.catalog.domain.Variety;

public record VarietyResponse(Long id, String name, String nameKo, boolean isSystem) {

  public static VarietyResponse from(Variety v) {
    return new VarietyResponse(v.getId(), v.getName(), v.getNameKo(), v.isSystem());
  }
}

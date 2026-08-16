package com.kaldinote.catalog.presentation.dto;

import com.kaldinote.catalog.domain.CoffeeProcess;

public record CoffeeProcessResponse(
    Long id, String name, String nameKo, String category, boolean isSystem) {

  public static CoffeeProcessResponse from(CoffeeProcess p) {
    return new CoffeeProcessResponse(
        p.getId(), p.getName(), p.getNameKo(), p.getCategory().name(), p.isSystem());
  }
}

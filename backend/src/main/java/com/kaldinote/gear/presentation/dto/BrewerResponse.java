package com.kaldinote.gear.presentation.dto;

import com.kaldinote.gear.domain.Brewer;

public record BrewerResponse(Long id, String brand, String name, String type, boolean isSystem) {

  public static BrewerResponse from(Brewer b) {
    return new BrewerResponse(
        b.getId(), b.getBrand(), b.getName(), b.getType().name(), b.isSystem());
  }
}

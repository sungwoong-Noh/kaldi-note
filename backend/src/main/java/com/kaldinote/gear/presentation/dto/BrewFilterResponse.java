package com.kaldinote.gear.presentation.dto;

import com.kaldinote.gear.domain.BrewFilter;

public record BrewFilterResponse(
    Long id, String name, String material, String shape, boolean isSystem) {

  public static BrewFilterResponse from(BrewFilter f) {
    return new BrewFilterResponse(
        f.getId(), f.getName(), f.getMaterial().name(), f.getShape(), f.isSystem());
  }
}

package com.kaldinote.catalog.presentation.dto;

import com.kaldinote.catalog.domain.Roaster;
import java.time.Instant;

public record RoasterResponse(
    Long id,
    String name,
    String country,
    String website,
    boolean isSystem,
    Long createdByUserId,
    Instant createdAt) {

  public static RoasterResponse from(Roaster r) {
    return new RoasterResponse(
        r.getId(),
        r.getName(),
        r.getCountry(),
        r.getWebsite(),
        r.isSystem(),
        r.getCreatedByUserId(),
        r.getCreatedAt());
  }
}

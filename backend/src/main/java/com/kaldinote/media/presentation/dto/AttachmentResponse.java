package com.kaldinote.media.presentation.dto;

import com.kaldinote.media.domain.Attachment;
import java.time.Instant;

public record AttachmentResponse(
    Long id,
    String targetType,
    Long targetId,
    String url,
    String contentType,
    Integer width,
    Integer height,
    Integer sortOrder,
    Instant createdAt) {

  public static AttachmentResponse from(Attachment a, String url) {
    return new AttachmentResponse(
        a.getId(),
        a.getTargetType().name(),
        a.getTargetId(),
        url,
        a.getContentType(),
        a.getWidth(),
        a.getHeight(),
        a.getSortOrder(),
        a.getCreatedAt());
  }
}

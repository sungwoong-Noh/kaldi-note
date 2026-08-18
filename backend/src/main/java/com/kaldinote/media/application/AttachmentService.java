package com.kaldinote.media.application;

import com.kaldinote.brewlog.application.BrewLogService;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.media.domain.TargetType;
import com.kaldinote.media.infrastructure.AttachmentRepository;
import com.kaldinote.media.infrastructure.ObjectStorageClient;
import com.kaldinote.media.presentation.dto.UploadUrlRequest;
import com.kaldinote.media.presentation.dto.UploadUrlResponse;
import com.kaldinote.recipe.application.RecipeService;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AttachmentService {

  private static final Map<String, String> ALLOWED_CONTENT_TYPES =
      Map.of(
          "image/jpeg", "jpg",
          "image/png", "png",
          "image/webp", "webp");
  private static final int MAX_ATTACHMENTS_PER_TARGET = 4;
  private static final long UPLOAD_URL_TTL_SECONDS = 600;

  private final RecipeService recipeService;
  private final BrewLogService brewLogService;
  private final AttachmentRepository attachmentRepository;
  private final ObjectStorageClient objectStorageClient;

  public UploadUrlResponse issueUploadUrl(Long userId, UploadUrlRequest request) {
    requireOwned(request.targetType(), request.targetId(), userId);

    String extension = ALLOWED_CONTENT_TYPES.get(request.contentType());
    if (extension == null) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST, "지원하지 않는 이미지 형식입니다: " + request.contentType());
    }

    if (attachmentCount(request.targetType(), request.targetId()) >= MAX_ATTACHMENTS_PER_TARGET) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "첨부는 대상당 최대 4장까지입니다.");
    }

    String objectKey =
        "attachments/%s/%d/%s.%s"
            .formatted(request.targetType(), request.targetId(), UUID.randomUUID(), extension);
    Instant expiresAt = Instant.now().plusSeconds(UPLOAD_URL_TTL_SECONDS);
    String uploadUrl =
        objectStorageClient.issueUploadUrl(objectKey, request.contentType(), expiresAt);

    return new UploadUrlResponse(objectKey, uploadUrl, expiresAt);
  }

  private void requireOwned(TargetType targetType, Long targetId, Long userId) {
    switch (targetType) {
      case RECIPE -> recipeService.requireOwned(userId, targetId);
      case BREW_LOG -> brewLogService.requireOwned(userId, targetId);
    }
  }

  private long attachmentCount(TargetType targetType, Long targetId) {
    return attachmentRepository.countByTargetTypeAndTargetId(targetType, targetId);
  }
}

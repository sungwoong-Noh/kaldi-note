package com.kaldinote.media.application;

import com.kaldinote.brewlog.application.BrewLogService;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.media.domain.Attachment;
import com.kaldinote.media.domain.TargetType;
import com.kaldinote.media.infrastructure.AttachmentRepository;
import com.kaldinote.media.infrastructure.ObjectHead;
import com.kaldinote.media.infrastructure.ObjectStorageClient;
import com.kaldinote.media.presentation.dto.AttachmentResponse;
import com.kaldinote.media.presentation.dto.ConfirmAttachmentRequest;
import com.kaldinote.media.presentation.dto.UploadUrlRequest;
import com.kaldinote.media.presentation.dto.UploadUrlResponse;
import com.kaldinote.recipe.application.RecipeService;
import java.time.Instant;
import java.util.List;
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
  private static final long MAX_BYTES = 10_485_760L;

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

  public AttachmentResponse confirm(Long userId, ConfirmAttachmentRequest request) {
    requireOwned(request.targetType(), request.targetId(), userId);

    if (attachmentRepository.existsByObjectKey(request.objectKey())) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST, "이미 확정된 objectKey입니다: " + request.objectKey());
    }

    ObjectHead head =
        objectStorageClient
            .head(request.objectKey())
            .orElseThrow(
                () ->
                    new BusinessException(
                        ErrorCode.NOT_FOUND, "업로드된 파일을 찾을 수 없습니다: " + request.objectKey()));

    if (head.contentLength() > MAX_BYTES) {
      objectStorageClient.delete(request.objectKey());
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "파일 크기가 10MB를 초과합니다.");
    }

    int sortOrder = (int) attachmentCount(request.targetType(), request.targetId()) + 1;

    Attachment attachment =
        Attachment.create(
            userId,
            request.targetType(),
            request.targetId(),
            request.objectKey(),
            head.contentType(),
            request.width(),
            request.height(),
            sortOrder);

    Attachment saved = attachmentRepository.save(attachment);
    return AttachmentResponse.from(saved, objectStorageClient.publicUrl(saved.getObjectKey()));
  }

  public List<AttachmentResponse> list(Long userId, TargetType targetType, Long targetId) {
    requireViewable(targetType, targetId, userId);
    return attachmentRepository
        .findByTargetTypeAndTargetIdOrderBySortOrderAsc(targetType, targetId)
        .stream()
        .map(a -> AttachmentResponse.from(a, objectStorageClient.publicUrl(a.getObjectKey())))
        .toList();
  }

  private void requireOwned(TargetType targetType, Long targetId, Long userId) {
    switch (targetType) {
      case RECIPE -> recipeService.requireOwned(userId, targetId);
      case BREW_LOG -> brewLogService.requireOwned(userId, targetId);
    }
  }

  private void requireViewable(TargetType targetType, Long targetId, Long userId) {
    switch (targetType) {
      case RECIPE -> recipeService.requireViewable(userId, targetId);
      case BREW_LOG -> brewLogService.requireViewable(userId, targetId);
    }
  }

  private long attachmentCount(TargetType targetType, Long targetId) {
    return attachmentRepository.countByTargetTypeAndTargetId(targetType, targetId);
  }
}

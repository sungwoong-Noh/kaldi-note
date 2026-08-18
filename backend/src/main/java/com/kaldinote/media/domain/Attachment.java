package com.kaldinote.media.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * updated_at이 없다 — 첨부는 확정 이후 수정되지 않고 삭제만 된다. 삭제 인가는 대상을 다시 조회하지 않고 ownerUserId로 직접 판정한다(대상이 소프트
 * 삭제돼도 소유자는 여전히 지울 수 있다).
 */
@Entity
@Table(name = "attachments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Attachment {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "owner_user_id", nullable = false)
  private Long ownerUserId;

  @Enumerated(EnumType.STRING)
  @Column(name = "target_type", nullable = false, length = 20)
  private TargetType targetType;

  @Column(name = "target_id", nullable = false)
  private Long targetId;

  @Column(name = "object_key", nullable = false, unique = true, length = 500)
  private String objectKey;

  @Column(name = "content_type", nullable = false, length = 50)
  private String contentType;

  @Column(nullable = false)
  private Integer width;

  @Column(nullable = false)
  private Integer height;

  @Column(name = "sort_order", nullable = false)
  private Integer sortOrder;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  private Attachment(
      Long ownerUserId,
      TargetType targetType,
      Long targetId,
      String objectKey,
      String contentType,
      Integer width,
      Integer height,
      Integer sortOrder) {
    this.ownerUserId = ownerUserId;
    this.targetType = targetType;
    this.targetId = targetId;
    this.objectKey = objectKey;
    this.contentType = contentType;
    this.width = width;
    this.height = height;
    this.sortOrder = sortOrder;
    this.createdAt = Instant.now();
  }

  public static Attachment create(
      Long ownerUserId,
      TargetType targetType,
      Long targetId,
      String objectKey,
      String contentType,
      Integer width,
      Integer height,
      Integer sortOrder) {
    return new Attachment(
        ownerUserId, targetType, targetId, objectKey, contentType, width, height, sortOrder);
  }

  public boolean isOwnedBy(Long userId) {
    return this.ownerUserId != null && this.ownerUserId.equals(userId);
  }
}

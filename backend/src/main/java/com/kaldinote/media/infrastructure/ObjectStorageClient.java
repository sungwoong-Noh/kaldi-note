package com.kaldinote.media.infrastructure;

import java.time.Instant;
import java.util.Optional;

/**
 * OCI Object Storage 접근을 추상화한다. 실제 구현({@link OciObjectStorageClient})은 프로덕션에서, {@link
 * FakeObjectStorageClient}는 테스트에서 쓴다 — 스프링 프로필로 갈린다.
 */
public interface ObjectStorageClient {

  /** ObjectWrite 권한의 PAR을 발급하고 업로드용 URL을 돌려준다. */
  String issueUploadUrl(String objectKey, String contentType, Instant expiresAt);

  /** 객체 존재 여부와 메타데이터를 확인한다. 없으면 빈 Optional. */
  Optional<ObjectHead> head(String objectKey);

  /** 객체를 삭제한다. */
  void delete(String objectKey);

  /** 버킷이 public-read이므로 인증 없이 접근 가능한 고정 URL을 돌려준다. */
  String publicUrl(String objectKey);
}

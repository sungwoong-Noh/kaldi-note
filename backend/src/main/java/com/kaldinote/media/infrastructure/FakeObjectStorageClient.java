package com.kaldinote.media.infrastructure;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/** 테스트 전용 가짜 구현. HEAD 응답을 테스트마다 다르게 스텁할 수 있어야 AC-MEDIA-14·17을 검증할 수 있다. */
@Component
@Profile("test")
public class FakeObjectStorageClient implements ObjectStorageClient {

  private final Map<String, ObjectHead> heads = new ConcurrentHashMap<>();
  private final Set<String> deletedKeys = ConcurrentHashMap.newKeySet();

  @Override
  public String issueUploadUrl(String objectKey, String contentType, Instant expiresAt) {
    return "https://fake-oci.local/p/test-token/n/test-ns/b/test-bucket/o/" + objectKey;
  }

  @Override
  public Optional<ObjectHead> head(String objectKey) {
    return Optional.ofNullable(heads.get(objectKey));
  }

  @Override
  public void delete(String objectKey) {
    heads.remove(objectKey);
    deletedKeys.add(objectKey);
  }

  @Override
  public String publicUrl(String objectKey) {
    return "https://fake-oci.local/n/test-ns/b/test-bucket/o/" + objectKey;
  }

  /** 테스트에서 "실제 업로드까지 마쳤다"를 재현한다. */
  public void stubUploaded(String objectKey, long contentLength, String contentType) {
    heads.put(objectKey, new ObjectHead(contentLength, contentType));
  }

  public boolean wasDeleted(String objectKey) {
    return deletedKeys.contains(objectKey);
  }

  /** 테스트 간 상태 누수를 막는다. */
  public void reset() {
    heads.clear();
    deletedKeys.clear();
  }
}

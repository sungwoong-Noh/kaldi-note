package com.kaldinote.media.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

class FakeObjectStorageClientTest {

  private final FakeObjectStorageClient client = new FakeObjectStorageClient();

  @Test
  void stub한_객체는_head로_조회된다() {
    client.stubUploaded("k1", 12345L, "image/jpeg");

    ObjectHead head = client.head("k1").orElseThrow();

    assertThat(head.contentLength()).isEqualTo(12345L);
    assertThat(head.contentType()).isEqualTo("image/jpeg");
  }

  @Test
  void stub하지_않은_객체는_head가_비어있다() {
    assertThat(client.head("no-such-key")).isEmpty();
  }

  @Test
  void delete하면_head가_다시_비어있고_삭제로_기록된다() {
    client.stubUploaded("k2", 100L, "image/png");

    client.delete("k2");

    assertThat(client.head("k2")).isEmpty();
    assertThat(client.wasDeleted("k2")).isTrue();
  }

  @Test
  void issueUploadUrl과_publicUrl은_objectKey를_포함한_URL을_돌려준다() {
    String uploadUrl = client.issueUploadUrl("k3", "image/jpeg", Instant.now().plusSeconds(600));
    String publicUrl = client.publicUrl("k3");

    assertThat(uploadUrl).contains("k3");
    assertThat(publicUrl).contains("k3");
  }
}

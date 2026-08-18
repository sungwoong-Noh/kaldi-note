package com.kaldinote.media.infrastructure;

import static org.assertj.core.api.Assertions.assertThatCode;

import org.junit.jupiter.api.Test;

/**
 * 실제 OCI 연동은 검증하지 않는다(자격증명이 필요해 배포 이후로 미룬다). 여기서 검증하는 것은 "실제 자격증명이 없어도 애플리케이션 컨텍스트가 기동돼야 한다"는 것
 * 하나뿐이다 — OAuth 클라이언트가 dummy 값으로도 기동되는 것과 같은 계약이다.
 */
class OciObjectStorageClientTest {

  private static final OciProperties DUMMY_PROPERTIES =
      new OciProperties("dummy", "dummy", "dummy", "dummy", "ap-chuncheon-1", "dummy", "dummy");

  @Test
  void 더미_설정값으로도_생성자가_예외를_던지지_않는다() {
    assertThatCode(() -> new OciObjectStorageClient(DUMMY_PROPERTIES)).doesNotThrowAnyException();
  }
}

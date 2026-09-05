package com.kaldinote.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.Properties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.info.Info;
import org.springframework.boot.info.BuildProperties;

/** 배포된 버전 노출 — docs/specs/2026-09-05-build-info.md */
class BuildInfoContributorTest {

  @Test
  @DisplayName("AC-BUILDINFO-04 · 주입한 sha가 그대로 나온다")
  void 주입한_sha가_그대로_나온다() {
    Properties properties = new Properties();
    properties.setProperty("commit", "0123456789abcdef0123456789abcdef01234567");
    // BuildProperties는 time을 epoch 밀리초로 읽는다. 없으면 getTime()이 null이라 NPE가 난다.
    properties.setProperty("time", "1757062353000");

    Info.Builder builder = new Info.Builder();
    new BuildInfoContributor(new BuildProperties(properties)).contribute(builder);

    @SuppressWarnings("unchecked")
    Map<String, Object> build = (Map<String, Object>) builder.build().getDetails().get("build");
    assertThat(build.get("commit")).isEqualTo("0123456789abcdef0123456789abcdef01234567");
  }
}

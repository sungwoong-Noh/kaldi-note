package com.kaldinote.common.config;

import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.actuate.info.Info;
import org.springframework.boot.actuate.info.InfoContributor;
import org.springframework.boot.info.BuildProperties;
import org.springframework.stereotype.Component;

/**
 * 실행 중인 jar이 어느 커밋에서 나왔는지를 알린다 — docs/specs/2026-09-05-build-info.md
 *
 * <p>deploy.sh가 배포 직후 이 값을 방금 배포한 sha와 대조한다. 헬스체크만으로는 구 컨테이너가 그대로 살아 있어도 배포가 성공으로 기록된다.
 *
 * <p>기본 build 기여자를 끄고(application.yml) 직접 만드는 이유는 그쪽이 artifact·group·version까지 내보내기 때문이다. 공개 엔드포인트라
 * 필요한 둘만 낸다.
 */
@Component
public class BuildInfoContributor implements InfoContributor {

  private final BuildProperties buildProperties;

  public BuildInfoContributor(BuildProperties buildProperties) {
    this.buildProperties = buildProperties;
  }

  @Override
  public void contribute(Info.Builder builder) {
    Map<String, Object> build = new LinkedHashMap<>();
    build.put("commit", buildProperties.get("commit"));
    build.put("time", DateTimeFormatter.ISO_INSTANT.format(buildProperties.getTime()));
    builder.withDetail("build", build);
  }
}

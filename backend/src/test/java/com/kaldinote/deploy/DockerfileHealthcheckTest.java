package com.kaldinote.deploy;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.File;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.ImageFromDockerfile;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

class DockerfileHealthcheckTest {

  private static final File DOCKERFILE_CONTEXT = new File(System.getProperty("user.dir"));

  @Test
  @DisplayName("AC-DEPLOY-01 · Dockerfile이 빌드에 성공한다")
  void Dockerfile이_빌드에_성공한다() {
    ImageFromDockerfile image =
        new ImageFromDockerfile().withDockerfile(DOCKERFILE_CONTEXT.toPath().resolve("Dockerfile"));

    assertThat(image.get()).isNotBlank();
  }

  @Test
  @DisplayName("AC-DEPLOY-02 · 컨테이너 기동 후 60초 이내에 헬스체크가 통과한다")
  void 컨테이너_기동_60초_이내_헬스체크가_통과한다() {
    try (Network network = Network.newNetwork();
        PostgreSQLContainer postgres =
            new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"))
                .withNetwork(network)
                .withNetworkAliases("postgres")
                .withDatabaseName("kaldinote")
                .withUsername("kaldinote")
                .withPassword("localdev")) {
      postgres.start();

      ImageFromDockerfile image =
          new ImageFromDockerfile()
              .withDockerfile(DOCKERFILE_CONTEXT.toPath().resolve("Dockerfile"));

      try (GenericContainer<?> app =
          new GenericContainer<>(image)
              .withNetwork(network)
              .withExposedPorts(8080)
              .withEnv("SPRING_DATASOURCE_URL", "jdbc:postgresql://postgres:5432/kaldinote")
              .withEnv("SPRING_DATASOURCE_USERNAME", "kaldinote")
              .withEnv("SPRING_DATASOURCE_PASSWORD", "localdev")
              .withEnv("KALDI_JWT_SECRET", "local-development-only-secret-key-32bytes-minimum")
              .withEnv("KAKAO_CLIENT_ID", "dummy")
              .withEnv("GOOGLE_CLIENT_ID", "dummy")
              .withEnv("GOOGLE_CLIENT_SECRET", "dummy")
              .waitingFor(
                  Wait.forHttp("/actuator/health")
                      .forStatusCode(200)
                      .forResponsePredicate(body -> body.contains("\"status\":\"UP\""))
                      .withStartupTimeout(Duration.ofSeconds(60)))) {
        app.start();

        assertThat(app.isRunning()).isTrue();
      }
    }
  }
}

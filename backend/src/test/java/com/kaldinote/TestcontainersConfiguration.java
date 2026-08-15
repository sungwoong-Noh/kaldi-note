package com.kaldinote;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * 통합 테스트용 PostgreSQL 컨테이너. H2를 쓰지 않는 이유: JSONB·방언 차이로 통합 테스트가 거짓 통과한다. static 필드로 두어 전체 테스트 실행 동안
 * 컨테이너 하나를 재사용한다.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

  @Bean
  @ServiceConnection
  PostgreSQLContainer postgresContainer() {
    return new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine")).withReuse(true);
  }
}

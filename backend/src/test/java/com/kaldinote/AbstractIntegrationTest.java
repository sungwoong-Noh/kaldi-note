package com.kaldinote;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** 모든 통합 테스트의 베이스. Postgres 컨테이너 + MockMvc를 제공한다. 컨테이너 기동 비용이 크므로 테스트 컨텍스트가 캐시되도록 설정을 통일한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {

  @Autowired protected MockMvc mockMvc;
}

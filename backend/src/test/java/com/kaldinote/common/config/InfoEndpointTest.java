package com.kaldinote.common.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 배포된 버전 노출 — docs/specs/2026-09-05-build-info.md */
class InfoEndpointTest extends AbstractIntegrationTest {

  @Test
  @DisplayName("AC-BUILDINFO-01 · sha를 주입하지 않으면 unknown이다")
  void sha를_주입하지_않으면_unknown이다() throws Exception {
    mockMvc.perform(get("/actuator/info")).andExpect(jsonPath("$.build.commit").value("unknown"));
  }

  @Test
  @DisplayName("AC-BUILDINFO-02 · 빌드 시각이 ISO-8601 UTC다")
  void 빌드_시각이_ISO8601_UTC다() throws Exception {
    mockMvc
        .perform(get("/actuator/info"))
        .andExpect(
            jsonPath("$.build.time")
                .value(
                    Matchers.matchesPattern(
                        "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$")));
  }

  @Test
  @DisplayName("AC-BUILDINFO-03 · 필요 없는 필드를 내보내지 않는다")
  void 필요_없는_필드를_내보내지_않는다() throws Exception {
    mockMvc
        .perform(get("/actuator/info"))
        .andExpect(jsonPath("$.build.artifact").doesNotExist())
        .andExpect(jsonPath("$.build.group").doesNotExist())
        .andExpect(jsonPath("$.build.version").doesNotExist());
  }

  @Test
  @DisplayName("AC-BUILDINFO-05 · /actuator/info는 인증 없이 열린다")
  void info는_인증_없이_열린다() throws Exception {
    mockMvc.perform(get("/actuator/info")).andExpect(status().isOk());
  }
}

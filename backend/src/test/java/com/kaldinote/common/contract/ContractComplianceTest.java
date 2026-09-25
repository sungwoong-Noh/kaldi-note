package com.kaldinote.common.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.kaldinote.AbstractIntegrationTest;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * docs/contracts/*.json(계약)이 실제 API와 어긋나지 않는지 본다.
 *
 * <p>계약과 같은 이름의 스펙(docs/specs/<같은 이름>.md)의 status가 구현완료일 때만 검사한다 — check-spec-coverage.sh와 같은 게이팅
 * 패턴이다. 아직 구현 전인 계약(status: 승인 등)은 비교할 실제 API가 없으므로 건너뛴다. 규칙: docs/contracts/README.md
 */
class ContractComplianceTest extends AbstractIntegrationTest {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @Test
  @DisplayName("구현완료 스펙의 계약은 실제 /v3/api-docs와 경로·메서드가 일치한다")
  void 계약이_구현완료_스펙에서_강제된다() throws Exception {
    Path contractsDir = repoPath("docs/contracts");
    if (!Files.isDirectory(contractsDir)) {
      return;
    }

    List<String> violations = new ArrayList<>();
    JsonNode apiDocs = null;

    for (Path contractFile : listJsonFiles(contractsDir)) {
      String baseName = contractFile.getFileName().toString().replaceFirst("\\.json$", "");
      Path specFile = repoPath("docs/specs/" + baseName + ".md");
      String status = readFrontmatterField(specFile, "status");

      if (!"구현완료".equals(status)) {
        continue;
      }
      if (apiDocs == null) {
        apiDocs = fetchApiDocs();
      }

      JsonNode contract = MAPPER.readTree(contractFile);
      violations.addAll(
          diffAgainstApiDocs(contractFile.getFileName().toString(), contract, apiDocs));
    }

    assertThat(violations).as("계약과 실제 API의 불일치").isEmpty();
  }

  private JsonNode fetchApiDocs() throws Exception {
    String body =
        mockMvc
            .perform(get("/v3/api-docs"))
            .andReturn()
            .getResponse()
            .getContentAsString(StandardCharsets.UTF_8);
    return MAPPER.readTree(body);
  }

  private List<String> diffAgainstApiDocs(
      String contractName, JsonNode contract, JsonNode apiDocs) {
    List<String> violations = new ArrayList<>();
    JsonNode contractPaths = contract.path("paths");
    JsonNode actualPaths = apiDocs.path("paths");

    for (Map.Entry<String, JsonNode> pathEntry : contractPaths.properties()) {
      String path = pathEntry.getKey();
      JsonNode actualMethods = actualPaths.path(path);

      if (actualMethods.isMissingNode()) {
        violations.add(contractName + ": 경로 " + path + "가 실제 API에 없다");
        continue;
      }

      for (String method : pathEntry.getValue().propertyNames()) {
        if (actualMethods.path(method).isMissingNode()) {
          violations.add(contractName + ": " + method.toUpperCase() + " " + path + "가 실제 API에 없다");
        }
      }
    }
    return violations;
  }

  private static List<Path> listJsonFiles(Path dir) throws IOException {
    try (var files = Files.list(dir)) {
      return files.filter(p -> p.toString().endsWith(".json")).sorted().toList();
    }
  }

  private static String readFrontmatterField(Path specFile, String field) {
    if (!Files.exists(specFile)) {
      return null;
    }
    try {
      for (String line : Files.readAllLines(specFile, StandardCharsets.UTF_8)) {
        if (line.startsWith(field + ":")) {
          return line.substring(field.length() + 1).trim();
        }
      }
    } catch (IOException e) {
      return null;
    }
    return null;
  }

  /** 테스트 실행 디렉터리가 backend/든 저장소 루트든 상관없이 저장소 루트 기준 경로를 찾는다. */
  private static Path repoPath(String relative) {
    Path fromCwd = Path.of(relative);
    if (Files.exists(fromCwd)) {
      return fromCwd;
    }
    return Path.of("..").resolve(relative);
  }
}

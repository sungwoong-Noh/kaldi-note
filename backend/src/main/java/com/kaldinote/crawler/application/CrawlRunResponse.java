package com.kaldinote.crawler.application;

import com.kaldinote.crawler.domain.CrawlRun;
import com.kaldinote.crawler.domain.CrawlRunStatus;
import com.kaldinote.crawler.domain.ImportedItem;
import com.kaldinote.crawler.domain.SkippedItem;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public record CrawlRunResponse(
    Long id,
    String source,
    CrawlRunStatus status,
    Instant startedAt,
    Instant finishedAt,
    int created,
    int updated,
    int unchanged,
    List<ImportedItem> imported,
    List<SkippedItem> skipped,
    List<Unmapped> unmapped,
    String errorMessage) {

  /**
   * 매핑하지 못한 원문 + 그 원두(이름이 하나로 맞을 때만, 아니면 키가 빠진다 — 화면 「카탈로그에 없음」). 저장 형식(UnmappedItem)은 그대로 두고 응답에서만
   * 붙인다.
   */
  public record Unmapped(String name, String field, String raw, Long beanProductId) {}

  public static CrawlRunResponse from(CrawlRun run) {
    return from(run, Map.of());
  }

  public static CrawlRunResponse from(CrawlRun run, Map<String, Long> beanIdsByName) {
    return new CrawlRunResponse(
        run.getId(),
        run.getSource(),
        run.getStatus(),
        run.getStartedAt(),
        run.getFinishedAt(),
        run.getCreatedCount(),
        run.getUpdatedCount(),
        run.getUnchangedCount(),
        List.copyOf(run.getImported()),
        List.copyOf(run.getSkipped()),
        run.getUnmapped().stream()
            .map(u -> new Unmapped(u.name(), u.field(), u.raw(), beanIdsByName.get(u.name())))
            .toList(),
        run.getErrorMessage());
  }
}

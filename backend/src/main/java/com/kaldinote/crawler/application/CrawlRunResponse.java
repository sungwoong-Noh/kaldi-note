package com.kaldinote.crawler.application;

import com.kaldinote.crawler.domain.CrawlRun;
import com.kaldinote.crawler.domain.CrawlRunStatus;
import com.kaldinote.crawler.domain.SkippedItem;
import com.kaldinote.crawler.domain.UnmappedItem;
import java.time.Instant;
import java.util.List;

public record CrawlRunResponse(
    Long id,
    String source,
    CrawlRunStatus status,
    Instant startedAt,
    Instant finishedAt,
    int created,
    int updated,
    List<SkippedItem> skipped,
    List<UnmappedItem> unmapped,
    String errorMessage) {

  public static CrawlRunResponse from(CrawlRun run) {
    return new CrawlRunResponse(
        run.getId(),
        run.getSource(),
        run.getStatus(),
        run.getStartedAt(),
        run.getFinishedAt(),
        run.getCreatedCount(),
        run.getUpdatedCount(),
        List.copyOf(run.getSkipped()),
        List.copyOf(run.getUnmapped()),
        run.getErrorMessage());
  }
}

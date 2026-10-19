package com.kaldinote.crawler.application;

import com.kaldinote.crawler.domain.CrawlRun;
import com.kaldinote.crawler.domain.CrawlRunStatus;
import java.time.Instant;

public record CrawlSourceResponse(String key, String name, String listUrl, LastRun lastRun) {

  public record LastRun(Long id, CrawlRunStatus status, Instant startedAt, Instant finishedAt) {

    static LastRun from(CrawlRun run) {
      return new LastRun(run.getId(), run.getStatus(), run.getStartedAt(), run.getFinishedAt());
    }
  }
}

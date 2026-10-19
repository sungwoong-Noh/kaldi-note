package com.kaldinote.crawler.domain;

public enum CrawlRunStatus {
  RUNNING,
  SUCCEEDED,
  FAILED,
  /** 실행 중에 앱이 내려갔다. */
  INTERRUPTED
}

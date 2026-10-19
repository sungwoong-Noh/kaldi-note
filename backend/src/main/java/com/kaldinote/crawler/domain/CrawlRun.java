package com.kaldinote.crawler.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 소스 하나를 한 번 수집한 기록. */
@Entity
@Table(name = "crawl_runs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CrawlRun {

  private static final int ERROR_MAX = 500;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 50)
  private String source;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private CrawlRunStatus status;

  @Column(name = "triggered_by_user_id")
  private Long triggeredByUserId;

  @Column(name = "started_at", nullable = false)
  private Instant startedAt;

  @Column(name = "finished_at")
  private Instant finishedAt;

  @Column(name = "created_count", nullable = false)
  private int createdCount;

  @Column(name = "updated_count", nullable = false)
  private int updatedCount;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<SkippedItem> skipped = new ArrayList<>();

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(nullable = false, columnDefinition = "jsonb")
  private List<UnmappedItem> unmapped = new ArrayList<>();

  @Column(name = "error_message", length = ERROR_MAX)
  private String errorMessage;

  public static CrawlRun start(String source, Long userId, Instant now) {
    CrawlRun run = new CrawlRun();
    run.source = source;
    run.status = CrawlRunStatus.RUNNING;
    run.triggeredByUserId = userId;
    run.startedAt = now;
    return run;
  }

  public void succeed(
      int created,
      int updated,
      List<SkippedItem> skipped,
      List<UnmappedItem> unmapped,
      Instant now) {
    this.status = CrawlRunStatus.SUCCEEDED;
    this.createdCount = created;
    this.updatedCount = updated;
    this.skipped = new ArrayList<>(skipped);
    this.unmapped = new ArrayList<>(unmapped);
    this.finishedAt = now;
  }

  public void fail(String message, Instant now) {
    this.status = CrawlRunStatus.FAILED;
    this.errorMessage =
        message == null || message.length() <= ERROR_MAX
            ? message
            : message.substring(0, ERROR_MAX);
    this.finishedAt = now;
  }

  public void interrupt(Instant now) {
    this.status = CrawlRunStatus.INTERRUPTED;
    this.finishedAt = now;
  }
}

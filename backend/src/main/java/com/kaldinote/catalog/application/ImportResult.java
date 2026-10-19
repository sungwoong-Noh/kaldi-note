package com.kaldinote.catalog.application;

import java.util.List;

/** 크롤링한 원두 하나를 가져온 결과. */
public record ImportResult(Outcome outcome, String reason, List<Unmapped> unmapped) {

  public enum Outcome {
    CREATED,
    UPDATED,
    SKIPPED
  }

  /** 원문은 있는데 마스터 데이터·enum에 매핑하지 못한 필드. field는 roastLevel/variety/process. */
  public record Unmapped(String field, String raw) {}

  static ImportResult skipped(String reason) {
    return new ImportResult(Outcome.SKIPPED, reason, List.of());
  }
}

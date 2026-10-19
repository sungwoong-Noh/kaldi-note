package com.kaldinote.crawler.infrastructure;

import com.kaldinote.crawler.domain.MasterNames;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** 2026-10-14에 받은 실제 응답 픽스처(src/test/resources/fixtures/crawler). */
public final class CrawlerFixtures {

  /** V3 시드 중 파서 테스트에 필요한 이름만. */
  public static final MasterNames SEED_NAMES =
      new MasterNames(
          List.of("Geisha", "게이샤", "Pacamara", "파카마라"),
          List.of("Natural", "내추럴", "Anaerobic Natural", "무산소 내추럴", "Washed", "워시드"));

  private CrawlerFixtures() {}

  public static String read(String name) {
    try (var in = CrawlerFixtures.class.getResourceAsStream("/fixtures/crawler/" + name)) {
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}

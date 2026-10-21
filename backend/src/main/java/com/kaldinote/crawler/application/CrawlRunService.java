package com.kaldinote.crawler.application;

import com.kaldinote.catalog.application.BeanImportService;
import com.kaldinote.catalog.application.ImportResult;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.common.response.PageParams;
import com.kaldinote.common.response.PageResponse;
import com.kaldinote.crawler.domain.BeanSource;
import com.kaldinote.crawler.domain.CrawlRun;
import com.kaldinote.crawler.domain.CrawlRunStatus;
import com.kaldinote.crawler.domain.CrawledBean;
import com.kaldinote.crawler.domain.MasterNames;
import com.kaldinote.crawler.domain.SkippedItem;
import com.kaldinote.crawler.domain.UnmappedItem;
import com.kaldinote.crawler.infrastructure.CrawlRunRepository;
import com.kaldinote.crawler.infrastructure.PageFetcher;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Executor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/**
 * 소스 하나를 수집한다. start()는 실행 기록(RUNNING)만 남기고 바로 돌아가며, 실제 수집은 crawlExecutor에서 돈다. 상품 하나의 실패는 skipped로
 * 남기고 계속 간다. 주기 실행을 붙일 때는 @Scheduled가 start()를 부르면 된다.
 */
@Slf4j
@Service
public class CrawlRunService {

  static final Duration DELAY = Duration.ofMillis(1000);

  private final List<BeanSource> sources;
  private final CrawlRunRepository runRepository;
  private final BeanImportService importService;
  private final PageFetcher fetcher;
  private final Executor executor;
  private final Sleeper sleeper;

  public CrawlRunService(
      List<BeanSource> sources,
      CrawlRunRepository runRepository,
      BeanImportService importService,
      PageFetcher fetcher,
      @Qualifier("crawlExecutor") Executor executor,
      Sleeper sleeper) {
    this.sources = sources;
    this.runRepository = runRepository;
    this.importService = importService;
    this.fetcher = fetcher;
    this.executor = executor;
    this.sleeper = sleeper;
  }

  public List<CrawlSourceResponse> sources() {
    return sources.stream()
        .map(
            s ->
                new CrawlSourceResponse(
                    s.key(),
                    s.name(),
                    s.listUrl().toString(),
                    runRepository
                        .findFirstBySourceOrderByStartedAtDesc(s.key())
                        .map(CrawlSourceResponse.LastRun::from)
                        .orElse(null)))
        .toList();
  }

  public PageResponse<CrawlRunResponse> runs(String source, PageParams params) {
    Pageable pageable = params.toPageable(Sort.unsorted());
    Page<CrawlRun> page =
        source == null
            ? runRepository.findAllByOrderByStartedAtDesc(pageable)
            : runRepository.findBySourceOrderByStartedAtDesc(source, pageable);
    return PageResponse.from(page, CrawlRunResponse::from);
  }

  public CrawlRunResponse run(Long id) {
    return runRepository
        .findById(id)
        .map(CrawlRunResponse::from)
        .orElseThrow(() -> new BusinessException(ErrorCode.CRAWL_RUN_NOT_FOUND));
  }

  public CrawlRunResponse start(String key, Long userId) {
    BeanSource source =
        sources.stream()
            .filter(s -> s.key().equals(key))
            .findFirst()
            .orElseThrow(() -> new BusinessException(ErrorCode.CRAWL_SOURCE_NOT_FOUND));
    if (runRepository.existsBySourceAndStatus(key, CrawlRunStatus.RUNNING)) {
      throw new BusinessException(ErrorCode.CRAWL_ALREADY_RUNNING);
    }
    CrawlRun run;
    try {
      run = runRepository.saveAndFlush(CrawlRun.start(key, userId, Instant.now()));
    } catch (DataIntegrityViolationException e) { // 사전 검사를 동시에 통과한 요청
      throw new BusinessException(ErrorCode.CRAWL_ALREADY_RUNNING);
    }
    CrawlRunResponse started = CrawlRunResponse.from(run);
    Long runId = run.getId();
    executor.execute(() -> crawl(runId, source));
    return started;
  }

  @EventListener(ApplicationReadyEvent.class)
  public void interruptLeftovers() {
    for (CrawlRun run : runRepository.findByStatus(CrawlRunStatus.RUNNING)) {
      run.interrupt(Instant.now());
      runRepository.save(run);
    }
  }

  private void crawl(Long runId, BeanSource source) {
    CrawlRun run = runRepository.findById(runId).orElseThrow();
    List<URI> urls;
    try {
      urls = source.parseList(fetcher.get(source.listUrl()));
    } catch (RuntimeException e) {
      log.warn("crawl list failed source={}", source.key(), e);
      run.fail("목록 요청 실패: " + e.getMessage(), Instant.now());
      runRepository.save(run);
      return;
    }
    // 사이트 구조가 바뀌면 예외 없이 0건이 된다 — 조용한 성공으로 두지 않는다 (AC-CRAWL-37·38)
    if (urls.isEmpty()) {
      run.fail("목록에서 상품 링크를 찾지 못했습니다", Instant.now());
      runRepository.save(run);
      return;
    }

    MasterNames names = importService.masterNames();
    int created = 0;
    int updated = 0;
    List<SkippedItem> skipped = new ArrayList<>();
    List<UnmappedItem> unmapped = new ArrayList<>();
    for (URI url : urls) {
      sleeper.sleep(DELAY);
      String body;
      try {
        body = fetcher.get(url);
      } catch (RuntimeException e) {
        skipped.add(new SkippedItem(url.toString(), "FETCH_FAILED"));
        continue;
      }
      Optional<CrawledBean> bean;
      try {
        bean = source.parseDetail(url, body, names);
      } catch (RuntimeException e) {
        skipped.add(new SkippedItem(url.toString(), "PARSE_FAILED"));
        continue;
      }
      if (bean.isEmpty()) {
        continue; // 원두가 아닌 상품
      }
      String name = bean.get().name();
      ImportResult result;
      try {
        result = importService.importBean(bean.get());
      } catch (RuntimeException e) {
        log.warn("crawl import failed url={}", url, e);
        skipped.add(new SkippedItem(name, "PARSE_FAILED"));
        continue;
      }
      switch (result.outcome()) {
        case CREATED -> created++;
        case UPDATED -> updated++;
        case SKIPPED -> skipped.add(new SkippedItem(name, result.reason()));
      }
      result.unmapped().forEach(u -> unmapped.add(new UnmappedItem(name, u.field(), u.raw())));
    }
    if (created + updated + skipped.size() == 0) {
      run.fail("원두로 인식한 상품이 없습니다 (상품 " + urls.size() + "개)", Instant.now());
      runRepository.save(run);
      return;
    }
    run.succeed(created, updated, skipped, unmapped, Instant.now());
    runRepository.save(run);
  }
}

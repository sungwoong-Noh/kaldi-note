package com.kaldinote.crawler.infrastructure;

import com.kaldinote.crawler.domain.CrawlRun;
import com.kaldinote.crawler.domain.CrawlRunStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CrawlRunRepository extends JpaRepository<CrawlRun, Long> {

  boolean existsBySourceAndStatus(String source, CrawlRunStatus status);

  List<CrawlRun> findByStatus(CrawlRunStatus status);

  Optional<CrawlRun> findFirstBySourceOrderByStartedAtDesc(String source);

  Page<CrawlRun> findBySourceOrderByStartedAtDesc(String source, Pageable pageable);

  Page<CrawlRun> findAllByOrderByStartedAtDesc(Pageable pageable);
}

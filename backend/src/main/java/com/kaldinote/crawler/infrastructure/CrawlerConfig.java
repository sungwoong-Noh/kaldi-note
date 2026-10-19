package com.kaldinote.crawler.infrastructure;

import com.kaldinote.crawler.application.Sleeper;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CrawlerConfig {

  /**
   * 수집은 한 번에 하나씩. 데몬 스레드라 앱 종료를 붙잡지 않는다 — 도중에 끊긴 실행은 다음 기동 때 INTERRUPTED가 된다. 테스트 프로필은 async=false로
   * 호출 스레드에서 바로 돌린다.
   */
  @Bean(destroyMethod = "")
  public Executor crawlExecutor(@Value("${kaldi.crawler.async:true}") boolean async) {
    if (!async) {
      return Runnable::run;
    }
    return Executors.newSingleThreadExecutor(
        r -> {
          Thread t = new Thread(r, "crawl");
          t.setDaemon(true);
          return t;
        });
  }

  /** 테스트 프로필은 sleep=false로 실제로 자지 않는다. */
  @Bean
  public Sleeper crawlSleeper(@Value("${kaldi.crawler.sleep:true}") boolean sleep) {
    return sleep
        ? duration -> {
          try {
            Thread.sleep(duration);
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
          }
        }
        : duration -> {};
  }
}

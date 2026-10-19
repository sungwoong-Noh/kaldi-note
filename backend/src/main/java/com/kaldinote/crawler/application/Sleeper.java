package com.kaldinote.crawler.application;

import java.time.Duration;

/** 요청 사이 대기. 테스트에서 실제로 자지 않고 호출만 기록하려고 주입한다. */
@FunctionalInterface
public interface Sleeper {
  void sleep(Duration duration);
}

package com.kaldinote.crawler.domain;

import java.util.List;

/**
 * 크롤러와 카탈로그의 경계. 사이트별 파서는 원문만 담아 넘기고, 표준값 매핑과 저장은 {@code BeanImportService}가 맡는다 — 크롤러를 별도 서버로 떼어도
 * 이 형태 그대로 HTTP로 보내면 된다.
 */
public record CrawledBean(
    String roasterName,
    String name,
    String productUrl,
    String roastLevelRaw,
    String cupNotes,
    List<CrawledOrigin> origins) {}

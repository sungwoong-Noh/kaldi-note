package com.kaldinote.crawler.domain;

/** 사이트에 적힌 그대로의 산지. 표준값 매핑은 가져오기(catalog)가 한다. 모르는 값은 null. */
public record CrawledOrigin(
    String country,
    String region,
    String farm,
    String altitudeRaw,
    String varietyRaw,
    String processRaw) {}

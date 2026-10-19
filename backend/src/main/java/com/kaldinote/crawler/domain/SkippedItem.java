package com.kaldinote.crawler.domain;

/** 건너뛴 상품. name은 상품명, 상품명을 모르면(요청 실패) URL. reason은 USER_OWNED/FETCH_FAILED/PARSE_FAILED. */
public record SkippedItem(String name, String reason) {}

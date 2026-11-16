package com.kaldinote.crawler.domain;

/** 수집 실행에서 생성·갱신한 원두. outcome은 CREATED 또는 UPDATED, name은 수집 시점 이름 그대로다. */
public record ImportedItem(Long beanProductId, String name, String outcome) {}

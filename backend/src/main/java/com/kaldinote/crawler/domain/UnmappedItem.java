package com.kaldinote.crawler.domain;

/** 원문은 있는데 마스터 데이터·enum에 매핑하지 못한 필드. 관리자가 마스터를 보강할 근거가 된다. */
public record UnmappedItem(String name, String field, String raw) {}

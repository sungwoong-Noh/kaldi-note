package com.kaldinote.crawler.domain;

import java.util.Collection;

/** 상품명에서 품종·가공을 떼어내야 하는 파서(모모스)가 쓰는 마스터 이름 목록(영문·한글 모두). */
public record MasterNames(Collection<String> varieties, Collection<String> processes) {}

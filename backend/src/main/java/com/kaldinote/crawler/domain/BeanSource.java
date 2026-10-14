package com.kaldinote.crawler.domain;

import java.net.URI;
import java.util.List;
import java.util.Optional;

/** 원두 구매처 하나. 사이트를 추가하려면 이 구현을 하나 더 만든다. */
public interface BeanSource {

  String key();

  String name();

  URI listUrl();

  /** 목록 응답 본문 → 상세 URL. */
  List<URI> parseList(String body);

  /** 상세 응답 본문 → 원두. 원두가 아닌 상품이면 empty. */
  Optional<CrawledBean> parseDetail(URI url, String body, MasterNames names);
}

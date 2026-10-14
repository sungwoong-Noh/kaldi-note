package com.kaldinote.crawler.infrastructure;

import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** 크롤 대상 페이지를 가져온다. 타임아웃 10s, User-Agent로 우리가 누군지 밝힌다. */
@Component
public class PageFetcher {

  private static final Duration TIMEOUT = Duration.ofSeconds(10);
  private static final String USER_AGENT = "kaldi-note-crawler/1.0";

  private final RestClient restClient;

  @Autowired
  public PageFetcher(RestClient.Builder builder) {
    this(builder.requestFactory(requestFactory()).defaultHeader("User-Agent", USER_AGENT).build());
  }

  /** 테스트에서 MockRestServiceServer가 바인딩된 RestClient를 넘기기 위한 생성자. */
  public PageFetcher(RestClient restClient) {
    this.restClient = restClient;
  }

  // ponytail: 본문을 UTF-8로 고정 — 지금 두 사이트 모두 UTF-8. 다른 인코딩 사이트가 생기면 Content-Type charset을 읽는다.
  public String get(URI uri) {
    byte[] body =
        restClient.get().uri(URI.create(uri.toASCIIString())).retrieve().body(byte[].class);
    return body == null ? "" : new String(body, StandardCharsets.UTF_8);
  }

  private static JdkClientHttpRequestFactory requestFactory() {
    HttpClient client =
        HttpClient.newBuilder()
            .connectTimeout(TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(client);
    factory.setReadTimeout(TIMEOUT);
    return factory;
  }
}

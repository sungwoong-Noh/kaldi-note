package com.kaldinote.crawler.infrastructure;

import static java.nio.charset.StandardCharsets.UTF_8;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/** 크롤 대상 페이지를 가져온다. 타임아웃 10s, User-Agent로 우리가 누군지 밝힌다. */
@Component
public class PageFetcher {

  private static final Duration TIMEOUT = Duration.ofSeconds(10);
  private static final String USER_AGENT = "kaldi-note-crawler/1.0";

  public record RelaySettings(String url, String token, List<String> hosts) {
    static final RelaySettings NONE = new RelaySettings("", "", List.of());
  }

  private final RestClient restClient;
  private final RelaySettings relay;

  @Autowired
  public PageFetcher(
      RestClient.Builder builder,
      @Value("${kaldi.crawler.relay.url:}") String relayUrl,
      @Value("${kaldi.crawler.relay.token:}") String relayToken,
      @Value("${kaldi.crawler.relay.hosts:}") List<String> relayHosts) {
    this(
        builder.requestFactory(requestFactory()).build(),
        new RelaySettings(relayUrl, relayToken, relayHosts));
  }

  /** 테스트에서 MockRestServiceServer가 바인딩된 RestClient를 넘기기 위한 생성자. */
  public PageFetcher(RestClient restClient) {
    this(restClient, RelaySettings.NONE);
  }

  public PageFetcher(RestClient restClient, RelaySettings relay) {
    this.restClient = restClient;
    this.relay = relay;
  }

  // ponytail: 본문을 UTF-8로 고정 — 지금 두 사이트 모두 UTF-8. 다른 인코딩 사이트가 생기면 Content-Type charset을 읽는다.
  public String get(URI uri) {
    URI target = URI.create(uri.toASCIIString());
    boolean viaRelay = relay.hosts().stream().anyMatch(h -> h.equalsIgnoreCase(uri.getHost()));
    if (viaRelay) {
      if (relay.url().isBlank() || relay.token().isBlank()) {
        throw new IllegalStateException("중계 설정 없음: " + uri.getHost().toLowerCase());
      }
      target =
          UriComponentsBuilder.fromUriString(relay.url())
              .queryParam("url", URLEncoder.encode(uri.toASCIIString(), UTF_8))
              .build(true)
              .toUri();
    }
    RestClient.RequestHeadersSpec<?> request =
        restClient.get().uri(target).header("User-Agent", USER_AGENT);
    if (viaRelay) {
      request = request.header("X-Relay-Token", relay.token());
    }
    byte[] body = request.retrieve().body(byte[].class);
    return body == null ? "" : new String(body, UTF_8);
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

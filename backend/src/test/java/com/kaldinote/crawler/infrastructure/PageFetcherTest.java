package com.kaldinote.crawler.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.headerDoesNotExist;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.kaldinote.crawler.infrastructure.PageFetcher.RelaySettings;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class PageFetcherTest {

  private static final RelaySettings RELAY =
      new RelaySettings("https://relay.test", "t0ken", List.of("momos.co.kr"));

  private RestClient.Builder builder;
  private MockRestServiceServer server;

  @BeforeEach
  void setUp() {
    builder = RestClient.builder();
    server = MockRestServiceServer.bindTo(builder).build();
  }

  @Test
  @DisplayName("AC-RELAY-04 · 중계 대상 호스트는 Worker로 보낸다")
  void 중계_대상_호스트는_Worker로_보낸다() {
    PageFetcher fetcher = new PageFetcher(builder.build(), RELAY);
    server
        .expect(requestTo("https://relay.test?url=https%3A%2F%2Fmomos.co.kr%2Fx"))
        .andExpect(method(HttpMethod.GET))
        .andExpect(header("X-Relay-Token", "t0ken"))
        .andExpect(header("User-Agent", "kaldi-note-crawler/1.0"))
        .andRespond(withSuccess("<html>relayed</html>", MediaType.TEXT_HTML));

    String body = fetcher.get(URI.create("https://momos.co.kr/x"));

    assertThat(body).isEqualTo("<html>relayed</html>");
    server.verify();
  }

  @Test
  @DisplayName("AC-RELAY-05 · 그 밖의 호스트는 직접 요청한다")
  void 그_밖의_호스트는_직접_요청한다() {
    PageFetcher fetcher = new PageFetcher(builder.build(), RELAY);
    server
        .expect(requestTo("https://unspecialty.com/sitemap.xml"))
        .andExpect(method(HttpMethod.GET))
        .andExpect(headerDoesNotExist("X-Relay-Token"))
        .andRespond(withSuccess("<urlset/>", MediaType.APPLICATION_XML));

    String body = fetcher.get(URI.create("https://unspecialty.com/sitemap.xml"));

    assertThat(body).isEqualTo("<urlset/>");
    server.verify();
  }

  @Test
  @DisplayName("AC-RELAY-13 · 백엔드 호스트 비교도 대소문자를 무시한다")
  void 백엔드_호스트_비교도_대소문자를_무시한다() {
    PageFetcher fetcher = new PageFetcher(builder.build(), RELAY);
    server
        .expect(requestTo("https://relay.test?url=https%3A%2F%2FMOMOS.co.kr%2Fx"))
        .andExpect(method(HttpMethod.GET))
        .andExpect(header("X-Relay-Token", "t0ken"))
        .andRespond(withSuccess("<html>ok</html>", MediaType.TEXT_HTML));

    String body = fetcher.get(URI.create("https://MOMOS.co.kr/x"));

    assertThat(body).isEqualTo("<html>ok</html>");
    server.verify();
  }

  @Test
  @DisplayName("AC-RELAY-26 · 중계 설정이 비어 있으면 예외")
  void 중계_설정이_비어_있으면_예외를_던진다() {
    PageFetcher emptyUrl =
        new PageFetcher(builder.build(), new RelaySettings("", "t0ken", List.of("momos.co.kr")));
    PageFetcher emptyToken =
        new PageFetcher(
            builder.build(), new RelaySettings("https://relay.test", "", List.of("momos.co.kr")));

    assertThatThrownBy(() -> emptyUrl.get(URI.create("https://momos.co.kr/x")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage("중계 설정 없음: momos.co.kr");
    assertThatThrownBy(() -> emptyToken.get(URI.create("https://momos.co.kr/x")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage("중계 설정 없음: momos.co.kr");
    server.verify();
  }
}

package com.kaldinote.auth.infrastructure.oauth;

import com.kaldinote.auth.domain.OAuthProvider;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class OAuthClientRegistry {

  private final Map<OAuthProvider, OAuthClient> clients;

  public OAuthClientRegistry(List<OAuthClient> clients) {
    this.clients =
        clients.stream().collect(Collectors.toMap(OAuthClient::provider, Function.identity()));
  }

  public OAuthClient get(OAuthProvider provider) {
    OAuthClient client = clients.get(provider);
    if (client == null) {
      throw new IllegalArgumentException("지원하지 않는 프로바이더입니다: " + provider);
    }
    return client;
  }
}

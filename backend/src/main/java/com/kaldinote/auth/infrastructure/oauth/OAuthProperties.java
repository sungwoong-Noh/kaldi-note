package com.kaldinote.auth.infrastructure.oauth;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "kaldi.oauth")
public record OAuthProperties(Registration kakao, Registration google) {

  public record Registration(
      String clientId,
      String clientSecret,
      String redirectUri,
      String tokenUri,
      String userInfoUri) {}
}

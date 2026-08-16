package com.kaldinote.auth.infrastructure.oauth;

import com.kaldinote.auth.application.OAuthUserProfile;
import com.kaldinote.auth.domain.OAuthProvider;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Slf4j
@Component
public class KakaoOAuthClient implements OAuthClient {

  private final RestClient restClient;
  private final OAuthProperties.Registration registration;

  @Autowired
  public KakaoOAuthClient(RestClient.Builder builder, OAuthProperties properties) {
    this(builder, properties.kakao());
  }

  /** 테스트에서 MockRestServiceServer가 바인딩된 builder를 넘기기 위한 생성자. */
  KakaoOAuthClient(RestClient.Builder builder, OAuthProperties.Registration registration) {
    this.restClient = builder.build();
    this.registration = registration;
  }

  @Override
  public OAuthProvider provider() {
    return OAuthProvider.KAKAO;
  }

  @Override
  public OAuthUserProfile fetchProfile(String authorizationCode) {
    String accessToken = exchangeToken(authorizationCode);
    return fetchUserInfo(accessToken);
  }

  private String exchangeToken(String code) {
    MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
    form.add("grant_type", "authorization_code");
    form.add("client_id", registration.clientId());
    form.add("redirect_uri", registration.redirectUri());
    form.add("code", code);
    if (registration.clientSecret() != null && !registration.clientSecret().isBlank()) {
      form.add("client_secret", registration.clientSecret());
    }

    try {
      Map<String, Object> body =
          restClient
              .post()
              .uri(registration.tokenUri())
              .contentType(MediaType.APPLICATION_FORM_URLENCODED)
              .body(form)
              .retrieve()
              .body(new ParameterizedTypeReference<>() {});
      Object token = body == null ? null : body.get("access_token");
      if (token == null) {
        throw new BusinessException(ErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED);
      }
      return token.toString();
    } catch (RestClientException e) {
      log.warn("카카오 토큰 교환 실패", e);
      throw new BusinessException(ErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED);
    }
  }

  @SuppressWarnings("unchecked")
  private OAuthUserProfile fetchUserInfo(String accessToken) {
    try {
      Map<String, Object> body =
          restClient
              .get()
              .uri(registration.userInfoUri())
              .header("Authorization", "Bearer " + accessToken)
              .retrieve()
              .body(new ParameterizedTypeReference<>() {});
      if (body == null || body.get("id") == null) {
        throw new BusinessException(ErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED);
      }

      Map<String, Object> account =
          (Map<String, Object>) body.getOrDefault("kakao_account", Map.of());
      Map<String, Object> profile = (Map<String, Object>) account.getOrDefault("profile", Map.of());

      return new OAuthUserProfile(
          OAuthProvider.KAKAO,
          String.valueOf(body.get("id")),
          (String) account.get("email"), // 선택 동의 항목이라 null일 수 있다
          (String) profile.getOrDefault("nickname", "커피러버"),
          (String) profile.get("profile_image_url"));
    } catch (RestClientException e) {
      log.warn("카카오 사용자 정보 조회 실패", e);
      throw new BusinessException(ErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED);
    }
  }
}

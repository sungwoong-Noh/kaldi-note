package com.kaldinote.auth.infrastructure.oauth;

import com.kaldinote.auth.application.OAuthUserProfile;
import com.kaldinote.auth.domain.OAuthProvider;

public interface OAuthClient {

  OAuthProvider provider();

  /** 인가코드를 액세스 토큰으로 교환한 뒤 사용자 정보를 조회한다. */
  OAuthUserProfile fetchProfile(String authorizationCode);
}

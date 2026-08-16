package com.kaldinote.auth.application;

import com.kaldinote.auth.domain.OAuthProvider;
import com.kaldinote.auth.domain.RefreshToken;
import com.kaldinote.auth.domain.UserOAuthAccount;
import com.kaldinote.auth.infrastructure.RefreshTokenRepository;
import com.kaldinote.auth.infrastructure.UserOAuthAccountRepository;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.auth.infrastructure.oauth.OAuthClientRegistry;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

  private final OAuthClientRegistry registry;
  private final JwtTokenProvider tokenProvider;
  private final UserRepository userRepository;
  private final UserOAuthAccountRepository oauthAccountRepository;
  private final RefreshTokenRepository refreshTokenRepository;

  @Transactional
  public LoginResult login(OAuthProvider provider, String authorizationCode) {
    OAuthUserProfile profile = registry.get(provider).fetchProfile(authorizationCode);

    Optional<UserOAuthAccount> existing =
        oauthAccountRepository.findByProviderAndProviderUserId(provider, profile.providerUserId());

    boolean newUser = existing.isEmpty();
    User user;
    if (newUser) {
      user =
          userRepository.save(
              User.create(profile.email(), profile.nickname(), profile.profileImageUrl()));
      oauthAccountRepository.save(
          UserOAuthAccount.of(user.getId(), provider, profile.providerUserId()));
    } else {
      user =
          userRepository
              .findById(existing.get().getUserId())
              .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    return new LoginResult(issueTokens(user), user.getId(), user.getNickname(), newUser);
  }

  // 재사용 감지로 전체 토큰을 폐기한 뒤 예외를 던져도, 그 폐기 자체는 커밋돼야 한다.
  @Transactional(noRollbackFor = BusinessException.class)
  public TokenPair refresh(String refreshToken) {
    Long userId;
    try {
      userId = tokenProvider.parseUserId(refreshToken); // 서명·만료 검증 포함
    } catch (JwtException e) {
      throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID);
    }

    RefreshToken stored =
        refreshTokenRepository
            .findByTokenHash(hash(refreshToken))
            .orElseThrow(() -> new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID));

    // 재사용 감지: 이미 폐기된 토큰이 왔다면 탈취로 간주하고 전부 무효화한다
    if (stored.isRevoked()) {
      refreshTokenRepository.revokeAllByUserId(userId, Instant.now());
      throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID);
    }
    if (stored.isExpired()) {
      throw new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID);
    }

    stored.revoke();
    User user =
        userRepository
            .findById(userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID));
    return issueTokens(user); // 역할은 DB에서 다시 읽는다
  }

  @Transactional
  public void logout(String refreshToken) {
    refreshTokenRepository.findByTokenHash(hash(refreshToken)).ifPresent(RefreshToken::revoke);
  }

  private TokenPair issueTokens(User user) {
    String access = tokenProvider.createAccessToken(user.getId(), user.getRole());
    String refresh = tokenProvider.createRefreshToken(user.getId());
    refreshTokenRepository.save(
        RefreshToken.issue(
            user.getId(), hash(refresh), Instant.now().plus(tokenProvider.getRefreshTokenTtl())));
    return new TokenPair(access, refresh, tokenProvider.getAccessTokenTtl().toSeconds());
  }

  /** SHA-256 hex. 원문 토큰을 DB에 저장하지 않는다. */
  private String hash(String token) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}

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
import com.kaldinote.user.domain.UserRole;
import com.kaldinote.user.infrastructure.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
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

  /**
   * OAuth 없이 세션을 발급한다. <b>인증 우회다</b> — docs/specs/2026-09-05-test-login.md의 경고 상자를 읽는다.
   *
   * <p>호출자(AuthController)가 시크릿을 이미 검사했다. 이 메서드는 잠금을 다시 하지 않는다 — 문지기를 두 곳에 두면 한 곳만 고치는 사고가 난다.
   */
  @Transactional
  public LoginResult testLogin(Long userId, String handle, String nickname) {
    boolean byId = userId != null;
    boolean byHandle = handle != null && !handle.isBlank();
    if (byId == byHandle) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "userId와 handle 중 정확히 하나를 준다.");
    }

    boolean newUser = false;
    User user;
    if (byId) {
      user =
          userRepository
              .findById(userId)
              .orElseThrow(
                  () -> new BusinessException(ErrorCode.NOT_FOUND, "사용자를 찾을 수 없습니다: " + userId));
    } else {
      Optional<UserOAuthAccount> existing =
          oauthAccountRepository.findByProviderAndProviderUserId(OAuthProvider.TEST, handle);
      newUser = existing.isEmpty();
      if (newUser) {
        user = userRepository.save(User.create(null, nickname, null));
        oauthAccountRepository.save(UserOAuthAccount.of(user.getId(), OAuthProvider.TEST, handle));
      } else {
        user =
            userRepository
                .findById(existing.get().getUserId())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
      }
    }

    // 흔적을 남긴다. 이 줄이 없으면 누가 언제 무엇으로 들어왔는지 알 방법이 없다.
    log.warn("테스트 로그인으로 세션을 발급했다: userId={}", user.getId());

    return new LoginResult(issueTestTokens(user), user.getId(), user.getNickname(), newUser);
  }

  /**
   * 첫 access token의 role을 USER로 고정한다.
   *
   * <p><b>이것은 보안 경계가 아니다.</b> refresh가 역할을 DB에서 다시 읽으므로 한 번 갱신하면 진짜 역할이 실린다(AC-TESTLOGIN-05가 이 한계를
   * 못박는다).
   *
   * <p>issueTokens와 거의 같지만 합치지 않는다 — 역할 인자를 받는 하나로 만들면 OAuth 경로에서 실수로 USER를 넘길 수 있다.
   */
  private TokenPair issueTestTokens(User user) {
    String access = tokenProvider.createAccessToken(user.getId(), UserRole.USER);
    String refresh = tokenProvider.createRefreshToken(user.getId());
    refreshTokenRepository.save(
        RefreshToken.issue(
            user.getId(), hash(refresh), Instant.now().plus(tokenProvider.getRefreshTokenTtl())));
    return new TokenPair(access, refresh, tokenProvider.getAccessTokenTtl().toSeconds());
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

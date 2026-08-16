package com.kaldinote.auth.infrastructure;

import com.kaldinote.auth.domain.OAuthProvider;
import com.kaldinote.auth.domain.UserOAuthAccount;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserOAuthAccountRepository extends JpaRepository<UserOAuthAccount, Long> {

  Optional<UserOAuthAccount> findByProviderAndProviderUserId(
      OAuthProvider provider, String providerUserId);
}

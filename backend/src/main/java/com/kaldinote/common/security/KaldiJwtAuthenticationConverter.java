package com.kaldinote.common.security;

import java.util.List;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/** JWT의 role claim을 Spring Security 권한(ROLE_ 접두어)으로 변환한다. */
@Component
public class KaldiJwtAuthenticationConverter
    implements Converter<Jwt, AbstractAuthenticationToken> {

  @Override
  public AbstractAuthenticationToken convert(Jwt jwt) {
    String role = jwt.getClaimAsString("role");
    List<SimpleGrantedAuthority> authorities =
        role == null ? List.of() : List.of(new SimpleGrantedAuthority("ROLE_" + role));
    return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
  }
}

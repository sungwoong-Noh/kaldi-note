package com.kaldinote.common.security;

import com.kaldinote.user.domain.UserRole;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/** 컨트롤러 파라미터로 {@code AuthenticatedUser}를 직접 받게 해준다. JWT의 sub·role 클레임에서 만든다. */
public class AuthenticatedUserArgumentResolver implements HandlerMethodArgumentResolver {

  @Override
  public boolean supportsParameter(MethodParameter parameter) {
    return parameter.getParameterType().equals(AuthenticatedUser.class);
  }

  @Override
  public Object resolveArgument(
      MethodParameter parameter,
      ModelAndViewContainer mavContainer,
      NativeWebRequest webRequest,
      WebDataBinderFactory binderFactory) {
    var authentication = SecurityContextHolder.getContext().getAuthentication();
    if (!(authentication instanceof JwtAuthenticationToken jwtAuth)) {
      return null;
    }
    Long id = Long.valueOf(jwtAuth.getToken().getSubject());
    String roleClaim = jwtAuth.getToken().getClaimAsString("role");
    UserRole role = roleClaim == null ? null : UserRole.valueOf(roleClaim);
    return new AuthenticatedUser(id, role);
  }
}

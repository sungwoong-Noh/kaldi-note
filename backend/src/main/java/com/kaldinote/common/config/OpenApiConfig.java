package com.kaldinote.common.config;

import com.kaldinote.common.security.AuthenticatedUser;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

  static {
    // AuthenticatedUser는 AuthenticatedUserArgumentResolver가 JWT에서 채우는 값이다.
    // 등록하지 않으면 springdoc이 record 컴포넌트를 풀어 `user`라는 쿼리 파라미터로 노출하고,
    // Swagger UI에 사람이 채울 수 없는 입력란이 모든 인증 엔드포인트에 생긴다.
    // static 초기화인 이유: springdoc이 컨트롤러를 스캔하기 전에 반영돼야 한다.
    SpringDocUtils.getConfig().addRequestWrapperToIgnore(AuthenticatedUser.class);
  }

  @Bean
  public OpenAPI kaldiNoteOpenApi() {
    final String scheme = "bearerAuth";
    return new OpenAPI()
        .info(new Info().title("kaldi note API").version("v1").description("커피 레시피 공유 서비스 API"))
        .addSecurityItem(new SecurityRequirement().addList(scheme))
        .components(
            new Components()
                .addSecuritySchemes(
                    scheme,
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")));
  }
}

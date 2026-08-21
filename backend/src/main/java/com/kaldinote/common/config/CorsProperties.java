package com.kaldinote.common.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** 브라우저에서 백엔드를 직접 부르는 출처. 환경마다 다르며 운영 도메인은 프론트 배포 슬라이스에서 추가한다. */
@ConfigurationProperties(prefix = "kaldi.cors")
public record CorsProperties(List<String> allowedOrigins) {}

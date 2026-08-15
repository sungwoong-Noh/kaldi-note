package com.kaldinote.testsupport;

import org.springframework.web.bind.annotation.*;

/** 보안 설정 검증용 테스트 전용 엔드포인트. 운영 코드가 아니다. */
@RestController
@RequestMapping("/test-support")
public class DummyController {

  @GetMapping("/public")
  public String publicEndpoint() {
    return "public";
  }

  @GetMapping("/secured")
  public String secured() {
    return "secured";
  }

  @PostMapping("/secured")
  public String securedPost(@RequestBody(required = false) String body) {
    return "posted";
  }

  @GetMapping("/admin")
  public String adminOnly() {
    return "admin";
  }
}

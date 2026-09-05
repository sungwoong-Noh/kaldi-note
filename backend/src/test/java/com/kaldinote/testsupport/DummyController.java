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

  /**
   * 핸들러가 없는 예외가 여전히 500인지 확인하는 용도 — AC-HTTPERR-14. IllegalArgumentException을 쓰지 않는 이유: 이미
   * handleIllegalArgument가 잡아 400을 내므로 검사하려는 500 경로를 타지 않는다.
   */
  @GetMapping("/boom")
  public String boom() {
    throw new IllegalStateException("의도적으로 터뜨린다");
  }
}

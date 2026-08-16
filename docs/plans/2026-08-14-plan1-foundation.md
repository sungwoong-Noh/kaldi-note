# kaldi note — Plan 1: Foundation 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카카오/구글로 로그인해 JWT를 받고, 마스터 데이터(품종·가공법·그라인더·드리퍼)를 조회하고, 서로 다른 그라인더 간 분쇄도를 환산할 수 있는 Spring Boot API 서버를 만든다.

**Architecture:** 도메인별 패키지(`grind`, `extraction`, `user`, `auth`, `catalog`, `gear`)로 나누고, 각 도메인은 `domain`/`application`/`infrastructure`/`presentation` 4계층을 갖는다. `grind`와 `extraction`은 DB·프레임워크 의존이 전혀 없는 순수 계산 모듈이라 가장 먼저 TDD로 만든다. 인증은 OAuth2 인가코드를 프론트에서 받아 백엔드가 교환하는 방식(SPA 친화적)이며, 자체 발급 JWT를 리소스 서버로 검증한다.

**Tech Stack:** Java 21 · Spring Boot 4.1.x · Spring Security 7 · Spring Data JPA · PostgreSQL 17 · Flyway · Testcontainers · Gradle (Kotlin DSL)

**Spec:**
- `docs/specs/2026-08-14-grind-conversion.md` — 분쇄도 환산 (AC 21개)
- `docs/specs/2026-08-14-extraction-analysis.md` — 추출 수율/SCA 분석 (AC 25개)
- `docs/design/2026-08-14-architecture.md` — 전체 아키텍처 (AC 없음, 배경 문서)

> Plan 1의 나머지(스캐폴딩·인증·시드 데이터)는 사용자에게 보이는 동작이 아닌 기반 공사라 기능 스펙 대상이 아니다.
> **Plan 2부터는 모든 기능이 스펙 → 계획 → 코드 순서를 거친다.**

**작업 위치:** 이 계획의 모든 경로는 **`backend/` 기준**이다. 명령어는 `backend/` 디렉터리에서 실행한다.

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/git.md`

---

## Global Constraints

모든 태스크의 요구사항에 아래가 암묵적으로 포함된다. 상세는 `docs/conventions/backend.md` 참조.

- **Java 21** (Spring Boot 4의 최소 요구). `--release 21`로 컴파일.
- **Spring Boot 4.1.x.** 3.5는 2026-06-30 OSS 지원 종료 — 절대 다운그레이드하지 않는다.
- **CSRF는 반드시 명시적으로 끈다.** Spring Security 7은 CSRF가 기본 활성이라, 끄지 않으면 stateless REST API의 모든 POST/PUT/DELETE가 403이 된다. Boot 4 마이그레이션 최다 실패 사례.
- **Jackson 3 패키지는 `tools.jackson.*`** (`com.fasterxml.jackson.*` 아님). 인터넷 예제 대부분이 Jackson 2 기준이므로 import를 그대로 복사하지 말 것.
- **Boot 4는 모듈이 재편됐다.** import가 해결되지 않으면 버전을 낮추지 말고 [Spring Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)에서 새 좌표를 찾는다.
- **측정값·금액은 전부 `BigDecimal`.** `double`/`float` 금지 — 커피 계량은 0.1g 단위 정확도가 의미를 갖는다.
- **테스트 DB는 Testcontainers + PostgreSQL 17.** H2 금지 — 방언 차이로 거짓 통과한다.
- **스키마 변경은 전부 Flyway 마이그레이션.** `ddl-auto`는 `validate` 고정, 절대 `update`로 바꾸지 않는다.
- **시드 데이터도 Flyway 마이그레이션**으로 넣는다. 변경 이력이 git에 남아야 한다.
- **패키지 루트는 `com.kaldinote`.**
- 식별자·API 필드명은 영어, **주석과 커밋 메시지는 한국어**.
- 커밋 메시지는 `feat:` / `test:` / `chore:` / `fix:` / `refactor:` 접두어를 쓴다.
- 각 태스크는 **테스트가 초록인 상태로 끝난다.** 다음 태스크로 넘어가기 전 `./gradlew test`가 통과해야 한다.

### 반올림 규칙 (전 도메인 공통)

| 값 | 스케일 | 모드 |
|---|---|---|
| 마이크론(µm) | 0 | HALF_UP |
| 그라인더 설정값(클릭/눈금) | 1 | HALF_UP |
| 추출 수율 EY(%) | 1 | HALF_UP |
| 브루 비율 (1:N의 N) | 1 | HALF_UP |
| 중량(g) | 1 | HALF_UP |

---

## AC 커버리지 매핑

> 두 스펙의 인수 조건 46개가 어느 태스크에서 검증되는지의 대응표다. **테스트의 `@DisplayName`에 AC ID를 반드시 남긴다.** `./scripts/check-spec-coverage.sh`가 이를 검사한다.

### 분쇄도 환산 (`AC-GRIND-*`, 21개)

| AC | 요약 | 태스크 | 검증 |
|---|---|---|---|
| 01~03 | 마이크론 환산, 영점 보정, 반올림 | Task 2 | 단위 |
| 04~06 | 그라인더 간 환산, 반올림, 동일 그라인더 | Task 2 | 단위 |
| 07 | 항상 추정치 + 경고 문구 | Task 2, 11 | 단위 + API |
| 10~11 | 하한·상한 경계 허용 | Task 11 | API |
| 12~13 | 상한 초과·하한 미만 거부 (400) | Task 11 | API |
| 14 | 영점이 하한이 되는 경우 | Task 2 | 단위 |
| 15~16 | min·max가 null이거나 max=0이면 검증 생략 | Task 2 | 단위 |
| 20~21 | 결과 범위 초과 플래그 | Task 11 | API |
| 30~31 | 환산 불가 (422) | Task 11 | API |
| 32~34 | 없는 그라인더(404), 미인증(401), 필수 필드 누락(400) | Task 11 | API |

### 추출 분석 (`AC-EXT-*`, 25개)

| AC | 요약 | 태스크 | 검증 |
|---|---|---|---|
| 01~08 | 비율·수율 계산, 구간 분류, 진단 문구 | Task 3 | 단위 |
| 10~13 | 수율 경계 18.0 / 22.0 / 17.9 / 22.1 | Task 3 | 단위 |
| 14~17 | TDS 경계 1.15 / 1.35 / 1.14 / 1.36 | Task 3 | 단위 |
| 18~19 | 물리 한계 30.0 허용 / 30.1 거부 | Task 3 | 단위 |
| 30~36 | 입력 검증 6종 + 경계 허용 1종 | Task 3 | 단위 |

**AC 46개 = 매핑 46개.** 누락 없음.

---

## File Structure

전체 패키지 구조와 계층 규칙은 `backend/CLAUDE.md`에 있다. 이 계획에서 **새로 만드는 파일**만 나열한다.

```
kaldi-note/
├── docker-compose.yml                          로컬 Postgres (저장소 루트)
└── backend/
    ├── build.gradle.kts
    ├── src/main/java/com/kaldinote/
    │   ├── KaldiNoteApplication.java
    │   ├── common/
    │   │   ├── error/                          ErrorCode, BusinessException, GlobalExceptionHandler
    │   │   └── security/
    │   │       ├── SecurityConfig.java         ★ CSRF 끄는 곳
    │   │       ├── JwtAuthenticationConverter.java   role claim → ROLE_ 권한
    │   │       └── AuthenticatedUser.java      @AuthenticationPrincipal 대상
    │   ├── grind/domain/                       ★ 순수 계산, 의존성 0 (Task 2)
    │   │   ├── GrindSpec.java                  VO: micronsPerClick, zeroPointOffset
    │   │   ├── GrindConversion.java            결과 VO
    │   │   ├── GrindConverter.java             변환 로직
    │   │   └── GrindNotConvertibleException.java
    │   ├── extraction/domain/                  ★ 순수 계산, 의존성 0 (Task 3)
    │   │   ├── BrewMeasurement.java            입력 VO
    │   │   ├── ExtractionAnalysis.java         결과 VO
    │   │   ├── StrengthZone.java, ExtractionZone.java
    │   │   └── ExtractionAnalyzer.java
    │   ├── user/                               User, UserRole, Follow (Task 4)
    │   ├── auth/                               JWT, OAuth2, refresh rotation (Task 5~8)
    │   │   ├── domain/OAuthProvider.java, RefreshToken.java
    │   │   ├── application/AuthService.java, OAuthUserProfile.java
    │   │   ├── infrastructure/jwt/             JwtProperties, JwtConfig, JwtTokenProvider
    │   │   ├── infrastructure/oauth/           OAuthClient, KakaoOAuthClient, GoogleOAuthClient
    │   │   └── presentation/AuthController.java
    │   ├── catalog/                            품종·가공법·플레이버노트 (Task 9)
    │   └── gear/                               그라인더·드리퍼·필터 + 환산 API (Task 10~11)
    ├── src/main/resources/
    │   ├── application.yml, application-local.yml
    │   └── db/migration/
    │       ├── V1__create_user_tables.sql      (Task 4)
    │       ├── V2__create_catalog_tables.sql   (Task 9)
    │       ├── V3__seed_catalog.sql            (Task 9)
    │       ├── V4__create_gear_tables.sql      (Task 10)
    │       └── V5__seed_gear.sql               (Task 10)
    └── src/test/java/com/kaldinote/
        ├── TestcontainersConfiguration.java
        ├── AbstractIntegrationTest.java        ★ 모든 통합 테스트의 베이스
        └── (main과 동일한 패키지 구조)
```

**분할 근거:** `grind`/`extraction`은 프레임워크 의존이 없어 다른 모든 태스크와 병렬로 검증 가능하다. 이 둘을 먼저 만들면 설계의 계산 규칙이 맞는지 DB·인증 없이 곧바로 확인된다.

---

## Task 1: 프로젝트 스캐폴딩 + Postgres + 통합 테스트 기반

**Files:**
- Create: `backend/build.gradle.kts`, `backend/settings.gradle.kts`, `backend/gradlew` (start.spring.io 생성)
- Create: `docker-compose.yml` (저장소 루트 — 프론트에서도 쓸 수 있게)
- Create: `backend/src/main/resources/application.yml`, `application-local.yml`
- Create: `backend/src/main/resources/db/migration/.gitkeep`
- Create: `backend/src/test/java/com/kaldinote/TestcontainersConfiguration.java`
- Create: `backend/src/test/java/com/kaldinote/AbstractIntegrationTest.java`
- Test: `backend/src/test/java/com/kaldinote/ApplicationSmokeTest.java`
- Create: `.gitignore` (저장소 루트)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `AbstractIntegrationTest` — 이후 모든 통합 테스트가 `extends AbstractIntegrationTest`로 상속받아 Postgres 컨테이너와 `MockMvc`를 얻는다.

**보안 스타터는 이 태스크에 넣지 않는다.** classpath에 `spring-boot-starter-security`가 있으면 `/actuator/health`가 즉시 401이 되어 스모크 테스트가 무의미해진다. 보안은 Task 5에서 설정과 함께 추가한다.

- [x] **Step 1: 프로젝트 생성**

저장소 루트에는 이미 `CLAUDE.md`, `docs/`, `backend/CLAUDE.md`, `frontend/CLAUDE.md`가 있다. `backend/` 안에 Spring Boot 프로젝트를 푼다 (`backend/CLAUDE.md`를 덮어쓰지 않도록 `-o` 대상과 `unzip` 위치에 주의).

```bash
cd /Users/nohsw/Desktop/project/kaldi-note/backend
curl -G https://start.spring.io/starter.zip \
  -d type=gradle-project-kotlin \
  -d language=java \
  -d bootVersion=4.1.0 \
  -d javaVersion=21 \
  -d groupId=com.kaldinote \
  -d artifactId=kaldi-note-api \
  -d name=kaldi-note-api \
  -d packageName=com.kaldinote \
  -d dependencies=web,data-jpa,postgresql,flyway,validation,actuator,testcontainers,lombok,configuration-processor \
  -o starter.zip
unzip -o starter.zip && rm starter.zip
```

`bootVersion=4.1.0`이 거부되면 사용 가능한 버전을 확인한다:
`curl -s https://start.spring.io/metadata/client | grep -o '"4\.[0-9.]*"' | sort -u`
→ 나온 4.1.x 중 가장 높은 패치 버전을 쓴다. **3.x로 내려가지 않는다.**

- [x] **Step 2: git 초기화 + 첫 커밋**

> **실제와 다름:** 이 Step은 저장소가 아직 없다고 가정하고 쓰였다. 실제로는 설계 세션(`docs/session-flow` 등)이 이미 `git init`과 첫 커밋 5개를 끝내고 `main`에 히스토리가 있었다. `git init`은 건너뛰고, 스캐폴딩만 새 브랜치(`feat/task-01-scaffolding`)에 일반 커밋으로 추가했다.

저장소 루트에서 실행한다.

```bash
cd /Users/nohsw/Desktop/project/kaldi-note
git add backend/
git commit -m "chore: Spring Boot 4.1 백엔드 프로젝트 스캐폴딩 생성"
```

- [x] **Step 3: 로컬 Postgres compose 파일 작성**

저장소 루트의 `docker-compose.yml` (프론트 E2E에서도 쓴다):

```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: kaldi-note-postgres
    environment:
      POSTGRES_DB: kaldinote
      POSTGRES_USER: kaldinote
      POSTGRES_PASSWORD: localdev
    ports:
      - "5432:5432"
    volumes:
      - kaldi-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kaldinote -d kaldinote"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  kaldi-pgdata:
```

- [x] **Step 4: 설정 파일 작성**

`src/main/resources/application.yml`:

```yaml
spring:
  application:
    name: kaldi-note-api
  profiles:
    default: local
  jpa:
    hibernate:
      ddl-auto: validate      # Flyway가 스키마 소유자. 절대 update로 바꾸지 말 것
    open-in-view: false
    properties:
      hibernate:
        jdbc:
          time_zone: UTC
  flyway:
    enabled: true
    locations: classpath:db/migration
  jackson:
    default-property-inclusion: non_null

management:
  endpoints:
    web:
      exposure:
        include: health, info
  endpoint:
    health:
      show-details: never
```

`src/main/resources/application-local.yml`:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/kaldinote
    username: kaldinote
    password: localdev
  jpa:
    properties:
      hibernate:
        format_sql: true
logging:
  level:
    org.hibernate.SQL: debug
    org.hibernate.orm.jdbc.bind: trace
```

`src/main/resources/db/migration/.gitkeep` — 빈 파일 생성 (마이그레이션 디렉터리가 없으면 Flyway 설정이 경고를 낸다).

- [x] **Step 5: 실패하는 스모크 테스트 작성**

`src/test/java/com/kaldinote/ApplicationSmokeTest.java`:

```java
package com.kaldinote;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ApplicationSmokeTest extends AbstractIntegrationTest {

    @Test
    void 헬스체크가_UP을_반환한다() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
```

- [x] **Step 6: 테스트 실행 — 컴파일 실패 확인**

```bash
./gradlew test --tests '*ApplicationSmokeTest'
```

Expected: 컴파일 실패. `AbstractIntegrationTest` 심볼을 찾을 수 없음.

- [x] **Step 7: Testcontainers 설정과 통합 테스트 베이스 작성**

> **실제와 다름:** Boot 4.1 + Testcontainers 최신 버전에서 `PostgreSQLContainer`의 패키지가
> `org.testcontainers.containers` → **`org.testcontainers.postgresql`** 로 이동했다(제네릭도
> 사라져 raw type). `@ServiceConnection`의 경로(`org.springframework.boot.testcontainers.service.connection`)는
> 계획의 가정대로 그대로였다. 아래 코드는 실제 사용한 import로 갱신했다.

`src/test/java/com/kaldinote/TestcontainersConfiguration.java`:

```java
package com.kaldinote;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * 통합 테스트용 PostgreSQL 컨테이너.
 * H2를 쓰지 않는 이유: JSONB·방언 차이로 통합 테스트가 거짓 통과한다.
 * static 필드로 두어 전체 테스트 실행 동안 컨테이너 하나를 재사용한다.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        return new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"))
                .withReuse(true);
    }
}
```

> `@ServiceConnection` import가 해결되지 않으면 Boot 4에서 패키지가 이동한 것이다. `./gradlew dependencies --configuration testRuntimeClasspath | grep testcontainers`로 모듈을 확인하고 마이그레이션 가이드에서 새 좌표를 찾는다.

`src/test/java/com/kaldinote/AbstractIntegrationTest.java`:

> **실제와 다름:** `AutoConfigureMockMvc`도 Boot 4에서 패키지가 이동했다.
> `org.springframework.boot.test.autoconfigure.web.servlet` → **`org.springframework.boot.webmvc.test.autoconfigure`**.
> `spring-boot-webmvc-test` 모듈의 클래스 목록에서 확인했다.

```java
package com.kaldinote;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 모든 통합 테스트의 베이스. Postgres 컨테이너 + MockMvc를 제공한다.
 * 컨테이너 기동 비용이 크므로 테스트 컨텍스트가 캐시되도록 설정을 통일한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {

    @Autowired
    protected MockMvc mockMvc;
}
```

`src/test/resources/application-test.yml`:

```yaml
spring:
  jpa:
    properties:
      hibernate:
        format_sql: false
logging:
  level:
    org.hibernate.SQL: warn
```

- [x] **Step 8: 테스트 실행 — 통과 확인**

Docker Desktop이 실행 중인지 먼저 확인한다.

```bash
docker info > /dev/null && ./gradlew test --tests '*ApplicationSmokeTest'
```

Expected: PASS. 로그에 Testcontainers가 `postgres:17-alpine`을 기동하는 줄이 보인다.

- [x] **Step 9: 로컬 실행 확인**

```bash
(cd .. && docker compose up -d)
./gradlew bootRun
```

다른 터미널에서:
```bash
curl -s localhost:8080/actuator/health
```
Expected: `{"status":"UP"}`

확인 후 `Ctrl+C`, `(cd .. && docker compose down)`.

- [x] **Step 10: .gitignore 정리 후 커밋 + Spotless 추가**

> **실제와 다름:** 루트 `.gitignore`는 설계 세션이 이미 백엔드 패턴(빌드 산출물, 시크릿, IDE)을
> 전부 포함해 커밋해뒀다. `backend/.gitignore`를 옮겨 보탤 내용이 없어 **그냥 삭제**했다.

`backend/build.gradle.kts`에 Spotless(Google Java Format)를 추가한다 — 컨벤션 문서가 전제하는 도구다:

```kotlin
plugins {
    // ...기존 플러그인
    id("com.diffplug.spotless") version "7.0.2"
}

spotless {
    java {
        // 기본 버전(1.24.0)은 이 환경의 JDK에서
        // com.sun.tools.javac.util.Log$DeferredDiagnosticHandler.getDiagnostics()가
        // NoSuchMethodError를 낸다(javac 내부 API가 Queue→List로 바뀐 최신 JDK와의
        // 호환성 문제, diffplug/spotless#2468). 1.28.0으로 고정해 해결한다.
        googleJavaFormat("1.28.0")
        removeUnusedImports()
        trimTrailingWhitespace()
        endWithNewline()
    }
}

tasks.named("check") { dependsOn("spotlessCheck") }
```

> **추가로 필요했던 것:** `backend/gradle.properties`에 google-java-format이 JDK 내부 컴파일러
> API에 접근하기 위한 `--add-exports`/`--add-opens` JVM 인자를 추가했다(JDK 16+ 공통 이슈,
> google-java-format 공식 문서에 안내된 플래그). 머신별 경로가 아니라 표준 JVM 플래그라 커밋해도 안전하다.

```bash
./gradlew spotlessApply
./gradlew clean check
cd .. && git add -A && git commit -m "feat: 로컬 Postgres compose, Testcontainers 통합 테스트 기반, Spotless 포맷터 추가"
```

Expected: `clean check` 통과. **확인됨.**

---

## Task 2: `grind` — 분쇄도 환산 순수 도메인

**Spec:** `docs/specs/2026-08-14-grind-conversion.md`
**Covers:** AC-GRIND-01 ~ 07, 14 ~ 16 (나머지는 Task 11의 API 테스트에서 검증)

**Files:**
- Create: `backend/src/main/java/com/kaldinote/grind/domain/GrindSpec.java`
- Create: `backend/src/main/java/com/kaldinote/grind/domain/GrindConversion.java`
- Create: `backend/src/main/java/com/kaldinote/grind/domain/GrindNotConvertibleException.java`
- Create: `backend/src/main/java/com/kaldinote/grind/domain/GrindSettingOutOfRangeException.java`
- Create: `backend/src/main/java/com/kaldinote/grind/domain/GrindConverter.java`
- Test: `backend/src/test/java/com/kaldinote/grind/domain/GrindConverterTest.java`

**Interfaces:**
- Consumes: 없음. 이 패키지는 Spring·JPA에 전혀 의존하지 않는다.
- Produces:
  - `GrindSpec(BigDecimal micronsPerClick, BigDecimal zeroPointOffsetClicks, BigDecimal minSetting, BigDecimal maxSetting)` — `micronsPerClick`·`minSetting`·`maxSetting`은 null 가능
  - `GrindSpec#convertible() → boolean`
  - `GrindSpec#effectiveMinSetting() → BigDecimal` — `max(minSetting, zeroPointOffsetClicks)`
  - `GrindSpec#rangeChecked() → boolean` — min·max가 유효할 때만 true
  - `GrindConverter#toMicron(GrindSpec, BigDecimal setting) → BigDecimal`
  - `GrindConverter#convert(GrindSpec source, BigDecimal sourceSetting, GrindSpec target) → GrindConversion`
  - `GrindConversion(BigDecimal sourceSetting, BigDecimal micron, BigDecimal targetSetting, boolean targetOutOfRange, boolean estimated, String warning)`
  - `GrindConverter.ESTIMATE_WARNING` — 상수 문자열
  - Task 11의 `GrindConversionService`가 이 API를 그대로 호출한다.

**계산 규칙 (스펙에서 그대로 옮김):**
```
micron    = (setting - zeroPointOffsetClicks) × micronsPerClick
converted = micron / target.micronsPerClick + target.zeroPointOffsetClicks
하한       = max(minSetting, zeroPointOffsetClicks)   ← 영점 미만도 여기서 걸린다
```

**범위 검증 정책:** 경계는 **양쪽 포함 `[하한, maxSetting]`**. `minSetting`·`maxSetting`이 null이거나 `maxSetting`이 0이면 검증을 생략한다.

> **`GrindSpec`이 min·max를 갖는 이유:** 범위 검증까지 순수 도메인에서 단위 테스트로 검증하기 위해서다. 엔티티를 끌어오면 이 패키지의 무의존 원칙이 깨진다.

- [x] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/kaldinote/grind/domain/GrindConverterTest.java`:

```java
package com.kaldinote.grind.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class GrindConverterTest {

  private final GrindConverter converter = new GrindConverter();

  /** Comandante C40: 30µm/click, 영점 0, 0~50 */
  private static final GrindSpec C40 =
      new GrindSpec(bd("30"), BigDecimal.ZERO, bd("0"), bd("50"));
  /** 1Zpresso K-Plus: 22µm/click, 영점 0, 0~90 */
  private static final GrindSpec K_PLUS =
      new GrindSpec(bd("22"), BigDecimal.ZERO, bd("0"), bd("90"));
  /** 무단계 그라인더 — 클릭당 마이크론을 알 수 없어 환산 불가 */
  private static final GrindSpec STEPLESS =
      new GrindSpec(null, BigDecimal.ZERO, bd("0"), bd("0"));

  private static BigDecimal bd(String v) {
    return new BigDecimal(v);
  }

  @Nested
  @DisplayName("마이크론 환산")
  class ToMicron {

    @Test
    @DisplayName("AC-GRIND-01 · 설정값을 마이크론으로 환산한다")
    void C40_22클릭은_660마이크론이다() {
      assertThat(converter.toMicron(C40, bd("22"))).isEqualByComparingTo("660");
    }

    @Test
    @DisplayName("AC-GRIND-02 · 영점 보정만큼 빼고 계산한다")
    void 영점_보정이_있으면_보정만큼_빼고_계산한다() {
      GrindSpec offsetGrinder = new GrindSpec(bd("30"), bd("3"), null, null);

      assertThat(converter.toMicron(offsetGrinder, bd("10"))).isEqualByComparingTo("210");
    }

    @Test
    @DisplayName("AC-GRIND-03 · 마이크론은 소수점 없이 반올림한다")
    void 마이크론은_소수점없이_반올림한다() {
      GrindSpec odd = new GrindSpec(bd("22.5"), BigDecimal.ZERO, null, null);

      // 7 × 22.5 = 157.5 → HALF_UP → 158
      assertThat(converter.toMicron(odd, bd("7"))).isEqualByComparingTo("158");
    }
  }

  @Nested
  @DisplayName("그라인더 간 환산")
  class Convert {

    @Test
    @DisplayName("AC-GRIND-04 · 그라인더 간 설정값을 환산한다")
    void C40_22클릭은_K_Plus_30클릭에_해당한다() {
      GrindConversion result = converter.convert(C40, bd("22"), K_PLUS);

      assertThat(result.sourceSetting()).isEqualByComparingTo("22");
      assertThat(result.micron()).isEqualByComparingTo("660");
      assertThat(result.targetSetting()).isEqualByComparingTo("30.0");
    }

    @Test
    @DisplayName("AC-GRIND-05 · 대상 설정값은 소수 첫째 자리까지 반올림한다")
    void 대상_설정값은_소수_첫째자리까지_반올림한다() {
      // C40 30클릭 = 900µm → 900 / 22 = 40.909... → 40.9
      assertThat(converter.convert(C40, bd("30"), K_PLUS).targetSetting())
          .isEqualByComparingTo("40.9");
    }

    @Test
    @DisplayName("AC-GRIND-06 · 같은 그라인더끼리는 설정값이 보존된다")
    void 같은_그라인더끼리는_설정값이_그대로_나온다() {
      assertThat(converter.convert(C40, bd("22"), C40).targetSetting())
          .isEqualByComparingTo("22.0");
    }

    @Test
    @DisplayName("AC-GRIND-07 · 환산 결과는 언제나 추정치로 표시된다")
    void 환산_결과는_언제나_추정치로_표시된다() {
      GrindConversion result = converter.convert(C40, bd("22"), K_PLUS);

      assertThat(result.estimated()).isTrue();
      assertThat(result.warning()).isEqualTo(GrindConverter.ESTIMATE_WARNING);
    }

    @Test
    @DisplayName("AC-GRIND-21 · 결과가 대상 범위 안이면 플래그가 내려간다")
    void 결과가_대상_범위_안이면_플래그가_false다() {
      assertThat(converter.convert(C40, bd("22"), K_PLUS).targetOutOfRange()).isFalse();
    }

    @Test
    @DisplayName("AC-GRIND-20 · 결과가 대상 범위를 넘으면 플래그를 세우고 값은 돌려준다")
    void 결과가_대상_범위를_넘으면_플래그가_true다() {
      // K-Plus 90클릭 = 1980µm → C40 66.0클릭. C40의 최대는 50이다.
      GrindConversion result = converter.convert(K_PLUS, bd("90"), C40);

      assertThat(result.targetSetting()).isEqualByComparingTo("66.0");
      assertThat(result.targetOutOfRange()).isTrue();
    }
  }

  @Nested
  @DisplayName("범위 검증")
  class RangeValidation {

    @Test
    @DisplayName("AC-GRIND-14 · 영점이 min_setting보다 크면 영점이 하한이 된다")
    void 영점보다_낮은_설정값은_거부한다() {
      // min_setting은 0이지만 영점이 3이므로 하한은 3이다
      GrindSpec offsetGrinder = new GrindSpec(bd("30"), bd("3"), bd("0"), bd("50"));

      assertThatThrownBy(() -> converter.toMicron(offsetGrinder, bd("2")))
          .isInstanceOf(GrindSettingOutOfRangeException.class);
    }

    @Test
    @DisplayName("AC-GRIND-15 · min·max가 null이면 범위를 검증하지 않는다")
    void min과_max가_null이면_범위를_검증하지_않는다() {
      GrindSpec noRange = new GrindSpec(bd("30"), BigDecimal.ZERO, null, null);

      assertThat(converter.toMicron(noRange, bd("999"))).isEqualByComparingTo("29970");
    }

    @Test
    @DisplayName("AC-GRIND-16 · max_setting이 0이면 범위를 검증하지 않는다")
    void max가_0이면_범위를_검증하지_않는다() {
      GrindSpec zeroMax = new GrindSpec(bd("30"), BigDecimal.ZERO, bd("0"), bd("0"));

      assertThat(converter.toMicron(zeroMax, bd("20"))).isEqualByComparingTo("600");
    }

    @Test
    void 상한을_넘으면_거부한다() {
      assertThatThrownBy(() -> converter.toMicron(C40, bd("51")))
          .isInstanceOf(GrindSettingOutOfRangeException.class);
    }

    @Test
    void 하한_아래는_거부한다() {
      assertThatThrownBy(() -> converter.toMicron(C40, bd("-1")))
          .isInstanceOf(GrindSettingOutOfRangeException.class);
    }

    @Test
    void 경계값은_양쪽_다_허용한다() {
      assertThat(converter.toMicron(C40, bd("0"))).isEqualByComparingTo("0");
      assertThat(converter.toMicron(C40, bd("50"))).isEqualByComparingTo("1500");
    }
  }

  @Nested
  @DisplayName("환산 가능 여부 판정")
  class Convertible {

    @Test
    void 클릭당_마이크론이_있으면_환산_가능하다() {
      assertThat(C40.convertible()).isTrue();
    }

    @Test
    void 클릭당_마이크론이_없으면_환산_불가다() {
      assertThat(STEPLESS.convertible()).isFalse();
    }

    @Test
    void 클릭당_마이크론이_0이하면_환산_불가다() {
      assertThat(new GrindSpec(BigDecimal.ZERO, BigDecimal.ZERO, null, null).convertible())
          .isFalse();
    }

    @Test
    void 원본이_환산_불가면_예외를_던진다() {
      assertThatThrownBy(() -> converter.toMicron(STEPLESS, bd("10")))
          .isInstanceOf(GrindNotConvertibleException.class);
    }

    @Test
    void 대상이_환산_불가면_예외를_던진다() {
      assertThatThrownBy(() -> converter.convert(C40, bd("22"), STEPLESS))
          .isInstanceOf(GrindNotConvertibleException.class);
    }
  }
}
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
./gradlew test --tests '*GrindConverterTest'
```

Expected: 컴파일 실패. `GrindSpec`, `GrindConverter`, `GrindConversion`, `GrindNotConvertibleException`, `GrindSettingOutOfRangeException` 심볼 없음.

- [x] **Step 3: VO와 예외 작성**

`backend/src/main/java/com/kaldinote/grind/domain/GrindSpec.java`:

```java
package com.kaldinote.grind.domain;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * 그라인더의 분쇄도 환산 특성.
 *
 * <p>범위 검증까지 순수 도메인에서 단위 테스트로 검증하기 위해 min·max를 함께 갖는다.
 * 엔티티를 끌어오면 이 패키지의 무의존 원칙이 깨진다.
 *
 * @param micronsPerClick       클릭 1칸당 입자 크기 변화량(µm). 무단계 그라인더는 null
 * @param zeroPointOffsetClicks 버가 맞닿는 영점의 클릭 값. 대부분 0
 * @param minSetting            제조사 사양의 최소 설정값. 모르면 null
 * @param maxSetting            제조사 사양의 최대 설정값. 모르면 null
 */
public record GrindSpec(
    BigDecimal micronsPerClick,
    BigDecimal zeroPointOffsetClicks,
    BigDecimal minSetting,
    BigDecimal maxSetting) {

  public GrindSpec {
    Objects.requireNonNull(zeroPointOffsetClicks, "zeroPointOffsetClicks는 null일 수 없습니다");
  }

  /** 클릭당 마이크론을 알아야만 다른 그라인더로 환산할 수 있다. */
  public boolean convertible() {
    return micronsPerClick != null && micronsPerClick.signum() > 0;
  }

  /**
   * 범위를 검증할 수 있는가. min·max가 null이거나 max가 0이면 사양을 모르는 것으로 보고
   * 검증을 생략한다.
   */
  public boolean rangeChecked() {
    return minSetting != null && maxSetting != null && maxSetting.signum() > 0;
  }

  /**
   * 실제 하한. min_setting이 0이어도 영점이 3이면 3보다 낮은 값은 마이크론이 음수가 된다.
   * 둘 중 큰 값이 하한이다.
   */
  public BigDecimal effectiveMinSetting() {
    if (minSetting == null) {
      return zeroPointOffsetClicks;
    }
    return minSetting.max(zeroPointOffsetClicks);
  }
}
```

`backend/src/main/java/com/kaldinote/grind/domain/GrindConversion.java`:

```java
package com.kaldinote.grind.domain;

import java.math.BigDecimal;

/**
 * 그라인더 간 분쇄도 환산 결과.
 *
 * @param targetOutOfRange 환산 결과가 대상 그라인더의 사양 범위를 벗어났는가.
 *     "내 그라인더로는 이 굵기가 안 나온다"는 정보이므로 막지 않고 알려준다.
 * @param estimated 항상 true. 버 형상·입도 분포가 달라 정확한 등가 변환은 성립하지 않는다.
 * @param warning   UI가 반드시 노출해야 하는 경고 문구
 */
public record GrindConversion(
    BigDecimal sourceSetting,
    BigDecimal micron,
    BigDecimal targetSetting,
    boolean targetOutOfRange,
    boolean estimated,
    String warning) {}
```

`backend/src/main/java/com/kaldinote/grind/domain/GrindNotConvertibleException.java`:

```java
package com.kaldinote.grind.domain;

/** 클릭당 마이크론 정보가 없어 환산할 수 없을 때 발생한다. HTTP 422로 매핑된다. */
public class GrindNotConvertibleException extends RuntimeException {

  public GrindNotConvertibleException(String message) {
    super(message);
  }
}
```

`backend/src/main/java/com/kaldinote/grind/domain/GrindSettingOutOfRangeException.java`:

```java
package com.kaldinote.grind.domain;

/** 설정값이 그라인더의 사양 범위를 벗어났을 때 발생한다. HTTP 400으로 매핑된다. */
public class GrindSettingOutOfRangeException extends RuntimeException {

  public GrindSettingOutOfRangeException(String message) {
    super(message);
  }
}
```

- [x] **Step 4: 변환기 구현**

`backend/src/main/java/com/kaldinote/grind/domain/GrindConverter.java`:

```java
package com.kaldinote.grind.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 그라인더 설정값 ↔ 마이크론 환산.
 *
 * <p>micron    = (setting - zeroPointOffsetClicks) × micronsPerClick
 * <p>converted = micron / target.micronsPerClick + target.zeroPointOffsetClicks
 *
 * <p>버 형상과 입도 분포가 그라인더마다 달라 정확한 등가 변환은 물리적으로 불가능하다.
 * 결과는 언제나 추정치이며 시작점으로만 사용해야 한다.
 */
public class GrindConverter {

  public static final String ESTIMATE_WARNING =
      "버 형상과 입도 분포가 달라 정확한 등가 변환은 불가능합니다. 시작점으로만 사용하세요.";

  private static final int MICRON_SCALE = 0;
  private static final int SETTING_SCALE = 1;
  /** 나눗셈 중간 정밀도. 최종 반올림 전 오차를 흡수한다. */
  private static final int DIVISION_SCALE = 6;

  public BigDecimal toMicron(GrindSpec spec, BigDecimal setting) {
    requireConvertible(spec, "원본");
    requireInRange(spec, setting);

    return setting
        .subtract(spec.zeroPointOffsetClicks())
        .multiply(spec.micronsPerClick())
        .setScale(MICRON_SCALE, RoundingMode.HALF_UP);
  }

  public GrindConversion convert(GrindSpec source, BigDecimal sourceSetting, GrindSpec target) {
    requireConvertible(target, "대상");

    BigDecimal micron = toMicron(source, sourceSetting);
    BigDecimal targetSetting =
        micron
            .divide(target.micronsPerClick(), DIVISION_SCALE, RoundingMode.HALF_UP)
            .add(target.zeroPointOffsetClicks())
            .setScale(SETTING_SCALE, RoundingMode.HALF_UP);

    return new GrindConversion(
        sourceSetting,
        micron,
        targetSetting,
        outOfRange(target, targetSetting),
        true,
        ESTIMATE_WARNING);
  }

  private void requireConvertible(GrindSpec spec, String label) {
    if (!spec.convertible()) {
      throw new GrindNotConvertibleException(
          "%s 그라인더의 클릭당 마이크론 정보가 없어 환산할 수 없습니다.".formatted(label));
    }
  }

  /** 경계는 양쪽 포함. 사양을 모르는 그라인더(rangeChecked=false)는 검증하지 않는다. */
  private void requireInRange(GrindSpec spec, BigDecimal setting) {
    BigDecimal min = spec.effectiveMinSetting();
    if (setting.compareTo(min) < 0) {
      throw new GrindSettingOutOfRangeException(
          "설정값 %s는 이 그라인더의 하한 %s보다 낮습니다.".formatted(setting, min));
    }
    if (spec.rangeChecked() && setting.compareTo(spec.maxSetting()) > 0) {
      throw new GrindSettingOutOfRangeException(
          "설정값 %s는 이 그라인더의 상한 %s를 넘습니다.".formatted(setting, spec.maxSetting()));
    }
  }

  /** 결과가 대상 범위를 벗어났는지. 막지 않고 알려주기만 한다. */
  private boolean outOfRange(GrindSpec target, BigDecimal targetSetting) {
    if (!target.rangeChecked()) {
      return false;
    }
    return targetSetting.compareTo(target.effectiveMinSetting()) < 0
        || targetSetting.compareTo(target.maxSetting()) > 0;
  }
}
```

> **`requireInRange`의 하한 검사가 `rangeChecked()` 밖에 있는 이유:** 영점 미만은 마이크론이 음수가 되므로, 사양을 모르는 그라인더라도 반드시 막아야 한다. 상한만 사양에 의존한다.

- [x] **Step 5: 테스트 실행 — 통과 확인**

```bash
./gradlew test --tests '*GrindConverterTest'
```

Expected: PASS, 18 tests.

- [x] **Step 6: 커밋**

```bash
cd .. && git add backend/src && git commit -m "feat(grind): 분쇄도 환산 순수 도메인 추가 (환산은 언제나 추정치, 범위 검증 포함)" && cd backend
```

---

## Task 3: `extraction` — 추출 수율 / SCA 좌표 순수 도메인

**Spec:** `docs/specs/2026-08-14-extraction-analysis.md`
**Covers:** AC-EXT-01 ~ 36 (전체 25개). 이 스펙은 HTTP를 다루지 않으므로 전부 단위 테스트로 검증된다.

**Files:**
- Create: `backend/src/main/java/com/kaldinote/extraction/domain/BrewMeasurement.java`
- Create: `backend/src/main/java/com/kaldinote/extraction/domain/InvalidBrewMeasurementException.java`
- Create: `backend/src/main/java/com/kaldinote/extraction/domain/StrengthZone.java`
- Create: `backend/src/main/java/com/kaldinote/extraction/domain/ExtractionZone.java`
- Create: `backend/src/main/java/com/kaldinote/extraction/domain/ExtractionAnalysis.java`
- Create: `backend/src/main/java/com/kaldinote/extraction/domain/ExtractionAnalyzer.java`
- Test: `backend/src/test/java/com/kaldinote/extraction/domain/ExtractionAnalyzerTest.java`

**Interfaces:**
- Consumes: 없음. Spring·JPA 의존 없음.
- Produces:
  - `BrewMeasurement(BigDecimal doseG, BigDecimal waterG, BigDecimal beverageWeightG, BigDecimal tdsPercent)` — 뒤 두 개는 null 가능
  - `BrewMeasurement#yieldMeasurable() → boolean`
  - `ExtractionAnalyzer#analyze(BrewMeasurement) → ExtractionAnalysis`
  - `ExtractionAnalysis(BigDecimal brewRatio, BigDecimal extractionYieldPercent, StrengthZone strengthZone, ExtractionZone extractionZone, String diagnosis)`
  - `ExtractionAnalysis#measured() → boolean`
  - `InvalidBrewMeasurementException`
  - Plan 2의 `BrewLogService`가 이 API를 호출해 응답 DTO를 채운다. `ErrorCode.INVALID_BREW_MEASUREMENT`(400)로 매핑한다.

**계산 규칙:**
```
brewRatio = waterG / doseG                        (1:N의 N)
EY(%)     = (beverageWeightG × tdsPercent) / doseG
```
SCA 이상 구간: TDS **1.15 이상 1.35 이하**, EY **18.0 이상 22.0 이하** (경계 포함).
**구간 분류와 물리 한계 판정은 모두 반올림된 EY 값을 기준으로 한다.**

**입력 검증** — 위반 시 전부 `InvalidBrewMeasurementException`:

| 규칙 | 위치 |
|---|---|
| `doseG > 0` | `BrewMeasurement` 생성자 |
| `waterG > 0` | `BrewMeasurement` 생성자 |
| `beverageWeightG > 0` (null은 정상) | `BrewMeasurement` 생성자 |
| `0 < tdsPercent < 100` (null은 정상) | `BrewMeasurement` 생성자 |
| `beverageWeightG ≤ waterG` | `BrewMeasurement` 생성자 |
| `EY ≤ 30.0` | `ExtractionAnalyzer#analyze` (계산 후에만 알 수 있다) |

> 로스팅 원두는 약 28~30%만 수용성이다. EY가 30%를 넘으면 측정값 오입력이다 — TDS를 `1.25` 대신 `12.5`로 적는 실수가 흔하다.

- [x] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/kaldinote/extraction/domain/ExtractionAnalyzerTest.java`:

```java
package com.kaldinote.extraction.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class ExtractionAnalyzerTest {

  private final ExtractionAnalyzer analyzer = new ExtractionAnalyzer();

  private static BrewMeasurement measurement(
      String dose, String water, String beverage, String tds) {
    return new BrewMeasurement(
        new BigDecimal(dose),
        new BigDecimal(water),
        beverage == null ? null : new BigDecimal(beverage),
        tds == null ? null : new BigDecimal(tds));
  }

  @Nested
  @DisplayName("브루 비율")
  class BrewRatio {

    @Test
    @DisplayName("AC-EXT-01 · 브루 비율은 물량을 원두량으로 나눈 값이다")
    void 물량을_원두량으로_나눈_값이다() {
      // 250 / 15 = 16.666... → 16.7
      assertThat(analyzer.analyze(measurement("15", "250", null, null)).brewRatio())
          .isEqualByComparingTo("16.7");
    }

    @Test
    @DisplayName("AC-EXT-02 · TDS가 없어도 비율은 항상 계산된다")
    void TDS가_없어도_비율은_항상_계산된다() {
      ExtractionAnalysis result = analyzer.analyze(measurement("20", "300", null, null));

      assertThat(result.brewRatio()).isEqualByComparingTo("15.0");
      assertThat(result.measured()).isFalse();
    }
  }

  @Nested
  @DisplayName("추출 수율")
  class Yield {

    @Test
    @DisplayName("AC-EXT-03 · 음료 중량과 TDS로 수율을 계산한다")
    void 음료중량과_TDS로_수율을_계산한다() {
      // (250 × 1.35) / 15 = 22.5
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "250", "250", "1.35"));

      assertThat(result.extractionYieldPercent()).isEqualByComparingTo("22.5");
      assertThat(result.measured()).isTrue();
    }

    @Test
    @DisplayName("AC-EXT-04 · 두 축이 모두 이상 구간이면 IDEAL로 분류된다")
    void 이상적인_추출은_IDEAL_구간에_들어간다() {
      // (240 × 1.25) / 15 = 20.0
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "300", "240", "1.25"));

      assertThat(result.extractionYieldPercent()).isEqualByComparingTo("20.0");
      assertThat(result.extractionZone()).isEqualTo(ExtractionZone.IDEAL);
      assertThat(result.strengthZone()).isEqualTo(StrengthZone.IDEAL);
    }

    @Test
    @DisplayName("AC-EXT-05 · TDS가 없으면 수율과 구간이 모두 null이다")
    void TDS가_없으면_수율과_구간이_모두_null이다() {
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "250", "240", null));

      assertThat(result.extractionYieldPercent()).isNull();
      assertThat(result.extractionZone()).isNull();
      assertThat(result.strengthZone()).isNull();
      assertThat(result.diagnosis()).contains("TDS");
    }

    @Test
    @DisplayName("AC-EXT-06 · 음료 중량이 없으면 수율을 계산하지 않는다")
    void 음료중량이_없으면_수율을_계산하지_않는다() {
      assertThat(analyzer.analyze(measurement("15", "250", null, "1.25")).extractionYieldPercent())
          .isNull();
    }
  }

  @Nested
  @DisplayName("SCA 구간 경계값")
  class Boundaries {

    @Test
    @DisplayName("AC-EXT-10 · 수율 18.0은 이상 구간에 포함된다")
    void 수율_18_0은_IDEAL이다() {
      // (216 × 1.25) / 15 = 18.0
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "300", "216", "1.25"));

      assertThat(result.extractionYieldPercent()).isEqualByComparingTo("18.0");
      assertThat(result.extractionZone()).isEqualTo(ExtractionZone.IDEAL);
    }

    @Test
    @DisplayName("AC-EXT-11 · 수율 22.0은 이상 구간에 포함된다")
    void 수율_22_0은_IDEAL이다() {
      // (264 × 1.25) / 15 = 22.0
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "300", "264", "1.25"));

      assertThat(result.extractionYieldPercent()).isEqualByComparingTo("22.0");
      assertThat(result.extractionZone()).isEqualTo(ExtractionZone.IDEAL);
    }

    @Test
    @DisplayName("AC-EXT-12 · 수율 17.9는 과소추출이다")
    void 수율_17_9는_과소추출이다() {
      // (214.8 × 1.25) / 15 = 17.9
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "300", "214.8", "1.25"));

      assertThat(result.extractionZone()).isEqualTo(ExtractionZone.UNDER);
      assertThat(result.diagnosis()).contains("곱게");
    }

    @Test
    @DisplayName("AC-EXT-13 · 수율 22.1은 과다추출이다")
    void 수율_22_1은_과다추출이다() {
      // (265.2 × 1.25) / 15 = 22.1
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "300", "265.2", "1.25"));

      assertThat(result.extractionZone()).isEqualTo(ExtractionZone.OVER);
      assertThat(result.diagnosis()).contains("굵게");
    }

    @Test
    @DisplayName("AC-EXT-14 · TDS 1.15는 이상 구간에 포함된다")
    void TDS_1_15는_IDEAL이다() {
      assertThat(analyzer.analyze(measurement("15", "300", "250", "1.15")).strengthZone())
          .isEqualTo(StrengthZone.IDEAL);
    }

    @Test
    @DisplayName("AC-EXT-15 · TDS 1.35는 이상 구간에 포함된다")
    void TDS_1_35는_IDEAL이다() {
      assertThat(analyzer.analyze(measurement("15", "300", "250", "1.35")).strengthZone())
          .isEqualTo(StrengthZone.IDEAL);
    }

    @Test
    @DisplayName("AC-EXT-16 · TDS 1.14는 농도가 옅다")
    void TDS_1_14는_농도가_옅다() {
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "300", "250", "1.14"));

      assertThat(result.strengthZone()).isEqualTo(StrengthZone.WEAK);
      assertThat(result.diagnosis()).contains("물을 줄여");
    }

    @Test
    @DisplayName("AC-EXT-17 · TDS 1.36은 농도가 진하다")
    void TDS_1_36은_농도가_진하다() {
      assertThat(analyzer.analyze(measurement("15", "300", "250", "1.36")).strengthZone())
          .isEqualTo(StrengthZone.STRONG);
    }

    @Test
    @DisplayName("AC-EXT-18 · 수율 30.0은 허용된다")
    void 수율_30_0은_허용된다() {
      // (250 × 1.8) / 15 = 30.0 — 물리 한계의 경계는 포함
      assertThat(analyzer.analyze(measurement("15", "300", "250", "1.8")).extractionYieldPercent())
          .isEqualByComparingTo("30.0");
    }

    @Test
    @DisplayName("AC-EXT-19 · 수율이 30.0을 넘으면 거부한다")
    void 수율이_30을_넘으면_거부한다() {
      // (251 × 1.8) / 15 = 30.12 → 30.1
      assertThatThrownBy(() -> analyzer.analyze(measurement("15", "300", "251", "1.8")))
          .isInstanceOf(InvalidBrewMeasurementException.class);
    }
  }

  @Nested
  @DisplayName("진단 문구")
  class Diagnosis {

    @Test
    @DisplayName("AC-EXT-07 · 이상 구간이면 기준으로 삼으라고 안내한다")
    void 이상_구간이면_기준으로_삼으라고_안내한다() {
      assertThat(analyzer.analyze(measurement("15", "300", "240", "1.25")).diagnosis())
          .contains("이상적");
    }

    @Test
    @DisplayName("AC-EXT-08 · 추출과 농도가 모두 벗어나면 두 진단을 함께 준다")
    void 추출과_농도가_모두_벗어나면_두_진단을_함께_준다() {
      // (240 × 1.45) / 15 = 23.2 → 과다추출 + 진한 농도
      ExtractionAnalysis result = analyzer.analyze(measurement("15", "300", "240", "1.45"));

      assertThat(result.extractionYieldPercent()).isEqualByComparingTo("23.2");
      assertThat(result.extractionZone()).isEqualTo(ExtractionZone.OVER);
      assertThat(result.strengthZone()).isEqualTo(StrengthZone.STRONG);
      assertThat(result.diagnosis()).contains("굵게").contains("물을 늘려");
    }
  }

  @Nested
  @DisplayName("입력 검증")
  class Validation {

    @Test
    @DisplayName("AC-EXT-30 · 원두량이 0 이하면 거부한다")
    void 원두량이_0이면_거부한다() {
      assertThatThrownBy(() -> measurement("0", "250", null, null))
          .isInstanceOf(InvalidBrewMeasurementException.class);
    }

    @Test
    @DisplayName("AC-EXT-31 · 물량이 0 이하면 거부한다")
    void 물량이_0이면_거부한다() {
      assertThatThrownBy(() -> measurement("15", "0", null, null))
          .isInstanceOf(InvalidBrewMeasurementException.class);
    }

    @Test
    @DisplayName("AC-EXT-32 · 음료 중량이 0 이하면 거부한다")
    void 음료중량이_0이면_거부한다() {
      assertThatThrownBy(() -> measurement("15", "250", "0", "1.25"))
          .isInstanceOf(InvalidBrewMeasurementException.class);
    }

    @Test
    @DisplayName("AC-EXT-33 · TDS가 0 이하면 거부한다")
    void TDS가_0이면_거부한다() {
      assertThatThrownBy(() -> measurement("15", "250", "240", "0"))
          .isInstanceOf(InvalidBrewMeasurementException.class);
    }

    @Test
    @DisplayName("AC-EXT-34 · TDS가 100 이상이면 거부한다")
    void TDS가_100이면_거부한다() {
      assertThatThrownBy(() -> measurement("15", "250", "240", "100"))
          .isInstanceOf(InvalidBrewMeasurementException.class);
    }

    @Test
    @DisplayName("AC-EXT-35 · 음료가 물보다 많으면 거부한다")
    void 음료가_물보다_많으면_거부한다() {
      // 원두가 물을 머금으므로 음료가 부은 물보다 많을 수 없다
      assertThatThrownBy(() -> measurement("15", "250", "251", "1.25"))
          .isInstanceOf(InvalidBrewMeasurementException.class);
    }

    @Test
    @DisplayName("AC-EXT-36 · 음료와 물이 같은 것은 허용한다")
    void 음료와_물이_같으면_허용한다() {
      // (250 × 1.25) / 15 = 20.833... → 20.8
      assertThat(analyzer.analyze(measurement("15", "250", "250", "1.25")).extractionYieldPercent())
          .isEqualByComparingTo("20.8");
    }
  }
}
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
./gradlew test --tests '*ExtractionAnalyzerTest'
```

Expected: 컴파일 실패. `BrewMeasurement` 등 심볼 없음.

- [x] **Step 3: VO와 enum 작성**

`backend/src/main/java/com/kaldinote/extraction/domain/InvalidBrewMeasurementException.java`:

```java
package com.kaldinote.extraction.domain;

/**
 * 추출 측정값이 물리적으로 불가능할 때 발생한다. HTTP 400으로 매핑된다.
 *
 * <p>{@code IllegalArgumentException}을 쓰지 않는 이유: 그 예외를 통째로 잡는 핸들러를 두면
 * 다른 곳의 진짜 프로그래밍 버그까지 400으로 숨겨서 500이 나야 할 상황을 조용히 넘긴다.
 */
public class InvalidBrewMeasurementException extends RuntimeException {

  public InvalidBrewMeasurementException(String message) {
    super(message);
  }
}
```

`backend/src/main/java/com/kaldinote/extraction/domain/BrewMeasurement.java`:

```java
package com.kaldinote.extraction.domain;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * 추출 실측값.
 *
 * @param beverageWeightG 최종 음료 중량(g). 재지 않았으면 null
 * @param tdsPercent      리프랙토미터 측정 TDS(%). 없으면 null — 없는 게 기본값이다
 */
public record BrewMeasurement(
    BigDecimal doseG, BigDecimal waterG, BigDecimal beverageWeightG, BigDecimal tdsPercent) {

  private static final BigDecimal TDS_UPPER_EXCLUSIVE = new BigDecimal("100");

  public BrewMeasurement {
    Objects.requireNonNull(doseG, "doseG는 null일 수 없습니다");
    Objects.requireNonNull(waterG, "waterG는 null일 수 없습니다");

    requirePositive(doseG, "원두량");
    requirePositive(waterG, "물량");

    if (beverageWeightG != null) {
      requirePositive(beverageWeightG, "음료 중량");
      // 원두가 물을 머금으므로 음료가 부은 물보다 많을 수 없다. 같은 값은 허용한다.
      if (beverageWeightG.compareTo(waterG) > 0) {
        throw new InvalidBrewMeasurementException(
            "음료 중량(%s g)이 물량(%s g)보다 많을 수 없습니다.".formatted(beverageWeightG, waterG));
      }
    }

    if (tdsPercent != null) {
      requirePositive(tdsPercent, "TDS");
      if (tdsPercent.compareTo(TDS_UPPER_EXCLUSIVE) >= 0) {
        throw new InvalidBrewMeasurementException(
            "TDS는 퍼센트값이므로 100 미만이어야 합니다: %s".formatted(tdsPercent));
      }
    }
  }

  private static void requirePositive(BigDecimal value, String label) {
    if (value.signum() <= 0) {
      throw new InvalidBrewMeasurementException("%s은(는) 0보다 커야 합니다: %s".formatted(label, value));
    }
  }

  /** 수율 계산에 필요한 값이 모두 있는가. */
  public boolean yieldMeasurable() {
    return beverageWeightG != null && tdsPercent != null;
  }
}
```

`StrengthZone.java` / `ExtractionZone.java`:

```java
package com.kaldinote.extraction.domain;

/** SCA Brewing Control Chart 세로축 — 농도(TDS). */
public enum StrengthZone {
  WEAK,
  IDEAL,
  STRONG
}
```

```java
package com.kaldinote.extraction.domain;

/** SCA Brewing Control Chart 가로축 — 추출 수율. */
public enum ExtractionZone {
  UNDER,
  IDEAL,
  OVER
}
```

`backend/src/main/java/com/kaldinote/extraction/domain/ExtractionAnalysis.java`:

```java
package com.kaldinote.extraction.domain;

import java.math.BigDecimal;

/**
 * 추출 분석 결과.
 *
 * <p>TDS를 재지 않은 경우 {@code extractionYieldPercent}·{@code strengthZone}·
 * {@code extractionZone}이 모두 null이고 {@code brewRatio}만 채워진다.
 * 리프랙토미터가 없는 게 기본 상황이므로 이 상태에서도 앱은 온전히 동작해야 한다.
 */
public record ExtractionAnalysis(
    BigDecimal brewRatio,
    BigDecimal extractionYieldPercent,
    StrengthZone strengthZone,
    ExtractionZone extractionZone,
    String diagnosis) {

  public boolean measured() {
    return extractionYieldPercent != null;
  }
}
```

- [x] **Step 4: 분석기 구현**

`backend/src/main/java/com/kaldinote/extraction/domain/ExtractionAnalyzer.java`:

```java
package com.kaldinote.extraction.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 브루 비율과 추출 수율을 계산해 SCA Brewing Control Chart 좌표로 분류한다.
 *
 * <p>EY(%) = (음료중량_g × TDS%) / 원두량_g
 * <p>이상 구간: TDS 1.15~1.35%, EY 18~22% (경계 포함)
 *
 * <p>구간 분류와 물리 한계 판정은 모두 반올림된 EY 값을 기준으로 한다.
 */
public class ExtractionAnalyzer {

  public static final BigDecimal TDS_MIN = new BigDecimal("1.15");
  public static final BigDecimal TDS_MAX = new BigDecimal("1.35");
  public static final BigDecimal EY_MIN = new BigDecimal("18.0");
  public static final BigDecimal EY_MAX = new BigDecimal("22.0");
  /** 로스팅 원두는 약 28~30%만 수용성이다. 이를 넘으면 측정값 오입력이다. */
  public static final BigDecimal EY_PHYSICAL_LIMIT = new BigDecimal("30.0");

  private static final int RATIO_SCALE = 1;
  private static final int YIELD_SCALE = 1;
  private static final int DIVISION_SCALE = 6;

  private static final String NO_TDS =
      "TDS 측정값이 없어 추출 수율을 계산할 수 없습니다. 비율과 관능 평가로 판단하세요.";
  private static final String IDEAL = "이상적인 구간입니다. 이 레시피를 기준으로 삼으세요.";
  private static final String UNDER_EXTRACTED =
      "추출이 부족합니다. 분쇄를 곱게 하거나 물 온도를 올리거나 추출 시간을 늘려보세요.";
  private static final String OVER_EXTRACTED =
      "과다추출입니다. 분쇄를 굵게 하거나 물 온도를 낮추거나 추출 시간을 줄여보세요.";
  private static final String TOO_WEAK = "농도가 옅습니다. 물을 줄여 비율을 진하게 조정해보세요.";
  private static final String TOO_STRONG = "농도가 진합니다. 물을 늘려 비율을 옅게 조정해보세요.";

  public ExtractionAnalysis analyze(BrewMeasurement m) {
    BigDecimal brewRatio =
        m.waterG()
            .divide(m.doseG(), DIVISION_SCALE, RoundingMode.HALF_UP)
            .setScale(RATIO_SCALE, RoundingMode.HALF_UP);

    if (!m.yieldMeasurable()) {
      return new ExtractionAnalysis(brewRatio, null, null, null, NO_TDS);
    }

    BigDecimal yield =
        m.beverageWeightG()
            .multiply(m.tdsPercent())
            .divide(m.doseG(), DIVISION_SCALE, RoundingMode.HALF_UP)
            .setScale(YIELD_SCALE, RoundingMode.HALF_UP);

    if (yield.compareTo(EY_PHYSICAL_LIMIT) > 0) {
      throw new InvalidBrewMeasurementException(
          "추출 수율 %s%%는 물리적으로 불가능합니다(최대 %s%%). 측정값을 다시 확인하세요."
              .formatted(yield, EY_PHYSICAL_LIMIT));
    }

    StrengthZone strength = classifyStrength(m.tdsPercent());
    ExtractionZone extraction = classifyExtraction(yield);

    return new ExtractionAnalysis(
        brewRatio, yield, strength, extraction, diagnose(strength, extraction));
  }

  private StrengthZone classifyStrength(BigDecimal tds) {
    if (tds.compareTo(TDS_MIN) < 0) return StrengthZone.WEAK;
    if (tds.compareTo(TDS_MAX) > 0) return StrengthZone.STRONG;
    return StrengthZone.IDEAL;
  }

  private ExtractionZone classifyExtraction(BigDecimal yield) {
    if (yield.compareTo(EY_MIN) < 0) return ExtractionZone.UNDER;
    if (yield.compareTo(EY_MAX) > 0) return ExtractionZone.OVER;
    return ExtractionZone.IDEAL;
  }

  /** 추출 진단이 우선, 농도 진단은 뒤에 덧붙인다. 둘 다 이상이면 한 문장만 낸다. */
  private String diagnose(StrengthZone strength, ExtractionZone extraction) {
    if (strength == StrengthZone.IDEAL && extraction == ExtractionZone.IDEAL) {
      return IDEAL;
    }

    StringBuilder sb = new StringBuilder();
    switch (extraction) {
      case UNDER -> sb.append(UNDER_EXTRACTED);
      case OVER -> sb.append(OVER_EXTRACTED);
      case IDEAL -> {}
    }
    switch (strength) {
      case WEAK -> appendSentence(sb, TOO_WEAK);
      case STRONG -> appendSentence(sb, TOO_STRONG);
      case IDEAL -> {}
    }
    return sb.toString();
  }

  private void appendSentence(StringBuilder sb, String sentence) {
    if (!sb.isEmpty()) {
      sb.append(" ");
    }
    sb.append(sentence);
  }
}
```

- [x] **Step 5: 테스트 실행 — 통과 확인**

```bash
./gradlew test --tests '*ExtractionAnalyzerTest'
```

Expected: PASS, 25 tests.

- [x] **Step 6: AC 커버리지 검사 + 커밋**

```bash
./gradlew test
(cd .. && ./scripts/check-spec-coverage.sh)
```

Expected: 두 스펙 모두 `status: 초안`이라 아직 건너뛴다. Task 11까지 끝낸 뒤 `status`를 `구현완료`로 바꾸면 그때부터 강제된다.

```bash
cd .. && git add backend/src && git commit -m "feat(extraction): 추출 수율·SCA 구간 분석 순수 도메인 추가 (TDS 없어도 동작)" && cd backend
```

---

## Task 4: 사용자 스키마 + 엔티티

**Files:**
- Create: `backend/src/main/resources/db/migration/V1__create_user_tables.sql`
- Create: `backend/src/main/java/com/kaldinote/common/entity/BaseTimeEntity.java`
- Create: `backend/src/main/java/com/kaldinote/common/config/JpaAuditingConfig.java`
- Create: `backend/src/main/java/com/kaldinote/user/domain/User.java`, `UserRole.java`, `Follow.java`, `FollowId.java`
- Create: `backend/src/main/java/com/kaldinote/user/infrastructure/UserRepository.java`, `FollowRepository.java`
- Test: `backend/src/test/java/com/kaldinote/user/infrastructure/UserRepositoryTest.java`

**Interfaces:**
- Consumes: `AbstractIntegrationTest` (Task 1)
- Produces:
  - `User` — `User.create(String email, String nickname, String profileImageUrl) → User`, `user.getId()`, `getRole()`, `promoteToAdmin()`
  - `UserRole` — `USER`, `ADMIN`
  - `UserRepository extends JpaRepository<User, Long>`
  - `FollowRepository#existsMutualFollow(Long a, Long b) → boolean` — Plan 2의 FRIENDS 공개범위 판정이 이걸 쓴다
  - `BaseTimeEntity` — `createdAt`, `updatedAt` (`Instant`)

> **`email`은 nullable이다.** 카카오는 이메일 제공 동의가 **선택 항목**이라 null이 올 수 있다. 사용자 식별은 `(provider, provider_user_id)`가 담당한다. `NOT NULL UNIQUE`로 잡으면 카카오 가입이 통째로 실패한다.

- [x] **Step 1: 마이그레이션 작성**

`backend/src/main/resources/db/migration/V1__create_user_tables.sql`:

```sql
CREATE TABLE users (
    id                BIGSERIAL PRIMARY KEY,
    email             VARCHAR(255),
    nickname          VARCHAR(50)  NOT NULL,
    profile_image_url TEXT,
    role              VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 카카오는 이메일 제공 동의가 선택이라 null이 올 수 있다.
-- null이 아닌 값끼리만 유일성을 보장한다.
CREATE UNIQUE INDEX uq_users_email ON users (email) WHERE email IS NOT NULL;

CREATE TABLE user_oauth_accounts (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider         VARCHAR(20)  NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_oauth_provider_user UNIQUE (provider, provider_user_id)
);
CREATE INDEX idx_oauth_user_id ON user_oauth_accounts (user_id);

CREATE TABLE refresh_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user_id ON refresh_tokens (user_id);

CREATE TABLE follows (
    follower_user_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    followee_user_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_user_id, followee_user_id),
    CONSTRAINT chk_no_self_follow CHECK (follower_user_id <> followee_user_id)
);
CREATE INDEX idx_follows_followee ON follows (followee_user_id);
```

- [x] **Step 2: 실패하는 리포지토리 테스트 작성**

`backend/src/test/java/com/kaldinote/user/infrastructure/UserRepositoryTest.java`:

```java
package com.kaldinote.user.infrastructure;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.user.domain.Follow;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

class UserRepositoryTest extends AbstractIntegrationTest {

    @Autowired private UserRepository userRepository;
    @Autowired private FollowRepository followRepository;

    @Test
    void 사용자를_저장하면_기본_역할은_USER다() {
        User saved = userRepository.save(User.create("a@example.com", "노스원", null));

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getRole()).isEqualTo(UserRole.USER);
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    void 이메일이_없어도_저장된다() {
        // 카카오는 이메일 제공 동의가 선택이라 null이 올 수 있다
        User saved = userRepository.save(User.create(null, "카카오유저", null));

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getEmail()).isNull();
    }

    @Test
    void 이메일이_없는_사용자는_여러_명_저장할_수_있다() {
        userRepository.save(User.create(null, "유저1", null));
        userRepository.save(User.create(null, "유저2", null));
        userRepository.flush();

        assertThat(userRepository.count()).isEqualTo(2);
    }

    @Test
    void 관리자로_승격할_수_있다() {
        User user = userRepository.save(User.create("admin@example.com", "관리자", null));

        user.promoteToAdmin();
        userRepository.flush();

        assertThat(userRepository.findById(user.getId()).orElseThrow().getRole())
                .isEqualTo(UserRole.ADMIN);
    }

    @Test
    void 서로_팔로우해야_상호_팔로우로_판정된다() {
        User a = userRepository.save(User.create("a2@example.com", "A", null));
        User b = userRepository.save(User.create("b2@example.com", "B", null));

        followRepository.save(Follow.of(a.getId(), b.getId()));
        followRepository.flush();
        assertThat(followRepository.existsMutualFollow(a.getId(), b.getId())).isFalse();

        followRepository.save(Follow.of(b.getId(), a.getId()));
        followRepository.flush();
        assertThat(followRepository.existsMutualFollow(a.getId(), b.getId())).isTrue();
    }
}
```

- [x] **Step 3: 테스트 실행 — 실패 확인**

```bash
./gradlew test --tests '*UserRepositoryTest'
```

Expected: 컴파일 실패. `User`, `UserRole`, `Follow`, `UserRepository`, `FollowRepository` 심볼 없음.

- [x] **Step 4: 공통 엔티티와 감사 설정 작성**

`backend/src/main/java/com/kaldinote/common/entity/BaseTimeEntity.java`:

```java
package com.kaldinote.common.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import java.time.Instant;
import lombok.Getter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** created_at / updated_at 공통 매핑. 시간은 전부 UTC(Instant)다. */
@Getter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseTimeEntity {

  @CreatedDate
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @LastModifiedDate
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;
}
```

`backend/src/main/java/com/kaldinote/common/config/JpaAuditingConfig.java`:

```java
package com.kaldinote.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@Configuration
@EnableJpaAuditing
public class JpaAuditingConfig {}
```

- [x] **Step 5: 사용자 도메인 작성**

`backend/src/main/java/com/kaldinote/user/domain/UserRole.java`:

```java
package com.kaldinote.user.domain;

/**
 * 사용자 역할. 관리자 API·화면은 후속 단계지만 이 컬럼과 JWT role claim은 MVP에 포함한다.
 * 나중에 추가하면 발급된 토큰이 전부 무효화되고 전체 인가 정책을 다시 훑어야 한다.
 */
public enum UserRole {
  USER,
  ADMIN
}
```

`backend/src/main/java/com/kaldinote/user/domain/User.java`:

```java
package com.kaldinote.user.domain;

import com.kaldinote.common.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  /** 카카오는 이메일 제공 동의가 선택이라 null일 수 있다. 식별자로 쓰지 않는다. */
  @Column(length = 255)
  private String email;

  @Column(nullable = false, length = 50)
  private String nickname;

  @Column(name = "profile_image_url", columnDefinition = "text")
  private String profileImageUrl;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private UserRole role;

  private User(String email, String nickname, String profileImageUrl) {
    this.email = email;
    this.nickname = nickname;
    this.profileImageUrl = profileImageUrl;
    this.role = UserRole.USER;
  }

  public static User create(String email, String nickname, String profileImageUrl) {
    return new User(email, nickname, profileImageUrl);
  }

  public void promoteToAdmin() {
    this.role = UserRole.ADMIN;
  }

  public void updateProfile(String nickname, String profileImageUrl) {
    this.nickname = nickname;
    this.profileImageUrl = profileImageUrl;
  }
}
```

`backend/src/main/java/com/kaldinote/user/domain/FollowId.java`:

```java
package com.kaldinote.user.domain;

import java.io.Serializable;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FollowId implements Serializable {

  private Long followerUserId;
  private Long followeeUserId;

  public FollowId(Long followerUserId, Long followeeUserId) {
    this.followerUserId = followerUserId;
    this.followeeUserId = followeeUserId;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof FollowId other)) return false;
    return Objects.equals(followerUserId, other.followerUserId)
        && Objects.equals(followeeUserId, other.followeeUserId);
  }

  @Override
  public int hashCode() {
    return Objects.hash(followerUserId, followeeUserId);
  }
}
```

`backend/src/main/java/com/kaldinote/user/domain/Follow.java`:

```java
package com.kaldinote.user.domain;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 단방향 팔로우. FRIENDS 공개범위는 상호 팔로우일 때만 성립한다. */
@Entity
@Table(name = "follows")
@IdClass(FollowId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Follow {

  @Id
  @Column(name = "follower_user_id")
  private Long followerUserId;

  @Id
  @Column(name = "followee_user_id")
  private Long followeeUserId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  private Follow(Long followerUserId, Long followeeUserId) {
    if (followerUserId.equals(followeeUserId)) {
      throw new IllegalArgumentException("자기 자신을 팔로우할 수 없습니다");
    }
    this.followerUserId = followerUserId;
    this.followeeUserId = followeeUserId;
    this.createdAt = Instant.now();
  }

  public static Follow of(Long followerUserId, Long followeeUserId) {
    return new Follow(followerUserId, followeeUserId);
  }
}
```

- [x] **Step 6: 리포지토리 작성**

`backend/src/main/java/com/kaldinote/user/infrastructure/UserRepository.java`:

```java
package com.kaldinote.user.infrastructure;

import com.kaldinote.user.domain.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

  Optional<User> findByEmail(String email);
}
```

`backend/src/main/java/com/kaldinote/user/infrastructure/FollowRepository.java`:

```java
package com.kaldinote.user.infrastructure;

import com.kaldinote.user.domain.Follow;
import com.kaldinote.user.domain.FollowId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FollowRepository extends JpaRepository<Follow, FollowId> {

  /** 양방향 팔로우가 모두 존재할 때만 true. FRIENDS 공개범위 판정에 쓴다. */
  @Query(
      """
      select count(f) = 2 from Follow f
      where (f.followerUserId = :a and f.followeeUserId = :b)
         or (f.followerUserId = :b and f.followeeUserId = :a)
      """)
  boolean existsMutualFollow(@Param("a") Long a, @Param("b") Long b);
}
```

- [x] **Step 7: 테스트 실행 — 통과 확인**

```bash
./gradlew test --tests '*UserRepositoryTest'
```

Expected: PASS, 5 tests. Flyway가 V1을 적용하는 로그가 보인다.

- [x] **Step 8: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(user): 사용자·팔로우 스키마와 엔티티 추가 (카카오 대응으로 email은 nullable)" && cd backend
```

---

## Task 5: Security 기본 설정 (CSRF 비활성 + 공통 에러 응답)

**Files:**
- Modify: `backend/build.gradle.kts` — security 의존성 추가
- Create: `backend/src/main/java/com/kaldinote/common/security/SecurityConfig.java`
- Create: `backend/src/main/java/com/kaldinote/common/error/ErrorCode.java`, `BusinessException.java`, `ErrorResponse.java`, `GlobalExceptionHandler.java`
- Create: `backend/src/test/java/com/kaldinote/common/security/SecurityConfigTest.java`
- Create: `backend/src/test/java/com/kaldinote/testsupport/DummyController.java` (테스트 전용 엔드포인트)

**Interfaces:**
- Consumes: `AbstractIntegrationTest` (Task 1)
- Produces:
  - `SecurityConfig` — `SecurityFilterChain` 빈. Task 6이 여기에 JWT 리소스 서버를 붙인다
  - `ErrorCode` enum — `code`(String), `status`(HttpStatus), `defaultMessage`(String) 보유
  - `BusinessException(ErrorCode)` / `BusinessException(ErrorCode, String)`
  - `ErrorResponse(String code, String message, List<FieldError> fieldErrors)`
  - 모든 도메인이 `BusinessException`을 던지면 `GlobalExceptionHandler`가 `ErrorResponse`로 변환한다

> **★ 이 태스크의 핵심은 CSRF 비활성화다.** Spring Security 7은 CSRF가 기본 활성이라, 끄지 않으면 stateless REST API의 모든 POST/PUT/DELETE가 403이 된다. 테스트로 이를 고정한다.

- [x] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/kaldinote/testsupport/DummyController.java`:

```java
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
```

`backend/src/test/java/com/kaldinote/common/security/SecurityConfigTest.java`:

```java
package com.kaldinote.common.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;

class SecurityConfigTest extends AbstractIntegrationTest {

  @Test
  void 헬스체크는_인증_없이_접근할_수_있다() throws Exception {
    mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
  }

  @Test
  void 인증이_필요한_엔드포인트는_토큰_없이_401이다() throws Exception {
    mockMvc.perform(get("/test-support/secured")).andExpect(status().isUnauthorized());
  }

  @Test
  void CSRF_토큰_없는_POST가_403이_아니어야_한다() throws Exception {
    // Spring Security 7은 CSRF가 기본 활성이다. 끄지 않으면 403이 뜬다.
    // stateless REST API이므로 반드시 비활성화해야 한다.
    mockMvc.perform(post("/test-support/secured")).andExpect(status().isUnauthorized());
  }
}
```

> 세 번째 테스트가 **403이 아니라 401**을 기대하는 것이 핵심이다. CSRF가 켜져 있으면 인증 여부와 무관하게 403이 먼저 뜬다.

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
./gradlew test --tests '*SecurityConfigTest'
```

Expected: FAIL. 아직 security 의존성이 없어 모든 엔드포인트가 200을 반환하므로 2·3번 테스트가 깨진다.

- [x] **Step 3: 의존성 추가**

`backend/build.gradle.kts`의 `dependencies` 블록에 추가:

```kotlin
implementation("org.springframework.boot:spring-boot-starter-security")
implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
testImplementation("org.springframework.security:spring-security-test")
```

버전은 Spring Boot BOM이 관리하므로 명시하지 않는다.

- [x] **Step 4: 에러 응답 골격 작성**

`backend/src/main/java/com/kaldinote/common/error/ErrorCode.java`:

```java
package com.kaldinote.common.error;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/** 프론트가 분기하는 기준. 문구가 아니라 code로 판단하게 한다. */
@Getter
@RequiredArgsConstructor
public enum ErrorCode {
  INVALID_REQUEST(HttpStatus.BAD_REQUEST, "요청 값이 올바르지 않습니다."),
  UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
  FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다."),
  NOT_FOUND(HttpStatus.NOT_FOUND, "대상을 찾을 수 없습니다."),
  INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다."),

  DUPLICATE_NAME(HttpStatus.CONFLICT, "이미 등록된 이름입니다."),

  // 분쇄도 환산 — docs/specs/2026-08-14-grind-conversion.md
  GRIND_NOT_CONVERTIBLE(
      HttpStatus.UNPROCESSABLE_ENTITY, "클릭당 마이크론 정보가 없어 분쇄도를 환산할 수 없습니다."),
  GRIND_SETTING_OUT_OF_RANGE(HttpStatus.BAD_REQUEST, "이 그라인더에서 쓸 수 없는 설정값입니다."),

  // 추출 분석 — docs/specs/2026-08-14-extraction-analysis.md
  INVALID_BREW_MEASUREMENT(HttpStatus.BAD_REQUEST, "추출 측정값이 올바르지 않습니다."),

  OAUTH_TOKEN_EXCHANGE_FAILED(HttpStatus.UNAUTHORIZED, "소셜 로그인에 실패했습니다."),
  REFRESH_TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "다시 로그인해 주세요.");

  private final HttpStatus status;
  private final String defaultMessage;
}
```

`backend/src/main/java/com/kaldinote/common/error/BusinessException.java`:

```java
package com.kaldinote.common.error;

import lombok.Getter;

@Getter
public class BusinessException extends RuntimeException {

  private final ErrorCode errorCode;

  public BusinessException(ErrorCode errorCode) {
    super(errorCode.getDefaultMessage());
    this.errorCode = errorCode;
  }

  public BusinessException(ErrorCode errorCode, String message) {
    super(message);
    this.errorCode = errorCode;
  }
}
```

`backend/src/main/java/com/kaldinote/common/error/ErrorResponse.java`:

```java
package com.kaldinote.common.error;

import java.util.List;

/** 전 API 공통 에러 형식. message는 사용자에게 그대로 보여줄 수 있는 한국어다. */
public record ErrorResponse(String code, String message, List<FieldError> fieldErrors) {

  public record FieldError(String field, String message) {}

  public static ErrorResponse of(ErrorCode code, String message) {
    return new ErrorResponse(code.name(), message, List.of());
  }

  public static ErrorResponse of(ErrorCode code, String message, List<FieldError> fieldErrors) {
    return new ErrorResponse(code.name(), message, fieldErrors);
  }
}
```

`backend/src/main/java/com/kaldinote/common/error/GlobalExceptionHandler.java`:

```java
package com.kaldinote.common.error;

import com.kaldinote.extraction.domain.InvalidBrewMeasurementException;
import com.kaldinote.grind.domain.GrindNotConvertibleException;
import com.kaldinote.grind.domain.GrindSettingOutOfRangeException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(BusinessException.class)
  public ResponseEntity<ErrorResponse> handleBusiness(BusinessException e) {
    ErrorCode code = e.getErrorCode();
    log.warn("업무 예외 code={} message={}", code.name(), e.getMessage());
    return ResponseEntity.status(code.getStatus())
        .body(ErrorResponse.of(code, e.getMessage()));
  }

  @ExceptionHandler(GrindNotConvertibleException.class)
  public ResponseEntity<ErrorResponse> handleGrindNotConvertible(GrindNotConvertibleException e) {
    return toResponse(ErrorCode.GRIND_NOT_CONVERTIBLE, e.getMessage());
  }

  @ExceptionHandler(GrindSettingOutOfRangeException.class)
  public ResponseEntity<ErrorResponse> handleGrindOutOfRange(GrindSettingOutOfRangeException e) {
    return toResponse(ErrorCode.GRIND_SETTING_OUT_OF_RANGE, e.getMessage());
  }

  @ExceptionHandler(InvalidBrewMeasurementException.class)
  public ResponseEntity<ErrorResponse> handleBrewMeasurement(InvalidBrewMeasurementException e) {
    return toResponse(ErrorCode.INVALID_BREW_MEASUREMENT, e.getMessage());
  }

  private ResponseEntity<ErrorResponse> toResponse(ErrorCode code, String message) {
    return ResponseEntity.status(code.getStatus()).body(ErrorResponse.of(code, message));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
    List<ErrorResponse.FieldError> fieldErrors =
        e.getBindingResult().getFieldErrors().stream()
            .map(f -> new ErrorResponse.FieldError(f.getField(), f.getDefaultMessage()))
            .toList();
    ErrorCode code = ErrorCode.INVALID_REQUEST;
    return ResponseEntity.status(code.getStatus())
        .body(ErrorResponse.of(code, code.getDefaultMessage(), fieldErrors));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ErrorResponse> handleUnexpected(Exception e) {
    log.error("처리되지 않은 예외", e);
    ErrorCode code = ErrorCode.INTERNAL_ERROR;
    return ResponseEntity.status(code.getStatus())
        .body(ErrorResponse.of(code, code.getDefaultMessage()));
  }
}
```

- [x] **Step 5: SecurityConfig 작성**

`backend/src/main/java/com/kaldinote/common/security/SecurityConfig.java`:

```java
package com.kaldinote.common.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    return http
        // ★ Spring Security 7은 CSRF가 기본 활성이다.
        //   stateless REST API에서 끄지 않으면 모든 POST/PUT/DELETE가 403이 된다.
        .csrf(csrf -> csrf.disable())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .formLogin(form -> form.disable())
        .httpBasic(basic -> basic.disable())
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers("/actuator/health", "/actuator/info")
                    .permitAll()
                    .requestMatchers("/swagger-ui/**", "/v3/api-docs/**")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/v1/auth/**")
                    .permitAll()
                    .requestMatchers("/test-support/public")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .build();
  }
}
```

- [x] **Step 6: 테스트 실행 — 통과 확인**

```bash
./gradlew test --tests '*SecurityConfigTest'
```

Expected: PASS, 3 tests. 특히 세 번째 테스트가 403이 아닌 401로 통과해야 한다.

- [x] **Step 7: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(common): Security 기본 설정과 공통 에러 응답 추가 (CSRF 비활성화)" && cd backend
```

---

## Task 6: JWT 발급·검증 + ADMIN 인가

**Files:**
- Create: `backend/src/main/java/com/kaldinote/auth/infrastructure/jwt/JwtProperties.java`, `JwtConfig.java`, `JwtTokenProvider.java`
- Create: `backend/src/main/java/com/kaldinote/common/security/AuthenticatedUser.java`, `KaldiJwtAuthenticationConverter.java`, `AuthenticatedUserArgumentResolver.java`
- Modify: `backend/src/main/java/com/kaldinote/common/security/SecurityConfig.java` — 리소스 서버 연결, `/test-support/admin`에 ADMIN 요구
- Modify: `backend/src/main/resources/application.yml`, `application-local.yml` — `kaldi.jwt` 설정
- Test: `backend/src/test/java/com/kaldinote/auth/infrastructure/jwt/JwtTokenProviderTest.java`
- Test: `backend/src/test/java/com/kaldinote/common/security/JwtAuthorizationTest.java`

**Interfaces:**
- Consumes: `UserRole` (Task 4), `SecurityConfig` (Task 5)
- Produces:
  - `JwtTokenProvider#createAccessToken(Long userId, UserRole role) → String`
  - `JwtTokenProvider#createRefreshToken(Long userId) → String`
  - `JwtTokenProvider#getAccessTokenTtl() → Duration`, `getRefreshTokenTtl() → Duration`
  - `JwtTokenProvider#parseUserId(String token) → Long`
  - `AuthenticatedUser(Long id, UserRole role)` — 컨트롤러에서 `@AuthenticationPrincipal AuthenticatedUser user`로 받는다
  - Task 8의 `AuthService`가 토큰 발급에 이걸 쓴다

**JWT 설계:** HS256 대칭키. 별도 라이브러리(jjwt) 없이 Spring Security의 `NimbusJwtEncoder`/`NimbusJwtDecoder`를 쓴다. `sub`에 userId, `role` claim에 역할을 싣는다.

- [x] **Step 1: 실패하는 단위 테스트 작성**

`backend/src/test/java/com/kaldinote/auth/infrastructure/jwt/JwtTokenProviderTest.java`:

```java
package com.kaldinote.auth.infrastructure.jwt;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.user.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

class JwtTokenProviderTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private JwtDecoder jwtDecoder;

  @Test
  void 액세스_토큰에_사용자_ID와_역할이_담긴다() {
    String token = tokenProvider.createAccessToken(42L, UserRole.ADMIN);

    Jwt decoded = jwtDecoder.decode(token);
    assertThat(decoded.getSubject()).isEqualTo("42");
    assertThat(decoded.getClaimAsString("role")).isEqualTo("ADMIN");
  }

  @Test
  void 일반_사용자_토큰의_역할은_USER다() {
    String token = tokenProvider.createAccessToken(1L, UserRole.USER);

    assertThat(jwtDecoder.decode(token).getClaimAsString("role")).isEqualTo("USER");
  }

  @Test
  void 토큰에서_사용자_ID를_읽을_수_있다() {
    String token = tokenProvider.createAccessToken(7L, UserRole.USER);

    assertThat(tokenProvider.parseUserId(token)).isEqualTo(7L);
  }

  @Test
  void 리프레시_토큰은_액세스_토큰보다_오래_유효하다() {
    String access = tokenProvider.createAccessToken(1L, UserRole.USER);
    String refresh = tokenProvider.createRefreshToken(1L);

    assertThat(jwtDecoder.decode(refresh).getExpiresAt())
        .isAfter(jwtDecoder.decode(access).getExpiresAt());
  }

  @Test
  void 리프레시_토큰에는_역할이_담기지_않는다() {
    // 역할은 갱신 시점의 DB 값을 다시 읽는다. 토큰에 박아두면 권한 변경이 반영되지 않는다.
    String refresh = tokenProvider.createRefreshToken(1L);

    assertThat(jwtDecoder.decode(refresh).getClaimAsString("role")).isNull();
  }
}
```

`backend/src/test/java/com/kaldinote/common/security/JwtAuthorizationTest.java`:

```java
package com.kaldinote.common.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.user.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;

class JwtAuthorizationTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;

  private String bearer(String token) {
    return "Bearer " + token;
  }

  @Test
  void 유효한_토큰이면_보호된_엔드포인트에_접근할_수_있다() throws Exception {
    String token = tokenProvider.createAccessToken(1L, UserRole.USER);

    mockMvc
        .perform(get("/test-support/secured").header(HttpHeaders.AUTHORIZATION, bearer(token)))
        .andExpect(status().isOk());
  }

  @Test
  void 잘못된_토큰이면_401이다() throws Exception {
    mockMvc
        .perform(get("/test-support/secured").header(HttpHeaders.AUTHORIZATION, bearer("garbage")))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void 일반_사용자는_관리자_엔드포인트에서_403이다() throws Exception {
    String token = tokenProvider.createAccessToken(1L, UserRole.USER);

    mockMvc
        .perform(get("/test-support/admin").header(HttpHeaders.AUTHORIZATION, bearer(token)))
        .andExpect(status().isForbidden());
  }

  @Test
  void 관리자는_관리자_엔드포인트에_접근할_수_있다() throws Exception {
    String token = tokenProvider.createAccessToken(1L, UserRole.ADMIN);

    mockMvc
        .perform(get("/test-support/admin").header(HttpHeaders.AUTHORIZATION, bearer(token)))
        .andExpect(status().isOk());
  }
}
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
./gradlew test --tests '*JwtTokenProviderTest' --tests '*JwtAuthorizationTest'
```

Expected: 컴파일 실패. `JwtTokenProvider` 심볼 없음.

- [x] **Step 3: 설정 추가**

`application.yml`에 추가:

```yaml
kaldi:
  jwt:
    # HS256은 최소 256비트(32바이트) 키가 필요하다. 운영은 환경변수로 주입한다.
    secret: ${KALDI_JWT_SECRET}
    access-token-ttl: PT30M
    refresh-token-ttl: P14D
    issuer: kaldi-note
```

`application-local.yml`에 추가 (로컬 전용 더미 값):

```yaml
kaldi:
  jwt:
    secret: local-development-only-secret-key-32bytes-minimum
```

`src/test/resources/application-test.yml`에도 동일한 `kaldi.jwt.secret`을 넣는다.

- [x] **Step 4: JWT 설정과 발급기 작성**

`backend/src/main/java/com/kaldinote/auth/infrastructure/jwt/JwtProperties.java`:

```java
package com.kaldinote.auth.infrastructure.jwt;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "kaldi.jwt")
public record JwtProperties(
    String secret, Duration accessTokenTtl, Duration refreshTokenTtl, String issuer) {

  public JwtProperties {
    if (secret == null || secret.getBytes().length < 32) {
      throw new IllegalStateException("kaldi.jwt.secret은 최소 32바이트여야 합니다 (HS256 요구사항)");
    }
  }
}
```

`backend/src/main/java/com/kaldinote/auth/infrastructure/jwt/JwtConfig.java`:

```java
package com.kaldinote.auth.infrastructure.jwt;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;

@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class JwtConfig {

  @Bean
  SecretKey jwtSecretKey(JwtProperties properties) {
    return new SecretKeySpec(properties.secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
  }

  @Bean
  JwtEncoder jwtEncoder(SecretKey key) {
    return new NimbusJwtEncoder(new ImmutableSecret<>(key));
  }

  @Bean
  JwtDecoder jwtDecoder(SecretKey key) {
    return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
  }
}
```

`backend/src/main/java/com/kaldinote/auth/infrastructure/jwt/JwtTokenProvider.java`:

```java
package com.kaldinote.auth.infrastructure.jwt;

import com.kaldinote.user.domain.UserRole;
import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JwtTokenProvider {

  private final JwtEncoder encoder;
  private final JwtDecoder decoder;
  private final JwtProperties properties;

  /** 액세스 토큰. sub=userId, role=역할. */
  public String createAccessToken(Long userId, UserRole role) {
    return encode(userId, properties.accessTokenTtl(), role);
  }

  /**
   * 리프레시 토큰. 역할을 담지 않는다 — 갱신 시점에 DB에서 다시 읽어야 권한 변경이 반영된다.
   */
  public String createRefreshToken(Long userId) {
    return encode(userId, properties.refreshTokenTtl(), null);
  }

  public Long parseUserId(String token) {
    return Long.valueOf(decoder.decode(token).getSubject());
  }

  public Duration getAccessTokenTtl() {
    return properties.accessTokenTtl();
  }

  public Duration getRefreshTokenTtl() {
    return properties.refreshTokenTtl();
  }

  private String encode(Long userId, Duration ttl, UserRole role) {
    Instant now = Instant.now();
    JwtClaimsSet.Builder claims =
        JwtClaimsSet.builder()
            .issuer(properties.issuer())
            .issuedAt(now)
            .expiresAt(now.plus(ttl))
            .subject(String.valueOf(userId));
    if (role != null) {
      claims.claim("role", role.name());
    }
    JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
    return encoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
  }
}
```

- [x] **Step 5: 인증 주체 변환기 작성**

`backend/src/main/java/com/kaldinote/common/security/AuthenticatedUser.java`:

```java
package com.kaldinote.common.security;

import com.kaldinote.user.domain.UserRole;

/** 컨트롤러에서 {@code @AuthenticationPrincipal AuthenticatedUser user}로 받는다. */
public record AuthenticatedUser(Long id, UserRole role) {}
```

`backend/src/main/java/com/kaldinote/common/security/KaldiJwtAuthenticationConverter.java`:

```java
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
```

- [x] **Step 6: SecurityConfig에 리소스 서버 연결**

`SecurityConfig`를 수정한다. `filterChain` 메서드에 `KaldiJwtAuthenticationConverter`를 주입받아 아래를 추가한다.

`.authorizeHttpRequests(...)` 안의 `.anyRequest().authenticated()` **앞에** 추가:

```java
                    .requestMatchers("/test-support/admin")
                    .hasRole("ADMIN")
                    .requestMatchers("/api/v1/admin/**")
                    .hasRole("ADMIN")
```

`.build()` **앞에** 추가:

```java
        .oauth2ResourceServer(
            oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter)))
```

메서드 시그니처를 다음으로 바꾼다:

```java
  @Bean
  public SecurityFilterChain filterChain(
      HttpSecurity http, KaldiJwtAuthenticationConverter jwtAuthenticationConverter)
      throws Exception {
```

- [x] **Step 7: 테스트 실행 — 통과 확인**

```bash
./gradlew test --tests '*JwtTokenProviderTest' --tests '*JwtAuthorizationTest' --tests '*SecurityConfigTest'
```

Expected: PASS, 12 tests. Task 5의 CSRF 테스트도 여전히 통과해야 한다.

- [x] **Step 8: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(auth): JWT 발급·검증과 role 기반 인가 추가" && cd backend
```

---

## Task 7: OAuth2 프로바이더 클라이언트 (카카오 / 구글)

**Files:**
- Create: `backend/src/main/java/com/kaldinote/auth/domain/OAuthProvider.java`
- Create: `backend/src/main/java/com/kaldinote/auth/application/OAuthUserProfile.java`
- Create: `backend/src/main/java/com/kaldinote/auth/infrastructure/oauth/OAuthClient.java`, `OAuthProperties.java`, `KakaoOAuthClient.java`, `GoogleOAuthClient.java`, `OAuthClientRegistry.java`
- Modify: `backend/src/main/resources/application.yml`, `application-local.yml`
- Test: `backend/src/test/java/com/kaldinote/auth/infrastructure/oauth/KakaoOAuthClientTest.java`, `GoogleOAuthClientTest.java`

**Interfaces:**
- Consumes: `ErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED`, `BusinessException` (Task 5)
- Produces:
  - `OAuthProvider` — `KAKAO`, `GOOGLE`
  - `OAuthUserProfile(OAuthProvider provider, String providerUserId, String email, String nickname, String profileImageUrl)` — `email`은 null 가능
  - `OAuthClient#provider() → OAuthProvider`, `OAuthClient#fetchProfile(String authorizationCode) → OAuthUserProfile`
  - `OAuthClientRegistry#get(OAuthProvider) → OAuthClient`
  - Task 8의 `AuthService`가 `OAuthClientRegistry`를 주입받아 쓴다

**흐름:** 프론트가 인가 페이지에서 받은 `code`를 백엔드에 넘긴다 → 백엔드가 프로바이더의 토큰 엔드포인트에서 액세스 토큰으로 교환 → 사용자 정보 조회 → `OAuthUserProfile` 반환. 백엔드는 프로바이더 토큰을 저장하지 않는다(우리 JWT만 쓴다).

> **카카오는 `email`이 null일 수 있다.** 이메일 제공은 선택 동의 항목이다. 식별자는 `providerUserId`다.

- [x] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/kaldinote/auth/infrastructure/oauth/KakaoOAuthClientTest.java`:

```java
package com.kaldinote.auth.infrastructure.oauth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.kaldinote.auth.application.OAuthUserProfile;
import com.kaldinote.auth.domain.OAuthProvider;
import com.kaldinote.common.error.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class KakaoOAuthClientTest {

  private static final String TOKEN_URI = "https://kauth.kakao.com/oauth/token";
  private static final String USER_INFO_URI = "https://kapi.kakao.com/v2/user/me";

  private MockRestServiceServer server;
  private KakaoOAuthClient client;

  @BeforeEach
  void setUp() {
    RestClient.Builder builder = RestClient.builder();
    server = MockRestServiceServer.bindTo(builder).build();
    OAuthProperties.Registration registration =
        new OAuthProperties.Registration(
            "test-client-id", "test-secret", "http://localhost:3000/auth/callback",
            TOKEN_URI, USER_INFO_URI);
    client = new KakaoOAuthClient(builder, registration);
  }

  @Test
  void 인가코드로_사용자_프로필을_가져온다() {
    server
        .expect(requestTo(TOKEN_URI))
        .andRespond(
            withSuccess("{\"access_token\":\"kakao-access-token\"}", MediaType.APPLICATION_JSON));
    server
        .expect(requestTo(USER_INFO_URI))
        .andRespond(
            withSuccess(
                """
                {
                  "id": 987654321,
                  "kakao_account": {
                    "email": "user@kakao.com",
                    "profile": {
                      "nickname": "커피러버",
                      "profile_image_url": "https://img.kakao.com/p.jpg"
                    }
                  }
                }
                """,
                MediaType.APPLICATION_JSON));

    OAuthUserProfile profile = client.fetchProfile("auth-code");

    assertThat(profile.provider()).isEqualTo(OAuthProvider.KAKAO);
    assertThat(profile.providerUserId()).isEqualTo("987654321");
    assertThat(profile.email()).isEqualTo("user@kakao.com");
    assertThat(profile.nickname()).isEqualTo("커피러버");
    assertThat(profile.profileImageUrl()).isEqualTo("https://img.kakao.com/p.jpg");
    server.verify();
  }

  @Test
  void 이메일_제공에_동의하지_않아도_프로필을_만든다() {
    // 카카오는 이메일 제공이 선택 동의라 필드 자체가 없을 수 있다
    server
        .expect(requestTo(TOKEN_URI))
        .andRespond(withSuccess("{\"access_token\":\"t\"}", MediaType.APPLICATION_JSON));
    server
        .expect(requestTo(USER_INFO_URI))
        .andRespond(
            withSuccess(
                "{\"id\":111,\"kakao_account\":{\"profile\":{\"nickname\":\"익명\"}}}",
                MediaType.APPLICATION_JSON));

    OAuthUserProfile profile = client.fetchProfile("auth-code");

    assertThat(profile.providerUserId()).isEqualTo("111");
    assertThat(profile.email()).isNull();
    assertThat(profile.nickname()).isEqualTo("익명");
  }

  @Test
  void 토큰_교환에_실패하면_업무_예외를_던진다() {
    server.expect(requestTo(TOKEN_URI)).andRespond(withServerError());

    assertThatThrownBy(() -> client.fetchProfile("bad-code"))
        .isInstanceOf(BusinessException.class);
  }
}
```

`GoogleOAuthClientTest`는 같은 구조로 작성하되 응답 본문만 바꾼다. 토큰 URI `https://oauth2.googleapis.com/token`, 사용자 정보 URI `https://www.googleapis.com/oauth2/v3/userinfo`, 응답:

```json
{ "sub": "108123456789", "email": "user@gmail.com", "name": "홍길동", "picture": "https://lh3.googleusercontent.com/p.jpg" }
```

검증: `provider()`가 `GOOGLE`, `providerUserId()`가 `"108123456789"`, `email()`이 `"user@gmail.com"`, `nickname()`이 `"홍길동"`.

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
./gradlew test --tests '*OAuthClientTest'
```

Expected: 컴파일 실패.

> `MockRestServiceServer.bindTo(RestClient.Builder)`가 없다면 Spring 버전 문제다. `./gradlew dependencies | grep spring-test`로 확인한다. 대안이 필요하면 `RestClient.Builder`에 `ClientHttpRequestFactory`를 직접 스텁하는 방식으로 바꾸되, **실제 카카오·구글 서버를 호출하지 않는다.**

- [x] **Step 3: 설정과 도메인 타입 작성**

`application.yml`에 추가:

```yaml
kaldi:
  oauth:
    kakao:
      client-id: ${KAKAO_CLIENT_ID}
      client-secret: ${KAKAO_CLIENT_SECRET:}
      redirect-uri: ${KAKAO_REDIRECT_URI:http://localhost:3000/auth/callback}
      token-uri: https://kauth.kakao.com/oauth/token
      user-info-uri: https://kapi.kakao.com/v2/user/me
    google:
      client-id: ${GOOGLE_CLIENT_ID}
      client-secret: ${GOOGLE_CLIENT_SECRET}
      redirect-uri: ${GOOGLE_REDIRECT_URI:http://localhost:3000/auth/callback}
      token-uri: https://oauth2.googleapis.com/token
      user-info-uri: https://www.googleapis.com/oauth2/v3/userinfo
```

로컬·테스트 프로필에는 더미 값을 넣는다 (`client-id: dummy` 등). **실제 시크릿을 커밋하지 않는다.**

`backend/src/main/java/com/kaldinote/auth/domain/OAuthProvider.java`:

```java
package com.kaldinote.auth.domain;

public enum OAuthProvider {
  KAKAO,
  GOOGLE
}
```

`backend/src/main/java/com/kaldinote/auth/application/OAuthUserProfile.java`:

```java
package com.kaldinote.auth.application;

import com.kaldinote.auth.domain.OAuthProvider;

/**
 * 소셜 프로바이더가 알려준 사용자 정보.
 *
 * @param email 카카오는 이메일 제공이 선택 동의라 null일 수 있다. 식별자로 쓰지 않는다.
 */
public record OAuthUserProfile(
    OAuthProvider provider,
    String providerUserId,
    String email,
    String nickname,
    String profileImageUrl) {}
```

`backend/src/main/java/com/kaldinote/auth/infrastructure/oauth/OAuthProperties.java`:

```java
package com.kaldinote.auth.infrastructure.oauth;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "kaldi.oauth")
public record OAuthProperties(Registration kakao, Registration google) {

  public record Registration(
      String clientId,
      String clientSecret,
      String redirectUri,
      String tokenUri,
      String userInfoUri) {}
}
```

`backend/src/main/java/com/kaldinote/auth/infrastructure/oauth/OAuthClient.java`:

```java
package com.kaldinote.auth.infrastructure.oauth;

import com.kaldinote.auth.application.OAuthUserProfile;
import com.kaldinote.auth.domain.OAuthProvider;

public interface OAuthClient {

  OAuthProvider provider();

  /** 인가코드를 액세스 토큰으로 교환한 뒤 사용자 정보를 조회한다. */
  OAuthUserProfile fetchProfile(String authorizationCode);
}
```

- [x] **Step 4: 카카오·구글 클라이언트 구현**

`backend/src/main/java/com/kaldinote/auth/infrastructure/oauth/KakaoOAuthClient.java`:

```java
package com.kaldinote.auth.infrastructure.oauth;

import com.kaldinote.auth.application.OAuthUserProfile;
import com.kaldinote.auth.domain.OAuthProvider;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Slf4j
@Component
public class KakaoOAuthClient implements OAuthClient {

  private final RestClient restClient;
  private final OAuthProperties.Registration registration;

  public KakaoOAuthClient(RestClient.Builder builder, OAuthProperties properties) {
    this(builder, properties.kakao());
  }

  /** 테스트에서 MockRestServiceServer가 바인딩된 builder를 넘기기 위한 생성자. */
  KakaoOAuthClient(RestClient.Builder builder, OAuthProperties.Registration registration) {
    this.restClient = builder.build();
    this.registration = registration;
  }

  @Override
  public OAuthProvider provider() {
    return OAuthProvider.KAKAO;
  }

  @Override
  public OAuthUserProfile fetchProfile(String authorizationCode) {
    String accessToken = exchangeToken(authorizationCode);
    return fetchUserInfo(accessToken);
  }

  private String exchangeToken(String code) {
    MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
    form.add("grant_type", "authorization_code");
    form.add("client_id", registration.clientId());
    form.add("redirect_uri", registration.redirectUri());
    form.add("code", code);
    if (registration.clientSecret() != null && !registration.clientSecret().isBlank()) {
      form.add("client_secret", registration.clientSecret());
    }

    try {
      Map<String, Object> body =
          restClient
              .post()
              .uri(registration.tokenUri())
              .contentType(MediaType.APPLICATION_FORM_URLENCODED)
              .body(form)
              .retrieve()
              .body(new org.springframework.core.ParameterizedTypeReference<>() {});
      Object token = body == null ? null : body.get("access_token");
      if (token == null) {
        throw new BusinessException(ErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED);
      }
      return token.toString();
    } catch (RestClientException e) {
      log.warn("카카오 토큰 교환 실패", e);
      throw new BusinessException(ErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED);
    }
  }

  @SuppressWarnings("unchecked")
  private OAuthUserProfile fetchUserInfo(String accessToken) {
    try {
      Map<String, Object> body =
          restClient
              .get()
              .uri(registration.userInfoUri())
              .header("Authorization", "Bearer " + accessToken)
              .retrieve()
              .body(new org.springframework.core.ParameterizedTypeReference<>() {});
      if (body == null || body.get("id") == null) {
        throw new BusinessException(ErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED);
      }

      Map<String, Object> account =
          (Map<String, Object>) body.getOrDefault("kakao_account", Map.of());
      Map<String, Object> profile = (Map<String, Object>) account.getOrDefault("profile", Map.of());

      return new OAuthUserProfile(
          OAuthProvider.KAKAO,
          String.valueOf(body.get("id")),
          (String) account.get("email"), // 선택 동의 항목이라 null일 수 있다
          (String) profile.getOrDefault("nickname", "커피러버"),
          (String) profile.get("profile_image_url"));
    } catch (RestClientException e) {
      log.warn("카카오 사용자 정보 조회 실패", e);
      throw new BusinessException(ErrorCode.OAUTH_TOKEN_EXCHANGE_FAILED);
    }
  }
}
```

`GoogleOAuthClient`는 같은 구조로 작성한다. 차이점만:
- `provider()` → `OAuthProvider.GOOGLE`
- 토큰 교환 폼에 `client_secret`이 **필수**다
- 사용자 정보 응답이 평평하다: `sub` → providerUserId, `email`, `name` → nickname, `picture` → profileImageUrl
- 닉네임 기본값은 `"커피러버"`

`backend/src/main/java/com/kaldinote/auth/infrastructure/oauth/OAuthClientRegistry.java`:

```java
package com.kaldinote.auth.infrastructure.oauth;

import com.kaldinote.auth.domain.OAuthProvider;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.springframework.stereotype.Component;

@Component
public class OAuthClientRegistry {

  private final Map<OAuthProvider, OAuthClient> clients;

  public OAuthClientRegistry(List<OAuthClient> clients) {
    this.clients =
        clients.stream().collect(java.util.stream.Collectors.toMap(
            OAuthClient::provider, Function.identity()));
  }

  public OAuthClient get(OAuthProvider provider) {
    OAuthClient client = clients.get(provider);
    if (client == null) {
      throw new IllegalArgumentException("지원하지 않는 프로바이더입니다: " + provider);
    }
    return client;
  }
}
```

`JwtConfig`처럼 `OAuthProperties`도 활성화해야 한다. `KaldiNoteApplication`에 `@ConfigurationPropertiesScan`을 붙이거나, `@EnableConfigurationProperties(OAuthProperties.class)`를 설정 클래스에 추가한다.

- [x] **Step 5: 테스트 실행 — 통과 확인**

```bash
./gradlew test --tests '*OAuthClientTest'
```

Expected: PASS, 6 tests (카카오 3 + 구글 3).

- [x] **Step 6: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(auth): 카카오·구글 OAuth2 클라이언트 추가 (이메일 미동의 대응)" && cd backend
```

---

## Task 8: 로그인 · 토큰 갱신 API (refresh rotation)

**Files:**
- Create: `backend/src/main/java/com/kaldinote/auth/domain/RefreshToken.java`, `UserOAuthAccount.java`
- Create: `backend/src/main/java/com/kaldinote/auth/infrastructure/RefreshTokenRepository.java`, `UserOAuthAccountRepository.java`
- Create: `backend/src/main/java/com/kaldinote/auth/application/AuthService.java`, `TokenPair.java`
- Create: `backend/src/main/java/com/kaldinote/auth/presentation/AuthController.java`, `dto/LoginRequest.java`, `dto/RefreshRequest.java`, `dto/LoginResponse.java`
- Test: `backend/src/test/java/com/kaldinote/auth/application/AuthServiceTest.java`

**Interfaces:**
- Consumes: `OAuthClientRegistry` (Task 7), `JwtTokenProvider` (Task 6), `UserRepository` (Task 4)
- Produces:
  - `AuthService#login(OAuthProvider provider, String code) → LoginResult`
  - `AuthService#refresh(String refreshToken) → TokenPair`
  - `AuthService#logout(String refreshToken) → void`
  - `TokenPair(String accessToken, String refreshToken, long expiresInSeconds)`
  - API: `POST /api/v1/auth/login/{provider}`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`

**Rotation 정책:** 갱신 시 기존 refresh 토큰을 폐기하고 새 쌍을 발급한다. **이미 폐기된 토큰이 다시 제출되면 탈취로 간주해 해당 사용자의 모든 refresh 토큰을 폐기**한다(재사용 감지).

- [x] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/kaldinote/auth/application/AuthServiceTest.java`:

```java
package com.kaldinote.auth.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.domain.OAuthProvider;
import com.kaldinote.auth.infrastructure.RefreshTokenRepository;
import com.kaldinote.auth.infrastructure.oauth.OAuthClient;
import com.kaldinote.auth.infrastructure.oauth.OAuthClientRegistry;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.user.infrastructure.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;

class AuthServiceTest extends AbstractIntegrationTest {

  @Autowired private AuthService authService;
  @Autowired private UserRepository userRepository;
  @Autowired private RefreshTokenRepository refreshTokenRepository;

  @MockBean private OAuthClientRegistry registry;

  private OAuthClient kakaoClient;

  @BeforeEach
  void setUp() {
    kakaoClient = org.mockito.Mockito.mock(OAuthClient.class);
    given(registry.get(OAuthProvider.KAKAO)).willReturn(kakaoClient);
  }

  private void stubProfile(String providerUserId, String email, String nickname) {
    given(kakaoClient.fetchProfile(anyString()))
        .willReturn(
            new OAuthUserProfile(OAuthProvider.KAKAO, providerUserId, email, nickname, null));
  }

  @Test
  void 처음_로그인하면_사용자가_생성된다() {
    stubProfile("kakao-1", "a@kakao.com", "커피러버");

    LoginResult result = authService.login(OAuthProvider.KAKAO, "code");

    assertThat(result.newUser()).isTrue();
    assertThat(result.tokens().accessToken()).isNotBlank();
    assertThat(userRepository.count()).isEqualTo(1);
  }

  @Test
  void 같은_소셜_계정으로_다시_로그인하면_사용자가_늘지_않는다() {
    stubProfile("kakao-2", "b@kakao.com", "커피러버");
    authService.login(OAuthProvider.KAKAO, "code");

    LoginResult second = authService.login(OAuthProvider.KAKAO, "code");

    assertThat(second.newUser()).isFalse();
    assertThat(userRepository.count()).isEqualTo(1);
  }

  @Test
  void 이메일_없는_카카오_계정도_가입된다() {
    stubProfile("kakao-3", null, "익명");

    LoginResult result = authService.login(OAuthProvider.KAKAO, "code");

    assertThat(result.newUser()).isTrue();
  }

  @Test
  void 갱신하면_새_토큰_쌍이_발급되고_기존_토큰은_폐기된다() {
    stubProfile("kakao-4", "d@kakao.com", "커피러버");
    TokenPair first = authService.login(OAuthProvider.KAKAO, "code").tokens();

    TokenPair renewed = authService.refresh(first.refreshToken());

    assertThat(renewed.refreshToken()).isNotEqualTo(first.refreshToken());
    assertThatThrownBy(() -> authService.refresh(first.refreshToken()))
        .isInstanceOf(BusinessException.class);
  }

  @Test
  void 폐기된_토큰이_재사용되면_해당_사용자의_모든_토큰을_폐기한다() {
    stubProfile("kakao-5", "e@kakao.com", "커피러버");
    TokenPair first = authService.login(OAuthProvider.KAKAO, "code").tokens();
    TokenPair second = authService.refresh(first.refreshToken());

    // 탈취된 옛 토큰 재사용 시도
    assertThatThrownBy(() -> authService.refresh(first.refreshToken()))
        .isInstanceOf(BusinessException.class);

    // 정상 토큰까지 함께 무효화되어야 한다
    assertThatThrownBy(() -> authService.refresh(second.refreshToken()))
        .isInstanceOf(BusinessException.class);
  }

  @Test
  void 로그아웃하면_리프레시_토큰이_폐기된다() {
    stubProfile("kakao-6", "f@kakao.com", "커피러버");
    TokenPair tokens = authService.login(OAuthProvider.KAKAO, "code").tokens();

    authService.logout(tokens.refreshToken());

    assertThatThrownBy(() -> authService.refresh(tokens.refreshToken()))
        .isInstanceOf(BusinessException.class);
  }
}
```

> `@MockBean`은 컨텍스트 캐시를 깨뜨린다. **이 테스트 클래스에서만** 쓰고 다른 통합 테스트로 퍼뜨리지 않는다. Boot 4에서 `@MockBean`이 제거됐다면 `@MockitoBean`으로 대체한다.

- [x] **Step 2: 테스트 실행 — 실패 확인**

```bash
./gradlew test --tests '*AuthServiceTest'
```

Expected: 컴파일 실패.

- [x] **Step 3: 도메인·리포지토리 작성**

`UserOAuthAccount` 엔티티 — `user_oauth_accounts` 테이블 매핑. 필드: `id`, `userId`, `provider`(`@Enumerated(STRING)`), `providerUserId`, `createdAt`. 정적 팩토리 `of(Long userId, OAuthProvider provider, String providerUserId)`.

`RefreshToken` 엔티티 — `refresh_tokens` 테이블 매핑. 필드: `id`, `userId`, `tokenHash`, `expiresAt`, `revokedAt`, `createdAt`.

```java
package com.kaldinote.auth.domain;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "refresh_tokens")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  /** 원문이 아닌 SHA-256 해시를 저장한다. DB가 유출돼도 토큰을 복원할 수 없다. */
  @Column(name = "token_hash", nullable = false, length = 64, unique = true)
  private String tokenHash;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Column(name = "revoked_at")
  private Instant revokedAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  private RefreshToken(Long userId, String tokenHash, Instant expiresAt) {
    this.userId = userId;
    this.tokenHash = tokenHash;
    this.expiresAt = expiresAt;
    this.createdAt = Instant.now();
  }

  public static RefreshToken issue(Long userId, String tokenHash, Instant expiresAt) {
    return new RefreshToken(userId, tokenHash, expiresAt);
  }

  public void revoke() {
    if (this.revokedAt == null) {
      this.revokedAt = Instant.now();
    }
  }

  public boolean isRevoked() {
    return revokedAt != null;
  }

  public boolean isExpired() {
    return expiresAt.isBefore(Instant.now());
  }
}
```

리포지토리:

```java
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
  Optional<RefreshToken> findByTokenHash(String tokenHash);

  @Modifying(clearAutomatically = true)
  @Query("update RefreshToken t set t.revokedAt = :now where t.userId = :userId and t.revokedAt is null")
  void revokeAllByUserId(@Param("userId") Long userId, @Param("now") Instant now);
}

public interface UserOAuthAccountRepository extends JpaRepository<UserOAuthAccount, Long> {
  Optional<UserOAuthAccount> findByProviderAndProviderUserId(
      OAuthProvider provider, String providerUserId);
}
```

- [x] **Step 4: AuthService 구현**

`TokenPair(String accessToken, String refreshToken, long expiresInSeconds)`,
`LoginResult(TokenPair tokens, Long userId, String nickname, boolean newUser)` — 둘 다 record.

`AuthService` 핵심 로직:

```java
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

    var existing =
        oauthAccountRepository.findByProviderAndProviderUserId(
            provider, profile.providerUserId());

    boolean newUser = existing.isEmpty();
    User user;
    if (newUser) {
      user = userRepository.save(
          User.create(profile.email(), profile.nickname(), profile.profileImageUrl()));
      oauthAccountRepository.save(
          UserOAuthAccount.of(user.getId(), provider, profile.providerUserId()));
    } else {
      user = userRepository.findById(existing.get().getUserId())
          .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    }

    return new LoginResult(issueTokens(user), user.getId(), user.getNickname(), newUser);
  }

  @Transactional
  public TokenPair refresh(String refreshToken) {
    Long userId;
    try {
      userId = tokenProvider.parseUserId(refreshToken);   // 서명·만료 검증 포함
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
    User user = userRepository.findById(userId)
        .orElseThrow(() -> new BusinessException(ErrorCode.REFRESH_TOKEN_INVALID));
    return issueTokens(user);   // 역할은 DB에서 다시 읽는다
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
```

- [x] **Step 5: 컨트롤러 작성**

```java
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

  private final AuthService authService;

  @PostMapping("/login/{provider}")
  public LoginResponse login(
      @PathVariable OAuthProvider provider, @Valid @RequestBody LoginRequest request) {
    return LoginResponse.from(authService.login(provider, request.code()));
  }

  @PostMapping("/refresh")
  public TokenPair refresh(@Valid @RequestBody RefreshRequest request) {
    return authService.refresh(request.refreshToken());
  }

  @PostMapping("/logout")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void logout(@Valid @RequestBody RefreshRequest request) {
    authService.logout(request.refreshToken());
  }
}
```

- `LoginRequest(@NotBlank String code)`
- `RefreshRequest(@NotBlank String refreshToken)`
- `LoginResponse(TokenPair tokens, Long userId, String nickname, boolean newUser)` + `from(LoginResult)`

`@PathVariable OAuthProvider provider`는 `kakao`(소문자)를 받으려면 대소문자 무시 변환기가 필요하다. 가장 간단한 방법은 URL에 대문자를 쓰지 않고 `String`으로 받아 `OAuthProvider.valueOf(provider.toUpperCase())` 하는 것이다. 변환 실패는 `IllegalArgumentException` → `GlobalExceptionHandler`에서 400으로 매핑되도록 핸들러를 추가한다.

- [x] **Step 6: 테스트 실행 — 통과 확인**

```bash
./gradlew test --tests '*AuthServiceTest'
```

Expected: PASS, 6 tests.

- [x] **Step 7: 수동 확인**

```bash
(cd .. && docker compose up -d)
./gradlew bootRun
```

카카오 개발자 콘솔에서 앱을 만들고 `KAKAO_CLIENT_ID`, `KAKAO_REDIRECT_URI`를 환경변수로 넣은 뒤, 브라우저에서 인가 URL로 접속해 `code`를 받는다:

```
https://kauth.kakao.com/oauth/authorize?client_id=<CLIENT_ID>&redirect_uri=http://localhost:3000/auth/callback&response_type=code
```

```bash
curl -s -X POST localhost:8080/api/v1/auth/login/kakao \
  -H 'Content-Type: application/json' \
  -d '{"code":"<받은 코드>"}'
```

Expected: `accessToken`, `refreshToken`, `newUser: true`가 담긴 JSON.

- [x] **Step 8: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(auth): 소셜 로그인과 refresh rotation API 추가 (재사용 감지 포함)" && cd backend
```

---

## Task 9: 카탈로그 마스터 (품종 · 가공법 · 플레이버노트) + 시드

**Files:**
- Create: `backend/src/main/resources/db/migration/V2__create_catalog_tables.sql`, `V3__seed_catalog.sql`
- Create: `backend/src/main/java/com/kaldinote/catalog/domain/Variety.java`, `CoffeeProcess.java`, `ProcessCategory.java`, `FlavorNote.java`
- Create: `backend/src/main/java/com/kaldinote/catalog/infrastructure/VarietyRepository.java`, `CoffeeProcessRepository.java`, `FlavorNoteRepository.java`
- Test: `backend/src/test/java/com/kaldinote/catalog/infrastructure/CatalogSeedTest.java`

**Interfaces:**
- Consumes: `BaseTimeEntity` (Task 4)
- Produces:
  - `Variety`, `CoffeeProcess`, `FlavorNote` 엔티티 — 각각 `isSystem`, `createdByUserId` 보유
  - `Variety.createByUser(String name, Long userId)` — 사용자 추가용 (`isSystem = false`)
  - `VarietyRepository#findAllByOrderByNameAsc()`, `FlavorNoteRepository#findAllByParentIsNull()`
  - Plan 2의 `BeanOrigin`이 `varietyId`, `processId`를 FK로 참조한다

> **마스터 데이터를 FK로 정규화하는 이유:** 품종을 문자열로 박으면 나중에 "게이샤"와 "Geisha"를 병합할 수 없다. 사용자는 막힘없이 바로 추가하되(`is_system = false`), 관리자가 사후에 병합한다.

- [ ] **Step 1: 스키마 마이그레이션 작성**

`V2__create_catalog_tables.sql`:

```sql
CREATE TABLE varieties (
    id                 BIGSERIAL PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    name_ko            VARCHAR(100),
    description        TEXT,
    is_system          BOOLEAN     NOT NULL DEFAULT false,
    created_by_user_id BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_varieties_name UNIQUE (name)
);

CREATE TABLE coffee_processes (
    id                 BIGSERIAL PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    name_ko            VARCHAR(100),
    category           VARCHAR(30)  NOT NULL,
    description        TEXT,
    is_system          BOOLEAN     NOT NULL DEFAULT false,
    created_by_user_id BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_processes_name UNIQUE (name)
);

-- SCA Flavor Wheel 기반 계층 구조
CREATE TABLE flavor_notes (
    id        BIGSERIAL PRIMARY KEY,
    name_en   VARCHAR(100) NOT NULL,
    name_ko   VARCHAR(100) NOT NULL,
    parent_id BIGINT REFERENCES flavor_notes (id) ON DELETE CASCADE,
    level     SMALLINT     NOT NULL,
    CONSTRAINT uq_flavor_note_name UNIQUE (name_en, parent_id)
);
CREATE INDEX idx_flavor_notes_parent ON flavor_notes (parent_id);
```

- [ ] **Step 2: 시드 마이그레이션 작성**

`V3__seed_catalog.sql`:

```sql
INSERT INTO varieties (name, name_ko, is_system) VALUES
    ('Geisha', '게이샤', true),
    ('Bourbon', '버번', true),
    ('Typica', '티피카', true),
    ('Caturra', '카투라', true),
    ('Catuai', '카투아이', true),
    ('SL28', 'SL28', true),
    ('SL34', 'SL34', true),
    ('Pacamara', '파카마라', true),
    ('Maragogipe', '마라고지페', true),
    ('Mundo Novo', '문도노보', true),
    ('Castillo', '카스티요', true),
    ('Pink Bourbon', '핑크버번', true),
    ('Wush Wush', '우쉬우쉬', true),
    ('Ethiopian Heirloom', '에티오피아 재래종', true),
    ('Java', '자바', true);

INSERT INTO coffee_processes (name, name_ko, category, is_system) VALUES
    ('Washed',              '워시드',           'WASHED',    true),
    ('Natural',             '내추럴',           'NATURAL',   true),
    ('White Honey',         '화이트 허니',      'HONEY',     true),
    ('Yellow Honey',        '옐로우 허니',      'HONEY',     true),
    ('Red Honey',           '레드 허니',        'HONEY',     true),
    ('Black Honey',         '블랙 허니',        'HONEY',     true),
    ('Anaerobic Natural',   '무산소 내추럴',    'FERMENTED', true),
    ('Anaerobic Washed',    '무산소 워시드',    'FERMENTED', true),
    ('Carbonic Maceration', '카보닉 마세라시옹','FERMENTED', true),
    ('Lactic',              '락틱',             'FERMENTED', true),
    ('Thermal Shock',       '써멀 쇼크',        'FERMENTED', true),
    ('Wet Hulled',          '웻 헐드',          'OTHER',     true),
    ('Swiss Water Decaf',   '스위스워터 디카페인','OTHER',   true);

-- SCA Flavor Wheel 1단계 (9개 대분류)
INSERT INTO flavor_notes (name_en, name_ko, parent_id, level) VALUES
    ('Fruity',           '과일',        NULL, 1),
    ('Sour/Fermented',   '신맛/발효',   NULL, 1),
    ('Green/Vegetative', '풀/채소',     NULL, 1),
    ('Other',            '기타',        NULL, 1),
    ('Roasted',          '로스팅',      NULL, 1),
    ('Spices',           '향신료',      NULL, 1),
    ('Nutty/Cocoa',      '견과/코코아', NULL, 1),
    ('Sweet',            '단맛',        NULL, 1),
    ('Floral',           '꽃',          NULL, 1);

-- 2단계 (자주 쓰는 것 중심. 나머지는 쓰면서 마이그레이션으로 보탠다)
INSERT INTO flavor_notes (name_en, name_ko, parent_id, level)
SELECT v.name_en, v.name_ko, p.id, 2
FROM (VALUES
    ('Berry',        '베리',        'Fruity'),
    ('Dried Fruit',  '건과일',      'Fruity'),
    ('Citrus Fruit', '시트러스',    'Fruity'),
    ('Other Fruit',  '기타 과일',   'Fruity'),
    ('Winey',        '와인',        'Sour/Fermented'),
    ('Cocoa',        '코코아',      'Nutty/Cocoa'),
    ('Nutty',        '견과',        'Nutty/Cocoa'),
    ('Brown Sugar',  '흑설탕',      'Sweet'),
    ('Vanilla',      '바닐라',      'Sweet'),
    ('Honey',        '꿀',          'Sweet'),
    ('Black Tea',    '홍차',        'Floral'),
    ('Floral',       '꽃향',        'Floral'),
    ('Cereal',       '곡물',        'Roasted'),
    ('Burnt',        '탄내',        'Roasted')
) AS v(name_en, name_ko, parent_name)
JOIN flavor_notes p ON p.name_en = v.parent_name AND p.level = 1;
```

- [ ] **Step 3: 실패하는 시드 검증 테스트 작성**

```java
package com.kaldinote.catalog.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CatalogSeedTest extends AbstractIntegrationTest {

  @Autowired private VarietyRepository varietyRepository;
  @Autowired private CoffeeProcessRepository processRepository;
  @Autowired private FlavorNoteRepository flavorNoteRepository;

  @Test
  void 시스템_품종이_시드된다() {
    assertThat(varietyRepository.count()).isGreaterThanOrEqualTo(15);
    assertThat(varietyRepository.findByName("Geisha")).isPresent();
  }

  @Test
  void 가공법은_카테고리로_묶인다() {
    assertThat(processRepository.findByCategory(ProcessCategory.HONEY)).hasSize(4);
    assertThat(processRepository.findByCategory(ProcessCategory.FERMENTED)).hasSize(5);
  }

  @Test
  void 플레이버노트는_9개_대분류를_가진다() {
    assertThat(flavorNoteRepository.findAllByParentIsNull()).hasSize(9);
  }

  @Test
  void 플레이버노트_하위_항목은_부모를_가리킨다() {
    var fruity = flavorNoteRepository.findByNameEnAndParentIsNull("Fruity").orElseThrow();

    assertThat(flavorNoteRepository.findAllByParent(fruity)).hasSize(4);
  }

  @Test
  void 시드_데이터는_전부_시스템_소유다() {
    assertThat(varietyRepository.findAll()).allMatch(v -> v.isSystem() && v.getCreatedByUserId() == null);
  }
}
```

- [ ] **Step 4: 테스트 실행 — 실패 확인**

```bash
./gradlew test --tests '*CatalogSeedTest'
```

Expected: 컴파일 실패.

- [ ] **Step 5: 엔티티와 리포지토리 작성**

`ProcessCategory` enum: `WASHED`, `NATURAL`, `HONEY`, `FERMENTED`, `OTHER`.

`Variety`, `CoffeeProcess`는 `BaseTimeEntity`를 상속하고 Task 4의 `User` 패턴을 따른다:
- `@NoArgsConstructor(access = PROTECTED)`, `@Getter`, setter 없음
- 정적 팩토리 `createByUser(String name, String nameKo, Long userId)` — `isSystem = false`
- `@Enumerated(EnumType.STRING)` for `category`

`FlavorNote`는 자기 참조 계층:

```java
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "parent_id")
private FlavorNote parent;

@Column(nullable = false)
private Short level;
```

리포지토리:

```java
public interface VarietyRepository extends JpaRepository<Variety, Long> {
  Optional<Variety> findByName(String name);
  List<Variety> findAllByOrderByNameAsc();
}

public interface CoffeeProcessRepository extends JpaRepository<CoffeeProcess, Long> {
  List<CoffeeProcess> findByCategory(ProcessCategory category);
  List<CoffeeProcess> findAllByOrderByCategoryAscNameAsc();
}

public interface FlavorNoteRepository extends JpaRepository<FlavorNote, Long> {
  List<FlavorNote> findAllByParentIsNull();
  List<FlavorNote> findAllByParent(FlavorNote parent);
  Optional<FlavorNote> findByNameEnAndParentIsNull(String nameEn);
}
```

- [ ] **Step 6: 테스트 실행 — 통과 확인**

```bash
./gradlew test --tests '*CatalogSeedTest'
```

Expected: PASS, 5 tests.

- [ ] **Step 7: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(catalog): 품종·가공법·플레이버노트 마스터와 시드 데이터 추가" && cd backend
```

---

## Task 10: 장비 마스터 (그라인더 · 드리퍼 · 필터) + 시드

**Files:**
- Create: `backend/src/main/resources/db/migration/V4__create_gear_tables.sql`, `V5__seed_gear.sql`
- Create: `backend/src/main/java/com/kaldinote/gear/domain/GrinderModel.java`, `AdjustmentType.java`, `BurrType.java`, `Brewer.java`, `BrewerType.java`, `BrewFilter.java`, `FilterMaterial.java`, `UserGrinder.java`
- Create: `backend/src/main/java/com/kaldinote/gear/infrastructure/GrinderModelRepository.java`, `BrewerRepository.java`, `BrewFilterRepository.java`, `UserGrinderRepository.java`
- Test: `backend/src/test/java/com/kaldinote/gear/infrastructure/GearSeedTest.java`

**Interfaces:**
- Consumes: `GrindSpec` (Task 2), `BaseTimeEntity` (Task 4)
- Produces:
  - `GrinderModel#toGrindSpec() → GrindSpec` — **`grind` 도메인과 이어지는 유일한 접점**
  - `GrinderModelRepository#findAllByOrderByBrandAscNameAsc()`
  - `UserGrinder` — 사용자가 보유한 그라인더 (Plan 2의 BrewLog가 참조)
  - Plan 2의 `Recipe`가 `brewerId`, `filterId`, `grinderModelId`를 참조한다

> **클릭당 마이크론을 모르는 그라인더는 `NULL`로 둔다.** `GrindSpec.convertible()`이 false가 되어 환산이 거부된다 — 이는 정상 동작이며 Task 2에서 이미 테스트로 고정했다. 추측값을 넣지 않는다. 잘못된 환산값은 값이 없는 것보다 나쁘다.

- [ ] **Step 1: 스키마 마이그레이션 작성**

`V4__create_gear_tables.sql`:

```sql
CREATE TABLE grinder_models (
    id                      BIGSERIAL PRIMARY KEY,
    brand                   VARCHAR(50)  NOT NULL,
    name                    VARCHAR(100) NOT NULL,
    adjustment_type         VARCHAR(20)  NOT NULL,
    microns_per_click       NUMERIC(6,2),
    zero_point_offset_clicks NUMERIC(6,2) NOT NULL DEFAULT 0,
    min_setting             NUMERIC(6,2),
    max_setting             NUMERIC(6,2),
    burr_type               VARCHAR(20),
    is_system               BOOLEAN     NOT NULL DEFAULT false,
    created_by_user_id      BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_grinder_brand_name UNIQUE (brand, name),
    CONSTRAINT chk_microns_positive CHECK (microns_per_click IS NULL OR microns_per_click > 0)
);

CREATE TABLE user_grinders (
    id                      BIGSERIAL PRIMARY KEY,
    user_id                 BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    grinder_model_id        BIGINT      NOT NULL REFERENCES grinder_models (id),
    nickname                VARCHAR(50),
    calibration_offset_clicks NUMERIC(6,2) NOT NULL DEFAULT 0,
    is_default              BOOLEAN     NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_grinders_user ON user_grinders (user_id);

CREATE TABLE brewers (
    id                 BIGSERIAL PRIMARY KEY,
    brand              VARCHAR(50),
    name               VARCHAR(100) NOT NULL,
    type               VARCHAR(20)  NOT NULL,
    is_system          BOOLEAN     NOT NULL DEFAULT false,
    created_by_user_id BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_brewer_name UNIQUE (name)
);

CREATE TABLE brew_filters (
    id                 BIGSERIAL PRIMARY KEY,
    name               VARCHAR(100) NOT NULL,
    material           VARCHAR(30)  NOT NULL,
    shape              VARCHAR(30),
    is_system          BOOLEAN     NOT NULL DEFAULT false,
    created_by_user_id BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_filter_name UNIQUE (name)
);
```

- [ ] **Step 2: 시드 마이그레이션 작성**

`V5__seed_gear.sql`:

```sql
-- microns_per_click은 출처가 확인된 값만 넣는다.
--   Comandante C40 = 30µm/click, 1Zpresso K-Plus = 22µm/click
-- 확인되지 않은 모델은 NULL로 둔다 → 환산이 거부된다(정상 동작).
-- 추측값은 넣지 않는다. 틀린 환산값은 값이 없는 것보다 해롭다.
INSERT INTO grinder_models
    (brand, name, adjustment_type, microns_per_click, zero_point_offset_clicks,
     min_setting, max_setting, burr_type, is_system) VALUES
    ('Comandante', 'C40 MK4',      'CLICK',    30.00, 0, 0, 50,  'CONICAL', true),
    ('1Zpresso',   'K-Plus',       'NUMBERED', 22.00, 0, 0, 90,  'CONICAL', true),
    ('1Zpresso',   'JX-Pro',       'NUMBERED', NULL,  0, 0, 100, 'CONICAL', true),
    ('1Zpresso',   'J-Max',        'NUMBERED', NULL,  0, 0, 90,  'CONICAL', true),
    ('Kingrinder', 'K6',           'CLICK',    NULL,  0, 0, 240, 'CONICAL', true),
    ('Timemore',   'Chestnut C2',  'CLICK',    NULL,  0, 0, 36,  'CONICAL', true),
    ('Timemore',   'Chestnut C3',  'CLICK',    NULL,  0, 0, 36,  'CONICAL', true),
    ('Fellow',     'Ode Gen 2',    'NUMBERED', NULL,  0, 1, 11,  'FLAT',    true),
    ('Baratza',    'Encore',       'NUMBERED', NULL,  0, 0, 40,  'CONICAL', true),
    ('Wilfa',      'Uniform',      'STEPLESS', NULL,  0, 0, 0,   'FLAT',    true);

INSERT INTO brewers (brand, name, type, is_system) VALUES
    ('Hario',   'V60 01',          'CONE',         true),
    ('Hario',   'V60 02',          'CONE',         true),
    ('Kalita',  'Wave 155',        'FLAT_BOTTOM',  true),
    ('Kalita',  'Wave 185',        'FLAT_BOTTOM',  true),
    ('Origami', 'Dripper S',       'CONE',         true),
    ('Origami', 'Dripper M',       'CONE',         true),
    ('Orea',    'Brewer V4',       'FLAT_BOTTOM',  true),
    ('Chemex',  'Classic 6 Cup',   'CONE',         true),
    ('Melitta', 'Aroma Filter 1x2','WAVE',         true),
    ('Timemore','Crystal Eye',     'CONE',         true);

INSERT INTO brew_filters (name, material, shape, is_system) VALUES
    ('V60 표백 필터 01',      'PAPER_BLEACHED', 'CONE',        true),
    ('V60 표백 필터 02',      'PAPER_BLEACHED', 'CONE',        true),
    ('V60 무표백 필터 02',    'PAPER_NATURAL',  'CONE',        true),
    ('아바카 필터 V60 02',    'ABACA',          'CONE',        true),
    ('칼리타 웨이브 155 필터','PAPER_BLEACHED', 'FLAT_BOTTOM', true),
    ('칼리타 웨이브 185 필터','PAPER_BLEACHED', 'FLAT_BOTTOM', true),
    ('케멕스 본디드 필터',    'PAPER_BLEACHED', 'CONE',        true),
    ('스테인리스 메탈 필터',  'METAL',          'CONE',        true);
```

- [ ] **Step 3: 실패하는 테스트 작성**

```java
package com.kaldinote.gear.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.gear.domain.GrinderModel;
import com.kaldinote.grind.domain.GrindConverter;
import com.kaldinote.grind.domain.GrindConversion;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class GearSeedTest extends AbstractIntegrationTest {

  @Autowired private GrinderModelRepository grinderRepository;
  @Autowired private BrewerRepository brewerRepository;
  @Autowired private BrewFilterRepository filterRepository;

  private final GrindConverter converter = new GrindConverter();

  @Test
  void 시스템_그라인더가_시드된다() {
    assertThat(grinderRepository.count()).isGreaterThanOrEqualTo(10);
  }

  @Test
  void C40의_클릭당_마이크론은_30이다() {
    GrinderModel c40 = grinderRepository.findByBrandAndName("Comandante", "C40 MK4").orElseThrow();

    assertThat(c40.getMicronsPerClick()).isEqualByComparingTo("30.00");
    assertThat(c40.toGrindSpec().convertible()).isTrue();
  }

  @Test
  void 시드된_그라인더로_실제_환산이_동작한다() {
    GrinderModel c40 = grinderRepository.findByBrandAndName("Comandante", "C40 MK4").orElseThrow();
    GrinderModel kPlus = grinderRepository.findByBrandAndName("1Zpresso", "K-Plus").orElseThrow();

    GrindConversion result =
        converter.convert(c40.toGrindSpec(), new BigDecimal("22"), kPlus.toGrindSpec());

    assertThat(result.micron()).isEqualByComparingTo("660");
    assertThat(result.targetSetting()).isEqualByComparingTo("30.0");
    assertThat(result.estimated()).isTrue();
    assertThat(result.targetOutOfRange()).isFalse();
  }

  @Test
  void 시드된_그라인더의_범위가_GrindSpec으로_전달된다() {
    GrinderModel c40 = grinderRepository.findByBrandAndName("Comandante", "C40 MK4").orElseThrow();

    // 범위 검증이 순수 도메인에서 동작하려면 min·max가 함께 넘어와야 한다
    assertThat(c40.toGrindSpec().rangeChecked()).isTrue();
    assertThat(c40.toGrindSpec().maxSetting()).isEqualByComparingTo("50");
  }

  @Test
  void 클릭당_마이크론이_없는_그라인더는_환산_불가로_표시된다() {
    GrinderModel stepless = grinderRepository.findByBrandAndName("Wilfa", "Uniform").orElseThrow();

    assertThat(stepless.getMicronsPerClick()).isNull();
    assertThat(stepless.toGrindSpec().convertible()).isFalse();
  }

  @Test
  void 드리퍼와_필터가_시드된다() {
    assertThat(brewerRepository.count()).isGreaterThanOrEqualTo(10);
    assertThat(filterRepository.count()).isGreaterThanOrEqualTo(8);
  }
}
```

- [ ] **Step 4: 테스트 실행 — 실패 확인**

```bash
./gradlew test --tests '*GearSeedTest'
```

Expected: 컴파일 실패.

- [ ] **Step 5: 엔티티와 리포지토리 작성**

enum: `AdjustmentType { CLICK, NUMBERED, STEPLESS }`, `BurrType { CONICAL, FLAT }`, `BrewerType { CONE, FLAT_BOTTOM, WAVE, HYBRID }`, `FilterMaterial { PAPER_BLEACHED, PAPER_NATURAL, ABACA, METAL, CLOTH }`.

`GrinderModel`의 핵심 메서드 — **`gear`와 `grind` 도메인을 잇는 유일한 지점이다**:

```java
/**
 * 순수 계산 도메인이 쓸 값 객체로 변환한다.
 * min·max까지 넘겨야 범위 검증도 순수 도메인에서 단위 테스트로 검증된다.
 */
public GrindSpec toGrindSpec() {
  return new GrindSpec(micronsPerClick, zeroPointOffsetClicks, minSetting, maxSetting);
}
```

나머지는 Task 4·9의 엔티티 패턴을 그대로 따른다. 리포지토리:

```java
public interface GrinderModelRepository extends JpaRepository<GrinderModel, Long> {
  Optional<GrinderModel> findByBrandAndName(String brand, String name);
  List<GrinderModel> findAllByOrderByBrandAscNameAsc();
}

public interface BrewerRepository extends JpaRepository<Brewer, Long> {
  List<Brewer> findAllByOrderByBrandAscNameAsc();
}

public interface BrewFilterRepository extends JpaRepository<BrewFilter, Long> {
  List<BrewFilter> findAllByOrderByNameAsc();
}

public interface UserGrinderRepository extends JpaRepository<UserGrinder, Long> {
  List<UserGrinder> findAllByUserId(Long userId);
  Optional<UserGrinder> findByUserIdAndIsDefaultTrue(Long userId);
}
```

- [ ] **Step 6: 테스트 실행 — 통과 확인**

```bash
./gradlew test --tests '*GearSeedTest'
```

Expected: PASS, 5 tests. 특히 세 번째 테스트가 Task 2의 순수 도메인과 시드 데이터가 실제로 맞물리는 것을 증명한다.

- [ ] **Step 7: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(gear): 그라인더·드리퍼·필터 마스터와 시드 데이터 추가" && cd backend
```

---

## Task 11: 마스터 조회 API + 분쇄도 환산 API + OpenAPI 문서

**Files:**
- Create: `backend/src/main/java/com/kaldinote/catalog/application/CatalogService.java`, `presentation/CatalogController.java`, `presentation/dto/`
- Create: `backend/src/main/java/com/kaldinote/gear/application/GearService.java`, `GrindConversionService.java`
- Create: `backend/src/main/java/com/kaldinote/gear/presentation/GearController.java`, `presentation/dto/`
- Create: `backend/src/main/java/com/kaldinote/common/config/OpenApiConfig.java`
- Modify: `backend/build.gradle.kts` — springdoc 추가
- Test: `backend/src/test/java/com/kaldinote/gear/presentation/GearControllerTest.java`, `catalog/presentation/CatalogControllerTest.java`

**Interfaces:**
- Consumes: 모든 앞선 태스크
- Produces: Plan 1의 최종 산출물. Plan 2가 이 API 위에 레시피·로그를 얹는다

**API:**

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/v1/catalog/varieties` | 품종 목록 |
| POST | `/api/v1/catalog/varieties` | 품종 추가 (즉시 생성, `isSystem=false`) |
| GET | `/api/v1/catalog/processes` | 가공법 목록 (카테고리별 그룹) |
| GET | `/api/v1/catalog/flavor-notes` | 플레이버노트 계층 |
| GET | `/api/v1/gear/grinders` | 그라인더 목록 |
| GET | `/api/v1/gear/brewers` | 드리퍼 목록 |
| GET | `/api/v1/gear/filters` | 필터 목록 |
| POST | `/api/v1/gear/grind-conversions` | **분쇄도 환산** |

- [ ] **Step 1: 실패하는 컨트롤러 테스트 작성**

```java
package com.kaldinote.gear.presentation;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.user.domain.UserRole;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class GearControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private GrinderModelRepository grinderRepository;

  private String token() {
    return "Bearer " + tokenProvider.createAccessToken(1L, UserRole.USER);
  }

  @Test
  @DisplayName("AC-GRIND-33 · 인증 없이 호출하면 401")
  void 인증_없이_그라인더_목록을_조회하면_401이다() throws Exception {
    mockMvc.perform(get("/api/v1/gear/grinders")).andExpect(status().isUnauthorized());
  }

  @Test
  void 그라인더_목록을_조회한다() throws Exception {
    mockMvc
        .perform(get("/api/v1/gear/grinders").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(greaterThanOrEqualTo(10)))
        .andExpect(jsonPath("$[?(@.name == 'C40 MK4')].convertible").value(hasItem(true)));
  }

  /** 요청 본문을 만든다. 세 필드 모두 필수다. */
  private String body(Long sourceId, String setting, Long targetId) {
    return """
        {"sourceGrinderModelId":%d,"sourceSetting":%s,"targetGrinderModelId":%d}
        """
        .formatted(sourceId, setting, targetId);
  }

  private ResultActions convert(Long sourceId, String setting, Long targetId) throws Exception {
    return mockMvc.perform(
        post("/api/v1/gear/grind-conversions")
            .header(HttpHeaders.AUTHORIZATION, token())
            .contentType(MediaType.APPLICATION_JSON)
            .content(body(sourceId, setting, targetId)));
  }

  private Long id(String brand, String name) {
    return grinderRepository.findByBrandAndName(brand, name).orElseThrow().getId();
  }

  @Test
  @DisplayName("AC-GRIND-07, AC-GRIND-21 · 추정치 경고가 함께 오고 범위 안이면 플래그가 내려간다")
  void 분쇄도를_환산하면_추정치_경고가_함께_온다() throws Exception {
    convert(id("Comandante", "C40 MK4"), "22", id("1Zpresso", "K-Plus"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.micron").value(660))
        .andExpect(jsonPath("$.targetSetting").value(30.0))
        .andExpect(jsonPath("$.targetOutOfRange").value(false))
        .andExpect(jsonPath("$.estimated").value(true))
        .andExpect(jsonPath("$.warning").isNotEmpty());
  }

  @Test
  @DisplayName("AC-GRIND-20 · 결과가 대상 범위를 넘으면 플래그를 세우고 값은 돌려준다")
  void 결과가_대상_범위를_넘으면_플래그가_선다() throws Exception {
    // K-Plus 90클릭 = 1980µm → C40 66.0클릭. C40의 최대는 50이다.
    convert(id("1Zpresso", "K-Plus"), "90", id("Comandante", "C40 MK4"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.targetSetting").value(66.0))
        .andExpect(jsonPath("$.targetOutOfRange").value(true));
  }

  @Test
  @DisplayName("AC-GRIND-10 · 하한값 자체는 허용한다")
  void 하한값은_허용된다() throws Exception {
    convert(id("Comandante", "C40 MK4"), "0", id("1Zpresso", "K-Plus"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.micron").value(0))
        .andExpect(jsonPath("$.targetSetting").value(0.0));
  }

  @Test
  @DisplayName("AC-GRIND-11 · 상한값 자체는 허용한다")
  void 상한값은_허용된다() throws Exception {
    // C40 50클릭 = 1500µm → K-Plus 1500 / 22 = 68.18... → 68.2
    convert(id("Comandante", "C40 MK4"), "50", id("1Zpresso", "K-Plus"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.micron").value(1500))
        .andExpect(jsonPath("$.targetSetting").value(68.2));
  }

  @Test
  @DisplayName("AC-GRIND-12 · 상한을 넘으면 거부한다")
  void 상한을_넘으면_400이다() throws Exception {
    convert(id("Comandante", "C40 MK4"), "51", id("1Zpresso", "K-Plus"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("GRIND_SETTING_OUT_OF_RANGE"));
  }

  @Test
  @DisplayName("AC-GRIND-13 · 하한 아래는 거부한다")
  void 하한_아래는_400이다() throws Exception {
    convert(id("Comandante", "C40 MK4"), "-1", id("1Zpresso", "K-Plus"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("GRIND_SETTING_OUT_OF_RANGE"));
  }

  @Test
  @DisplayName("AC-GRIND-30 · 원본이 환산 불가면 422")
  void 원본이_환산_불가면_422다() throws Exception {
    convert(id("Wilfa", "Uniform"), "22", id("Comandante", "C40 MK4"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("GRIND_NOT_CONVERTIBLE"));
  }

  @Test
  @DisplayName("AC-GRIND-31 · 대상이 환산 불가면 422")
  void 대상이_환산_불가면_422다() throws Exception {
    convert(id("Comandante", "C40 MK4"), "22", id("Wilfa", "Uniform"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("GRIND_NOT_CONVERTIBLE"));
  }

  @Test
  @DisplayName("AC-GRIND-32 · 존재하지 않는 그라인더면 404")
  void 존재하지_않는_그라인더_ID면_404다() throws Exception {
    convert(999999L, "22", 999998L)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-GRIND-34 · 필수 필드가 없으면 400")
  void 필수_필드가_없으면_400이다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/gear/grind-conversions")
                .header(HttpHeaders.AUTHORIZATION, token())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"sourceGrinderModelId\":1,\"targetGrinderModelId\":2}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
        .andExpect(jsonPath("$.fieldErrors[*].field").value(hasItem("sourceSetting")));
  }
}
```

> **`@DisplayName`은 하나만 붙일 수 있다.** 한 테스트가 AC 둘을 커버하면 위처럼 **한 줄에 ID를 쉼표로 나열**한다. 커버리지 스크립트는 문자열 포함 여부만 보므로 이 형태로 충분하다.

`CatalogControllerTest`도 같은 패턴으로 작성한다: 인증 없이 401, 품종 목록 조회 200 + 15개 이상, 품종 추가 201 + `isSystem=false`, 중복 이름 추가 시 409 `DUPLICATE_NAME`. 카탈로그는 기능 스펙이 없으므로 AC ID를 붙이지 않는다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
./gradlew test --tests '*ControllerTest'
```

Expected: 404 또는 컴파일 실패.

- [ ] **Step 3: DTO 작성**

```java
// gear/presentation/dto/GrindConversionRequest.java
// sourceSetting에 @DecimalMin을 걸지 않는다. 하한은 그라인더마다 다르고
// 영점 보정에 따라 달라지므로, 범위 검증은 도메인(GrindConverter)이 담당한다.
// 여기서 0 이상을 강제하면 AC-GRIND-13(-1 → GRIND_SETTING_OUT_OF_RANGE)이
// INVALID_REQUEST로 잘못 응답한다.
public record GrindConversionRequest(
    @NotNull Long sourceGrinderModelId,
    @NotNull BigDecimal sourceSetting,
    @NotNull Long targetGrinderModelId) {}

// gear/presentation/dto/GrindConversionResponse.java
public record GrindConversionResponse(
    BigDecimal sourceSetting,
    BigDecimal micron,
    BigDecimal targetSetting,
    boolean targetOutOfRange,
    boolean estimated,
    String warning) {

  public static GrindConversionResponse from(GrindConversion c) {
    return new GrindConversionResponse(
        c.sourceSetting(),
        c.micron(),
        c.targetSetting(),
        c.targetOutOfRange(),
        c.estimated(),
        c.warning());
  }
}

// gear/presentation/dto/GrinderModelResponse.java
public record GrinderModelResponse(
    Long id, String brand, String name, String adjustmentType,
    BigDecimal micronsPerClick, BigDecimal minSetting, BigDecimal maxSetting,
    String burrType, boolean convertible, boolean isSystem) {

  public static GrinderModelResponse from(GrinderModel m) { /* 필드 매핑 */ }
}
```

`convertible` 필드를 응답에 넣는 이유: 프론트가 환산 UI를 띄울지 말지 판단해야 한다.

- [ ] **Step 4: 서비스 작성**

```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GrindConversionService {

  private final GrinderModelRepository grinderRepository;
  private final GrindConverter converter = new GrindConverter();

  public GrindConversion convert(GrindConversionRequest request) {
    // 검증 순서: 404(그라인더 없음) → 422(환산 불가) → 400(범위 밖).
    // 환산 자체가 불가능하면 설정값의 유효성을 논할 의미가 없다.
    GrinderModel source = find(request.sourceGrinderModelId());
    GrinderModel target = find(request.targetGrinderModelId());

    // 도메인 예외를 잡지 않는다. GlobalExceptionHandler가 변환한다.
    //   GrindNotConvertibleException     → 422 GRIND_NOT_CONVERTIBLE
    //   GrindSettingOutOfRangeException  → 400 GRIND_SETTING_OUT_OF_RANGE
    return converter.convert(source.toGrindSpec(), request.sourceSetting(), target.toGrindSpec());
  }

  private GrinderModel find(Long id) {
    return grinderRepository
        .findById(id)
        .orElseThrow(
            () -> new BusinessException(ErrorCode.NOT_FOUND, "그라인더를 찾을 수 없습니다: " + id));
  }
}
```

`GearService`는 목록 조회 3개(`grinders`, `brewers`, `filters`)를, `CatalogService`는 목록 조회 3개 + 품종 추가를 담당한다. 품종 추가는 이름 중복 시 `BusinessException(ErrorCode.DUPLICATE_NAME)`을 던진다 (Task 5에서 이미 정의했다).

- [ ] **Step 5: 컨트롤러 작성**

```java
@RestController
@RequestMapping("/api/v1/gear")
@RequiredArgsConstructor
@Tag(name = "장비", description = "그라인더·드리퍼·필터 조회와 분쇄도 환산")
public class GearController {

  private final GearService gearService;
  private final GrindConversionService conversionService;

  @GetMapping("/grinders")
  public List<GrinderModelResponse> grinders() {
    return gearService.findAllGrinders();
  }

  @GetMapping("/brewers")
  public List<BrewerResponse> brewers() {
    return gearService.findAllBrewers();
  }

  @GetMapping("/filters")
  public List<BrewFilterResponse> filters() {
    return gearService.findAllFilters();
  }

  @PostMapping("/grind-conversions")
  @Operation(
      summary = "분쇄도 환산",
      description =
          "버 형상·입도 분포가 달라 정확한 등가 변환은 불가능하다. 결과는 항상 추정치이며 "
              + "응답의 warning을 UI에 반드시 노출해야 한다.")
  public GrindConversionResponse convert(@Valid @RequestBody GrindConversionRequest request) {
    return GrindConversionResponse.from(conversionService.convert(request));
  }
}
```

`CatalogController`도 같은 패턴. 품종 추가는 `@ResponseStatus(HttpStatus.CREATED)`와 `@AuthenticationPrincipal`로 `createdByUserId`를 채운다.

- [ ] **Step 6: OpenAPI 설정**

`build.gradle.kts`에 추가:

```kotlin
implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.1.0")
```

> **3.1.0 미만은 Spring Boot 4를 지원하지 않는다.** 버전을 낮추지 않는다. 빈 생성 오류가 나면 [springdoc.org/v4](https://springdoc.org/v4) 문서를 확인한다.

```java
@Configuration
public class OpenApiConfig {

  @Bean
  public OpenAPI kaldiNoteOpenApi() {
    final String scheme = "bearerAuth";
    return new OpenAPI()
        .info(new Info().title("kaldi note API").version("v1")
            .description("커피 레시피 공유 서비스 API"))
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
```

- [ ] **Step 7: 테스트 실행 — 통과 확인**

```bash
./gradlew test --tests '*ControllerTest'
```

Expected: PASS.

- [ ] **Step 8: 스펙 상태를 `구현완료`로 바꾸고 커버리지 검사**

두 스펙 문서의 frontmatter `status`를 `초안` → `구현완료`로 바꾼다.

- `docs/specs/2026-08-14-grind-conversion.md`
- `docs/specs/2026-08-14-extraction-analysis.md`

```bash
./gradlew clean check
(cd .. && ./scripts/check-spec-coverage.sh)
```

Expected: 두 명령 모두 통과. 커버리지 검사는 `AC 46개 전부 테스트에 존재`를 보고해야 한다.
**누락이 나오면 해당 테스트의 `@DisplayName`에 AC ID를 넣지 않은 것이다.** 이 시점부터 CI가 강제한다.

- [ ] **Step 9: 수동 확인**

```bash
(cd .. && docker compose up -d)
./gradlew bootRun
```

브라우저에서 `http://localhost:8080/swagger-ui.html` 접속 → 모든 엔드포인트가 문서화되어 있고, "Authorize" 버튼으로 JWT를 넣어 호출할 수 있다.

`docs/specs/2026-08-14-grind-conversion.md`의 수동 확인 항목도 여기서 처리한다 — 환산 응답의 `warning` 문구가 그대로 노출되는지 확인한다.

- [ ] **Step 10: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(gear): 마스터 조회 API와 분쇄도 환산 API, OpenAPI 문서 추가" && cd backend
```

---

## Plan 1 완료 기준

아래가 전부 참이어야 Plan 1이 끝난 것이다.

- [ ] `cd backend && ./gradlew clean check` 통과
- [ ] **두 스펙의 `status`가 `구현완료`이고 `./scripts/check-spec-coverage.sh`가 AC 46개 전부 확인** ← 가장 중요
- [ ] `docker compose up -d && ./gradlew bootRun` 후 `curl localhost:8080/actuator/health` → `{"status":"UP"}`
- [ ] Swagger UI에서 카카오 로그인으로 받은 JWT로 `/api/v1/gear/grinders` 호출 성공
- [ ] `POST /api/v1/gear/grind-conversions`로 C40 22클릭 → K-Plus 30.0클릭 환산, `estimated: true`와 `warning` 확인
- [ ] C40 51클릭으로 환산 시 400 + `code: GRIND_SETTING_OUT_OF_RANGE`
- [ ] 무단계 그라인더로 환산 시 422 + `code: GRIND_NOT_CONVERTIBLE`
- [ ] ADMIN이 아닌 토큰으로 `/api/v1/admin/**` 호출 시 403
- [ ] Flyway V1~V5가 모두 적용됨 (`./gradlew flywayInfo`)

**다음:** `docs/plans/2026-08-14-plan2-core-domain.md` (원두 재고 → 레시피 → 브루잉 로그 → 포크)

---

## 자체 검토 결과

계획 작성 후 스펙과 대조해 확인한 사항이다.

**AC 커버리지**
문서 상단의 매핑표 참조. **AC 46개 = 매핑 46개**, 누락 없음.
`AC-GRIND-*` 21개는 Task 2(단위 11)와 Task 11(API 10)에, `AC-EXT-*` 25개는 전부 Task 3에 있다.

**기능 스펙이 없는 부분**
| 요구사항 | 대응 태스크 | 출처 |
|---|---|---|
| `users.role` + JWT role claim | Task 4, 6 | 아키텍처 문서 |
| OAuth2(카카오/구글) + refresh rotation | Task 7, 8 | 아키텍처 문서 |
| 마스터 데이터 FK 정규화, 사용자 즉시 생성 | Task 9, 10, 11 | 아키텍처 문서 |
| Testcontainers, H2 금지 | Task 1 | 컨벤션 |
| CSRF 비활성 (Boot 4 함정) | Task 5 | 컨벤션 |
| Flyway로 스키마 + 시드 | Task 1, 4, 9, 10 | 컨벤션 |

기반 공사라 기능 스펙 대상이 아니다. Plan 1 범위 밖(원두 재고·레시피·브루잉 로그·포크·사진·배포)은 Plan 2~3에서 다룬다.

**스펙 반영으로 Plan 1이 바뀐 부분** (2026-08-14)
- `GrindSpec`에 `minSetting`·`maxSetting` 추가 — 범위 검증을 순수 도메인에서 단위 테스트로 검증하기 위해
- `GrindSettingOutOfRangeException`·`InvalidBrewMeasurementException` 신설. `IllegalArgumentException`을 쓰면 핸들러가 진짜 버그까지 400으로 숨긴다
- `GrindConversion`·응답 DTO에 `targetOutOfRange` 추가
- `ErrorCode`에 `GRIND_SETTING_OUT_OF_RANGE`·`INVALID_BREW_MEASUREMENT`·`DUPLICATE_NAME` 추가
- `BrewMeasurement` 입력 검증 5종 + EY 30% 물리 한계 추가
- **Task 3의 기존 테스트 하나가 물 250g에 음료 300g을 써서 새 규칙을 위반했다** → 물 300g / 음료 240g / TDS 1.45로 교체
- `GrindConversionRequest.sourceSetting`의 `@DecimalMin("0")` 제거 — 하한은 그라인더마다 다르므로 도메인이 판단해야 한다. 남겨두면 AC-GRIND-13이 `INVALID_REQUEST`로 잘못 응답한다
- 모든 관련 테스트의 `@DisplayName`에 AC ID 추가

**의도적으로 미뤄둔 것**
- `roasters`, `bean_products`, `bean_origins` 테이블 — Plan 2에서 `BeanBatch`와 함께 만든다. 스키마만 먼저 만들면 쓰는 코드 없이 죽은 스키마가 된다.
- `water_profiles` — Plan 2의 레시피가 참조할 때 만든다.
- QueryDSL — 레시피 검색이 실제로 복잡해질 때.
- 관리자 API — 역할 인가 기반만 Task 6에서 확보했다.

**검증되지 않은 가정 — 실행 중 확인할 것**
1. `start.spring.io`가 `bootVersion=4.1.0`을 받는지. 거부되면 Task 1 Step 1의 대안 절차를 따른다.
2. Boot 4에서 `@ServiceConnection` 등의 import 경로. 이동했다면 마이그레이션 가이드를 본다.
3. `MockRestServiceServer.bindTo(RestClient.Builder)` 가용 여부 (Task 7).
4. Boot 4에서 `@MockBean`이 제거됐는지 (Task 8) → `@MockitoBean`으로 대체.

**넷 다 "버전을 낮춘다"로 해결하지 않는다.** Spring Boot 3.5는 OSS 지원이 끝났다.

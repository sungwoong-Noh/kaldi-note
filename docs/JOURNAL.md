# 작업 일지

세션마다 한 항목. **최신이 위**, append-only — 과거 항목을 고치지 않는다.
작성 규칙은 [`docs/conventions/handover.md`](conventions/handover.md).

체크박스가 담지 못하는 것을 담는 곳이다 — 막힌 지점, 계획과 달라진 이유, 확인·반증된 가정.

---

## 2026-08-16 · Task 11 — 마스터 조회 API + 분쇄도 환산 API + OpenAPI 문서 (Plan 1 마지막 태스크)

**브랜치:** `feat/task-11-master-api` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료 — **Plan 1 전체 완료**

### 한 일
- `GearController`(`/grinders`·`/brewers`·`/filters`·`/grind-conversions`), `CatalogController`(`/varieties`·`/processes`·`/flavor-notes`), 각 서비스·DTO 추가
- `springdoc-openapi-starter-webmvc-ui:3.1.0` 추가, `OpenApiConfig`로 Bearer JWT 스킴 등록
- `GearControllerTest` 13개(AC-GRIND-07·10~13·20·21·30~34), `CatalogControllerTest` 4개(스펙 없음, AC ID 없음) 전부 통과
- 두 스펙(`grind-conversion`, `extraction-analysis`) `status`를 `구현완료`로 전환 — `check-spec-coverage.sh`가 AC 46개 전부 확인
- Swagger UI 대신 `/v3/api-docs`로 8개 엔드포인트(+ Task 8의 auth 3개) 전부 문서화됨을 확인. 카카오 크레덴셜이 없어 로컬 JWT secret으로 직접 서명한 토큰으로 그라인더 목록 조회·환산 API(C40 22클릭→660µm→K-Plus 30.0, warning 문구 노출)까지 curl로 재현
- `flyway_schema_history`를 직접 조회해 V1~V5 전부 `success=true` 확인 (`flywayInfo` gradle task는 플러그인 미적용이라 없음 — Plan 1 완료 기준 문서의 가정과 다름)

### 발견한 것
- **`AuthenticatedUser` 레코드(Task 6에서 생성)가 실제로는 어디에도 연결돼 있지 않았다.** `@AuthenticationPrincipal AuthenticatedUser user`로 받으라는 계획 문서 설명대로 하면, `JwtAuthenticationToken`의 principal이 원본 `Jwt`라 타입이 안 맞아 Spring Security의 `AuthenticationPrincipalArgumentResolver`가 조용히 `null`을 반환하고 이후 `user.id()` 호출에서 NPE가 난다. `AuthenticatedUserArgumentResolver`(커스텀 `HandlerMethodArgumentResolver`, `@AuthenticationPrincipal` 없이 타입만으로 매칭)를 새로 만들고 `WebConfig`에 등록해 해결했다. 컨트롤러 파라미터는 어노테이션 없이 `AuthenticatedUser user`로만 받는다
- **`CatalogControllerTest`의 품종 추가 테스트가 FK 위반(500)으로 실패했다.** `varieties.created_by_user_id`가 `users(id)`를 참조하는데, 테스트가 실제 DB에 없는 `userId=1`로 JWT만 발급해 호출했기 때문이다. `UserRepository`로 실제 사용자를 저장한 뒤 그 ID로 토큰을 발급하도록 고쳤고, 클래스에 `@Transactional`을 추가해 테스트 간 격리했다 (Task 4·8과 같은 패턴)
- **AC-GRIND-33의 계획 문서 예시 코드는 스펙의 Given/When과 살짝 어긋난다.** 스펙은 "환산 API에 인증 없이 호출하면 401"이라고 적었지만, 계획의 테스트 코드는 `/gear/grinders` 목록 조회에 이 AC ID를 붙였다. `SecurityConfig`가 모든 `/api/v1/gear/**`를 동일한 JWT 필터로 보호하므로 동작상 문제는 없으나, 계획 코드를 그대로 따랐다는 점을 남긴다
- `CatalogService.findAllProcesses()`가 카테고리별로 묶은 `Map<ProcessCategory, List<...>>`을 반환하는데, 정확한 응답 구조(그룹 키 형태 등)를 못박은 스펙이 없어 자유롭게 설계했다

### 다음 세션에게
- **Plan 1이 여기서 끝났다.** `docs/plans/2026-08-14-plan2-core-domain.md`는 아직 없다 — 다음 세션은 Plan 2 작성부터 시작해야 한다(원두 재고 → 레시피 → 브루잉 로그 → 포크). CLAUDE.md 규칙대로 **스펙 → 계획 → 코드** 순서를 지킬 것
- 카카오/구글 실제 로그인은 이번 세션까지도 크레덴셜이 없어 한 번도 실기 검증되지 않았다. 프론트 연동 전에 실제 OAuth 앱을 만들어 처음부터 끝까지 로그인 플로우를 한 번은 확인해야 한다

---

## 2026-08-16 · Task 10 — 장비 마스터 (그라인더·드리퍼·필터) + 시드

**브랜치:** `feat/task-10-gear` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `V4__create_gear_tables.sql`(grinder_models/user_grinders/brewers/brew_filters), `V5__seed_gear.sql`(그라인더 10종, 드리퍼 10종, 필터 8종) 추가
- `GrinderModel`(+ `toGrindSpec()`), `Brewer`, `BrewFilter`, `UserGrinder` 엔티티, `AdjustmentType`·`BurrType`·`BrewerType`·`FilterMaterial` enum, 리포지토리 4종 추가
- `GearSeedTest` 6개 전부 통과 — 계획 문서는 5개로 적었지만 실제로 6개 메서드가 있었다(Task 2 때와 같은 종류의 계획 문서 카운트 오기, 동작에는 영향 없음)
- 특히 "시드된_그라인더로_실제_환산이_동작한다" 테스트가 Task 2의 순수 `grind` 도메인과 시드 데이터가 실제로 맞물리는 것을 증명한다 (C40 22클릭 → 660µm → K-Plus 30.0)

### 발견한 것
- `GrinderModel`·`Brewer`·`BrewFilter`·`UserGrinder`의 `createByUser`/`of` 정적 팩토리 시그니처는 계획 문서에 명시되지 않아(Task 9의 `CoffeeProcess`처럼 스키마의 NOT NULL 컬럼을 전부 받도록) 직접 설계했다. 특별한 이슈는 없었다

### 다음 세션에게
- **Task 11(마스터 조회 API + 분쇄도 환산 API + OpenAPI 문서)부터.** Plan 1의 마지막 태스크다 — 여기서 `grind` 스펙 status를 `구현완료`로 전환하는 것도 포함돼 있다(Task 3 JOURNAL에서 미뤄둔 것)
- Plan 2에서 `Recipe`가 `brewerId`·`filterId`·`grinderModelId`를, `BeanOrigin`이 `varietyId`·`processId`를 FK로 참조할 예정 — 지금까지처럼 엔티티가 아니라 ID로 참조해야 한다

---

## 2026-08-16 · Task 9 — 카탈로그 마스터 (품종·가공법·플레이버노트) + 시드

**브랜치:** `feat/task-09-catalog` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `V2__create_catalog_tables.sql`(varieties/coffee_processes/flavor_notes), `V3__seed_catalog.sql`(품종 15개, 가공법 13개, 플레이버노트 1단계 9개 + 2단계 14개) 추가
- `Variety`·`CoffeeProcess`·`FlavorNote` 엔티티, `ProcessCategory` enum, 리포지토리 3종 추가
- `CatalogSeedTest` 5개 전부 통과 (계획 예상치와 일치)

### 발견한 것
- **계획 문서의 `CoffeeProcess.createByUser` 시그니처가 스키마와 맞지 않았다.** 계획은 `Variety`·`CoffeeProcess` 둘 다 `createByUser(String name, String nameKo, Long userId)`로 통일해 적으라고 했지만, `coffee_processes.category`는 `NOT NULL`이라 값 없이는 저장이 불가능하다. `CoffeeProcess.createByUser`에는 `ProcessCategory category` 파라미터를 추가했다 — 사용자가 가공법을 직접 추가할 때도 카테고리 선택은 필수이므로 스키마 쪽이 맞고 계획 문서 시그니처가 단순화된 오기로 보인다

### 다음 세션에게
- **Task 10(장비 마스터: 그라인더·드리퍼·필터 + 시드)부터.** Task 9와 같은 패턴(마이그레이션 → 시드 → 엔티티 → 리포지토리)이라 그대로 따라가면 된다
- Plan 2에서 `BeanOrigin`이 `varietyId`, `processId`를 FK로 참조할 예정 — 지금은 엔티티 직접 참조가 아니라 ID 참조임을 잊지 말 것

---

## 2026-08-16 · Task 8 — 로그인·토큰 갱신 API (refresh rotation)

**브랜치:** `feat/task-08-auth-api` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `UserOAuthAccount`·`RefreshToken` 엔티티, `RefreshTokenRepository`·`UserOAuthAccountRepository`, `AuthService`(login/refresh/logout), `TokenPair`·`LoginResult`, `AuthController` + DTO 3종 추가
- `POST /api/v1/auth/login/{provider}`·`/refresh`·`/logout` — provider는 소문자 문자열로 받아 `OAuthProvider.valueOf(toUpperCase())`로 변환, 실패 시 `IllegalArgumentException` → 400(`GlobalExceptionHandler`에 핸들러 추가)
- `AuthServiceTest` 6개 전부 통과 (계획 예상치와 일치). `bootRun`으로 기동해 provider 오타 400, 잘못된 인가코드 401, 빈 `code` 400을 curl로 수동 확인

### 발견한 것
- **계획 문서 `AuthServiceTest` 예시 코드에 진짜 보안 버그가 있었다.** `refresh()`가 재사용(이미 폐기된 토큰) 감지 시 `revokeAllByUserId()`로 사용자의 모든 리프레시 토큰을 폐기한 뒤 `BusinessException`을 던지는데, 이 메서드가 `@Transactional`이라 예외가 메서드를 빠져나가며 트랜잭션 전체가 자동 롤백되고 **방금 실행한 폐기 자체가 취소된다.** 즉 토큰 탈취가 감지돼도 나머지 토큰이 무효화되지 않는 채로 프로덕션에 배포될 뻔했다. `@Transactional(noRollbackFor = BusinessException.class)`로 고쳤다 — 테스트(`폐기된_토큰이_재사용되면...`)가 이걸 정확히 잡아냈다
- **JWT는 같은 사용자·같은 초(second)에 두 번 발급하면 완전히 동일한 문자열이 나올 수 있다.** `iat`/`exp`가 초 단위 정밀도라, 같은 트랜잭션 흐름 안에서 로그인 직후 바로 갱신하거나 같은 계정으로 연달아 로그인하면 `refresh_tokens.token_hash` UNIQUE 제약을 위반한다. `JwtTokenProvider.encode()`에 무작위 `jti` 클레임을 추가해 토큰을 항상 고유하게 만들었다 — Task 6에서 만든 파일이지만 Task 8에서 실사용하며 드러난 문제라 여기서 고쳤다
- **`AuthServiceTest`도 Task 4의 `UserRepositoryTest`와 같은 이유로 클래스에 `@Transactional`이 필요했다.** `AbstractIntegrationTest`에 롤백이 없어 테스트 메서드마다 커밋된 데이터가 남고, JUnit5 기본 실행 순서가 소스 순서가 아니라서 `userRepository.count()` 단언이 실행 순서에 따라 흔들렸다. 클래스 레벨 `@Transactional`을 추가해 해결 — 이 패턴은 이제 두 번째로 반복됐으니 앞으로 서비스/리포지토리 통합 테스트를 쓸 때 기본값으로 고려할 것
- Step 7(수동 확인)은 실제 카카오 앱 크레덴셜이 없어 전체 로그인 플로우 재현은 생략했다. `bootRun` 기동, 잘못된 provider(400), 잘못된 인가코드(401 `OAUTH_TOKEN_EXCHANGE_FAILED`), 빈 `code` 검증 실패(400)만 curl로 확인

### 다음 세션에게
- **Task 9(카탈로그 마스터 + 시드)부터.** Plan 1의 인증 기반(Task 4~8)이 여기서 끝난다
- `AuthController`의 provider 변환은 문자열 기반이다. 프론트 연동 시 URL에 `kakao`/`google` 소문자로 넘기게 안내할 것

---

## 2026-08-16 · Task 7 — OAuth2 프로바이더 클라이언트 (카카오/구글)

**브랜치:** `feat/task-07-oauth` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `OAuthProvider`, `OAuthUserProfile`, `OAuthProperties`, `OAuthClient`/`KakaoOAuthClient`/`GoogleOAuthClient`/`OAuthClientRegistry`, `OAuthConfig`(`@EnableConfigurationProperties`) 추가
- `application.yml`·`application-local.yml`·`application-test.yml`에 `kaldi.oauth.*` 설정(로컬·테스트는 더미 값) 추가
- `KakaoOAuthClientTest` 3개 + `GoogleOAuthClientTest` 3개 = 6개 전부 통과 (계획 예상치와 일치)

### 발견한 것
- **계획 문서 Step 4의 `KakaoOAuthClient`/`GoogleOAuthClient` 예시 코드에 버그가 있었다.** 생성자가 2개(운영용 `public`, 테스트용 package-private)인데 어느 쪽도 `@Autowired`가 없으면, Spring은 여러 생성자 중 하나를 자동 선택하지 못하고 무인자 기본 생성자를 시도하다 `NoSuchMethodException`으로 컨텍스트 로딩에 실패한다 — 계획 코드를 그대로 옮기면 `SecurityConfigTest`·`UserRepositoryTest`·`JwtTokenProviderTest` 등 `@SpringBootTest` 전체가 깨진다(정작 신규 `OAuthClientTest`는 순수 단위 테스트라 통과해 눈치채기 어렵다). 두 클래스의 운영용 생성자에 `@Autowired`를 추가해 해결
- **`RestClient.Builder` 빈이 Boot 4에서는 `spring-boot-starter-restclient`를 명시적으로 추가해야 생긴다.** `spring-boot-starter-webmvc-test`는 테스트 슬라이스에서 이 빈을 자동 등록해줘서 `KakaoOAuthClientTest`/`GoogleOAuthClientTest`(순수 단위 테스트, Spring 컨텍스트 없음)는 영향이 없었지만, `@SpringBootTest`로 뜨는 통합 테스트와 실제 `bootRun`에서는 빈이 없어 `NoSuchBeanDefinitionException`이 난다. `build.gradle.kts`에 `spring-boot-starter-restclient`를 추가해 해결 — RestClientAutoConfiguration이 Boot 4에서 `org.springframework.boot.restclient.autoconfigure`로 이동하며 별도 스타터가 필요해진 것이 원인(Spring Boot 4 모듈 재편의 연장선, `backend/CLAUDE.md`의 함정 3번과 같은 종류)

### 다음 세션에게
- **Task 8(로그인·토큰 갱신 API, refresh rotation)부터.** `OAuthClientRegistry`를 `AuthService`가 주입받아 쓰는 구조로 계획돼 있다
- `spring-boot-starter-restclient` 추가는 앞으로 `RestClient`를 쓰는 모든 곳에 영향을 준다 — 이후 태스크에서 별도로 다시 추가할 필요 없음

---

## 2026-08-15 · Task 6 — JWT 발급·검증 + ADMIN 인가

**브랜치:** `feat/task-06-jwt` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `JwtTokenProvider`(HS256, NimbusJwtEncoder/Decoder), `JwtConfig`, `JwtProperties`, `AuthenticatedUser`, `KaldiJwtAuthenticationConverter` 추가
- `SecurityConfig`에 `oauth2ResourceServer` 연결, `/test-support/admin`·`/api/v1/admin/**`에 `hasRole("ADMIN")` 요구
- `JwtTokenProviderTest` 5개 + `JwtAuthorizationTest` 4개 + `SecurityConfigTest` 3개 = 12개 전부 통과 (계획 예상치와 일치)

### 발견한 것
- **Task 5 JOURNAL에 남겨둔 질문 해결:** `oauth2ResourceServer` 연결 후 Task 5의 임시 `authenticationEntryPoint(401)`를 제거하고 재실행해봤더니 12/12 그대로 통과했다. `oauth2ResourceServer` 자체의 `BearerTokenAuthenticationEntryPoint`가 미인증 요청에 401을 반환하므로 중복이었다 — 제거했다
- `nimbus-jose-jwt`는 Task 5에서 추가한 `spring-boot-starter-oauth2-resource-server`의 전이 의존성으로 이미 들어와 있어 별도 추가가 필요 없었다

### 다음 세션에게
- 없음 — Task 7(OAuth2 프로바이더 클라이언트)부터 계획대로 진행

---

## 2026-08-15 · Task 5 — Security 기본 설정 (CSRF 비활성 + 공통 에러 응답)

**브랜치:** `feat/task-05-security` (`feat/task-04-user` 위에 쌓음) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `SecurityConfig`(CSRF 비활성, stateless), `ErrorCode`/`BusinessException`/`ErrorResponse`/`GlobalExceptionHandler` 추가. grind·extraction 도메인 예외를 HTTP 상태로 매핑
- `SecurityConfigTest` 3개 전부 통과 — 특히 CSRF 없는 POST가 403이 아니라 401로 통과

### 발견한 것
- **httpBasic·formLogin을 끄고 아직 OAuth2 리소스 서버(Task 6)가 없으면 Spring Security가 진입점을 `Http403ForbiddenEntryPoint`로 폴백해 미인증 요청도 403을 반환한다.** 계획 문서의 `SecurityConfig` 코드 그대로는 두 테스트(401 기대)가 403으로 실패했다. `.exceptionHandling(ex -> ex.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))`을 추가해 해결 — Task 6에서 JWT 리소스 서버를 붙이면 이 entry point가 자연스럽게 대체될 수 있으니 그때 필요 여부를 다시 확인할 것
- `HttpStatus.UNPROCESSABLE_ENTITY`가 Spring Framework 7에서 deprecated됐다(RFC 9110에 맞춰 `UNPROCESSABLE_CONTENT`로 개명, 둘 다 422). `ErrorCode.GRIND_NOT_CONVERTIBLE`을 새 이름으로 바꿨다
- Task 4·5를 병렬 브랜치로 진행하다 JOURNAL 삽입 위치 충돌이 또 발생했다. 이번엔 순서를 정하고 **PR #9(Task 5)의 base를 `feat/task-04-user`로 옮겨 스택**했다 — PR #8이 머지되면 GitHub가 base를 자동으로 main으로 재조정한다. 병렬 대신 순차 스택이 이 프로젝트의 JOURNAL 단일 파일 구조엔 더 맞는다

### 다음 세션에게
- **Task 6(JWT 발급·검증)에서 `SecurityConfig`의 `exceptionHandling` entry point를 다시 볼 것.** OAuth2 리소스 서버를 붙이면 자체 401 처리가 생기므로, 지금 추가한 `HttpStatusEntryPoint`가 여전히 필요한지 중복인지 확인 필요
- PR은 순서대로: #8(Task 4) 머지 → #9(Task 5) 머지

---

## 2026-08-15 · Task 4 — 사용자·팔로우 스키마 + 엔티티

**브랜치:** `feat/task-04-user` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- V1 마이그레이션(`users`/`user_oauth_accounts`/`refresh_tokens`/`follows`), `BaseTimeEntity`/`JpaAuditingConfig`, `User`/`UserRole`/`Follow`/`FollowId`, `UserRepository`/`FollowRepository` 추가
- `UserRepositoryTest` 5개 전부 통과 — 이 태스크에서 처음으로 Testcontainers Postgres에 실제로 쓰기가 들어감

### 발견한 것
- **`AbstractIntegrationTest`에 `@Transactional`이 없어 리포지토리 메서드 호출마다 별도 영속성 컨텍스트가 열린다.** 계획 문서의 테스트 코드를 그대로 옮겼더니 `promoteToAdmin()` 후 `flush()`가 변경을 못 잡고(반환된 detached 엔티티를 수정한 뒤 다른 트랜잭션에서 flush), 테스트 간 데이터도 롤백 없이 누적됐다(`count()` 기대값 불일치). `UserRepositoryTest`에만 `@Transactional`을 추가해 해결 — 공유 베이스클래스는 손대지 않았다. `backend/CLAUDE.md`가 인가·스냅샷 테스트에서 `@Transactional` 롤백 의존을 경고하고 있어서, 그 종류의 테스트를 작성할 땐 이 클래스 단위 어노테이션 패턴 대신 명시적 커밋 검증이 필요하다
- Testcontainers `.withReuse(true)`는 `~/.testcontainers.properties`에 `testcontainers.reuse.enable=true`가 없으면 무효라는 것을 확인 — 이 머신엔 없어서 매 실행마다 컨테이너가 새로 뜬다. 재현 실패의 원인을 잔여 컨테이너 데이터로 오해할 뻔했다

### 다음 세션에게
- 앞으로 리포지토리·통합 테스트를 새로 쓸 때 `@Transactional` 필요 여부를 매번 판단할 것. 단순 CRUD 격리 테스트는 클래스에 `@Transactional` 추가, 커밋 자체를 검증해야 하는 테스트(인가 403, 스냅샷 불변성 등)는 명시적으로 커밋하고 별도 조회로 확인

---

## 2026-08-15 · extraction 스펙 status 구현완료 전환

**브랜치:** `docs/extraction-spec-complete` · **PR:** 아래 참조
**상태:** 완료

### 한 일
- Task 3(PR #6)로 AC-EXT 25개가 전부 충족됐음을 사람에게 확인받고 `docs/specs/2026-08-14-extraction-analysis.md`의 `status`를 `초안 → 구현완료`로 변경
- `check-spec-coverage.sh`가 이제 이 스펙을 강제 검사 대상으로 잡고 25개 전부 통과 확인

### 다음 세션에게
- `grind` 스펙은 아직 `초안`이다. Task 11(경계값·에러 API 테스트)까지 끝나야 `구현완료`로 바뀐다

---

## 2026-08-15 · Task 3 — `extraction` 추출 수율/SCA 구간 순수 도메인

**브랜치:** `feat/task-03-extraction` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `BrewMeasurement`·`ExtractionAnalyzer`·`ExtractionAnalysis` + `StrengthZone`·`ExtractionZone`·`InvalidBrewMeasurementException` 추가 (Spring·JPA 무의존)
- `ExtractionAnalyzerTest` 25개 작성, AC-EXT-01~36 전체 검증 — 이 스펙은 HTTP가 없어 전부 단위 테스트로 끝난다
- `clean check`·`check-spec-coverage.sh` 그린 확인

### 발견한 것
- 계획 문서 Step 6이 예상한 대로 두 스펙(`grind`·`extraction`) 모두 `status: 초안`으로 남아 커버리지 검사를 건너뛴다. 이 스펙은 Task 11 같은 후속 API 태스크가 없어(AC 전체가 이미 이번 태스크로 끝) `구현완료`로 바꿔야 하는지 애매하지만, 계획이 명시한 기대값을 그대로 따랐다 — 바꾸려면 사람 확인이 먼저 필요해 보인다
- Task 2·3을 각각 독립 브랜치(둘 다 main에서 분기)로 병행 진행하니 `docs/JOURNAL.md`의 삽입 위치(헤더 바로 아래)가 겹쳐 PR을 하나 머지할 때마다 나머지 PR이 다시 충돌했다. 매번 두 항목을 다 유지하며 재병합하는 방식으로 풀었다 — **다음부터는 같은 파일 같은 위치에 동시에 쓰는 병렬 PR을 피하거나, 순서를 미리 정해 순차 머지하는 게 낫다**

### 다음 세션에게
- **`extraction` 스펙의 `status`를 `구현완료`로 바꿀지 사람에게 확인받을 것.** AC 25개가 전부 이 태스크로 끝났는데 계획 문서는 status 전환 시점을 Task 11(grind용)로만 언급해 extraction 몫이 비어 있다
- Task 2(`feat/task-02-grind`, PR #5)는 이미 main에 머지됐다

---

## 2026-08-15 · Task 2 — `grind` 분쇄도 환산 순수 도메인

**브랜치:** `feat/task-02-grind` · **PR:** #5 (머지됨)
**상태:** 완료

### 한 일
- `GrindSpec`·`GrindConverter`·`GrindConversion` + 예외 2종(Spring·JPA 무의존) 추가
- `GrindConverterTest` 20개 작성, AC-GRIND-01~07·14~16 검증. TDD Red→Green으로 진행
- `clean check`·`check-spec-coverage.sh` 그린 확인

### 발견한 것
- 계획 문서 예상 테스트 수는 18개였으나 실제로는 `@Nested` 클래스 4개에 걸쳐 20개가 나왔다. 개수 차이는 각 클래스 안 테스트를 합산하지 않은 계획 문서 쪽 오기로 보인다 — 동작에는 영향 없음
- 스펙 `status`를 구현중으로 바꿨다가, Task 3 계획 문서(Step 6)가 "두 스펙 모두 Task 11까지 초안으로 남는다"를 명시하고 있어 초안으로 되돌렸다. 스펙 status 전환은 계획이 지시하는 시점에만 한다

### 다음 세션에게
- 이 브랜치는 Task 3(`feat/task-03-extraction`, main에서 분기)과 독립적이다. 둘 다 push해 PR을 각각 연다

---

## 2026-08-15 · 세션 복구 (앞 세션 비정상 종료)

**브랜치:** `docs/journal-resume-recovery` · **PR:** #4 (머지됨)
**상태:** 완료 — 구현 없음, 저장소 상태 복구만

### 한 일
- `/resume`이 안 된다는 보고로 조사: 앞 세션이 `.claude/worktrees/resume-session`(브랜치 `feat/task-01-scaffolding`)에서 작업하다 handover 없이 끊겼다. 그 브랜치는 이미 PR #3으로 GitHub에서 스쿼시 머지됐지만, worktree·로컬 브랜치가 정리되지 않고 로컬 `main`도 pull이 안 된 채 남아 있었다
- worktree 제거, 로컬 `feat/task-01-scaffolding` 삭제, `main`을 `origin/main`(`22546b0`)으로 fast-forward
- `./gradlew clean check`, `check-spec-coverage.sh` 재확인 — 둘 다 초록
- Task 2용 브랜치 `feat/task-02-grind`를 만들었으나 이번 세션에서 실제 구현은 진행하지 않음(커밋 0개) — 사용자가 곧바로 `/handover`를 호출해 빈 브랜치는 삭제하고 이 항목만 남김

### 발견한 것
- **핸드오버 없이 세션이 끊기면 worktree·브랜치가 고아로 남아 다음 `/resume`을 헷갈리게 한다.** PR이 머지됐는지, 로컬이 그걸 반영했는지를 `git worktree list` + `gh pr list`로 직접 대조해야 확인 가능했다

### 다음 세션에게
- **Task 2(`grind` 순수 도메인)부터 시작.** `main`은 최신(`22546b0`)이고 검증도 초록이니 바로 `feat/task-02-grind` 브랜치를 새로 따서 계획 문서 Task 2 Step 1부터 진행하면 된다. 이번 세션은 코드를 전혀 건드리지 않았다

---

## 2026-08-15 · Task 1 — 프로젝트 스캐폴딩

**브랜치:** `feat/task-01-scaffolding` · **PR:** 아래 참조
**상태:** 완료 — Step 1~10 전부, `./gradlew clean check` 통과

### 한 일
- start.spring.io로 Java 21 / Boot 4.1.0 프로젝트 생성, 루트 `docker-compose.yml`(Postgres 17), `application.yml`/`-local`/`-test`, `AbstractIntegrationTest` + `TestcontainersConfiguration`, `ApplicationSmokeTest`(`/actuator/health` PASS), Spotless 추가
- `.github/workflows/backend.yml`의 임시 가드(`backend/gradlew` 존재 확인 step과 각 step의 `if:`) 제거 — 계획에서 지시한 대로

### 발견한 것 — 계획의 "검증되지 않은 가정" 결과
1. `bootVersion=4.1.0` 그대로 받아짐 (가정 1 확인)
2. `@ServiceConnection` import 경로는 그대로였다 (가정 2 확인). 다만 **`PostgreSQLContainer` 자체의 패키지가 `org.testcontainers.containers` → `org.testcontainers.postgresql`로 이동**했고 제네릭도 사라져 raw type이 됐다 (계획에 없던 추가 변경)
3. `AutoConfigureMockMvc`도 이동했다: `org.springframework.boot.test.autoconfigure.web.servlet` → `org.springframework.boot.webmvc.test.autoconfigure`
4. Task 7·8의 가정(`MockRestServiceServer.bindTo`, `@MockitoBean`)은 아직 미확인 — 해당 태스크에서 확인할 것

### 발견한 것 — 계획과 달라진 점
- 저장소가 이미 `git init`되어 있어 Step 2의 `git init`은 건너뛰었다. 스캐폴딩만 새 브랜치에 일반 커밋으로 추가
- 루트 `.gitignore`가 이미 백엔드 패턴을 다 포함하고 있어 `backend/.gitignore`는 옮길 것 없이 삭제만 했다
- **환경 이슈:** Spotless 기본 google-java-format(1.24.0)이 이 머신 JDK에서 `NoSuchMethodError`(javac 내부 API가 `Queue`→`List`로 바뀐 최신 JDK 호환성 문제, diffplug/spotless#2468)를 냈다. `1.28.0`으로 버전을 고정해 해결. **PR #3에서 CI(ubuntu-latest + Temurin 21) 확인 완료 — `clean check` 1m38s 초록.**
- `backend/gradle.properties`에 google-java-format용 `--add-exports`/`--add-opens` JVM 인자 추가 (JDK 16+ 공통 이슈, 머신별 경로 아님 — 커밋 안전)
- 생성된 기본 클래스명이 `KaldiNoteApiApplication`(artifactId 기반)이라 문서 구조(`backend/CLAUDE.md`)에 맞춰 `KaldiNoteApplication`으로 정리. 기본 생성 보일러플레이트(`HELP.md`, 컨텍스트 로드 테스트, `TestKaldiNoteApiApplication`)는 계획의 파일 목록에 없어 제거

### 다음 세션에게
- **Task 2(`grind` 순수 도메인)부터.** DB·Spring 의존 없어 바로 시작 가능. PR #3(CI 초록)이 머지된 뒤 `main`에서 새 브랜치를 딴다

---

## 2026-08-14 · 세션 운영 방식 정의 (설계 세션)

**브랜치:** `docs/session-flow` → `docs/journal-design-session` · **PR:** #1 (머지됨), #2
**상태:** 완료 — 이 세션으로 기초 설계와 개발 방식 정의가 끝났다

### 한 일
- 핸드오버 프로토콜 수립 — `/resume`·`/handover` 커맨드, JOURNAL, 체크박스 소유권
- 세션을 **설계 / 구현 / 디자인** 셋으로 나누고 브랜치·산출물·사용 스킬을 정의
- 병렬 작업 규칙 — worktree 사용 조건과 안전한 조합
- 설계 세션도 PR을 거치도록 결정. PR #1이 저장소 첫 PR이다

### 발견한 것
- **superpowers의 `executing-plans`·`using-git-worktrees`·`subagent-driven-development`가 이 프로젝트 흐름과 충돌한다.** 앞 둘은 계획 실행 때마다 worktree를 강제해서 백엔드가 여러 워크스페이스로 갈라진다. `handover.md`에 "쓰지 말 것"으로 명시했다
- **백엔드 세션은 하나만 돌릴 수 있다.** `docker-compose.yml`의 PostgreSQL이 5432 포트 고정이고, 계획의 `TestcontainersConfiguration`이 `.withReuse(true)`라 컨테이너를 공유한다. 둘을 동시에 돌리면 Flyway 마이그레이션과 테스트 데이터가 섞이는데, 증상이 "내 테스트가 이유 없이 실패"로 나타나 원인을 자기 코드에서 찾게 된다
- `EnterWorktree` 도구는 **CLAUDE.md나 메모리가 지시할 때만** 동작한다. 지시가 없으면 병렬 세션이 같은 디렉터리를 공유해버린다. CLAUDE.md에 지시를 넣었다
- CLAUDE.md 영어화를 검토했으나 **한국어는 전체 문자의 21~33%뿐**이라 절감이 세션당 1% 수준이었다. 번역본 이중 관리 비용이 더 커서 한국어 단일로 유지하기로 했다

### 다음 세션에게
- **구현 세션에서 `/resume` → Plan 1 Task 1**부터 시작한다. 설계·계획·스펙이 모두 준비돼 있어 인터뷰가 필요 없다
- 저장소 초기 커밋 5개(`c625b2b`~`359c41a`)는 `main` 직행이다. **규칙 제정 전이라 그런 것이지 예외가 아니다.** 앞으로는 문서만 바꿔도 브랜치·PR을 거친다
- JOURNAL은 파일 하나를 모든 세션이 공유한다. 병렬 세션의 PR을 머지할 때 이 파일에서 충돌이 날 수 있는데, **두 항목을 다 남기면 끝**이다

---

## 2026-08-14 · 설계 · 규칙 수립 (구현 착수 전)

**브랜치:** `main` · **PR:** 없음 (문서만)
**상태:** 완료

### 한 일
- 커피 도메인 조사 → 아키텍처 설계 → Plan 1(태스크 11개) 작성
- 작업 규칙 확립: **스펙 → 계획 → 코드**, 인수 조건은 기계적으로 검증 가능해야 함
- `/interview`로 기능 스펙 2건 작성 — `grind`(AC 21개), `extraction`(AC 25개)
- 두 스펙에 맞춰 Plan 1 갱신 (AC 매핑표 신설, 46개 전부 대응)
- GitHub 저장소 생성 + CI 3종(backend / frontend / spec)

### 발견한 것
- **Spring Boot 3.5는 2026-06-30 OSS 지원 종료.** 신규 프로젝트는 4.1을 써야 한다. Boot 4 함정 3가지(Security 7 CSRF 기본 활성, Jackson 3 = `tools.jackson.*`, springdoc 3.1.0+)는 `backend/CLAUDE.md`에 정리했다
- **OCI 프리티어가 2 OCPU/12GB로 축소**됐다(2026-06-15). 인스턴스는 생성 완료
- 스펙을 쓰면서 Plan 1의 구멍 7개를 찾았다 — 분쇄도 범위 검증 부재, 영점 미만이 500으로 떨어짐, 결과 범위 초과 미정의, 추출 입력 검증 부재, EY 물리 한계 미검증 등. 전부 계획에 반영했다
- **로스팅 원두는 약 28~30%만 수용성**이라 EY 30% 초과는 측정 오입력이다

### 다음 세션에게
- **Plan 1 Task 1부터 시작한다.** `/resume`으로 시작할 것
- 브랜치는 `feat/task-01-scaffolding`
- 계획에 **검증되지 않은 가정 4개**가 명시돼 있다(문서 맨 아래 "자체 검토 결과"). 실행 중 확인되면 이 일지에 결과를 남길 것:
  1. `start.spring.io`가 `bootVersion=4.1.0`을 받는지
  2. Boot 4에서 `@ServiceConnection` import 경로가 그대로인지
  3. `MockRestServiceServer.bindTo(RestClient.Builder)` 가용 여부 (Task 7)
  4. Boot 4에서 `@MockBean`이 제거됐는지 (Task 8) → `@MockitoBean`
- **넷 다 "버전을 낮춘다"로 해결하지 않는다.** 3.5는 지원이 끝났다
- CI 워크플로에 **임시 가드**가 있다. `backend/gradlew`가 생기면 `backend.yml`의 가드 단계와 각 step의 `if:` 조건을 **반드시 지운다.** 안 지우면 CI가 초록인데 아무것도 검사하지 않는 상태가 된다

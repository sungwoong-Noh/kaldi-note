# kaldi note — Backend

Spring Boot API 서버. 커피 레시피·추출 기록의 저장과 계산을 담당한다.

**작업 전 필독:** 루트 `../CLAUDE.md` → **`../docs/conventions/workflow.md`**(스펙 → 계획 → 코드) → 이 문서 → `../docs/conventions/backend.md`

> **세션은 `/resume`으로 시작하고 `/handover`로 끝낸다.** 상세는 `../docs/conventions/handover.md`.
>
> **스펙 없이 코드를 쓰지 않는다.** 기능 개발은 `docs/specs/`의 스펙과 `docs/plans/`의 계획이 승인된 뒤에 시작한다. 테스트에는 인수 조건 ID를 `@DisplayName("AC-GRIND-01 · ...")` 형태로 반드시 남긴다.

> **현재 상태: 운영 중.** `https://api.kaldi-note.today`에 떠 있다. 도메인 패키지 10개
> (`auth`·`brewlog`·`catalog`·`extraction`·`gear`·`grind`·`inventory`·`media`·`recipe`·`user`),
> Flyway 마이그레이션 11개, **테스트 482개**가 초록이다.
>
> 실행 중인 버전은 밖에서 확인할 수 있다 — `curl -s https://api.kaldi-note.today/actuator/info`가
> `build.commit`(40자 git sha)을 돌려준다(`../docs/specs/2026-09-05-build-info.md`).

---

## 기술 스택

| 항목 | 선택 | 이유 |
|---|---|---|
| Java | **21 (LTS)** | Spring Boot 4의 최소 요구. 25도 가능하나 Lombok·Gradle 호환 확인이 필요해 취미 프로젝트에서 감수할 이유가 없다 |
| 프레임워크 | **Spring Boot 4.1.x** | 3.5는 2026-06-30 OSS 지원 종료. **절대 3.x로 내리지 않는다** |
| 빌드 | Gradle (Kotlin DSL) | |
| DB | **PostgreSQL 17** | JSONB·부분 인덱스 활용. Oracle Autonomous DB는 유휴 정지 정책 때문에 배제 |
| 마이그레이션 | **Flyway** | 스키마와 시드 데이터 모두. `ddl-auto`는 `validate` 고정 |
| ORM | Spring Data JPA | QueryDSL은 레시피 검색이 실제로 복잡해지는 Plan 2에서 도입 |
| 인증 | Spring Security 7 + OAuth2(카카오/구글) + 자체 발급 JWT | JWT는 별도 라이브러리 없이 `NimbusJwtEncoder`(HS256) 사용 |
| 테스트 | JUnit 5 + AssertJ + **Testcontainers** | **H2 금지** — 방언 차이로 통합 테스트가 거짓 통과한다 |
| API 문서 | springdoc-openapi **3.1.x** | 3.1.0부터 Boot 4 지원 |
| 포맷터 | Spotless + Google Java Format | |

### ⚠️ Spring Boot 4 함정 3가지

이 프로젝트에서 실제로 문제가 되는 것들이다. 인터넷 예제 대부분이 Boot 3 기준이므로 그대로 복사하면 깨진다.

1. **Spring Security 7은 CSRF가 기본 활성이다.** stateless REST API는 `SecurityConfig`에서 명시적으로 꺼야 한다. 끄지 않으면 모든 POST/PUT/DELETE가 **403**이 된다. Boot 4 마이그레이션 최다 실패 사례.
2. **Jackson 3의 패키지는 `tools.jackson.*`이다** (`com.fasterxml.jackson.*` 아님). `BigDecimal` 직렬화 기본 동작도 달라졌으므로 중량·TDS 응답 포맷은 테스트로 고정한다.
3. **Boot 4는 모듈이 재편됐다.** import가 해결되지 않으면 버전을 낮추지 말고 [Spring Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)에서 새 좌표를 찾는다.

---

## 프로젝트 구조

패키지는 **기술 계층이 아니라 도메인**으로 먼저 나눈다. 함께 바뀌는 코드가 함께 있어야 한다.

```
backend/
├── build.gradle.kts
├── settings.gradle.kts
├── Dockerfile                            (Plan 3에서 추가)
└── src/
    ├── main/java/com/kaldinote/
    │   ├── KaldiNoteApplication.java
    │   │
    │   ├── common/                       ── 도메인이 아닌 횡단 관심사
    │   │   ├── config/                   JPA Auditing, RestClient, OpenAPI 설정
    │   │   ├── entity/BaseTimeEntity     created_at / updated_at 공통 매핑
    │   │   ├── error/                    ErrorCode, BusinessException, GlobalExceptionHandler
    │   │   ├── response/                 ApiResponse, PageResponse
    │   │   └── security/                 SecurityConfig(★CSRF 끄는 곳), JWT 인증 변환, AuthenticatedUser
    │   │
    │   ├── grind/                        ── ★ 순수 계산. Spring·JPA 의존 0
    │   │   └── domain/                   GrindSpec, GrindConverter, GrindConversion
    │   │
    │   ├── extraction/                   ── ★ 순수 계산. Spring·JPA 의존 0
    │   │   └── domain/                   BrewMeasurement, ExtractionAnalyzer, ExtractionAnalysis
    │   │
    │   ├── user/                         User, UserRole, Follow
    │   ├── auth/                         OAuth2 클라이언트, JWT 발급, refresh rotation
    │   ├── catalog/                      Roaster, BeanProduct, BeanOrigin, Variety, CoffeeProcess, FlavorNote
    │   ├── inventory/                    BeanBatch (개인 원두 재고)
    │   ├── gear/                         GrinderModel, UserGrinder, Brewer, BrewFilter, WaterProfile
    │   ├── recipe/                       Recipe, RecipeStep, 포크
    │   ├── brewlog/                      BrewLog, BrewLogStep, 관능 평가
    │   └── media/                        Attachment, OCI Object Storage 연동
    │
    ├── main/resources/
    │   ├── application.yml               공통 설정
    │   ├── application-local.yml         로컬 개발 (docker compose DB)
    │   ├── application-prod.yml          운영 (환경변수 주입)
    │   └── db/migration/                 ★ 스키마와 시드 데이터 전부 여기
    │       ├── V1__create_user_tables.sql
    │       ├── V2__create_catalog_tables.sql
    │       ├── V3__seed_catalog.sql
    │       └── ...
    │
    └── test/java/com/kaldinote/
        ├── TestcontainersConfiguration   PostgreSQL 컨테이너 (재사용)
        ├── AbstractIntegrationTest       ★ 모든 통합 테스트의 베이스
        └── (main과 동일한 패키지 구조)
```

### 도메인 내부 4계층

`grind`, `extraction`을 제외한 모든 도메인 패키지는 아래 구조를 따른다.

```
<domain>/
├── domain/           엔티티, VO, enum, 도메인 서비스 — 비즈니스 규칙이 사는 곳
├── application/      유스케이스 서비스, 요청/응답 DTO — 트랜잭션 경계
├── infrastructure/   JPA 리포지토리, 외부 API 클라이언트
└── presentation/     REST 컨트롤러, 요청/응답 DTO
```

**의존 방향은 안쪽으로만 흐른다:** `presentation → application → domain`, `infrastructure → domain`.
`domain`은 다른 어떤 계층도 참조하지 않는다.

### 도메인 간 경계

- 도메인끼리는 **`application` 계층에서만** 서로를 호출한다.
- 엔티티를 직접 참조하지 않고 **ID로 참조**한다. 예: `BrewLog`는 `Recipe` 엔티티가 아니라 `recipeId`를 갖는다.
  - 이유: 도메인이 독립적으로 이해·테스트되고, 나중에 분리할 여지가 남는다.
  - 예외: 생명주기를 완전히 공유하는 부모-자식(`Recipe` ↔ `RecipeStep`)은 `@OneToMany` 직접 참조를 쓴다.
- `grind`와 `extraction`은 **어떤 도메인도 참조하지 않는다.** 이 둘은 값만 받아 값을 돌려주는 순수 함수다.

---

## 명령어

### 사전 준비

```bash
# 프로젝트 루트에서 로컬 PostgreSQL 기동 (백엔드 작업 전 필수)
cd .. && docker compose up -d && cd backend

# Docker Desktop이 떠 있어야 한다 (Testcontainers도 이걸 쓴다)
docker info > /dev/null && echo "Docker OK"
```

### 빌드 · 테스트 · 실행

```bash
./gradlew build                 # 컴파일 + 테스트 + 패키징
./gradlew test                  # 전체 테스트
./gradlew test --tests '*GrindConverterTest'    # 특정 테스트 클래스
./gradlew test --tests '*.grind.*'              # 특정 패키지
./gradlew bootRun               # 실행 → http://localhost:8080

./gradlew clean test            # 캐시 무시하고 다시
./gradlew test --info           # 테스트 로그 상세 출력
```

### 코드 품질

```bash
./gradlew spotlessCheck         # 포맷 위반 검사 (CI에서 실행)
./gradlew spotlessApply         # 포맷 자동 수정
./gradlew check                 # test + spotlessCheck 전부
```

### 마이그레이션

```bash
./gradlew flywayInfo            # 적용된 마이그레이션 목록
./gradlew flywayValidate        # 체크섬 검증
./gradlew flywayClean           # ⚠️ 로컬 DB 전체 삭제. 운영에서 절대 금지
```

**적용된 마이그레이션 파일은 절대 수정하지 않는다.** 체크섬이 깨진다. 변경이 필요하면 새 버전 파일(`V6__...`)을 추가한다.

### 검증 (작업 완료 시 반드시 실행)

```bash
./gradlew clean check                     # 테스트 + 포맷
(cd .. && ./scripts/check-spec-coverage.sh)   # 인수 조건이 테스트에 있는지
curl -s localhost:8080/actuator/health    # bootRun 중일 때 {"status":"UP"}
```

**둘 다 초록이어야 "완료"라고 말할 수 있다.**

API 문서: `http://localhost:8080/swagger-ui.html` (Plan 1 완료 후)

---

## 테스트 정책

| 구분 | 대상 | 방식 |
|---|---|---|
| **단위 테스트** | `grind`, `extraction`, 도메인 서비스 | Spring 컨텍스트 없이 순수 JUnit. 가장 빠르고 가장 많아야 한다 |
| **통합 테스트** | 리포지토리, 컨트롤러, 인가 규칙 | `extends AbstractIntegrationTest` — Testcontainers PostgreSQL + MockMvc |
| **외부 API** | 카카오/구글 OAuth | `MockRestServiceServer`로 스텁. 실제 호출 금지 |

- **H2를 쓰지 않는다.** JSONB·부분 인덱스·방언 차이로 거짓 통과한다.
- 테스트 메서드명은 **한국어**로 쓴다: `void C40_22클릭은_K_Plus_30클릭에_해당한다()`
- 통합 테스트는 컨테이너 기동 비용이 크므로 `AbstractIntegrationTest` 설정을 통일해 **컨텍스트 캐시를 공유**한다. `@MockBean`을 남발하면 캐시가 깨져 테스트가 급격히 느려진다.

### 반드시 있어야 하는 회귀 테스트

설계의 핵심을 지키는 테스트들이다. 지우거나 약화시키지 않는다.

- 레시피의 `dose_g`를 수정해도 기존 `BrewLog.actual_dose_g`가 변하지 않는다 (스냅샷 불변성)
- PRIVATE 레시피에 타인이 접근하면 403, FRIENDS는 상호 팔로우일 때만 200
- `BeanBatch`를 삭제해도 `BrewLog.days_off_roast`가 남는다
- 클릭당 마이크론이 없는 그라인더는 환산을 거부한다
- TDS가 없어도 브루 비율은 계산되고 응답이 정상이다

---

## 반올림 규칙

측정값은 전부 `BigDecimal`이다. **`double`/`float` 금지** — 커피 계량은 0.1g 단위가 의미를 갖는다.

| 값 | 스케일 | 모드 |
|---|---|---|
| 마이크론(µm) | 0 | HALF_UP |
| 그라인더 설정값(클릭/눈금) | 1 | HALF_UP |
| 추출 수율 EY(%) | 1 | HALF_UP |
| 브루 비율 (1:N의 N) | 1 | HALF_UP |
| 중량(g) | 1 | HALF_UP |

나눗셈은 중간 정밀도 6자리로 계산한 뒤 최종 스케일로 반올림한다.

---

## 자주 하는 실수

- `ddl-auto`를 `update`로 바꾸는 것 → **금지.** Flyway가 스키마 소유자다.
- 적용된 Flyway 파일 수정 → 체크섬 오류. 새 버전 파일을 추가한다.
- `users.email`을 `NOT NULL`로 잡는 것 → **카카오는 이메일 제공 동의가 선택**이라 null이 올 수 있다. 사용자 식별은 `(provider, provider_user_id)`가 담당한다.
- CSRF를 끄지 않고 POST 테스트 → 403.
- Jackson 2 패키지로 import → 컴파일 실패.
- 통합 테스트에서 `@Transactional`로 롤백에 의존하다가 실제 커밋 동작을 놓치는 것 → 인가·스냅샷 테스트는 명시적으로 검증한다.

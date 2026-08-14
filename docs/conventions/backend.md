# 백엔드 컨벤션 (Java / Spring Boot)

기준: [Google Java Style Guide](https://google.github.io/styleguide/javaguide.html). Spotless가 포맷을 강제하므로 **포맷은 고민하지 않는다** — `./gradlew spotlessApply`를 돌린다.

이 문서는 포매터가 잡아주지 않는 것들, 즉 **이름·구조·설계 규칙**을 다룬다.

---

## 네이밍

| 대상 | 규칙 | 예 |
|---|---|---|
| 패키지 | 소문자, 단수형 | `com.kaldinote.recipe` |
| 클래스 | PascalCase | `RecipeService`, `GrindConverter` |
| 메서드·변수 | camelCase | `createRecipe`, `doseG` |
| 상수 | UPPER_SNAKE | `TDS_MIN`, `ESTIMATE_WARNING` |
| enum 상수 | UPPER_SNAKE | `POUR_OVER`, `SINGLE_ORIGIN` |
| DB 테이블·컬럼 | snake_case, 테이블은 복수형 | `bean_products`, `roast_level_agtron` |
| 테스트 클래스 | `<대상>Test` | `GrindConverterTest` |
| 테스트 메서드 | **한국어** snake_case | `C40_22클릭은_660마이크론이다` |

### 계층별 접미사

일관성이 파악 속도를 좌우한다. 예외를 만들지 않는다.

| 역할 | 접미사 | 위치 |
|---|---|---|
| REST 컨트롤러 | `Controller` | `presentation` |
| 유스케이스 서비스 | `Service` | `application` |
| 도메인 서비스 | 접미사 없음 | `domain` |
| JPA 리포지토리 | `Repository` | `infrastructure` |
| 외부 API 클라이언트 | `Client` | `infrastructure` |
| 요청 DTO | `<동작>Request` | `presentation/dto` |
| 응답 DTO | `<대상>Response` | `presentation/dto` |
| 계층 간 전달 객체 | `<대상>Command` / `<대상>Result` | `application/dto` |

### 단위를 이름에 넣는다

커피 도메인은 단위 실수가 곧 버그다. **숫자 필드명에 단위를 붙인다.**

```java
BigDecimal doseG;              // 좋음
BigDecimal waterTempC;         // 좋음
Integer totalTimeSeconds;      // 좋음
BigDecimal micronsPerClick;    // 좋음

BigDecimal dose;               // 나쁨 — g인가 oz인가
Integer time;                  // 나쁨 — 초인가 분인가
```

---

## 패키지 구조

`backend/CLAUDE.md`의 "프로젝트 구조"를 따른다. 요약:

- **도메인으로 먼저 나누고, 그 안에서 계층으로 나눈다.** 계층으로 먼저 나누지 않는다.
- 의존 방향: `presentation → application → domain`, `infrastructure → domain`
- `domain`은 **어떤 계층도 참조하지 않는다.** Spring 애노테이션도 최소화한다(`grind`·`extraction`은 완전히 0).
- 도메인 간 참조는 `application` 계층에서만. 엔티티가 아니라 **ID로 참조**한다.

---

## 클래스 설계

### 엔티티

```java
@Entity
@Table(name = "recipes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)   // JPA 전용. 외부에서 못 만들게
public class Recipe extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dose_g", nullable = false, precision = 6, scale = 1)
    private BigDecimal doseG;

    @Enumerated(EnumType.STRING)                     // ★ ORDINAL 절대 금지
    @Column(nullable = false, length = 20)
    private Visibility visibility;

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("stepOrder ASC")
    private List<RecipeStep> steps = new ArrayList<>();

    // 생성은 정적 팩토리로. 이름이 의도를 설명한다
    public static Recipe create(Long ownerUserId, String title, BigDecimal doseG, ...) { }
    public static Recipe forkOf(Recipe origin, Long newOwnerUserId) { }

    // 상태 변경은 의미 있는 메서드로. setter를 열지 않는다
    public void changeVisibility(Visibility visibility) { }
}
```

**엔티티 규칙**
- `@Setter`를 클래스에 붙이지 않는다. 변경은 의도가 드러나는 메서드로만.
- `@Data`, `@AllArgsConstructor`를 엔티티에 쓰지 않는다.
- `@Enumerated(EnumType.STRING)` — `ORDINAL`은 enum 순서가 바뀌면 데이터가 깨진다.
- 연관관계는 **지연 로딩이 기본**. `@ManyToOne(fetch = FetchType.LAZY)`를 명시한다(기본값이 EAGER다).
- `equals`/`hashCode`를 Lombok으로 생성하지 않는다. 필요하면 `id` 기준으로 직접 작성한다.
- 양방향 연관관계는 꼭 필요할 때만. 부모→자식 단방향으로 충분한 경우가 대부분이다.

### DTO는 record

```java
public record CreateRecipeRequest(
        @NotBlank @Size(max = 100) String title,
        @NotNull @DecimalMin("0.1") BigDecimal doseG,
        @NotNull @DecimalMin("0.1") BigDecimal waterG,
        @Valid @NotEmpty List<StepRequest> steps
) {}
```

- 요청/응답 DTO는 전부 `record`. 불변이고 보일러플레이트가 없다.
- **엔티티를 컨트롤러 응답으로 그대로 반환하지 않는다.** 지연 로딩 프록시 직렬화 오류와 의도치 않은 필드 노출이 발생한다.
- 응답 DTO는 정적 팩토리로 변환한다: `RecipeResponse.from(recipe)`

### 서비스

```java
@Service
@RequiredArgsConstructor              // 생성자 주입. @Autowired 필드 주입 금지
@Transactional(readOnly = true)       // 클래스에 읽기 전용, 쓰기 메서드만 재정의
public class RecipeService {

    private final RecipeRepository recipeRepository;

    @Transactional
    public RecipeResponse create(Long userId, CreateRecipeCommand command) { }
}
```

- **생성자 주입만 사용한다.** 필드 주입(`@Autowired`)은 테스트를 어렵게 하고 순환 의존을 숨긴다.
- `@Transactional(readOnly = true)`를 클래스 기본값으로 두고 쓰기 메서드에만 `@Transactional`을 붙인다.
- 트랜잭션 경계는 `application` 계층에만 둔다. 컨트롤러·리포지토리에 붙이지 않는다.

### 컨트롤러

```java
@RestController
@RequestMapping("/api/v1/recipes")
@RequiredArgsConstructor
public class RecipeController {

    private final RecipeService recipeService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RecipeResponse create(
            @AuthenticationPrincipal AuthenticatedUser user,
            @Valid @RequestBody CreateRecipeRequest request) {
        return recipeService.create(user.id(), request.toCommand());
    }
}
```

- 컨트롤러에는 **비즈니스 로직을 두지 않는다.** 검증 애노테이션 → 서비스 호출 → 응답 변환이 전부다.
- `@Valid`를 빠뜨리지 않는다. 붙이지 않으면 Bean Validation이 동작하지 않는다.

---

## API 설계

### URL

```
/api/v1/recipes                  GET(목록) POST(생성)
/api/v1/recipes/{id}             GET PUT DELETE
/api/v1/recipes/{id}/fork        POST      — 리소스가 아닌 동작은 하위 경로 동사
/api/v1/recipes/{id}/steps       GET
/api/v1/brew-logs                GET POST
/api/v1/gear/grinders            GET
/api/v1/gear/grind-conversions   POST      — 환산 요청
/api/v1/admin/varieties/{id}/merge-into/{targetId}   POST
```

- **복수형 명사**, 소문자, 단어 구분은 하이픈(`brew-logs`).
- 버전은 경로에 `/api/v1`.
- 동사는 URL에 쓰지 않는다. 예외: `fork`, `merge-into`처럼 CRUD로 표현되지 않는 동작.

### 상태 코드

| 코드 | 사용 |
|---|---|
| 200 | 조회·수정 성공 |
| 201 | 생성 성공 (`Location` 헤더 포함) |
| 204 | 삭제 성공 |
| 400 | 검증 실패, 잘못된 요청 |
| 401 | 인증 안 됨 (토큰 없음·만료) |
| 403 | 인증됐으나 권한 없음 (타인의 PRIVATE 레시피 등) |
| 404 | 리소스 없음 |
| 409 | 상태 충돌 (중복 가입 등) |
| 422 | 형식은 맞으나 도메인 규칙 위반 (환산 불가 그라인더 등) |

### 에러 응답

전 API가 동일한 형태를 쓴다.

```json
{
  "code": "GRIND_NOT_CONVERTIBLE",
  "message": "대상 그라인더의 클릭당 마이크론 정보가 없어 환산할 수 없습니다.",
  "fieldErrors": [
    { "field": "doseG", "message": "0.1 이상이어야 합니다" }
  ]
}
```

- `code`는 `ErrorCode` enum의 이름. 프론트가 분기하는 기준이므로 **문구가 아니라 코드로 판단**하게 한다.
- `message`는 **사용자에게 그대로 보여줄 수 있는 한국어**.
- `fieldErrors`는 검증 실패일 때만 채운다.
- `GlobalExceptionHandler` 한 곳에서 변환한다. 컨트롤러에서 `try-catch`로 응답을 만들지 않는다.

### 날짜·시간

- 저장은 `TIMESTAMPTZ`(UTC), Java 타입은 `Instant`.
- API 응답은 **ISO-8601 문자열**: `2026-08-14T09:30:00Z`
- 날짜만 필요한 것(로스팅일 등)은 `LocalDate` + `2026-08-14` 형식.

---

## 데이터베이스

### 마이그레이션

- 파일명: `V<번호>__<설명>.sql` — `V3__seed_catalog.sql`
- 번호는 순차 증가. 브랜치가 갈리면 머지 시 재번호를 매긴다.
- **적용된 파일은 절대 수정하지 않는다.** 체크섬이 깨진다. 새 버전 파일을 추가한다.
- 스키마 변경과 시드 데이터는 **파일을 분리**한다(`V2__create_*`, `V3__seed_*`).
- `DROP`이나 `NOT NULL` 추가처럼 되돌리기 어려운 변경은 커밋 메시지 본문에 이유를 남긴다.

### 스키마 규칙

```sql
CREATE TABLE recipes (
    id              BIGSERIAL PRIMARY KEY,
    owner_user_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
    title           VARCHAR(100) NOT NULL,
    dose_g          NUMERIC(6,1) NOT NULL,
    visibility      VARCHAR(20)  NOT NULL DEFAULT 'PRIVATE',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT chk_dose_positive CHECK (dose_g > 0)
);

CREATE INDEX idx_recipes_owner ON recipes(owner_user_id) WHERE deleted_at IS NULL;
```

- PK는 `BIGSERIAL`.
- 측정값은 `NUMERIC(정밀도, 스케일)`. **`FLOAT`/`DOUBLE PRECISION` 금지.**
- enum은 `VARCHAR` + 애플리케이션에서 검증. PostgreSQL `ENUM` 타입은 값 추가가 번거로워 쓰지 않는다.
- 시간은 전부 `TIMESTAMPTZ`.
- FK에는 인덱스를 만든다(PostgreSQL은 자동 생성하지 않는다).
- 제약 조건 이름을 명시한다: `chk_`, `uq_`, `fk_`, `idx_` 접두어.
- 소프트 삭제 대상은 `deleted_at`을 두고 인덱스에 부분 조건을 건다.

---

## 테스트

```java
class GrindConverterTest {

    private final GrindConverter converter = new GrindConverter();

    @Nested
    @DisplayName("그라인더 간 환산")
    class Convert {

        @Test
        void C40_22클릭은_K_Plus_30클릭에_해당한다() {
            GrindConversion result = converter.convert(C40, new BigDecimal("22"), K_PLUS);

            assertThat(result.targetSetting()).isEqualByComparingTo("30.0");
        }
    }
}
```

- **AssertJ를 쓴다** (`assertThat`). JUnit `Assertions`보다 읽기 쉽고 메시지가 낫다.
- `BigDecimal` 비교는 **`isEqualByComparingTo`**. `isEqualTo`는 스케일까지 비교해 `30`과 `30.0`이 다르다고 판정한다.
- `@Nested` + `@DisplayName`으로 시나리오를 묶는다.
- 테스트 메서드명은 **한국어로 사실을 진술**한다. `test`, `should` 접두어를 붙이지 않는다.
- 하나의 테스트는 하나의 사실만 검증한다.
- **경계값을 반드시 테스트한다.** SCA 구간의 18.0 / 22.0 / 1.15 / 1.35 같은 값이 이 도메인의 핵심이다.

### 통합 테스트

```java
class RecipeControllerTest extends AbstractIntegrationTest {

    @Test
    void 타인의_PRIVATE_레시피_조회는_403이다() throws Exception {
        mockMvc.perform(get("/api/v1/recipes/{id}", otherUsersPrivateRecipeId)
                        .header(HttpHeaders.AUTHORIZATION, bearer(myToken)))
                .andExpect(status().isForbidden());
    }
}
```

- **`AbstractIntegrationTest`를 상속한다.** 컨텍스트 캐시를 공유해야 테스트가 느려지지 않는다.
- `@MockBean`을 남발하면 컨텍스트 캐시가 깨진다. 외부 API는 `MockRestServiceServer`로 스텁한다.
- **H2를 쓰지 않는다.**

---

## 로깅

```java
@Slf4j
public class AuthService {
    public void login(String code) {
        log.info("OAuth 로그인 시도 provider={}", provider);        // 좋음
        log.info("OAuth 로그인 code=" + code);                      // 나쁨: 문자열 연결 + 시크릿 노출
    }
}
```

- `@Slf4j` + 파라미터 바인딩(`{}`). 문자열 연결 금지.
- **토큰·인가코드·비밀번호·이메일 전체를 로그에 남기지 않는다.**
- 레벨: `error`(즉시 대응 필요) / `warn`(비정상이나 처리됨) / `info`(주요 상태 변화) / `debug`(개발용).
- 예외를 잡아서 `log.error`만 하고 삼키지 않는다. 처리하거나 던진다.

---

## 하지 말 것

- `ddl-auto: update` — Flyway가 스키마 소유자다.
- `double`/`float`로 측정값 저장 — 전부 `BigDecimal` / `NUMERIC`.
- 엔티티를 API 응답으로 직접 반환.
- 필드 주입(`@Autowired`).
- `@Enumerated` 기본값(ORDINAL).
- `Optional`을 필드나 파라미터로 사용 — 반환 타입에만 쓴다.
- 컨트롤러의 `try-catch` 에러 응답 — `GlobalExceptionHandler`로 보낸다.
- 주석으로 코드를 남겨두기 — git이 기억한다. 지운다.
- 계획에 없는 추상화 추가 — 두 번째 사용처가 생길 때 추출한다.

# 브루잉 로그 (실측 기록 + EY/SCA 분석) 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-08-17-brew-log.md`

**Goal:** 사용자가 실제로 커피를 내린 뒤, 어떤 레시피·재고·그라인더로 내렸는지와 실측 원두량·물량·물온도·분쇄도를 스냅샷으로 기록하고(POST), 단건 조회(GET) 시 기존 `extraction` 도메인으로 EY/SCA 구간을 재계산해 함께 볼 수 있다.

**Architecture:** `brewlog` 도메인을 4계층(domain/application/infrastructure/presentation)으로 새로 만든다. `BrewLog`는 자식 테이블이 없는 단일 엔티티다. `recipe_id`·`bean_batch_id`·`user_grinder_id`는 전부 소유권 검증이 필요한 FK이므로, `RecipeRepository`·`BeanBatchRepository`·`UserGrinderRepository`·`GrinderModelRepository`를 `brewlog/application` 계층에서 직접 주입해 조회한다 — 레시피 도메인이 `gear` 리포지토리를 직접 참조하는 기존 패턴과 동일하다. 마이크론 스냅샷은 `grind.domain.GrindConverter`, EY/SCA는 `extraction.domain.ExtractionAnalyzer`/`BrewMeasurement`, 디게싱 판정은 `inventory.domain.DegassingStatus`를 그대로 재사용한다 — 셋 다 새로 만들지 않는다.

계획을 쓰며 발견한 선행 문제 하나를 이 계획에 Task 1로 얹는다: `user_grinders`를 만드는 API가 이제까지 하나도 없었다(엔티티·리포지토리만 존재). 브루잉 로그가 `userGrinderId`를 필수로 요구하므로, 그 앞에 최소 생성 API를 먼저 만든다. 스펙에 없는 내용이라 AC ID는 붙이지 않는다.

**작업 위치:** `backend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-BREW-01 | 필수 값만으로 생성 | Task 3 | API 테스트 |
| AC-BREW-02 | 음료중량+TDS 있으면 EY/구간 반환 | Task 3 | API 테스트 |
| AC-BREW-03 | TDS 없으면 EY/구간 null | Task 3 | API 테스트 |
| AC-BREW-04 | 무단계 그라인더 → estimated null, 201 | Task 3 | API 테스트 |
| AC-BREW-05 | daysOffRoast/degassingStatus 생성 시점 스냅샷 | Task 3 | API 테스트 |
| AC-BREW-06 | 단건 조회는 저장값+재계산 EY를 함께 반환 | Task 5 | API 테스트 |
| AC-BREW-07 | 레시피 수정해도 스냅샷 불변 (필수 회귀) | Task 5 | API 테스트 |
| AC-BREW-08 | BeanBatch 삭제해도 daysOffRoast 유지 (필수 회귀) | Task 5 | API 테스트 |
| AC-BREW-09 | 관능 평가 전부 생략해도 생성 | Task 3 | API 테스트 |
| AC-BREW-10~14 | rating 0.5/5.0/0.4/5.1/3.3(배수 아님) | Task 4 | API 테스트 |
| AC-BREW-15~18 | acidity 1/5/0/6 | Task 4 | API 테스트 |
| AC-BREW-19~22 | daysOffRoast 2/3/14/15일 → TOO_FRESH/IDEAL/IDEAL/PAST_PEAK | Task 4 | API 테스트 |
| AC-BREW-23~26 | 음료중량=물량 허용, 물량 초과 거부, EY 30.0 허용, 30.0 초과 거부 | Task 4 | API 테스트 |
| AC-BREW-27~28 | overallNote 1000자/1001자 | Task 4 | API 테스트 |
| AC-BREW-30 | 인증 없이 생성 불가 → 401 | Task 3 | API 테스트 |
| AC-BREW-31~32 | recipeId 없음(404)/남의 것(403) | Task 3 | API 테스트 |
| AC-BREW-33~34 | beanBatchId 없음(404)/남의 것(403) | Task 3 | API 테스트 |
| AC-BREW-35~36 | userGrinderId 없음(404)/남의 것(403) | Task 3 | API 테스트 |
| AC-BREW-37 | brewedAt 미래 → 400 | Task 4 | API 테스트 |
| AC-BREW-38 | actualDoseG 0 이하 → 400 | Task 4 | API 테스트 |
| AC-BREW-39 | 존재하지 않는 브루잉 로그 조회 → 404 | Task 5 | API 테스트 |
| AC-BREW-40 | 남의 브루잉 로그 조회 → 403 | Task 5 | API 테스트 |

**39개 전부 매핑됨** (Task3 13 + Task4 21 + Task5 5 = 39, 스펙과 동일).

---

## Global Constraints

- 측정값은 전부 `BigDecimal`. `double`/`float` 금지.
- 반올림·스케일은 `backend/CLAUDE.md`의 규칙과 스펙의 컬럼 정의(`actualDoseG` precision5/scale1, `actualWaterG`/`beverageWeightG` precision6/scale1, `actualWaterTempC` precision4/scale1, `actualGrindSettingValue` precision7/scale1, `tdsPercent` precision4/scale2, `rating` precision2/scale1)를 그대로 따른다.
- **필드 단순 범위 위반은 Bean Validation → `INVALID_REQUEST`, 필드 간 물리적 정합성 위반은 `BrewMeasurement`/`ExtractionAnalyzer` 재사용 → `INVALID_BREW_MEASUREMENT`.** 새 `ErrorCode`는 추가하지 않는다 — 둘 다 이미 존재한다.
- `recipe`·`inventory`·`gear` 도메인은 `brewlog/application`에서 리포지토리로 직접 조회하되, `brewlog` 엔티티에는 ID(`Long`)만 저장한다.
- **`daysOffRoast`는 `brewedAt`을 `ZoneOffset.UTC` 기준 `LocalDate`로 변환해 `roastedAt`과의 차이로 계산한다.** 서버 타임존에 의존하지 않기 위해 UTC로 고정한다(스펙에 명시되지 않은 구현 결정 — 테스트에서 이 변환을 그대로 재현해야 값이 맞는다).
- **`actualGrindMicronEstimated` 계산은 `GrindConverter.toMicron()`을 그대로 재사용한다.** 이 메서드는 그라인더 설정 범위를 벗어난 값도 함께 검증하므로(`GrindSettingOutOfRangeException` → 400 `GRIND_SETTING_OUT_OF_RANGE`), 스펙 인터뷰에서 명시적으로 다루지 않은 이 동작이 재사용의 자연스러운 결과로 딸려온다. 새 결정이 아니라 기존 `grind` 스펙이 이미 정의한 동작이다.
- `rating`의 "0.5 배수" 검증은 Bean Validation으로 표현할 수 없어 `BrewLogService`에서 `BigDecimal.remainder()`로 직접 검사한다. 범위(`0.5`~`5.0`)는 DTO의 `@DecimalMin`/`@DecimalMax`로 처리한다.
- `AuthenticatedUser` 컨트롤러 파라미터는 `@AuthenticationPrincipal` 없이 타입만으로 받는다(Plan 1 Task 11에서 확인된 동작).
- 검증 순서는 스펙과 동일하게 `401`(미인증) → `404`(FK 없음) → `403`(소유자 아님) → `400`(필드·물리 검증). Bean Validation은 컨트롤러 진입 전에 걸리므로 이 순서와 별개로 항상 먼저 실패한다 — 여기서 말하는 `400`은 서비스 계층에서 도는 물리 검증(`INVALID_BREW_MEASUREMENT`)과 `rating` 배수 검증을 가리킨다.

---

## File Structure

```
backend/src/main/resources/db/migration/
└── V8__create_brew_logs_table.sql

backend/src/main/java/com/kaldinote/gear/
├── domain/UserGrinder.java                         (Modify — Task 1, isOwnedBy 추가)
├── application/GearService.java                    (Modify — Task 1, createUserGrinder 추가)
├── presentation/GearController.java                (Modify — Task 1, POST /user-grinders 추가)
└── presentation/dto/
    ├── UserGrinderCreateRequest.java                (Create — Task 1)
    └── UserGrinderResponse.java                     (Create — Task 1)

backend/src/main/java/com/kaldinote/brewlog/
├── domain/
│   ├── BrewLog.java
│   └── BrewLogVisibility.java
├── infrastructure/
│   └── BrewLogRepository.java
├── application/
│   └── BrewLogService.java
└── presentation/
    ├── BrewLogController.java
    └── dto/
        ├── BrewLogCreateRequest.java
        └── BrewLogResponse.java

backend/src/test/java/com/kaldinote/
├── gear/presentation/GearControllerTest.java        (Modify — Task 1)
└── brewlog/
    ├── infrastructure/BrewLogRepositoryTest.java
    └── presentation/BrewLogControllerTest.java
```

---

## Task 1: 사용자 그라인더 등록 API (선행 태스크)

**Files:**
- Create: `backend/src/main/java/com/kaldinote/gear/presentation/dto/UserGrinderCreateRequest.java`, `UserGrinderResponse.java`
- Modify: `backend/src/main/java/com/kaldinote/gear/domain/UserGrinder.java`, `backend/src/main/java/com/kaldinote/gear/application/GearService.java`, `backend/src/main/java/com/kaldinote/gear/presentation/GearController.java`
- Test: `backend/src/test/java/com/kaldinote/gear/presentation/GearControllerTest.java`

**Covers:** (없음 — 스펙에 없는 선행 인프라. Task 3이 이 API를 실제로 호출해 소유한 `userGrinderId`를 얻는다)

**Interfaces:**
- Consumes: `UserGrinder.of(Long, Long, String)`(기존), `UserGrinderRepository`(기존), `GrinderModelRepository`(기존)
- Produces:
  - `UserGrinder#isOwnedBy(Long userId) → boolean`
  - `GearService#createUserGrinder(Long userId, UserGrinderCreateRequest) → UserGrinderResponse`
  - `POST /api/v1/gear/user-grinders` (201)

- [ ] **Step 1: 실패하는 테스트 작성**

`GearControllerTest`에 아래를 추가한다. 기존 파일은 `token()`이 실제 사용자를 저장하지 않고 고정 ID `1L`을 쓰는데, `user_grinders.user_id`는 `users(id)` FK라 그대로 쓰면 FK 위반이 난다. 새 테스트 전용으로 실제 사용자를 저장하는 헬퍼를 추가한다.

```java
  @Autowired private com.kaldinote.user.infrastructure.UserRepository userRepository;

  private String realUserToken() {
    com.kaldinote.user.domain.User user =
        userRepository.save(com.kaldinote.user.domain.User.create(null, "그라인더테스터", null));
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  @Test
  @DisplayName("사용자 그라인더를 최소 입력으로 등록한다")
  void 사용자_그라인더를_등록한다() throws Exception {
    Long c40 = grinderRepository.findByBrandAndName("Comandante", "C40 MK4").orElseThrow().getId();
    mockMvc
        .perform(
            post("/api/v1/gear/user-grinders")
                .header(HttpHeaders.AUTHORIZATION, realUserToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"grinderModelId":%d,"nickname":"내 C40"}
                    """.formatted(c40)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.grinderModelId").value(c40))
        .andExpect(jsonPath("$.nickname").value("내 C40"))
        .andExpect(jsonPath("$.calibrationOffsetClicks").value(0))
        .andExpect(jsonPath("$.isDefault").value(false));
  }

  @Test
  @DisplayName("존재하지 않는 grinderModelId로 사용자 그라인더를 등록하면 404다")
  void 존재하지_않는_그라인더로_등록하면_404다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/gear/user-grinders")
                .header(HttpHeaders.AUTHORIZATION, realUserToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"grinderModelId":999999}
                    """))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("인증 없이 사용자 그라인더를 등록할 수 없다")
  void 인증_없이_사용자_그라인더를_등록할_수_없다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/gear/user-grinders")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"grinderModelId":1}
                    """))
        .andExpect(status().isUnauthorized());
  }
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*GearControllerTest'`
Expected: 컴파일 실패 (`UserGrinderCreateRequest`·`UserGrinderResponse`·`createUserGrinder`·엔드포인트 없음).

- [ ] **Step 3: DTO · 엔티티 · 서비스 · 컨트롤러 작성**

`UserGrinderCreateRequest.java`:

```java
package com.kaldinote.gear.presentation.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UserGrinderCreateRequest(@NotNull Long grinderModelId, @Size(max = 50) String nickname) {}
```

`UserGrinderResponse.java`:

```java
package com.kaldinote.gear.presentation.dto;

import com.kaldinote.gear.domain.UserGrinder;
import java.math.BigDecimal;

public record UserGrinderResponse(
    Long id, Long grinderModelId, String nickname, BigDecimal calibrationOffsetClicks, boolean isDefault) {

  public static UserGrinderResponse from(UserGrinder g) {
    return new UserGrinderResponse(
        g.getId(), g.getGrinderModelId(), g.getNickname(), g.getCalibrationOffsetClicks(), g.isDefault());
  }
}
```

`UserGrinder.java`에 메서드 추가(파일 끝, 기존 `of()` 아래):

```java
  public boolean isOwnedBy(Long userId) {
    return this.userId != null && this.userId.equals(userId);
  }
```

`GearService.java` 수정 — 필드·메서드 추가:

```java
package com.kaldinote.gear.application;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.gear.domain.UserGrinder;
import com.kaldinote.gear.infrastructure.BrewFilterRepository;
import com.kaldinote.gear.infrastructure.BrewerRepository;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.gear.infrastructure.UserGrinderRepository;
import com.kaldinote.gear.presentation.dto.BrewFilterResponse;
import com.kaldinote.gear.presentation.dto.BrewerResponse;
import com.kaldinote.gear.presentation.dto.GrinderModelResponse;
import com.kaldinote.gear.presentation.dto.UserGrinderCreateRequest;
import com.kaldinote.gear.presentation.dto.UserGrinderResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GearService {

  private final GrinderModelRepository grinderRepository;
  private final BrewerRepository brewerRepository;
  private final BrewFilterRepository filterRepository;
  private final UserGrinderRepository userGrinderRepository;

  public List<GrinderModelResponse> findAllGrinders() {
    return grinderRepository.findAllByOrderByBrandAscNameAsc().stream()
        .map(GrinderModelResponse::from)
        .toList();
  }

  public List<BrewerResponse> findAllBrewers() {
    return brewerRepository.findAllByOrderByBrandAscNameAsc().stream()
        .map(BrewerResponse::from)
        .toList();
  }

  public List<BrewFilterResponse> findAllFilters() {
    return filterRepository.findAllByOrderByNameAsc().stream()
        .map(BrewFilterResponse::from)
        .toList();
  }

  @Transactional
  public UserGrinderResponse createUserGrinder(Long userId, UserGrinderCreateRequest request) {
    if (!grinderRepository.existsById(request.grinderModelId())) {
      throw new BusinessException(
          ErrorCode.NOT_FOUND, "그라인더를 찾을 수 없습니다: " + request.grinderModelId());
    }
    UserGrinder grinder = UserGrinder.of(userId, request.grinderModelId(), request.nickname());
    return UserGrinderResponse.from(userGrinderRepository.save(grinder));
  }
}
```

`GearController.java`에 추가:

```java
  @PostMapping("/user-grinders")
  @ResponseStatus(HttpStatus.CREATED)
  public UserGrinderResponse createUserGrinder(
      @Valid @RequestBody UserGrinderCreateRequest request,
      com.kaldinote.common.security.AuthenticatedUser user) {
    return gearService.createUserGrinder(user.id(), request);
  }
```

(`HttpStatus`·`ResponseStatus`·`PostMapping`·`RequestBody`·`Valid` import는 기존 파일에 이미 있다. `UserGrinderCreateRequest`/`UserGrinderResponse` import를 추가한다.)

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*GearControllerTest'`
Expected: PASS, 기존 2개 + 신규 3개 = 5 tests.

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(gear): 사용자 그라인더 등록 API 추가" && cd backend
```

---

## Task 2: 브루잉 로그 스키마 · 엔티티 · 리포지토리 (기반)

**Files:**
- Create: `backend/src/main/resources/db/migration/V8__create_brew_logs_table.sql`
- Create: `backend/src/main/java/com/kaldinote/brewlog/domain/BrewLog.java`, `BrewLogVisibility.java`
- Create: `backend/src/main/java/com/kaldinote/brewlog/infrastructure/BrewLogRepository.java`
- Test: `backend/src/test/java/com/kaldinote/brewlog/infrastructure/BrewLogRepositoryTest.java`

**Covers:** (없음 — 후속 태스크의 기반)

**Interfaces:**
- Consumes: `BaseTimeEntity`, `users(id)`/`recipes(id)`/`bean_batches(id)`/`user_grinders(id)` FK
- Produces:
  - `BrewLog.create(Long userId, Long recipeId, Long beanBatchId, Instant brewedAt, BigDecimal actualDoseG, BigDecimal actualWaterG, BigDecimal actualWaterTempC, Integer actualTotalTimeSeconds, Integer actualDrawdownSeconds, Long userGrinderId, BigDecimal actualGrindSettingValue, BigDecimal actualGrindMicronEstimated, BigDecimal beverageWeightG, BigDecimal tdsPercent, Integer daysOffRoast, String degassingStatus, BigDecimal rating, Short acidity, Short sweetness, Short body, Short bitterness, Short aftertaste, String overallNote)`
  - `BrewLog#isOwnedBy(Long)`
  - `BrewLogRepository extends JpaRepository<BrewLog, Long>`(추가 쿼리 메서드 없음 — 소프트 삭제가 없어 `findById`로 충분)

- [ ] **Step 1: 스키마 마이그레이션 작성**

`V8__create_brew_logs_table.sql`:

```sql
CREATE TABLE brew_logs (
    id                             BIGSERIAL PRIMARY KEY,
    user_id                        BIGINT       NOT NULL REFERENCES users (id),
    recipe_id                      BIGINT       NOT NULL REFERENCES recipes (id),
    bean_batch_id                  BIGINT       NOT NULL REFERENCES bean_batches (id),
    brewed_at                      TIMESTAMPTZ  NOT NULL,
    visibility                     VARCHAR(20)  NOT NULL DEFAULT 'PRIVATE',
    actual_dose_g                  NUMERIC(5,1) NOT NULL,
    actual_water_g                 NUMERIC(6,1) NOT NULL,
    actual_water_temp_c            NUMERIC(4,1) NOT NULL,
    actual_total_time_seconds      INTEGER,
    actual_drawdown_seconds        INTEGER,
    user_grinder_id                BIGINT       NOT NULL REFERENCES user_grinders (id),
    actual_grind_setting_value     NUMERIC(7,1) NOT NULL,
    actual_grind_micron_estimated  NUMERIC(6,0),
    beverage_weight_g              NUMERIC(6,1),
    tds_percent                    NUMERIC(4,2),
    days_off_roast                 INTEGER      NOT NULL,
    degassing_status               VARCHAR(20)  NOT NULL,
    rating                         NUMERIC(2,1),
    acidity                        SMALLINT,
    sweetness                      SMALLINT,
    body                           SMALLINT,
    bitterness                     SMALLINT,
    aftertaste                     SMALLINT,
    overall_note                   VARCHAR(1000),
    created_at                     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at                     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_brew_log_dose_positive  CHECK (actual_dose_g > 0),
    CONSTRAINT chk_brew_log_water_positive CHECK (actual_water_g > 0)
);

CREATE INDEX idx_brew_logs_user         ON brew_logs (user_id);
CREATE INDEX idx_brew_logs_recipe       ON brew_logs (recipe_id);
CREATE INDEX idx_brew_logs_bean_batch   ON brew_logs (bean_batch_id);
CREATE INDEX idx_brew_logs_user_grinder ON brew_logs (user_grinder_id);
```

- [ ] **Step 2: 실패하는 리포지토리 테스트 작성**

`BrewLogRepositoryTest.java`:

```java
package com.kaldinote.brewlog.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.brewlog.domain.BrewLog;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BrewLogRepositoryTest extends AbstractIntegrationTest {

  @Autowired private BrewLogRepository brewLogRepository;

  @Test
  void 브루잉_로그를_저장하고_조회한다() {
    BrewLog log =
        BrewLog.create(
            1L, 1L, 1L, Instant.parse("2026-08-17T08:30:00Z"),
            new BigDecimal("15.0"), new BigDecimal("250.0"), new BigDecimal("92.0"),
            210, 180,
            1L, new BigDecimal("22.0"), new BigDecimal("660"),
            new BigDecimal("240.0"), new BigDecimal("1.25"),
            6, "IDEAL",
            new BigDecimal("4.5"), (short) 4, (short) 3, (short) 3, (short) 2, (short) 4,
            "테스트 노트");

    BrewLog saved = brewLogRepository.save(log);

    BrewLog found = brewLogRepository.findById(saved.getId()).orElseThrow();
    assertThat(found.getActualDoseG()).isEqualByComparingTo("15.0");
    assertThat(found.getDaysOffRoast()).isEqualTo(6);
    assertThat(found.getDegassingStatus()).isEqualTo("IDEAL");
    assertThat(found.isOwnedBy(1L)).isTrue();
    assertThat(found.isOwnedBy(2L)).isFalse();
  }
}
```

> 이 테스트는 FK 무결성을 강제하지 않는 순수 엔티티 저장 확인이 목적이라, `recipe_id`/`bean_batch_id`/`user_grinder_id`에 실제로 존재하는 로우의 id가 필요하다. Testcontainers는 매 테스트 초기화 시 Flyway로 시드 데이터(품종·가공법·그라인더 등)만 채우고 `recipes`/`bean_batches`/`user_grinders`는 비어 있으므로, **이 테스트는 FK 위반으로 실패할 수 있다.** 그 경우 Step 3에서 최소 사용자·레시피·재고·사용자그라인더를 리포지토리로 직접 저장한 뒤 그 id를 쓰도록 고친다(Task 1의 `UserGrinder.of`, `recipe`/`inventory` 도메인의 기존 `create` 팩토리를 재사용). 이 조정이 필요한지는 Step 2에서 실제로 실행해봐야 확정된다 — **검증되지 않은 가정**으로 남긴다.

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BrewLogRepositoryTest'`
Expected: 컴파일 실패 (엔티티·리포지토리 없음). FK 위반 여부는 엔티티 작성 후 Step 5에서 판가름난다.

- [ ] **Step 4: 엔티티 작성**

`BrewLogVisibility.java`:

```java
package com.kaldinote.brewlog.domain;

public enum BrewLogVisibility {
  PRIVATE,
  FRIENDS,
  PUBLIC
}
```

`BrewLog.java`:

```java
package com.kaldinote.brewlog.domain;

import com.kaldinote.common.entity.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "brew_logs")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrewLog extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(name = "recipe_id", nullable = false)
  private Long recipeId;

  @Column(name = "bean_batch_id", nullable = false)
  private Long beanBatchId;

  @Column(name = "brewed_at", nullable = false)
  private Instant brewedAt;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private BrewLogVisibility visibility;

  @Column(name = "actual_dose_g", nullable = false, precision = 5, scale = 1)
  private BigDecimal actualDoseG;

  @Column(name = "actual_water_g", nullable = false, precision = 6, scale = 1)
  private BigDecimal actualWaterG;

  @Column(name = "actual_water_temp_c", nullable = false, precision = 4, scale = 1)
  private BigDecimal actualWaterTempC;

  @Column(name = "actual_total_time_seconds")
  private Integer actualTotalTimeSeconds;

  @Column(name = "actual_drawdown_seconds")
  private Integer actualDrawdownSeconds;

  @Column(name = "user_grinder_id", nullable = false)
  private Long userGrinderId;

  @Column(name = "actual_grind_setting_value", nullable = false, precision = 7, scale = 1)
  private BigDecimal actualGrindSettingValue;

  @Column(name = "actual_grind_micron_estimated", precision = 6, scale = 0)
  private BigDecimal actualGrindMicronEstimated;

  @Column(name = "beverage_weight_g", precision = 6, scale = 1)
  private BigDecimal beverageWeightG;

  @Column(name = "tds_percent", precision = 4, scale = 2)
  private BigDecimal tdsPercent;

  @Column(name = "days_off_roast", nullable = false)
  private Integer daysOffRoast;

  @Column(name = "degassing_status", nullable = false, length = 20)
  private String degassingStatus;

  @Column(precision = 2, scale = 1)
  private BigDecimal rating;

  private Short acidity;
  private Short sweetness;
  private Short body;
  private Short bitterness;
  private Short aftertaste;

  @Column(name = "overall_note", length = 1000)
  private String overallNote;

  private BrewLog(
      Long userId,
      Long recipeId,
      Long beanBatchId,
      Instant brewedAt,
      BigDecimal actualDoseG,
      BigDecimal actualWaterG,
      BigDecimal actualWaterTempC,
      Integer actualTotalTimeSeconds,
      Integer actualDrawdownSeconds,
      Long userGrinderId,
      BigDecimal actualGrindSettingValue,
      BigDecimal actualGrindMicronEstimated,
      BigDecimal beverageWeightG,
      BigDecimal tdsPercent,
      Integer daysOffRoast,
      String degassingStatus,
      BigDecimal rating,
      Short acidity,
      Short sweetness,
      Short body,
      Short bitterness,
      Short aftertaste,
      String overallNote) {
    this.userId = userId;
    this.recipeId = recipeId;
    this.beanBatchId = beanBatchId;
    this.brewedAt = brewedAt;
    this.visibility = BrewLogVisibility.PRIVATE;
    this.actualDoseG = actualDoseG;
    this.actualWaterG = actualWaterG;
    this.actualWaterTempC = actualWaterTempC;
    this.actualTotalTimeSeconds = actualTotalTimeSeconds;
    this.actualDrawdownSeconds = actualDrawdownSeconds;
    this.userGrinderId = userGrinderId;
    this.actualGrindSettingValue = actualGrindSettingValue;
    this.actualGrindMicronEstimated = actualGrindMicronEstimated;
    this.beverageWeightG = beverageWeightG;
    this.tdsPercent = tdsPercent;
    this.daysOffRoast = daysOffRoast;
    this.degassingStatus = degassingStatus;
    this.rating = rating;
    this.acidity = acidity;
    this.sweetness = sweetness;
    this.body = body;
    this.bitterness = bitterness;
    this.aftertaste = aftertaste;
    this.overallNote = overallNote;
  }

  public static BrewLog create(
      Long userId,
      Long recipeId,
      Long beanBatchId,
      Instant brewedAt,
      BigDecimal actualDoseG,
      BigDecimal actualWaterG,
      BigDecimal actualWaterTempC,
      Integer actualTotalTimeSeconds,
      Integer actualDrawdownSeconds,
      Long userGrinderId,
      BigDecimal actualGrindSettingValue,
      BigDecimal actualGrindMicronEstimated,
      BigDecimal beverageWeightG,
      BigDecimal tdsPercent,
      Integer daysOffRoast,
      String degassingStatus,
      BigDecimal rating,
      Short acidity,
      Short sweetness,
      Short body,
      Short bitterness,
      Short aftertaste,
      String overallNote) {
    return new BrewLog(
        userId, recipeId, beanBatchId, brewedAt,
        actualDoseG, actualWaterG, actualWaterTempC,
        actualTotalTimeSeconds, actualDrawdownSeconds,
        userGrinderId, actualGrindSettingValue, actualGrindMicronEstimated,
        beverageWeightG, tdsPercent,
        daysOffRoast, degassingStatus,
        rating, acidity, sweetness, body, bitterness, aftertaste, overallNote);
  }

  public boolean isOwnedBy(Long userId) {
    return this.userId != null && this.userId.equals(userId);
  }
}
```

`BrewLogRepository.java`:

```java
package com.kaldinote.brewlog.infrastructure;

import com.kaldinote.brewlog.domain.BrewLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BrewLogRepository extends JpaRepository<BrewLog, Long> {}
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BrewLogRepositoryTest'`
Expected: PASS, 1 test. FK 위반이 나면 Global Constraints의 메모대로 사용자·레시피·재고·사용자그라인더를 먼저 저장해 실제 id를 쓰도록 테스트를 고친다.

- [ ] **Step 6: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(brewlog): 브루잉 로그 스키마와 엔티티 추가" && cd backend
```

---

## Task 3: 브루잉 로그 생성 API — 정상 동작 + FK 소유 검증 + 스냅샷

**Files:**
- Create: `backend/src/main/java/com/kaldinote/brewlog/presentation/dto/BrewLogCreateRequest.java`, `BrewLogResponse.java`
- Create: `backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java`
- Create: `backend/src/main/java/com/kaldinote/brewlog/presentation/BrewLogController.java`
- Test: `backend/src/test/java/com/kaldinote/brewlog/presentation/BrewLogControllerTest.java`

**Covers:** AC-BREW-01, 02, 03, 04, 05, 09, 30, 31, 32, 33, 34, 35, 36

**Interfaces:**
- Consumes: `BrewLog.create(...)`(Task 2), `Recipe`/`RecipeRepository`(recipe 도메인, 기존), `BeanBatch`/`BeanBatchRepository`(inventory 도메인, 기존), `UserGrinder`/`UserGrinderRepository`(Task 1), `GrinderModel`/`GrinderModelRepository`(gear 도메인, 기존), `GrindConverter`/`GrindSpec`(grind 도메인, 기존), `BrewMeasurement`/`ExtractionAnalyzer`/`ExtractionAnalysis`(extraction 도메인, 기존), `DegassingStatus`(inventory 도메인, 기존), `AuthenticatedUser`
- Produces:
  - `BrewLogService#create(Long userId, BrewLogCreateRequest request) → BrewLogResponse`
  - `POST /api/v1/brew-logs` (201)

> **DTO에는 이 태스크에서 `@NotNull`만 넣는다.** `@DecimalMin`/`@Max`/`@Size`/`@PastOrPresent` 같은 범위·경계 애노테이션과 `rating` 배수 검증은 Task 4가 추가한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`BrewLogControllerTest.java`:

```java
package com.kaldinote.brewlog.presentation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BrewLogControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private GrinderModelRepository grinderModelRepository;

  private String token(String nickname) {
    User user = userRepository.save(User.create(null, nickname, null));
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private Long c40Id() {
    return grinderModelRepository.findByBrandAndName("Comandante", "C40 MK4").orElseThrow().getId();
  }

  private Long wilfaId() {
    return grinderModelRepository.findByBrandAndName("Wilfa", "Uniform").orElseThrow().getId();
  }

  private Long userGrinderId(String token, Long grinderModelId) throws Exception {
    String body =
        mockMvc
            .perform(
                post("/api/v1/gear/user-grinders")
                    .header(HttpHeaders.AUTHORIZATION, token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {"grinderModelId":%d,"nickname":"내 그라인더"}
                        """.formatted(grinderModelId)))
            .andReturn()
            .getResponse()
            .getContentAsString();
    return Long.valueOf(JsonPath.read(body, "$.id").toString());
  }

  private Long recipeId(String token) throws Exception {
    String body =
        mockMvc
            .perform(
                post("/api/v1/recipes")
                    .header(HttpHeaders.AUTHORIZATION, token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                        {"title":"브루잉 로그 테스트용","doseG":15.0,"waterG":250.0}
                        """))
            .andReturn()
            .getResponse()
            .getContentAsString();
    return Long.valueOf(JsonPath.read(body, "$.id").toString());
  }

  private Long roasterId(String token) throws Exception {
    String body =
        mockMvc
            .perform(
                post("/api/v1/roasters")
                    .header(HttpHeaders.AUTHORIZATION, token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"name":"브루잉로그테스트로스터-%s"}
                        """
                            .formatted(UUID.randomUUID())))
            .andReturn()
            .getResponse()
            .getContentAsString();
    return Long.valueOf(JsonPath.read(body, "$.id").toString());
  }

  private Long beanProductId(String token) throws Exception {
    Long roasterId = roasterId(token);
    String body =
        mockMvc
            .perform(
                post("/api/v1/bean-products")
                    .header(HttpHeaders.AUTHORIZATION, token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"roasterId":%d,"name":"브루잉로그테스트상품-%s","beanMix":"SINGLE_ORIGIN","roastLevel":"LIGHT",
                         "origins":[{"country":"ET"}]}
                        """
                            .formatted(roasterId, UUID.randomUUID())))
            .andReturn()
            .getResponse()
            .getContentAsString();
    return Long.valueOf(JsonPath.read(body, "$.id").toString());
  }

  /** roastedAt이 brewedAt 날짜(UTC)로부터 daysAgo일 전인 재고를 만든다. */
  private Long beanBatchId(String token, Instant brewedAt, long daysAgo) throws Exception {
    Long productId = beanProductId(token);
    LocalDate roastedAt = brewedAt.atZone(ZoneOffset.UTC).toLocalDate().minusDays(daysAgo);
    String body =
        mockMvc
            .perform(
                post("/api/v1/bean-batches")
                    .header(HttpHeaders.AUTHORIZATION, token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"beanProductId":%d,"weightG":200.0,"roastedAt":"%s"}
                        """
                            .formatted(productId, roastedAt)))
            .andReturn()
            .getResponse()
            .getContentAsString();
    return Long.valueOf(JsonPath.read(body, "$.id").toString());
  }

  private String minimalBody(Long recipeId, Long beanBatchId, Instant brewedAt, Long userGrinderId) {
    return """
        {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
         "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
         "userGrinderId":%d,"actualGrindSettingValue":22.0}
        """
        .formatted(recipeId, beanBatchId, brewedAt, userGrinderId);
  }

  private ResultActions createBrewLog(String token, String body) throws Exception {
    return mockMvc.perform(
        post("/api/v1/brew-logs")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  @Test
  @DisplayName("AC-BREW-01 · 필수 값만으로 브루잉 로그가 생성된다")
  void 필수_값만으로_생성된다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(token, minimalBody(recipeId, beanBatchId, brewedAt, userGrinderId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.visibility").value("PRIVATE"))
        .andExpect(jsonPath("$.actualGrindMicronEstimated").value(660))
        .andExpect(jsonPath("$.beverageWeightG").doesNotExist())
        .andExpect(jsonPath("$.rating").doesNotExist());
  }

  @Test
  @DisplayName("AC-BREW-02 · 음료 중량과 TDS가 있으면 EY/구간이 함께 반환된다")
  void 음료중량과_TDS가_있으면_EY가_반환된다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    String body =
        """
        {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
         "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
         "userGrinderId":%d,"actualGrindSettingValue":22.0,
         "beverageWeightG":240.0,"tdsPercent":1.25}
        """
            .formatted(recipeId, beanBatchId, brewedAt, userGrinderId);

    createBrewLog(token, body)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.extractionYieldPercent").value(20.0))
        .andExpect(jsonPath("$.strengthZone").value("IDEAL"))
        .andExpect(jsonPath("$.extractionZone").value("IDEAL"))
        .andExpect(jsonPath("$.diagnosis").value(org.hamcrest.Matchers.containsString("이상적")));
  }

  @Test
  @DisplayName("AC-BREW-03 · TDS가 없으면 수율과 구간이 모두 null이다")
  void TDS가_없으면_수율과_구간이_null이다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    String body =
        """
        {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
         "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
         "userGrinderId":%d,"actualGrindSettingValue":22.0,
         "beverageWeightG":240.0}
        """
            .formatted(recipeId, beanBatchId, brewedAt, userGrinderId);

    createBrewLog(token, body)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.extractionYieldPercent").doesNotExist())
        .andExpect(jsonPath("$.strengthZone").doesNotExist())
        .andExpect(jsonPath("$.extractionZone").doesNotExist())
        .andExpect(jsonPath("$.diagnosis").value(org.hamcrest.Matchers.containsString("TDS")));
  }

  @Test
  @DisplayName("AC-BREW-04 · 무단계 그라인더를 쓰면 마이크론 추정치만 null이고 생성은 성공한다")
  void 무단계_그라인더는_추정치만_null이다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, wilfaId());

    createBrewLog(token, minimalBody(recipeId, beanBatchId, brewedAt, userGrinderId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.actualGrindMicronEstimated").doesNotExist());
  }

  @Test
  @DisplayName("AC-BREW-05 · daysOffRoast와 degassingStatus는 brewedAt 기준으로 생성 시점에 계산된다")
  void daysOffRoast는_brewedAt_기준으로_계산된다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(token, minimalBody(recipeId, beanBatchId, brewedAt, userGrinderId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.daysOffRoast").value(6))
        .andExpect(jsonPath("$.degassingStatus").value("IDEAL"));
  }

  @Test
  @DisplayName("AC-BREW-09 · 관능 평가 필드를 전부 생략해도 생성된다")
  void 관능_평가를_전부_생략해도_생성된다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(token, minimalBody(recipeId, beanBatchId, brewedAt, userGrinderId))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.rating").doesNotExist())
        .andExpect(jsonPath("$.acidity").doesNotExist())
        .andExpect(jsonPath("$.overallNote").doesNotExist());
  }

  @Test
  @DisplayName("AC-BREW-30 · 인증 없이 생성할 수 없다")
  void 인증_없이_생성할_수_없다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/brew-logs")
                .contentType(MediaType.APPLICATION_JSON)
                .content(minimalBody(1L, 1L, Instant.parse("2026-08-17T08:30:00Z"), 1L)))
        .andExpect(status().isUnauthorized());
  }

  @Test
  @DisplayName("AC-BREW-31 · 존재하지 않는 recipeId는 404다")
  void 존재하지_않는_recipeId는_404다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(token, minimalBody(999999L, beanBatchId, brewedAt, userGrinderId))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BREW-32 · 남의 레시피를 가리키면 403이다")
  void 남의_레시피를_가리키면_403이다() throws Exception {
    String owner = token("소유자");
    Long othersRecipeId = recipeId(owner);

    String requester = token("요청자");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long beanBatchId = beanBatchId(requester, brewedAt, 6);
    Long userGrinderId = userGrinderId(requester, c40Id());

    createBrewLog(requester, minimalBody(othersRecipeId, beanBatchId, brewedAt, userGrinderId))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-BREW-33 · 존재하지 않는 beanBatchId는 404다")
  void 존재하지_않는_beanBatchId는_404다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(token, minimalBody(recipeId, 999999L, brewedAt, userGrinderId))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BREW-34 · 남의 재고를 가리키면 403이다")
  void 남의_재고를_가리키면_403이다() throws Exception {
    String owner = token("소유자");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long othersBeanBatchId = beanBatchId(owner, brewedAt, 6);

    String requester = token("요청자");
    Long recipeId = recipeId(requester);
    Long userGrinderId = userGrinderId(requester, c40Id());

    createBrewLog(requester, minimalBody(recipeId, othersBeanBatchId, brewedAt, userGrinderId))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("AC-BREW-35 · 존재하지 않는 userGrinderId는 404다")
  void 존재하지_않는_userGrinderId는_404다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);

    createBrewLog(token, minimalBody(recipeId, beanBatchId, brewedAt, 999999L))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BREW-36 · 남의 그라인더를 가리키면 403이다")
  void 남의_그라인더를_가리키면_403이다() throws Exception {
    String owner = token("소유자");
    Long othersUserGrinderId = userGrinderId(owner, c40Id());

    String requester = token("요청자");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(requester);
    Long beanBatchId = beanBatchId(requester, brewedAt, 6);

    createBrewLog(requester, minimalBody(recipeId, beanBatchId, brewedAt, othersUserGrinderId))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: 컴파일 실패 (DTO·서비스·컨트롤러·엔드포인트 없음).

- [ ] **Step 3: DTO · 서비스 · 컨트롤러 작성**

`BrewLogCreateRequest.java`:

```java
package com.kaldinote.brewlog.presentation.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;

public record BrewLogCreateRequest(
    @NotNull Long recipeId,
    @NotNull Long beanBatchId,
    @NotNull Instant brewedAt,
    @NotNull BigDecimal actualDoseG,
    @NotNull BigDecimal actualWaterG,
    @NotNull BigDecimal actualWaterTempC,
    Integer actualTotalTimeSeconds,
    Integer actualDrawdownSeconds,
    @NotNull Long userGrinderId,
    @NotNull BigDecimal actualGrindSettingValue,
    BigDecimal beverageWeightG,
    BigDecimal tdsPercent,
    BigDecimal rating,
    Short acidity,
    Short sweetness,
    Short body,
    Short bitterness,
    Short aftertaste,
    String overallNote) {}
```

`BrewLogResponse.java`:

```java
package com.kaldinote.brewlog.presentation.dto;

import com.kaldinote.brewlog.domain.BrewLog;
import com.kaldinote.extraction.domain.ExtractionAnalysis;
import java.math.BigDecimal;
import java.time.Instant;

public record BrewLogResponse(
    Long id,
    Long userId,
    Long recipeId,
    Long beanBatchId,
    Instant brewedAt,
    String visibility,
    BigDecimal actualDoseG,
    BigDecimal actualWaterG,
    BigDecimal actualWaterTempC,
    Integer actualTotalTimeSeconds,
    Integer actualDrawdownSeconds,
    Long userGrinderId,
    BigDecimal actualGrindSettingValue,
    BigDecimal actualGrindMicronEstimated,
    BigDecimal beverageWeightG,
    BigDecimal tdsPercent,
    Integer daysOffRoast,
    String degassingStatus,
    BigDecimal brewRatio,
    BigDecimal extractionYieldPercent,
    String strengthZone,
    String extractionZone,
    String diagnosis,
    BigDecimal rating,
    Short acidity,
    Short sweetness,
    Short body,
    Short bitterness,
    Short aftertaste,
    String overallNote,
    Instant createdAt,
    Instant updatedAt) {

  public static BrewLogResponse from(BrewLog log, ExtractionAnalysis analysis) {
    return new BrewLogResponse(
        log.getId(),
        log.getUserId(),
        log.getRecipeId(),
        log.getBeanBatchId(),
        log.getBrewedAt(),
        log.getVisibility().name(),
        log.getActualDoseG(),
        log.getActualWaterG(),
        log.getActualWaterTempC(),
        log.getActualTotalTimeSeconds(),
        log.getActualDrawdownSeconds(),
        log.getUserGrinderId(),
        log.getActualGrindSettingValue(),
        log.getActualGrindMicronEstimated(),
        log.getBeverageWeightG(),
        log.getTdsPercent(),
        log.getDaysOffRoast(),
        log.getDegassingStatus(),
        analysis.brewRatio(),
        analysis.extractionYieldPercent(),
        analysis.strengthZone() == null ? null : analysis.strengthZone().name(),
        analysis.extractionZone() == null ? null : analysis.extractionZone().name(),
        analysis.diagnosis(),
        log.getRating(),
        log.getAcidity(),
        log.getSweetness(),
        log.getBody(),
        log.getBitterness(),
        log.getAftertaste(),
        log.getOverallNote(),
        log.getCreatedAt(),
        log.getUpdatedAt());
  }
}
```

`BrewLogService.java`:

```java
package com.kaldinote.brewlog.application;

import com.kaldinote.brewlog.domain.BrewLog;
import com.kaldinote.brewlog.infrastructure.BrewLogRepository;
import com.kaldinote.brewlog.presentation.dto.BrewLogCreateRequest;
import com.kaldinote.brewlog.presentation.dto.BrewLogResponse;
import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.extraction.domain.BrewMeasurement;
import com.kaldinote.extraction.domain.ExtractionAnalysis;
import com.kaldinote.extraction.domain.ExtractionAnalyzer;
import com.kaldinote.gear.domain.GrinderModel;
import com.kaldinote.gear.domain.UserGrinder;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.gear.infrastructure.UserGrinderRepository;
import com.kaldinote.grind.domain.GrindConverter;
import com.kaldinote.grind.domain.GrindSpec;
import com.kaldinote.inventory.domain.BeanBatch;
import com.kaldinote.inventory.domain.DegassingStatus;
import com.kaldinote.inventory.infrastructure.BeanBatchRepository;
import com.kaldinote.recipe.domain.Recipe;
import com.kaldinote.recipe.infrastructure.RecipeRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BrewLogService {

  private final BrewLogRepository brewLogRepository;
  private final RecipeRepository recipeRepository;
  private final BeanBatchRepository beanBatchRepository;
  private final UserGrinderRepository userGrinderRepository;
  private final GrinderModelRepository grinderModelRepository;
  private final GrindConverter grindConverter = new GrindConverter();
  private final ExtractionAnalyzer extractionAnalyzer = new ExtractionAnalyzer();

  @Transactional
  public BrewLogResponse create(Long userId, BrewLogCreateRequest request) {
    Recipe recipe = requireOwnedRecipe(userId, request.recipeId());
    BeanBatch beanBatch = requireOwnedBeanBatch(userId, request.beanBatchId());
    UserGrinder userGrinder = requireOwnedUserGrinder(userId, request.userGrinderId());
    GrinderModel grinderModel =
        grinderModelRepository
            .findById(userGrinder.getGrinderModelId())
            .orElseThrow(
                () ->
                    new BusinessException(
                        ErrorCode.NOT_FOUND,
                        "그라인더 모델을 찾을 수 없습니다: " + userGrinder.getGrinderModelId()));

    BigDecimal micron =
        computeActualGrindMicronEstimated(grinderModel, request.actualGrindSettingValue());

    BrewMeasurement measurement =
        new BrewMeasurement(
            request.actualDoseG(), request.actualWaterG(), request.beverageWeightG(), request.tdsPercent());
    ExtractionAnalysis analysis = extractionAnalyzer.analyze(measurement);

    int daysOffRoast = computeDaysOffRoast(request.brewedAt(), beanBatch.getRoastedAt());
    String degassingStatus = DegassingStatus.of(daysOffRoast).name();

    BrewLog log =
        BrewLog.create(
            userId,
            recipe.getId(),
            beanBatch.getId(),
            request.brewedAt(),
            request.actualDoseG(),
            request.actualWaterG(),
            request.actualWaterTempC(),
            request.actualTotalTimeSeconds(),
            request.actualDrawdownSeconds(),
            userGrinder.getId(),
            request.actualGrindSettingValue(),
            micron,
            request.beverageWeightG(),
            request.tdsPercent(),
            daysOffRoast,
            degassingStatus,
            request.rating(),
            request.acidity(),
            request.sweetness(),
            request.body(),
            request.bitterness(),
            request.aftertaste(),
            request.overallNote());

    return BrewLogResponse.from(brewLogRepository.save(log), analysis);
  }

  private Recipe requireOwnedRecipe(Long userId, Long recipeId) {
    Recipe recipe =
        recipeRepository
            .findByIdAndDeletedAtIsNull(recipeId)
            .orElseThrow(
                () -> new BusinessException(ErrorCode.NOT_FOUND, "레시피를 찾을 수 없습니다: " + recipeId));
    if (!recipe.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 레시피만 브루잉 로그에 연결할 수 있습니다.");
    }
    return recipe;
  }

  private BeanBatch requireOwnedBeanBatch(Long userId, Long beanBatchId) {
    BeanBatch batch =
        beanBatchRepository
            .findByIdAndDeletedAtIsNull(beanBatchId)
            .orElseThrow(
                () -> new BusinessException(ErrorCode.NOT_FOUND, "재고를 찾을 수 없습니다: " + beanBatchId));
    if (!batch.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 재고만 브루잉 로그에 연결할 수 있습니다.");
    }
    return batch;
  }

  private UserGrinder requireOwnedUserGrinder(Long userId, Long userGrinderId) {
    UserGrinder grinder =
        userGrinderRepository
            .findById(userGrinderId)
            .orElseThrow(
                () ->
                    new BusinessException(ErrorCode.NOT_FOUND, "그라인더를 찾을 수 없습니다: " + userGrinderId));
    if (!grinder.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 그라인더만 브루잉 로그에 연결할 수 있습니다.");
    }
    return grinder;
  }

  private BigDecimal computeActualGrindMicronEstimated(GrinderModel grinder, BigDecimal settingValue) {
    GrindSpec spec = grinder.toGrindSpec();
    if (!spec.convertible()) {
      return null; // 무단계 그라인더: 환산 불가 → 스냅샷 없이 성공 (AC-BREW-04)
    }
    return grindConverter.toMicron(spec, settingValue); // 범위 밖이면 GrindSettingOutOfRangeException → 400
  }

  private int computeDaysOffRoast(Instant brewedAt, LocalDate roastedAt) {
    LocalDate brewedDate = brewedAt.atZone(ZoneOffset.UTC).toLocalDate();
    return (int) ChronoUnit.DAYS.between(roastedAt, brewedDate);
  }
}
```

`BrewLogController.java`:

```java
package com.kaldinote.brewlog.presentation;

import com.kaldinote.brewlog.application.BrewLogService;
import com.kaldinote.brewlog.presentation.dto.BrewLogCreateRequest;
import com.kaldinote.brewlog.presentation.dto.BrewLogResponse;
import com.kaldinote.common.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/brew-logs")
@RequiredArgsConstructor
@Tag(name = "브루잉 로그", description = "실측 기록과 EY/SCA 분석")
public class BrewLogController {

  private final BrewLogService brewLogService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public BrewLogResponse create(
      @Valid @RequestBody BrewLogCreateRequest request, AuthenticatedUser user) {
    return brewLogService.create(user.id(), request);
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: PASS, 13 tests.

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(brewlog): 브루잉 로그 생성 API와 EY/SCA 통합" && cd backend
```

---

## Task 4: 브루잉 로그 생성 API — 필드 범위·물리 검증 경계값

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/brewlog/presentation/dto/BrewLogCreateRequest.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java`
- Modify: `backend/src/test/java/com/kaldinote/brewlog/presentation/BrewLogControllerTest.java`

**Covers:** AC-BREW-10~28 (19개: rating·acidity·daysOffRoast 경계·물리검증 경계·overallNote), AC-BREW-37, 38

**Interfaces:**
- Consumes: Task 3의 `BrewLogCreateRequest`, `BrewLogService`, `createBrewLog`/`minimalBody`/`beanBatchId` 테스트 헬퍼
- Produces: (없음 — 애노테이션과 서비스 내 `rating` 배수 검증만 추가. 새 타입 없음)

> **AC-BREW-23~26(물리 검증 경계)은 Task 3에서 이미 통합된 `BrewMeasurement`/`ExtractionAnalyzer` 덕분에 새 프로덕션 코드 없이 테스트만 추가하면 바로 통과한다.** RED 단계에서 이 4개는 이미 GREEN이고, 나머지(rating·acidity·overallNote·brewedAt·actualDoseG 관련)만 애노테이션이 없어 FAIL한다 — 레시피 계획 Task 3과 같은 패턴이다.

- [ ] **Step 1: 실패하는 테스트 작성**

`BrewLogControllerTest`에 아래를 추가한다. 대표로 `rating` 그룹과 물리 검증 그룹의 전체 코드를 보이고, 나머지는 표의 리터럴 값을 그대로 대입해 같은 패턴으로 작성한다.

```java
  @Test
  @DisplayName("AC-BREW-10 · rating 0.5는 허용된다")
  void rating_0_5는_허용된다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    String body =
        """
        {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
         "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
         "userGrinderId":%d,"actualGrindSettingValue":22.0,"rating":0.5}
        """
            .formatted(recipeId, beanBatchId, brewedAt, userGrinderId);

    createBrewLog(token, body).andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-BREW-12 · rating 0.4는 거부된다")
  void rating_0_4는_거부된다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    String body =
        """
        {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
         "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
         "userGrinderId":%d,"actualGrindSettingValue":22.0,"rating":0.4}
        """
            .formatted(recipeId, beanBatchId, brewedAt, userGrinderId);

    createBrewLog(token, body)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BREW-14 · rating이 0.5의 배수가 아니면 거부된다")
  void rating이_0_5_배수가_아니면_거부된다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    String body =
        """
        {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
         "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
         "userGrinderId":%d,"actualGrindSettingValue":22.0,"rating":3.3}
        """
            .formatted(recipeId, beanBatchId, brewedAt, userGrinderId);

    createBrewLog(token, body)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BREW-24 · 음료 중량이 실측 물량보다 많으면 거부된다")
  void 음료중량이_물량보다_많으면_거부된다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    String body =
        """
        {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
         "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
         "userGrinderId":%d,"actualGrindSettingValue":22.0,
         "beverageWeightG":250.1,"tdsPercent":1.25}
        """
            .formatted(recipeId, beanBatchId, brewedAt, userGrinderId);

    createBrewLog(token, body)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_BREW_MEASUREMENT"));
  }

  @Test
  @DisplayName("AC-BREW-26 · 수율이 30.0을 넘으면 거부된다")
  void 수율이_30을_넘으면_거부된다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    String body =
        """
        {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
         "actualDoseG":15.0,"actualWaterG":300.0,"actualWaterTempC":92.0,
         "userGrinderId":%d,"actualGrindSettingValue":22.0,
         "beverageWeightG":251.0,"tdsPercent":1.8}
        """
            .formatted(recipeId, beanBatchId, brewedAt, userGrinderId);

    createBrewLog(token, body)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_BREW_MEASUREMENT"));
  }

  @Test
  @DisplayName("AC-BREW-37 · brewedAt이 미래 시각이면 거부된다")
  void brewedAt이_미래면_거부된다() throws Exception {
    String token = token("테스터");
    Instant future = Instant.now().plusSeconds(86400);
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, Instant.now(), 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    createBrewLog(token, minimalBody(recipeId, beanBatchId, future, userGrinderId))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-BREW-38 · actualDoseG가 0 이하면 거부된다")
  void actualDoseG가_0이면_거부된다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    String body =
        """
        {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
         "actualDoseG":0,"actualWaterG":250.0,"actualWaterTempC":92.0,
         "userGrinderId":%d,"actualGrindSettingValue":22.0}
        """
            .formatted(recipeId, beanBatchId, brewedAt, userGrinderId);

    createBrewLog(token, body)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }
```

나머지는 같은 패턴으로, 아래 표의 리터럴 값을 대입해 작성한다(기본 바디는 `minimalBody(...)`에 해당 필드 하나만 추가/변경):

| AC ID | 필드 | 값 | 기대 |
|---|---|---|---|
| AC-BREW-11 | rating | `5.0` | 201 |
| AC-BREW-13 | rating | `5.1` | 400 INVALID_REQUEST |
| AC-BREW-15 | acidity | `1` | 201 |
| AC-BREW-16 | acidity | `5` | 201 |
| AC-BREW-17 | acidity | `0` | 400 INVALID_REQUEST |
| AC-BREW-18 | acidity | `6` | 400 INVALID_REQUEST |
| AC-BREW-19 | 재고 `roastedAt` | `brewedAt`으로부터 2일 전 | `daysOffRoast=2`, `degassingStatus="TOO_FRESH"` |
| AC-BREW-20 | 재고 `roastedAt` | 3일 전 | `daysOffRoast=3`, `degassingStatus="IDEAL"` |
| AC-BREW-21 | 재고 `roastedAt` | 14일 전 | `daysOffRoast=14`, `degassingStatus="IDEAL"` |
| AC-BREW-22 | 재고 `roastedAt` | 15일 전 | `daysOffRoast=15`, `degassingStatus="PAST_PEAK"` |
| AC-BREW-23 | beverageWeightG/tdsPercent | `250.0`/`1.25` (actualWaterG=250.0과 동일) | 201, `extractionYieldPercent=20.8` |
| AC-BREW-25 | actualWaterG/beverageWeightG/tdsPercent | `300.0`/`250.0`/`1.8` | 201, `extractionYieldPercent=30.0` |
| AC-BREW-27 | overallNote | 1000자 | 201 |
| AC-BREW-28 | overallNote | 1001자 | 400 INVALID_REQUEST |

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: 새로 추가한 21개 중 AC-BREW-23·25(물리 검증 정상 케이스)는 이미 PASS. rating(10~14)·acidity(15~18)·overallNote(27~28)·brewedAt(37)·actualDoseG(38) 관련은 애노테이션이 없어 FAIL — 201이어야 할 요청이 통과하되 400이어야 할 요청도 그냥 통과해버린다.

- [ ] **Step 3: DTO에 경계값 애노테이션 추가, 서비스에 rating 배수 검증 추가**

`BrewLogCreateRequest.java`를 아래처럼 바꾼다(필드 순서 유지, 애노테이션만 추가):

```java
package com.kaldinote.brewlog.presentation.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;

public record BrewLogCreateRequest(
    @NotNull Long recipeId,
    @NotNull Long beanBatchId,
    @NotNull @PastOrPresent Instant brewedAt,
    @NotNull @DecimalMin(value = "0.0", inclusive = false) BigDecimal actualDoseG,
    @NotNull @DecimalMin(value = "0.0", inclusive = false) BigDecimal actualWaterG,
    @NotNull BigDecimal actualWaterTempC,
    Integer actualTotalTimeSeconds,
    Integer actualDrawdownSeconds,
    @NotNull Long userGrinderId,
    @NotNull BigDecimal actualGrindSettingValue,
    BigDecimal beverageWeightG,
    BigDecimal tdsPercent,
    @DecimalMin("0.5") @DecimalMax("5.0") BigDecimal rating,
    @Min(1) @Max(5) Short acidity,
    @Min(1) @Max(5) Short sweetness,
    @Min(1) @Max(5) Short body,
    @Min(1) @Max(5) Short bitterness,
    @Min(1) @Max(5) Short aftertaste,
    @Size(max = 1000) String overallNote) {}
```

`BrewLogService.java`의 `create()` 맨 앞에 `rating` 배수 검증을 추가하고, 아래 private 메서드를 클래스에 추가한다:

```java
  @Transactional
  public BrewLogResponse create(Long userId, BrewLogCreateRequest request) {
    validateRatingStep(request.rating());

    Recipe recipe = requireOwnedRecipe(userId, request.recipeId());
    // ... 이하 Task 3과 동일
```

```java
  private static final BigDecimal RATING_STEP = new BigDecimal("0.5");

  private void validateRatingStep(BigDecimal rating) {
    if (rating == null) {
      return;
    }
    if (rating.remainder(RATING_STEP).compareTo(BigDecimal.ZERO) != 0) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "rating은 0.5 단위여야 합니다: " + rating);
    }
  }
```

> `rating` 배수 검증을 FK 소유 검증보다 먼저 두는 이유: 순서상 `400`이 `404`/`403`보다 뒤라고 스펙에 적혀 있지만, 이건 Bean Validation을 통과한 뒤 **서비스 내부에서 도는 400끼리의** 순서를 규정하지 않는다. `rating` 배수 검증은 어차피 매 요청에 결정적이므로 어디에 두어도 같은 요청에 대해 같은 결과가 나온다 — 다만 코드 가독성상 서비스 진입점에 모아둔다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: PASS, 13 + 21 = 34 tests.

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(brewlog): 생성 API 경계값·물리 검증 추가" && cd backend
```

---

## Task 5: 브루잉 로그 단건 조회 API

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/presentation/BrewLogController.java`
- Modify: `backend/src/test/java/com/kaldinote/brewlog/presentation/BrewLogControllerTest.java`
- Modify: `docs/specs/2026-08-17-brew-log.md` (`status: 초안 → 구현완료`)

**Covers:** AC-BREW-06, 07, 08, 39, 40

**Interfaces:**
- Consumes: Task 3/4의 `BrewLogService`, `BrewLogResponse`, 테스트 헬퍼 전부
- Produces:
  - `BrewLogService#get(Long userId, Long brewLogId) → BrewLogResponse`
  - `GET /api/v1/brew-logs/{id}` (200)

- [ ] **Step 1: 실패하는 테스트 작성**

```java
  @Test
  @DisplayName("AC-BREW-06 · 단건 조회는 저장된 값과 재계산된 EY/SCA를 함께 반환한다")
  void 단건_조회는_저장값과_EY를_함께_반환한다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    String body =
        """
        {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
         "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":92.0,
         "userGrinderId":%d,"actualGrindSettingValue":22.0,
         "beverageWeightG":240.0,"tdsPercent":1.25}
        """
            .formatted(recipeId, beanBatchId, brewedAt, userGrinderId);
    String created = createBrewLog(token, body).andReturn().getResponse().getContentAsString();
    Long id = Long.valueOf(JsonPath.read(created, "$.id").toString());

    mockMvc
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(
                    "/api/v1/brew-logs/" + id)
                .header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.extractionYieldPercent").value(20.0))
        .andExpect(jsonPath("$.strengthZone").value("IDEAL"));
  }

  @Test
  @DisplayName("AC-BREW-07 · 레시피의 doseG를 나중에 수정해도 기존 브루잉 로그의 actualDoseG는 변하지 않는다")
  void 레시피_수정해도_스냅샷은_불변이다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    String created =
        createBrewLog(token, minimalBody(recipeId, beanBatchId, brewedAt, userGrinderId))
            .andReturn()
            .getResponse()
            .getContentAsString();
    Long id = Long.valueOf(JsonPath.read(created, "$.id").toString());

    mockMvc.perform(
        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(
                "/api/v1/recipes/" + recipeId)
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"title":"수정됨","doseG":20.0,"waterG":250.0}
                """));

    mockMvc
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(
                    "/api/v1/brew-logs/" + id)
                .header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.actualDoseG").value(15.0));
  }

  @Test
  @DisplayName("AC-BREW-08 · BeanBatch를 삭제해도 daysOffRoast·degassingStatus는 남는다")
  void 재고_삭제해도_daysOffRoast는_남는다() throws Exception {
    String token = token("테스터");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(token);
    Long beanBatchId = beanBatchId(token, brewedAt, 6);
    Long userGrinderId = userGrinderId(token, c40Id());

    String created =
        createBrewLog(token, minimalBody(recipeId, beanBatchId, brewedAt, userGrinderId))
            .andReturn()
            .getResponse()
            .getContentAsString();
    Long id = Long.valueOf(JsonPath.read(created, "$.id").toString());

    mockMvc.perform(
        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                "/api/v1/bean-batches/" + beanBatchId)
            .header(HttpHeaders.AUTHORIZATION, token));

    mockMvc
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(
                    "/api/v1/brew-logs/" + id)
                .header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.daysOffRoast").value(6))
        .andExpect(jsonPath("$.degassingStatus").value("IDEAL"));
  }

  @Test
  @DisplayName("AC-BREW-39 · 존재하지 않는 브루잉 로그 조회는 404다")
  void 존재하지_않는_브루잉_로그_조회는_404다() throws Exception {
    mockMvc
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(
                    "/api/v1/brew-logs/999999")
                .header(HttpHeaders.AUTHORIZATION, token("테스터")))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-BREW-40 · 남의 브루잉 로그는 조회할 수 없다")
  void 남의_브루잉_로그는_조회할_수_없다() throws Exception {
    String owner = token("소유자");
    Instant brewedAt = Instant.parse("2026-08-17T08:30:00Z");
    Long recipeId = recipeId(owner);
    Long beanBatchId = beanBatchId(owner, brewedAt, 6);
    Long userGrinderId = userGrinderId(owner, c40Id());

    String created =
        createBrewLog(owner, minimalBody(recipeId, beanBatchId, brewedAt, userGrinderId))
            .andReturn()
            .getResponse()
            .getContentAsString();
    Long id = Long.valueOf(JsonPath.read(created, "$.id").toString());

    String other = token("다른사람");
    mockMvc
        .perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(
                    "/api/v1/brew-logs/" + id)
                .header(HttpHeaders.AUTHORIZATION, other))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: 5개 신규 테스트가 404(엔드포인트 없음)로 FAIL.

- [ ] **Step 3: 서비스·컨트롤러에 조회 추가**

`BrewLogService.java`에 추가:

```java
  public BrewLogResponse get(Long userId, Long brewLogId) {
    BrewLog log = findOwned(userId, brewLogId);
    BrewMeasurement measurement =
        new BrewMeasurement(
            log.getActualDoseG(), log.getActualWaterG(), log.getBeverageWeightG(), log.getTdsPercent());
    ExtractionAnalysis analysis = extractionAnalyzer.analyze(measurement);
    return BrewLogResponse.from(log, analysis);
  }

  private BrewLog findOwned(Long userId, Long brewLogId) {
    BrewLog log =
        brewLogRepository
            .findById(brewLogId)
            .orElseThrow(
                () -> new BusinessException(ErrorCode.NOT_FOUND, "브루잉 로그를 찾을 수 없습니다: " + brewLogId));
    if (!log.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 브루잉 로그만 조회할 수 있습니다.");
    }
    return log;
  }
```

`BrewLogController.java`에 추가:

```java
  @GetMapping("/{id}")
  public BrewLogResponse get(@PathVariable Long id, AuthenticatedUser user) {
    return brewLogService.get(user.id(), id);
  }
```

(`GetMapping`·`PathVariable` import 추가.)

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: PASS, 13 + 21 + 5 = 39 tests.

- [ ] **Step 5: 스펙 status 전환 + 전체 검증**

`docs/specs/2026-08-17-brew-log.md`의 frontmatter `status`를 `초안 → 구현완료`로 바꾼다.

```bash
cd .. && ./scripts/check-spec-coverage.sh
```

Expected: `brew-log.md`가 `[구현완료] — AC 39개 전부 테스트에 존재`로 통과.

- [ ] **Step 6: 커밋**

```bash
cd backend && ./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(brewlog): 단건 조회 API 추가, 스펙 구현완료 전환" && cd backend
```

---

## 완료 기준

- [ ] `cd backend && ./gradlew clean check` 통과
- [ ] `./scripts/check-spec-coverage.sh` 통과 — `docs/specs/2026-08-17-brew-log.md`가 `[구현완료] — AC 39개 전부`
- [ ] `bootRun` + curl로 실제 레시피·재고·사용자 그라인더·브루잉 로그를 만들어 `actualGrindMicronEstimated`·`daysOffRoast`·`degassingStatus`·EY/SCA 값이 스펙의 응답 예시와 일치하는지 확인 (스펙의 수동 확인 항목)

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 39개 중 39개가 태스크에 매핑됨 (Task3 13 + Task4 21 + Task5 5 = 39).

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음. Task 4의 표는 리터럴 값만 담고 있고, "AC-RECIPE 참고"처럼 다른 계획을 가리키는 참조가 아니라 이 계획 안에서 자기완결적이다.

**타입 일관성:** `BrewLog.create(...)`의 파라미터 순서·타입이 Task 2(엔티티 정의)·Task 3(서비스 사용)에서 동일하다. `BrewLogResponse.from(BrewLog, ExtractionAnalysis)` 시그니처가 Task 3(정의)과 Task 5(GET에서 재사용)에서 동일하다. `UserGrinder#isOwnedBy`(Task 1에서 추가)를 Task 3의 `requireOwnedUserGrinder`가 그대로 쓴다.

**검증되지 않은 가정:**
- Task 2의 `BrewLogRepositoryTest`가 FK 제약 때문에 최소 픽스처(사용자·레시피·재고·사용자그라인더)를 먼저 저장해야 할 수도 있다 — Step 2/5에서 실제로 실행해봐야 확정된다.
- `daysOffRoast` 계산에 `ZoneOffset.UTC`를 쓰는 결정은 스펙 인터뷰에서 다루지 않은 구현 세부사항이다. 테스트의 `roastedAt` 생성도 같은 기준(UTC)을 써서 맞춘다.
- `actualGrindSettingValue`가 그라인더의 `min_setting`~`max_setting` 범위를 벗어나면 `GrindConverter.toMicron()`이 `GrindSettingOutOfRangeException`(400 `GRIND_SETTING_OUT_OF_RANGE`)을 던진다 — 스펙에 없는 동작이지만 기존 `grind` 스펙이 이미 정의한 것이라 새 AC 없이 그대로 상속된다.
- Task 1의 `GearControllerTest`에 실제 사용자를 저장하는 새 헬퍼(`realUserToken`)를 추가하는데, 기존 `token()`(고정 ID `1L`)과 공존시켜도 되는지는 Step 4에서 실행해봐야 확정된다. 문제가 되면 기존 `token()`을 쓰는 테스트에는 영향이 없어야 한다(그 테스트들은 `user_grinders`를 건드리지 않는다).

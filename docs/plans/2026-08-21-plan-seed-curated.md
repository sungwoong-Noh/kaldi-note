# 시드 CURATED 레시피 + Swagger 파라미터 정리 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-08-21-seed-curated-recipes.md`

**Goal:** 신규 사용자가 가입 직후 목록을 열면 Hoffmann V60와 Kasuya 4:6가 보이고 그중 하나를 포크해 서비스를 시작할 수 있다. Swagger UI에서 채울 수 없는 `user` 입력란이 사라진다.

**Architecture:** 시드를 **`db/seed`라는 별도 Flyway location**에 두고 `test` 프로파일에서만 제외한다. 시드를 모든 프로파일에 적용하면 기존 목록 조회 테스트 6개의 기대값이 어긋나고 `AC-LIST-32`는 도달 불가능해지기 때문이다. 대신 시드 SQL이 CI에서 한 번도 실행되지 않는 사각지대가 생기므로, 검증 테스트가 `@Sql`로 **바로 그 파일을** 적용해 실행한다 — 파일은 하나이고 테스트가 그것을 그대로 돌리므로 운영에 나가는 SQL과 검증되는 SQL이 같다.

**작업 위치:** `backend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-SEED-01 | Hoffmann 추출 파라미터 4개 | Task 2 | 통합 테스트 |
| AC-SEED-02 | Hoffmann 스텝 7개 시퀀스 | Task 2 | 통합 테스트 |
| AC-SEED-03 | Kasuya 추출 파라미터 4개 | Task 2 | 통합 테스트 |
| AC-SEED-04 | Kasuya 스텝 6개 시퀀스 | Task 2 | 통합 테스트 |
| AC-SEED-05 | 주인 없는 공개 큐레이션 | Task 2 | 통합 테스트 |
| AC-SEED-06 | 브루어·필터 FK | Task 2 | 통합 테스트 |
| AC-SEED-07 | 분쇄도 4개 컬럼 NULL | Task 2 | 통합 테스트 |
| AC-SEED-08 | 붓는 스텝 합계 = water_g | Task 2 | 통합 테스트 |
| AC-SEED-09 | 출처 표기 존재 | Task 2 | 통합 테스트 |
| AC-SEED-10 | 신규 사용자 목록에 2건 | Task 3 | API 테스트 |
| AC-SEED-11 | 단건 조회 ratio 16.7 / 15.0 | Task 3 | API 테스트 |
| AC-SEED-12 | 시드 포크 성공 | Task 3 | API 테스트 |
| AC-SEED-13 | test 프로파일에는 시드 없음 | Task 3 | API 테스트 |
| AC-SWAGGER-01 | user 쿼리 파라미터 0개 | Task 4 | API 테스트 |
| AC-SWAGGER-02 | 엔드포인트가 사라지지 않음 | Task 4 | API 테스트 |
| AC-SWAGGER-03 | bearerAuth 유지 | Task 4 | API 테스트 |

스펙의 AC 16개 중 16개가 매핑됐다. (Task 1은 location 분리 인프라로 AC를 직접 담당하지 않고 Task 2~3의 전제를 만든다.)

---

## Global Constraints

- **`V11`은 스키마를 바꾸지 않는다.** `CREATE`·`ALTER`·`DROP`을 쓰지 않는다. 콘텐츠 `INSERT`만 한다.
- **하드코딩된 FK id를 쓰지 않는다.** `brewer_id`·`filter_id`는 `V5__seed_gear.sql`이 넣은 행의 `BIGSERIAL` 값이라 환경마다 다를 수 있다. `SELECT id FROM brewers WHERE brand=... AND name=...` 서브쿼리로 찾는다.
- **`recipe_steps.recipe_id`도 마찬가지다.** `INSERT ... SELECT`로 방금 넣은 레시피를 `title`로 되찾아 참조한다.
- **기존 테스트를 수정하지 않는다.** 이 계획이 끝난 뒤 `AC-LIST-03`·`05`·`09`·`13`·`14`·`32`의 기대값은 그대로여야 한다. 하나라도 바꿔야 한다면 location 분리가 실패한 것이다.
- 커밋 전 `./gradlew spotlessApply`.

---

## File Structure

```
backend/src/main/resources/
├── application.yml                          Modify — flyway.locations에 db/seed 추가
├── application-test.yml                     Modify — flyway.locations를 db/migration만으로 덮어씀
└── db/
    ├── migration/                           (변경 없음) V1~V10
    └── seed/
        └── V11__seed_curated_recipes.sql    Create

backend/src/main/java/com/kaldinote/common/config/
└── OpenApiConfig.java                       Modify — AuthenticatedUser를 요청 래퍼 무시 목록에 등록

backend/src/test/java/com/kaldinote/recipe/
└── SeedCuratedRecipesTest.java              Create — AC-SEED-01~12
backend/src/test/java/com/kaldinote/recipe/
└── SeedIsolationTest.java                   Create — AC-SEED-13
backend/src/test/java/com/kaldinote/common/config/
└── OpenApiDocsTest.java                     Create — AC-SWAGGER-01~03
```

---

## Task 1: Flyway location 분리

**Files:**
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/test/resources/application-test.yml`
- Create: `backend/src/main/resources/db/seed/V11__seed_curated_recipes.sql`

**Covers:** (인프라 태스크 — AC는 Task 2~4가 담당한다)

**Interfaces:**
- Produces: `classpath:db/seed/V11__seed_curated_recipes.sql` — Task 2·3의 `@Sql`이 이 경로를 가리킨다

- [x] **Step 1: 실패하는 테스트 작성**

이 태스크는 설정 변경이라 단독 테스트를 쓰지 않는다. 대신 **기존 테스트가 계속 초록인 것**이 이 태스크의 검증이다. Step 3에서 시드 파일을 만든 뒤 Step 4에서 전체 `check`를 돌려 `AC-LIST-32` 등이 여전히 통과하는지 확인한다.

먼저 지금 상태를 기록해 둔다 (Step 4에서 대조):

```bash
./gradlew test --tests '*RecipeControllerTest' | tail -3
```

- [x] **Step 2: locations 설정 변경**

`application.yml`:

```yaml
  flyway:
    enabled: true
    # db/seed는 스키마가 아니라 콘텐츠(시드 CURATED 레시피)다.
    # test 프로파일은 이 location을 빼서 목록 조회 테스트의 기대값을 보존한다
    # (docs/specs/2026-08-21-seed-curated-recipes.md「마이그레이션 위치 분리」).
    locations: classpath:db/migration, classpath:db/seed
```

`backend/src/test/resources/application-test.yml` 맨 위 `spring:` 블록에 추가:

```yaml
spring:
  flyway:
    locations: classpath:db/migration
  jpa:
    properties:
      hibernate:
        format_sql: false
```

> `application-test.yml`은 `spring.jpa.properties.hibernate.format_sql`을 이미 갖고 있다. `flyway`를 같은 `spring:` 블록 아래 형제로 넣는다. YAML은 같은 키를 두 번 쓰면 뒤엣것이 앞엣것을 통째로 덮으므로 `spring:`을 새로 열지 않는다.

- [x] **Step 3: 시드 SQL 작성**

`backend/src/main/resources/db/seed/V11__seed_curated_recipes.sql`:

```sql
-- 시드 CURATED 레시피. 스키마가 아니라 콘텐츠다.
--   * test 프로파일은 이 location을 읽지 않는다 (application-test.yml).
--     기존 목록 조회 테스트가 "레시피가 하나도 없다"를 전제하기 때문이다.
--   * 검증은 SeedCuratedRecipesTest가 이 파일을 @Sql로 직접 적용해 수행한다.
--   * FK id를 하드코딩하지 않는다. BIGSERIAL 값은 환경마다 다를 수 있다.
--   * 분쇄도 4개 컬럼은 NULL이다. 원문이 "medium fine"·"coarse"로만 적어
--     특정 그라인더 클릭 수로 옮기면 추측이 된다 (V5__seed_gear.sql의 원칙).

INSERT INTO recipes
    (owner_user_id, source_type, author_name, source_url, source_note,
     title, description, brew_method, visibility,
     dose_g, water_g, water_temp_c, total_time_seconds,
     brewer_id, filter_id)
VALUES
    (NULL, 'CURATED', 'James Hoffmann',
     'https://honestcoffeeguide.com/brew-recipes/james-hoffmann-v60/',
     '유튜브 "The Ultimate V60 Technique"을 정리한 레시피 페이지',
     'James Hoffmann Ultimate V60',
     '유튜브 "The Ultimate V60 Technique"의 레시피. 1:16.7 비율, 끓는 물로 내린다. 블룸 후 두 번에 나눠 붓고 스터와 스월로 마무리해 균일한 추출을 노린다.',
     'POUR_OVER', 'PUBLIC',
     30.0, 500.0, 100.0, 210,
     (SELECT id FROM brewers      WHERE brand = 'Hario' AND name = 'V60 02'),
     (SELECT id FROM brew_filters WHERE name = 'V60 표백 필터 02')),
    (NULL, 'CURATED', 'Tetsu Kasuya',
     'https://honestcoffeeguide.com/brew-recipes/tetsu-kasuya-4-6-method/',
     '2016 World Brewers Cup 우승 방법론',
     'Tetsu Kasuya 4:6 Method',
     '2016 World Brewers Cup 우승 방법론. 45초 간격으로 다섯 번 나눠 붓는다. 앞 40%가 단맛과 산미의 균형을, 뒤 60%가 농도를 결정한다.',
     'POUR_OVER', 'PUBLIC',
     20.0, 300.0, 92.0, 210,
     (SELECT id FROM brewers      WHERE brand = 'Hario' AND name = 'V60 02'),
     (SELECT id FROM brew_filters WHERE name = 'V60 표백 필터 02'));

-- Hoffmann: 붓는 스텝 합계 60 + 240 + 200 = 500.0 = water_g
INSERT INTO recipe_steps
    (recipe_id, step_order, step_type, start_at_seconds, duration_seconds,
     water_g, pour_technique, agitation, note)
SELECT r.id, v.step_order, v.step_type, v.start_at_seconds, v.duration_seconds,
       v.water_g, v.pour_technique, v.agitation, v.note
FROM recipes r
CROSS JOIN (VALUES
    (1, 'BLOOM',    0,  15, 60.0,  'SPIRAL', 'SWIRL', '중심에서 바깥으로 나선을 그려 가루를 다 적신 뒤, 스월로 덩어리를 푼다'),
    (2, 'WAIT',    15,  30, NULL,  NULL,     'NONE',  '45초까지 뜸을 들인다'),
    (3, 'POUR',    45,  30, 240.0, 'SPIRAL', 'NONE',  '1분 15초에 누적 300g. 전체 물의 60%를 여기서 넣는다'),
    (4, 'POUR',    75,  30, 200.0, 'SPIRAL', 'NONE',  '1분 45초에 누적 500g. 천천히 이어 붓는다'),
    (5, 'STIR',   105,   5, NULL,  NULL,     'STIR',  '시계 방향과 반시계 방향으로 한 번씩 저어 벽면 가루를 내린다'),
    (6, 'SWIRL',  110,   5, NULL,  NULL,     'SWIRL', '가볍게 돌려 커피 베드를 평탄하게 만든다'),
    (7, 'DRAWDOWN', 115, 95, NULL, NULL,     'NONE',  '3분 30초에 배출이 끝난다')
) AS v(step_order, step_type, start_at_seconds, duration_seconds,
       water_g, pour_technique, agitation, note)
WHERE r.title = 'James Hoffmann Ultimate V60';

-- Kasuya: 붓는 스텝 합계 50 + 70 + 60 + 60 + 60 = 300.0 = water_g. 푸어 간격 45초 고정
INSERT INTO recipe_steps
    (recipe_id, step_order, step_type, start_at_seconds, duration_seconds,
     water_g, pour_technique, agitation, note)
SELECT r.id, v.step_order, v.step_type, v.start_at_seconds, v.duration_seconds,
       v.water_g, v.pour_technique, v.agitation, v.note
FROM recipes r
CROSS JOIN (VALUES
    (1, 'BLOOM',      0, 10, 50.0, 'SPIRAL', 'NONE', '1푸어. 이 물량이 단맛과 산미의 균형을 결정한다'),
    (2, 'POUR',      45, 10, 70.0, 'SPIRAL', 'NONE', '2푸어. 여기까지 120g으로 전체의 40%를 채운다'),
    (3, 'POUR',      90, 10, 60.0, 'SPIRAL', 'NONE', '3푸어. 여기부터 60%는 농도를 결정한다'),
    (4, 'POUR',     135, 10, 60.0, 'SPIRAL', 'NONE', '4푸어. 누적 240g'),
    (5, 'POUR',     180, 10, 60.0, 'SPIRAL', 'NONE', '5푸어. 누적 300g'),
    (6, 'DRAWDOWN', 190, 20, NULL, NULL,     'NONE', '3분 30초에 배출이 끝난다')
) AS v(step_order, step_type, start_at_seconds, duration_seconds,
       water_g, pour_technique, agitation, note)
WHERE r.title = 'Tetsu Kasuya 4:6 Method';
```

> **`VALUES` 목록의 타입 추론에 주의한다.** PostgreSQL은 `VALUES` 안 컬럼의 타입을 첫 행에서 추론한다. `water_g`의 첫 행이 `60.0`(numeric)이라 이후 `NULL`은 numeric으로 떨어지지만, `pour_technique`은 첫 행이 `'SPIRAL'`(text)이고 Kasuya 6번 행의 `NULL`은 text가 된다 — 둘 다 대상 컬럼과 호환된다. Step 4에서 실패하면 `NULL::numeric`·`NULL::varchar`로 명시한다.

- [x] **Step 4: 기존 테스트가 여전히 초록인지 확인**

Run:
```bash
./gradlew clean check
```
Expected: PASS — 기존 테스트 수가 Step 1에서 기록한 것과 같고, `AC-LIST-32`를 포함해 목록 조회 테스트가 전부 통과한다. 시드는 `test` 프로파일에서 적용되지 않으므로 아무것도 달라지지 않아야 한다.

**여기서 목록 조회 테스트가 깨지면 location 분리가 동작하지 않은 것이다.** `application-test.yml`의 `spring.flyway.locations`가 실제로 먹었는지 확인한다(로그의 `Migrating schema "public" to version "11"`이 test 실행에 나오면 안 된다).

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(seed): 시드 CURATED 레시피 마이그레이션 + Flyway location 분리" && cd backend
```

---

## Task 2: 시드 행·스텝 검증

**Files:**
- Test: `backend/src/test/java/com/kaldinote/recipe/SeedCuratedRecipesTest.java`

**Covers:** AC-SEED-01, AC-SEED-02, AC-SEED-03, AC-SEED-04, AC-SEED-05, AC-SEED-06, AC-SEED-07, AC-SEED-08, AC-SEED-09

**Interfaces:**
- Consumes: `classpath:db/seed/V11__seed_curated_recipes.sql` (Task 1), `RecipeRepository`, `AbstractIntegrationTest`
- Produces: `SeedCuratedRecipesTest` — Task 3이 같은 클래스에 API 레벨 테스트를 덧붙인다

- [x] **Step 1: 실패하는 테스트 작성**

```java
package com.kaldinote.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.recipe.domain.Recipe;
import com.kaldinote.recipe.domain.RecipeSourceType;
import com.kaldinote.recipe.domain.RecipeStep;
import com.kaldinote.recipe.domain.RecipeVisibility;
import com.kaldinote.recipe.domain.StepType;
import com.kaldinote.recipe.infrastructure.RecipeRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.transaction.annotation.Transactional;

/**
 * 시드 CURATED 레시피 검증.
 *
 * <p>test 프로파일의 Flyway는 db/seed를 읽지 않으므로(application-test.yml) 여기서 @Sql로 직접 적용한다. 운영에 나가는
 * 파일과 여기서 실행하는 파일이 같은 파일이다 — CI가 이 SQL의 오타를 잡는 유일한 지점이다.
 */
@Sql("/db/seed/V11__seed_curated_recipes.sql")
@Transactional
class SeedCuratedRecipesTest extends AbstractIntegrationTest {

  private static final String HOFFMANN = "James Hoffmann Ultimate V60";
  private static final String KASUYA = "Tetsu Kasuya 4:6 Method";

  @Autowired private RecipeRepository recipeRepository;
  @Autowired private JdbcTemplate jdbcTemplate;

  private Recipe seed(String title) {
    List<Recipe> found =
        recipeRepository.findAll().stream().filter(r -> title.equals(r.getTitle())).toList();
    assertThat(found).hasSize(1);
    return found.get(0);
  }

  @Test
  @DisplayName("AC-SEED-01 · Hoffmann 레시피의 추출 파라미터가 정확하다")
  void Hoffmann_추출_파라미터가_정확하다() {
    Recipe r = seed(HOFFMANN);

    assertThat(r.getDoseG()).isEqualByComparingTo("30.0");
    assertThat(r.getWaterG()).isEqualByComparingTo("500.0");
    assertThat(r.getWaterTempC()).isEqualByComparingTo("100.0");
    assertThat(r.getTotalTimeSeconds()).isEqualTo(210);
  }

  @Test
  @DisplayName("AC-SEED-02 · Hoffmann 스텝 7개가 표와 일치한다")
  void Hoffmann_스텝_7개가_표와_일치한다() {
    List<RecipeStep> steps = seed(HOFFMANN).getSteps();

    assertThat(steps).hasSize(7);
    assertStep(steps.get(0), 1, StepType.BLOOM, 0, 15, "60.0");
    assertStep(steps.get(1), 2, StepType.WAIT, 15, 30, null);
    assertStep(steps.get(2), 3, StepType.POUR, 45, 30, "240.0");
    assertStep(steps.get(3), 4, StepType.POUR, 75, 30, "200.0");
    assertStep(steps.get(4), 5, StepType.STIR, 105, 5, null);
    assertStep(steps.get(5), 6, StepType.SWIRL, 110, 5, null);
    assertStep(steps.get(6), 7, StepType.DRAWDOWN, 115, 95, null);
  }

  @Test
  @DisplayName("AC-SEED-03 · Kasuya 레시피의 추출 파라미터가 정확하다")
  void Kasuya_추출_파라미터가_정확하다() {
    Recipe r = seed(KASUYA);

    assertThat(r.getDoseG()).isEqualByComparingTo("20.0");
    assertThat(r.getWaterG()).isEqualByComparingTo("300.0");
    assertThat(r.getWaterTempC()).isEqualByComparingTo("92.0");
    assertThat(r.getTotalTimeSeconds()).isEqualTo(210);
  }

  @Test
  @DisplayName("AC-SEED-04 · Kasuya 스텝 6개가 표와 일치한다")
  void Kasuya_스텝_6개가_표와_일치한다() {
    List<RecipeStep> steps = seed(KASUYA).getSteps();

    assertThat(steps).hasSize(6);
    assertStep(steps.get(0), 1, StepType.BLOOM, 0, 10, "50.0");
    assertStep(steps.get(1), 2, StepType.POUR, 45, 10, "70.0");
    assertStep(steps.get(2), 3, StepType.POUR, 90, 10, "60.0");
    assertStep(steps.get(3), 4, StepType.POUR, 135, 10, "60.0");
    assertStep(steps.get(4), 5, StepType.POUR, 180, 10, "60.0");
    assertStep(steps.get(5), 6, StepType.DRAWDOWN, 190, 20, null);
  }

  @Test
  @DisplayName("AC-SEED-05 · 두 시드 모두 주인 없는 공개 큐레이션이다")
  void 두_시드_모두_주인_없는_공개_큐레이션이다() {
    for (String title : List.of(HOFFMANN, KASUYA)) {
      Recipe r = seed(title);
      assertThat(r.getOwnerUserId()).isNull();
      assertThat(r.getSourceType()).isEqualTo(RecipeSourceType.CURATED);
      assertThat(r.getVisibility()).isEqualTo(RecipeVisibility.PUBLIC);
      assertThat(r.getBrewMethod().name()).isEqualTo("POUR_OVER");
      assertThat(r.getDeletedAt()).isNull();
    }
  }

  @Test
  @DisplayName("AC-SEED-06 · 두 시드의 장비 FK가 Hario V60 02와 V60 표백 필터 02를 가리킨다")
  void 두_시드의_장비_FK가_올바른_행을_가리킨다() {
    for (String title : List.of(HOFFMANN, KASUYA)) {
      Recipe r = seed(title);

      assertThat(r.getBrewerId()).isNotNull();
      assertThat(r.getFilterId()).isNotNull();
      assertThat(
              jdbcTemplate.queryForObject(
                  "SELECT brand || ' ' || name FROM brewers WHERE id = ?",
                  String.class,
                  r.getBrewerId()))
          .isEqualTo("Hario V60 02");
      assertThat(
              jdbcTemplate.queryForObject(
                  "SELECT name FROM brew_filters WHERE id = ?", String.class, r.getFilterId()))
          .isEqualTo("V60 표백 필터 02");
    }
  }

  @Test
  @DisplayName("AC-SEED-07 · 두 시드의 분쇄도 관련 4개 컬럼이 모두 NULL이다")
  void 두_시드의_분쇄도_컬럼이_전부_NULL이다() {
    for (String title : List.of(HOFFMANN, KASUYA)) {
      Recipe r = seed(title);
      assertThat(r.getGrinderModelId()).isNull();
      assertThat(r.getGrindSettingValue()).isNull();
      assertThat(r.getGrindSettingUnit()).isNull();
      assertThat(r.getGrindMicronEstimated()).isNull();
    }
  }

  @Test
  @DisplayName("AC-SEED-08 · 두 시드 모두 붓는 스텝 물량 합계가 레시피 총 물량과 같다")
  void 붓는_스텝_합계가_총_물량과_같다() {
    for (String title : List.of(HOFFMANN, KASUYA)) {
      Recipe r = seed(title);
      BigDecimal poured =
          r.getSteps().stream()
              .filter(s -> s.getStepType() == StepType.BLOOM || s.getStepType() == StepType.POUR)
              .map(RecipeStep::getWaterG)
              .reduce(BigDecimal.ZERO, BigDecimal::add);

      assertThat(poured).isEqualByComparingTo(r.getWaterG());
    }
  }

  @Test
  @DisplayName("AC-SEED-09 · 두 시드 모두 출처 표기를 갖는다")
  void 두_시드_모두_출처_표기를_갖는다() {
    assertThat(seed(HOFFMANN).getAuthorName()).isEqualTo("James Hoffmann");
    assertThat(seed(KASUYA).getAuthorName()).isEqualTo("Tetsu Kasuya");

    for (String title : List.of(HOFFMANN, KASUYA)) {
      assertThat(seed(title).getSourceUrl()).isNotNull().startsWith("https://");
    }
  }

  private void assertStep(
      RecipeStep step, int order, StepType type, int startAt, int duration, String waterG) {
    assertThat(step.getStepOrder()).isEqualTo(order);
    assertThat(step.getStepType()).isEqualTo(type);
    assertThat(step.getStartAtSeconds()).isEqualTo(startAt);
    assertThat(step.getDurationSeconds()).isEqualTo(duration);
    if (waterG == null) {
      assertThat(step.getWaterG()).isNull();
    } else {
      assertThat(step.getWaterG()).isEqualByComparingTo(waterG);
    }
  }
}
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*SeedCuratedRecipesTest'`
Expected: FAIL — Task 1의 시드 SQL이 없거나 값이 어긋나면 여기서 잡힌다. Task 1을 이미 마쳤다면 **이 단계에서 바로 통과할 수 있다.** 그 경우 시드 SQL의 값 하나를 일부러 틀리게 고쳐 테스트가 실제로 그것을 잡는지 확인한 뒤 되돌린다 — 통과만 보고 넘어가면 `@Sql`이 적용되지 않았는데도 초록인 상황(예: 경로 오타로 조용히 무시)을 구분할 수 없다.

- [x] **Step 3: 최소 구현**

구현 코드가 없다. Task 1의 SQL이 구현이다. Step 2에서 드러난 불일치만 SQL에서 고친다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*SeedCuratedRecipesTest'`
Expected: PASS, 9 tests

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "test(seed): 시드 레시피 행·스텝 검증 (AC-SEED-01~09)" && cd backend
```

---

## Task 3: 시드가 사용자에게 도달하는지 + 테스트 격리

**Files:**
- Modify: `backend/src/test/java/com/kaldinote/recipe/SeedCuratedRecipesTest.java`
- Create: `backend/src/test/java/com/kaldinote/recipe/SeedIsolationTest.java`

**Covers:** AC-SEED-10, AC-SEED-11, AC-SEED-12, AC-SEED-13

**Interfaces:**
- Consumes: `SeedCuratedRecipesTest`(Task 2), `JwtTokenProvider`, `UserRepository`, `GET /api/v1/recipes`, `GET /api/v1/recipes/{id}`, `POST /api/v1/recipes/{id}/fork`

- [x] **Step 1: 실패하는 테스트 작성**

`SeedCuratedRecipesTest`에 필드와 테스트를 덧붙인다:

```java
  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;

  /** 레시피를 하나도 만들지 않은 신규 사용자. */
  private String newUserToken() {
    User user = userRepository.save(User.create(null, "신규가입자", null));
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  @Test
  @DisplayName("AC-SEED-10 · 레시피가 없는 신규 사용자의 목록에 시드 2건이 보인다")
  void 신규_사용자_목록에_시드_2건이_보인다() throws Exception {
    mockMvc
        .perform(get("/api/v1/recipes").header(HttpHeaders.AUTHORIZATION, newUserToken()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(2))
        .andExpect(jsonPath("$.content[*].title", hasItem(HOFFMANN)))
        .andExpect(jsonPath("$.content[*].title", hasItem(KASUYA)));
  }

  @Test
  @DisplayName("AC-SEED-11 · 시드 레시피 단건 조회의 비율이 정확하다")
  void 시드_레시피의_비율이_정확하다() throws Exception {
    String token = newUserToken();

    mockMvc
        .perform(
            get("/api/v1/recipes/{id}", seed(HOFFMANN).getId())
                .header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ratio").value(16.7));

    mockMvc
        .perform(
            get("/api/v1/recipes/{id}", seed(KASUYA).getId())
                .header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ratio").value(15.0));
  }

  @Test
  @DisplayName("AC-SEED-12 · 신규 사용자가 시드를 포크하면 자기 레시피가 된다")
  void 신규_사용자가_시드를_포크할_수_있다() throws Exception {
    User user = userRepository.save(User.create(null, "포크하는사람", null));
    String token = "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());

    mockMvc
        .perform(
            post("/api/v1/recipes/{id}/fork", seed(KASUYA).getId())
                .header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.sourceType").value("USER"))
        .andExpect(jsonPath("$.ownerUserId").value(user.getId()))
        .andExpect(jsonPath("$.visibility").value("PRIVATE"))
        .andExpect(jsonPath("$.steps.length()").value(6));
  }
```

`SeedIsolationTest`를 새로 만든다 — **`@Sql`을 붙이지 않는 것이 이 테스트의 전부다.**

```java
package com.kaldinote.recipe;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.JwtTokenProvider;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.transaction.annotation.Transactional;

/**
 * 시드가 test 프로파일에 새어 들어오지 않는지 지킨다.
 *
 * <p>이 테스트가 깨지면 db/seed가 test 프로파일 Flyway에 포함된 것이고, 그 순간 AC-LIST-03·05·09·13·14·32의 기대값이 전부
 * 어긋난다. @Sql이 없는 것이 이 테스트의 핵심이다 — 실수로 붙이지 말 것.
 */
@Transactional
class SeedIsolationTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;

  @Test
  @DisplayName("AC-SEED-13 · test 프로파일에는 시드가 적용되지 않는다")
  void test_프로파일에는_시드가_없다() throws Exception {
    User user = userRepository.save(User.create(null, "격리테스터", null));
    String token = "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());

    mockMvc
        .perform(get("/api/v1/recipes").header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(0));
  }
}
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*SeedCuratedRecipesTest' --tests '*SeedIsolationTest'`
Expected: Task 1이 끝난 상태라면 통과할 수 있다. Task 2 Step 2와 같은 방식으로 **일부러 깨뜨려 확인한다** — `application-test.yml`의 `flyway.locations`에서 `db/migration`만 남긴 줄을 잠시 지우면 `SeedIsolationTest`가 `totalElements=2`로 실패해야 한다. 확인 후 되돌린다.

- [x] **Step 3: 최소 구현**

구현 코드가 없다. 실패하면 Task 1의 설정이나 SQL을 고친다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*SeedCuratedRecipesTest' --tests '*SeedIsolationTest'`
Expected: PASS — `SeedCuratedRecipesTest` 12 tests, `SeedIsolationTest` 1 test

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "test(seed): 시드 목록 노출·포크·테스트 격리 검증 (AC-SEED-10~13)" && cd backend
```

---

## Task 4: Swagger의 AuthenticatedUser 파라미터 숨김

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/common/config/OpenApiConfig.java`
- Test: `backend/src/test/java/com/kaldinote/common/config/OpenApiDocsTest.java`

**Covers:** AC-SWAGGER-01, AC-SWAGGER-02, AC-SWAGGER-03

**Interfaces:**
- Consumes: `AuthenticatedUser`, `SpringDocUtils`(springdoc-openapi-starter-common 3.1.0), `GET /v3/api-docs`

- [x] **Step 1: 실패하는 테스트 작성**

```java
package com.kaldinote.common.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * AuthenticatedUser는 서버가 JWT에서 채우는 값이라 사람이 입력할 수 없다. springdoc이 이것을 쿼리 파라미터로 노출하면 Swagger UI에
 * 채울 수 없는 필수 입력란이 19개 엔드포인트 전부에 생긴다.
 */
class OpenApiDocsTest extends AbstractIntegrationTest {

  @Test
  @DisplayName("AC-SWAGGER-01 · API 문서에 user 쿼리 파라미터가 하나도 없다")
  void user_쿼리_파라미터가_없다() throws Exception {
    mockMvc
        .perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(
            jsonPath("$..parameters[?(@.name == 'user' && @.in == 'query')]", Matchers.empty()));
  }

  @Test
  @DisplayName("AC-SWAGGER-02 · 숨김이 엔드포인트를 지우지 않는다")
  void 엔드포인트가_사라지지_않는다() throws Exception {
    mockMvc
        .perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.paths['/api/v1/recipes']").exists())
        .andExpect(jsonPath("$.paths['/api/v1/recipes/{id}']").exists())
        .andExpect(jsonPath("$.paths['/api/v1/brew-logs']").exists())
        .andExpect(jsonPath("$.paths['/api/v1/users/me']").exists())
        .andExpect(jsonPath("$.paths['/api/v1/gear/user-grinders']").exists());
  }

  @Test
  @DisplayName("AC-SWAGGER-03 · bearerAuth 보안 스키마가 유지된다")
  void bearerAuth_스키마가_유지된다() throws Exception {
    mockMvc
        .perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.type").value("http"))
        .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme").value("bearer"))
        .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.bearerFormat").value("JWT"));
  }
}
```

> **`/v3/api-docs`가 인증 없이 열려 있는지 먼저 확인한다.** `SecurityConfig`에서 permitAll이 아니면 이 테스트가 401로 실패한다. 그 경우 요청에 유효한 토큰을 붙이는 방식으로 바꾼다(보안 설정을 느슨하게 바꾸지 않는다 — 이 계획의 범위 밖이다).

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*OpenApiDocsTest'`
Expected: FAIL — `AC-SWAGGER-01`이 실패한다. `$..parameters[?(@.name == 'user' && @.in == 'query')]`가 비어 있지 않다(엔드포인트 19개분이 잡힌다). `02`·`03`은 이미 통과한다 — 이것이 정상이며, 숨김 적용 후에도 계속 통과해야 하는 회귀 방지선이다.

- [x] **Step 3: 최소 구현**

`OpenApiConfig`에 `AuthenticatedUser` 무시 등록을 추가한다:

```java
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
    // 등록하지 않으면 springdoc이 record 컴포넌트를 풀어 `user`라는 필수 쿼리 파라미터로 노출한다.
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
```

> `static` 블록이 안 먹으면 `@Bean` 메서드 첫 줄로 옮긴다. springdoc의 `SpringDocUtils`는 전역 정적 설정이라 등록 시점이 스캔보다 앞서기만 하면 된다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*OpenApiDocsTest'`
Expected: PASS, 3 tests

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "fix(swagger): AuthenticatedUser가 쿼리 파라미터로 노출되지 않게 한다 (AC-SWAGGER-01~03)" && cd backend
```

---

## 완료 기준

- [x] `cd backend && ./gradlew clean check` 통과 — 테스트 456개(기준선 440 + 16)
- [x] `./scripts/check-spec-coverage.sh` 통과 — 스펙 11건·AC 378개. 이 스펙은 AC 18개로 집계된다(본문이 `AC-LIST-03`·`AC-LIST-32`를 상호 참조하며, 스크립트는 문서 안의 모든 AC ID를 센다. 둘 다 기존 테스트에 존재해 통과한다)
- [x] 스펙 `docs/specs/2026-08-21-seed-curated-recipes.md`의 `status`를 `구현완료`로 변경
- [x] `docs/plans/2026-08-19-plan-list-query.md`의 미체크 항목(시드 CURATED 확인 불가)에 후속 결과를 주석으로 남긴다
- [x] `bootRun`(`local`)으로 서버를 띄워 Flyway가 `V11`을 적용하는 것과, 신규 계정의 `GET /api/v1/recipes`에 시드 2건이 보이는 것을 확인한다 — Flyway 로그 `Migrating schema "public" to version "11 - seed curated recipes"` → `Successfully applied 1 migration`, 신규 사용자(id 9) 목록에서 `totalElements: 2`, `ratio` 16.7·15.0 확인. 이어서 Kasuya 시드 포크도 실행해 `sourceType: USER`·`ownerUserId: 9`·`visibility: PRIVATE`·`steps: 6`·`parentRecipeId: 9` 확인
- [x] Swagger UI에서 임의 엔드포인트에 `user` 입력란이 없는 것을 눈으로 확인한다 — `/v3/api-docs`를 직접 파싱해 `user` 쿼리 파라미터 **0개**, `paths` 26개 유지, `bearerAuth` 스키마 유지 확인(눈확인보다 확정적이라 이 방식으로 대체)

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 16개 중 16개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** `RecipeResponse.ratio`(필드명 `ratio`, 스케일 1 HALF_UP), `POST /api/v1/recipes/{id}/fork`(201, `RecipeResponse` 반환), `Recipe`의 getter 이름을 실제 코드에서 확인해 반영함

**검증되지 않은 가정 — 실행 결과 (2026-08-21 기록):**

| # | 가정 | 결과 |
|---|---|---|
| 1 | `flyway.locations` 프로파일별 교체 | **확인.** 병합이 아니라 교체된다. `AC-LIST-32`가 계속 통과하는 것이 증거 |
| 2 | `@Sql` + `@Transactional` 롤백 | **확인.** 매 테스트마다 롤백된다. 9개 테스트가 각각 `hasSize(1)`을 만족했다(누적됐다면 두 번째부터 깨진다) |
| 3 | `/v3/api-docs` 인증 없이 접근 | **확인.** `SecurityConfig`에 `/v3/api-docs/**` permitAll이 이미 있었다 |
| 4 | `VALUES` 목록의 `NULL` 타입 추론 | **미검증으로 두지 않고 선제 대응.** 첫 행에 `::numeric`·`::varchar` 캐스트를 넣었다. psql 롤백 트랜잭션으로 SQL을 먼저 돌려 13행이 의도대로 들어가는 것을 확인한 뒤 테스트를 썼다 |
| 5 | `SpringDocUtils`를 `static` 블록에서 등록 | **확인.** springdoc 스캔보다 앞선다. `@Bean` 안으로 옮길 필요가 없었다 |

**계획의 예측이 빗나간 것:** 격리를 실제로 제거해보니 깨지는 테스트가 예측한 6개(`AC-LIST-03`·`05`·`09`·`13`·`14`·`32`)가 아니라 **9개 이상**이었다. `AC-LIST-02`·`06`·`15`·`31`이 추가로 깨진다 — 시드 2건이 페이지네이션 경계값 테스트의 전체 건수와 정렬 순서까지 흔든다. 격리 결정이 예상보다 더 정당했다.

**원래 적었던 가정 서술 (참고용):**

1. **`spring.flyway.locations`를 프로파일별로 덮어쓸 수 있는가.** Spring Boot의 프로파일 오버라이드는 리스트 타입 프로퍼티를 병합하지 않고 통째로 교체하는 것이 기본 동작이지만, `application-test.yml`이 실제로 `application.yml`의 두 항목을 하나로 교체하는지 Task 1 Step 4에서 확인한다. 병합돼 버리면 `SeedIsolationTest`가 즉시 실패해 잡힌다.
2. **`@Sql`이 Flyway 이후에 실행되는가.** `@Sql`은 테스트 메서드 직전에 실행되고 Flyway는 컨텍스트 기동 시점에 끝나므로 순서는 보장되지만, `@Transactional`과 조합했을 때 `@Sql`이 같은 트랜잭션에서 롤백되는지 확인한다. 롤백되지 않으면 시드 행이 누적돼 `SeedCuratedRecipesTest`의 `hasSize(1)`이 두 번째 테스트부터 깨진다. 깨지면 `@Sql(executionPhase = BEFORE_TEST_METHOD)` 기본값과 `@Transactional`의 상호작용을 확인하고, 필요하면 클래스 레벨 `@Sql` 대신 `@BeforeEach`에서 스크립트를 실행하거나 `AFTER_TEST_METHOD`로 정리 스크립트를 추가한다.
3. **`/v3/api-docs`가 인증 없이 접근 가능한가.** `SecurityConfig`를 확인하지 않았다. 401이면 Task 4 Step 1에서 토큰을 붙이는 방식으로 바꾼다.
4. **PostgreSQL `VALUES` 목록의 `NULL` 타입 추론.** `pour_technique` 컬럼의 첫 행이 문자열이라 이후 `NULL`이 text로 추론되는데 대상이 `VARCHAR(20)`이라 문제없을 것으로 본다. 실패하면 명시적 캐스트를 넣는다.
5. **`SpringDocUtils.getConfig().addRequestWrapperToIgnore()`가 `static` 블록에서 유효한가.** 메서드 존재는 `javap`로 확인했으나 등록 시점이 springdoc 스캔보다 앞서는지는 실행해봐야 안다. 늦으면 `@Bean` 메서드 안으로 옮긴다.

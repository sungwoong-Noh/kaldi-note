# 레시피 등록·조회·수정·삭제 (푸어 스텝 포함) 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-08-16-recipe-crud.md`

**Goal:** 사용자가 푸어오버 레시피를 푸어 스텝 시퀀스와 함께 등록·조회·수정·삭제할 수 있다. 저장 시점에 그라인더 설정값을 마이크론으로 환산해 스냅샷으로 남기고, 조회 시 브루 비율과 스텝별 누적 물량을 계산해 돌려준다.

**Architecture:** `recipe` 도메인을 4계층(domain/application/infrastructure/presentation)으로 새로 만든다. `Recipe`↔`RecipeStep`은 생명주기를 공유하는 부모-자식이므로 `@OneToMany` 직접 연관관계를 쓰고, `gear`(그라인더·브루어·필터) 도메인은 `application` 계층에서 ID로만 참조한다. 마이크론 스냅샷 계산은 기존 `grind.domain.GrindConverter`(Plan 1에서 완성)를 그대로 재사용한다 — 새 환산 로직을 만들지 않는다.

**작업 위치:** `backend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-RECIPE-01 | 최소 입력으로 생성, 기본값(PRIVATE/USER/POUR_OVER) | Task 2 | API 테스트 |
| AC-RECIPE-02 | 스텝 0개는 물량 검증 스킵 | Task 2 | API 테스트 |
| AC-RECIPE-03 | 스텝 합계=총물량 → 성공 | Task 2 | API 테스트 |
| AC-RECIPE-04 | stepOrder는 배열 순서로 서버 부여 | Task 2 | API 테스트 |
| AC-RECIPE-05 | 조회 응답 ratio 계산 | Task 5 | API 테스트 |
| AC-RECIPE-06 | 조회 응답 cumulativeWaterG 계산 | Task 5 | API 테스트 |
| AC-RECIPE-07 | 마이크론 스냅샷 서버 계산 | Task 2 | API 테스트 |
| AC-RECIPE-08 | 무단계 그라인더는 스냅샷 null, 생성은 성공 | Task 2 | API 테스트 |
| AC-RECIPE-09 | unit=MICRON은 그라인더 없이 값 그대로 | Task 2 | API 테스트 |
| AC-RECIPE-10 | PUT은 스텝을 통째로 교체 | Task 6 | API 테스트 |
| AC-RECIPE-11 | 삭제 후 소유자도 조회 불가(404) | Task 7 | API 테스트 |
| AC-RECIPE-12 | 이미 삭제된 레시피 재삭제는 404 | Task 7 | API 테스트 |
| AC-RECIPE-20~23 | doseG 1.0/0.9/200.0/200.1 | Task 3 | API 테스트 |
| AC-RECIPE-24~27 | waterG 10.0/9.9/3000.0/3000.1 | Task 3 | API 테스트 |
| AC-RECIPE-28~31 | waterTempC 60.0/59.9/100.0/100.1 | Task 3 | API 테스트 |
| AC-RECIPE-32~33 | totalTimeSeconds 3600/3601 | Task 3 | API 테스트 |
| AC-RECIPE-34~35 | 스텝 30개/31개 | Task 3 | API 테스트 |
| AC-RECIPE-36~38 | title 100자/101자/공백만 | Task 3 | API 테스트 |
| AC-RECIPE-39~40 | description 2000자/2001자 | Task 3 | API 테스트 |
| AC-RECIPE-41~44 | MICRON 100/99/2000/2001 | Task 2 | API 테스트 |
| AC-RECIPE-45 | 경계 접촉(0+30≤30)은 허용 | Task 4 | API 테스트 |
| AC-RECIPE-46 | 1초 겹침은 거부 | Task 4 | API 테스트 |
| AC-RECIPE-47 | 빈 구간은 허용 | Task 4 | API 테스트 |
| AC-RECIPE-48 | totalTimeSeconds가 스텝 종료보다 작아도 허용 | Task 4 | API 테스트 |
| AC-RECIPE-50 | 스텝 합계≠총물량 거부 | Task 4 | API 테스트 |
| AC-RECIPE-51 | 붓지 않는 스텝에 물량 있으면 거부 | Task 4 | API 테스트 |
| AC-RECIPE-52 | 붓는 스텝 물량 0이면 거부 | Task 4 | API 테스트 |
| AC-RECIPE-53 | brewerId 없음 → 404 | Task 4 | API 테스트 |
| AC-RECIPE-54 | grinderModelId 없음 → 404 | Task 2 | API 테스트 |
| AC-RECIPE-55 | 그라인더 범위 밖 → 400 | Task 2 | API 테스트 |
| AC-RECIPE-56 | CLICK인데 grinderModelId 없음 → 400 | Task 2 | API 테스트 |
| AC-RECIPE-57 | CURATED 지정 → 403 | Task 4 | API 테스트 |
| AC-RECIPE-58 | 남의 레시피 수정 → 403 | Task 6 | API 테스트 |
| AC-RECIPE-59 | 남의 레시피 삭제 → 403 | Task 7 | API 테스트 |
| AC-RECIPE-60 | 인증 없이 생성 → 401 | Task 2 | API 테스트 |
| AC-RECIPE-61 | 존재하지 않는 레시피 조회 → 404 | Task 5 | API 테스트 |

**53개 전부 매핑됨** (12 + 29 + 12 = 53, 스펙과 동일).

---

## Global Constraints

- 측정값은 전부 `BigDecimal`. `double`/`float` 금지.
- 반올림은 `backend/CLAUDE.md`의 반올림 규칙(중량 스케일 1, 마이크론 스케일 0, 비율 스케일 1, 전부 HALF_UP)을 따른다.
- `gear`(브루어·필터·그라인더) 도메인은 `recipe/application`에서 리포지토리로 직접 조회하되, `recipe` 엔티티에는 ID(`Long`)만 저장한다. `gear` 엔티티를 `recipe` 엔티티 필드로 두지 않는다.
- 소프트 삭제된 레시피는 `RecipeRepository#findByIdAndDeletedAtIsNull`로 걸러 존재하지 않는 것처럼 취급한다.
- PUT의 스텝 교체는 **삭제 후 flush, 그다음 삽입** 순서를 지킨다. `clear()` + `addAll()`만 하면 Hibernate가 insert를 delete보다 먼저 실행해 `UNIQUE(recipe_id, step_order)` 위반이 난다.
- `AuthenticatedUser` 컨트롤러 파라미터는 **`@AuthenticationPrincipal` 없이 타입만으로 받는다** (Task 11에서 확인된 실제 동작 — 애노테이션을 붙이면 NPE).
- 컨트롤러 메서드 순서·구조는 기존 `CatalogController`/`GearController` 패턴을 따른다.

---

## File Structure

```
backend/src/main/resources/db/migration/
└── V6__create_recipe_tables.sql

backend/src/main/java/com/kaldinote/recipe/
├── domain/
│   ├── Recipe.java
│   ├── RecipeStep.java
│   ├── BrewMethod.java
│   ├── RecipeSourceType.java
│   ├── RecipeVisibility.java
│   ├── StepType.java
│   ├── PourTechnique.java
│   ├── Agitation.java
│   └── GrindSettingUnit.java
├── infrastructure/
│   ├── RecipeRepository.java
│   └── RecipeStepRepository.java
├── application/
│   └── RecipeService.java
└── presentation/
    ├── RecipeController.java
    └── dto/
        ├── CreateRecipeRequest.java
        ├── UpdateRecipeRequest.java
        ├── StepRequest.java
        ├── RecipeResponse.java
        └── RecipeStepResponse.java

backend/src/main/java/com/kaldinote/common/error/ErrorCode.java   (Modify — Task 4)

backend/src/test/java/com/kaldinote/recipe/
├── infrastructure/RecipeRepositoryTest.java
└── presentation/RecipeControllerTest.java
```

---

## Task 1: 레시피 스키마 · 엔티티 · 리포지토리 (기반)

**Files:**
- Create: `backend/src/main/resources/db/migration/V6__create_recipe_tables.sql`
- Create: `backend/src/main/java/com/kaldinote/recipe/domain/Recipe.java`, `RecipeStep.java`, `BrewMethod.java`, `RecipeSourceType.java`, `RecipeVisibility.java`, `StepType.java`, `PourTechnique.java`, `Agitation.java`, `GrindSettingUnit.java`
- Create: `backend/src/main/java/com/kaldinote/recipe/infrastructure/RecipeRepository.java`, `RecipeStepRepository.java`
- Test: `backend/src/test/java/com/kaldinote/recipe/infrastructure/RecipeRepositoryTest.java`

**Covers:** (없음 — 후속 태스크가 딛고 설 기반. AC는 Task 2부터 실제로 검증된다)

**Interfaces:**
- Consumes: `BaseTimeEntity`(Task 4/Plan 1), `users(id)` FK
- Produces:
  - `Recipe.create(...)`, `Recipe#applyUpdate(...)`, `Recipe#replaceSteps(List<RecipeStep>)`, `Recipe#softDelete()`, `Recipe#isOwnedBy(Long)`
  - `RecipeStep.of(...)`
  - `RecipeRepository#findByIdAndDeletedAtIsNull(Long)`
  - `RecipeStepRepository#deleteAllByRecipe(Recipe)`

- [x] **Step 1: 스키마 마이그레이션 작성**

`V6__create_recipe_tables.sql`:

```sql
CREATE TABLE recipes (
    id                      BIGSERIAL PRIMARY KEY,
    owner_user_id           BIGINT      REFERENCES users (id) ON DELETE SET NULL,
    source_type             VARCHAR(20)  NOT NULL DEFAULT 'USER',
    author_name             VARCHAR(100),
    source_url              VARCHAR(500),
    source_note             VARCHAR(500),
    title                   VARCHAR(100) NOT NULL,
    description             VARCHAR(2000),
    brew_method             VARCHAR(20)  NOT NULL DEFAULT 'POUR_OVER',
    visibility              VARCHAR(20)  NOT NULL DEFAULT 'PRIVATE',
    parent_recipe_id        BIGINT       REFERENCES recipes (id),
    fork_root_id            BIGINT       REFERENCES recipes (id),
    dose_g                  NUMERIC(5,1) NOT NULL,
    water_g                 NUMERIC(6,1) NOT NULL,
    water_temp_c            NUMERIC(4,1),
    total_time_seconds      INTEGER,
    brewer_id               BIGINT       REFERENCES brewers (id),
    filter_id               BIGINT       REFERENCES brew_filters (id),
    grinder_model_id        BIGINT       REFERENCES grinder_models (id),
    grind_setting_value     NUMERIC(7,1),
    grind_setting_unit      VARCHAR(10),
    grind_micron_estimated  NUMERIC(6,0),
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ,
    CONSTRAINT chk_recipe_dose_positive  CHECK (dose_g > 0),
    CONSTRAINT chk_recipe_water_positive CHECK (water_g > 0)
);

CREATE INDEX idx_recipes_owner   ON recipes (owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_recipes_brewer  ON recipes (brewer_id);
CREATE INDEX idx_recipes_filter  ON recipes (filter_id);
CREATE INDEX idx_recipes_grinder ON recipes (grinder_model_id);
CREATE INDEX idx_recipes_parent  ON recipes (parent_recipe_id);

CREATE TABLE recipe_steps (
    id                BIGSERIAL PRIMARY KEY,
    recipe_id         BIGINT      NOT NULL REFERENCES recipes (id) ON DELETE CASCADE,
    step_order        INTEGER     NOT NULL,
    step_type         VARCHAR(20) NOT NULL,
    start_at_seconds  INTEGER     NOT NULL,
    duration_seconds  INTEGER     NOT NULL,
    water_g           NUMERIC(6,1),
    pour_technique    VARCHAR(20),
    agitation         VARCHAR(20),
    note              VARCHAR(500),
    CONSTRAINT uq_recipe_steps_order UNIQUE (recipe_id, step_order)
);
CREATE INDEX idx_recipe_steps_recipe ON recipe_steps (recipe_id);
```

- [x] **Step 2: 실패하는 리포지토리 테스트 작성**

`backend/src/test/java/com/kaldinote/recipe/infrastructure/RecipeRepositoryTest.java`:

```java
package com.kaldinote.recipe.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.recipe.domain.GrindSettingUnit;
import com.kaldinote.recipe.domain.Recipe;
import com.kaldinote.recipe.domain.RecipeStep;
import com.kaldinote.recipe.domain.RecipeVisibility;
import com.kaldinote.recipe.domain.StepType;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class RecipeRepositoryTest extends AbstractIntegrationTest {

  @Autowired private RecipeRepository recipeRepository;
  @Autowired private UserRepository userRepository;

  private Long ownerId() {
    return userRepository.save(User.create(null, "테스터", null)).getId();
  }

  @Test
  void 레시피와_스텝을_함께_저장하고_조회한다() {
    Recipe recipe =
        Recipe.create(
            ownerId(), "아침 레시피", null, RecipeVisibility.PRIVATE,
            new BigDecimal("15.0"), new BigDecimal("250.0"), null, null,
            null, null, null, null, (GrindSettingUnit) null, null);
    recipe.replaceSteps(
        List.of(RecipeStep.of(1, StepType.BLOOM, 0, 10, new BigDecimal("40.0"), null, null, null)));

    Recipe saved = recipeRepository.save(recipe);

    Recipe found = recipeRepository.findById(saved.getId()).orElseThrow();
    assertThat(found.getSteps()).hasSize(1);
    assertThat(found.getSteps().get(0).getStepOrder()).isEqualTo(1);
  }

  @Test
  void 소프트_삭제된_레시피는_findByIdAndDeletedAtIsNull로_찾을_수_없다() {
    Recipe recipe =
        Recipe.create(
            ownerId(), "삭제될 레시피", null, RecipeVisibility.PRIVATE,
            new BigDecimal("15.0"), new BigDecimal("250.0"), null, null,
            null, null, null, null, (GrindSettingUnit) null, null);
    Recipe saved = recipeRepository.save(recipe);
    saved.softDelete();
    recipeRepository.save(saved);

    assertThat(recipeRepository.findByIdAndDeletedAtIsNull(saved.getId())).isEmpty();
    assertThat(recipeRepository.findById(saved.getId())).isPresent();
  }
}
```

- [x] **Step 3: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeRepositoryTest'`
Expected: 컴파일 실패 (엔티티·리포지토리 없음).

- [x] **Step 4: 엔티티 작성**

enum 7종은 각각 한 파일, 값만 나열한다:

```java
package com.kaldinote.recipe.domain;

public enum BrewMethod { POUR_OVER }
```
```java
package com.kaldinote.recipe.domain;

public enum RecipeSourceType { USER, CURATED }
```
```java
package com.kaldinote.recipe.domain;

public enum RecipeVisibility { PRIVATE, FRIENDS, PUBLIC }
```
```java
package com.kaldinote.recipe.domain;

public enum StepType { BLOOM, POUR, WAIT, SWIRL, STIR, DRAWDOWN }
```
```java
package com.kaldinote.recipe.domain;

public enum PourTechnique { CENTER, SPIRAL, PULSE, EDGE }
```
```java
package com.kaldinote.recipe.domain;

public enum Agitation { NONE, SWIRL, STIR }
```
```java
package com.kaldinote.recipe.domain;

public enum GrindSettingUnit { CLICK, NUMBER, MICRON }
```

`Recipe.java`:

```java
package com.kaldinote.recipe.domain;

import com.kaldinote.common.entity.BaseTimeEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "recipes")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Recipe extends BaseTimeEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "owner_user_id")
  private Long ownerUserId;

  @Enumerated(EnumType.STRING)
  @Column(name = "source_type", nullable = false, length = 20)
  private RecipeSourceType sourceType;

  @Column(name = "author_name", length = 100)
  private String authorName;

  @Column(name = "source_url", length = 500)
  private String sourceUrl;

  @Column(name = "source_note", length = 500)
  private String sourceNote;

  @Column(nullable = false, length = 100)
  private String title;

  @Column(length = 2000)
  private String description;

  @Enumerated(EnumType.STRING)
  @Column(name = "brew_method", nullable = false, length = 20)
  private BrewMethod brewMethod;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private RecipeVisibility visibility;

  @Column(name = "parent_recipe_id")
  private Long parentRecipeId;

  @Column(name = "fork_root_id")
  private Long forkRootId;

  @Column(name = "dose_g", nullable = false, precision = 5, scale = 1)
  private BigDecimal doseG;

  @Column(name = "water_g", nullable = false, precision = 6, scale = 1)
  private BigDecimal waterG;

  @Column(name = "water_temp_c", precision = 4, scale = 1)
  private BigDecimal waterTempC;

  @Column(name = "total_time_seconds")
  private Integer totalTimeSeconds;

  @Column(name = "brewer_id")
  private Long brewerId;

  @Column(name = "filter_id")
  private Long filterId;

  @Column(name = "grinder_model_id")
  private Long grinderModelId;

  @Column(name = "grind_setting_value", precision = 7, scale = 1)
  private BigDecimal grindSettingValue;

  @Enumerated(EnumType.STRING)
  @Column(name = "grind_setting_unit", length = 10)
  private GrindSettingUnit grindSettingUnit;

  @Column(name = "grind_micron_estimated", precision = 6, scale = 0)
  private BigDecimal grindMicronEstimated;

  @Column(name = "deleted_at")
  private Instant deletedAt;

  @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
  @OrderBy("stepOrder ASC")
  private List<RecipeStep> steps = new ArrayList<>();

  private Recipe(
      Long ownerUserId,
      String title,
      String description,
      RecipeVisibility visibility,
      BigDecimal doseG,
      BigDecimal waterG,
      BigDecimal waterTempC,
      Integer totalTimeSeconds,
      Long brewerId,
      Long filterId,
      Long grinderModelId,
      BigDecimal grindSettingValue,
      GrindSettingUnit grindSettingUnit,
      BigDecimal grindMicronEstimated) {
    this.ownerUserId = ownerUserId;
    this.sourceType = RecipeSourceType.USER;
    this.title = title;
    this.description = description;
    this.brewMethod = BrewMethod.POUR_OVER;
    this.visibility = visibility;
    this.doseG = doseG;
    this.waterG = waterG;
    this.waterTempC = waterTempC;
    this.totalTimeSeconds = totalTimeSeconds;
    this.brewerId = brewerId;
    this.filterId = filterId;
    this.grinderModelId = grinderModelId;
    this.grindSettingValue = grindSettingValue;
    this.grindSettingUnit = grindSettingUnit;
    this.grindMicronEstimated = grindMicronEstimated;
  }

  public static Recipe create(
      Long ownerUserId,
      String title,
      String description,
      RecipeVisibility visibility,
      BigDecimal doseG,
      BigDecimal waterG,
      BigDecimal waterTempC,
      Integer totalTimeSeconds,
      Long brewerId,
      Long filterId,
      Long grinderModelId,
      BigDecimal grindSettingValue,
      GrindSettingUnit grindSettingUnit,
      BigDecimal grindMicronEstimated) {
    return new Recipe(
        ownerUserId, title, description, visibility, doseG, waterG, waterTempC,
        totalTimeSeconds, brewerId, filterId, grinderModelId, grindSettingValue,
        grindSettingUnit, grindMicronEstimated);
  }

  public void applyUpdate(
      String title,
      String description,
      RecipeVisibility visibility,
      BigDecimal doseG,
      BigDecimal waterG,
      BigDecimal waterTempC,
      Integer totalTimeSeconds,
      Long brewerId,
      Long filterId,
      Long grinderModelId,
      BigDecimal grindSettingValue,
      GrindSettingUnit grindSettingUnit,
      BigDecimal grindMicronEstimated) {
    this.title = title;
    this.description = description;
    this.visibility = visibility;
    this.doseG = doseG;
    this.waterG = waterG;
    this.waterTempC = waterTempC;
    this.totalTimeSeconds = totalTimeSeconds;
    this.brewerId = brewerId;
    this.filterId = filterId;
    this.grinderModelId = grinderModelId;
    this.grindSettingValue = grindSettingValue;
    this.grindSettingUnit = grindSettingUnit;
    this.grindMicronEstimated = grindMicronEstimated;
  }

  public void replaceSteps(List<RecipeStep> newSteps) {
    newSteps.forEach(s -> s.assignTo(this));
    this.steps.clear();
    this.steps.addAll(newSteps);
  }

  public void softDelete() {
    this.deletedAt = Instant.now();
  }

  public boolean isOwnedBy(Long userId) {
    return ownerUserId != null && ownerUserId.equals(userId);
  }
}
```

`RecipeStep.java`:

```java
package com.kaldinote.recipe.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "recipe_steps")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RecipeStep {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "recipe_id")
  private Recipe recipe;

  @Column(name = "step_order", nullable = false)
  private Integer stepOrder;

  @Enumerated(EnumType.STRING)
  @Column(name = "step_type", nullable = false, length = 20)
  private StepType stepType;

  @Column(name = "start_at_seconds", nullable = false)
  private Integer startAtSeconds;

  @Column(name = "duration_seconds", nullable = false)
  private Integer durationSeconds;

  @Column(name = "water_g", precision = 6, scale = 1)
  private BigDecimal waterG;

  @Enumerated(EnumType.STRING)
  @Column(name = "pour_technique", length = 20)
  private PourTechnique pourTechnique;

  @Enumerated(EnumType.STRING)
  @Column(length = 20)
  private Agitation agitation;

  @Column(length = 500)
  private String note;

  private RecipeStep(
      Integer stepOrder,
      StepType stepType,
      Integer startAtSeconds,
      Integer durationSeconds,
      BigDecimal waterG,
      PourTechnique pourTechnique,
      Agitation agitation,
      String note) {
    this.stepOrder = stepOrder;
    this.stepType = stepType;
    this.startAtSeconds = startAtSeconds;
    this.durationSeconds = durationSeconds;
    this.waterG = waterG;
    this.pourTechnique = pourTechnique;
    this.agitation = agitation;
    this.note = note;
  }

  public static RecipeStep of(
      int stepOrder,
      StepType stepType,
      int startAtSeconds,
      int durationSeconds,
      BigDecimal waterG,
      PourTechnique pourTechnique,
      Agitation agitation,
      String note) {
    return new RecipeStep(
        stepOrder, stepType, startAtSeconds, durationSeconds, waterG, pourTechnique, agitation, note);
  }

  void assignTo(Recipe recipe) {
    this.recipe = recipe;
  }
}
```

리포지토리:

```java
package com.kaldinote.recipe.infrastructure;

import com.kaldinote.recipe.domain.Recipe;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecipeRepository extends JpaRepository<Recipe, Long> {
  Optional<Recipe> findByIdAndDeletedAtIsNull(Long id);
}
```

```java
package com.kaldinote.recipe.infrastructure;

import com.kaldinote.recipe.domain.Recipe;
import com.kaldinote.recipe.domain.RecipeStep;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RecipeStepRepository extends JpaRepository<RecipeStep, Long> {
  void deleteAllByRecipe(Recipe recipe);
}
```

- [x] **Step 5: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeRepositoryTest'`
Expected: PASS, 2 tests.

- [x] **Step 6: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 레시피·푸어 스텝 스키마와 엔티티 추가" && cd backend
```

---

## Task 2: 레시피 생성 — 정상 동작 + 마이크론 스냅샷

**Files:**
- Create: `backend/src/main/java/com/kaldinote/recipe/presentation/dto/CreateRecipeRequest.java`, `StepRequest.java`, `RecipeResponse.java`, `RecipeStepResponse.java`
- Create: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Create: `backend/src/main/java/com/kaldinote/recipe/presentation/RecipeController.java`
- Test: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`

**Covers:** AC-RECIPE-01, 02, 03, 04, 07, 08, 09, 41, 42, 43, 44, 54, 55, 56, 60

**Interfaces:**
- Consumes: `Recipe`/`RecipeStep`(Task 1), `GrindConverter`/`GrindSpec`(Plan 1 `grind`), `GrinderModelRepository`(Plan 1 `gear`), `AuthenticatedUser`, `JwtTokenProvider`
- Produces:
  - `RecipeService#create(Long userId, CreateRecipeRequest request) → RecipeResponse`
  - `POST /api/v1/recipes` (201)
  - 이 태스크의 `buildSteps`는 **검증 없이 순서만 부여**한다. 물량 합계·겹침 검사는 Task 4가 추가한다.

> **DTO에 경계값 애노테이션을 아직 넣지 않는다.** `@NotNull`처럼 구조적으로 항상 필요한 것만 넣고, `@DecimalMin`/`@Size` 같은 범위 검증은 Task 3이 추가한다. 이 태스크의 테스트는 범위를 시험하지 않으므로 지금 넣으면 무엇을 위한 코드인지 알 수 없는 채로 만들어진다.

- [x] **Step 1: 실패하는 테스트 작성**

`backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`:

```java
package com.kaldinote.recipe.presentation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import com.kaldinote.auth.infrastructure.jwt.JwtTokenProvider;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.user.domain.User;
import com.kaldinote.user.infrastructure.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class RecipeControllerTest extends AbstractIntegrationTest {

  @Autowired private JwtTokenProvider tokenProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private GrinderModelRepository grinderRepository;

  private String token() {
    User user = userRepository.save(User.create(null, "테스터", null));
    return "Bearer " + tokenProvider.createAccessToken(user.getId(), user.getRole());
  }

  private String otherUserToken() {
    User other = userRepository.save(User.create(null, "다른사람", null));
    return "Bearer " + tokenProvider.createAccessToken(other.getId(), other.getRole());
  }

  private Long grinderId(String brand, String name) {
    return grinderRepository.findByBrandAndName(brand, name).orElseThrow().getId();
  }

  private ResultActions createRecipe(String token, String body) throws Exception {
    return mockMvc.perform(
        post("/api/v1/recipes")
            .header(HttpHeaders.AUTHORIZATION, token)
            .contentType(MediaType.APPLICATION_JSON)
            .content(body));
  }

  @Test
  @DisplayName("AC-RECIPE-01 · 최소 입력만으로 레시피가 생성된다")
  void 최소_입력만으로_레시피가_생성된다() throws Exception {
    createRecipe(token(), """
        {"title":"아침 레시피","doseG":15.0,"waterG":250.0}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.visibility").value("PRIVATE"))
        .andExpect(jsonPath("$.sourceType").value("USER"))
        .andExpect(jsonPath("$.brewMethod").value("POUR_OVER"));
  }

  @Test
  @DisplayName("AC-RECIPE-02 · 스텝이 0개면 물량 합계 검증을 건너뛴다")
  void 스텝이_0개면_물량_검증을_건너뛴다() throws Exception {
    createRecipe(token(), """
        {"title":"빈 스텝","doseG":15.0,"waterG":250.0,"steps":[]}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.steps.length()").value(0));
  }

  @Test
  @DisplayName("AC-RECIPE-03 · 스텝 물량 합계가 총 물량과 같으면 생성된다")
  void 스텝_물량_합계가_같으면_생성된다() throws Exception {
    createRecipe(token(), """
        {"title":"Kasuya","doseG":20.0,"waterG":300.0,"steps":[
          {"stepType":"BLOOM","startAtSeconds":0,"durationSeconds":10,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":45,"durationSeconds":10,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":90,"durationSeconds":10,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":135,"durationSeconds":10,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":165,"durationSeconds":10,"waterG":60.0}
        ]}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.steps.length()").value(5));
  }

  @Test
  @DisplayName("AC-RECIPE-04 · stepOrder는 서버가 배열 순서로 1부터 부여한다")
  void stepOrder는_배열_순서로_부여된다() throws Exception {
    createRecipe(token(), """
        {"title":"순서 확인","doseG":15.0,"waterG":180.0,"steps":[
          {"stepType":"BLOOM","startAtSeconds":0,"durationSeconds":10,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":40,"durationSeconds":10,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":80,"durationSeconds":10,"waterG":60.0}
        ]}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.steps[0].stepOrder").value(1))
        .andExpect(jsonPath("$.steps[1].stepOrder").value(2))
        .andExpect(jsonPath("$.steps[2].stepOrder").value(3));
  }

  @Test
  @DisplayName("AC-RECIPE-07 · 마이크론 스냅샷을 서버가 계산해 저장한다")
  void 마이크론_스냅샷을_서버가_계산한다() throws Exception {
    Long c40 = grinderId("Comandante", "C40 MK4");
    createRecipe(token(), """
        {"title":"C40 레시피","doseG":15.0,"waterG":250.0,
         "grinderModelId":%d,"grindSettingValue":22,"grindSettingUnit":"CLICK"}
        """.formatted(c40))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.grindMicronEstimated").value(660));
  }

  @Test
  @DisplayName("AC-RECIPE-08 · 무단계 그라인더는 스냅샷이 null이고 레시피는 생성된다")
  void 무단계_그라인더는_스냅샷이_null이다() throws Exception {
    Long wilfa = grinderId("Wilfa", "Uniform");
    createRecipe(token(), """
        {"title":"Wilfa 레시피","doseG":15.0,"waterG":250.0,
         "grinderModelId":%d,"grindSettingValue":5,"grindSettingUnit":"NUMBER"}
        """.formatted(wilfa))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.grindMicronEstimated").doesNotExist());
  }

  @Test
  @DisplayName("AC-RECIPE-09 · unit이 MICRON이면 그라인더 없이도 값을 그대로 스냅샷에 넣는다")
  void unit이_MICRON이면_그라인더_없이_그대로_스냅샷에_넣는다() throws Exception {
    createRecipe(token(), """
        {"title":"마이크론 직접 입력","doseG":15.0,"waterG":250.0,
         "grindSettingValue":800,"grindSettingUnit":"MICRON"}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.grindMicronEstimated").value(800))
        .andExpect(jsonPath("$.grinderModelId").doesNotExist());
  }

  @Test
  @DisplayName("AC-RECIPE-41 · unit=MICRON에서 100은 허용된다")
  void MICRON_100은_허용된다() throws Exception {
    createRecipe(token(), """
        {"title":"하한","doseG":15.0,"waterG":250.0,"grindSettingValue":100,"grindSettingUnit":"MICRON"}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.grindMicronEstimated").value(100));
  }

  @Test
  @DisplayName("AC-RECIPE-42 · unit=MICRON에서 99는 거부된다")
  void MICRON_99는_거부된다() throws Exception {
    createRecipe(token(), """
        {"title":"하한 아래","doseG":15.0,"waterG":250.0,"grindSettingValue":99,"grindSettingUnit":"MICRON"}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-43 · unit=MICRON에서 2000은 허용된다")
  void MICRON_2000은_허용된다() throws Exception {
    createRecipe(token(), """
        {"title":"상한","doseG":15.0,"waterG":250.0,"grindSettingValue":2000,"grindSettingUnit":"MICRON"}
        """)
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.grindMicronEstimated").value(2000));
  }

  @Test
  @DisplayName("AC-RECIPE-44 · unit=MICRON에서 2001은 거부된다")
  void MICRON_2001은_거부된다() throws Exception {
    createRecipe(token(), """
        {"title":"상한 위","doseG":15.0,"waterG":250.0,"grindSettingValue":2001,"grindSettingUnit":"MICRON"}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-54 · 존재하지 않는 grinderModelId는 404다")
  void 존재하지_않는_그라인더_ID는_404다() throws Exception {
    createRecipe(token(), """
        {"title":"없는 그라인더","doseG":15.0,"waterG":250.0,
         "grinderModelId":999999,"grindSettingValue":22,"grindSettingUnit":"CLICK"}
        """)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-RECIPE-55 · 그라인더 범위를 벗어난 설정값은 거부된다")
  void 그라인더_범위_밖은_거부된다() throws Exception {
    Long c40 = grinderId("Comandante", "C40 MK4");
    createRecipe(token(), """
        {"title":"범위 밖","doseG":15.0,"waterG":250.0,
         "grinderModelId":%d,"grindSettingValue":51,"grindSettingUnit":"CLICK"}
        """.formatted(c40))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("GRIND_SETTING_OUT_OF_RANGE"));
  }

  @Test
  @DisplayName("AC-RECIPE-56 · unit이 CLICK인데 그라인더가 없으면 거부된다")
  void CLICK인데_그라인더가_없으면_거부된다() throws Exception {
    createRecipe(token(), """
        {"title":"그라인더 없음","doseG":15.0,"waterG":250.0,
         "grindSettingValue":22,"grindSettingUnit":"CLICK"}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-60 · 인증 없이 생성할 수 없다")
  void 인증_없이_생성할_수_없다() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/recipes")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"title":"익명","doseG":15.0,"waterG":250.0}
                    """))
        .andExpect(status().isUnauthorized());
  }
}
```

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: 컴파일 실패 (DTO·서비스·컨트롤러 없음).

- [x] **Step 3: DTO · 서비스 · 컨트롤러 작성**

```java
package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.GrindSettingUnit;
import com.kaldinote.recipe.domain.RecipeSourceType;
import com.kaldinote.recipe.domain.RecipeVisibility;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

public record CreateRecipeRequest(
    RecipeSourceType sourceType,
    @NotNull String title,
    String description,
    RecipeVisibility visibility,
    @NotNull BigDecimal doseG,
    @NotNull BigDecimal waterG,
    BigDecimal waterTempC,
    Integer totalTimeSeconds,
    Long brewerId,
    Long filterId,
    Long grinderModelId,
    BigDecimal grindSettingValue,
    GrindSettingUnit grindSettingUnit,
    @Valid List<StepRequest> steps) {

  public CreateRecipeRequest {
    if (steps == null) {
      steps = List.of();
    }
  }
}
```

```java
package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.Agitation;
import com.kaldinote.recipe.domain.PourTechnique;
import com.kaldinote.recipe.domain.StepType;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record StepRequest(
    @NotNull StepType stepType,
    @NotNull Integer startAtSeconds,
    @NotNull Integer durationSeconds,
    BigDecimal waterG,
    PourTechnique pourTechnique,
    Agitation agitation,
    String note) {}
```

```java
package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.Recipe;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

public record RecipeResponse(
    Long id,
    Long ownerUserId,
    String sourceType,
    String title,
    String description,
    String brewMethod,
    String visibility,
    BigDecimal doseG,
    BigDecimal waterG,
    BigDecimal ratio,
    BigDecimal waterTempC,
    Integer totalTimeSeconds,
    Long brewerId,
    Long filterId,
    Long grinderModelId,
    BigDecimal grindSettingValue,
    String grindSettingUnit,
    BigDecimal grindMicronEstimated,
    List<RecipeStepResponse> steps,
    Instant createdAt,
    Instant updatedAt) {

  private static final int DIVISION_SCALE = 6;
  private static final int RATIO_SCALE = 1;

  public static RecipeResponse from(Recipe r) {
    return new RecipeResponse(
        r.getId(),
        r.getOwnerUserId(),
        r.getSourceType().name(),
        r.getTitle(),
        r.getDescription(),
        r.getBrewMethod().name(),
        r.getVisibility().name(),
        r.getDoseG(),
        r.getWaterG(),
        ratio(r.getWaterG(), r.getDoseG()),
        r.getWaterTempC(),
        r.getTotalTimeSeconds(),
        r.getBrewerId(),
        r.getFilterId(),
        r.getGrinderModelId(),
        r.getGrindSettingValue(),
        r.getGrindSettingUnit() == null ? null : r.getGrindSettingUnit().name(),
        r.getGrindMicronEstimated(),
        RecipeStepResponse.listFrom(r.getSteps()),
        r.getCreatedAt(),
        r.getUpdatedAt());
  }

  private static BigDecimal ratio(BigDecimal waterG, BigDecimal doseG) {
    return waterG.divide(doseG, DIVISION_SCALE, RoundingMode.HALF_UP)
        .setScale(RATIO_SCALE, RoundingMode.HALF_UP);
  }
}
```

```java
package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.RecipeStep;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public record RecipeStepResponse(
    Integer stepOrder,
    String stepType,
    Integer startAtSeconds,
    Integer durationSeconds,
    BigDecimal waterG,
    BigDecimal cumulativeWaterG,
    String pourTechnique,
    String agitation,
    String note) {

  public static List<RecipeStepResponse> listFrom(List<RecipeStep> steps) {
    List<RecipeStepResponse> result = new ArrayList<>();
    BigDecimal cumulative = BigDecimal.ZERO.setScale(1);
    for (RecipeStep s : steps) {
      if (s.getWaterG() != null) {
        cumulative = cumulative.add(s.getWaterG());
      }
      result.add(
          new RecipeStepResponse(
              s.getStepOrder(),
              s.getStepType().name(),
              s.getStartAtSeconds(),
              s.getDurationSeconds(),
              s.getWaterG(),
              cumulative,
              s.getPourTechnique() == null ? null : s.getPourTechnique().name(),
              s.getAgitation() == null ? null : s.getAgitation().name(),
              s.getNote()));
    }
    return result;
  }
}
```

`RecipeService.java` — 이 태스크에서는 `create`와 `buildSteps`(검증 없이 순서만 부여), `computeGrindMicronEstimated`(전체 검증 포함)만 만든다:

```java
package com.kaldinote.recipe.application;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import com.kaldinote.gear.domain.GrinderModel;
import com.kaldinote.gear.infrastructure.GrinderModelRepository;
import com.kaldinote.grind.domain.GrindConverter;
import com.kaldinote.grind.domain.GrindSpec;
import com.kaldinote.recipe.domain.GrindSettingUnit;
import com.kaldinote.recipe.domain.Recipe;
import com.kaldinote.recipe.domain.RecipeStep;
import com.kaldinote.recipe.domain.RecipeVisibility;
import com.kaldinote.recipe.infrastructure.RecipeRepository;
import com.kaldinote.recipe.presentation.dto.CreateRecipeRequest;
import com.kaldinote.recipe.presentation.dto.RecipeResponse;
import com.kaldinote.recipe.presentation.dto.StepRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecipeService {

  private static final BigDecimal MICRON_MIN = new BigDecimal("100");
  private static final BigDecimal MICRON_MAX = new BigDecimal("2000");

  private final RecipeRepository recipeRepository;
  private final GrinderModelRepository grinderRepository;
  private final GrindConverter grindConverter = new GrindConverter();

  @Transactional
  public RecipeResponse create(Long userId, CreateRecipeRequest request) {
    BigDecimal micron =
        computeGrindMicronEstimated(
            request.grindSettingUnit(), request.grindSettingValue(), request.grinderModelId());

    List<RecipeStep> steps = buildSteps(request.steps());

    Recipe recipe =
        Recipe.create(
            userId,
            request.title(),
            request.description(),
            request.visibility() == null ? RecipeVisibility.PRIVATE : request.visibility(),
            request.doseG(),
            request.waterG(),
            request.waterTempC(),
            request.totalTimeSeconds(),
            request.brewerId(),
            request.filterId(),
            request.grinderModelId(),
            request.grindSettingValue(),
            request.grindSettingUnit(),
            micron);
    recipe.replaceSteps(steps);

    return RecipeResponse.from(recipeRepository.save(recipe));
  }

  private BigDecimal computeGrindMicronEstimated(
      GrindSettingUnit unit, BigDecimal value, Long grinderModelId) {
    if (unit == null) {
      return null;
    }
    if (value == null) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "grindSettingUnit이 있으면 grindSettingValue가 필요합니다.");
    }
    if (unit == GrindSettingUnit.MICRON) {
      if (value.compareTo(MICRON_MIN) < 0 || value.compareTo(MICRON_MAX) > 0) {
        throw new BusinessException(ErrorCode.INVALID_REQUEST, "MICRON 설정값은 100~2000 사이여야 합니다.");
      }
      return value.setScale(0, RoundingMode.HALF_UP);
    }

    // CLICK / NUMBER
    if (grinderModelId == null) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST, "grindSettingUnit이 CLICK/NUMBER이면 grinderModelId가 필요합니다.");
    }
    GrinderModel grinder =
        grinderRepository
            .findById(grinderModelId)
            .orElseThrow(
                () -> new BusinessException(ErrorCode.NOT_FOUND, "그라인더를 찾을 수 없습니다: " + grinderModelId));
    GrindSpec spec = grinder.toGrindSpec();
    if (!spec.convertible()) {
      return null; // 무단계 그라인더: 환산 불가 → 스냅샷 없이 성공 (AC-RECIPE-08)
    }
    return grindConverter.toMicron(spec, value); // 범위 밖이면 GrindSettingOutOfRangeException → 400
  }

  private List<RecipeStep> buildSteps(List<StepRequest> stepRequests) {
    List<RecipeStep> steps = new ArrayList<>();
    for (int i = 0; i < stepRequests.size(); i++) {
      StepRequest s = stepRequests.get(i);
      steps.add(
          RecipeStep.of(
              i + 1,
              s.stepType(),
              s.startAtSeconds(),
              s.durationSeconds(),
              s.waterG(),
              s.pourTechnique(),
              s.agitation(),
              s.note()));
    }
    return steps;
  }
}
```

```java
package com.kaldinote.recipe.presentation;

import com.kaldinote.common.security.AuthenticatedUser;
import com.kaldinote.recipe.application.RecipeService;
import com.kaldinote.recipe.presentation.dto.CreateRecipeRequest;
import com.kaldinote.recipe.presentation.dto.RecipeResponse;
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
@RequestMapping("/api/v1/recipes")
@RequiredArgsConstructor
@Tag(name = "레시피", description = "레시피 등록·조회·수정·삭제")
public class RecipeController {

  private final RecipeService recipeService;

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public RecipeResponse create(@Valid @RequestBody CreateRecipeRequest request, AuthenticatedUser user) {
    return recipeService.create(user.id(), request);
  }
}
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: PASS, 15 tests.

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 레시피 생성 API와 마이크론 스냅샷 계산 추가" && cd backend
```

---

## Task 3: 레시피 생성 — 입력 값 경계값 검증

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/recipe/presentation/dto/CreateRecipeRequest.java`, `StepRequest.java`
- Modify: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`

**Covers:** AC-RECIPE-20~40 (21개: doseG·waterG·waterTempC·totalTimeSeconds·스텝개수·title·description)

**Interfaces:**
- Consumes: Task 2의 `CreateRecipeRequest`, `StepRequest`, `createRecipe(token, body)` 테스트 헬퍼
- Produces: (없음 — Bean Validation 애노테이션만 추가. 새 타입 없음)

- [x] **Step 1: 실패하는 테스트 작성**

`RecipeControllerTest`에 아래 메서드를 추가한다. 패턴은 동일하다 — **하한 통과 / 하한-1 거부 / 상한 통과 / 상한+1 거부**를 각각 별도 `@Test`로 작성한다. 대표로 `doseG`와 `title` 그룹만 전체 코드를 보이고, 나머지는 스펙의 리터럴 값을 그대로 대입해 같은 패턴으로 작성한다.

```java
  @Test
  @DisplayName("AC-RECIPE-20 · doseG 1.0은 허용된다")
  void doseG_1_0은_허용된다() throws Exception {
    createRecipe(token(), """
        {"title":"하한","doseG":1.0,"waterG":250.0}
        """).andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-21 · doseG 0.9는 거부된다")
  void doseG_0_9는_거부된다() throws Exception {
    createRecipe(token(), """
        {"title":"하한 아래","doseG":0.9,"waterG":250.0}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-22 · doseG 200.0은 허용된다")
  void doseG_200_0은_허용된다() throws Exception {
    createRecipe(token(), """
        {"title":"상한","doseG":200.0,"waterG":3000.0}
        """).andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-23 · doseG 200.1은 거부된다")
  void doseG_200_1은_거부된다() throws Exception {
    createRecipe(token(), """
        {"title":"상한 위","doseG":200.1,"waterG":3000.0}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-36 · title 100자는 허용된다")
  void title_100자는_허용된다() throws Exception {
    String title = "가".repeat(100);
    createRecipe(token(), """
        {"title":"%s","doseG":15.0,"waterG":250.0}
        """.formatted(title)).andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-37 · title 101자는 거부된다")
  void title_101자는_거부된다() throws Exception {
    String title = "가".repeat(101);
    createRecipe(token(), """
        {"title":"%s","doseG":15.0,"waterG":250.0}
        """.formatted(title))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }

  @Test
  @DisplayName("AC-RECIPE-38 · 공백만인 title은 거부된다")
  void 공백만인_title은_거부된다() throws Exception {
    createRecipe(token(), """
        {"title":"   ","doseG":15.0,"waterG":250.0}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
  }
```

나머지 17개는 같은 패턴으로, 아래 표의 리터럴 값을 그대로 대입해 작성한다 (기본 바디는 `{"title":"경계값 테스트","doseG":15.0,"waterG":250.0,...}`에 해당 필드만 덮어쓴다):

| AC ID | 필드 | 값 | 기대 |
|---|---|---|---|
| AC-RECIPE-24 | waterG | `10.0` | 201 |
| AC-RECIPE-25 | waterG | `9.9` | 400 INVALID_REQUEST |
| AC-RECIPE-26 | waterG | `3000.0` (doseG=200.0과 함께) | 201 |
| AC-RECIPE-27 | waterG | `3000.1` | 400 INVALID_REQUEST |
| AC-RECIPE-28 | waterTempC | `60.0` | 201 |
| AC-RECIPE-29 | waterTempC | `59.9` | 400 INVALID_REQUEST |
| AC-RECIPE-30 | waterTempC | `100.0` | 201 |
| AC-RECIPE-31 | waterTempC | `100.1` | 400 INVALID_REQUEST |
| AC-RECIPE-32 | totalTimeSeconds | `3600` | 201 |
| AC-RECIPE-33 | totalTimeSeconds | `3601` | 400 INVALID_REQUEST |
| AC-RECIPE-34 | steps | POUR 30개, 각 waterG=10.0, 합계 300.0(waterG=300.0), 안 겹치게 순차 배치 | 201, 스텝 30개 |
| AC-RECIPE-35 | steps | 위 31개로 확장 | 400 INVALID_REQUEST |
| AC-RECIPE-39 | description | 2000자 | 201 |
| AC-RECIPE-40 | description | 2001자 | 400 INVALID_REQUEST |

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: 새로 추가한 21개 중 대부분이 FAIL — DTO에 범위 애노테이션이 없어 400이어야 할 요청이 201로 통과하거나, 201이어야 할 요청이 통과하되 검증이 없어 의미가 없다.

- [x] **Step 3: DTO에 경계값 애노테이션 추가**

`CreateRecipeRequest.java`를 아래처럼 바꾼다 (필드 순서는 유지, 애노테이션만 추가):

```java
package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.GrindSettingUnit;
import com.kaldinote.recipe.domain.RecipeSourceType;
import com.kaldinote.recipe.domain.RecipeVisibility;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public record CreateRecipeRequest(
    RecipeSourceType sourceType,
    @NotBlank @Size(max = 100) String title,
    @Size(max = 2000) String description,
    RecipeVisibility visibility,
    @NotNull @DecimalMin("1.0") @DecimalMax("200.0") BigDecimal doseG,
    @NotNull @DecimalMin("10.0") @DecimalMax("3000.0") BigDecimal waterG,
    @DecimalMin("60.0") @DecimalMax("100.0") BigDecimal waterTempC,
    @Min(1) @Max(3600) Integer totalTimeSeconds,
    Long brewerId,
    Long filterId,
    Long grinderModelId,
    BigDecimal grindSettingValue,
    GrindSettingUnit grindSettingUnit,
    @Valid @Size(max = 30) List<StepRequest> steps) {

  public CreateRecipeRequest {
    if (steps == null) {
      steps = List.of();
    }
  }
}
```

`StepRequest.java`에 범위 애노테이션 추가:

```java
package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.Agitation;
import com.kaldinote.recipe.domain.PourTechnique;
import com.kaldinote.recipe.domain.StepType;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record StepRequest(
    @NotNull StepType stepType,
    @NotNull @Min(0) @Max(3600) Integer startAtSeconds,
    @NotNull @Min(0) @Max(3600) Integer durationSeconds,
    @DecimalMin("0.0") @DecimalMax("3000.0") BigDecimal waterG,
    PourTechnique pourTechnique,
    Agitation agitation,
    @Size(max = 500) String note) {}
```

> `@NotBlank`는 트림한 뒤 길이 0을 실패로 본다 — AC-RECIPE-38("   ")이 이 애노테이션 하나로 해결된다. 커스텀 코드가 필요 없다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: PASS, 36 tests (Task 2의 15개 + Task 3의 21개).

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 레시피 생성 입력 값 경계 검증 추가" && cd backend
```

---

## Task 4: 레시피 생성 — 스텝 시퀀스 검증 + 나머지 에러

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/common/error/ErrorCode.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Modify: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`

**Covers:** AC-RECIPE-45, 46, 47, 48, 50, 51, 52, 53, 57

**Interfaces:**
- Consumes: Task 2의 `RecipeService.buildSteps`(확장 대상), `BrewerRepository`(Plan 1 `gear`)
- Produces: `ErrorCode.RECIPE_STEP_WATER_MISMATCH`, `RECIPE_STEP_OVERLAP`, `RECIPE_STEP_WATER_INVALID` (신설)

- [x] **Step 1: 실패하는 테스트 작성**

`RecipeControllerTest`에 추가:

```java
  @Test
  @DisplayName("AC-RECIPE-45 · 앞 스텝이 끝나는 순간 다음 스텝이 시작하면 허용된다")
  void 경계_접촉은_허용된다() throws Exception {
    createRecipe(token(), """
        {"title":"경계 접촉","doseG":15.0,"waterG":120.0,"steps":[
          {"stepType":"POUR","startAtSeconds":0,"durationSeconds":30,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":30,"durationSeconds":10,"waterG":60.0}
        ]}
        """).andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-46 · 1초라도 겹치면 거부된다")
  void 1초_겹치면_거부된다() throws Exception {
    createRecipe(token(), """
        {"title":"겹침","doseG":15.0,"waterG":120.0,"steps":[
          {"stepType":"POUR","startAtSeconds":0,"durationSeconds":30,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":29,"durationSeconds":10,"waterG":60.0}
        ]}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("RECIPE_STEP_OVERLAP"));
  }

  @Test
  @DisplayName("AC-RECIPE-47 · 스텝 사이의 빈 구간은 허용된다")
  void 빈_구간은_허용된다() throws Exception {
    createRecipe(token(), """
        {"title":"빈 구간","doseG":15.0,"waterG":120.0,"steps":[
          {"stepType":"POUR","startAtSeconds":0,"durationSeconds":10,"waterG":60.0},
          {"stepType":"POUR","startAtSeconds":45,"durationSeconds":10,"waterG":60.0}
        ]}
        """).andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-48 · totalTimeSeconds가 마지막 스텝 종료보다 작아도 허용된다")
  void totalTime이_스텝_종료보다_작아도_허용된다() throws Exception {
    createRecipe(token(), """
        {"title":"짧은 목표시간","doseG":15.0,"waterG":60.0,"totalTimeSeconds":160,"steps":[
          {"stepType":"POUR","startAtSeconds":165,"durationSeconds":10,"waterG":60.0}
        ]}
        """).andExpect(status().isCreated());
  }

  @Test
  @DisplayName("AC-RECIPE-50 · 스텝 물량 합계가 총 물량과 다르면 거부된다")
  void 스텝_물량_합계가_다르면_거부된다() throws Exception {
    createRecipe(token(), """
        {"title":"합계 불일치","doseG":15.0,"waterG":300.0,"steps":[
          {"stepType":"POUR","startAtSeconds":0,"durationSeconds":10,"waterG":290.0}
        ]}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("RECIPE_STEP_WATER_MISMATCH"));
  }

  @Test
  @DisplayName("AC-RECIPE-51 · 붓지 않는 스텝에 물량이 있으면 거부된다")
  void 붓지_않는_스텝에_물량이_있으면_거부된다() throws Exception {
    createRecipe(token(), """
        {"title":"잘못된 SWIRL","doseG":15.0,"waterG":50.0,"steps":[
          {"stepType":"SWIRL","startAtSeconds":0,"durationSeconds":5,"waterG":50.0}
        ]}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("RECIPE_STEP_WATER_INVALID"));
  }

  @Test
  @DisplayName("AC-RECIPE-52 · 붓는 스텝에 물량이 0이면 거부된다")
  void 붓는_스텝_물량이_0이면_거부된다() throws Exception {
    createRecipe(token(), """
        {"title":"물량 0인 POUR","doseG":15.0,"waterG":0.0,"steps":[
          {"stepType":"POUR","startAtSeconds":0,"durationSeconds":5,"waterG":0}
        ]}
        """)
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("RECIPE_STEP_WATER_INVALID"));
  }

  @Test
  @DisplayName("AC-RECIPE-53 · 존재하지 않는 brewerId는 404다")
  void 존재하지_않는_brewerId는_404다() throws Exception {
    createRecipe(token(), """
        {"title":"없는 브루어","doseG":15.0,"waterG":250.0,"brewerId":999999}
        """)
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-RECIPE-57 · 일반 API로 CURATED 레시피를 만들 수 없다")
  void CURATED_레시피는_만들_수_없다() throws Exception {
    createRecipe(token(), """
        {"title":"관리자용","doseG":15.0,"waterG":250.0,"sourceType":"CURATED"}
        """)
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }
```

> AC-RECIPE-52의 `waterG`는 레시피 총 물량도 `0.0`으로 맞춰 물량 합계 검증(AC-50)이 아니라 스텝 타입 검증(AC-52)만 걸리게 한다. 두 조건을 동시에 위반하지 않아야 어떤 에러가 어떤 조건 때문인지 테스트가 명확해진다.

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: 9개 신규 테스트 FAIL — `RECIPE_STEP_*` 에러 코드가 없어 컴파일 실패(`ErrorCode`에 상수 없음) 또는 검증 로직이 없어 항상 201.

- [x] **Step 3: ErrorCode 추가 + RecipeService 검증 로직 확장**

`ErrorCode.java`에 3개 추가 (기존 상수는 그대로 둔다):

```java
  // 레시피 — docs/specs/2026-08-16-recipe-crud.md
  RECIPE_STEP_WATER_MISMATCH(HttpStatus.BAD_REQUEST, "스텝 물량 합계가 레시피 총 물량과 다릅니다."),
  RECIPE_STEP_OVERLAP(HttpStatus.BAD_REQUEST, "앞 스텝과 시간이 겹칩니다."),
  RECIPE_STEP_WATER_INVALID(HttpStatus.BAD_REQUEST, "스텝 타입과 물량이 맞지 않습니다.");
```

`RecipeService.java`에서 `create` 메서드 시작 부분과 `buildSteps`를 아래처럼 바꾼다 (그 외 메서드는 그대로):

```java
  private final BrewerRepository brewerRepository; // 필드 추가, 생성자는 @RequiredArgsConstructor가 갱신

  @Transactional
  public RecipeResponse create(Long userId, CreateRecipeRequest request) {
    if (request.sourceType() != null && request.sourceType() != RecipeSourceType.USER) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "일반 API로는 CURATED 레시피를 만들 수 없습니다.");
    }
    requireExists(request.brewerId(), brewerRepository::existsById, "브루어");

    BigDecimal micron =
        computeGrindMicronEstimated(
            request.grindSettingUnit(), request.grindSettingValue(), request.grinderModelId());

    List<RecipeStep> steps = buildSteps(request.steps(), request.waterG());

    Recipe recipe =
        Recipe.create(
            userId,
            request.title(),
            request.description(),
            request.visibility() == null ? RecipeVisibility.PRIVATE : request.visibility(),
            request.doseG(),
            request.waterG(),
            request.waterTempC(),
            request.totalTimeSeconds(),
            request.brewerId(),
            request.filterId(),
            request.grinderModelId(),
            request.grindSettingValue(),
            request.grindSettingUnit(),
            micron);
    recipe.replaceSteps(steps);

    return RecipeResponse.from(recipeRepository.save(recipe));
  }

  private void requireExists(Long id, java.util.function.Predicate<Long> existsById, String label) {
    if (id != null && !existsById.test(id)) {
      throw new BusinessException(ErrorCode.NOT_FOUND, label + "를 찾을 수 없습니다: " + id);
    }
  }

  private List<RecipeStep> buildSteps(List<StepRequest> stepRequests, BigDecimal totalWaterG) {
    List<RecipeStep> steps = new ArrayList<>();
    BigDecimal sum = BigDecimal.ZERO;

    for (int i = 0; i < stepRequests.size(); i++) {
      StepRequest s = stepRequests.get(i);
      validateStepWater(s);

      if (i > 0) {
        StepRequest prev = stepRequests.get(i - 1);
        int prevEnd = prev.startAtSeconds() + prev.durationSeconds();
        if (prevEnd > s.startAtSeconds()) {
          throw new BusinessException(ErrorCode.RECIPE_STEP_OVERLAP);
        }
      }

      if (s.waterG() != null) {
        sum = sum.add(s.waterG());
      }
      steps.add(
          RecipeStep.of(
              i + 1,
              s.stepType(),
              s.startAtSeconds(),
              s.durationSeconds(),
              s.waterG(),
              s.pourTechnique(),
              s.agitation(),
              s.note()));
    }

    if (!stepRequests.isEmpty() && sum.compareTo(totalWaterG) != 0) {
      throw new BusinessException(ErrorCode.RECIPE_STEP_WATER_MISMATCH);
    }
    return steps;
  }

  private void validateStepWater(StepRequest s) {
    boolean pours = s.stepType() == StepType.BLOOM || s.stepType() == StepType.POUR;
    boolean hasPositiveWater = s.waterG() != null && s.waterG().compareTo(BigDecimal.ZERO) > 0;
    if (pours && !hasPositiveWater) {
      throw new BusinessException(ErrorCode.RECIPE_STEP_WATER_INVALID, "붓는 스텝은 물량이 0보다 커야 합니다.");
    }
    if (!pours && hasPositiveWater) {
      throw new BusinessException(ErrorCode.RECIPE_STEP_WATER_INVALID, "붓지 않는 스텝에는 물량을 넣을 수 없습니다.");
    }
  }
```

`import com.kaldinote.gear.infrastructure.BrewerRepository;`, `com.kaldinote.recipe.domain.RecipeSourceType;`, `com.kaldinote.recipe.domain.StepType;`를 추가한다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: PASS, 45 tests (Task 2~4 누적).

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 스텝 시퀀스 검증과 나머지 생성 에러 추가" && cd backend
```

---

## Task 5: 레시피 단건 조회 API

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/presentation/RecipeController.java`
- Modify: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`

**Covers:** AC-RECIPE-05, 06, 61

**Interfaces:**
- Consumes: Task 1의 `RecipeRepository#findByIdAndDeletedAtIsNull`
- Produces: `RecipeService#get(Long userId, Long recipeId) → RecipeResponse`, `RecipeService#findOwned(Long, Long) → Recipe`(비공개 헬퍼, Task 6·7이 재사용), `GET /api/v1/recipes/{id}`

> **구현 노트 — 소유자가 아닌 조회:** 스펙은 "이 스펙의 조회 인수 조건은 전부 소유자 기준"이라고만 밝히고 타인의 접근을 별도로 규정하지 않는다(공개범위 판정은 후속 스펙). 안전한 기본값으로 **소유자가 아니면 403**을 반환하도록 구현한다 — PUT/DELETE와 동일한 `findOwned`를 재사용하면 자연히 이렇게 된다. 이 동작은 스펙에 명시된 AC가 아니므로 테스트에 AC ID를 붙이지 않는다.

- [x] **Step 1: 실패하는 테스트 작성**

```java
  private String createAndGetLocation(String token, String body) throws Exception {
    // 응답 바디에서 id를 뽑아 문자열로 반환한다.
    String response =
        createRecipe(token, body).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    return com.jayway.jsonpath.JsonPath.read(response, "$.id").toString();
  }

  @Test
  @DisplayName("AC-RECIPE-05 · 조회 응답의 ratio는 waterG ÷ doseG를 소수 1자리로 반올림한 값이다")
  void ratio는_소수_1자리로_반올림된다() throws Exception {
    String token = token();
    String id =
        createAndGetLocation(token, """
            {"title":"비율 확인","doseG":18.0,"waterG":300.0}
            """);

    mockMvc
        .perform(get("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.ratio").value(16.7));
  }

  @Test
  @DisplayName("AC-RECIPE-06 · 조회 응답의 스텝별 cumulativeWaterG가 누적합이다")
  void cumulativeWaterG는_누적합이다() throws Exception {
    String token = token();
    String id =
        createAndGetLocation(token, """
            {"title":"누적 물량","doseG":20.0,"waterG":300.0,"steps":[
              {"stepType":"BLOOM","startAtSeconds":0,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":45,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":90,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":135,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":165,"durationSeconds":10,"waterG":60.0}
            ]}
            """);

    mockMvc
        .perform(get("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.steps[0].cumulativeWaterG").value(60.0))
        .andExpect(jsonPath("$.steps[1].cumulativeWaterG").value(120.0))
        .andExpect(jsonPath("$.steps[2].cumulativeWaterG").value(180.0))
        .andExpect(jsonPath("$.steps[3].cumulativeWaterG").value(240.0))
        .andExpect(jsonPath("$.steps[4].cumulativeWaterG").value(300.0));
  }

  @Test
  @DisplayName("AC-RECIPE-61 · 존재하지 않는 레시피 조회는 404다")
  void 존재하지_않는_레시피_조회는_404다() throws Exception {
    mockMvc
        .perform(get("/api/v1/recipes/999999").header(HttpHeaders.AUTHORIZATION, token()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }
```

`import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;`를 파일 상단에 추가한다.

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: 컴파일 실패 (`GET /api/v1/recipes/{id}` 없음).

- [x] **Step 3: 서비스 · 컨트롤러에 조회 추가**

`RecipeService.java`에 추가:

```java
  public RecipeResponse get(Long userId, Long recipeId) {
    return RecipeResponse.from(findOwned(userId, recipeId));
  }

  private Recipe findOwned(Long userId, Long recipeId) {
    Recipe recipe =
        recipeRepository
            .findByIdAndDeletedAtIsNull(recipeId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "레시피를 찾을 수 없습니다: " + recipeId));
    if (!recipe.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 레시피만 접근할 수 있습니다.");
    }
    return recipe;
  }
```

`RecipeController.java`에 추가:

```java
  @GetMapping("/{id}")
  public RecipeResponse get(@PathVariable Long id, AuthenticatedUser user) {
    return recipeService.get(user.id(), id);
  }
```

`import org.springframework.web.bind.annotation.GetMapping;`, `PathVariable;`를 추가한다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: PASS, 48 tests.

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 레시피 단건 조회 API 추가" && cd backend
```

---

## Task 6: 레시피 수정 API (PUT)

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/recipe/presentation/dto/UpdateRecipeRequest.java` (신규 생성)
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/presentation/RecipeController.java`
- Modify: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`

**Covers:** AC-RECIPE-10, 58

**Interfaces:**
- Consumes: Task 4의 `buildSteps`/`computeGrindMicronEstimated`/`requireExists`, Task 5의 `findOwned`
- Produces: `RecipeService#update(Long userId, Long recipeId, UpdateRecipeRequest request) → RecipeResponse`, `PUT /api/v1/recipes/{id}`

- [x] **Step 1: 실패하는 테스트 작성**

```java
  @Test
  @DisplayName("AC-RECIPE-10 · PUT은 스텝을 통째로 교체한다")
  void PUT은_스텝을_통째로_교체한다() throws Exception {
    String token = token();
    String id =
        createAndGetLocation(token, """
            {"title":"교체 전","doseG":20.0,"waterG":300.0,"steps":[
              {"stepType":"BLOOM","startAtSeconds":0,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":45,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":90,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":135,"durationSeconds":10,"waterG":60.0},
              {"stepType":"POUR","startAtSeconds":165,"durationSeconds":10,"waterG":60.0}
            ]}
            """);

    mockMvc
        .perform(
            put("/api/v1/recipes/{id}", id)
                .header(HttpHeaders.AUTHORIZATION, token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"title":"교체 후","doseG":20.0,"waterG":300.0,"steps":[
                      {"stepType":"BLOOM","startAtSeconds":0,"durationSeconds":30,"waterG":150.0},
                      {"stepType":"POUR","startAtSeconds":60,"durationSeconds":30,"waterG":150.0}
                    ]}
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.steps.length()").value(2))
        .andExpect(jsonPath("$.steps[0].stepOrder").value(1))
        .andExpect(jsonPath("$.steps[1].stepOrder").value(2));
  }

  @Test
  @DisplayName("AC-RECIPE-58 · 남의 레시피를 수정할 수 없다")
  void 남의_레시피를_수정할_수_없다() throws Exception {
    String ownerToken = token();
    String id =
        createAndGetLocation(ownerToken, """
            {"title":"A의 레시피","doseG":15.0,"waterG":250.0}
            """);

    mockMvc
        .perform(
            put("/api/v1/recipes/{id}", id)
                .header(HttpHeaders.AUTHORIZATION, otherUserToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"title":"B가 수정 시도","doseG":15.0,"waterG":250.0}
                    """))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }
```

`import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;`를 추가한다.

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: 컴파일 실패 (`UpdateRecipeRequest`, `PUT /api/v1/recipes/{id}` 없음).

- [x] **Step 3: DTO · 서비스 · 컨트롤러에 수정 추가**

`UpdateRecipeRequest.java` — `CreateRecipeRequest`와 동일하되 `sourceType` 필드가 없다(수정 API로는 출처를 바꿀 수 없다):

```java
package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.GrindSettingUnit;
import com.kaldinote.recipe.domain.RecipeVisibility;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public record UpdateRecipeRequest(
    @NotBlank @Size(max = 100) String title,
    @Size(max = 2000) String description,
    RecipeVisibility visibility,
    @NotNull @DecimalMin("1.0") @DecimalMax("200.0") BigDecimal doseG,
    @NotNull @DecimalMin("10.0") @DecimalMax("3000.0") BigDecimal waterG,
    @DecimalMin("60.0") @DecimalMax("100.0") BigDecimal waterTempC,
    @Min(1) @Max(3600) Integer totalTimeSeconds,
    Long brewerId,
    Long filterId,
    Long grinderModelId,
    BigDecimal grindSettingValue,
    GrindSettingUnit grindSettingUnit,
    @Valid @Size(max = 30) List<StepRequest> steps) {

  public UpdateRecipeRequest {
    if (steps == null) {
      steps = List.of();
    }
  }
}
```

`RecipeService.java`에 추가 — `RecipeStepRepository` 필드를 새로 주입한다:

```java
  private final RecipeStepRepository recipeStepRepository; // 생성자 주입 필드 추가

  @Transactional
  public RecipeResponse update(Long userId, Long recipeId, UpdateRecipeRequest request) {
    Recipe recipe = findOwned(userId, recipeId);

    requireExists(request.brewerId(), brewerRepository::existsById, "브루어");

    BigDecimal micron =
        computeGrindMicronEstimated(
            request.grindSettingUnit(), request.grindSettingValue(), request.grinderModelId());
    List<RecipeStep> steps = buildSteps(request.steps(), request.waterG());

    recipe.applyUpdate(
        request.title(),
        request.description(),
        request.visibility() == null ? RecipeVisibility.PRIVATE : request.visibility(),
        request.doseG(),
        request.waterG(),
        request.waterTempC(),
        request.totalTimeSeconds(),
        request.brewerId(),
        request.filterId(),
        request.grinderModelId(),
        request.grindSettingValue(),
        request.grindSettingUnit(),
        micron);

    // UNIQUE(recipe_id, step_order) 위반을 피하려면 기존 스텝을 지우고 flush한 뒤 새로 넣는다.
    // clear()+addAll()만 하면 Hibernate가 insert를 delete보다 먼저 실행해 유니크 제약에 걸린다.
    recipeStepRepository.deleteAllByRecipe(recipe);
    recipeStepRepository.flush();
    recipe.getSteps().clear();
    recipe.replaceSteps(steps);

    return RecipeResponse.from(recipe);
  }
```

`RecipeController.java`에 추가:

```java
  @PutMapping("/{id}")
  public RecipeResponse update(
      @PathVariable Long id, @Valid @RequestBody UpdateRecipeRequest request, AuthenticatedUser user) {
    return recipeService.update(user.id(), id, request);
  }
```

`import org.springframework.web.bind.annotation.PutMapping;`를 추가한다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: PASS, 50 tests.

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 레시피 수정 API 추가" && cd backend
```

---

## Task 7: 레시피 삭제 API (DELETE)

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/presentation/RecipeController.java`
- Modify: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`

**Covers:** AC-RECIPE-11, 12, 59

**Interfaces:**
- Consumes: Task 5의 `findOwned`, `Recipe#softDelete()`(Task 1)
- Produces: `RecipeService#delete(Long userId, Long recipeId) → void`, `DELETE /api/v1/recipes/{id}`

- [x] **Step 1: 실패하는 테스트 작성**

```java
  @Test
  @DisplayName("AC-RECIPE-11 · 삭제하면 소유자도 조회할 수 없다")
  void 삭제하면_소유자도_조회할_수_없다() throws Exception {
    String token = token();
    String id = createAndGetLocation(token, """
        {"title":"삭제될 레시피","doseG":15.0,"waterG":250.0}
        """);

    mockMvc
        .perform(delete("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(get("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-RECIPE-12 · 이미 삭제된 레시피를 다시 삭제하면 404다")
  void 이미_삭제된_레시피_재삭제는_404다() throws Exception {
    String token = token();
    String id = createAndGetLocation(token, """
        {"title":"두 번 삭제","doseG":15.0,"waterG":250.0}
        """);
    mockMvc.perform(delete("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(delete("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, token))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  @DisplayName("AC-RECIPE-59 · 남의 레시피를 삭제할 수 없다")
  void 남의_레시피를_삭제할_수_없다() throws Exception {
    String ownerToken = token();
    String id = createAndGetLocation(ownerToken, """
        {"title":"A의 레시피","doseG":15.0,"waterG":250.0}
        """);

    mockMvc
        .perform(delete("/api/v1/recipes/{id}", id).header(HttpHeaders.AUTHORIZATION, otherUserToken()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }
```

`import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;`를 추가한다.

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: 컴파일 실패 (`DELETE /api/v1/recipes/{id}` 없음).

- [x] **Step 3: 서비스 · 컨트롤러에 삭제 추가**

`RecipeService.java`에 추가:

```java
  @Transactional
  public void delete(Long userId, Long recipeId) {
    Recipe recipe = findOwned(userId, recipeId);
    recipe.softDelete();
  }
```

`RecipeController.java`에 추가:

```java
  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable Long id, AuthenticatedUser user) {
    recipeService.delete(user.id(), id);
  }
```

`import org.springframework.web.bind.annotation.DeleteMapping;`를 추가한다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: PASS, 53 tests.

- [x] **Step 5: 스펙 status 전환 + 전체 검증**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && ./scripts/check-spec-coverage.sh
```

`docs/specs/2026-08-16-recipe-crud.md`의 frontmatter `status: 초안` → `status: 구현완료`로 변경.

- [x] **Step 6: 커밋**

```bash
cd backend && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 레시피 삭제 API 추가, 레시피 스펙 구현완료 전환" && cd backend
```

---

## 완료 기준

- [x] `cd backend && ./gradlew clean check` 통과
- [x] `./scripts/check-spec-coverage.sh` 통과 — `docs/specs/2026-08-16-recipe-crud.md` AC 53개 전부 확인
- [x] 스펙의 `status`를 `구현완료`로 변경
- [x] Swagger UI(`http://localhost:8080/swagger-ui.html`)에서 스펙의 Kasuya 4:6 예시를 그대로 등록하고, 응답의 `steps` 배열이 타이머 UI를 만들 수 있을 만큼의 정보(시각·지속시간·누적 물량)를 담고 있는지 눈으로 확인 (스펙의 「수동 확인」 항목) — `bootRun` + curl로 확인, 스펙 응답 예시와 정확히 일치

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 53개 중 53개가 태스크에 매핑됨.

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음.

**타입 일관성:** `RecipeService`가 Task 2~7에 걸쳐 필드(`brewerId` 존재 확인, `RecipeStepRepository`)를 점진적으로 추가하지만, 메서드 시그니처(`create`/`get`/`update`/`delete`)와 DTO 필드명은 한 번 정해지면 바뀌지 않는다. `RecipeResponse`/`RecipeStepResponse`는 Task 2에서 확정해 이후 태스크가 그대로 재사용한다.

**검증되지 않은 가정:**
- `CreateRecipeRequest`의 `steps` 필드가 요청에서 완전히 생략됐을 때 Jackson이 레코드 컴팩트 생성자에 `null`을 넘겨 `steps = List.of()`로 대체되는지는 Task 2에서 실제로 확인해야 한다. Jackson이 필드를 생략된 것으로 보고 생성자를 아예 다른 방식으로 호출한다면(예: 기본값 없이 실패) 별도 `@JsonCreator` 처리가 필요할 수 있다.
- Task 6의 PUT 스텝 교체(`deleteAllByRecipe` + `flush` + `clear` + `replaceSteps`) 순서가 실제로 유니크 제약 위반을 피하는지는 AC-RECIPE-10 테스트 자체가 검증한다 — 이 테스트가 초록이 되지 않으면 순서를 다시 조정해야 한다.
- GET의 "소유자 아니면 403" 처리(AC 없음, Task 5의 구현 노트 참조)는 이후 공개범위 인가 스펙이 작성되면 FRIENDS/PUBLIC 조건을 반영해 다시 열어야 한다. 지금은 의도적으로 가장 보수적인 기본값을 쓴다.
- Task 5의 테스트 헬퍼가 `com.jayway.jsonpath.JsonPath.read(...)`로 생성 응답의 `id`를 뽑는다. `spring-boot-starter-webmvc-test`가 이 라이브러리를 전이 의존성으로 가져오는지는 Boot 3 기준 추정이다 — Task 5 Step 2에서 컴파일 자체가 안 되면(클래스 없음) `ObjectMapper`를 `@Autowired`로 받아 `objectMapper.readTree(response).get("id").asText()`로 대체한다.


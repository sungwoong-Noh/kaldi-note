# 레시피/잔 재설계 — 데이터 모델과 마이그레이션 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-20-recipe-v2-data-model.md`

**Goal:** 레시피에 `temperatureType`·`recommendedRoastLevel`·`sourceAuthorName`이 생기고, `savedCount`·
`brewCount`가 조회 응답에 파생 계산돼 실리며, `POST /brew-logs`가 남의(가시성 있는) 레시피로도
브루잉을 허용하면서 매번 `recipeSnapshot`을 고정해 저장한다. 프론트가 다음 스펙에서 이 데이터를
바로 쓸 수 있는 상태가 된다.

**Architecture:** 마이그레이션 3개(V13 레시피 필드, V14 `brew_logs` 스키마 변경, V15 기존 브루로그
SQL 백필)로 스키마를 순서대로 바꾼다. `POST /brew-logs`의 레시피 접근 판정은 새로 만들지 않고
`RecipeService.requireViewable`(이미 존재, 소유자→PUBLIC→FRIENDS 순으로 판정)을 반환형만 `Recipe`로
바꿔 재사용한다 — 로직을 두 곳에 두면 갈라진다. `recipeSnapshot`은 Hibernate의 네이티브 JSON
매핑(`@JdbcTypeCode(SqlTypes.JSON)`)을 이 프로젝트에서 처음 쓴다 — 검증되지 않은 가정으로 Task 4에
남겨둔다.

**작업 위치:** `backend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-RECIPEV2-01 | temperatureType 지정 저장 | Task 1 | API 테스트 |
| AC-RECIPEV2-02 | temperatureType 생략 → HOT | Task 1 | API 테스트 |
| AC-RECIPEV2-03 | recommendedRoastLevel 지정 저장 | Task 1 | API 테스트 |
| AC-RECIPEV2-04 | recommendedRoastLevel 생략 → MEDIUM | Task 1 | API 테스트 |
| AC-RECIPEV2-05 | PATCH로 temperatureType 단독 수정 | Task 1 | API 테스트 |
| AC-RECIPEV2-06 | PATCH로 recommendedRoastLevel 단독 수정 | Task 1 | API 테스트 |
| AC-RECIPEV2-07 | savedCount 0건 | Task 2 | API 테스트 |
| AC-RECIPEV2-08 | savedCount N건 | Task 2 | API 테스트 |
| AC-RECIPEV2-09 | 포크본 삭제 시 savedCount 즉시 감소 | Task 2 | API 테스트 |
| AC-RECIPEV2-10 | brewCount 소유자 본인 사용 카운트 | Task 2 | API 테스트 |
| AC-RECIPEV2-11 | 남이 바로 내리면 brewCount 불변 | Task 2 (검증만, Task 5 구현 이후) | API 테스트 |
| AC-RECIPEV2-12 | CURATED 포크 시 sourceAuthorName=authorName | Task 3 | API 테스트 |
| AC-RECIPEV2-13 | USER 포크 시 sourceAuthorName=원본 소유자 닉네임 | Task 3 | API 테스트 |
| AC-RECIPEV2-14 | 포크 후 원본 닉네임 변경돼도 불변 | Task 3 | API 테스트 |
| AC-RECIPEV2-15 | 내 소유 레시피로 브루 → recipeId 유지 | Task 5 | API 테스트 |
| AC-RECIPEV2-16 | 남의 PUBLIC 레시피로 브루 → recipeId null | Task 5 | API 테스트 |
| AC-RECIPEV2-17 | 맞팔로우 FRIENDS 레시피로 브루 가능 | Task 5 | API 테스트 |
| AC-RECIPEV2-18 | recipeSnapshot.doseG = 브루 시점 값 | Task 5 | API 테스트 |
| AC-RECIPEV2-19 | 레시피 수정해도 기존 스냅샷 불변 | Task 5 | API 테스트 |
| AC-RECIPEV2-20 | recipeSnapshot.steps 순서대로 | Task 5 | API 테스트 |
| AC-RECIPEV2-21 | recipeSnapshot.grindValue={value,unit} | Task 5 | API 테스트 |
| AC-RECIPEV2-30 | 5단계 roast 값 거절 | Task 1 | API 테스트 |
| AC-RECIPEV2-31 | 마이그레이션 후 기존 레시피 HOT/MEDIUM | Task 1 | 통합 테스트 |
| AC-RECIPEV2-32 | 마이그레이션 후 기존 브루로그 recipeSnapshot 채움 | Task 4 | 통합 테스트 |
| AC-RECIPEV2-40 | 잘못된 temperatureType → 400 | Task 1 | API 테스트 |
| AC-RECIPEV2-41 | recipeId 생략 → 400 (기존 유지) | Task 5 | API 테스트 |
| AC-RECIPEV2-42 | 가시성 없는 레시피 → 403 | Task 5 | API 테스트 |
| AC-RECIPEV2-43 | 존재하지 않는 recipeId → 404 (기존 유지) | Task 5 | API 테스트 |

---

## Global Constraints

- 프론트 변경 0건. 이번 계획은 `backend/`만 건드린다.
- 적용된 Flyway 파일은 수정하지 않는다 — `V13`·`V14`·`V15`를 새로 추가한다(`V12`가 마지막).
- `RecipeRoastLevel`은 `catalog.RoastLevel`(5단계, `BeanProduct` 소유)과 완전히 분리된
  `recipe.domain` 소속 enum이다. 절대 재사용하지 않는다.
- `POST /recipes`·`PATCH /recipes/{id}` 요청에 `temperatureType`·`recommendedRoastLevel`이
  없어도 400이 아니라 기본값(`HOT`/`MEDIUM`)으로 저장된다 — 기존 프론트가 깨지지 않아야 한다.
- `brew_logs.recipe_id`가 `nullable`이 돼도 `POST /brew-logs` 요청 바디의 `recipeId`는 여전히
  `@NotNull`이다(변경 없음). nullable은 **저장값**에만 적용된다.
- `savedCount`·`brewCount`는 컬럼을 추가하지 않는다. 목록 API(`GET /recipes`)는 건드리지 않는다
  — `GET /recipes/{id}` 단건 응답에만 싣는다.

## File Structure

```
backend/src/main/
├── resources/db/migration/
│   ├── V13__add_recipe_temperature_roast.sql       (신규)
│   ├── V14__alter_brew_logs_snapshot.sql           (신규)
│   └── V15__backfill_brew_log_snapshot.sql         (신규)
└── java/com/kaldinote/
    ├── recipe/domain/
    │   ├── RecipeTemperatureType.java              (신규) HOT/ICE
    │   ├── RecipeRoastLevel.java                   (신규) LIGHT/MEDIUM/DARK
    │   └── Recipe.java                             (수정) 필드 3개 + forkFrom 시그니처 변경
    ├── recipe/application/RecipeService.java       (수정) requireViewable 반환형, savedCount/brewCount, fork
    ├── recipe/infrastructure/RecipeRepository.java (수정) countByParentRecipeId
    ├── recipe/presentation/dto/
    │   ├── CreateRecipeRequest.java                 (수정)
    │   ├── UpdateRecipeRequest.java                  (수정)
    │   └── RecipeResponse.java                       (수정)
    ├── brewlog/domain/
    │   ├── BrewLog.java                              (수정) recipeId nullable, recipeSnapshot 필드
    │   └── RecipeSnapshot.java                       (신규) record — JSONB 매핑 대상
    ├── brewlog/application/BrewLogService.java       (수정) RecipeService 의존, 스냅샷 생성, FK null-out
    ├── brewlog/infrastructure/BrewLogRepository.java (수정) countByRecipeId
    └── brewlog/presentation/dto/BrewLogResponse.java (수정) recipeSnapshot 노출

backend/src/test/java/com/kaldinote/
├── recipe/presentation/RecipeControllerTest.java         (수정)
├── recipe/presentation/RecipeForkControllerTest.java     (수정)
├── recipe/infrastructure/RecipeMigrationTest.java        (신규)
└── brewlog/presentation/BrewLogControllerTest.java       (수정)
```

---

## Task 1: Recipe에 temperatureType·recommendedRoastLevel 추가

**Files:**
- Create: `backend/src/main/resources/db/migration/V13__add_recipe_temperature_roast.sql`
- Create: `backend/src/main/java/com/kaldinote/recipe/domain/RecipeTemperatureType.java`
- Create: `backend/src/main/java/com/kaldinote/recipe/domain/RecipeRoastLevel.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/domain/Recipe.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/presentation/dto/CreateRecipeRequest.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/presentation/dto/UpdateRecipeRequest.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/presentation/dto/RecipeResponse.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Test: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`
- Test: `backend/src/test/java/com/kaldinote/recipe/infrastructure/RecipeMigrationTest.java`

**Covers:** AC-RECIPEV2-01, 02, 03, 04, 05, 06, 30, 31, 40

**Interfaces:**
- Produces: `RecipeTemperatureType { HOT, ICE }`, `RecipeRoastLevel { LIGHT, MEDIUM, DARK }`,
  `Recipe.getTemperatureType()`, `Recipe.getRecommendedRoastLevel()`

- [ ] **Step 1: 실패하는 테스트 작성**

`RecipeControllerTest.java`에 추가:

```java
@Test
@DisplayName("AC-RECIPEV2-01 · temperatureType을 지정해 레시피를 만들 수 있다")
void temperatureType을_지정해_레시피를_만들_수_있다() throws Exception {
  String token = token();
  String body =
      """
      {"title":"아이스 브루","doseG":15.0,"waterG":250.0,"temperatureType":"ICE"}
      """;

  createRecipe(token, body)
      .andExpect(status().isCreated())
      .andExpect(jsonPath("$.temperatureType").value("ICE"));
}

@Test
@DisplayName("AC-RECIPEV2-02 · temperatureType을 생략하면 HOT이 기본값이다")
void temperatureType을_생략하면_HOT이_기본값이다() throws Exception {
  String token = token();
  String body = """
      {"title":"기본값","doseG":15.0,"waterG":250.0}
      """;

  createRecipe(token, body)
      .andExpect(status().isCreated())
      .andExpect(jsonPath("$.temperatureType").value("HOT"));
}

@Test
@DisplayName("AC-RECIPEV2-04 · recommendedRoastLevel을 생략하면 MEDIUM이 기본값이다")
void recommendedRoastLevel을_생략하면_MEDIUM이_기본값이다() throws Exception {
  String token = token();
  String body = """
      {"title":"기본값","doseG":15.0,"waterG":250.0}
      """;

  createRecipe(token, body)
      .andExpect(status().isCreated())
      .andExpect(jsonPath("$.recommendedRoastLevel").value("MEDIUM"));
}

@Test
@DisplayName("AC-RECIPEV2-05 · PATCH로 temperatureType만 수정할 수 있다")
void PATCH로_temperatureType만_수정할_수_있다() throws Exception {
  String token = token();
  Long id = createdId(createRecipe(token, """
      {"title":"원본","doseG":15.0,"waterG":250.0,"temperatureType":"HOT"}
      """));

  mockMvc
      .perform(
          put("/api/v1/recipes/" + id)
              .header(HttpHeaders.AUTHORIZATION, token)
              .contentType(MediaType.APPLICATION_JSON)
              .content(
                  """
                  {"title":"원본","doseG":15.0,"waterG":250.0,"temperatureType":"ICE"}
                  """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.temperatureType").value("ICE"));
}

@Test
@DisplayName("AC-RECIPEV2-30 · recommendedRoastLevel에 5단계 값을 보내면 거절한다")
void recommendedRoastLevel에_5단계_값을_보내면_거절한다() throws Exception {
  String token = token();
  String body =
      """
      {"title":"잘못됨","doseG":15.0,"waterG":250.0,"recommendedRoastLevel":"MEDIUM_LIGHT"}
      """;

  createRecipe(token, body).andExpect(status().isBadRequest());
}

@Test
@DisplayName("AC-RECIPEV2-40 · 잘못된 temperatureType은 400이다")
void 잘못된_temperatureType은_400이다() throws Exception {
  String token = token();
  String body = """
      {"title":"잘못됨","doseG":15.0,"waterG":250.0,"temperatureType":"WARM"}
      """;

  createRecipe(token, body)
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
}
```

`RecipeMigrationTest.java`(신규, `AbstractIntegrationTest` 확장):

```java
package com.kaldinote.recipe.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class RecipeMigrationTest extends AbstractIntegrationTest {

  @PersistenceContext private EntityManager entityManager;

  @Test
  @DisplayName("AC-RECIPEV2-31 · 마이그레이션 후 기존(V3 시드) 레시피는 HOT/MEDIUM이다")
  void 마이그레이션_후_기존_레시피는_HOT_MEDIUM이다() {
    // V3__seed_catalog.sql 등으로 이미 만들어진 CURATED 시드 레시피가 있다는 전제.
    // 없다면 이 테스트에서 직접 INSERT 후 확인한다 — Task 1 Step 3에서 시드 존재 여부를 먼저 확인한다.
    Long count =
        ((Number)
                entityManager
                    .createNativeQuery(
                        "select count(*) from recipes where temperature_type != 'HOT'"
                            + " or recommended_roast_level != 'MEDIUM'")
                    .getSingleResult())
            .longValue();
    assertThat(count).isZero();
  }
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeControllerTest' --tests '*RecipeMigrationTest'`
Expected: FAIL — `temperatureType`이 요청/응답 어디에도 없어 컴파일부터 깨지거나(DTO에 필드 없음)
`jsonPath`가 없는 키를 찾다 실패한다.

- [ ] **Step 3: 최소 구현**

`V13__add_recipe_temperature_roast.sql`:

```sql
ALTER TABLE recipes
  ADD COLUMN temperature_type      VARCHAR(10) NOT NULL DEFAULT 'HOT',
  ADD COLUMN recommended_roast_level VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN source_author_name    VARCHAR(100);
```

`RecipeTemperatureType.java` / `RecipeRoastLevel.java`:

```java
package com.kaldinote.recipe.domain;

public enum RecipeTemperatureType {
  HOT,
  ICE
}
```

```java
package com.kaldinote.recipe.domain;

/** 레시피에 어울리는 권장 배전도. 원두의 실제 배전도(catalog.RoastLevel, 5단계)와는 별개 필드다. */
public enum RecipeRoastLevel {
  LIGHT,
  MEDIUM,
  DARK
}
```

`Recipe.java`에 필드 추가(생성자·`create`·`applyUpdate`·`forkFrom`에 각각 전달):

```java
@Enumerated(EnumType.STRING)
@Column(name = "temperature_type", nullable = false, length = 10)
private RecipeTemperatureType temperatureType;

@Enumerated(EnumType.STRING)
@Column(name = "recommended_roast_level", nullable = false, length = 10)
private RecipeRoastLevel recommendedRoastLevel;

@Column(name = "source_author_name", length = 100)
private String sourceAuthorName;
```

`CreateRecipeRequest`/`UpdateRecipeRequest`에 필드 추가(둘 다 nullable, `@NotNull` 안 붙임):

```java
RecipeTemperatureType temperatureType,
RecipeRoastLevel recommendedRoastLevel,
```

`RecipeService.create()`/`update()`에서 생략 시 기본값 적용:

```java
request.temperatureType() == null ? RecipeTemperatureType.HOT : request.temperatureType(),
request.recommendedRoastLevel() == null ? RecipeRoastLevel.MEDIUM : request.recommendedRoastLevel(),
```

`RecipeResponse`에 두 필드를 `.name()`으로 추가.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeControllerTest' --tests '*RecipeMigrationTest'`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): temperatureType·recommendedRoastLevel 필드를 추가한다 (AC-RECIPEV2-01·02·03·04·05·06·30·31·40)" && cd backend
```

---

## Task 2: savedCount·brewCount 파생 계산

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/recipe/infrastructure/RecipeRepository.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/infrastructure/BrewLogRepository.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/presentation/dto/RecipeResponse.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Test: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`

**Covers:** AC-RECIPEV2-07, 08, 09, 10 (AC-11은 Task 5 구현 후에 통과— 이 태스크에서 테스트만 먼저
작성해 두고 Task 5까지는 `@Disabled`가 아니라 자연히 RED로 남긴다는 뜻이 아니라, Task 5가 끝나야
`recipeId`를 null로 저장하는 경로 자체가 생기므로 AC-11의 실제 시나리오 재현이 Task 5 이후에나
가능하다 — Task 2에서는 AC-11을 작성하지 않고 Task 5에서 함께 작성한다)

**Interfaces:**
- Consumes: 없음
- Produces: `RecipeRepository.countByParentRecipeIdAndDeletedAtIsNull(Long)`,
  `BrewLogRepository.countByRecipeIdAndDeletedAtIsNull(Long)`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("AC-RECIPEV2-07 · 포크가 0건이면 savedCount는 0이다")
void 포크가_0건이면_savedCount는_0이다() throws Exception {
  String token = token();
  Long id = simpleRecipe(token, "포크 안 된 레시피");

  getRecipe(token, id).andExpect(jsonPath("$.savedCount").value(0));
}

@Test
@DisplayName("AC-RECIPEV2-08 · 포크한 사람 수만큼 savedCount가 늘어난다")
void 포크한_사람_수만큼_savedCount가_늘어난다() throws Exception {
  String owner = token();
  Long recipeId = createdId(createRecipe(owner, """
      {"title":"인기 레시피","doseG":15.0,"waterG":250.0,"visibility":"PUBLIC"}
      """));

  String a = tokenOf(newUser("A"));
  String b = tokenOf(newUser("B"));
  mockMvc.perform(post("/api/v1/recipes/" + recipeId + "/fork").header(HttpHeaders.AUTHORIZATION, a));
  mockMvc.perform(post("/api/v1/recipes/" + recipeId + "/fork").header(HttpHeaders.AUTHORIZATION, b));

  getRecipe(owner, recipeId).andExpect(jsonPath("$.savedCount").value(2));
}

@Test
@DisplayName("AC-RECIPEV2-09 · 포크본을 삭제하면 원본의 savedCount가 즉시 줄어든다")
void 포크본을_삭제하면_원본의_savedCount가_즉시_줄어든다() throws Exception {
  String owner = token();
  Long recipeId = createdId(createRecipe(owner, """
      {"title":"인기 레시피","doseG":15.0,"waterG":250.0,"visibility":"PUBLIC"}
      """));
  String a = tokenOf(newUser("A"));
  Long forkId =
      createdId(
          mockMvc.perform(
              post("/api/v1/recipes/" + recipeId + "/fork")
                  .header(HttpHeaders.AUTHORIZATION, a)));

  mockMvc.perform(delete("/api/v1/recipes/" + forkId).header(HttpHeaders.AUTHORIZATION, a));

  getRecipe(owner, recipeId).andExpect(jsonPath("$.savedCount").value(0));
}

@Test
@DisplayName("AC-RECIPEV2-10 · 소유자가 자기 레시피로 낸 잔 수만큼 brewCount가 늘어난다")
void 소유자가_자기_레시피로_낸_잔_수만큼_brewCount가_늘어난다() throws Exception {
  // 기존 BrewLogControllerTest의 helper(beanBatchId·userGrinderId·createBrewLog)를 그대로 쓴다.
  // ... (BrewLogControllerTest에 있는 헬퍼를 RecipeControllerTest로 옮기거나 공용화할지는
  //      Step 3에서 실제 헬퍼 중복도를 보고 결정한다 — 검증되지 않은 가정)
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: FAIL — 응답에 `savedCount` 키 자체가 없다.

- [ ] **Step 3: 최소 구현**

`RecipeRepository`에 추가:

```java
long countByParentRecipeIdAndDeletedAtIsNull(Long parentRecipeId);
```

`BrewLogRepository`에 추가:

```java
long countByRecipeIdAndDeletedAtIsNull(Long recipeId);
```

`RecipeService.get()`에서 두 값을 계산해 `RecipeResponse.from(recipe, savedCount, brewCount)`로
전달하도록 바꾸고, `RecipeResponse`에 `Long savedCount, Long brewCount` 필드를 추가한다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: PASS (AC-10은 브루로그 생성 헬퍼가 필요하므로, 없다면 이 스텝에서 최소한의 헬퍼를
`RecipeControllerTest`에 추가한다)

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): savedCount·brewCount를 파생 계산해 노출한다 (AC-RECIPEV2-07·08·09·10)" && cd backend
```

---

## Task 3: 포크 시 sourceAuthorName 채우기

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/recipe/domain/Recipe.java` (`forkFrom` 시그니처에 `sourceAuthorName` 파라미터 추가)
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Test: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeForkControllerTest.java`

**Covers:** AC-RECIPEV2-12, 13, 14

**Interfaces:**
- Consumes: `UserService.profile(Long userId): PublicProfileResponse`(이미 존재 — `nickname` 필드)
- Produces: `Recipe.getSourceAuthorName()`

- [ ] **Step 1: 실패하는 테스트 작성**

`RecipeForkControllerTest.java`에 추가:

```java
@Test
@DisplayName("AC-RECIPEV2-12 · CURATED 레시피를 포크하면 sourceAuthorName이 authorName이 된다")
void CURATED_레시피를_포크하면_sourceAuthorName이_authorName이_된다() throws Exception {
  // 시드 CURATED 레시피(authorName 있음)의 id를 찾아 쓴다 — V3 시드 참조.
  Long curatedId = /* 기존 시드 참조 헬퍼 */ 1L;
  String a = tokenOf(newUser("A"));

  ResultActions fork =
      mockMvc.perform(
          post("/api/v1/recipes/" + curatedId + "/fork").header(HttpHeaders.AUTHORIZATION, a));

  fork.andExpect(jsonPath("$.sourceAuthorName").isNotEmpty());
}

@Test
@DisplayName("AC-RECIPEV2-13 · USER 소유 레시피를 포크하면 그 시점 소유자 닉네임이 담긴다")
void USER_소유_레시피를_포크하면_그_시점_소유자_닉네임이_담긴다() throws Exception {
  User owner = newUser("지연");
  String ownerToken = tokenOf(owner);
  Long recipeId =
      createdId(
          createRecipe(
              ownerToken,
              """
              {"title":"지연 레시피","doseG":15.0,"waterG":250.0,"visibility":"PUBLIC"}
              """));

  String a = tokenOf(newUser("A"));
  mockMvc
      .perform(post("/api/v1/recipes/" + recipeId + "/fork").header(HttpHeaders.AUTHORIZATION, a))
      .andExpect(jsonPath("$.sourceAuthorName").value("지연"));
}

@Test
@DisplayName("AC-RECIPEV2-14 · 포크 후 원본 소유자가 닉네임을 바꿔도 sourceAuthorName은 그대로다")
void 포크_후_원본_소유자가_닉네임을_바꿔도_sourceAuthorName은_그대로다() throws Exception {
  User owner = newUser("지연");
  String ownerToken = tokenOf(owner);
  Long recipeId =
      createdId(
          createRecipe(
              ownerToken,
              """
              {"title":"지연 레시피","doseG":15.0,"waterG":250.0,"visibility":"PUBLIC"}
              """));
  String a = tokenOf(newUser("A"));
  Long forkId =
      createdId(
          mockMvc.perform(
              post("/api/v1/recipes/" + recipeId + "/fork")
                  .header(HttpHeaders.AUTHORIZATION, a)));

  owner.changeNickname("지연2"); // User 도메인에 닉네임 변경 메서드가 없다면 리포지토리로 직접 갱신
  userRepository.save(owner);

  getRecipe(a, forkId).andExpect(jsonPath("$.sourceAuthorName").value("지연"));
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeForkControllerTest'`
Expected: FAIL — 응답에 `sourceAuthorName` 키가 없다.

- [ ] **Step 3: 최소 구현**

`RecipeService`에 `UserService` 의존성 추가(`@RequiredArgsConstructor`라 필드만 추가하면 됨):

```java
private final UserService userService;
```

`fork()` 수정:

```java
@Transactional
public RecipeResponse fork(Long userId, Long recipeId) {
  Recipe original = findViewable(userId, recipeId);
  String sourceAuthorName =
      original.getSourceType() == RecipeSourceType.CURATED
          ? original.getAuthorName()
          : userService.profile(original.getOwnerUserId()).nickname();
  Recipe fork = Recipe.forkFrom(original, userId, sourceAuthorName);
  List<RecipeStep> copiedSteps = original.getSteps().stream().map(RecipeStep::copyOf).toList();
  fork.replaceSteps(copiedSteps);
  return RecipeResponse.from(recipeRepository.save(fork), 0L, 0L);
}
```

`Recipe.forkFrom`에 `sourceAuthorName` 파라미터 추가, `fork.sourceAuthorName = sourceAuthorName;`으로
설정(기존처럼 `original.authorName`을 그대로 복사하던 줄은 CURATED의 `authorName` 필드 자체 복사
용도로 남겨두고, 새 `sourceAuthorName`은 별개 필드로 분리한다).

`RecipeResponse`에 `sourceAuthorName` 필드 추가.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeForkControllerTest'`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 포크 시 sourceAuthorName을 원본 작성자로 고정한다 (AC-RECIPEV2-12·13·14)" && cd backend
```

---

## Task 4: brew_logs 스키마 변경 + 기존 데이터 백필

**Files:**
- Create: `backend/src/main/resources/db/migration/V14__alter_brew_logs_snapshot.sql`
- Create: `backend/src/main/resources/db/migration/V15__backfill_brew_log_snapshot.sql`
- Create: `backend/src/main/java/com/kaldinote/brewlog/domain/RecipeSnapshot.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/domain/BrewLog.java`
- Test: `backend/src/test/java/com/kaldinote/brewlog/infrastructure/BrewLogMigrationTest.java`

**Covers:** AC-RECIPEV2-32

**Interfaces:**
- Produces: `RecipeSnapshot(String title, String authorName, BigDecimal doseG, BigDecimal waterG, BigDecimal temperatureC, String grinder, GrindValueSnapshot grindValue, List<StepSnapshot> steps)`,
  `BrewLog.getRecipeSnapshot()`

- [ ] **Step 1: 실패하는 테스트 작성**

`BrewLogMigrationTest.java`(신규):

```java
package com.kaldinote.brewlog.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.kaldinote.AbstractIntegrationTest;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class BrewLogMigrationTest extends AbstractIntegrationTest {

  @PersistenceContext private EntityManager entityManager;

  @Test
  @DisplayName("AC-RECIPEV2-32 · 마이그레이션 후 기존 브루로그는 전부 recipe_snapshot이 채워져 있다")
  void 마이그레이션_후_기존_브루로그는_recipe_snapshot이_채워져_있다() {
    Long nullCount =
        ((Number)
                entityManager
                    .createNativeQuery(
                        "select count(*) from brew_logs where recipe_snapshot is null")
                    .getSingleResult())
            .longValue();
    assertThat(nullCount).isZero();

    Object doseMismatch =
        entityManager
            .createNativeQuery(
                """
                select count(*) from brew_logs bl
                join recipes r on r.id = bl.recipe_id
                where (bl.recipe_snapshot->>'doseG')::numeric != r.dose_g
                """)
            .getSingleResult();
    assertThat(((Number) doseMismatch).longValue()).isZero();
  }
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BrewLogMigrationTest'`
Expected: FAIL — `recipe_snapshot` 컬럼 자체가 없어 쿼리가 실패한다.

- [ ] **Step 3: 최소 구현**

`V14__alter_brew_logs_snapshot.sql`:

```sql
ALTER TABLE brew_logs
  ALTER COLUMN recipe_id DROP NOT NULL,
  ADD COLUMN recipe_snapshot JSONB;
```

`recipe_snapshot`은 이 단계에서 아직 `NOT NULL`을 걸지 않는다 — 백필(V15)이 끝난 뒤에 건다(같은
트랜잭션에서 컬럼 추가와 NOT NULL을 동시에 걸면 기존 행이 전부 걸린다).

`V15__backfill_brew_log_snapshot.sql`:

```sql
UPDATE brew_logs bl
SET recipe_snapshot = jsonb_build_object(
  'title', r.title,
  'authorName', COALESCE(r.author_name, u.nickname),
  'doseG', r.dose_g,
  'waterG', r.water_g,
  'temperatureC', r.water_temp_c,
  'grinder', gm.name,
  'grindValue', jsonb_build_object('value', r.grind_setting_value, 'unit', r.grind_setting_unit),
  'steps', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'type', rs.step_type,
      'waterG', rs.water_g,
      'seconds', rs.duration_seconds,
      'note', rs.note
    ) order by rs.step_order), '[]'::jsonb)
    from recipe_steps rs where rs.recipe_id = r.id
  )
)
FROM recipes r
LEFT JOIN users u ON u.id = r.owner_user_id
LEFT JOIN grinder_models gm ON gm.id = r.grinder_model_id
WHERE bl.recipe_id = r.id;

ALTER TABLE brew_logs ALTER COLUMN recipe_snapshot SET NOT NULL;
```

`RecipeSnapshot.java`(record, `brewlog/domain` 소속 — 자기 도메인 전용이므로 `recipe` 패키지를
참조하지 않는다):

```java
package com.kaldinote.brewlog.domain;

import java.math.BigDecimal;
import java.util.List;

public record RecipeSnapshot(
    String title,
    String authorName,
    BigDecimal doseG,
    BigDecimal waterG,
    BigDecimal temperatureC,
    String grinder,
    GrindValueSnapshot grindValue,
    List<StepSnapshot> steps) {

  public record GrindValueSnapshot(BigDecimal value, String unit) {}

  public record StepSnapshot(String type, BigDecimal waterG, Integer seconds, String note) {}
}
```

`BrewLog.java`:

```java
@Column(name = "recipe_id")  // nullable = false 제거
private Long recipeId;

@JdbcTypeCode(SqlTypes.JSON)
@Column(name = "recipe_snapshot", nullable = false, columnDefinition = "jsonb")
private RecipeSnapshot recipeSnapshot;
```

> **검증되지 않은 가정:** `@JdbcTypeCode(SqlTypes.JSON)`이 이 프로젝트에서 첫 JSONB 매핑이다.
> Jackson 3(`tools.jackson.*`)와 Hibernate 7의 기본 JSON 직렬화가 그대로 맞물리는지 Step 4에서
> 처음 확인된다. 안 맞으면 `hypersistence-utils-hibernate-63` 같은 별도 라이브러리 추가를 검토한다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BrewLogMigrationTest'`
Expected: PASS — 이 시점에는 `BrewLog.create()`가 아직 `recipeSnapshot`을 안 채우므로(Task 5 몫),
기존 데이터만 검증되고 신규 생성 경로는 Task 5에서 확인한다.

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(brewlog): recipe_id를 nullable로 바꾸고 recipe_snapshot을 추가한다 (AC-RECIPEV2-32)" && cd backend
```

---

## Task 5: POST /brew-logs 접근 규칙 완화 + recipeSnapshot 자동 생성

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java` (`requireViewable` 반환형)
- Modify: `backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/presentation/dto/BrewLogResponse.java`
- Test: `backend/src/test/java/com/kaldinote/brewlog/presentation/BrewLogControllerTest.java`

**Covers:** AC-RECIPEV2-11, 15, 16, 17, 18, 19, 20, 21, 41, 42, 43

**Interfaces:**
- Consumes: `RecipeService.requireViewable(Long userId, Long recipeId): Recipe`(반환형 변경)
- Produces: `BrewLogResponse.recipeSnapshot`

- [ ] **Step 1: 실패하는 테스트 작성**

`BrewLogControllerTest.java`에 추가(기존 `AC-BREW-32` "남의 레시피를 가리키면 403이다"는 아래
`AC-RECIPEV2-42`로 대체한다 — PRIVATE로 조건을 좁혀 테스트를 고친다):

```java
@Test
@DisplayName("AC-RECIPEV2-15 · 내 소유 레시피로 브루잉하면 recipeId가 그대로 저장된다")
void 내_소유_레시피로_브루잉하면_recipeId가_그대로_저장된다() throws Exception {
  String token = token("소유자");
  Long recipeId = recipeId(token);
  Long beanBatchId = beanBatchId(token, BREWED_AT, 6);
  Long userGrinderId = userGrinderId(token, c40Id());

  createBrewLog(token, minimalBody(recipeId, beanBatchId, BREWED_AT, userGrinderId))
      .andExpect(status().isCreated())
      .andExpect(jsonPath("$.recipeId").value(recipeId));
}

@Test
@DisplayName("AC-RECIPEV2-16 · 남의 PUBLIC 레시피로 브루잉하면 성공하되 recipeId는 null이다")
void 남의_PUBLIC_레시피로_브루잉하면_recipeId는_null이다() throws Exception {
  String owner = token("소유자");
  Long recipeId = publicRecipeId(owner); // 기존 recipeId(token)을 PUBLIC 버전으로 만든 헬퍼(Step 3에서 추가)

  String requester = token("요청자");
  Long beanBatchId = beanBatchId(requester, BREWED_AT, 6);
  Long userGrinderId = userGrinderId(requester, c40Id());

  createBrewLog(requester, minimalBody(recipeId, beanBatchId, BREWED_AT, userGrinderId))
      .andExpect(status().isCreated())
      .andExpect(jsonPath("$.recipeId").doesNotExist())
      .andExpect(jsonPath("$.recipeSnapshot.title").isNotEmpty());
}

@Test
@DisplayName("AC-RECIPEV2-42 · 가시성 없는 남의 레시피를 가리키면 403이다")
void 가시성_없는_남의_레시피를_가리키면_403이다() throws Exception {
  String owner = token("소유자");
  Long privateRecipeId = recipeId(owner); // 기존 헬퍼가 기본 PRIVATE로 만든다는 전제 확인 필요

  String requester = token("요청자");
  Long beanBatchId = beanBatchId(requester, BREWED_AT, 6);
  Long userGrinderId = userGrinderId(requester, c40Id());

  createBrewLog(requester, minimalBody(privateRecipeId, beanBatchId, BREWED_AT, userGrinderId))
      .andExpect(status().isForbidden())
      .andExpect(jsonPath("$.code").value("FORBIDDEN"));
}

@Test
@DisplayName("AC-RECIPEV2-19 · 레시피를 나중에 수정해도 기존 잔의 recipeSnapshot은 불변이다")
void 레시피를_나중에_수정해도_기존_잔의_recipeSnapshot은_불변이다() throws Exception {
  String token = token("소유자");
  Long recipeId = recipeId(token); // doseG 15.0으로 생성된다는 전제(기존 헬퍼)
  Long beanBatchId = beanBatchId(token, BREWED_AT, 6);
  Long userGrinderId = userGrinderId(token, c40Id());
  Long logId =
      createdId(createBrewLog(token, minimalBody(recipeId, beanBatchId, BREWED_AT, userGrinderId)));

  updateRecipeDoseTo(token, recipeId, "16.0"); // Step 3에서 헬퍼 추가

  mockMvc
      .perform(get("/api/v1/brew-logs/" + logId).header(HttpHeaders.AUTHORIZATION, token))
      .andExpect(jsonPath("$.recipeSnapshot.doseG").value(15.0));
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: FAIL — `requireOwnedRecipe`가 여전히 소유자만 허용해 `AC-RECIPEV2-16`·`17`이 403으로
실패하고, 응답에 `recipeSnapshot`이 없어 나머지도 실패한다.

- [ ] **Step 3: 최소 구현**

`RecipeService.requireViewable` 반환형을 `void → Recipe`로 변경(호출부인 `media` 도메인은 반환값을
무시하는 문장이라 그대로 컴파일된다):

```java
public Recipe requireViewable(Long userId, Long recipeId) {
  return findViewable(userId, recipeId);
}
```

`BrewLogService`에 `RecipeService` 의존성 추가, `create()` 내부를 다음처럼 바꾼다:

```java
Recipe recipe = recipeService.requireViewable(userId, request.recipeId());
Long storedRecipeId = recipe.isOwnedBy(userId) ? recipe.getId() : null;
RecipeSnapshot snapshot = buildSnapshot(recipe);
```

```java
private RecipeSnapshot buildSnapshot(Recipe recipe) {
  GrinderModel grinderModel =
      recipe.getGrinderModelId() == null
          ? null
          : grinderModelRepository.findById(recipe.getGrinderModelId()).orElse(null);
  String authorName =
      recipe.getSourceType() == RecipeSourceType.CURATED
          ? recipe.getAuthorName()
          : recipe.getSourceAuthorName() != null
              ? recipe.getSourceAuthorName()
              : recipeService.ownerNickname(recipe.getOwnerUserId()); // 신규 헬퍼 — Task 3의 UserService 재사용
  List<RecipeSnapshot.StepSnapshot> steps =
      recipe.getSteps().stream()
          .map(
              s ->
                  new RecipeSnapshot.StepSnapshot(
                      s.getStepType().name(), s.getWaterG(), s.getDurationSeconds(), s.getNote()))
          .toList();
  return new RecipeSnapshot(
      recipe.getTitle(),
      authorName,
      recipe.getDoseG(),
      recipe.getWaterG(),
      recipe.getWaterTempC(),
      grinderModel == null ? null : grinderModel.getName(),
      new RecipeSnapshot.GrindValueSnapshot(
          recipe.getGrindSettingValue(),
          recipe.getGrindSettingUnit() == null ? null : recipe.getGrindSettingUnit().name()),
      steps);
}
```

`requireOwnedRecipe` 메서드는 이제 안 쓰이므로 삭제하고 호출부를 위 코드로 교체한다.
`BrewLog.create(...)`에 `recipeId`(이제 `storedRecipeId`) + `recipeSnapshot` 파라미터를 추가로
전달한다. `BrewLogResponse`에 `recipeSnapshot` 필드를 추가(직렬화는 record 그대로 Jackson이 처리).

기존 `AC-BREW-32` 테스트("남의 레시피를 가리키면 403이다", `othersRecipeId = recipeId(owner)`)는
`recipeId(owner)`가 기본 `PRIVATE`로 만든다는 전제가 맞다면 **그대로 통과한다** — 조건이 "남의
것"에서 "가시성 없음"으로 바뀌었을 뿐, `PRIVATE` 레시피는 둘 다 403이기 때문이다. 통과 여부만
Step 4에서 확인하고, 실패하면 그 테스트를 `AC-RECIPEV2-42`로 갈아끼운다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: PASS 전체. 기존 `AC-BREW-32`도 함께 재확인한다.

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(brewlog): 가시성 있는 레시피로도 브루잉을 허용하고 recipeSnapshot을 채운다 (AC-RECIPEV2-11·15~21·41·42·43)" && cd backend
```

---

## 완료 기준

- [ ] `cd backend && ./gradlew clean check` 통과
- [ ] `./scripts/check-spec-coverage.sh` 통과
- [ ] 스펙의 `status`를 `구현완료`로 변경
- [ ] 회귀 확인: `RecipeVisibilityTest`·`BrewLogControllerTest`의 기존 403/404 케이스 전부 통과
      (특히 스냅샷 불변성 회귀 — `backend/CLAUDE.md`의 "반드시 있어야 하는 회귀 테스트")
- [ ] 수동 확인 없음(스펙에 명시됨)

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 28개(`01~21`, `30~32`, `40~43`) 중 28개가 태스크에 매핑됨.

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음.

**타입 일관성:** `Recipe.forkFrom`의 새 파라미터(`sourceAuthorName`)는 Task 3에서 도입되고 Task 5의
`buildSnapshot`이 그 값을 그대로 소비한다 — 이름·타입 일치 확인함. `RecipeService.requireViewable`의
반환형 변경(Task 5)은 기존 유일한 외부 호출부(`media` 도메인)가 반환값을 문장으로만 쓰므로 깨지지
않는다.

**검증되지 않은 가정:**
- **`@JdbcTypeCode(SqlTypes.JSON)`이 이 프로젝트 첫 JSONB 매핑이다.** Hibernate 7 + Jackson 3
  조합에서 그대로 동작하는지 Task 4 Step 4에서 처음 확인된다. 안 되면 별도 컨버터
  (`AttributeConverter<RecipeSnapshot, String>` + 수동 Jackson 직렬화)로 우회한다.
- **`RecipeControllerTest`의 `recipeId(token)` 헬퍼가 기본 `PRIVATE`로 레시피를 만드는지**
  Task 5에서 실제로 확인해야 한다 — `AC-RECIPEV2-42`(기존 `AC-BREW-32` 대체)의 전제다. 아니라면
  헬퍼에 명시적으로 `visibility: PRIVATE`를 넘기도록 고친다.
- **`RecipeMigrationTest`(Task 1)가 기댈 기존 시드 데이터의 존재.** `V3__seed_catalog.sql` 등에
  CURATED 레시피 시드가 실제로 있는지, 없다면 테스트가 직접 레시피를 만들고 마이그레이션 재실행을
  흉내 내는 방식으로 바꿔야 한다 — Flyway는 이미 적용된 마이그레이션을 재실행하지 않으므로, 이
  테스트는 사실상 "DEFAULT 값이 기존 행에도 적용됐는지"를 시드 데이터로 간접 확인하는 것이다.
  실제로는 Testcontainers가 매번 깨끗한 DB에 전체 마이그레이션을 새로 적용하므로, V13 적용 시점에
  이미 존재하는 행(V3 시드 등)에 `DEFAULT`가 정확히 적용되는지를 확인하는 유효한 테스트다.
- **Task 2의 AC-RECIPEV2-10 테스트 코드가 미완성으로 표시돼 있다.** Step 3에서 브루로그 생성
  헬퍼를 `RecipeControllerTest`에 추가할지, `BrewLogControllerTest`의 것을 재사용할지 실제
  구현 시점에 정한다.

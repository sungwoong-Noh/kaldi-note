# 레시피 검색·필터 + 잔 통계 + 담기(포크) API 개편 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-21-recipes-and-brews-search-api.md`

**Goal:** `GET /recipes`가 검색·필터·정렬·범위(내 서랍/둘러보기)를 지원하고, `GET
/brew-logs/stats`가 잔 통계 4칸을 돌려주고, `POST /recipes/{id}/fork`가 담기+수정을 한 번에
처리한다. 프론트가 다음 스펙(웹 둘러보기/내 서랍)에서 이 API로 화면을 만들 수 있는 상태가
된다.

**Architecture:** 동적 필터(검색어·온도·배전도 다중·원두량 범위·기구)와 계산된 컬럼
(`savedCount`) 기준 정렬이 섞여 있어 JPA `Specification`으로는 `ORDER BY`에 상관 서브쿼리를
넣을 수 없다. `BrewLogRepository.countByKstDay`가 이미 쓰는 **네이티브 쿼리 + null-safe
`(:param IS NULL OR ...)` 패턴**을 그대로 따른다. `scope=DRAWER`와 `scope=PUBLIC`은 WHERE
기반 자체가 달라(소유 여부 vs visibility) 리포지토리 메서드를 둘로 나눈다
(`searchDrawer`/`searchPublic`). `dripper` 필터는 서비스가 먼저
`DripperFilter → Set<Long> brewerId`로 해석한 뒤 쿼리에 넘긴다 — SQL에 브랜드명 패턴을
직접 넣지 않는다.

**작업 위치:** `backend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-RECIPESBREWS-20 | 목록 응답에 temperatureType·recommendedRoastLevel·savedCount | Task 1 | API 테스트 |
| AC-RECIPESBREWS-01~03 | q 검색(제목·기구명), 빈 결과 | Task 2 | API 테스트 |
| AC-RECIPESBREWS-04 | temp 단일 필터 | Task 2 | API 테스트 |
| AC-RECIPESBREWS-05 | roast 다중 OR 필터 | Task 2 | API 테스트 |
| AC-RECIPESBREWS-06~07 | doseMin/doseMax 범위 | Task 2 | API 테스트 |
| AC-RECIPESBREWS-40~41 | 원두량 경계값·역전 400 | Task 2 | API 테스트 |
| AC-RECIPESBREWS-19a | scope=PUBLIC은 PUBLIC만(FRIENDS 제외) | Task 2 | API 테스트 |
| AC-RECIPESBREWS-08~10 | dripper 필터(V60/Kalita/Origami/Clever) | Task 3 | API 테스트 + 통합 테스트 |
| AC-RECIPESBREWS-11~19 | scope/owner/sort 분기 | Task 4 | API 테스트 |
| AC-RECIPESBREWS-50~51 | scope·temp·roast·sort·owner·dripper 잘못된 값 400 | Task 2·3·4 | API 테스트 |
| AC-RECIPESBREWS-54 | 인증 없이 401(회귀) | Task 4 | API 테스트 |
| AC-RECIPESBREWS-21~29 | 잔 통계 4칸 | Task 5 | API 테스트 |
| AC-RECIPESBREWS-30~33 | 담기 바디 지원 | Task 6 | API 테스트 |
| AC-RECIPESBREWS-52~53 | 담기 검증 실패 400, 가시성 없음 403(회귀) | Task 6 | API 테스트 |

---

## Global Constraints

- 프론트 변경 0건. 이번 계획은 `backend/`만 건드린다.
- 적용된 Flyway 파일은 수정하지 않는다 — `V16`을 새로 추가한다(`V15`가 마지막).
- QueryDSL을 도입하지 않는다. 네이티브 `@Query` + null-safe 파라미터 패턴을 쓴다
  (`BrewLogRepository.countByKstDay` 참고).
- `RecipeSummaryResponse`에 필드를 추가해도 `GET /recipes`의 기존 소비자(현재 프론트 없음,
  RECIPEV2까지는 미사용)를 깨지 않는다 — 필드 추가는 항상 하위 호환이다.
- `scope=DRAWER`일 때 기존 `ownerUserId` 파라미터는 무시하고 호출자 본인 id를 강제한다.

## File Structure

```
backend/src/main/
├── resources/db/migration/
│   └── V16__seed_clever_dripper.sql              (신규)
└── java/com/kaldinote/
    ├── recipe/domain/
    │   └── RecipeSearchScope.java                 (신규) DRAWER/PUBLIC
    │   └── RecipeSearchSort.java                  (신규) POPULAR/RECENT
    │   └── RecipeSearchOwner.java                 (신규) ALL/MINE/SAVED
    │   └── DripperFilter.java                     (신규) V60/KALITA/ORIGAMI/CLEVER
    ├── recipe/application/RecipeService.java       (수정) search(), buildSnapshot 무관
    ├── recipe/infrastructure/RecipeRepository.java (수정) searchDrawer/searchPublic/countSavedForIds
    ├── recipe/infrastructure/RecipeSearchRow.java  (신규) 네이티브 쿼리 프로젝션 인터페이스
    ├── recipe/presentation/RecipeController.java   (수정) list() 파라미터 추가
    ├── recipe/presentation/dto/RecipeSummaryResponse.java (수정) 필드 3개 추가
    ├── gear/infrastructure/BrewerRepository.java   (수정) findByDripperFilter 계열 조회
    ├── brewlog/application/BrewLogService.java     (수정) stats()
    ├── brewlog/infrastructure/BrewLogRepository.java (수정) 통계 집계 쿼리 4개
    ├── brewlog/presentation/BrewLogController.java (수정) GET /brew-logs/stats
    ├── brewlog/presentation/dto/BrewLogStatsResponse.java (신규)
    └── recipe/presentation/dto/ForkRequest.java    (신규) 전부 optional

backend/src/test/java/com/kaldinote/
├── recipe/presentation/RecipeControllerTest.java         (수정)
├── recipe/presentation/RecipeForkControllerTest.java     (수정)
├── recipe/infrastructure/RecipeSeedMigrationTest.java    (신규)
└── brewlog/presentation/BrewLogControllerTest.java       (수정)
```

---

## Task 1: 목록 응답에 temperatureType·recommendedRoastLevel·savedCount 추가

**Files:**
- Modify: `backend/src/main/java/com/kaldinote/recipe/presentation/dto/RecipeSummaryResponse.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/infrastructure/RecipeRepository.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Test: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`

**Covers:** AC-RECIPESBREWS-20

**Interfaces:**
- Produces: `RecipeRepository.countSavedForIds(List<Long> recipeIds): List<Object[]>`(parentRecipeId,
  count) — 페이지 안의 레시피들의 savedCount를 한 번에 조회(N+1 방지)

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("AC-RECIPESBREWS-20 · 목록 응답에 temperatureType·recommendedRoastLevel·savedCount가 있다")
void 목록_응답에_새_필드가_있다() throws Exception {
  String owner = token();
  Long id = createdId(createRecipe(owner, """
      {"title":"목록 필드 확인","doseG":15.0,"waterG":250.0,
       "temperatureType":"ICE","recommendedRoastLevel":"DARK","visibility":"PUBLIC"}
      """));
  String a = tokenOf(newUser("recipesbrews-20a"));
  mockMvc.perform(post("/api/v1/recipes/" + id + "/fork").header(HttpHeaders.AUTHORIZATION, a));

  listRecipes(owner, "?scope=PUBLIC")
      .andExpect(jsonPath("$.content[?(@.id == %d)].temperatureType".formatted(id)).value("ICE"))
      .andExpect(jsonPath("$.content[?(@.id == %d)].recommendedRoastLevel".formatted(id)).value("DARK"))
      .andExpect(jsonPath("$.content[?(@.id == %d)].savedCount".formatted(id)).value(1));
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeControllerTest.목록_응답에_새_필드가_있다'`
Expected: FAIL — `scope` 파라미터가 아직 없어 400 또는 컴파일 시점에 `listRecipes` 헬퍼가
`scope` 쿼리를 무시(Task 4 전까지는 임시로 `?ownerUserId=` 없이 기존 목록으로 대체해 필드
누락만 검증해도 된다. 이 스텝의 목적은 `temperatureType`/`recommendedRoastLevel`/
`savedCount` 키가 없어 `jsonPath`가 실패하는 것을 확인하는 것이다).

- [ ] **Step 3: 최소 구현**

`RecipeSummaryResponse`에 필드 3개 추가(패턴은 `RecipeResponse`와 동일):

```java
String temperatureType,
String recommendedRoastLevel,
Long savedCount,
```

`RecipeSummaryResponse.from(Recipe r, long savedCount)`로 팩토리 시그니처 변경.

`RecipeRepository`에 추가:

```java
@Query(
    value = "select r.parent_recipe_id as parentRecipeId, count(*) as cnt "
        + "from recipes r where r.parent_recipe_id in (:recipeIds) and r.deleted_at is null "
        + "group by r.parent_recipe_id",
    nativeQuery = true)
List<SavedCountRow> countSavedForIds(@Param("recipeIds") List<Long> recipeIds);

interface SavedCountRow {
  Long getParentRecipeId();
  long getCnt();
}
```

`RecipeService.list()`에서 페이지 결과의 id 목록으로 `countSavedForIds`를 한 번 호출해
`Map<Long, Long>`으로 변환한 뒤 `RecipeSummaryResponse.from(r, savedCountMap.getOrDefault(r.getId(), 0L))`로
매핑한다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 목록 응답에 temperatureType·recommendedRoastLevel·savedCount를 추가한다 (AC-RECIPESBREWS-20)" && cd backend
```

---

## Task 2: 검색어·온도·배전도·원두량 필터 (scope=PUBLIC)

**Files:**
- Create: `backend/src/main/java/com/kaldinote/recipe/domain/RecipeSearchScope.java`
- Create: `backend/src/main/java/com/kaldinote/recipe/domain/RecipeSearchSort.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/infrastructure/RecipeRepository.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/presentation/RecipeController.java`
- Test: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`

**Covers:** AC-RECIPESBREWS-01, 02, 03, 04, 05, 06, 07, 19a, 40, 41, 50(scope만), 51(temp·roast만)

**Interfaces:**
- Produces: `RecipeSearchScope { DRAWER, PUBLIC }`, `RecipeSearchSort { POPULAR, RECENT }`,
  `RecipeRepository.searchPublic(String q, String temp, List<String> roast, BigDecimal doseMin,
  BigDecimal doseMax, List<Long> brewerIds, String sort, Pageable): Page<Recipe>`(brewerIds는
  Task 3까지는 항상 null)

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("AC-RECIPESBREWS-01 · q로 레시피 제목이 부분 일치 검색된다")
void q로_제목이_검색된다() throws Exception {
  String owner = token();
  createRecipe(owner, """
      {"title":"아침에 마시는 밝은 워시드","doseG":15.0,"waterG":250.0,"visibility":"PUBLIC"}
      """);

  listRecipes(owner, "?scope=PUBLIC&q=워시드")
      .andExpect(jsonPath("$.content.length()").value(1));
}

@Test
@DisplayName("AC-RECIPESBREWS-03 · q가 안 맞으면 빈 결과다")
void q가_안_맞으면_빈_결과다() throws Exception {
  listRecipes(token(), "?scope=PUBLIC&q=존재하지않는검색어999")
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.content.length()").value(0))
      .andExpect(jsonPath("$.totalElements").value(0));
}

@Test
@DisplayName("AC-RECIPESBREWS-04 · temp=HOT이면 HOT만 남는다")
void temp_HOT_필터() throws Exception {
  String owner = token();
  createRecipe(owner, """
      {"title":"HOT-1","doseG":15.0,"waterG":250.0,"temperatureType":"HOT","visibility":"PUBLIC"}
      """);
  createRecipe(owner, """
      {"title":"ICE-1","doseG":15.0,"waterG":250.0,"temperatureType":"ICE","visibility":"PUBLIC"}
      """);

  listRecipes(owner, "?scope=PUBLIC&temp=HOT")
      .andExpect(jsonPath("$.content[*].temperatureType", everyItem(equalTo("HOT"))));
}

@Test
@DisplayName("AC-RECIPESBREWS-06 · doseMin·doseMax 범위(포함)")
void 원두량_범위_필터() throws Exception {
  String owner = token();
  for (String dose : new String[] {"10.0", "15.0", "20.0", "30.0"}) {
    createRecipe(owner, """
        {"title":"dose-%s","doseG":%s,"waterG":250.0,"visibility":"PUBLIC"}
        """.formatted(dose, dose));
  }

  listRecipes(owner, "?scope=PUBLIC&doseMin=15&doseMax=20")
      .andExpect(jsonPath("$.content.length()").value(2));
}

@Test
@DisplayName("AC-RECIPESBREWS-41 · doseMin이 doseMax보다 크면 400이다")
void 원두량_범위_역전은_400이다() throws Exception {
  listRecipes(token(), "?scope=PUBLIC&doseMin=20&doseMax=10")
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
}

@Test
@DisplayName("AC-RECIPESBREWS-19a · scope=PUBLIC은 FRIENDS를 제외한다")
void PUBLIC_스코프는_FRIENDS를_제외한다() throws Exception {
  User a = newUser("recipesbrews-19a");
  User b = newUser("recipesbrews-19b");
  follow(a, b);
  follow(b, a); // 맞팔로우
  createRecipe(tokenOf(a), """
      {"title":"FRIENDS 전용","doseG":15.0,"waterG":250.0,"visibility":"FRIENDS"}
      """);

  listRecipes(tokenOf(b), "?scope=PUBLIC&q=FRIENDS")
      .andExpect(jsonPath("$.content.length()").value(0));
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: FAIL — `scope`·`q`·`temp`·`doseMin`·`doseMax` 파라미터가 아직 컨트롤러에 없어
무시되고, 기존 `findVisible`(FRIENDS 포함, 필터 없음) 결과가 그대로 나와 assertion이 깨진다.

- [ ] **Step 3: 최소 구현**

`RecipeSearchScope`/`RecipeSearchSort`(단순 enum).

`RecipeRepository`에 네이티브 쿼리 추가(요약 — 실제 필드는 `recipes` 테이블 컬럼명 그대로):

```java
@Query(
    value = """
        select r.* from recipes r
        left join brewers br on br.id = r.brewer_id
        where r.deleted_at is null
          and r.visibility = 'PUBLIC'
          and (:q is null or r.title ilike concat('%', :q, '%')
                          or br.name ilike concat('%', :q, '%'))
          and (:temp is null or r.temperature_type = :temp)
          and (:roast is null or r.recommended_roast_level = any(:roast))
          and (:doseMin is null or r.dose_g >= :doseMin)
          and (:doseMax is null or r.dose_g <= :doseMax)
          and (:brewerIds is null or r.brewer_id = any(:brewerIds))
        order by
          case when :sort = 'RECENT' then r.created_at end desc,
          case when :sort != 'RECENT' or :sort is null then r.source_type = 'CURATED' end desc,
          case when :sort != 'RECENT' or :sort is null then
            (select count(*) from recipes c where c.parent_recipe_id = r.id and c.deleted_at is null)
          end desc,
          r.created_at desc, r.id desc
        """,
    countQuery = """
        select count(*) from recipes r
        left join brewers br on br.id = r.brewer_id
        where r.deleted_at is null and r.visibility = 'PUBLIC'
          and (:q is null or r.title ilike concat('%', :q, '%')
                          or br.name ilike concat('%', :q, '%'))
          and (:temp is null or r.temperature_type = :temp)
          and (:roast is null or r.recommended_roast_level = any(:roast))
          and (:doseMin is null or r.dose_g >= :doseMin)
          and (:doseMax is null or r.dose_g <= :doseMax)
          and (:brewerIds is null or r.brewer_id = any(:brewerIds))
        """,
    nativeQuery = true)
Page<Recipe> searchPublic(
    @Param("q") String q,
    @Param("temp") String temp,
    @Param("roast") String[] roast,
    @Param("doseMin") BigDecimal doseMin,
    @Param("doseMax") BigDecimal doseMax,
    @Param("brewerIds") Long[] brewerIds,
    @Param("sort") String sort,
    Pageable pageable);
```

> **검증되지 않은 가정:** Postgres `= any(:array)` 바인딩이 Hibernate 7 네이티브 쿼리에서
> `String[]`/`Long[]` 파라미터를 그대로 받는지 Step 4에서 처음 확인한다. 안 되면
> `org.hibernate.type.ArrayJdbcType`를 명시하거나 `jdbcTypeCode`를 지정한다.

`RecipeService`에 `search(Long userId, RecipeSearchScope scope, String q, RecipeTemperatureType
temp, List<RecipeRoastLevel> roast, BigDecimal doseMin, BigDecimal doseMax, RecipeSearchSort
sort, RecipeSearchOwner owner, PageParams params)` 추가. `doseMin > doseMax`면
`INVALID_REQUEST`. `scope == PUBLIC`이면 `searchPublic` 호출(이번 태스크는 `brewerIds`,
`owner` 무시 — Task 3·4에서 채운다).

`RecipeController.list()`에 `scope`·`q`·`temp`·`roast`·`doseMin`·`doseMax`·`sort`·`owner`
파라미터 추가, `scope`가 있으면 `search()`로 분기하고 없으면 기존 `list()` 그대로 호출(하위
호환 — 기존 `AC-LIST-*` 회귀 확인용).

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 둘러보기에 검색어·온도·배전도·원두량 필터를 추가한다 (AC-RECIPESBREWS-01·02·03·04·05·06·07·19a·40·41)" && cd backend
```

---

## Task 3: 기구(dripper) 필터 + Clever 시드

**Files:**
- Create: `backend/src/main/resources/db/migration/V16__seed_clever_dripper.sql`
- Create: `backend/src/main/java/com/kaldinote/recipe/domain/DripperFilter.java`
- Modify: `backend/src/main/java/com/kaldinote/gear/infrastructure/BrewerRepository.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Test: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`
- Test: `backend/src/test/java/com/kaldinote/recipe/infrastructure/RecipeSeedMigrationTest.java`

**Covers:** AC-RECIPESBREWS-08, 09, 10, 51(dripper)

**Interfaces:**
- Consumes: `RecipeRepository.searchPublic(...)`의 `brewerIds` 파라미터(Task 2에서 이미 존재)
- Produces: `DripperFilter { V60, KALITA, ORIGAMI, CLEVER }`,
  `BrewerRepository.findByNameStartingWithIgnoreCase(String): List<Brewer>`,
  `BrewerRepository.findByBrandIgnoreCase(String): List<Brewer>`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("AC-RECIPESBREWS-08 · dripper=V60은 이름이 V60으로 시작하는 브루어만 남긴다")
void dripper_V60_필터() throws Exception {
  String owner = token();
  Long v60 = brewerId("Hario", "V60 01");
  Long wave = brewerId("Kalita", "Wave 155");
  createRecipe(owner, bodyWithBrewer("V60 레시피", v60));
  createRecipe(owner, bodyWithBrewer("Kalita 레시피", wave));

  listRecipes(owner, "?scope=PUBLIC&dripper=V60")
      .andExpect(jsonPath("$.content.length()").value(1))
      .andExpect(jsonPath("$.content[0].title").value("V60 레시피"));
}

@Test
@DisplayName("AC-RECIPESBREWS-10 · dripper=CLEVER가 시드된 Clever 브루어와 매칭된다")
void dripper_CLEVER_필터() throws Exception {
  String owner = token();
  Long clever = brewerId("Clever", "Clever Dripper");
  createRecipe(owner, bodyWithBrewer("Clever 레시피", clever));

  listRecipes(owner, "?scope=PUBLIC&dripper=CLEVER")
      .andExpect(jsonPath("$.content.length()").value(1));
}
```

`RecipeSeedMigrationTest.java`(신규, `AbstractIntegrationTest` 확장):

```java
@Test
@DisplayName("AC-RECIPESBREWS-10 · V16 시드로 brand=Clever 브루어가 존재한다")
void Clever_브루어가_시드돼_있다() {
  assertThat(brewerRepository.findByBrandIgnoreCase("Clever")).isNotEmpty();
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeControllerTest' --tests '*RecipeSeedMigrationTest'`
Expected: FAIL — `dripper` 파라미터가 무시되고, `brand='Clever'` 브루어가 존재하지 않는다.

- [ ] **Step 3: 최소 구현**

`V16__seed_clever_dripper.sql`:

```sql
INSERT INTO brewers (brand, name, type, is_system) VALUES
  ('Clever', 'Clever Dripper', 'IMMERSION', true);
```

> **검증되지 않은 가정:** `brewer_type` enum에 `IMMERSION` 값이 이미 있는지 Step 4에서
> 확인한다. 없으면 `BrewerType`에 새 상수를 추가해야 하고, 이는 `brewers.type` 컬럼이
> `VARCHAR`라 마이그레이션 없이 애플리케이션 코드만 바뀌면 된다(CHECK 제약이 없다는 전제).

`DripperFilter` enum + `RecipeService`에 `resolveBrewerIds(List<DripperFilter> drippers)`:

```java
private Long[] resolveBrewerIds(List<DripperFilter> drippers) {
  if (drippers == null || drippers.isEmpty()) return null;
  return drippers.stream()
      .flatMap(d -> switch (d) {
        case V60 -> brewerRepository.findByNameStartingWithIgnoreCase("V60").stream();
        case KALITA -> brewerRepository.findByBrandIgnoreCase("Kalita").stream();
        case ORIGAMI -> brewerRepository.findByBrandIgnoreCase("Origami").stream();
        case CLEVER -> brewerRepository.findByBrandIgnoreCase("Clever").stream();
      })
      .map(Brewer::getId)
      .toArray(Long[]::new);
}
```

`RecipeController`에 `dripper` 파라미터(`List<DripperFilter>`) 추가, `RecipeService.search()`가
`resolveBrewerIds`를 호출해 `searchPublic`에 넘긴다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeControllerTest' --tests '*RecipeSeedMigrationTest'`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 기구(dripper) 필터와 Clever 시드를 추가한다 (AC-RECIPESBREWS-08·09·10)" && cd backend
```

---

## Task 4: scope=DRAWER + owner 필터, sort 분기 완성

**Files:**
- Create: `backend/src/main/java/com/kaldinote/recipe/domain/RecipeSearchOwner.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/infrastructure/RecipeRepository.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Test: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`

**Covers:** AC-RECIPESBREWS-11, 12, 13, 14, 15, 16, 17, 18, 19, 50(temp·roast·sort·owner 나머지)

**Interfaces:**
- Produces: `RecipeSearchOwner { ALL, MINE, SAVED }`,
  `RecipeRepository.searchDrawer(Long ownerId, String owner, ...): Page<Recipe>`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("AC-RECIPESBREWS-11 · scope=PUBLIC 기본 정렬은 CURATED desc, savedCount desc다")
void 둘러보기_기본_정렬() throws Exception {
  // CURATED 시드 1개(존재한다는 전제 — 없으면 setSourceType으로 재현) + USER 공개 2개(savedCount 5, 1)
  // ... (RecipeForkControllerTest의 setSourceType 패턴 재사용)
}

@Test
@DisplayName("AC-RECIPESBREWS-14 · scope=DRAWER + owner=MINE은 내가 만든 것만 남긴다")
void 서랍_MINE_필터() throws Exception {
  String owner = token();
  createRecipe(owner, """
      {"title":"내가 만든 것","doseG":15.0,"waterG":250.0}
      """);
  String publicId = createdId(createRecipe(owner, """
      {"title":"담을 원본","doseG":15.0,"waterG":250.0,"visibility":"PUBLIC"}
      """)).toString();
  mockMvc.perform(post("/api/v1/recipes/" + publicId + "/fork")
      .header(HttpHeaders.AUTHORIZATION, owner)); // 자기 것을 포크(테스트 단순화)

  listRecipes(owner, "?scope=DRAWER&owner=MINE")
      .andExpect(jsonPath("$.content[?(@.parentRecipeId)].length()").value(0));
}

@Test
@DisplayName("AC-RECIPESBREWS-17 · scope=DRAWER에서 ownerUserId는 무시되고 호출자 본인 기준이다")
void 서랍은_ownerUserId를_무시한다() throws Exception {
  String a = token();
  String b = tokenOf(newUser("recipesbrews-17b"));
  createRecipe(a, """
      {"title":"A의 레시피","doseG":15.0,"waterG":250.0}
      """);
  Long bUserId = /* AuthenticatedUser에서 추출하는 기존 헬퍼 재사용 */ 0L;

  listRecipes(a, "?scope=DRAWER&ownerUserId=" + bUserId)
      .andExpect(jsonPath("$.content[?(@.title == 'A의 레시피')].length()").value(1));
}

@Test
@DisplayName("AC-RECIPESBREWS-13 · scope=DRAWER에서 sort는 무시된다(400 아님)")
void 서랍에서_sort는_무시된다() throws Exception {
  listRecipes(token(), "?scope=DRAWER&sort=RECENT").andExpect(status().isOk());
}

@Test
@DisplayName("AC-RECIPESBREWS-18 · scope=PUBLIC에서 owner는 무시된다(400 아님)")
void 둘러보기에서_owner는_무시된다() throws Exception {
  listRecipes(token(), "?scope=PUBLIC&owner=MINE").andExpect(status().isOk());
}

@Test
@DisplayName("AC-RECIPESBREWS-50 · scope에 잘못된 값을 보내면 400이다")
void scope_잘못된_값은_400() throws Exception {
  listRecipes(token(), "?scope=INVALID")
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: FAIL — `owner` 무시·`scope=DRAWER` 분기·enum 파싱 400이 아직 없다.

- [ ] **Step 3: 최소 구현**

`RecipeSearchOwner` enum. `RecipeRepository.searchDrawer`(네이티브, `owner_user_id = :ownerId
or (parent_recipe_id is not null and exists(...))` 형태로 "내가 만든 것 + 담아온 것" 조건,
`owner` 파라미터로 `MINE`(`parent_recipe_id is null`)/`SAVED`(`parent_recipe_id is not
null`)/`ALL`(둘 다) 분기, 정렬은 항상 `created_at desc, id desc` 고정).

`RecipeService.search()`에서 `scope == DRAWER`면 `ownerUserId`·`sort` 파라미터를 무시하고
`userId`(호출자)로 `searchDrawer` 호출. `scope == PUBLIC`이면 `owner` 무시.

Spring이 잘못된 enum 쿼리 파라미터를 바인딩 실패시키면 `MethodArgumentTypeMismatchException`이
나가는데, 이건 `GlobalExceptionHandler`에 이미 400/`INVALID_REQUEST`로 매핑돼 있는지 Step 4에서
확인한다 — 없으면 이 태스크에서 핸들러를 추가한다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 내 서랍/owner 필터와 정렬 분기를 완성한다 (AC-RECIPESBREWS-11~19·50·51)" && cd backend
```

---

## Task 5: 잔 통계 API

**Files:**
- Create: `backend/src/main/java/com/kaldinote/brewlog/presentation/dto/BrewLogStatsResponse.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/infrastructure/BrewLogRepository.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/presentation/BrewLogController.java`
- Test: `backend/src/test/java/com/kaldinote/brewlog/presentation/BrewLogControllerTest.java`

**Covers:** AC-RECIPESBREWS-21, 22, 23, 24, 25, 26, 27, 28, 29

**Interfaces:**
- Produces: `BrewLogStatsResponse(Integer monthCount, BigDecimal averageRating, BigDecimal
  favoriteDoseG, Long favoriteRecipeId, String favoriteRecipeTitle)`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("AC-RECIPESBREWS-21 · monthCount가 이번 달(KST) 건수다")
void 이번달_건수() throws Exception {
  String token = token("테스터");
  // 이번 달 2건, 지난달 1건 생성(saveBrewLogAt 헬퍼 재사용, 날짜만 다르게)
  // ...
  mockMvc.perform(get("/api/v1/brew-logs/stats").header(HttpHeaders.AUTHORIZATION, token))
      .andExpect(jsonPath("$.monthCount").value(2));
}

@Test
@DisplayName("AC-RECIPESBREWS-22 · averageRating이 소수 1자리 HALF_UP이다")
void 평균_별점_반올림() throws Exception {
  // rating 4.0, 4.5, 4.5인 로그 3건
  mockMvc.perform(get("/api/v1/brew-logs/stats").header(HttpHeaders.AUTHORIZATION, token))
      .andExpect(jsonPath("$.averageRating").value(4.3));
}

@Test
@DisplayName("AC-RECIPESBREWS-28 · 기록이 0건이면 통계가 전부 0/null이다")
void 기록_0건_통계() throws Exception {
  String token = token("빈사용자");
  mockMvc.perform(get("/api/v1/brew-logs/stats").header(HttpHeaders.AUTHORIZATION, token))
      .andExpect(jsonPath("$.monthCount").value(0))
      .andExpect(jsonPath("$.averageRating").doesNotExist())
      .andExpect(jsonPath("$.favoriteDoseG").doesNotExist())
      .andExpect(jsonPath("$.favoriteRecipeId").doesNotExist());
}

@Test
@DisplayName("AC-RECIPESBREWS-25 · favoriteDoseG 동점이면 최근 값이다")
void 최빈_원두량_동점_최근값() throws Exception {
  // actualDoseG 15.0(3일 전), 20.0(1일 전) 각 1건
  mockMvc.perform(get("/api/v1/brew-logs/stats").header(HttpHeaders.AUTHORIZATION, token))
      .andExpect(jsonPath("$.favoriteDoseG").value(20.0));
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: FAIL — `/brew-logs/stats` 경로가 없어 404(또는 `/{id}`로 잘못 매칭돼 400/404).

- [ ] **Step 3: 최소 구현**

`BrewLogRepository`에 통계용 네이티브 쿼리 4개(월별 건수, 평균 별점, 최빈 원두량 — `mode()
within group`이 동점 처리를 안 해주므로 `group by actual_dose_g order by count(*) desc,
max(brewed_at) desc limit 1`로 직접 계산, 즐겨 쓰는 레시피 — `group by recipe_id order by
count(*) desc, max(brewed_at) desc limit 1`, `recipe_id is null`(스냅샷 전용 잔)은 제외).

`BrewLogController`에 `@GetMapping("/stats")`를 **`@GetMapping("/{id}")`보다 먼저 선언**한다
(경로 매칭 순서 — `/stats`가 `{id}`로 잘못 캡처되지 않게).

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(brewlog): 내 잔 통계 4칸 API를 추가한다 (AC-RECIPESBREWS-21~29)" && cd backend
```

---

## Task 6: 담기(POST /recipes/{id}/fork) 바디 지원

**Files:**
- Create: `backend/src/main/java/com/kaldinote/recipe/presentation/dto/ForkRequest.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/presentation/RecipeController.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Test: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeForkControllerTest.java`

**Covers:** AC-RECIPESBREWS-30, 31, 32, 33, 52, 53(회귀), 54(회귀)

**Interfaces:**
- Produces: `ForkRequest`(모든 필드 nullable, `CreateRecipeRequest`와 같은 Bean Validation
  제약이되 `@NotNull` 없음)
- Consumes: `Recipe.forkFrom(original, userId, sourceAuthorName)`(기존, Task 3 of RECIPEV2에서
  만듦) — 시그니처 변경 없이 fork 이후 `applyUpdate`류 덮어쓰기만 추가한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("AC-RECIPESBREWS-30 · 바디 없이 fork하면 원본 그대로 복제된다")
void 바디_없이_fork는_원본_그대로() throws Exception {
  User a = newUser("recipesbrews-30a");
  User b = newUser("recipesbrews-30b");
  Long r1 = recipeWith(tokenOf(a), "PUBLIC"); // doseG 15.0

  forkRecipe(tokenOf(b), r1) // 바디 없음(기존 헬퍼)
      .andExpect(status().isCreated())
      .andExpect(jsonPath("$.doseG").value(15.0));
}

@Test
@DisplayName("AC-RECIPESBREWS-31 · 바디로 넘긴 필드는 그 값으로 저장된다")
void 바디_필드는_덮어써진다() throws Exception {
  User a = newUser("recipesbrews-31a");
  User b = newUser("recipesbrews-31b");
  Long r1 = recipeWith(tokenOf(a), "PUBLIC");

  mockMvc.perform(post("/api/v1/recipes/" + r1 + "/fork")
          .header(HttpHeaders.AUTHORIZATION, tokenOf(b))
          .contentType(MediaType.APPLICATION_JSON)
          .content("""
              {"doseG": 16.0}
              """))
      .andExpect(status().isCreated())
      .andExpect(jsonPath("$.doseG").value(16.0));
}

@Test
@DisplayName("AC-RECIPESBREWS-32 · 생략한 필드는 원본 값을 물려받는다")
void 생략한_필드는_원본값() throws Exception {
  User a = newUser("recipesbrews-32a");
  User b = newUser("recipesbrews-32b");
  Long r1 = recipeWith(tokenOf(a), "PUBLIC"); // waterG 250.0

  mockMvc.perform(post("/api/v1/recipes/" + r1 + "/fork")
          .header(HttpHeaders.AUTHORIZATION, tokenOf(b))
          .contentType(MediaType.APPLICATION_JSON)
          .content("""
              {"doseG": 16.0}
              """))
      .andExpect(jsonPath("$.waterG").value(250.0));
}

@Test
@DisplayName("AC-RECIPESBREWS-52 · 담기 바디 검증 실패는 400이다")
void 담기_바디_검증_실패는_400() throws Exception {
  User a = newUser("recipesbrews-52a");
  User b = newUser("recipesbrews-52b");
  Long r1 = recipeWith(tokenOf(a), "PUBLIC");

  mockMvc.perform(post("/api/v1/recipes/" + r1 + "/fork")
          .header(HttpHeaders.AUTHORIZATION, tokenOf(b))
          .contentType(MediaType.APPLICATION_JSON)
          .content("""
              {"doseG": -1.0}
              """))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeForkControllerTest'`
Expected: FAIL — `fork()`가 `@RequestBody`를 받지 않아 바디를 보내도 무시되고(AC-31·32
실패), 검증도 없다(AC-52 실패, 400 대신 201).

- [ ] **Step 3: 최소 구현**

`ForkRequest`(모든 필드 optional, 값 범위 제약은 `CreateRecipeRequest`와 동일하게 복사 —
`@DecimalMin`/`@DecimalMax` 등, `@NotNull`만 뺀다).

`RecipeController.fork()`에 `@RequestBody(required = false) @Valid ForkRequest request` 추가.

`RecipeService.fork()`에서 `Recipe.forkFrom(...)`로 원본 그대로 복제한 뒤, `request`의
null이 아닌 필드만 `fork` 위에 덮어쓴다(패턴은 `RecipeService.update()`의 `null이면 유지`
방식과 반대 — 여기는 `null이면 원본값 유지, 아니면 교체`이므로 새 메서드
`Recipe.applyForkOverrides(ForkRequest)`를 추가한다).

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeForkControllerTest'`
Expected: PASS. 기존 AC-FORK-*·AC-RECIPEV2-12~14(sourceAuthorName)도 함께 재확인한다.

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 담기(fork)가 바디로 값을 덮어써 한 번에 생성한다 (AC-RECIPESBREWS-30·31·32·33·52)" && cd backend
```

---

## 완료 기준

- [ ] `cd backend && ./gradlew clean check` 통과
- [ ] `./scripts/check-spec-coverage.sh` 통과
- [ ] 스펙의 `status`를 `구현완료`로 변경
- [ ] 회귀 확인: 기존 `AC-LIST-*`(목록 기본 동작)·`AC-FORK-*`·`AC-VIS-*`·`AC-RECIPEV2-*`
      전부 통과
- [ ] 수동 확인 없음(스펙에 명시됨)

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 39개(`01~33`, `19a`, `40~41`, `50~54`) 중 39개가 태스크에 매핑됨.

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음.

**타입 일관성:** `RecipeRepository.searchPublic`의 `brewerIds` 파라미터(Task 2에서 도입,
Task 3에서 실제 값 채움)와 `RecipeSummaryResponse.from`의 `savedCount` 인자(Task 1)가 이후
태스크에서 일관되게 쓰임을 확인함.

**검증되지 않은 가정:**
- **Postgres `= any(:array)` 네이티브 바인딩이 Hibernate 7에서 `String[]`/`Long[]`을 그대로
  받는지** Task 2 Step 4에서 처음 확인된다. 안 되면 컬렉션 파라미터(`IN :list`) 방식으로
  바꾼다.
- **`brewers.type`에 `IMMERSION` enum 값이 이미 있는지** Task 3 Step 4에서 확인한다.
- **`GlobalExceptionHandler`가 쿼리 파라미터 enum 바인딩 실패를 이미 400/`INVALID_REQUEST`로
  매핑하는지** Task 4 Step 4에서 확인한다 — 안 되면 `@ExceptionHandler
  (MethodArgumentTypeMismatchException.class)`를 추가해야 한다.
- **잘못된 `roast[i]`/`dripper[i]` 개별 값(리스트 안의 하나만 틀림)의 400 처리**는 Spring이
  리스트 바인딩 자체를 실패시키는지, 개별 원소만 걸러지는지 Task 4에서 실측 확인한다.

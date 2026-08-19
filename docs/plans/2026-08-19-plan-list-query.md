# 목록 조회 API + 브루잉 로그 수정·삭제 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-08-19-list-query-api.md`

**Goal:** 프론트엔드가 화면을 그릴 수 있게 된다 — 레시피와 브루잉 로그를 페이지 단위로 훑고, 남긴 기록을 고치거나 지우고, 내 프로필과 내 그라인더를 조회할 수 있다.

**Architecture:** 공개범위 판정을 **SQL로 내린다.** 기존 단건 조회는 엔티티를 로드한 뒤 `FollowService.isMutual()`로 자바에서 판정하지만, 목록에서 같은 방식을 쓰면 전체를 메모리에 올려야 해서 `totalElements`와 페이지네이션이 성립하지 않는다. `Follow`에 대한 `exists` 서브쿼리 두 개를 JPQL에 넣어 DB가 걸러내게 한다. 페이지 봉투는 Spring Data `Page<T>`를 그대로 노출하지 않고 `PageResponse<T>`로 감싸 응답 형태를 고정한다.

**작업 위치:** `backend/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-BLEDIT-12 | 삭제하면 204이고 deleted_at이 채워진다 | Task 2 | API 테스트 |
| AC-BLEDIT-13 | 삭제 후 단건 조회는 404다 | Task 2 | API 테스트 |
| AC-BLEDIT-15 | 타인의 로그는 삭제할 수 없다 | Task 2 | API 테스트 |
| AC-BLEDIT-18 | 이미 삭제된 로그를 다시 삭제하면 404다 | Task 2 | API 테스트 |
| AC-LIST-01 | size를 생략하면 20개 | Task 3 | API 테스트 |
| AC-LIST-02 | size=100은 허용 (상한 포함) | Task 3 | API 테스트 |
| AC-LIST-03 | size=1은 허용 (하한 포함) | Task 3 | API 테스트 |
| AC-LIST-04 | page=0이 첫 페이지 | Task 3 | API 테스트 |
| AC-LIST-05 | 첫 페이지 봉투 값이 정확하다 | Task 3 | API 테스트 |
| AC-LIST-06 | 마지막 페이지에서 hasNext=false | Task 3 | API 테스트 |
| AC-LIST-07 | 응답 봉투는 여섯 키만 | Task 3 | API 테스트 |
| AC-LIST-08 | 내 PRIVATE 레시피는 포함 | Task 3 | API 테스트 |
| AC-LIST-09 | 타인의 PRIVATE는 제외 | Task 3 | API 테스트 |
| AC-LIST-10 | 타인의 PUBLIC은 포함 | Task 3 | API 테스트 |
| AC-LIST-11 | 상호 팔로우 FRIENDS는 포함 | Task 3 | API 테스트 |
| AC-LIST-12 | 단방향 팔로우 FRIENDS는 제외 | Task 3 | API 테스트 |
| AC-LIST-13 | 주인 없는 CURATED는 포함 | Task 3 | API 테스트 |
| AC-LIST-14 | 소프트 삭제된 레시피는 제외 | Task 3 | API 테스트 |
| AC-LIST-15 | createdAt 동점이면 id 내림차순 | Task 3 | API 테스트 |
| AC-LIST-16 | ownerUserId 필터 | Task 3 | API 테스트 |
| AC-LIST-17 | 목록 응답에 steps 키 없음 | Task 3 | API 테스트 |
| AC-LIST-28 | size=101은 400 | Task 3 | API 테스트 |
| AC-LIST-29 | size=0은 400 | Task 3 | API 테스트 |
| AC-LIST-30 | page=-1은 400 | Task 3 | API 테스트 |
| AC-LIST-31 | page 초과 시 빈 content | Task 3 | API 테스트 |
| AC-LIST-32 | 볼 것이 없으면 빈 목록 | Task 3 | API 테스트 |
| AC-LIST-33 | 존재하지 않는 ownerUserId는 빈 목록 | Task 3 | API 테스트 |
| AC-LIST-35 | JWT 없이 레시피 목록은 401 | Task 3 | API 테스트 |
| AC-LIST-18 | 타인의 PRIVATE 로그는 제외 | Task 4 | API 테스트 |
| AC-LIST-19 | 상호 팔로우 FRIENDS 로그는 포함 | Task 4 | API 테스트 |
| AC-LIST-20 | recipeId 필터 | Task 4 | API 테스트 |
| AC-LIST-21 | userId 필터 | Task 4 | API 테스트 |
| AC-LIST-22 | beanBatchId 필터 | Task 4 | API 테스트 |
| AC-LIST-23 | 필터 AND 결합 | Task 4 | API 테스트 |
| AC-LIST-24 | brewedAt 내림차순, 동점 id 내림차순 | Task 4 | API 테스트 |
| AC-LIST-25 | 목록 응답에 overallNote 키 없음 | Task 4 | API 테스트 |
| AC-LIST-26 | TDS 없으면 분석 필드만 null | Task 4 | API 테스트 |
| AC-LIST-27 | 소프트 삭제된 로그는 제외 | Task 4 | API 테스트 |
| AC-LIST-34 | 볼 수 없는 recipeId 필터는 빈 목록 | Task 4 | API 테스트 |
| AC-LIST-36 | JWT 없이 로그 목록은 401 | Task 4 | API 테스트 |
| AC-BLEDIT-01 | 보낸 필드만 바뀐다 | Task 5 | API 테스트 |
| AC-BLEDIT-02 | 생략한 필드는 유지 | Task 5 | API 테스트 |
| AC-BLEDIT-03 | 명시적 null도 변경 없음 | Task 5 | API 테스트 |
| AC-BLEDIT-04 | TDS를 넣으면 EY가 계산된다 | Task 5 | API 테스트 |
| AC-BLEDIT-05 | 음료 중량 변경 시 EY가 바뀐다 | Task 5 | API 테스트 |
| AC-BLEDIT-06 | 분쇄도 변경 시 마이크론 재저장 | Task 5 | API 테스트 |
| AC-BLEDIT-07 | brewedAt 변경 시 경과일·디게싱 재저장 | Task 5 | API 테스트 |
| AC-BLEDIT-08 | 재고 삭제 후에도 경과일 유지 | Task 5 | API 테스트 |
| AC-BLEDIT-09 | visibility를 FRIENDS로 바꾸면 상대가 본다 | Task 5 | API 테스트 |
| AC-BLEDIT-10 | recipeId를 보내도 무시된다 | Task 5 | API 테스트 |
| AC-BLEDIT-11 | 레시피 수정해도 스냅샷 불변 | Task 5 | API 테스트 |
| AC-BLEDIT-14 | 타인의 로그는 수정 불가 403 | Task 5 | API 테스트 |
| AC-BLEDIT-16 | 없는 로그 수정은 404 | Task 5 | API 테스트 |
| AC-BLEDIT-17 | 삭제된 로그 수정은 404 | Task 5 | API 테스트 |
| AC-BLEDIT-19 | JWT 없이 수정은 401 | Task 5 | API 테스트 |
| AC-ME-01 | 내 프로필 여섯 필드 | Task 6 | API 테스트 |
| AC-ME-02 | 이메일 없는 사용자도 200 | Task 6 | API 테스트 |
| AC-ME-03 | JWT 없이 프로필은 401 | Task 6 | API 테스트 |
| AC-ME-04 | 그라인더 목록에 모델 정보 펼침 | Task 6 | API 테스트 |
| AC-ME-05 | 타인의 그라인더는 안 보인다 | Task 6 | API 테스트 |
| AC-ME-06 | 없으면 빈 배열 | Task 6 | API 테스트 |
| AC-ME-07 | JWT 없이 그라인더 목록은 401 | Task 6 | API 테스트 |

**Task 1은 AC를 직접 커버하지 않는다.** 페이지 봉투와 파라미터 검증의 기반을 만드는 태스크이고, 그 동작은 Task 3의 컨트롤러 테스트에서 HTTP 레벨로 검증된다. 다만 Task 1 자체도 순수 단위 테스트로 초록이 되어야 한다.

---

## Global Constraints

- **`ConstraintViolationException` 핸들러가 없다.** `GlobalExceptionHandler`는 `MethodArgumentNotValidException`(본문 검증)만 다룬다. 컨트롤러 파라미터에 `@Min`/`@Max`를 붙이면 `ConstraintViolationException`이 나고 `handleUnexpected(Exception)`로 떨어져 **500**이 된다. 따라서 `page`/`size` 검증은 애노테이션이 아니라 `PageParams.of()`에서 `BusinessException(INVALID_REQUEST)`를 던지는 방식으로 한다. 예외 핸들러를 건드리지 않는다.
- **JPQL의 enum 리터럴은 FQCN으로 쓴다.** `r.visibility = com.kaldinote.recipe.domain.RecipeVisibility.PUBLIC` 형태. 짧은 이름은 Hibernate 버전에 따라 해석이 달라진다.
- **`Page<T>`를 컨트롤러 반환 타입으로 노출하지 않는다.** 반드시 `PageResponse.from(page, mapper)`로 감싼다. `AC-LIST-07`이 최상위 키 집합을 정확히 검사한다.
- 기존 `BrewLogRepository.findById(...)` 호출부는 **전부** `findByIdAndDeletedAtIsNull(...)`로 바꾼다. 놓치면 삭제된 로그가 첨부 업로드·단건 조회에서 되살아난다.
- 테스트는 `AbstractIntegrationTest`를 상속하고 `@Transactional`을 붙인다. 컨텍스트 캐시가 깨지지 않도록 `@MockBean`을 쓰지 않는다.

---

## File Structure

```
backend/src/main/
├── java/com/kaldinote/
│   ├── common/response/
│   │   ├── PageResponse.java                      (신규)
│   │   └── PageParams.java                        (신규)
│   ├── brewlog/
│   │   ├── domain/BrewLog.java                    (수정: deletedAt, softDelete, applyPatch)
│   │   ├── infrastructure/BrewLogRepository.java  (수정: findByIdAndDeletedAtIsNull, findVisible)
│   │   ├── application/BrewLogService.java        (수정: list, patch, delete)
│   │   └── presentation/
│   │       ├── BrewLogController.java             (수정: GET 목록, PATCH, DELETE)
│   │       └── dto/
│   │           ├── BrewLogSummaryResponse.java    (신규)
│   │           └── BrewLogPatchRequest.java       (신규)
│   ├── recipe/
│   │   ├── infrastructure/RecipeRepository.java   (수정: findVisible)
│   │   ├── application/RecipeService.java         (수정: list)
│   │   └── presentation/
│   │       ├── RecipeController.java              (수정: GET 목록)
│   │       └── dto/RecipeSummaryResponse.java     (신규)
│   ├── gear/
│   │   ├── presentation/GearController.java       (수정: GET /user-grinders)
│   │   ├── application/GearService.java           (수정: findMyGrinders)
│   │   └── presentation/dto/UserGrinderResponse.java (신규)
│   └── user/
│       ├── presentation/UserController.java       (신규)
│       ├── application/UserService.java           (신규)
│       └── presentation/dto/MeResponse.java       (신규)
└── resources/db/migration/
    └── V10__add_brew_logs_deleted_at.sql          (신규)

backend/src/test/java/com/kaldinote/
├── common/response/PageParamsTest.java            (신규)
├── recipe/presentation/RecipeControllerTest.java  (수정)
├── brewlog/presentation/BrewLogControllerTest.java(수정)
├── gear/presentation/GearControllerTest.java      (수정)
└── user/presentation/UserControllerTest.java      (신규)
```

---

## Task 1: 페이지 봉투와 파라미터 검증

**Files:**
- Create: `backend/src/main/java/com/kaldinote/common/response/PageResponse.java`
- Create: `backend/src/main/java/com/kaldinote/common/response/PageParams.java`
- Test: `backend/src/test/java/com/kaldinote/common/response/PageParamsTest.java`

**Covers:** 없음 (기반 태스크. 동작은 Task 3의 `AC-LIST-01~07`, `AC-LIST-28~30`이 HTTP 레벨로 검증한다)

**Interfaces:**
- Produces: `PageParams.of(Integer page, Integer size)` → `PageParams`, `PageParams.toPageable(Sort)` → `Pageable`
- Produces: `PageResponse.from(Page<E> page, Function<E, T> mapper)` → `PageResponse<T>`

- [x] **Step 1: 실패하는 테스트 작성**

```java
package com.kaldinote.common.response;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PageParamsTest {

  @Test
  @DisplayName("생략하면 page 0, size 20이 된다")
  void 생략하면_기본값이_적용된다() {
    PageParams params = PageParams.of(null, null);
    assertThat(params.page()).isZero();
    assertThat(params.size()).isEqualTo(20);
  }

  @Test
  @DisplayName("size 100은 상한 포함이라 허용된다")
  void size_100은_허용된다() {
    assertThat(PageParams.of(0, 100).size()).isEqualTo(100);
  }

  @Test
  @DisplayName("size 1은 하한 포함이라 허용된다")
  void size_1은_허용된다() {
    assertThat(PageParams.of(0, 1).size()).isEqualTo(1);
  }

  @Test
  @DisplayName("size 101은 상한 바로 바깥이라 거절된다")
  void size_101은_거절된다() {
    assertThatThrownBy(() -> PageParams.of(0, 101))
        .isInstanceOf(BusinessException.class)
        .extracting(e -> ((BusinessException) e).getErrorCode())
        .isEqualTo(ErrorCode.INVALID_REQUEST);
  }

  @Test
  @DisplayName("size 0은 하한 바로 바깥이라 거절된다")
  void size_0은_거절된다() {
    assertThatThrownBy(() -> PageParams.of(0, 0)).isInstanceOf(BusinessException.class);
  }

  @Test
  @DisplayName("page 음수는 거절된다")
  void page_음수는_거절된다() {
    assertThatThrownBy(() -> PageParams.of(-1, 20)).isInstanceOf(BusinessException.class);
  }
}
```

> `BusinessException.getErrorCode()`의 실제 이름은 구현 전에 `BusinessException.java`에서 확인하고 맞춘다. 다르면 이 테스트의 `extracting` 줄만 고친다.

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*PageParamsTest'`
Expected: FAIL — `PageParams` 클래스가 없어 컴파일 실패

- [x] **Step 3: 최소 구현**

```java
package com.kaldinote.common.response;

import com.kaldinote.common.error.BusinessException;
import com.kaldinote.common.error.ErrorCode;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

/**
 * 목록 조회의 page/size를 검증해 담는다.
 *
 * <p>검증을 Bean Validation 애노테이션으로 하지 않는 이유: 컨트롤러 파라미터에 걸면
 * ConstraintViolationException이 나는데 GlobalExceptionHandler에 그 핸들러가 없어 500이 된다.
 */
public record PageParams(int page, int size) {

  private static final int DEFAULT_SIZE = 20;
  private static final int MIN_SIZE = 1;
  private static final int MAX_SIZE = 100;

  public static PageParams of(Integer page, Integer size) {
    int p = page == null ? 0 : page;
    int s = size == null ? DEFAULT_SIZE : size;
    if (p < 0) {
      throw new BusinessException(ErrorCode.INVALID_REQUEST, "page는 0 이상이어야 합니다: " + p);
    }
    if (s < MIN_SIZE || s > MAX_SIZE) {
      throw new BusinessException(
          ErrorCode.INVALID_REQUEST,
          "size는 %d 이상 %d 이하여야 합니다: %d".formatted(MIN_SIZE, MAX_SIZE, s));
    }
    return new PageParams(p, s);
  }

  public Pageable toPageable(Sort sort) {
    return PageRequest.of(page, size, sort);
  }
}
```

```java
package com.kaldinote.common.response;

import java.util.List;
import java.util.function.Function;
import org.springframework.data.domain.Page;

/**
 * 목록 응답 봉투. Spring Data의 Page를 그대로 직렬화하면 pageable·sort·empty 같은 내부 필드가
 * 노출되고 Spring 버전에 따라 형태가 바뀌므로 여기서 여섯 키로 고정한다.
 */
public record PageResponse<T>(
    List<T> content, int page, int size, long totalElements, int totalPages, boolean hasNext) {

  public static <E, T> PageResponse<T> from(Page<E> page, Function<E, T> mapper) {
    return new PageResponse<>(
        page.getContent().stream().map(mapper).toList(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages(),
        page.hasNext());
  }
}
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*PageParamsTest'`
Expected: PASS, 6 tests

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(common): 목록 조회용 PageResponse·PageParams 추가" && cd backend
```

---

## Task 2: 브루잉 로그 소프트 삭제

**Files:**
- Create: `backend/src/main/resources/db/migration/V10__add_brew_logs_deleted_at.sql`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/domain/BrewLog.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/infrastructure/BrewLogRepository.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/presentation/BrewLogController.java`
- Test: `backend/src/test/java/com/kaldinote/brewlog/presentation/BrewLogControllerTest.java`

**Covers:** AC-BLEDIT-12, AC-BLEDIT-13, AC-BLEDIT-15, AC-BLEDIT-18

**Interfaces:**
- Consumes: 없음
- Produces: `BrewLog.softDelete()`, `BrewLogRepository.findByIdAndDeletedAtIsNull(Long)`, `BrewLogService.delete(Long userId, Long brewLogId)`

- [x] **Step 1: 실패하는 테스트 작성**

`BrewLogControllerTest`에 추가한다. `token(...)`, `createdId(...)` 등 기존 헬퍼를 그대로 쓴다.

```java
@Test
@DisplayName("AC-BLEDIT-12 · 삭제하면 204이고 deleted_at이 채워진다")
void 삭제하면_204이고_deleted_at이_채워진다() throws Exception {
  String token = token("삭제자");
  Long logId = createBrewLog(token);

  mockMvc
      .perform(delete("/api/v1/brew-logs/" + logId).header(HttpHeaders.AUTHORIZATION, token))
      .andExpect(status().isNoContent());

  assertThat(brewLogRepository.findById(logId).orElseThrow().getDeletedAt()).isNotNull();
}

@Test
@DisplayName("AC-BLEDIT-13 · 삭제 후 단건 조회는 404다")
void 삭제_후_단건_조회는_404다() throws Exception {
  String token = token("삭제자2");
  Long logId = createBrewLog(token);

  mockMvc.perform(delete("/api/v1/brew-logs/" + logId).header(HttpHeaders.AUTHORIZATION, token));

  mockMvc
      .perform(get("/api/v1/brew-logs/" + logId).header(HttpHeaders.AUTHORIZATION, token))
      .andExpect(status().isNotFound())
      .andExpect(jsonPath("$.code").value("NOT_FOUND"));
}

@Test
@DisplayName("AC-BLEDIT-15 · 타인의 로그는 삭제할 수 없다")
void 타인의_로그는_삭제할_수_없다() throws Exception {
  String owner = token("주인");
  String other = token("남");
  Long logId = createBrewLog(owner);

  mockMvc
      .perform(delete("/api/v1/brew-logs/" + logId).header(HttpHeaders.AUTHORIZATION, other))
      .andExpect(status().isForbidden())
      .andExpect(jsonPath("$.code").value("FORBIDDEN"));
}

@Test
@DisplayName("AC-BLEDIT-18 · 이미 삭제된 로그를 다시 삭제하면 404다")
void 이미_삭제된_로그를_다시_삭제하면_404다() throws Exception {
  String token = token("삭제자3");
  Long logId = createBrewLog(token);

  mockMvc.perform(delete("/api/v1/brew-logs/" + logId).header(HttpHeaders.AUTHORIZATION, token));

  mockMvc
      .perform(delete("/api/v1/brew-logs/" + logId).header(HttpHeaders.AUTHORIZATION, token))
      .andExpect(status().isNotFound())
      .andExpect(jsonPath("$.code").value("NOT_FOUND"));
}
```

기존 테스트에 브루잉 로그를 만드는 흐름이 흩어져 있으므로, 재사용 헬퍼를 하나 뽑아 둔다. 기존 생성 테스트가 쓰는 본문을 그대로 옮긴다.

```java
/** 원두 재고·그라인더·레시피까지 갖춘 브루잉 로그 하나를 만들고 id를 돌려준다. */
private Long createBrewLog(String token) throws Exception {
  Long recipeId = recipeId(token);
  Long batchId = beanBatchId(token);
  Long grinderId = userGrinderId(token, c40Id());
  return createdId(
      mockMvc.perform(
          post("/api/v1/brew-logs")
              .header(HttpHeaders.AUTHORIZATION, token)
              .contentType(MediaType.APPLICATION_JSON)
              .content(
                  """
                  {"recipeId":%d,"beanBatchId":%d,"brewedAt":"%s",
                   "actualDoseG":15.0,"actualWaterG":250.0,"actualWaterTempC":93.0,
                   "userGrinderId":%d,"actualGrindSettingValue":22.0}
                  """
                      .formatted(recipeId, batchId, BREWED_AT, grinderId))));
}
```

> `beanBatchId(String)` 헬퍼는 기존 테스트에 이미 있는지 먼저 확인한다. 없으면 기존 생성 테스트의 원두 재고 생성 부분을 같은 형태로 뽑아낸다.

`@Autowired private BrewLogRepository brewLogRepository;` 와 `import static org.assertj.core.api.Assertions.assertThat;`를 추가한다.

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: FAIL — `DELETE /api/v1/brew-logs/{id}` 매핑이 없어 405, `getDeletedAt()` 컴파일 실패

- [x] **Step 3: 최소 구현**

`V10__add_brew_logs_deleted_at.sql`:

```sql
-- 브루잉 로그 소프트 삭제. recipes·bean_batches와 같은 패턴이다.
ALTER TABLE brew_logs ADD COLUMN deleted_at TIMESTAMPTZ;

-- 목록 조회는 항상 살아 있는 행만 훑고 brewed_at DESC, id DESC로 정렬한다.
CREATE INDEX idx_brew_logs_alive
    ON brew_logs (brewed_at DESC, id DESC)
    WHERE deleted_at IS NULL;

-- 레시피 목록도 같은 형태의 정렬을 쓴다.
CREATE INDEX idx_recipes_alive
    ON recipes (created_at DESC, id DESC)
    WHERE deleted_at IS NULL;
```

`BrewLog.java`에 필드와 메서드 추가:

```java
  @Column(name = "deleted_at")
  private Instant deletedAt;

  public void softDelete() {
    this.deletedAt = Instant.now();
  }
```

`BrewLogRepository.java`:

```java
public interface BrewLogRepository extends JpaRepository<BrewLog, Long> {
  Optional<BrewLog> findByIdAndDeletedAtIsNull(Long id);
}
```

`BrewLogService.java` — 기존 `findById` 호출부를 전부 바꾸고 삭제를 추가한다.

```java
  @Transactional
  public void delete(Long userId, Long brewLogId) {
    requireOwnedLog(userId, brewLogId).softDelete();
  }

  /** 소유자 전용 동작(수정·삭제)의 공통 조회. 검증 순서는 404 → 403이다. */
  private BrewLog requireOwnedLog(Long userId, Long brewLogId) {
    BrewLog log =
        brewLogRepository
            .findByIdAndDeletedAtIsNull(brewLogId)
            .orElseThrow(
                () ->
                    new BusinessException(ErrorCode.NOT_FOUND, "브루잉 로그를 찾을 수 없습니다: " + brewLogId));
    if (!log.isOwnedBy(userId)) {
      throw new BusinessException(ErrorCode.FORBIDDEN, "본인의 브루잉 로그만 수정·삭제할 수 있습니다.");
    }
    return log;
  }
```

기존 `findViewable(...)`, `requireOwned(...)`, `requireViewable(...)`의 `brewLogRepository.findById(` 를 **모두** `brewLogRepository.findByIdAndDeletedAtIsNull(` 로 바꾼다.

`BrewLogController.java`:

```java
  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(@PathVariable Long id, AuthenticatedUser user) {
    brewLogService.delete(user.id(), id);
  }
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: PASS — 기존 테스트 전부 + 신규 4개

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(brewlog): 브루잉 로그 소프트 삭제 (AC-BLEDIT-12·13·15·18)" && cd backend
```

---

## Task 3: 레시피 목록 조회

**Files:**
- Create: `backend/src/main/java/com/kaldinote/recipe/presentation/dto/RecipeSummaryResponse.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/infrastructure/RecipeRepository.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/application/RecipeService.java`
- Modify: `backend/src/main/java/com/kaldinote/recipe/presentation/RecipeController.java`
- Test: `backend/src/test/java/com/kaldinote/recipe/presentation/RecipeControllerTest.java`

**Covers:** AC-LIST-01 ~ AC-LIST-17, AC-LIST-28 ~ AC-LIST-33, AC-LIST-35

**Interfaces:**
- Consumes: `PageParams.of(...)`, `PageResponse.from(...)` (Task 1)
- Produces: `RecipeRepository.findVisible(Long viewerId, Long ownerUserId, Pageable)` → `Page<Recipe>`, `RecipeSummaryResponse.from(Recipe)`

- [x] **Step 1: 실패하는 테스트 작성**

대표 4개만 싣는다. 나머지는 같은 형태로 스펙의 Given/When/Then을 그대로 옮긴다.

```java
@Test
@DisplayName("AC-LIST-05 · 47건에서 첫 페이지 봉투 값이 정확하다")
void 첫_페이지_봉투_값이_정확하다() throws Exception {
  String token = token("목록주인");
  for (int i = 0; i < 47; i++) {
    createRecipe(token, "레시피 " + i);
  }

  mockMvc
      .perform(get("/api/v1/recipes?page=0&size=20").header(HttpHeaders.AUTHORIZATION, token))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.content.length()").value(20))
      .andExpect(jsonPath("$.page").value(0))
      .andExpect(jsonPath("$.size").value(20))
      .andExpect(jsonPath("$.totalElements").value(47))
      .andExpect(jsonPath("$.totalPages").value(3))
      .andExpect(jsonPath("$.hasNext").value(true));
}

@Test
@DisplayName("AC-LIST-07 · 응답 봉투는 여섯 키만 갖는다")
void 응답_봉투는_여섯_키만_갖는다() throws Exception {
  String token = token("봉투확인");
  createRecipe(token, "하나");

  String body =
      mockMvc
          .perform(get("/api/v1/recipes").header(HttpHeaders.AUTHORIZATION, token))
          .andExpect(status().isOk())
          .andReturn()
          .getResponse()
          .getContentAsString();

  assertThat(JsonPath.<Map<String, Object>>read(body, "$").keySet())
      .containsExactlyInAnyOrder(
          "content", "page", "size", "totalElements", "totalPages", "hasNext");
}

@Test
@DisplayName("AC-LIST-12 · 단방향 팔로우 상대의 FRIENDS 레시피는 제외된다")
void 단방향_팔로우_상대의_FRIENDS_레시피는_제외된다() throws Exception {
  String a = token("에이");
  String b = token("비");
  Long bId = userIdOf(b);
  Long recipeId = createRecipe(b, "비의 FRIENDS 레시피");
  setVisibility(b, recipeId, "FRIENDS");

  // A만 B를 팔로우한다 (단방향)
  mockMvc.perform(post("/api/v1/users/" + bId + "/follow").header(HttpHeaders.AUTHORIZATION, a));

  mockMvc
      .perform(get("/api/v1/recipes").header(HttpHeaders.AUTHORIZATION, a))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.content[?(@.id == " + recipeId + ")]").isEmpty());
}

@Test
@DisplayName("AC-LIST-28 · size=101은 400이다")
void size_101은_400이다() throws Exception {
  mockMvc
      .perform(get("/api/v1/recipes?size=101").header(HttpHeaders.AUTHORIZATION, token("경계")))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
}
```

필요한 헬퍼:

```java
/** JWT에서 사용자 id를 꺼낸다. 팔로우 API가 경로에 상대 id를 요구한다. */
private Long userIdOf(String bearerToken) {
  return Long.valueOf(
      tokenProvider.parse(bearerToken.substring("Bearer ".length())).getSubject());
}

private Long createRecipe(String token, String title) throws Exception {
  return createdId(
      mockMvc.perform(
          post("/api/v1/recipes")
              .header(HttpHeaders.AUTHORIZATION, token)
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {"title":"%s","doseG":15.0,"waterG":250.0}
                  """.formatted(title))));
}

private void setVisibility(String token, Long recipeId, String visibility) throws Exception {
  mockMvc.perform(
      put("/api/v1/recipes/" + recipeId)
          .header(HttpHeaders.AUTHORIZATION, token)
          .contentType(MediaType.APPLICATION_JSON)
          .content("""
              {"title":"제목","doseG":15.0,"waterG":250.0,"visibility":"%s"}
              """.formatted(visibility)));
}
```

> `tokenProvider.parse(...)`의 실제 메서드명은 `JwtTokenProvider`에서 확인해 맞춘다. 없으면 `userRepository`에 저장한 `User`의 id를 `token(...)` 헬퍼가 함께 돌려주도록 바꾸는 편이 간단하다.

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: FAIL — `GET /api/v1/recipes` 매핑이 없어 405 또는 404

- [x] **Step 3: 최소 구현**

`RecipeRepository.java`:

```java
  /**
   * 목록용 공개범위 판정. 단건 조회는 엔티티를 로드한 뒤 자바에서 판정하지만, 목록은 전체를
   * 메모리에 올릴 수 없어 상호 팔로우 판정을 exists 서브쿼리 두 개로 SQL에 내린다.
   */
  @Query(
      """
      select r from Recipe r
      where r.deletedAt is null
        and (:ownerUserId is null or r.ownerUserId = :ownerUserId)
        and ( r.ownerUserId = :viewerId
           or r.visibility = com.kaldinote.recipe.domain.RecipeVisibility.PUBLIC
           or ( r.visibility = com.kaldinote.recipe.domain.RecipeVisibility.FRIENDS
                and exists (select 1 from Follow f1
                            where f1.followerUserId = :viewerId
                              and f1.followeeUserId = r.ownerUserId)
                and exists (select 1 from Follow f2
                            where f2.followerUserId = r.ownerUserId
                              and f2.followeeUserId = :viewerId) ) )
      """)
  Page<Recipe> findVisible(
      @Param("viewerId") Long viewerId,
      @Param("ownerUserId") Long ownerUserId,
      Pageable pageable);
```

`RecipeSummaryResponse.java` — `RecipeResponse`에서 `steps`만 뺀 22개 필드. `ratio` 계산은 `RecipeResponse`의 것을 그대로 옮긴다.

```java
package com.kaldinote.recipe.presentation.dto;

import com.kaldinote.recipe.domain.Recipe;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

/** 목록 항목용. RecipeResponse에서 steps만 뺐다. 목록 쿼리가 스텝을 가져오지 않아 N+1을 피한다. */
public record RecipeSummaryResponse(
    Long id,
    Long ownerUserId,
    String sourceType,
    String title,
    String description,
    String brewMethod,
    String visibility,
    Long parentRecipeId,
    Long forkRootId,
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
    Instant createdAt,
    Instant updatedAt) {

  private static final int DIVISION_SCALE = 6;
  private static final int RATIO_SCALE = 1;

  public static RecipeSummaryResponse from(Recipe r) {
    return new RecipeSummaryResponse(
        r.getId(),
        r.getOwnerUserId(),
        r.getSourceType().name(),
        r.getTitle(),
        r.getDescription(),
        r.getBrewMethod().name(),
        r.getVisibility().name(),
        r.getParentRecipeId(),
        r.getForkRootId(),
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
        r.getCreatedAt(),
        r.getUpdatedAt());
  }

  private static BigDecimal ratio(BigDecimal waterG, BigDecimal doseG) {
    if (waterG == null || doseG == null || doseG.signum() == 0) {
      return null;
    }
    return waterG
        .divide(doseG, DIVISION_SCALE, RoundingMode.HALF_UP)
        .setScale(RATIO_SCALE, RoundingMode.HALF_UP);
  }
}
```

`RecipeService.java`:

```java
  private static final Sort LIST_SORT =
      Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));

  public PageResponse<RecipeSummaryResponse> list(Long viewerId, Long ownerUserId, PageParams params) {
    return PageResponse.from(
        recipeRepository.findVisible(viewerId, ownerUserId, params.toPageable(LIST_SORT)),
        RecipeSummaryResponse::from);
  }
```

`RecipeController.java`:

```java
  @GetMapping
  public PageResponse<RecipeSummaryResponse> list(
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size,
      @RequestParam(required = false) Long ownerUserId,
      AuthenticatedUser user) {
    return recipeService.list(user.id(), ownerUserId, PageParams.of(page, size));
  }
```

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*RecipeControllerTest'`
Expected: PASS — 기존 테스트 전부 + 신규 24개

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(recipe): 레시피 목록 조회 + 공개범위 SQL 판정 (AC-LIST-01~17·28~33·35)" && cd backend
```

---

## Task 4: 브루잉 로그 목록 조회

**Files:**
- Create: `backend/src/main/java/com/kaldinote/brewlog/presentation/dto/BrewLogSummaryResponse.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/infrastructure/BrewLogRepository.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/presentation/BrewLogController.java`
- Test: `backend/src/test/java/com/kaldinote/brewlog/presentation/BrewLogControllerTest.java`

**Covers:** AC-LIST-18 ~ AC-LIST-27, AC-LIST-34, AC-LIST-36

**Interfaces:**
- Consumes: `PageParams`, `PageResponse` (Task 1), `BrewLog.getDeletedAt()` (Task 2)
- Produces: `BrewLogRepository.findVisible(...)` → `Page<BrewLog>`, `BrewLogSummaryResponse.from(BrewLog, ExtractionAnalysis)`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("AC-LIST-20 · recipeId 필터가 해당 레시피의 기록만 남긴다")
void recipeId_필터가_해당_레시피의_기록만_남긴다() throws Exception {
  String token = token("필터주인");
  Long batchId = beanBatchId(token);
  Long grinderId = userGrinderId(token, c40Id());
  Long recipeA = recipeId(token);
  Long recipeB = recipeId(token);

  createBrewLogWith(token, recipeA, batchId, grinderId);
  createBrewLogWith(token, recipeA, batchId, grinderId);
  createBrewLogWith(token, recipeA, batchId, grinderId);
  createBrewLogWith(token, recipeB, batchId, grinderId);
  createBrewLogWith(token, recipeB, batchId, grinderId);

  mockMvc
      .perform(
          get("/api/v1/brew-logs?recipeId=" + recipeA).header(HttpHeaders.AUTHORIZATION, token))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.totalElements").value(3))
      .andExpect(jsonPath("$.content[*].recipeId").value(everyItem(equalTo(recipeA.intValue()))));
}

@Test
@DisplayName("AC-LIST-25 · 목록 응답에 overallNote 키가 없다")
void 목록_응답에_overallNote_키가_없다() throws Exception {
  String token = token("요약확인");
  createBrewLog(token);

  mockMvc
      .perform(get("/api/v1/brew-logs").header(HttpHeaders.AUTHORIZATION, token))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.content[0].overallNote").doesNotExist())
      .andExpect(jsonPath("$.content[0].actualDoseG").exists());
}

@Test
@DisplayName("AC-LIST-26 · TDS가 없는 로그도 목록에 나오고 분석 필드가 null이다")
void TDS가_없는_로그도_목록에_나오고_분석_필드가_null이다() throws Exception {
  String token = token("TDS없음");
  createBrewLog(token); // tdsPercent를 보내지 않는다

  mockMvc
      .perform(get("/api/v1/brew-logs").header(HttpHeaders.AUTHORIZATION, token))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.content[0].extractionYieldPercent").doesNotExist())
      .andExpect(jsonPath("$.content[0].strengthZone").doesNotExist())
      .andExpect(jsonPath("$.content[0].brewRatio").exists());
}

@Test
@DisplayName("AC-LIST-34 · 볼 수 없는 레시피 id로 필터해도 빈 목록이다")
void 볼_수_없는_레시피_id로_필터해도_빈_목록이다() throws Exception {
  String a = token("에이2");
  String b = token("비2");
  Long bRecipe = recipeId(b); // 기본 visibility는 PRIVATE

  mockMvc
      .perform(get("/api/v1/brew-logs?recipeId=" + bRecipe).header(HttpHeaders.AUTHORIZATION, a))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.content").isEmpty());
}
```

`import static org.hamcrest.Matchers.equalTo;` 와 `everyItem`을 추가한다.

> `jsonPath(...).doesNotExist()`는 **Jackson이 null 필드를 생략할 때만** 통과한다. 프로젝트의 직렬화 설정이 `NON_NULL`이 아니면 `.value(nullValue())`로 바꾼다. Step 2에서 실제 응답을 보고 결정한다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: FAIL — `GET /api/v1/brew-logs` 매핑이 없다. 이때 응답 본문을 출력해 null 필드가 생략되는지 확인하고 Step 1의 `doesNotExist()` / `nullValue()`를 확정한다.

- [ ] **Step 3: 최소 구현**

`BrewLogRepository.java`:

```java
  @Query(
      """
      select b from BrewLog b
      where b.deletedAt is null
        and (:recipeId is null or b.recipeId = :recipeId)
        and (:userId is null or b.userId = :userId)
        and (:beanBatchId is null or b.beanBatchId = :beanBatchId)
        and ( b.userId = :viewerId
           or b.visibility = com.kaldinote.brewlog.domain.BrewLogVisibility.PUBLIC
           or ( b.visibility = com.kaldinote.brewlog.domain.BrewLogVisibility.FRIENDS
                and exists (select 1 from Follow f1
                            where f1.followerUserId = :viewerId
                              and f1.followeeUserId = b.userId)
                and exists (select 1 from Follow f2
                            where f2.followerUserId = b.userId
                              and f2.followeeUserId = :viewerId) ) )
      """)
  Page<BrewLog> findVisible(
      @Param("viewerId") Long viewerId,
      @Param("recipeId") Long recipeId,
      @Param("userId") Long userId,
      @Param("beanBatchId") Long beanBatchId,
      Pageable pageable);
```

`BrewLogSummaryResponse.java` — `BrewLogResponse`에서 `overallNote`만 뺀 30개 필드. 생성 방식도 동일하게 `(BrewLog, ExtractionAnalysis)`를 받는다.

`BrewLogService.java`:

```java
  private static final Sort LIST_SORT = Sort.by(Sort.Order.desc("brewedAt"), Sort.Order.desc("id"));

  public PageResponse<BrewLogSummaryResponse> list(
      Long viewerId, Long recipeId, Long userId, Long beanBatchId, PageParams params) {
    return PageResponse.from(
        brewLogRepository.findVisible(
            viewerId, recipeId, userId, beanBatchId, params.toPageable(LIST_SORT)),
        log -> BrewLogSummaryResponse.from(log, analyze(log)));
  }

  /** 단건 조회와 같은 계산을 목록의 각 행에도 적용한다. EY·SCA는 DB에 없다. */
  private ExtractionAnalysis analyze(BrewLog log) {
    return extractionAnalyzer.analyze(
        new BrewMeasurement(
            log.getActualDoseG(),
            log.getActualWaterG(),
            log.getBeverageWeightG(),
            log.getTdsPercent()));
  }
```

기존 `get(...)`의 인라인 분석 코드도 이 `analyze(log)`를 쓰도록 정리한다.

`BrewLogController.java`:

```java
  @GetMapping
  public PageResponse<BrewLogSummaryResponse> list(
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size,
      @RequestParam(required = false) Long recipeId,
      @RequestParam(required = false) Long userId,
      @RequestParam(required = false) Long beanBatchId,
      AuthenticatedUser user) {
    return brewLogService.list(
        user.id(), recipeId, userId, beanBatchId, PageParams.of(page, size));
  }
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: PASS — 기존 테스트 전부 + 신규 12개

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(brewlog): 브루잉 로그 목록 조회 + 필터 3종 (AC-LIST-18~27·34·36)" && cd backend
```

---

## Task 5: 브루잉 로그 부분 수정

**Files:**
- Create: `backend/src/main/java/com/kaldinote/brewlog/presentation/dto/BrewLogPatchRequest.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/domain/BrewLog.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/application/BrewLogService.java`
- Modify: `backend/src/main/java/com/kaldinote/brewlog/presentation/BrewLogController.java`
- Test: `backend/src/test/java/com/kaldinote/brewlog/presentation/BrewLogControllerTest.java`

**Covers:** AC-BLEDIT-01 ~ AC-BLEDIT-11, AC-BLEDIT-14, AC-BLEDIT-16, AC-BLEDIT-17, AC-BLEDIT-19

**Interfaces:**
- Consumes: `BrewLogService.requireOwnedLog(...)` (Task 2)
- Produces: `BrewLog.applyPatch(...)`, `BrewLogService.patch(Long userId, Long id, BrewLogPatchRequest)`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("AC-BLEDIT-01 · 보낸 필드만 바뀐다")
void 보낸_필드만_바뀐다() throws Exception {
  String token = token("수정자");
  Long logId = createBrewLog(token);

  mockMvc
      .perform(
          patch("/api/v1/brew-logs/" + logId)
              .header(HttpHeaders.AUTHORIZATION, token)
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {"rating":4.0}
                  """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.rating").value(4.0))
      .andExpect(jsonPath("$.actualDoseG").value(15.0));
}

@Test
@DisplayName("AC-BLEDIT-03 · 명시적 null도 변경 없음으로 취급한다")
void 명시적_null도_변경_없음으로_취급한다() throws Exception {
  String token = token("수정자2");
  Long logId = createBrewLogWithTds(token, "1.35");

  mockMvc
      .perform(
          patch("/api/v1/brew-logs/" + logId)
              .header(HttpHeaders.AUTHORIZATION, token)
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {"tdsPercent":null}
                  """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.tdsPercent").value(1.35));
}

@Test
@DisplayName("AC-BLEDIT-04 · TDS를 넣으면 추출 수율이 계산되어 응답에 나온다")
void TDS를_넣으면_추출_수율이_계산된다() throws Exception {
  String token = token("수정자3");
  Long logId = createBrewLogWithBeverage(token, "250.0"); // dose 15.0, TDS 없음

  mockMvc
      .perform(
          patch("/api/v1/brew-logs/" + logId)
              .header(HttpHeaders.AUTHORIZATION, token)
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {"tdsPercent":1.35}
                  """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.extractionYieldPercent").value(22.5))
      .andExpect(jsonPath("$.extractionZone").value("OVER"));
}

@Test
@DisplayName("AC-BLEDIT-06 · 분쇄도 설정을 바꾸면 마이크론 추정값이 다시 저장된다")
void 분쇄도_설정을_바꾸면_마이크론이_재저장된다() throws Exception {
  String token = token("수정자4");
  Long logId = createBrewLog(token); // C40, 22.0클릭 → 660

  mockMvc
      .perform(
          patch("/api/v1/brew-logs/" + logId)
              .header(HttpHeaders.AUTHORIZATION, token)
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {"actualGrindSettingValue":24.0}
                  """))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.actualGrindMicronEstimated").value(720));

  assertThat(brewLogRepository.findById(logId).orElseThrow().getActualGrindMicronEstimated())
      .isEqualByComparingTo("720");
}

@Test
@DisplayName("AC-BLEDIT-10 · recipeId를 보내도 무시된다")
void recipeId를_보내도_무시된다() throws Exception {
  String token = token("수정자5");
  Long logId = createBrewLog(token);
  Long before = brewLogRepository.findById(logId).orElseThrow().getRecipeId();
  Long other = recipeId(token);

  mockMvc
      .perform(
          patch("/api/v1/brew-logs/" + logId)
              .header(HttpHeaders.AUTHORIZATION, token)
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {"recipeId":%d,"rating":4.0}
                  """.formatted(other)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.recipeId").value(before))
      .andExpect(jsonPath("$.rating").value(4.0));
}

@Test
@DisplayName("AC-BLEDIT-14 · 타인의 로그는 수정할 수 없다")
void 타인의_로그는_수정할_수_없다() throws Exception {
  String owner = token("주인2");
  String other = token("남2");
  Long logId = createBrewLog(owner);

  mockMvc
      .perform(
          patch("/api/v1/brew-logs/" + logId)
              .header(HttpHeaders.AUTHORIZATION, other)
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {"rating":4.0}
                  """))
      .andExpect(status().isForbidden())
      .andExpect(jsonPath("$.code").value("FORBIDDEN"));
}
```

`import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;`를 추가한다.

`createBrewLogWithTds(...)`, `createBrewLogWithBeverage(...)`는 `createBrewLog`와 같은 본문에 해당 필드만 더한 헬퍼로 만든다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: FAIL — `PATCH /api/v1/brew-logs/{id}` 매핑이 없어 405

- [ ] **Step 3: 최소 구현**

`BrewLogPatchRequest.java` — **`recipeId`·`beanBatchId`를 넣지 않는다.** 없는 필드는 Jackson이 무시하므로 `AC-BLEDIT-10`이 자동으로 성립한다.

```java
package com.kaldinote.brewlog.presentation.dto;

import com.kaldinote.brewlog.domain.BrewLogVisibility;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * 부분 수정 요청. null은 언제나 "변경 없음"이고 값 지우기는 지원하지 않는다.
 *
 * <p>recipeId·beanBatchId는 일부러 빠져 있다. 바꾸면 실측 스냅샷이 어떤 레시피·원두의
 * 기록인지 알 수 없게 된다.
 */
public record BrewLogPatchRequest(
    Instant brewedAt,
    BrewLogVisibility visibility,
    BigDecimal actualDoseG,
    BigDecimal actualWaterG,
    BigDecimal actualWaterTempC,
    Integer actualTotalTimeSeconds,
    Integer actualDrawdownSeconds,
    Long userGrinderId,
    BigDecimal actualGrindSettingValue,
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

`BrewLog.java`:

```java
  /** null은 변경 없음. 파생 값(마이크론·경과일·디게싱)은 서비스가 계산해 넘긴다. */
  public void applyPatch(
      BrewLogPatchFields f,
      BigDecimal recomputedMicron,
      Integer recomputedDaysOffRoast,
      String recomputedDegassingStatus) {
    if (f.brewedAt() != null) this.brewedAt = f.brewedAt();
    if (f.visibility() != null) this.visibility = f.visibility();
    if (f.actualDoseG() != null) this.actualDoseG = f.actualDoseG();
    // ... 나머지 실측값·관능 평가도 같은 형태
    if (recomputedMicron != null) this.actualGrindMicronEstimated = recomputedMicron;
    if (recomputedDaysOffRoast != null) this.daysOffRoast = recomputedDaysOffRoast;
    if (recomputedDegassingStatus != null) this.degassingStatus = recomputedDegassingStatus;
  }
```

> `BrewLogPatchFields`를 따로 두는 대신 `presentation`의 DTO를 `domain`이 참조하지 않도록, 서비스가 개별 인자로 풀어 넘기는 형태를 택해도 된다. 인자가 21개가 되므로 **`domain` 패키지에 `BrewLogPatch` 레코드를 하나 두고 서비스가 DTO → 도메인 레코드로 옮기는 방식**을 권한다. `docs/conventions/backend.md`의 의존 방향(`presentation → application → domain`)을 지키기 위해서다.

`BrewLogService.java`:

```java
  @Transactional
  public BrewLogResponse patch(Long userId, Long brewLogId, BrewLogPatchRequest request) {
    validateRatingStep(request.rating());
    BrewLog log = requireOwnedLog(userId, brewLogId);

    // 분쇄도 관련 값이 바뀌면 마이크론 추정값을 다시 계산해 저장한다.
    BigDecimal micron = null;
    Long grinderId = request.userGrinderId() != null ? request.userGrinderId() : log.getUserGrinderId();
    BigDecimal setting =
        request.actualGrindSettingValue() != null
            ? request.actualGrindSettingValue()
            : log.getActualGrindSettingValue();
    if (request.userGrinderId() != null || request.actualGrindSettingValue() != null) {
      UserGrinder userGrinder = requireOwnedUserGrinder(userId, grinderId);
      GrinderModel model =
          grinderModelRepository
              .findById(userGrinder.getGrinderModelId())
              .orElseThrow(
                  () ->
                      new BusinessException(
                          ErrorCode.NOT_FOUND,
                          "그라인더 모델을 찾을 수 없습니다: " + userGrinder.getGrinderModelId()));
      micron = computeActualGrindMicronEstimated(model, setting);
    }

    // 추출 시각이 바뀌면 경과일과 디게싱 상태를 다시 계산한다.
    // 원두 재고가 이미 삭제됐다면 기존 값을 유지한다 — 재고를 지워도 과거 기록은 남아야 한다.
    Integer daysOffRoast = null;
    String degassing = null;
    if (request.brewedAt() != null) {
      Optional<BeanBatch> batch = beanBatchRepository.findByIdAndDeletedAtIsNull(log.getBeanBatchId());
      if (batch.isPresent()) {
        daysOffRoast = computeDaysOffRoast(request.brewedAt(), batch.get().getRoastedAt());
        degassing = DegassingStatus.of(daysOffRoast).name();
      }
    }

    log.applyPatch(toDomainPatch(request), micron, daysOffRoast, degassing);
    return BrewLogResponse.from(log, analyze(log));
  }
```

`BrewLogController.java`:

```java
  @PatchMapping("/{id}")
  public BrewLogResponse patch(
      @PathVariable Long id,
      @Valid @RequestBody BrewLogPatchRequest request,
      AuthenticatedUser user) {
    return brewLogService.patch(user.id(), id, request);
  }
```

> `DegassingStatus.of(int)`와 `beanBatchRepository.findByIdAndDeletedAtIsNull(...)`의 실제 시그니처는 구현 전에 확인해 맞춘다. `inventory` 도메인이 이미 같은 판정을 하고 있으므로 그 메서드를 재사용하고 새로 만들지 않는다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BrewLogControllerTest'`
Expected: PASS — 기존 테스트 전부 + 신규 15개

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(brewlog): 브루잉 로그 부분 수정 PATCH (AC-BLEDIT-01~11·14·16·17·19)" && cd backend
```

---

## Task 6: 내 프로필과 내 그라인더 목록

**Files:**
- Create: `backend/src/main/java/com/kaldinote/user/presentation/UserController.java`
- Create: `backend/src/main/java/com/kaldinote/user/application/UserService.java`
- Create: `backend/src/main/java/com/kaldinote/user/presentation/dto/MeResponse.java`
- Create: `backend/src/main/java/com/kaldinote/gear/presentation/dto/UserGrinderResponse.java`
- Modify: `backend/src/main/java/com/kaldinote/gear/presentation/GearController.java`
- Modify: `backend/src/main/java/com/kaldinote/gear/application/GearService.java`
- Test: `backend/src/test/java/com/kaldinote/user/presentation/UserControllerTest.java`
- Test: `backend/src/test/java/com/kaldinote/gear/presentation/GearControllerTest.java`

**Covers:** AC-ME-01 ~ AC-ME-07

**Interfaces:**
- Consumes: `UserRepository`, `UserGrinderRepository.findAllByUserId(Long)`, `GrinderModelRepository`
- Produces: `MeResponse.from(User)`, `UserGrinderResponse.of(UserGrinder, GrinderModel)`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("AC-ME-01 · 내 프로필은 여섯 필드를 반환한다")
void 내_프로필은_여섯_필드를_반환한다() throws Exception {
  String token = token("노성웅");

  String body =
      mockMvc
          .perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, token))
          .andExpect(status().isOk())
          .andExpect(jsonPath("$.nickname").value("노성웅"))
          .andExpect(jsonPath("$.role").value("USER"))
          .andReturn()
          .getResponse()
          .getContentAsString();

  assertThat(JsonPath.<Map<String, Object>>read(body, "$").keySet())
      .containsExactlyInAnyOrder(
          "id", "email", "nickname", "profileImageUrl", "role", "createdAt");
}

@Test
@DisplayName("AC-ME-02 · 이메일이 없는 사용자도 200이다")
void 이메일이_없는_사용자도_200이다() throws Exception {
  String token = token("이메일없음"); // User.create(null, nickname, null)

  mockMvc
      .perform(get("/api/v1/users/me").header(HttpHeaders.AUTHORIZATION, token))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.email").value(nullValue()));
}

@Test
@DisplayName("AC-ME-03 · JWT 없이 내 프로필을 부르면 401이다")
void JWT_없이_내_프로필을_부르면_401이다() throws Exception {
  mockMvc.perform(get("/api/v1/users/me")).andExpect(status().isUnauthorized());
}
```

`GearControllerTest`에 추가:

```java
@Test
@DisplayName("AC-ME-04 · 내 그라인더 목록에 모델 정보가 펼쳐진다")
void 내_그라인더_목록에_모델_정보가_펼쳐진다() throws Exception {
  String token = token("그라인더주인");
  userGrinderId(token, c40Id());

  mockMvc
      .perform(get("/api/v1/gear/user-grinders").header(HttpHeaders.AUTHORIZATION, token))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.length()").value(1))
      .andExpect(jsonPath("$[0].brand").value("Comandante"))
      .andExpect(jsonPath("$[0].grinderModelName").value("C40 MK4"))
      .andExpect(jsonPath("$[0].micronsPerClick").value(30.00))
      .andExpect(jsonPath("$[0].isDefault").value(true));
}

@Test
@DisplayName("AC-ME-06 · 등록한 그라인더가 없으면 빈 배열이다")
void 등록한_그라인더가_없으면_빈_배열이다() throws Exception {
  mockMvc
      .perform(get("/api/v1/gear/user-grinders").header(HttpHeaders.AUTHORIZATION, token("빈손")))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$").isArray())
      .andExpect(jsonPath("$.length()").value(0))
      .andExpect(jsonPath("$.content").doesNotExist());
}
```

> `micronsPerClick`의 기대값은 시드 데이터(`V5__seed_gear.sql`)의 실제 값과 스케일에 맞춘다. `BigDecimal(precision 6, scale 2)`이므로 `30.00`으로 직렬화된다. Step 2에서 실제 응답을 확인해 확정한다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*UserControllerTest' --tests '*GearControllerTest'`
Expected: FAIL — `UserControllerTest` 클래스가 없고, `GET /api/v1/gear/user-grinders` 매핑이 없어 405

- [ ] **Step 3: 최소 구현**

```java
package com.kaldinote.user.presentation.dto;

import com.kaldinote.user.domain.User;
import java.time.Instant;

/** email은 null일 수 있다 — 카카오는 이메일 제공 동의가 선택이다. */
public record MeResponse(
    Long id,
    String email,
    String nickname,
    String profileImageUrl,
    String role,
    Instant createdAt) {

  public static MeResponse from(User user) {
    return new MeResponse(
        user.getId(),
        user.getEmail(),
        user.getNickname(),
        user.getProfileImageUrl(),
        user.getRole().name(),
        user.getCreatedAt());
  }
}
```

```java
package com.kaldinote.user.presentation;

import com.kaldinote.common.security.AuthenticatedUser;
import com.kaldinote.user.application.UserService;
import com.kaldinote.user.presentation.dto.MeResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

  private final UserService userService;

  @GetMapping("/me")
  public MeResponse me(AuthenticatedUser user) {
    return userService.me(user.id());
  }
}
```

`GearService`에 추가:

```java
  public List<UserGrinderResponse> findMyGrinders(Long userId) {
    List<UserGrinder> grinders = userGrinderRepository.findAllByUserId(userId);
    Map<Long, GrinderModel> models =
        grinderModelRepository
            .findAllById(grinders.stream().map(UserGrinder::getGrinderModelId).toList())
            .stream()
            .collect(Collectors.toMap(GrinderModel::getId, m -> m));
    return grinders.stream()
        .map(g -> UserGrinderResponse.of(g, models.get(g.getGrinderModelId())))
        .toList();
  }
```

`GearController`에 추가:

```java
  @GetMapping("/user-grinders")
  public List<UserGrinderResponse> myGrinders(AuthenticatedUser user) {
    return gearService.findMyGrinders(user.id());
  }
```

`SecurityConfig`에서 `/api/v1/users/**`가 인증 필요 경로에 포함되는지 확인한다. 이미 `FollowController`가 같은 접두사를 쓰므로 별도 설정이 필요 없을 가능성이 높다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*UserControllerTest' --tests '*GearControllerTest'`
Expected: PASS — 신규 7개 + 기존 `GearControllerTest` 전부

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(user): 내 프로필·내 그라인더 목록 조회 (AC-ME-01~07)" && cd backend
```

---

## 완료 기준

- [ ] `cd backend && ./gradlew clean check` 통과
- [ ] `./scripts/check-spec-coverage.sh` 통과 — AC 62개가 모두 테스트에서 발견된다
- [ ] 스펙 `docs/specs/2026-08-19-list-query-api.md`의 `status`를 `구현완료`로 변경
- [ ] `docs/specs/2026-08-17-brew-log.md`에 정정 주석 추가 — 단건 조회에 `deleted_at IS NULL`이 붙었다
- [ ] `docs/specs/2026-08-17-visibility-authorization.md`에 정정 주석 추가 — `visibility`를 생성 후에도 바꿀 수 있다
- [ ] Swagger UI에서 `GET /api/v1/recipes`의 `page`·`size`·`ownerUserId`가 설명과 함께 노출된다
- [ ] 계정 2개로 상호 팔로우 → `FRIENDS` 레시피가 상대 목록에 나타남 → 팔로우 해제 후 사라짐 (`visibility` 계획의 미완료 수동 확인 2건을 여기서 함께 닫는다)
- [ ] 시드 CURATED 레시피가 신규 계정의 목록 첫 화면에 보이고 거기서 포크가 된다

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 62개 중 62개가 태스크에 매핑됨 (Task 2: 4 / Task 3: 24 / Task 4: 12 / Task 5: 15 / Task 6: 7)

**자리표시자 검사:** `TODO`, `TBD` 없음. 다만 아래 다섯 곳은 **구현 직전에 실제 시그니처를 확인하라는 지시**를 명시적으로 남겼다 — 추측으로 코드를 쓰지 않기 위한 것이다.
- `BusinessException.getErrorCode()`의 실제 접근자 이름 (Task 1 테스트)
- `JwtTokenProvider`의 토큰 파싱 메서드 이름 (Task 3 테스트 헬퍼)
- `beanBatchId(String)` 테스트 헬퍼의 기존 존재 여부 (Task 2)
- `DegassingStatus.of(int)`와 `BeanBatchRepository.findByIdAndDeletedAtIsNull(...)` (Task 5)
- 시드 그라인더의 `micronsPerClick` 실제 값과 직렬화 스케일 (Task 6)

**타입 일관성:** `PageParams`/`PageResponse`(Task 1)를 Task 3·4가 같은 시그니처로 쓴다. `requireOwnedLog(...)`(Task 2)를 Task 5가 재사용한다. `analyze(BrewLog)`(Task 4)를 Task 5의 `patch`가 재사용한다.

**검증되지 않은 가정:**
- **JPQL의 `exists` 서브쿼리 두 개가 붙은 쿼리에 `Pageable`을 넘겼을 때 Hibernate가 `count` 쿼리를 정상 생성하는지.** `Page<T>` 반환은 `select count(r)` 쿼리를 자동 파생하는데, `exists` 서브쿼리가 포함된 JPQL에서 파생이 실패한 사례가 있다. Task 3 Step 2에서 실패 사유가 이것으로 밝혀지면 `@Query(countQuery = "...")`로 count 쿼리를 명시한다.
- **`:ownerUserId is null` 형태의 널 비교를 Hibernate가 파라미터 타입 추론 없이 처리하는지.** `Long` 파라미터라 문제없을 것으로 보지만, 타입 추론 오류가 나면 `nullif`나 `coalesce` 대신 **Specification 또는 두 개의 쿼리 메서드로 분리**한다. QueryDSL 도입은 이 스펙의 범위가 아니다.
- **`brewedAt`이 `@PastOrPresent` 제약을 갖는지.** 기존 테스트 주석이 생성 시 그런 제약을 언급한다. `PATCH`에도 같은 제약을 걸어야 하는지는 스펙에 AC가 없다 — 걸지 않는 쪽으로 구현하고, 필요하면 후속 스펙에서 AC와 함께 추가한다.
- **`RecipeSummaryResponse`가 `steps`를 안 담아도 목록 쿼리가 스텝을 조회하지 않는지.** `Recipe.steps`의 fetch 전략이 `EAGER`면 DTO에서 빼도 쿼리는 나간다. Task 3 Step 4에서 `--info`로 SQL 로그를 보고 확인한다. `EAGER`라면 이 계획에서 전략을 바꾸지 말고(다른 곳에 영향이 크다) 후속 과제로 남긴다.

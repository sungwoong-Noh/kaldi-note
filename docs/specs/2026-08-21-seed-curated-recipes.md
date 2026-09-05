---
id: SEED
title: 시드 CURATED 레시피 + Swagger 파라미터 정리
status: 구현완료
plan: docs/plans/2026-08-21-plan-seed-curated.md
---

# 시드 CURATED 레시피 + Swagger 파라미터 정리 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

**이 스펙은 AC 접두사를 둘 쓴다** — `AC-SEED-nn`(시드 레시피)과 `AC-SWAGGER-nn`(파라미터 숨김). 둘 다 "백엔드가 프론트에 넘어가기 전에 닫아야 하는 마감 작업"이라는 하나의 이유로 묶인다. `check-spec-coverage.sh`의 패턴(`AC-[A-Z][A-Z0-9_]*-[0-9]+`)이 둘 다 잡는다.

## 무엇을

**서비스가 처음부터 보여줄 레시피 2건을 데이터베이스에 심는다.** James Hoffmann의 Ultimate V60와 Tetsu Kasuya의 4:6 Method를 `source_type=CURATED`·`owner_user_id=NULL`·`visibility=PUBLIC`으로 넣는다. 신규 사용자가 가입 직후 목록을 열면 이 둘이 보이고, 그중 하나를 포크해 자기 레시피로 만드는 것으로 서비스를 시작할 수 있다.

함께 **Swagger UI에서 `AuthenticatedUser`가 `user`라는 필수 쿼리 파라미터로 새어 나오는 것을 막는다.** 이 값은 서버가 JWT에서 채우는 것이라 사람이 입력할 수 있는 값이 아닌데, 지금은 19개 엔드포인트 전부에 입력란으로 노출된다.

### 범위 밖 (Non-goals)

- **관리자 CURATED 등록 API** (`POST /admin/recipes`). `docs/design/2026-08-14-architecture.md:196`이 예고한 정식 경로이지만 이번에는 만들지 않는다. 시드 2건을 넣는 데 인가·DTO·검증 로직 일습이 필요하지 않고, 마이그레이션은 배포와 동시에 데이터가 존재함을 보장하는 반면 API는 배포 후 사람이 손으로 호출해야 데이터가 생긴다. 3건째 큐레이션 레시피가 필요해지는 시점에 만든다.
- **시드 3건 이상, 태그, 사진 첨부.** 2건으로 고정한다.
- **시드의 런타임 갱신·삭제 경로.** 내용을 바꾸려면 새 마이그레이션을 쓴다. 시드를 수정하는 API를 만들지 않으며, 일반 사용자에게 이 둘은 소유자가 없으므로 `PUT`/`DELETE`가 403으로 거부된다(`visibility` 스펙이 이미 정의한 동작이다).
- **시드 레시피의 분쇄도 값.** 두 원문 모두 분쇄도를 "medium fine"·"coarse"라는 서술로만 적는다. 특정 그라인더의 클릭 수로 옮기려면 추측이 필요하고, 이는 `V5__seed_gear.sql`이 못박은 "추측값은 넣지 않는다. 틀린 환산값은 값이 없는 것보다 해롭다"와 `CLAUDE.md` 설계 결정 3번("환산 결과는 언제나 추정치")에 어긋난다. `grinder_model_id`·`grind_setting_value`·`grind_setting_unit`·`grind_micron_estimated`를 전부 `NULL`로 둔다.
- **국제화(i18n).** 한국어 단일로 간다. 제목만 원제를 유지한다.
- **Swagger 문서의 그 밖의 정리.** `AuthenticatedUser` 숨김 한 가지만 다룬다. 응답 예시·태그 그룹핑·에러 스키마 문서화는 손대지 않는다.

## 왜

**지금 신규 사용자가 보는 첫 화면은 빈 목록이다.** 이 서비스의 핵심 시나리오(`docs/design/2026-08-14-architecture.md:253`)는 5단계에서 "Kasuya 4:6 시드 레시피 포크"로 시작하는데, 포크할 대상이 데이터베이스에 하나도 없다. `architecture.md:236`이 Plan 2에서 넣겠다고 적어둔 것이 계획 문서로 옮겨지지 않은 채 남았고, `visibility` 스펙(`:508`)은 "시드 투입은 포크 스펙의 몫"이라고 미뤘으며 포크 스펙은 그것을 받지 않았다. 목록 조회 세션(`docs/JOURNAL.md` 2026-08-19)에서 수동 확인 항목 하나가 "확인 불가"로 닫힌 것도 같은 이유다.

프론트(Plan 4)는 이 데이터 위에 화면을 그린다. **빈 목록을 전제로 만든 화면과 콘텐츠가 있는 화면은 다르게 생겼다.** 시드가 없으면 프론트 첫 화면 설계가 "아무것도 없을 때"만 다루게 되고, 정작 실제 서비스에서는 쓰이지 않는 상태다.

**Swagger는 지금 백엔드를 검증하는 유일한 UI다.** 프론트가 나오기 전까지 모든 수동 확인이 여기서 이뤄지는데, 엔드포인트마다 채울 수 없는 `user` 입력란이 붙어 있어 무엇이 진짜 파라미터인지 구분이 안 된다. 이번 세션이 백엔드의 마지막 세션이므로 여기서 닫는다.

## 용어

| 용어 | 정의 |
|---|---|
| 시드 레시피 | 이 스펙이 넣는 CURATED 레시피 2건. `owner_user_id IS NULL`이고 아무도 수정할 수 없다 |
| 시드 마이그레이션 | `db/seed/V11__seed_curated_recipes.sql`. 스키마가 아니라 콘텐츠를 넣는 마이그레이션 |
| 스키마 마이그레이션 | `db/migration/V1`~`V10`. 테이블 정의와 카탈로그·장비 마스터 데이터 |
| 요청 래퍼(request wrapper) | springdoc이 "컨트롤러 파라미터이지만 API 입력이 아닌 타입"으로 취급해 문서에서 제외하는 클래스. `Principal`·`HttpServletRequest`가 기본으로 여기 속한다 |

## 데이터

**스키마 변경 없음.** `recipes`·`recipe_steps`에 행을 넣기만 한다.

### 마이그레이션 위치 분리

시드는 `db/migration`이 아니라 **`db/seed`라는 별도 location**에 둔다. Flyway는 여러 location을 하나의 버전 순서로 합쳐 적용하므로 `V11`이라는 버전 번호는 그대로 유효하다.

| 프로파일 | `spring.flyway.locations` | 시드 적용 |
|---|---|---|
| 기본(`application.yml`) → `local`·운영 | `classpath:db/migration`, `classpath:db/seed` | O |
| `test` (`application-test.yml`) | `classpath:db/migration` | **X** |

**왜 나누는가.** 시드를 모든 프로파일에 적용하면 테스트 데이터베이스가 항상 `PUBLIC` 레시피 2건을 가진 채로 시작한다. 목록 조회 테스트는 `@Transactional` 롤백으로 서로 격리되지만 Flyway가 넣은 행은 모든 테스트가 공유하므로, 기존 인수 조건 6개(`AC-LIST-03`·`05`·`09`·`13`·`14`·`32`)의 기대값이 전부 어긋난다. 특히 `AC-LIST-32`("볼 수 있는 것이 하나도 없으면 빈 목록을 반환한다")는 도달 자체가 불가능해진다.

**대신 시드 SQL이 CI에서 한 번도 실행되지 않는 위험이 생긴다.** enum 오타나 제약 위반이 있으면 배포 시점에야 드러난다. 그래서 시드를 검증하는 테스트가 `@Sql`로 이 파일을 명시적으로 적용해 실행한다 — 파일은 하나이고, 테스트가 그 파일을 그대로 돌린다.

### 시드 1 — James Hoffmann Ultimate V60

| 컬럼 | 값 |
|---|---|
| `owner_user_id` | `NULL` |
| `source_type` | `CURATED` |
| `author_name` | `James Hoffmann` |
| `source_url` | `https://honestcoffeeguide.com/brew-recipes/james-hoffmann-v60/` |
| `source_note` | `유튜브 "The Ultimate V60 Technique"을 정리한 레시피 페이지` |
| `title` | `James Hoffmann Ultimate V60` |
| `description` | `유튜브 "The Ultimate V60 Technique"의 레시피. 1:16.7 비율, 끓는 물로 내린다. 블룸 후 두 번에 나눠 붓고 스터와 스월로 마무리해 균일한 추출을 노린다.` |
| `brew_method` | `POUR_OVER` |
| `visibility` | `PUBLIC` |
| `parent_recipe_id` / `fork_root_id` | `NULL` / `NULL` |
| `dose_g` | `30.0` |
| `water_g` | `500.0` |
| `water_temp_c` | `100.0` |
| `total_time_seconds` | `210` |
| `brewer_id` | Hario V60 02 |
| `filter_id` | V60 표백 필터 02 |
| `grinder_model_id`·`grind_setting_value`·`grind_setting_unit`·`grind_micron_estimated` | 전부 `NULL` |
| `deleted_at` | `NULL` |

스텝 7개:

| `step_order` | `step_type` | `start_at_seconds` | `duration_seconds` | `water_g` | `pour_technique` | `agitation` | `note` |
|---|---|---|---|---|---|---|---|
| 1 | `BLOOM` | 0 | 15 | 60.0 | `SPIRAL` | `SWIRL` | 중심에서 바깥으로 나선을 그려 가루를 다 적신 뒤, 스월로 덩어리를 푼다 |
| 2 | `WAIT` | 15 | 30 | `NULL` | `NULL` | `NONE` | 45초까지 뜸을 들인다 |
| 3 | `POUR` | 45 | 30 | 240.0 | `SPIRAL` | `NONE` | 1분 15초에 누적 300g. 전체 물의 60%를 여기서 넣는다 |
| 4 | `POUR` | 75 | 30 | 200.0 | `SPIRAL` | `NONE` | 1분 45초에 누적 500g. 천천히 이어 붓는다 |
| 5 | `STIR` | 105 | 5 | `NULL` | `NULL` | `STIR` | 시계 방향과 반시계 방향으로 한 번씩 저어 벽면 가루를 내린다 |
| 6 | `SWIRL` | 110 | 5 | `NULL` | `NULL` | `SWIRL` | 가볍게 돌려 커피 베드를 평탄하게 만든다 |
| 7 | `DRAWDOWN` | 115 | 95 | `NULL` | `NULL` | `NONE` | 3분 30초에 배출이 끝난다 |

붓는 스텝 합계 `60.0 + 240.0 + 200.0 = 500.0` = `water_g`. 마지막 스텝이 `115 + 95 = 210`초에 끝나 `total_time_seconds`와 일치한다.

### 시드 2 — Tetsu Kasuya 4:6 Method

| 컬럼 | 값 |
|---|---|
| `owner_user_id` | `NULL` |
| `source_type` | `CURATED` |
| `author_name` | `Tetsu Kasuya` |
| `source_url` | `https://honestcoffeeguide.com/brew-recipes/tetsu-kasuya-4-6-method/` |
| `source_note` | `2016 World Brewers Cup 우승 방법론` |
| `title` | `Tetsu Kasuya 4:6 Method` |
| `description` | `2016 World Brewers Cup 우승 방법론. 45초 간격으로 다섯 번 나눠 붓는다. 앞 40%가 단맛과 산미의 균형을, 뒤 60%가 농도를 결정한다.` |
| `brew_method` | `POUR_OVER` |
| `visibility` | `PUBLIC` |
| `parent_recipe_id` / `fork_root_id` | `NULL` / `NULL` |
| `dose_g` | `20.0` |
| `water_g` | `300.0` |
| `water_temp_c` | `92.0` |
| `total_time_seconds` | `210` |
| `brewer_id` | Hario V60 02 |
| `filter_id` | V60 표백 필터 02 |
| `grinder_model_id`·`grind_setting_value`·`grind_setting_unit`·`grind_micron_estimated` | 전부 `NULL` |
| `deleted_at` | `NULL` |

스텝 6개:

| `step_order` | `step_type` | `start_at_seconds` | `duration_seconds` | `water_g` | `pour_technique` | `agitation` | `note` |
|---|---|---|---|---|---|---|---|
| 1 | `BLOOM` | 0 | 10 | 50.0 | `SPIRAL` | `NONE` | 1푸어. 이 물량이 단맛과 산미의 균형을 결정한다 |
| 2 | `POUR` | 45 | 10 | 70.0 | `SPIRAL` | `NONE` | 2푸어. 여기까지 120g으로 전체의 40%를 채운다 |
| 3 | `POUR` | 90 | 10 | 60.0 | `SPIRAL` | `NONE` | 3푸어. 여기부터 60%는 농도를 결정한다 |
| 4 | `POUR` | 135 | 10 | 60.0 | `SPIRAL` | `NONE` | 4푸어. 누적 240g |
| 5 | `POUR` | 180 | 10 | 60.0 | `SPIRAL` | `NONE` | 5푸어. 누적 300g |
| 6 | `DRAWDOWN` | 190 | 20 | `NULL` | `NULL` | `NONE` | 3분 30초에 배출이 끝난다 |

붓는 스텝 합계 `50.0 + 70.0 + 60.0 + 60.0 + 60.0 = 300.0` = `water_g`. 푸어 간격이 정확히 45초이고, 마지막 스텝이 `190 + 20 = 210`초에 끝난다.

### 출처

수치는 아래 페이지로 확인했다. 유튜브 원본 영상 URL은 이번에 확정하지 못해(검색 한도) 레시피 페이지를 `source_url`로 쓴다.

- Hoffmann: <https://honestcoffeeguide.com/brew-recipes/james-hoffmann-v60/>
- Kasuya: <https://honestcoffeeguide.com/brew-recipes/tetsu-kasuya-4-6-method/>

두 원문에 없어 이 스펙이 정한 값은 **각 스텝의 `duration_seconds`, `step_type` 배정, `DRAWDOWN` 스텝의 존재**다. 원문은 "몇 초에 몇 g"만 적고 붓는 데 걸리는 시간을 명시하지 않는다.

## API

**새 엔드포인트 없음.** 기존 `GET /api/v1/recipes`, `GET /api/v1/recipes/{id}`, `POST /api/v1/recipes/{id}/fork`가 시드 레시피를 대상으로 동작한다.

### Swagger 변경

`OpenApiConfig`에서 `AuthenticatedUser`를 요청 래퍼 무시 목록에 등록한다. 이 설정은 전역이라 19개 엔드포인트 전부에 한 번에 적용된다.

```java
SpringDocUtils.getConfig().addRequestWrapperToIgnore(AuthenticatedUser.class);
```

`springdoc-openapi-starter-common:3.1.0`에 `addRequestWrapperToIgnore(Class<?>...)`가 존재함을 확인했다.

---

## 어떻게 동작 — 인수 조건

> 시드 검증 테스트는 `db/seed/V11__seed_curated_recipes.sql`을 `@Sql`로 직접 적용한 뒤 확인한다.
> `test` 프로파일의 Flyway는 이 파일을 자동 적용하지 않으므로, 적용하지 않은 테스트에서는 시드가 보이지 않아야 한다.

### 시드 레시피 — 행과 스텝

#### AC-SEED-01 · Hoffmann 레시피의 추출 파라미터가 정확하다

- **Given** 시드 마이그레이션을 적용했다
- **When** `title = 'James Hoffmann Ultimate V60'`인 레시피를 조회한다
- **Then** 정확히 1건이고 `dose_g = 30.0`, `water_g = 500.0`, `water_temp_c = 100.0`, `total_time_seconds = 210`이다
- **검증** 통합 테스트 `SeedCuratedRecipesTest`

#### AC-SEED-02 · Hoffmann 스텝 7개가 표와 일치한다

- **Given** 시드 마이그레이션을 적용했다
- **When** Hoffmann 레시피의 스텝을 `step_order` 오름차순으로 조회한다
- **Then** 정확히 7개이고, `(step_type, start_at_seconds, duration_seconds, water_g)`가 순서대로
  `(BLOOM, 0, 15, 60.0)`, `(WAIT, 15, 30, null)`, `(POUR, 45, 30, 240.0)`, `(POUR, 75, 30, 200.0)`,
  `(STIR, 105, 5, null)`, `(SWIRL, 110, 5, null)`, `(DRAWDOWN, 115, 95, null)`이다
- **검증** 통합 테스트 `SeedCuratedRecipesTest`

#### AC-SEED-03 · Kasuya 레시피의 추출 파라미터가 정확하다

- **Given** 시드 마이그레이션을 적용했다
- **When** `title = 'Tetsu Kasuya 4:6 Method'`인 레시피를 조회한다
- **Then** 정확히 1건이고 `dose_g = 20.0`, `water_g = 300.0`, `water_temp_c = 92.0`, `total_time_seconds = 210`이다
- **검증** 통합 테스트 `SeedCuratedRecipesTest`

#### AC-SEED-04 · Kasuya 스텝 6개가 표와 일치한다

- **Given** 시드 마이그레이션을 적용했다
- **When** Kasuya 레시피의 스텝을 `step_order` 오름차순으로 조회한다
- **Then** 정확히 6개이고, `(step_type, start_at_seconds, duration_seconds, water_g)`가 순서대로
  `(BLOOM, 0, 10, 50.0)`, `(POUR, 45, 10, 70.0)`, `(POUR, 90, 10, 60.0)`,
  `(POUR, 135, 10, 60.0)`, `(POUR, 180, 10, 60.0)`, `(DRAWDOWN, 190, 20, null)`이다
- **검증** 통합 테스트 `SeedCuratedRecipesTest`

#### AC-SEED-05 · 두 시드 모두 주인 없는 공개 큐레이션이다

- **Given** 시드 마이그레이션을 적용했다
- **When** 두 시드 레시피를 조회한다
- **Then** 둘 다 `owner_user_id IS NULL`, `source_type = 'CURATED'`, `visibility = 'PUBLIC'`, `brew_method = 'POUR_OVER'`, `deleted_at IS NULL`이다
- **검증** 통합 테스트 `SeedCuratedRecipesTest`

#### AC-SEED-06 · 두 시드의 장비 FK가 Hario V60 02와 V60 표백 필터 02를 가리킨다

- **Given** 시드 마이그레이션을 적용했다
- **When** 두 시드 레시피의 `brewer_id`·`filter_id`를 조회한다
- **Then** `brewer_id`가 가리키는 행은 `brand = 'Hario'`이고 `name = 'V60 02'`이며, `filter_id`가 가리키는 행은 `name = 'V60 표백 필터 02'`다
- **검증** 통합 테스트 `SeedCuratedRecipesTest`

#### AC-SEED-07 · 두 시드의 분쇄도 관련 4개 컬럼이 모두 NULL이다

- **Given** 시드 마이그레이션을 적용했다
- **When** 두 시드 레시피를 조회한다
- **Then** `grinder_model_id`, `grind_setting_value`, `grind_setting_unit`, `grind_micron_estimated`가 전부 `null`이다
- **검증** 통합 테스트 `SeedCuratedRecipesTest`

#### AC-SEED-08 · 두 시드 모두 붓는 스텝 물량 합계가 레시피 총 물량과 같다

- **Given** 시드 마이그레이션을 적용했다
- **When** 각 시드의 `step_type IN ('BLOOM','POUR')`인 스텝의 `water_g`를 합산한다
- **Then** Hoffmann은 `500.0`, Kasuya는 `300.0`이고 각각 레시피의 `water_g`와 같다
- **검증** 통합 테스트 `SeedCuratedRecipesTest`

#### AC-SEED-09 · 두 시드 모두 출처 표기를 갖는다

- **Given** 시드 마이그레이션을 적용했다
- **When** 두 시드 레시피를 조회한다
- **Then** Hoffmann은 `author_name = 'James Hoffmann'`, Kasuya는 `author_name = 'Tetsu Kasuya'`이고, 둘 다 `source_url`이 `null`이 아니며 `https://`로 시작한다
- **검증** 통합 테스트 `SeedCuratedRecipesTest`

### 시드 레시피 — 사용자에게 도달하는가

#### AC-SEED-10 · 레시피가 없는 신규 사용자의 목록에 시드 2건이 보인다

- **Given** 시드 마이그레이션을 적용했고, 레시피를 하나도 만들지 않은 사용자 `A`가 있다
- **When** `A`의 토큰으로 `GET /api/v1/recipes`를 호출한다
- **Then** HTTP `200`이고 `totalElements = 2`이며, `content[*].title`이 `James Hoffmann Ultimate V60`과 `Tetsu Kasuya 4:6 Method`를 모두 포함한다
- **검증** API 테스트 `SeedCuratedRecipesTest`

#### AC-SEED-11 · 시드 레시피 단건 조회의 비율이 정확하다

- **Given** 시드 마이그레이션을 적용했고 사용자 `A`가 있다
- **When** `A`의 토큰으로 두 시드 레시피를 각각 `GET /api/v1/recipes/{id}`로 조회한다
- **Then** 둘 다 HTTP `200`이고 `ratio`가 Hoffmann은 `16.7`, Kasuya는 `15.0`이다 (`RecipeResponse.ratio`는 스케일 1 HALF_UP이다)
- **검증** API 테스트 `SeedCuratedRecipesTest`

#### AC-SEED-12 · 신규 사용자가 시드를 포크하면 자기 레시피가 된다

- **Given** 시드 마이그레이션을 적용했고, 레시피를 하나도 만들지 않은 사용자 `A`가 있다
- **When** `A`의 토큰으로 Kasuya 시드에 `POST /api/v1/recipes/{id}/fork`를 호출한다
- **Then** HTTP `201`이고 사본은 `sourceType = 'USER'`, `ownerUserId = A.id`, `visibility = 'PRIVATE'`이며 스텝이 6개다
- **검증** API 테스트 `SeedCuratedRecipesTest`

### 시드 레시피 — 테스트 격리

#### AC-SEED-13 · test 프로파일에는 시드가 적용되지 않는다

- **Given** 시드 마이그레이션을 적용하지 **않은** 상태이고(`test` 프로파일 기본), 레시피를 하나도 만들지 않은 사용자 `A`가 있다
- **When** `A`의 토큰으로 `GET /api/v1/recipes`를 호출한다
- **Then** HTTP `200`이고 `totalElements = 0`이다
- **검증** API 테스트 `SeedIsolationTest`

### Swagger 파라미터 숨김

#### AC-SWAGGER-01 · API 문서에 user 쿼리 파라미터가 하나도 없다

- **Given** 애플리케이션이 기동했다
- **When** `GET /v3/api-docs`를 호출한다
- **Then** HTTP `200`이고, 응답 전체에서 `name = "user"`이면서 `in = "query"`인 파라미터가 `0`개다
- **검증** API 테스트 `OpenApiDocsTest`

#### AC-SWAGGER-02 · 숨김이 엔드포인트를 지우지 않는다

- **Given** 애플리케이션이 기동했다
- **When** `GET /v3/api-docs`를 호출한다
- **Then** `paths`에 `/api/v1/recipes`, `/api/v1/recipes/{id}`, `/api/v1/brew-logs`, `/api/v1/users/me`, `/api/v1/gear/user-grinders`가 모두 존재한다
- **검증** API 테스트 `OpenApiDocsTest`

#### AC-SWAGGER-03 · bearerAuth 보안 스키마가 유지된다

- **Given** 애플리케이션이 기동했다
- **When** `GET /v3/api-docs`를 호출한다
- **Then** `components.securitySchemes.bearerAuth.type = "http"`, `.scheme = "bearer"`, `.bearerFormat = "JWT"`다
- **검증** API 테스트 `OpenApiDocsTest`

---

## 수동 확인

- [x] `bootRun`(`local` 프로파일)으로 서버를 띄우면 Flyway가 `V11`을 적용하고, 신규 계정으로 `GET /api/v1/recipes`를 호출했을 때 시드 2건이 보인다 — 마이그레이션 자동 적용은 `test` 프로파일에서 검증되지 않으므로 실제 기동으로 확인한다
- [x] Swagger UI(`/swagger-ui.html`)에서 임의의 엔드포인트를 펼쳤을 때 `user` 입력란이 없고, Authorize 버튼으로 넣은 토큰만으로 호출이 성공한다

> **2026-09-03 확인.**
>
> **Flyway V11.** 로컬 DB의 `flyway_schema_history`에 `11 | seed curated recipes | success=t`가 있다(그 위에 `12 | seed holzklotz e80`도). `recipes`에 `source_type='CURATED'`가 정확히 2건 — `James Hoffmann Ultimate V60`(id 8)과 `Tetsu Kasuya 4:6 Method`(id 9), 둘 다 `PUBLIC`. 사용자 12로 `GET /api/v1/recipes`를 호출하니 이 2건이 실제로 내려온다.
>
> **주의:** 실제 기동을 이 세션에서 새로 하지는 않았다. **이미 떠 있던 로컬 백엔드**에 붙어 마이그레이션 이력과 응답을 확인했다 — 즉 「어떤 실제 기동이 V11을 적용했다」까지는 증명되나, 부팅 로그를 눈으로 본 것은 아니다.
>
> **`user` 입력란.** OpenAPI 전체를 훑어 `user`·`principal`·`authentication` 이름의 파라미터를 찾았고 **0건**이다. 보안 스킴은 `bearerAuth`(http/bearer/JWT) 하나뿐이고, Bearer 토큰만으로 `GET /users/me`·`/recipes`·`/bean-batches`·`POST /gear/grind-conversions` 등이 전부 200을 준다.
>
> `GET /api/v1/brew-logs`에 `userId` 쿼리 파라미터가 있으나 이것은 인증 주체 누출이 아니라 `recipeId`·`beanBatchId`와 같은 계열의 **의도된 필터**다(설명: `그 사용자가 남긴 기록만`).

## 열어둔 결정

- **유튜브 원본 URL.** `source_url`을 지금은 레시피 정리 페이지로 둔다. 원본 영상 URL을 확인하면 새 마이그레이션으로 교체할지, 그대로 둘지 그때 정한다.
- **시드 3건째 이후.** 큐레이션 레시피를 계속 늘릴 생각이면 마이그레이션 방식은 한계에 닿는다(내용 수정에 매번 새 파일이 필요하다). 3건째가 필요해지는 시점에 `POST /admin/recipes`를 만든다.
- **`user_grinders.is_default`를 세팅하는 경로.** 목록 조회 스펙이 남긴 항목으로 이번 범위 밖이다.

---
id: FORK
title: 레시피 포크
status: 구현완료
plan: docs/plans/2026-08-18-plan-fork.md
---

# 레시피 포크 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

사용자가 **볼 수 있는 레시피를 자기 것으로 복제한다.** 레시피 본체와 푸어 스텝 전체를 깊은 복사하고, 소유자를 포크한 사람으로 바꾸며, 공개범위를 `PRIVATE`으로 초기화한다. 복제본은 원본을 가리키는 `parentRecipeId`와 계보 최상위를 가리키는 `forkRootId`를 갖는다.

복제 후 원본이 수정되거나 삭제돼도 복제본은 변하지 않는다. 복제본 수정은 기존 `PUT /api/v1/recipes/{id}`로 한다.

### 범위 밖 (Non-goals)

- **원본 대비 diff 조회.** 어떤 파라미터가 달라졌는지 돌려주는 API는 만들지 않는다. `architecture.md:177`이 유스케이스로 잡아뒀으나 별도 스펙으로 미룬다.
- **계보 조회 API.** 부모·루트·자식 목록을 돌려주는 엔드포인트는 만들지 않는다. 응답에 `parentRecipeId`·`forkRootId`가 실리므로 클라이언트가 한 단계씩 따라갈 수는 있다.
- **포크 횟수 집계.** `forkCount` 같은 필드는 두지 않는다.
- **포크와 동시에 값 수정.** 요청 본문을 받지 않는다. 제목·물량 변경은 생성 후 `PUT`으로 한다.
- **브루잉 로그 포크.** 실행 기록은 복제 대상이 아니다.

## 왜

이 서비스의 핵심 시나리오(`architecture.md:253`) 3단계가 "Kasuya 4:6 시드 레시피 포크 → 물량 조정 후 저장"이다. 지금은 그 경로가 없다. 남의 레시피를 참고하려면 화면을 보며 값을 손으로 옮겨 적어야 하고, 그렇게 만든 레시피는 원본과의 관계가 기록되지 않아 "무엇을 어떻게 바꿨나"를 나중에 알 수 없다.

`parent_recipe_id`·`fork_root_id` 컬럼은 V6부터 있으나 항상 `null`이다. 레시피 CRUD 스펙이 "포크가 이 컬럼들을 곧 쓴다"며 미리 넣어둔 자리다.

## 용어

| 용어 | 정의 |
|---|---|
| 원본 | 포크의 대상이 된 레시피. 복제본의 `parentRecipeId`가 가리킨다 |
| 포크본 | 포크로 새로 만들어진 레시피 |
| 계보 최상위 | 포크 체인을 거슬러 올라간 맨 처음 레시피. `forkRootId`가 가리킨다 |
| 깊은 복사 | 값을 새 행으로 복제하는 것. 원본을 참조하지 않으므로 원본이 바뀌어도 복제본은 그대로다 |

## 데이터

**스키마 변경 없음.** `recipes.parent_recipe_id`·`fork_root_id`(둘 다 `BIGINT NULL`, `REFERENCES recipes(id)`)와 `idx_recipes_parent` 인덱스가 `V6__create_recipe_tables.sql`에 이미 있다. 마이그레이션 파일을 추가하지 않는다.

### 포크가 값을 정하는 방식

| 컬럼 | 포크본의 값 |
|---|---|
| `owner_user_id` | 포크를 요청한 사용자 |
| `visibility` | `PRIVATE` 고정 (원본이 `PUBLIC`이어도) |
| `source_type` | `USER` 고정 (원본이 `CURATED`여도) |
| `parent_recipe_id` | 원본의 `id` |
| `fork_root_id` | 원본의 `fork_root_id`가 있으면 그 값, 없으면 원본의 `id` |
| `author_name`·`source_url`·`source_note` | 원본 값 그대로 승계 |
| `grind_micron_estimated` | 원본 값 그대로 복사 (재계산하지 않는다) |
| `title`·`description`·`brew_method`·`dose_g`·`water_g`·`water_temp_c`·`total_time_seconds`·`brewer_id`·`filter_id`·`grinder_model_id`·`grind_setting_value`·`grind_setting_unit` | 원본 값 그대로 복사 |
| `created_at`·`updated_at` | 포크 시각 |
| `deleted_at` | `null` |

`recipe_steps`는 전 행을 복사한다. `step_order`·`step_type`·`start_at_seconds`·`duration_seconds`·`water_g`·`pour_technique`·`agitation`·`note`가 모두 원본과 같고, `recipe_id`만 포크본을 가리킨다.

## API

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/v1/recipes/{id}/fork` | 필요 | 레시피를 포크한다. 요청 본문 없음 |

포크 인가는 **조회 인가와 동일하다.** `docs/specs/2026-08-17-visibility-authorization.md`의 판정 순서(소유자 → `PUBLIC` → `FRIENDS`+상호 팔로우 → 403)를 그대로 쓴다. 볼 수 있으면 포크할 수 있다.

응답은 기존 `RecipeResponse`이며, **필드 2개가 추가된다.**

| 필드 | 타입 | Null | 설명 |
|---|---|---|---|
| `parentRecipeId` | `Long` | O | 포크가 아니면 `null` |
| `forkRootId` | `Long` | O | 포크가 아니면 `null` |

기존 조회·생성·수정 응답에도 이 두 필드가 함께 나타난다(포크가 아닌 레시피는 `null`).

### 요청 / 응답 예시

```
POST /api/v1/recipes/42/fork
Authorization: Bearer <token>
(본문 없음)
```

```json
{
  "id": 87,
  "ownerUserId": 5,
  "sourceType": "USER",
  "title": "Kasuya 4:6",
  "visibility": "PRIVATE",
  "parentRecipeId": 42,
  "forkRootId": 42,
  "doseG": 20.0,
  "waterG": 300.0,
  "ratio": 15.0,
  "authorName": "Tetsu Kasuya",
  "steps": [
    {"stepOrder": 1, "stepType": "BLOOM", "startAtSeconds": 0, "durationSeconds": 10, "waterG": 60.0}
  ]
}
```

---

## 어떻게 동작 — 인수 조건

> 각 조건은 리터럴 값을 쓴다. 경계값은 각각 별도 조건으로 나눈다.
> ID는 한 번 부여하면 바꾸지 않는다.

### 생성과 계보

#### AC-FORK-01 · 포크하면 새 레시피가 생긴다

- **Given** 사용자 A가 소유한 `PUBLIC` 레시피 `R1`(`title: "원본"`, `doseG: 15.0`)이 있다
- **When** 사용자 B가 `POST /api/v1/recipes/{R1}/fork`를 호출한다
- **Then** HTTP `201`을 반환하고, 응답의 `id`가 `R1`의 `id`와 다르며, `title`은 `"원본"`, `doseG`는 `15.0`이다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-02 · 포크본의 소유자는 포크한 사용자다

- **Given** 사용자 A가 소유한 `PUBLIC` 레시피 `R1`이 있고, 사용자 B의 id는 `A와 다른 값`이다
- **When** B가 `R1`을 포크한다
- **Then** 응답의 `ownerUserId`가 B의 id다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-03 · 포크본의 공개범위는 PRIVATE이다

- **Given** 사용자 A가 소유한 `visibility: "PUBLIC"` 레시피 `R1`이 있다
- **When** B가 `R1`을 포크한다
- **Then** 응답의 `visibility`가 `"PRIVATE"`이다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-04 · 포크본의 parentRecipeId는 원본 id다

- **Given** 사용자 A가 소유한 `PUBLIC` 레시피 `R1`이 있다
- **When** B가 `R1`을 포크한다
- **Then** 응답의 `parentRecipeId`가 `R1`의 `id`다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-05 · 원본이 포크가 아니면 forkRootId는 원본 id다

- **Given** 사용자 A가 소유한 `PUBLIC` 레시피 `R1`이 있고 `R1`의 `forkRootId`는 `null`이다
- **When** B가 `R1`을 포크한다
- **Then** 응답의 `forkRootId`가 `R1`의 `id`다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-06 · 3단계 체인에서 forkRootId는 최초 원본을 가리킨다

- **Given** `R1`(A 소유, `PUBLIC`)을 B가 포크해 `R2`를 만들고, `R2`의 `visibility`를 `PUBLIC`으로 바꾼 뒤 C가 `R2`를 포크해 `R3`를 만들었다
- **When** `R3`의 응답을 확인한다
- **Then** `R3`의 `forkRootId`가 `R1`의 `id`다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-07 · 3단계 체인에서 parentRecipeId는 직전 원본을 가리킨다

- **Given** `AC-FORK-06`과 같은 3단계 체인이 있다
- **When** `R3`의 응답을 확인한다
- **Then** `R3`의 `parentRecipeId`가 `R2`의 `id`다 (`R1`이 아니다)
- **검증** API 테스트 `RecipeForkControllerTest`

### 깊은 복사

#### AC-FORK-08 · 스텝 개수와 순서가 복사된다

- **Given** 스텝 5개(`stepOrder` 1~5)를 가진 `PUBLIC` 레시피 `R1`이 있다
- **When** B가 `R1`을 포크한다
- **Then** 응답의 `steps` 길이가 `5`이고 `stepOrder`가 순서대로 `1, 2, 3, 4, 5`다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-09 · 스텝의 값이 그대로 복사된다

- **Given** 첫 스텝이 `{stepType: "BLOOM", startAtSeconds: 0, durationSeconds: 10, waterG: 60.0}`인 `PUBLIC` 레시피 `R1`이 있다
- **When** B가 `R1`을 포크한다
- **Then** 포크본 첫 스텝의 `stepType`이 `"BLOOM"`, `startAtSeconds`가 `0`, `durationSeconds`가 `10`, `waterG`가 `60.0`이다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-10 · 스텝이 0개여도 포크된다

- **Given** 스텝이 0개인 `PUBLIC` 레시피 `R1`이 있다
- **When** B가 `R1`을 포크한다
- **Then** HTTP `201`을 반환하고 응답의 `steps` 길이가 `0`이다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-11 · 원본을 수정해도 포크본은 변하지 않는다

- **Given** `doseG: 15.0`인 `PUBLIC` 레시피 `R1`을 B가 포크해 `R2`를 만들었다
- **When** A가 `PUT /api/v1/recipes/{R1}`로 `doseG`를 `20.0`으로 바꾼 뒤 B가 `R2`를 조회한다
- **Then** `R2`의 `doseG`가 `15.0`이다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-12 · 원본의 스텝을 지워도 포크본의 스텝은 남는다

- **Given** 스텝 5개짜리 `PUBLIC` 레시피 `R1`을 B가 포크해 `R2`를 만들었다
- **When** A가 `PUT /api/v1/recipes/{R1}`로 `steps`를 빈 배열로 바꾼 뒤 B가 `R2`를 조회한다
- **Then** `R2`의 `steps` 길이가 `5`다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-13 · 마이크론 스냅샷이 원본 값 그대로 복사된다

- **Given** `grinderModelId`가 Comandante C40 MK4이고 `grindSettingValue: 22`, `grindSettingUnit: "CLICK"`이라 `grindMicronEstimated`가 `660`인 `PUBLIC` 레시피 `R1`이 있다
- **When** B가 `R1`을 포크한다
- **Then** 포크본의 `grindMicronEstimated`가 `660`이다
- **검증** API 테스트 `RecipeForkControllerTest`

### 출처와 타입

#### AC-FORK-14 · CURATED를 포크하면 sourceType은 USER다

- **Given** `sourceType: "CURATED"`이고 `visibility: "PUBLIC"`인 레시피 `R1`이 있다
- **When** B가 `R1`을 포크한다
- **Then** 응답의 `sourceType`이 `"USER"`다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-15 · 출처 3필드는 원본에서 승계된다

- **Given** `authorName: "Tetsu Kasuya"`, `sourceUrl: "https://example.com/46"`, `sourceNote: "4:6 메서드"`인 `PUBLIC` 레시피 `R1`이 있다
- **When** B가 `R1`을 포크한다
- **Then** 포크본의 `authorName`이 `"Tetsu Kasuya"`, `sourceUrl`이 `"https://example.com/46"`, `sourceNote`가 `"4:6 메서드"`다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-16 · 주인 없는 PUBLIC 레시피도 포크된다

- **Given** `ownerUserId`가 `null`이고 `visibility: "PUBLIC"`인 레시피 `R1`이 있다
- **When** B가 `R1`을 포크한다
- **Then** HTTP `201`을 반환하고 응답의 `ownerUserId`가 B의 id, `parentRecipeId`가 `R1`의 `id`다
- **검증** API 테스트 `RecipeForkControllerTest`

### 중복

#### AC-FORK-17 · 같은 원본을 두 번 포크할 수 있다

- **Given** 사용자 A가 소유한 `PUBLIC` 레시피 `R1`이 있다
- **When** B가 `R1`을 연속으로 두 번 포크한다
- **Then** 두 응답 모두 HTTP `201`이고 두 `id`가 서로 다르며, 둘 다 `parentRecipeId`가 `R1`의 `id`다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-18 · 자기 레시피를 자기가 포크할 수 있다

- **Given** 사용자 A가 소유한 `PRIVATE` 레시피 `R1`이 있다
- **When** A가 `R1`을 포크한다
- **Then** HTTP `201`을 반환하고 응답의 `ownerUserId`가 A의 id, `parentRecipeId`가 `R1`의 `id`다
- **검증** API 테스트 `RecipeForkControllerTest`

### 인가

#### AC-FORK-19 · 상호 팔로우면 FRIENDS 레시피를 포크할 수 있다

- **Given** A가 소유한 `visibility: "FRIENDS"` 레시피 `R1`이 있고 A와 B가 서로 팔로우한 상태다
- **When** B가 `R1`을 포크한다
- **Then** HTTP `201`을 반환한다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-20 · 타인의 PRIVATE 레시피는 포크할 수 없다

- **Given** A가 소유한 `visibility: "PRIVATE"` 레시피 `R1`이 있고 A와 B가 서로 팔로우한 상태다
- **When** B가 `R1`을 포크한다
- **Then** HTTP `403`과 `code: "FORBIDDEN"`을 반환한다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-21 · 단방향 팔로우면 FRIENDS 레시피를 포크할 수 없다

- **Given** A가 소유한 `visibility: "FRIENDS"` 레시피 `R1`이 있고 B만 A를 팔로우한 상태다
- **When** B가 `R1`을 포크한다
- **Then** HTTP `403`과 `code: "FORBIDDEN"`을 반환한다
- **검증** API 테스트 `RecipeForkControllerTest`

### 에러

#### AC-FORK-22 · 없는 레시피를 포크하면 404다

- **Given** id `999999`인 레시피가 없다
- **When** B가 `POST /api/v1/recipes/999999/fork`를 호출한다
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-23 · 소프트 삭제된 레시피를 포크하면 404다

- **Given** A가 소유한 `PUBLIC` 레시피 `R1`을 A가 `DELETE`로 지웠다
- **When** B가 `R1`을 포크한다
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **검증** API 테스트 `RecipeForkControllerTest`

#### AC-FORK-24 · 토큰 없이 포크하면 401이다

- **Given** A가 소유한 `PUBLIC` 레시피 `R1`이 있다
- **When** `Authorization` 헤더 없이 `POST /api/v1/recipes/{R1}/fork`를 호출한다
- **Then** HTTP `401`을 반환한다
- **검증** API 테스트 `RecipeForkControllerTest`

---

## 수동 확인

- [x] Swagger UI에서 `POST /api/v1/recipes/{id}/fork`가 요청 본문 없이 실행되고, 응답에 `parentRecipeId`·`forkRootId`가 보인다

## 열어둔 결정

- **diff 조회.** 원본 대비 어떤 파라미터가 달라졌는지 돌려주는 API. 포크가 실제로 쌓인 뒤 별도 스펙으로 다룬다.
- **계보 조회.** 자식 목록·체인 전체를 한 번에 주는 API. 포크 체인이 3단계 이상으로 실제로 깊어지면 그때 정한다.
- **원본 삭제 시 계보 표시.** 원본이 소프트 삭제돼도 `parentRecipeId`는 그대로 남는다. 클라이언트가 그 원본을 조회하면 `404`가 나는데, 이를 "삭제된 원본"으로 표시할지는 프론트 작업(Plan 4)에서 정한다.

---
id: MEDIA
title: 사진 첨부
status: 초안
plan:
---

# 사진 첨부 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

사용자가 **자신의 레시피·브루잉 로그에 사진을 첨부한다.** 클라이언트가 OCI Object Storage에 Pre-Authenticated Request(PAR)로 직접 업로드하고, 백엔드는 업로드 URL 발급과 메타데이터(대상·크기·정렬 순서) 확정만 담당한다 — 파일 바이트는 백엔드 서버를 거치지 않는다.

### 범위 밖 (Non-goals)

- **`BEAN_PRODUCT`·`BEAN_BATCH` 첨부.** `target_type` enum은 이번엔 `RECIPE`·`BREW_LOG` 2개만 정의한다. 원두 사진은 별도 스펙으로 미룬다.
- **첨부 재정렬 API.** `sort_order`는 등록 순서로 서버가 자동 부여하며, 이후 순서를 바꾸는 API는 만들지 않는다.
- **원본 대비 diff·계보 조회 같은 부가 API.** 이 스펙은 업로드·확정·조회·삭제 4개 엔드포인트만 다룬다.
- **소프트 삭제된 대상에 딸린 고아 첨부 자동 정리.** 레시피가 소프트 삭제돼도 그 첨부의 OCI 객체·DB 행은 자동으로 지워지지 않는다. 배치 정리는 이번 범위가 아니다.
- **OCI 배포·CI/CD 자체.** 이 스펙은 애플리케이션 코드만 다룬다. 실제 OCI 인스턴스·버킷 구성은 별도 스펙(Plan 3의 나머지 항목)에서 다룬다.

## 왜

핵심 시나리오(`architecture.md:253`) 5단계가 "브루잉 로그 작성(사진 포함)"이다. 지금은 사진을 남길 방법이 전혀 없다 — 추출 결과를 텍스트와 숫자로만 기록해야 해서, 크레마 색이나 채널링 같은 시각 정보가 유실된다.

`attachments` 테이블은 아키텍처 문서에 데이터 모델로만 잡혀 있고 실제 마이그레이션·API는 없다. `recipe-crud`·`brew-log` 스펙 둘 다 "사진 첨부는 Plan 3(Object Storage)"라며 명시적으로 비목표로 미뤄둔 항목이다.

## 용어

| 용어 | 정의 |
|---|---|
| PAR (Pre-Authenticated Request) | OCI Object Storage가 발급하는 시간제한 서명 URL. 이 URL로 인증 없이 직접 업로드·다운로드할 수 있다 |
| 확정(confirm) | 클라이언트가 PAR로 업로드를 마친 뒤, 백엔드에 메타데이터를 보내 `attachments` 행을 실제로 만드는 단계 |
| 대상(target) | 사진이 딸리는 레시피 또는 브루잉 로그. `target_type` + `target_id`로 가리킨다 |

## 데이터

새 테이블 `attachments`를 만든다 (`V9__create_attachments_table.sql`).

| 테이블 | 컬럼 | 타입 | Null | 설명 |
|---|---|---|---|---|
| attachments | id | BIGSERIAL | X | PK |
| attachments | owner_user_id | BIGINT | X | 업로드한 사용자. 대상의 소유자와 항상 같다 |
| attachments | target_type | VARCHAR(20) | X | `RECIPE` \| `BREW_LOG` |
| attachments | target_id | BIGINT | X | 대상의 id. FK를 걸지 않는다 — 대상이 서로 다른 두 테이블 중 하나이기 때문이다 |
| attachments | object_key | VARCHAR(500) | X | UNIQUE. OCI 저장 경로 |
| attachments | content_type | VARCHAR(50) | X | OCI HEAD 응답에서 읽은 값 |
| attachments | width | INTEGER | X | 클라이언트가 측정해 보낸 값 |
| attachments | height | INTEGER | X | 클라이언트가 측정해 보낸 값 |
| attachments | sort_order | INTEGER | X | 확정된 순서대로 1부터 자동 부여 |
| attachments | created_at | TIMESTAMPTZ | X | |

## API

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/v1/attachments/upload-url` | 필요 | PAR 발급 (본문 없이 응답만 만드는 게 아니라, 대상·content-type을 요청 본문으로 받는다) |
| POST | `/api/v1/attachments` | 필요 | 업로드 확정 — 실제 `attachments` 행 생성 |
| GET | `/api/v1/attachments?targetType=&targetId=` | 필요 | 대상의 첨부 목록 조회 (`sort_order` 오름차순) |
| DELETE | `/api/v1/attachments/{id}` | 필요 | 삭제 — DB 행과 OCI 객체를 동기적으로 함께 지운다 |

**인가 규칙:**
- 업로드 URL 발급·확정·삭제는 **대상의 소유자만.** 삭제는 `attachments.owner_user_id`로 직접 판정한다(대상을 다시 조회하지 않는다).
- 목록 조회는 대상의 기존 공개범위 규칙을 그대로 따른다(`docs/specs/2026-08-17-visibility-authorization.md`의 `findViewable`과 동일한 소유자 → PUBLIC → FRIENDS+상호팔로우 → 403 순서).
- **버킷은 public-read다.** 응답의 `url`은 고정 공개 URL이며, `PRIVATE`·`FRIENDS` 대상의 사진도 URL을 아는 사람은 인증 없이 볼 수 있다. object_key가 UUID라 추측이 사실상 불가능하다는 것과, 2인이 쓰는 취미 프로젝트라는 것을 근거로 감안하고 진행한다.

### 요청 / 응답 예시

**1) 업로드 URL 발급**

```
POST /api/v1/attachments/upload-url
Authorization: Bearer <token>
Content-Type: application/json

{"targetType":"RECIPE","targetId":42,"contentType":"image/jpeg"}
```

```json
{
  "objectKey": "attachments/RECIPE/42/3fa85f64-5717-4562-b3fc-2c963f66afa6.jpg",
  "uploadUrl": "https://objectstorage.ap-chuncheon-1.oraclecloud.com/p/.../attachments/RECIPE/42/3fa85f64....jpg",
  "expiresAt": "2026-08-18T02:10:00Z"
}
```

**2) 클라이언트가 `uploadUrl`에 직접 `PUT`으로 파일 업로드** (백엔드를 거치지 않음)

**3) 업로드 확정**

```
POST /api/v1/attachments
Authorization: Bearer <token>
Content-Type: application/json

{"targetType":"RECIPE","targetId":42,"objectKey":"attachments/RECIPE/42/3fa85f64....jpg","width":1200,"height":900}
```

```json
{
  "id": 7,
  "targetType": "RECIPE",
  "targetId": 42,
  "url": "https://objectstorage.ap-chuncheon-1.oraclecloud.com/n/.../attachments/RECIPE/42/3fa85f64....jpg",
  "contentType": "image/jpeg",
  "width": 1200,
  "height": 900,
  "sortOrder": 1,
  "createdAt": "2026-08-18T02:01:12Z"
}
```

---

## 어떻게 동작 — 인수 조건

> 각 조건은 리터럴 값을 쓴다. 경계값은 각각 별도 조건으로 나눈다.
> ID는 한 번 부여하면 바꾸지 않는다.

### 업로드 URL 발급

#### AC-MEDIA-01 · RECIPE 소유자가 업로드 URL을 발급받는다

- **Given** 사용자 A가 소유한 레시피 `R1`이 있다
- **When** A가 `POST /api/v1/attachments/upload-url`을 `{targetType:"RECIPE", targetId:R1, contentType:"image/jpeg"}`로 호출한다
- **Then** HTTP `200`을 반환하고, 응답에 `objectKey`·`uploadUrl`·`expiresAt`이 모두 있으며 `objectKey`는 `attachments/RECIPE/{R1}/`로 시작하고 `.jpg`로 끝난다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-02 · BREW_LOG 소유자가 업로드 URL을 발급받는다

- **Given** 사용자 A가 소유한 브루잉 로그 `L1`이 있다
- **When** A가 `{targetType:"BREW_LOG", targetId:L1, contentType:"image/png"}`로 요청한다
- **Then** HTTP `200`을 반환하고 `objectKey`는 `attachments/BREW_LOG/{L1}/`로 시작하고 `.png`로 끝난다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-03 · expiresAt은 발급 시각으로부터 정확히 10분 뒤다

- **Given** 사용자 A가 소유한 레시피 `R1`이 있다
- **When** A가 업로드 URL을 요청한다
- **Then** 응답의 `expiresAt`이 요청 처리 시각 + `600`초다 (허용 오차 `±5`초)
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-04 · content-type마다 확장자가 다르게 붙는다

- **Given** 사용자 A가 소유한 레시피 `R1`이 있다
- **When** A가 `contentType:"image/webp"`로 요청한다
- **Then** `objectKey`가 `.webp`로 끝난다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-05 · 허용 밖 content-type은 400이다

- **Given** 사용자 A가 소유한 레시피 `R1`이 있다
- **When** A가 `contentType:"image/gif"`로 요청한다
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환하고, `attachments`에 아무 행도 생기지 않는다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-06 · 없는 대상은 404다

- **Given** id `999999`인 레시피가 없다
- **When** 사용자 A가 `{targetType:"RECIPE", targetId:999999, ...}`로 요청한다
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-07 · 소프트 삭제된 레시피는 404다

- **Given** 사용자 A가 소유한 레시피 `R1`을 A가 삭제했다
- **When** A가 `R1`에 업로드 URL을 요청한다
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-08 · 소유자가 아니면 403이다

- **Given** 사용자 A가 소유한 레시피 `R1`이 있고 사용자 B는 A가 아니다
- **When** B가 `R1`에 업로드 URL을 요청한다
- **Then** HTTP `403`과 `code: "FORBIDDEN"`을 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-09 · 이미 4장이면 400이다

- **Given** 사용자 A가 소유한 레시피 `R1`에 이미 확정된 첨부가 `4`개 있다
- **When** A가 `R1`에 업로드 URL을 요청한다
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-10 · 3장까지는 정상 발급된다 (경계값)

- **Given** 사용자 A가 소유한 레시피 `R1`에 이미 확정된 첨부가 `3`개 있다
- **When** A가 `R1`에 업로드 URL을 요청한다
- **Then** HTTP `200`을 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-11 · 토큰 없이 요청하면 401이다

- **Given** 사용자 A가 소유한 레시피 `R1`이 있다
- **When** `Authorization` 헤더 없이 업로드 URL을 요청한다
- **Then** HTTP `401`을 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

### 업로드 확정

#### AC-MEDIA-12 · 정상 확정하면 201과 AttachmentResponse를 반환한다

- **Given** 사용자 A가 소유한 레시피 `R1`이 있고, A가 업로드 URL을 발급받아 `objectKey`로 실제 업로드까지 마쳤다(OCI에 파일 존재, `Content-Length: 500000`, `Content-Type: image/jpeg`)
- **When** A가 `POST /api/v1/attachments`를 `{targetType:"RECIPE", targetId:R1, objectKey, width:1200, height:900}`로 호출한다
- **Then** HTTP `201`을 반환하고 응답의 `targetType`이 `"RECIPE"`, `targetId`가 `R1`, `width`가 `1200`, `height`가 `900`, `sortOrder`가 `1`이다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-13 · 두 번째 확정의 sortOrder는 2다

- **Given** `AC-MEDIA-12`로 첫 번째 첨부가 이미 확정된 `R1`이 있고, 두 번째 파일도 업로드까지 마쳤다
- **When** A가 두 번째 파일을 확정한다
- **Then** 응답의 `sortOrder`가 `2`다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-14 · content_type은 클라이언트 값이 아니라 OCI HEAD 응답 값이 저장된다

- **Given** 사용자 A가 `contentType:"image/jpeg"`로 업로드 URL을 발급받았으나, 실제 OCI에는 `Content-Type: image/png`로 업로드됐다(HEAD 응답 기준)
- **When** A가 확정 요청을 보낸다(요청 본문에 content_type 필드 자체가 없다)
- **Then** 응답의 `contentType`이 `"image/png"`다 — HEAD 응답을 신뢰한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-15 · width·height가 없으면 400이다

- **Given** 사용자 A가 소유한 레시피 `R1`과 업로드까지 마친 `objectKey`가 있다
- **When** A가 `width`·`height` 없이 확정 요청을 보낸다
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-16 · OCI에 파일이 없으면(HEAD 실패) 404다

- **Given** 사용자 A가 업로드 URL을 발급받았으나 실제로 업로드하지 않았다
- **When** A가 그 `objectKey`로 확정 요청을 보낸다
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환하고 `attachments`에 행이 생기지 않는다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-17 · 10MB를 초과하면 OCI 객체를 지우고 400을 반환한다

- **Given** 사용자 A가 업로드한 파일의 OCI `Content-Length`가 `10485761`바이트(10MB + 1바이트)다
- **When** A가 확정 요청을 보낸다
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환하고, 해당 `objectKey`가 OCI에서 삭제되며 `attachments`에 행이 생기지 않는다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-18 · 정확히 10MB는 통과한다 (경계값 포함)

- **Given** 사용자 A가 업로드한 파일의 OCI `Content-Length`가 정확히 `10485760`바이트(10MB)다
- **When** A가 확정 요청을 보낸다
- **Then** HTTP `201`을 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-19 · 같은 objectKey로 중복 확정하면 400이다

- **Given** `objectKey`로 이미 확정된 첨부가 있다
- **When** 같은 `objectKey`로 다시 확정 요청을 보낸다
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-20 · 소유자가 아니면 403이다

- **Given** 사용자 A가 소유한 레시피 `R1`과 업로드까지 마친 `objectKey`가 있고, 사용자 B는 A가 아니다
- **When** B가 그 `objectKey`로 확정 요청을 보낸다
- **Then** HTTP `403`과 `code: "FORBIDDEN"`을 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-21 · 토큰 없이 확정하면 401이다

- **Given** 업로드까지 마친 `objectKey`가 있다
- **When** `Authorization` 헤더 없이 확정 요청을 보낸다
- **Then** HTTP `401`을 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

### 목록 조회

#### AC-MEDIA-22 · 소유자는 PRIVATE 대상의 첨부를 sortOrder 오름차순으로 본다

- **Given** 사용자 A가 소유한 `PRIVATE` 레시피 `R1`에 첨부 2개가 `sortOrder` `1`, `2`로 확정돼 있다
- **When** A가 `GET /api/v1/attachments?targetType=RECIPE&targetId={R1}`을 호출한다
- **Then** HTTP `200`을 반환하고 응답 배열의 길이가 `2`이며 첫 원소의 `sortOrder`가 `1`, 두 번째가 `2`다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-23 · 타인은 PUBLIC 대상의 첨부를 본다

- **Given** 사용자 A가 소유한 `PUBLIC` 레시피 `R1`에 첨부 1개가 있고, 사용자 B는 A가 아니다
- **When** B가 목록을 조회한다
- **Then** HTTP `200`과 배열 길이 `1`을 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-24 · 상호 팔로우면 FRIENDS 대상의 첨부를 본다

- **Given** 사용자 A가 소유한 `FRIENDS` 레시피 `R1`에 첨부 1개가 있고, A와 B가 서로 팔로우한다
- **When** B가 목록을 조회한다
- **Then** HTTP `200`과 배열 길이 `1`을 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-25 · 타인의 PRIVATE 대상은 403이다

- **Given** 사용자 A가 소유한 `PRIVATE` 레시피 `R1`이 있고, 사용자 B는 A가 아니다
- **When** B가 목록을 조회한다
- **Then** HTTP `403`과 `code: "FORBIDDEN"`을 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-26 · 첨부가 없으면 빈 배열을 반환한다

- **Given** 사용자 A가 소유한 레시피 `R1`에 첨부가 `0`개다
- **When** A가 목록을 조회한다
- **Then** HTTP `200`과 길이 `0`인 배열을 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-27 · 없는 대상은 404다

- **Given** id `999999`인 레시피가 없다
- **When** 사용자 A가 `targetType=RECIPE&targetId=999999`로 조회한다
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-28 · 토큰 없이 조회하면 401이다

- **Given** 사용자 A가 소유한 `PUBLIC` 레시피 `R1`이 있다
- **When** `Authorization` 헤더 없이 목록을 조회한다
- **Then** HTTP `401`을 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

### 삭제

#### AC-MEDIA-29 · 소유자가 삭제하면 204이고 DB 행과 OCI 객체가 모두 사라진다

- **Given** 사용자 A가 소유한 레시피 `R1`에 확정된 첨부 `T1`(id 보유)이 있다
- **When** A가 `DELETE /api/v1/attachments/{T1}`을 호출한다
- **Then** HTTP `204`를 반환하고, `attachments`에서 `T1` 행이 사라지며 OCI에서도 해당 `objectKey`가 삭제된다(HEAD 요청 시 존재하지 않음)
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-30 · 소유자가 아니면 403이다

- **Given** 사용자 A가 소유한 레시피 `R1`에 첨부 `T1`이 있고, 사용자 B는 A가 아니다
- **When** B가 `T1`을 삭제 요청한다
- **Then** HTTP `403`과 `code: "FORBIDDEN"`을 반환하고, `T1`은 그대로 남는다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-31 · 없는 첨부를 삭제하면 404다

- **Given** id `999999`인 첨부가 없다
- **When** 사용자 A가 `DELETE /api/v1/attachments/999999`를 호출한다
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

#### AC-MEDIA-32 · 토큰 없이 삭제하면 401이다

- **Given** 사용자 A가 소유한 첨부 `T1`이 있다
- **When** `Authorization` 헤더 없이 `T1`을 삭제 요청한다
- **Then** HTTP `401`을 반환한다
- **검증** API 테스트 `AttachmentControllerTest`

---

## 수동 확인

- [ ] 실제 OCI Object Storage 크리덴셜로 업로드 URL 발급 → PAR로 실제 파일 업로드 → 확정 → 공개 URL로 이미지가 실제로 열리는지 확인한다(배포 이후, 로컬 개발에서는 `ObjectStorageClient` 인터페이스를 가짜 구현으로 대체하므로 실제 OCI 연동은 이 단계에서 처음 검증된다)

## 열어둔 결정

- **첨부 재정렬 API.** 지금은 등록 순서 고정. 필요해지면 별도 스펙으로 다룬다
- **`BEAN_PRODUCT`·`BEAN_BATCH` 첨부.** 원두 사진이 실제로 필요해지면 `target_type` enum에 값을 추가하고 별도 스펙을 쓴다
- **소프트 삭제된 대상에 딸린 고아 첨부 정리.** 배치 작업이 필요해질 만큼 쌓이면 그때 정한다

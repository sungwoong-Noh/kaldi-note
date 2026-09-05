---
id: HTTPERR
title: 라우팅 오류의 HTTP 응답 규약
status: 구현완료
plan: docs/plans/2026-09-05-plan-http-error-contract.md
---

# 라우팅 오류의 HTTP 응답 규약 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

매핑되지 않은 경로·메서드·미디어 타입으로 들어온 요청과, 쿼리 파라미터의 타입 변환에 실패한 요청에 대해
서버가 **그 실패에 맞는 상태 코드**(404 / 405 / 415 / 400)와 `ErrorResponse` 본문을 돌려준다.
지금은 넷 모두 500 `INTERNAL_ERROR`로 떨어진다.

### 범위 밖 (Non-goals)

- **보안 필터가 내는 401·403의 빈 본문은 고치지 않는다.** 같은 결이지만 원인이 `GlobalExceptionHandler`가 아니라
  Spring Security의 진입점이라 손대는 곳이 다르다. 이번 변경 뒤에도 401은 본문 0바이트다.
- **`frontend/`는 한 줄도 건드리지 않는다.** 새 code는 프론트의 기존 기본 실패 문구로 떨어진다
  (`entityLabel.ts`가 분기하는 것은 `FORBIDDEN`·`NOT_FOUND` 둘뿐이다).
- **진짜 예상치 못한 예외의 응답 형식은 그대로 둔다.** 고치는 것은 「500이 아니어야 할 것이 500인 경우」만이다.
- **유사 경로 제안(「혹시 이걸 찾으셨나요」)을 하지 않는다.** 매핑된 경로 목록이 밖으로 새는 것을 막는다.

## 왜

2026-09-03 수동 확인 세션이 실제 응답을 찍어보고 발견했다(`docs/JOURNAL.md`). 이 스펙을 쓰기 전 다시 측정한 결과다 —
**로컬 백엔드에 유효한 토큰으로 보낸 실제 응답**이다.

| 요청 | 지금 | 있어야 할 것 |
|---|---|---|
| `GET /api/v1/grinder-models` (매핑 없는 경로) | 500 `INTERNAL_ERROR` | 404 |
| `GET /nope` | 500 `INTERNAL_ERROR` | 404 |
| `PATCH /api/v1/recipes/19` (매핑 없는 메서드) | 500 `INTERNAL_ERROR` | 405 |
| `POST /api/v1/recipes` + `Content-Type: text/plain` | 500 `INTERNAL_ERROR` | 415 |
| `GET /api/v1/recipes?size=abc` (타입 변환 실패) | 500 `INTERNAL_ERROR` | 400 |

원인은 한 곳이다. `GlobalExceptionHandler`의 `@ExceptionHandler(Exception.class)`가 스프링의 라우팅 예외까지
`INTERNAL_ERROR`로 삼킨다. 없는 *리소스*(`GET /api/v1/recipes/999999`)만 도메인 코드가 직접 던져서 제대로 404다.

이것이 문제인 이유가 셋이다.

1. **클라이언트가 자기 잘못을 서버 장애로 오해한다.** 프론트가 경로를 오타 내면 「서버 오류가 발생했습니다」가 뜬다.
   재시도해도 될 상황인지 아닌지를 판단할 수 없다.
2. **진짜 장애가 로그에 묻힌다.** 지금은 오타 URL 한 번마다 `log.error` + 스택트레이스가 쌓인다.
3. **이 결함이 이미 코드 설계를 한 번 비틀었다.** `PageParams`의 주석이 그 기록이다 —
   「검증을 Bean Validation 애노테이션으로 하지 않는 이유: `ConstraintViolationException`이 나는데
   `GlobalExceptionHandler`에 그 핸들러가 없어 500이 된다」. 우회로를 만들어 피해온 것이지 없는 문제가 아니었다.

## 용어

| 용어 | 정의 |
|---|---|
| 없는 **경로** | 어떤 컨트롤러 메서드에도 매핑되지 않은 URL. 예: `/api/v1/grinder-models` |
| 없는 **리소스** | 매핑된 경로이지만 그 id의 행이 DB에 없는 경우. 예: `/api/v1/recipes/999999` |
| 라우팅 예외 | 컨트롤러 메서드 본문에 들어가기 **전에** 스프링이 던지는 예외. 이 스펙이 다루는 넷이 전부 여기 속한다 |

## 데이터

스키마 변경 없음.

`ErrorCode` enum에 상수 **둘**을 추가한다. 저장되는 값이 아니라 응답 본문의 `code` 문자열이다.

| 상수 | HTTP | `defaultMessage` |
|---|---|---|
| `ENDPOINT_NOT_FOUND` | 404 | `요청하신 주소를 찾을 수 없습니다.` |
| `METHOD_NOT_ALLOWED` | 405 | `이 주소에서 지원하지 않는 방식입니다.` |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | `지원하지 않는 형식입니다.` |

> `ENDPOINT_NOT_FOUND`를 기존 `NOT_FOUND`와 **구분하는 이유**: 프론트가 `code`로 분기하는데
> (`frontend/src/features/brewlog/entityLabel.ts:35`가 `NOT_FOUND`를 「삭제된 ~」로 표시한다),
> 둘을 합치면 오타 난 URL이 「삭제된 레시피」로 표시된다. 같은 404지만 전자는 클라이언트의 버그이고
> 후자는 정상 상황이다.

`METHOD_NOT_ALLOWED`·`UNSUPPORTED_MEDIA_TYPE`은 대응하는 상수가 아예 없어 새로 만든다.
타입 변환 실패는 기존 `INVALID_REQUEST`(400)를 재사용한다.

## API

새 엔드포인트 없음. **모든** 엔드포인트의 오류 응답에 적용된다.

### 응답 예시

```json
// 404 — GET /api/v1/grinder-models
{ "code": "ENDPOINT_NOT_FOUND", "message": "요청하신 주소를 찾을 수 없습니다.", "fieldErrors": [] }
```

```json
// 405 — PATCH /api/v1/recipes/19
// 헤더: Allow: GET, PUT, DELETE
{ "code": "METHOD_NOT_ALLOWED", "message": "이 주소에서 지원하지 않는 방식입니다.", "fieldErrors": [] }
```

```json
// 415 — POST /api/v1/recipes, Content-Type: text/plain
{ "code": "UNSUPPORTED_MEDIA_TYPE", "message": "지원하지 않는 형식입니다.", "fieldErrors": [] }
```

```json
// 400 — GET /api/v1/recipes?size=abc
{
  "code": "INVALID_REQUEST",
  "message": "요청 값이 올바르지 않습니다.",
  "fieldErrors": [{ "field": "size", "message": "숫자여야 합니다." }]
}
```

### 로깅

네 경우 모두 **WARN, 스택트레이스 없이** 남긴다. 클라이언트의 잘못이지 서버 장애가 아니다.
`ERROR` + 스택트레이스는 핸들러가 없는 진짜 예외(500)에만 남는다.

---

## 어떻게 동작 — 인수 조건

> 모든 조건은 **유효한 액세스 토큰을 붙인 요청**을 전제한다. 예외는 `AC-HTTPERR-13`이다.
> 검증은 전부 `GlobalExceptionHandlerTest`(MockMvc 통합 테스트).

### 없는 경로 — 404

#### AC-HTTPERR-01 · 매핑 없는 `/api/v1` 경로는 404다

- **Given** 인증된 사용자
- **When** `GET /api/v1/grinder-models`
- **Then** HTTP `404`와 `code: "ENDPOINT_NOT_FOUND"`를 반환한다
- **검증** API 테스트 `GlobalExceptionHandlerTest`

#### AC-HTTPERR-02 · 404 본문의 문구

- **Given** 인증된 사용자
- **When** `GET /api/v1/grinder-models`
- **Then** 응답 본문의 `message`가 정확히 `"요청하신 주소를 찾을 수 없습니다."`다
- **검증** API 테스트 `GlobalExceptionHandlerTest`

#### AC-HTTPERR-03 · `/api/v1` 밖의 경로도 404다

- **Given** 인증된 사용자
- **When** `GET /nope`
- **Then** HTTP `404`와 `code: "ENDPOINT_NOT_FOUND"`를 반환한다
- **검증** API 테스트 `GlobalExceptionHandlerTest`

#### AC-HTTPERR-04 · 없는 리소스는 `NOT_FOUND`로 남는다

- **Given** 인증된 사용자, id `999999`인 레시피가 없다
- **When** `GET /api/v1/recipes/999999`
- **Then** HTTP `404`와 `code: "NOT_FOUND"`를 반환한다 — `ENDPOINT_NOT_FOUND`가 아니다
- **검증** API 테스트 `GlobalExceptionHandlerTest`

### 매핑 없는 메서드 — 405

#### AC-HTTPERR-05 · 매핑되지 않은 메서드는 405다

- **Given** 인증된 사용자, `/api/v1/recipes/{id}`에 `PATCH` 매핑이 없다
- **When** `PATCH /api/v1/recipes/19`
- **Then** HTTP `405`와 `code: "METHOD_NOT_ALLOWED"`를 반환한다
- **검증** API 테스트 `GlobalExceptionHandlerTest`

#### AC-HTTPERR-06 · 405 본문의 문구

- **Given** 인증된 사용자
- **When** `PATCH /api/v1/recipes/19`
- **Then** 응답 본문의 `message`가 정확히 `"이 주소에서 지원하지 않는 방식입니다."`다
- **검증** API 테스트 `GlobalExceptionHandlerTest`

#### AC-HTTPERR-07 · 405는 `Allow` 헤더를 갖는다

- **Given** 인증된 사용자, `/api/v1/recipes/{id}`는 `GET`·`PUT`·`DELETE` 셋만 매핑돼 있다
- **When** `PATCH /api/v1/recipes/19`
- **Then** 응답의 `Allow` 헤더가 `GET`·`PUT`·`DELETE`를 **포함하고**, `POST`·`PATCH`를 **포함하지 않는다**
- **검증** API 테스트 `GlobalExceptionHandlerTest`

### 미지원 미디어 타입 — 415

#### AC-HTTPERR-08 · JSON이 아닌 본문은 415다

- **Given** 인증된 사용자
- **When** `POST /api/v1/recipes`를 `Content-Type: text/plain`으로 보낸다
- **Then** HTTP `415`와 `code: "UNSUPPORTED_MEDIA_TYPE"`을 반환한다
- **검증** API 테스트 `GlobalExceptionHandlerTest`

#### AC-HTTPERR-09 · 415 본문의 문구

- **Given** 인증된 사용자
- **When** `POST /api/v1/recipes`를 `Content-Type: text/plain`으로 보낸다
- **Then** 응답 본문의 `message`가 정확히 `"지원하지 않는 형식입니다."`다
- **검증** API 테스트 `GlobalExceptionHandlerTest`

### 쿼리 파라미터 타입 변환 실패 — 400

#### AC-HTTPERR-10 · 숫자 파라미터에 문자열이 오면 400이다

- **Given** 인증된 사용자
- **When** `GET /api/v1/recipes?size=abc`
- **Then** HTTP `400`과 `code: "INVALID_REQUEST"`를 반환한다
- **검증** API 테스트 `GlobalExceptionHandlerTest`

#### AC-HTTPERR-11 · 어떤 파라미터가 틀렸는지 `fieldErrors`로 알린다

- **Given** 인증된 사용자
- **When** `GET /api/v1/recipes?size=abc`
- **Then** `fieldErrors` 배열의 길이가 `1`이고 그 항목의 `field`가 `"size"`다
- **검증** API 테스트 `GlobalExceptionHandlerTest`

### 인증 우선순위

#### AC-HTTPERR-13 · 미인증 요청은 경로 존재 여부를 알려주지 않는다

- **Given** `Authorization` 헤더가 없다
- **When** `GET /nope`
- **Then** HTTP `401`을 반환한다 — `404`가 아니다
- **검증** API 테스트 `GlobalExceptionHandlerTest`

### 불변식 — 이 변경으로 깨지면 안 되는 것

> 넷 다 지금 이미 맞게 동작한다. `GlobalExceptionHandler`는 **모든 API의 오류 응답을 지배하는 단일 파일**이라,
> 여기를 고치면서 기존 경로가 조용히 바뀌는 것을 막기 위해 조건으로 못박는다.

#### AC-HTTPERR-12 · 기존 페이지 파라미터 검증은 그대로다

- **Given** 인증된 사용자
- **When** `GET /api/v1/recipes?page=-1`
- **Then** HTTP `400`, `code: "INVALID_REQUEST"`, `message`가 정확히 `"page는 0 이상이어야 합니다: -1"`이다
- **검증** API 테스트 `GlobalExceptionHandlerTest`

#### AC-HTTPERR-14 · 핸들러가 없는 예외는 여전히 500이다

- **Given** 인증된 사용자, 컨트롤러가 `RuntimeException`을 던지는 테스트 전용 엔드포인트
- **When** 그 엔드포인트를 호출한다
- **Then** HTTP `500`과 `code: "INTERNAL_ERROR"`를 반환한다
- **검증** API 테스트 `GlobalExceptionHandlerTest`

#### AC-HTTPERR-15 · 깨진 JSON 본문은 그대로 400이다

- **Given** 인증된 사용자
- **When** `POST /api/v1/recipes`에 본문 `{`를 `Content-Type: application/json`으로 보낸다
- **Then** HTTP `400`, `code: "INVALID_REQUEST"`, `message`가 정확히 `"요청 본문을 읽을 수 없습니다."`다
- **검증** API 테스트 `GlobalExceptionHandlerTest`

---

## 수동 확인

없음. 넷 모두 MockMvc로 상태 코드·`code`·`message`·`Allow` 헤더를 그대로 검증할 수 있다.
폰도 운영 환경도 필요하지 않다.

## 열어둔 결정

- **`ConstraintViolationException`(Bean Validation을 컨트롤러 파라미터에 걸었을 때)은 이번에 다루지 않는다.**
  지금은 아무도 그 애노테이션을 쓰지 않아 발생하지 않는다 — `PageParams`가 그것을 피하려고 만들어졌기 때문이다.
  나중에 파라미터 검증을 애노테이션으로 옮기려는 태스크가 생기면 그때 이 스펙에 조건을 추가한다.
- **401·403의 빈 본문**을 언제 고칠지. 프론트가 401을 만나는 경로는 토큰 만료뿐이고 지금은 상태 코드만으로
  재발급을 트리거하고 있어 급하지 않다. 프론트가 401의 `code`로 분기해야 할 일이 생기면 그때 스펙을 연다.

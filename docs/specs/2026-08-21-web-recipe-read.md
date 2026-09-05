---
id: WEB
title: 프론트 첫 슬라이스 — 로그인 + 레시피 읽기 + 포크
status: 구현완료
plan: docs/plans/2026-08-21-plan-web-recipe-read.md
---

# 프론트 첫 슬라이스 — 로그인 + 레시피 읽기 + 포크 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

**이 스펙은 AC 접두사를 둘 쓴다** — `AC-WEB-nn`(프론트엔드)과 `AC-CORS-nn`(백엔드 CORS 설정). 프론트가 브라우저에서 백엔드를 부르는 순간 CORS가 필요해지므로, 둘은 같은 세션에서 함께 구현해야 의미가 있다. `check-spec-coverage.sh`의 패턴(`AC-[A-Z][A-Z0-9_]*-[0-9]+`)이 둘 다 잡는다.

## 무엇을

**사용자가 브라우저에서 카카오로 로그인하고, 레시피 목록을 훑고, 상세에서 푸어 스텝 시퀀스를 본 뒤, 마음에 드는 레시피를 자기 것으로 포크한다.**

`docs/design/2026-08-14-architecture.md:253`의 핵심 시나리오 7단계 중 1단계(카카오 로그인)와 3단계(시드 레시피 포크)를 화면으로 구현한다. 화면은 넷이다 — `/login`, `/auth/callback`, `/recipes`, `/recipes/[id]`.

함께 **백엔드에 CORS 설정을 추가한다.** 지금 `SecurityConfig`에는 `.cors(...)`도 `CorsConfigurationSource` 빈도 없어서, 다른 출처의 브라우저 요청이 전부 막힌다.

### 범위 밖 (Non-goals)

1. **Vercel 배포·DNS·운영 CORS 출처.** 이번 완료 기준은 `pnpm dev`(localhost:3000)와 `bootRun`(localhost:8080)이 붙어 동작하는 것까지다. `kaldi-note.today`에는 아직 A 레코드가 없고(`api.` 서브도메인만 있다), 카카오 콘솔의 운영 Redirect URI 등록도 사람이 해야 하는 외부 작업이다. 배포는 다음 슬라이스에서 한 덩어리로 다룬다.
2. **레시피 생성·편집·삭제.** 푸어 스텝 에디터(순서 변경·삽입·삭제)와 시퀀스 검증(물량 합계·시간 겹침)을 프론트에도 구현해야 해서 분량이 이 슬라이스의 2배를 넘는다. 이번엔 읽기와 포크만 한다.
3. **브루잉 로그·원두 재고·장비 관리 화면.** 백엔드 API는 준비돼 있으나 화면은 뒤로 미룬다.
4. **PWA(`manifest.json`·Service Worker·오프라인 캐시).** 화면 구조가 자리잡기 전에 캐시 전략을 정하면 두 번 고치게 된다. 레시피 상세를 오프라인 캐시 대상으로 삼는다는 방향만 `frontend/CLAUDE.md`에 남아 있다.
5. **구글 로그인.** 카카오만 붙인다. 백엔드가 `POST /auth/login/{provider}`로 provider를 경로 파라미터로 받으므로 나중에 버튼 하나와 인가 URL 하나를 추가하면 된다.
6. **포크 diff 표시.** `frontend/CLAUDE.md`의 도메인 규칙 4번이지만, 편집 기능이 없으면 포크본과 원본이 항상 같아 diff가 늘 비어 있다. 편집 슬라이스와 함께 한다.
7. **E2E(Playwright)·스냅샷 테스트.** 카카오 OAuth를 CI에서 실계정으로 돌릴 수 없어 스텁이 필요하고, 백엔드+DB를 CI에 띄워야 한다. 초기 UI가 계속 바뀌는 시기라 스냅샷도 갱신 부담만 크다.

## 왜

**백엔드 API 26개가 전부 완성됐는데 사람이 쓸 수 있는 화면이 하나도 없다.** 지금 이 서비스를 쓰려면 Swagger UI에서 JSON을 직접 만들거나 `psql`을 쳐야 한다. 만든 사람 외에는 아무도 쓸 수 없다.

**시드 레시피가 방금 운영에 올라갔다.** Hoffmann V60와 Kasuya 4:6가 `PUBLIC`으로 존재하므로, 신규 사용자가 로그인 직후 볼 콘텐츠가 처음으로 생겼다. 빈 목록이 아니라 실제 데이터 위에 화면을 설계할 수 있는 시점이다.

**읽기와 포크를 먼저 하는 이유**는 쓰기(생성·편집)가 푸어 스텝 에디터라는 가장 복잡한 UI를 요구하기 때문이다. 목록·상세·인증이라는 뼈대를 먼저 세우고 그 위에 에디터를 올리는 편이, 에디터를 만들며 뼈대를 동시에 발명하는 것보다 안전하다. 포크는 버튼 하나와 이동뿐이라 "내 것을 만든다"는 경험을 가장 싸게 완성한다.

## 용어

| 용어 | 정의 |
|---|---|
| BFF Route Handler | `app/api/auth/*`의 Next.js 서버 핸들러. 브라우저와 백엔드 사이에서 인증만 중계하며 `httpOnly` 쿠키를 심는다 |
| 직호출 | 브라우저가 Next 서버를 거치지 않고 백엔드(`localhost:8080`)를 바로 부르는 것. 레시피 조회가 여기 해당하며 CORS를 탄다 |
| 누적 물량 | 1번 스텝부터 해당 스텝까지 붓는 스텝의 `waterG` 합계. **서버가 `cumulativeWaterG`로 준다** (아래 정정 참조) |
| 붓는 스텝 | `stepType`이 `BLOOM` 또는 `POUR`인 스텝 |
| 프리플라이트 | 브라우저가 실제 요청 전에 보내는 `OPTIONS` 요청 |

## 화면

| 경로 | 인증 | 하는 일 |
|---|---|---|
| `/login` | 불필요 | 카카오 인가 URL로 보낸다. `?next=`를 받아 보관한다 |
| `/auth/callback` | 불필요 | `?code=`를 BFF에 넘겨 토큰을 받고 `next` 경로로 이동한다 |
| `/recipes` | 필요 | 레시피 목록. "더 보기"로 페이지를 이어붙인다 |
| `/recipes/[id]` | 필요 | 상세 + 푸어 스텝 타임라인 + 포크 버튼 |

## 인증 흐름

`frontend/CLAUDE.md`의 6단계를 따르되, **백엔드가 `refreshToken`을 JSON 본문으로 반환하고 `Set-Cookie`를 쓰지 않는다**는 사실 때문에 중계 서버가 필요하다. `httpOnly` 쿠키는 브라우저 JS가 만들 수 없다.

```
브라우저                    Next 서버 (BFF)            백엔드
   |  POST /api/auth/login      |                        |
   |--------------------------->|  POST /api/v1/auth/login/kakao
   |                            |----------------------->|
   |                            |<-- {tokens, userId} ---|
   |<-- {accessToken, userId} --|
   |    Set-Cookie: kaldi_refresh=... ; HttpOnly; SameSite=Lax; Path=/
   |
   |  GET /api/v1/recipes  (직호출, Authorization: Bearer)
   |------------------------------------------------------>|
```

| 경유 | 엔드포인트 |
|---|---|
| BFF (`app/api/auth/*`) | `POST /api/v1/auth/login/{provider}`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout` |
| 직호출 | `GET /users/me`, `GET /recipes`, `GET /recipes/{id}`, `POST /recipes/{id}/fork`, `GET /gear/brewers`, `GET /gear/filters` |

- **accessToken은 메모리에만 둔다.** `localStorage`·`sessionStorage`에 쓰지 않는다.
- **refreshToken은 브라우저 JS가 볼 수 없다.** BFF가 쿠키로 심고, 갱신도 BFF가 쿠키에서 읽어 처리한다.
- 401을 받으면 refresh를 **정확히 1회** 시도하고, 성공하면 원 요청을 재시도한다. 실패하면 `/login?next=<현재경로>`로 보낸다.

## 백엔드 변경 — CORS

`SecurityConfig`에 `.cors(...)`와 `CorsConfigurationSource` 빈을 추가한다.

| 항목 | 값 |
|---|---|
| 허용 출처 | `http://localhost:3000` (환경변수 `KALDI_CORS_ALLOWED_ORIGINS`로 주입, 기본값이 이것) |
| 허용 메서드 | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` |
| 허용 헤더 | `Authorization`, `Content-Type` |
| `allowCredentials` | **`false`** — 백엔드는 쿠키를 쓰지 않고 `Authorization: Bearer`만 받는다. 쿠키는 Next 서버 도메인에만 존재한다 |
| `maxAge` | `3600`초 |

프리플라이트(`OPTIONS`)는 인증 없이 통과해야 한다. 브라우저는 프리플라이트에 `Authorization` 헤더를 붙이지 않으므로, 통과시키지 않으면 모든 인증 요청이 실패한다.

## 데이터 — 서버가 주지 않아 화면이 계산하는 것

| 값 | 계산식 | 표시 형식 |
|---|---|---|
| 값 | 출처 | 표시 형식 |
| 스텝 시작 시각 | `startAtSeconds` | `0:00`, `0:45`, `1:15` (`m:ss`) |
| 총 시간 | `totalTimeSeconds` | `3:30` (`m:ss`) |
| 장비 이름 | `brewerId`·`filterId`를 `/gear/brewers`·`/gear/filters` 결과에서 조회 | `Hario V60 02` (`brand` + 공백 + `name`) |

`ratio`·`doseG`·`waterG`·`waterTempC`는 **서버가 준 값을 그대로 표시한다.** 프론트에서 다시 계산하지 않는다 — 반올림 규칙이 두 곳에 생기면 어긋난다.

> **정정 (2026-08-21 구현):** 이 절의 제목과 첫 항목이 틀렸다. **누적 물량은 서버가 `cumulativeWaterG`로 이미 준다** — 프론트가 계산할 것이 아니었다. 스펙을 쓸 때 실제 응답을 확인하지 않고 "안 줄 것"이라 가정했고, 픽스처도 그 가정으로 지어냈다. 그 결과 테스트 54개가 전부 초록인데 실제 상세 화면은 열리지 않았다(스텝 응답에 `id`가 없는데 스키마가 필수로 요구해 Zod 파싱이 실패했다). **픽스처는 실행 중인 백엔드의 응답을 떠서 만든다** — `src/test/fixtures.ts`에 그렇게 고쳐뒀다.
>
> 서버는 붓지 않는 스텝(`WAIT`·`STIR`·`SWIRL`·`DRAWDOWN`)에도 직전 누적값을 실어 보낸다. 표시는 붓는 스텝에만 하므로 `AC-WEB-16`·`AC-WEB-17`은 그대로 유효하다.
>
> 스텝에는 `id`가 없다. 식별자는 `stepOrder`이고 `UNIQUE(recipe_id, step_order)`라 리스트 `key`로 안전하다.

## 에러 처리

백엔드 공통 에러 형식은 `{ code, message, fieldErrors }`이고 **`message`는 사용자에게 그대로 보여줄 수 있는 한국어**다.

| `code` | 처리 |
|---|---|
| `UNAUTHORIZED` | refresh 1회 시도 → 성공하면 원 요청 재시도, 실패하면 `/login?next=<현재경로>` |
| `REFRESH_TOKEN_INVALID` | 재시도 없이 즉시 `/login` |
| `NOT_FOUND` | "레시피를 찾을 수 없습니다" 빈 화면 |
| 그 밖의 모든 `code` | 에러 영역에 `message` 그대로 + "다시 시도" 버튼 |
| 응답이 JSON이 아니거나 네트워크 실패 | "일시적인 오류가 발생했습니다" 고정 문구 + "다시 시도" 버튼 |

**`message` 문자열로 분기하지 않는다.** 분기는 언제나 `code`로 한다(`docs/conventions/frontend.md`「하지 말 것」).

---

## 어떻게 동작 — 인수 조건

> 프론트 인수 조건은 **Vitest + Testing Library + MSW**로 검증한다. 백엔드를 실제로 호출하지 않는다.
> 조회는 사용자가 보는 것으로 한다 — `getByRole`·`getByText`·`getByLabelText`. `getByTestId`는 최후 수단이다.
> CORS 인수 조건은 백엔드 통합 테스트에서 검증한다.

### 백엔드 — CORS

#### AC-CORS-01 · 허용된 출처의 프리플라이트가 통과한다

- **Given** 백엔드가 기동했고 허용 출처가 `http://localhost:3000`이다
- **When** `Origin: http://localhost:3000`, `Access-Control-Request-Method: GET`으로 `OPTIONS /api/v1/recipes`를 호출한다
- **Then** HTTP `200`이고 응답 헤더 `Access-Control-Allow-Origin`이 `http://localhost:3000`이다
- **검증** 통합 테스트 `CorsConfigTest`

#### AC-CORS-02 · 허용되지 않은 출처는 허용 헤더를 받지 못한다

- **Given** 백엔드가 기동했다
- **When** `Origin: http://evil.example`, `Access-Control-Request-Method: GET`으로 `OPTIONS /api/v1/recipes`를 호출한다
- **Then** 응답에 `Access-Control-Allow-Origin` 헤더가 없다
- **검증** 통합 테스트 `CorsConfigTest`

#### AC-CORS-03 · 프리플라이트는 인증 없이 통과한다

- **Given** 백엔드가 기동했다
- **When** `Authorization` 헤더 **없이** `Origin: http://localhost:3000`으로 `OPTIONS /api/v1/recipes`를 호출한다
- **Then** HTTP `200`이고 `401`이 아니다
- **검증** 통합 테스트 `CorsConfigTest`

### 프론트 — 인증

#### AC-WEB-01 · 미인증으로 목록에 접근하면 로그인으로 보낸다

- **Given** accessToken이 없다
- **When** `/recipes`를 연다
- **Then** `/login?next=%2Frecipes`로 이동한다
- **검증** 페이지 테스트 `RecipesPage.test.tsx`

#### AC-WEB-02 · 미인증으로 상세에 접근하면 경로를 보존해 로그인으로 보낸다

- **Given** accessToken이 없다
- **When** `/recipes/1`을 연다
- **Then** `/login?next=%2Frecipes%2F1`로 이동한다
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

#### AC-WEB-03 · 로그인 화면에서 카카오 인가 URL로 이동한다

- **Given** `/login?next=/recipes/1`이 열려 있다
- **When** "카카오로 로그인"을 확인한다
- **Then** `https://kauth.kakao.com/oauth/authorize`로 시작하고 `client_id`·`redirect_uri`·`response_type=code`·`state=%2Frecipes%2F1`을 포함하는 곳을 가리킨다
- **검증** 페이지 테스트 `LoginPage.test.tsx`

> **정정 (2026-08-21 구현):** 원래 "버튼을 누른다"로 썼으나 **링크(`<a href>`)로 구현했다.** 실제로 하는 일이 다른 문서로의 이동이라, 링크로 두면 새 탭 열기·가운데 클릭이 동작하고 스크린리더도 이동임을 알린다. 검증은 `getByRole('link', { name: '카카오로 로그인' })`의 `href`를 확인한다.
>
> **로그인 후 돌아갈 경로는 `state` 파라미터에 싣는다.** 카카오가 그대로 되돌려주므로 콜백에서 꺼내 쓴다. 외부 주소(`//evil.example`)가 들어오면 `/recipes`로 떨어뜨린다 — 오픈 리다이렉트를 막기 위해서다.

#### AC-WEB-04 · 콜백이 인가코드를 넘기고 원래 경로로 돌아간다

- **Given** `/auth/callback?code=test-code&state=%2Frecipes%2F1`이 열린다 (원래 `next=`로 썼으나 카카오가 돌려주는 것은 `state`다)
- **When** 페이지가 마운트된다
- **Then** `POST /api/auth/login`이 `{ "code": "test-code" }`로 호출되고, 성공 후 `/recipes/1`로 이동한다
- **검증** 페이지 테스트 `AuthCallbackPage.test.tsx`

#### AC-WEB-05 · refreshToken은 응답 본문에 없고 httpOnly 쿠키로 나간다

- **Given** 백엔드가 `{ tokens: { accessToken, refreshToken, expiresInSeconds }, userId, nickname, newUser }`를 반환한다
- **When** BFF의 `POST /api/auth/login`을 호출한다
- **Then** 응답 본문에 `refreshToken` 키가 없고, `Set-Cookie` 헤더가 `HttpOnly`와 `SameSite=Lax`를 포함한다
- **검증** Route Handler 테스트 `auth-login-route.test.ts`

#### AC-WEB-06 · accessToken을 브라우저 저장소에 쓰지 않는다

- **Given** 로그인이 성공했다
- **When** `localStorage`와 `sessionStorage` 전체를 훑는다
- **Then** 어느 값에도 accessToken 문자열이 들어 있지 않다
- **검증** 페이지 테스트 `AuthCallbackPage.test.tsx`

#### AC-WEB-07 · 401을 받으면 refresh를 1회 하고 원 요청을 재시도한다

- **Given** `GET /recipes`가 첫 호출에 401(`code: "UNAUTHORIZED"`)을, 재시도에 200을 반환하도록 MSW를 설정한다
- **When** `/recipes`를 연다
- **Then** `POST /api/auth/refresh`가 **정확히 1회** 호출되고, `GET /recipes`가 총 2회 호출되며, 목록이 렌더링된다
- **검증** 페이지 테스트 `RecipesPage.test.tsx`

#### AC-WEB-08 · refresh가 무효면 재시도 없이 로그인으로 보낸다

- **Given** `POST /api/auth/refresh`가 401(`code: "REFRESH_TOKEN_INVALID"`)을 반환한다
- **When** `/recipes`에서 401을 받아 refresh를 시도한다
- **Then** `GET /recipes`가 재호출되지 않고 `/login?next=%2Frecipes`로 이동한다
- **검증** 페이지 테스트 `RecipesPage.test.tsx`

### 프론트 — 목록

#### AC-WEB-09 · 카드에 추출 파라미터가 표시된다

- **Given** 목록 응답에 `title: "James Hoffmann Ultimate V60"`, `doseG: 30.0`, `waterG: 500.0`, `ratio: 16.7`, `waterTempC: 100.0`, `totalTimeSeconds: 210`인 항목이 있다
- **When** `/recipes`를 연다
- **Then** `James Hoffmann Ultimate V60`, `30.0g`, `500.0g`, `1:16.7`, `100°C`, `3:30`이 모두 화면에 있다
- **검증** 페이지 테스트 `RecipesPage.test.tsx`

#### AC-WEB-10 · hasNext가 true면 더 보기 버튼이 있다

- **Given** 목록 응답이 `hasNext: true`다
- **When** `/recipes`를 연다
- **Then** 이름이 "더 보기"인 버튼이 있다
- **검증** 페이지 테스트 `RecipesPage.test.tsx`

#### AC-WEB-11 · hasNext가 false면 더 보기 버튼이 없다

- **Given** 목록 응답이 `hasNext: false`다
- **When** `/recipes`를 연다
- **Then** 이름이 "더 보기"인 버튼이 없다
- **검증** 페이지 테스트 `RecipesPage.test.tsx`

#### AC-WEB-12 · 더 보기는 다음 페이지를 뒤에 이어붙인다

- **Given** `page=0`이 20건과 `hasNext: true`를, `page=1`이 20건과 `hasNext: false`를 반환한다
- **When** `/recipes`에서 "더 보기"를 누른다
- **Then** `GET /recipes`가 `page=1`로 호출되고, 화면의 레시피 카드가 **40개**가 되며, "더 보기" 버튼이 사라진다
- **검증** 페이지 테스트 `RecipesPage.test.tsx`

#### AC-WEB-13 · 볼 레시피가 없으면 안내를 보여준다

- **Given** 목록 응답이 `content: []`, `totalElements: 0`이다
- **When** `/recipes`를 연다
- **Then** "레시피가 없습니다"가 화면에 있다
- **검증** 페이지 테스트 `RecipesPage.test.tsx`

### 프론트 — 상세

#### AC-WEB-14 · 제목과 출처와 파라미터가 표시된다

- **Given** 상세 응답이 `title: "James Hoffmann Ultimate V60"`, `authorName: "James Hoffmann"`, `doseG: 30.0`, `waterG: 500.0`, `ratio: 16.7`이다
- **When** `/recipes/1`을 연다
- **Then** 제목·`James Hoffmann`·`30.0g`·`500.0g`·`1:16.7`이 모두 화면에 있다
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

#### AC-WEB-15 · 스텝이 순서대로, 시작 시각이 m:ss로 표시된다

- **Given** 상세 응답의 스텝이 `startAtSeconds` 0, 15, 45, 75인 4개다
- **When** `/recipes/1`을 연다
- **Then** `0:00`, `0:15`, `0:45`, `1:15`가 이 순서로 화면에 나타난다
- **검증** 컴포넌트 테스트 `RecipeStepList.test.tsx`

#### AC-WEB-16 · 붓는 스텝의 누적 물량이 표시된다

- **Given** 붓는 스텝의 `waterG`가 순서대로 `60.0`, `240.0`, `200.0`이다
- **When** 스텝 목록을 렌더링한다
- **Then** 누적 물량으로 `60g`, `300g`, `500g`이 표시된다
- **검증** 컴포넌트 테스트 `RecipeStepList.test.tsx`

#### AC-WEB-17 · 붓지 않는 스텝에는 물량이 표시되지 않는다

- **Given** `stepType`이 `WAIT`이고 `waterG`가 없는 스텝이 있다
- **When** 스텝 목록을 렌더링한다
- **Then** 그 스텝 행에 `g`으로 끝나는 물량 텍스트가 없다
- **검증** 컴포넌트 테스트 `RecipeStepList.test.tsx`

#### AC-WEB-18 · 분쇄도가 없으면 그 영역이 렌더링되지 않는다

- **Given** 상세 응답의 `grinderModelId`·`grindSettingValue`·`grindSettingUnit`·`grindMicronEstimated`가 모두 없다
- **When** `/recipes/1`을 연다
- **Then** "분쇄도"라는 텍스트가 화면에 없다
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

#### AC-WEB-19 · 장비가 id가 아니라 이름으로 표시된다

- **Given** 상세 응답의 `brewerId: 2`·`filterId: 2`이고, `GET /gear/brewers`가 `{id: 2, brand: "Hario", name: "V60 02"}`를, `GET /gear/filters`가 `{id: 2, name: "V60 표백 필터 02"}`를 포함해 반환한다
- **When** `/recipes/1`을 연다
- **Then** `Hario V60 02`와 `V60 표백 필터 02`가 화면에 있다
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

#### AC-WEB-20 · CURATED 레시피에 배지가 붙는다

- **Given** 상세 응답의 `sourceType`이 `"CURATED"`다
- **When** `/recipes/1`을 연다
- **Then** `CURATED`가 화면에 있다
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

#### AC-WEB-21 · 없는 레시피를 열면 안내를 보여준다

- **Given** `GET /recipes/999`가 404(`code: "NOT_FOUND"`)를 반환한다
- **When** `/recipes/999`를 연다
- **Then** "레시피를 찾을 수 없습니다"가 화면에 있고, "다시 시도" 버튼은 없다
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

### 프론트 — 포크

#### AC-WEB-22 · 남의 레시피에는 포크 버튼이 보인다

- **Given** 로그인한 사용자의 id가 `7`이고 상세 응답의 `ownerUserId`가 없다(주인 없는 CURATED)
- **When** `/recipes/1`을 연다
- **Then** 이름이 "내 레시피로 가져오기"인 버튼이 있다
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

#### AC-WEB-23 · 내 레시피에는 포크 버튼이 없다

- **Given** 로그인한 사용자의 id가 `7`이고 상세 응답의 `ownerUserId`가 `7`이다
- **When** `/recipes/1`을 연다
- **Then** 이름이 "내 레시피로 가져오기"인 버튼이 없다
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

#### AC-WEB-24 · 포크에 성공하면 새 레시피로 이동한다

- **Given** `POST /recipes/1/fork`가 201과 `{ id: 42, ... }`를 반환한다
- **When** "내 레시피로 가져오기"를 누른다
- **Then** `/recipes/42`로 이동한다
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

> **정정 (2026-08-30):** 이 조건은 **`docs/specs/2026-08-30-web-recipe-write.md`의 `AC-WEBEDIT-06`으로 대체됐다.** 이동 대상이 `/recipes/42`(상세)에서 **`/recipes/42/edit`(편집)** 으로 바뀌었다 — 편집 기능이 생기면서 "내 것으로 가져와서 고친다"를 한 흐름으로 잇는 편이 낫다고 판단했다. 위 본문은 당시 결정의 기록으로 남기고, **테스트는 `AC-WEBEDIT-06`이라는 이름으로 새 동작을 검증한다.**

#### AC-WEB-25 · 포크에 실패하면 페이지가 유지되고 메시지가 보인다

- **Given** `POST /recipes/1/fork`가 403과 `{ code: "FORBIDDEN", message: "권한이 없습니다." }`를 반환한다
- **When** "내 레시피로 가져오기"를 누른다
- **Then** 경로가 `/recipes/1` 그대로이고, `권한이 없습니다.`가 화면에 있으며, 그 버튼이 다시 활성화된다(`disabled`가 아니다)
- **검증** 페이지 테스트 `RecipeDetailPage.test.tsx`

---

## 수동 확인

- [ ] `docker compose up -d` + `bootRun` + `pnpm dev` 상태에서 실제 카카오 계정으로 `/login` → 목록 → 상세 → 포크가 끝까지 동작한다
- [x] 브라우저 개발자도구 Network 탭에서 `GET /api/v1/recipes`에 CORS 오류가 없다
- [x] 375px 뷰포트에서 네 화면 모두 가로 스크롤이 생기지 않는다
- [x] Application 탭에서 `kaldi_refresh` 쿠키에 `HttpOnly` 체크가 켜져 있고, `localStorage`가 비어 있다

> **2026-09-05 확인.** 4개 중 **3개를 켰다.** 로컬(`bootRun` + `pnpm dev`)에 `scripts/open-as.mjs`와 같은
> 방식으로 로그인한 실제 브라우저를 375px로 띄워 밟았다. 첫 항목은 실계정이 필요해 남긴다.
>
> **✅ CORS.** `GET http://localhost:8080/api/v1/recipes?page=0&size=20` → **200**,
> `Access-Control-Allow-Origin: http://localhost:3000`. 상세(`/api/v1/recipes/9`)도 같다.
> 실패한 요청 0건. **콘솔의 401 1건은 CORS가 아니다** — 콜드 스타트에서 accessToken이 없어
> `GET /users/me`가 한 번 401을 받고, `POST /api/auth/refresh` 뒤 재시도해 200이 되는 설계된 복구
> 경로다(`401 /users/me → 200 /auth/refresh → 200 /users/me → 200 /recipes` 순서를 그대로 봤다).
>
> **✅ 375px 가로 스크롤.** 네 화면 전부 `documentElement.scrollWidth == clientWidth == 375`.
> `/login`·`/auth/callback`·`/recipes`·`/recipes/9`를 각각 캡처해 눈으로도 확인했다.
>
> **✅ 쿠키·스토리지.** `POST /api/auth/refresh`가 실제로 내려준 헤더는
> `kaldi_refresh=…; Path=/; Max-Age=1209600; HttpOnly; SameSite=lax`이고, 같은 화면에서
> `localStorage`·`sessionStorage` 모두 `{}`였다.
>
> **참고.** 개발 모드에서는 Next.js 개발 오버레이(좌하단 「N」 배지)가 탭바의 `홈`에 겹쳐 보인다.
> 앱 요소가 아니라 `pnpm dev` 전용이므로 결함이 아니다 — 캡처를 볼 때 헷갈리지 않도록 적어 둔다.

## 열어둔 결정

- **Vercel 배포와 `kaldi-note.today` DNS.** 다음 슬라이스에서 정한다. 그때 카카오 콘솔의 Redirect URI에 운영 주소를 등록하고, 백엔드 CORS 허용 출처에 운영 도메인을 추가해야 한다.
- **PWA 캐시 전략.** 레시피 상세를 오프라인 대상으로 삼는다는 방향만 있고 구체안은 없다. 화면이 더 생긴 뒤 정한다.
- **`GET /users/me` 호출 시점.** 포크 버튼 노출 판정에 내 `userId`가 필요하다. 로그인 응답의 `userId`를 그대로 쓸지, 매번 `/users/me`를 부를지는 계획 단계에서 정한다 — 둘 다 AC-WEB-22·23을 만족한다.

---
id: WEBDEPLOY
title: 프론트엔드 배포 — Cloudflare Workers
status: 구현완료
plan: docs/plans/2026-08-21-plan-web-deploy.md
---

# 프론트엔드 배포 — Cloudflare Workers 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

`main`에 `frontend/**`가 바뀐 채로 푸시되면, GitHub Actions가 기존 검사(타입·린트·테스트·빌드)를 통과한 뒤 OpenNext로 Next.js 앱을 Worker 번들로 빌드해 `wrangler deploy`로 Cloudflare Workers에 올린다. 배포 직후 `https://kaldi-note.today/login`을 폴링해 응답을 확인하고, 실패하면 워크플로를 실패로 끝낸다. 운영 백엔드의 CORS 허용 출처와 카카오 Redirect URI를 운영 도메인으로 바꿔, 폰 브라우저에서 실제로 로그인하고 레시피를 볼 수 있게 만든다.

### 범위 밖 (Non-goals)

- **PR 프리뷰 배포.** 모든 화면이 로그인을 요구하는데(`/`는 `/recipes`로 리다이렉트되고 `/recipes`·상세는 `useRequireSession`이 막는다), 프리뷰 URL은 배포마다 해시가 달라 카카오 콘솔에 Redirect URI로 등록할 수 없다. 등록 못 하면 프리뷰에서 로그인이 불가능하고, 로그인이 안 되면 볼 수 있는 화면이 로그인 버튼 하나뿐이라 프리뷰의 값이 없다. 검증은 지금처럼 `pnpm dev` + `bootRun` 로컬로 한다.
- **`api.kaldi-note.today`를 Cloudflare 프록시(WAF) 뒤로 옮기는 것.** 별도 스펙에서 다룬다. 프론트 배포와 실패 양상이 전혀 달라 — WAF 규칙이 과하면 앱 전체가 죽는다 — 한 덩어리로 묶으면 장애가 났을 때 원인이 프론트인지 WAF인지 구분되지 않는다. 프론트가 살아 있는 기준선을 먼저 만든다.
- **PWA**(`manifest.json`·Service Worker·오프라인 캐시). `2026-08-21-web-recipe-read.md`에서 "화면 구조가 자리잡기 전에 캐시 전략을 정하면 두 번 고치게 된다"는 이유로 미뤘고, 화면은 아직 3개뿐이라 그 이유가 그대로 유효하다.
- **Playwright E2E를 운영 URL에 돌리는 것.** 카카오 실계정 로그인을 자동화해야 해서 분량이 크고, 지금 저장소에 Playwright 설정 자체가 없다.
- **`www` 서브도메인.** apex 하나만 서비스한다.
- **구글 로그인.** 카카오만 붙인다.
- **레시피 생성·편집·삭제 화면.** 이 스펙은 기능을 추가하지 않는다. 이미 있는 화면을 인터넷에 올릴 뿐이다.

## 왜

첫 프론트 슬라이스는 완성됐지만 **로컬에서만 돈다.** `architecture.md`의 핵심 시나리오 마지막 단계("여자친구 계정으로 로그인해 FRIENDS 레시피 조회")는 두 사람이 각자의 폰에서 접속해야 확인되는데, 지금은 개발 머신에서 `pnpm dev`를 띄운 사람만 앱을 볼 수 있다.

그리고 이 서비스의 주 사용 환경은 **부엌에서 폰으로**다(`frontend/CLAUDE.md`). 추출하면서 레시피를 보는 것이 목적인데, 노트북을 부엌에 가져가 개발 서버를 띄우는 것으로는 그 사용을 흉내조차 낼 수 없다. 배포되기 전까지 이 앱은 실제로 쓰인 적이 한 번도 없는 상태다.

## 용어

| 용어 | 정의 |
|---|---|
| OpenNext | Next.js 앱을 Vercel 외 플랫폼용 번들로 변환하는 어댑터. `@opennextjs/cloudflare`는 Cloudflare **Workers**를 대상으로 한다(Pages가 아니다) |
| workerd | Cloudflare Workers를 실행하는 런타임. Node.js와 다른 런타임이며, `wrangler`가 로컬에서 이것을 띄운다 |
| 스모크 체크 | 배포 직후 운영 URL을 폴링해 응답이 정상인지 확인하는 절차 |
| apex 도메인 | 서브도메인이 없는 루트 도메인. 여기서는 `kaldi-note.today` |

## 데이터

스키마 변경 없음.

## API

새 API 없음. 이 스펙은 기존 앱의 실행 위치만 바꾼다.

---

## 어떻게 동작 — 인수 조건

> 각 조건은 리터럴 값을 쓴다. ID는 한 번 부여하면 바꾸지 않는다.

**AC의 검증 방식에 관하여.** 지금 프론트 테스트 59개는 전부 Node 환경(vitest + jsdom)에서 돈다. 배포되는 곳은 workerd다. 둘은 다른 런타임이고, 특히 BFF Route Handler 3개가 workerd에서 쿠키를 심는지는 현재 아무 테스트도 검증하지 않는다. 이 프로젝트는 이미 같은 부류의 실패를 겪었다 — "테스트 54개가 초록인데 화면이 안 열린 적이 있다"(`CLAUDE.md`). 그래서 아래 AC는 **빌드 산출물을 로컬 workerd에 띄운 뒤** 검증한다.

빌드가 실패하면 AC-WEBDEPLOY-02~06은 실행 자체가 불가능하므로, AC-WEBDEPLOY-01이 명시적 실패 지점 역할을 한다.

### 정상 동작

#### AC-WEBDEPLOY-01 · OpenNext 빌드가 Worker 번들을 산출한다

- **Given** `frontend/` 디렉터리와 환경변수 `NEXT_PUBLIC_API_BASE_URL=https://api.kaldi-note.today`, `NEXT_PUBLIC_KAKAO_REDIRECT_URI=https://kaldi-note.today/auth/callback`, `NEXT_PUBLIC_KAKAO_CLIENT_ID=<임의의 비어있지 않은 값>`
- **When** OpenNext 빌드 명령을 실행한다
- **Then** 프로세스가 종료 코드 `0`으로 끝나고, Worker 진입점 번들 파일이 생성되어 있다
- **검증** 통합 테스트 `WorkerBuildTest`

#### AC-WEBDEPLOY-02 · workerd에서 `/login`이 200을 반환한다

- **Given** AC-WEBDEPLOY-01로 만든 번들을 로컬 workerd에 띄운 상태
- **When** `GET /login`을 요청한다
- **Then** HTTP `200`을 반환한다
- **검증** 통합 테스트 `WorkerSmokeTest`

#### AC-WEBDEPLOY-03 · `/login` 응답에 운영 redirect_uri가 담긴 카카오 인가 URL이 있다

- **Given** AC-WEBDEPLOY-02와 같은 상태
- **When** `GET /login`의 응답 본문을 읽는다
- **Then** 본문에 `https://kauth.kakao.com/oauth/authorize`로 시작하고 쿼리에 `redirect_uri=https%3A%2F%2Fkaldi-note.today%2Fauth%2Fcallback`을 포함한 URL이 존재한다
- **검증** 통합 테스트 `WorkerSmokeTest`

> `/login`은 서버 컴포넌트라 `kakaoAuthorizeUrl()`이 서버에서 실행되고 결과가 `<a href>`에 그대로 박힌다(`frontend/src/app/login/page.tsx:27`). 그래서 응답 HTML만으로 검증할 수 있다. 이 값이 틀리면 카카오가 인가코드 교환을 거부한다(`frontend/src/features/auth/kakao.ts:6`).

#### AC-WEBDEPLOY-04 · workerd에서 BFF 로그인 라우트가 httpOnly 쿠키를 심는다

- **Given** AC-WEBDEPLOY-02와 같은 상태, 백엔드 로그인 응답을 대신하는 스텁
- **When** `POST /api/auth/login`에 유효한 `code`를 담아 요청한다
- **Then** 응답의 `Set-Cookie` 헤더에 `kaldi_refresh` 쿠키가 있고 `HttpOnly` 속성이 붙어 있다
- **검증** 통합 테스트 `WorkerSmokeTest`

#### AC-WEBDEPLOY-05 · 운영 빌드에서 그 쿠키에 Secure가 붙는다

- **Given** AC-WEBDEPLOY-04와 같은 상태이되 `NODE_ENV=production`으로 빌드된 번들
- **When** `POST /api/auth/login`에 유효한 `code`를 담아 요청한다
- **Then** `kaldi_refresh` 쿠키에 `Secure` 속성이 붙어 있다
- **검증** 통합 테스트 `WorkerSmokeTest`

> `refreshCookieOptions.secure`가 `process.env.NODE_ENV === "production"`으로 결정된다(`frontend/src/features/auth/cookie.ts:18`). OpenNext 빌드가 이 값을 어떻게 다루는지는 확인된 바 없다. 빠지면 HTTPS 사이트에서 refresh token이 평문 채널로도 전송될 수 있다.

#### AC-WEBDEPLOY-06 · 루트가 앱 화면을 반환한다

- **Given** AC-WEBDEPLOY-02와 같은 상태
- **When** 리다이렉트를 자동으로 따라가지 않는 설정으로 `GET /`를 요청한다
- **Then** `200`과 `Content-Type: text/html`을 반환한다
- **검증** 통합 테스트 `WorkerSmokeTest`

> **2026-09-01에 고쳤다(사람 승인).** 원래 문구는 "3xx와 `Location: /recipes`"였다. 홈이 비어 있어 목록으로 넘기던 시절의 조건인데, 브루잉 로그 슬라이스가 홈을 **최근 기록 3개** 화면으로 채우면서(`docs/specs/2026-08-31-web-brew-log.md`의 `AC-WEBBREW-37~39`) 두 AC가 양립할 수 없게 됐다.
>
> 이 AC의 의도는 "리다이렉트가 도는가"가 아니라 **"워커에 올라간 앱이 루트에서 실제로 응답하는가"** 였다. 그 의도는 그대로 두고 조건만 현재 홈에 맞췄다. 홈이 무엇을 보여주는지는 브루로그 스펙이 정한다.

### 경계값

해당 없음 — 이 스펙에 수치 범위의 안/밖을 가르는 조건이 없다. 스모크 체크의 폴링 값(5초 × 6회)은 배포 워크플로의 설정값이지 AC 경계가 아니다.

### 에러

해당 없음 — 이 스펙은 새 HTTP API를 추가하지 않는다. 백엔드에 도달하지 못하는 상황은 기존 `CLIENT_ERROR` 경로가 이미 처리하며(`frontend/src/lib/api-client.ts:38`), 그 동작은 `2026-08-21-web-recipe-read.md`의 AC가 이미 덮는다. 배포 실패는 아래 워크플로 동작으로 다룬다.

---

## 배포 워크플로 동작

AC로 옮길 수 없는(실제 Cloudflare 계정과 운영 도메인이 있어야만 검증되는) 동작이지만, 구현이 따라야 할 확정 사항이므로 여기 명시한다.

- **트리거** — `main` 푸시 + `frontend/**` 또는 `.github/workflows/frontend.yml` 변경. `frontend.yml`의 기존 `paths` 필터를 그대로 쓴다
- **선행 조건** — 기존 `check` job(타입·린트·테스트·빌드)이 전부 통과해야 `deploy` job이 시작된다
- **실행** — OpenNext 빌드 후 `wrangler deploy`
- **스모크 체크** — 배포 후 `https://kaldi-note.today/login`을 **5초 간격으로 최대 6회(총 30초)** 요청해 HTTP `200`을 기다린다. 30초 안에 200을 받지 못하면 워크플로를 실패로 끝낸다
- **롤백** — 하지 않는다. 실패 시 사람이 Cloudflare 대시보드에서 이전 버전으로 되돌린다

> 백엔드는 헬스체크를 60초 기다리지만(`2026-08-18-oci-deploy.md`) 여기서 30초인 이유는, 그 60초가 Spring 애플리케이션 부팅 시간(20~30초)을 감안한 값이기 때문이다. Workers에는 그에 해당하는 부팅 과정이 없다. 같은 숫자를 베끼면 근거 없이 실패를 늦게 알게 된다.

### 환경변수

프론트 빌드 시점 값(`NEXT_PUBLIC_*`는 런타임 시크릿이 아니라 **빌드 타임에 번들에 박힌다**. `wrangler secret`으로는 주입할 수 없다):

| 키 | 값 | 어디에 |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.kaldi-note.today` | 워크플로에 리터럴 |
| `NEXT_PUBLIC_KAKAO_REDIRECT_URI` | `https://kaldi-note.today/auth/callback` | 워크플로에 리터럴 |
| `NEXT_PUBLIC_KAKAO_CLIENT_ID` | 카카오 REST API 키 | GitHub Secret |

앞의 둘은 어차피 브라우저 번들에 노출되는 공개값이라 리터럴로 둔다 — 무엇이 배포되는지 diff에 보이는 편이 낫다. 카카오 키도 공개값이지만(client secret은 백엔드가 갖는다) 저장소에 남기지 않는다.

`wrangler deploy`에는 Cloudflare API 토큰이 GitHub Secret으로 필요하다.

### 운영 백엔드 변경

VM `.env`의 두 값을 바꾸고 백엔드를 재기동해야 한다. **둘 다 사람이 SSH로 한다** — 에이전트에게는 VM 키가 없다.

| 키 | 바꿀 값 | 이유 |
|---|---|---|
| `KALDI_CORS_ALLOWED_ORIGINS` | `https://kaldi-note.today` | 브라우저가 백엔드를 직접 호출한다(BFF는 auth 3개뿐). **`http://localhost:3000`은 뺀다** — 운영 API가 아무 로컬 페이지의 요청을 받아줄 이유가 없다. 로컬 개발은 로컬 백엔드를 띄워서 한다 |
| `KAKAO_REDIRECT_URI` | `https://kaldi-note.today/auth/callback` | 카카오 콘솔·프론트·백엔드 셋이 문자 하나까지 같아야 인가코드 교환이 된다 |

---

## 수동 확인

실제 Cloudflare 계정·도메인·카카오 콘솔·VM SSH가 있어야만 가능한 것들이다. 에이전트는 이 중 어느 것에도 접근 권한이 없으므로 사람이 수행하고 결과를 알려준다.

- [x] Cloudflare에 Worker를 만들고 `kaldi-note.today`를 커스텀 도메인으로 연결한다. apex 레코드가 생성된다(현재 `dig A kaldi-note.today`는 빈 응답이다)
- [x] 카카오 개발자 콘솔에 `https://kaldi-note.today/auth/callback`을 Redirect URI로 **추가** 등록한다. `http://localhost:3000/auth/callback`은 남겨둔다 — 지우면 로컬 개발이 깨진다
- [x] GitHub Secret에 Cloudflare API 토큰과 `NEXT_PUBLIC_KAKAO_CLIENT_ID`를 등록한다
- [x] VM `.env`의 `KALDI_CORS_ALLOWED_ORIGINS`·`KAKAO_REDIRECT_URI`를 바꾸고 백엔드를 재기동한다
- [x] `main` 머지 후 `frontend.yml`의 `deploy` job이 실제로 돌고 스모크 체크가 통과한다
- [x] `https://kaldi-note.today`가 유효한 HTTPS 인증서로 응답한다
- [x] **폰 브라우저에서** 카카오 실계정으로 로그인 → 레시피 목록 → 상세 → 포크가 동작한다. 데스크톱에서만 확인하지 않는다
  - **2026-08-29 로그인·목록 확인 → 2026-08-30 상세·포크까지 확인 완료.** 로그인이 된다는 것은 카카오 콘솔 등록·redirect_uri 3자 일치·CORS·세션 쿠키가 모두 실제로 작동한다는 뜻이다
- [x] 로그인 후 개발자 도구에서 `kaldi_refresh` 쿠키에 `HttpOnly`와 `Secure`가 둘 다 붙어 있다
- [x] 백엔드 배포·롤백이 여전히 정상이다 — `ssh -i ~/.ssh/kaldi-note-deploy ubuntu@158.179.172.168 'bash -s' < infra/scripts/verify-rollback.sh`
- [x] 배포 후에도 로컬 개발(`pnpm dev` + `bootRun`)이 그대로 동작한다. 카카오 콘솔에서 localhost URI를 지우지 않았는지 확인하는 것과 같다

## 열어둔 결정

인터뷰 시점에 열려 있던 항목은 구현 계획(`docs/plans/2026-08-21-plan-web-deploy.md`)에서 전부 정해졌다. 결과만 남긴다.

- **Worker 이름은 `kaldi-note-web`, 설정은 `frontend/wrangler.jsonc`** — 사람이 Cloudflare에서 Worker를 만들 때 이 이름을 그대로 써야 한다. `services` 자기참조 바인딩이 같은 이름을 가리키기 때문이다
- **`compatibility_flags`는 `nodejs_compat`·`global_fetch_strictly_public`, `compatibility_date`는 `2024-12-30`** — OpenNext 문서가 요구하는 최소 조건
- **테스트에서 workerd는 `wrangler dev --local`을 자식 프로세스로 띄운다** — 프로그래매틱 API보다 버전 변화에 덜 민감하다
- **빌드 스크립트는 `pnpm build:worker`**, 배포는 `pnpm deploy:worker`, 워커 테스트는 `pnpm test:worker`
- **문서 3곳의 "Vercel" 표기 정정**은 계획의 Task 4다. `oci-deploy` 스펙과 `JOURNAL.md`의 과거 서술은 고치지 않는다 — 그때의 판단을 사후에 바꾸면 방향이 왜 바뀌었는지 추적할 수 없다
- **Workers 무료 플랜은 10만 요청/일, 호출당 CPU 10ms, 정적 자산 요청은 무료·무제한.** 요청 수는 사용자가 한 자릿수라 여유가 크다. **CPU 10ms는 SSR 페이지에서 실제로 닿을 수 있는 제약이므로** 배포 후 Cloudflare 대시보드에서 실측한다

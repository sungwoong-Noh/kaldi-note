# kaldi note — Frontend

Next.js PWA. **주 사용 환경은 "부엌에서 폰으로"** 다. 데스크톱은 부차적이며, 모든 화면은 모바일 우선으로 설계한다.

**작업 전 필독:** 루트 `../CLAUDE.md` → **`../docs/conventions/workflow.md`**(스펙 → 계획 → 코드) → 이 문서 → `../docs/conventions/frontend.md`

> **세션은 `/resume`으로 시작하고 `/handover`로 끝낸다.** 상세는 `../docs/conventions/handover.md`.
>
> **스펙 없이 코드를 쓰지 않는다.** 기능 개발은 `docs/specs/`의 스펙과 `docs/plans/`의 계획이 승인된 뒤에 시작한다. 테스트에는 인수 조건 ID를 `it('AC-GRIND-08 · ...')` 형태로 반드시 남긴다.

> **현재 상태: 읽기·쓰기 슬라이스 구현 완료, 인터넷에 떠 있다.** 로그인·목록·상세·포크(`../docs/specs/2026-08-21-web-recipe-read.md`)에 더해 **레시피 생성·편집·삭제와 푸어 스텝 에디터**가 동작한다(`../docs/specs/2026-08-30-web-recipe-write.md`).
>
> **`kaldi-note.today`에 배포돼 있다**(2026-08-29). Cloudflare Workers + OpenNext이고 `main`에 머지되면 GitHub Actions가 자동 배포한다(`../docs/specs/2026-08-21-web-deploy.md`). 백엔드는 `api.kaldi-note.today`(OCI VM)로 별개 인프라다.
>
> **운영 백엔드는 `localhost:3000` 출처를 403으로 막는다.** 로컬 프론트를 운영 API에 붙일 수 없으니, 로컬 개발은 `docker compose up -d` + `bootRun`으로 로컬 백엔드를 띄워서 한다.
>
> **Next 16이 설치돼 있다.** 생성된 `AGENTS.md`가 "APIs, conventions, and file structure may all differ from your training data"라고 경고한다. **코드를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 문서를 확인한다.** 실제로 다른 것들: `params`·`searchParams`는 Promise이고, `LayoutProps`·`PageProps` 같은 타입은 빌드가 생성한다(그래서 `typecheck` 스크립트가 `next typegen`을 먼저 돌린다).
>
> `pnpm`이 없으면 `corepack enable pnpm`으로 활성화한다.

---

## 기술 스택

| 항목          | 선택                             | 이유                                                                            |
| ------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| 프레임워크    | **Next.js (App Router)**         |                                                                                 |
| 언어          | **TypeScript (strict)**          | `any` 금지                                                                      |
| 패키지 매니저 | **pnpm**                         |                                                                                 |
| 스타일        | **Tailwind CSS** + **shadcn/ui** | shadcn은 라이브러리가 아니라 소스 복사 방식 — 컴포넌트를 직접 소유하고 수정한다 |
| 서버 상태     | **TanStack Query**               | 캐싱·재검증·낙관적 업데이트                                                     |
| 폼            | **`useState`** + **Zod**(응답 스키마) | 폼 라이브러리를 쓰지 않는다 — 아래 참조                                    |
| 테스트        | **Vitest** + **Testing Library** |                                                                                 |
| E2E           | **Playwright**                   | 로그인 → 레시피 포크 → 로그 작성 흐름                                           |
| 린트/포맷     | **ESLint** + **Prettier**        |                                                                                 |
| 배포          | **Cloudflare Workers** (무료)    | OpenNext 어댑터로 빌드한다. 백엔드는 OCI에 따로 있다                            |

### 폼 라이브러리를 쓰지 않는 이유

원래 이 표에는 React Hook Form이 적혀 있었으나 **설치된 적이 없었고**, 2026-08-30 레시피 쓰기 슬라이스에서 `useState`로 확정했다.

- **폼의 본체가 배열 변환이다.** 푸어 스텝의 밀기·당기기(`features/recipe/stepSequence.ts`)는 배열 → 배열 순수 함수다. `useFieldArray` 위에 그 변환을 얹으면 상태가 두 군데 생긴다.
- **검증은 서버가 한다.** 물량 합계·시간 겹침·타입 모순은 백엔드가 400으로 거부하고, 화면은 `fieldErrors`를 각 입력칸에 붙이기만 한다(`lib/fieldErrors.ts`). 클라이언트 검증 기능을 쓸 일이 거의 없다.
- Zod는 **응답 스키마**로 계속 쓴다. 요청 본문은 `features/recipe/formState.ts`가 만든다.

### PWA인 이유

부엌에서 젖은 손으로 폰을 쓴다. 앱스토어 심사 없이 홈화면에 설치되고, 네트워크가 끊겨도 저장된 레시피는 보여야 한다.

- `manifest.json` + Service Worker
- **레시피 상세는 오프라인 캐시 대상.** 추출 중에 네트워크가 끊겨도 스텝을 볼 수 있어야 한다.
- 브루잉 로그 작성은 온라인 필수(사진 업로드 때문). 오프라인 큐잉은 하지 않는다 — YAGNI.

---

## 프로젝트 구조

App Router의 `app/`은 **라우팅만** 담당한다. 실제 로직과 컴포넌트는 `features/`에 도메인별로 둔다.

```
frontend/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── public/
│   ├── manifest.json                 PWA 매니페스트
│   └── icons/                        홈화면 아이콘
└── src/
    ├── app/                          ── 라우팅 전용. 얇게 유지한다
    │   ├── layout.tsx                루트 레이아웃, Provider 조립
    │   ├── page.tsx                  홈 (최근 브루잉 로그)
    │   ├── login/page.tsx
    │   ├── auth/callback/page.tsx    OAuth 인가코드 수신
    │   ├── recipes/
    │   │   ├── page.tsx              레시피 목록
    │   │   ├── [id]/page.tsx         레시피 상세 (오프라인 캐시 대상)
    │   │   ├── [id]/edit/page.tsx
    │   │   └── new/page.tsx
    │   ├── brews/                    브루잉 로그
    │   ├── beans/                    원두 재고
    │   ├── gear/                     내 장비
    │   └── api/                      필요 시에만. 기본은 백엔드 직접 호출
    │
    ├── features/                     ── ★ 도메인별 코드가 사는 곳
    │   ├── auth/
    │   │   ├── api.ts                API 호출 함수
    │   │   ├── queries.ts            TanStack Query 훅
    │   │   ├── schema.ts             Zod 스키마 + 추론 타입
    │   │   └── components/
    │   ├── recipe/
    │   │   ├── api.ts, queries.ts, schema.ts
    │   │   └── components/
    │   │       ├── RecipeStepList.tsx      푸어 스텝 시퀀스 표시
    │   │       ├── RecipeStepEditor.tsx    스텝 추가/삭제/순서 변경
    │   │       └── ForkButton.tsx
    │   ├── brewlog/
    │   │   └── components/ScaChart.tsx     SCA Brewing Control Chart
    │   ├── bean/
    │   └── gear/
    │       └── components/GrindConverter.tsx   ★ 환산값은 "추정치" 표기 필수
    │
    ├── components/                   ── 도메인 무관 공용 UI
    │   ├── ui/                       shadcn/ui 컴포넌트 (생성물, 직접 수정 가능)
    │   └── layout/                   Header, BottomNav 등
    │
    ├── lib/
    │   ├── api-client.ts             fetch 래퍼. 인증 헤더·에러 변환·토큰 갱신
    │   ├── query-client.ts           TanStack Query 설정
    │   └── utils.ts                  cn() 등
    │
    └── types/                        전역 타입 (API 공통 응답 등)
```

### 배치 규칙

- **`app/`의 페이지는 조립만 한다.** 데이터 페칭 훅을 부르고 `features/`의 컴포넌트를 배치하는 정도. 페이지 파일이 100줄을 넘으면 `features/`로 옮길 것이 있다는 신호다.
- **한 곳에서만 쓰는 컴포넌트는 그 feature 안에 둔다.** 두 번째 feature가 쓰기 시작할 때 `components/`로 승격한다. 미리 올리지 않는다.
- **`features/` 끼리는 서로 import 하지 않는다.** 공유가 필요하면 `components/`나 `lib/`로 올린다.

---

## 명령어

```bash
pnpm install                # 의존성 설치

pnpm dev                    # 개발 서버 → http://localhost:3000
pnpm build                  # 프로덕션 빌드 (타입 오류를 여기서 잡는다)
pnpm start                  # 빌드 결과 실행

pnpm test                   # Vitest 1회 실행
pnpm test:watch             # 워치 모드
pnpm test -- RecipeStepList # 특정 테스트

pnpm lint                   # ESLint
pnpm lint:fix               # 자동 수정
pnpm format                 # Prettier 적용
pnpm typecheck              # tsc --noEmit

pnpm e2e                    # Playwright (백엔드가 떠 있어야 함)
pnpm e2e:ui                 # Playwright UI 모드
```

### 검증 (작업 완료 시 반드시 실행)

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm test:worker                              # workerd에서 실제로 도는지
(cd .. && ./scripts/check-spec-coverage.sh)   # 인수 조건이 테스트에 있는지
```

이 전부가 통과해야 "완료"라고 말할 수 있다. **`pnpm build`를 빠뜨리지 않는다** — 개발 서버에서는 통과하는데 빌드에서 깨지는 경우가 흔하다.

**`pnpm test:worker`도 빠뜨리지 않는다.** 위 `pnpm test`의 테스트들은 Node + jsdom에서 돈다. 배포 대상은 workerd이고 둘은 다른 런타임이다. 이 스위트는 OpenNext 빌드 산출물을 실제 workerd에 띄워 HTTP로 검사하므로 느리지만(~14초), **"노드에선 되는데 Workers에선 안 되는" 부류를 잡는 유일한 장치**다.

### 배포 관련 명령어

```bash
pnpm build:worker      # OpenNext로 Worker 번들 생성 → .open-next/
pnpm preview:worker    # 번들을 로컬 workerd에 띄워 눈으로 확인
pnpm deploy:worker     # Cloudflare에 배포 (빌드하지 않는다 — build:worker가 선행돼야 한다)
```

`deploy:worker`는 **이미 빌드된** 앱을 올릴 뿐이다. 그리고 `NEXT_PUBLIC_*`는 런타임이 아니라 **빌드 타임에 번들에 박히므로** `build:worker` 단계에 줘야 한다. 배포 단계에 걸면 아무 효과가 없다.

### 백엔드 연동

```bash
# 백엔드를 로컬에서 함께 띄운다
cd .. && docker compose up -d && cd backend && ./gradlew bootRun
```

`.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_KAKAO_CLIENT_ID=<카카오 REST API 키>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<구글 클라이언트 ID>
```

`.env.local`은 커밋하지 않는다. `.env.example`에 키 이름만 남긴다.

---

## 인증 흐름

백엔드는 순수 API 서버다. 프론트가 OAuth 인가코드를 받아 백엔드에 넘기는 방식이다.

1. 사용자가 "카카오로 로그인" 클릭 → 카카오 인가 페이지로 리다이렉트
2. 카카오가 `/auth/callback?code=...`로 되돌려보냄
3. 프론트가 `POST /api/v1/auth/login/kakao { code }` 호출
4. 백엔드가 토큰 교환·사용자 조회·가입 처리 후 **자체 JWT(access + refresh)** 반환
5. access token은 메모리, refresh token은 `httpOnly` 쿠키에 저장
6. `lib/api-client.ts`가 401을 받으면 refresh로 자동 재발급 후 원 요청 재시도

**access token을 `localStorage`에 넣지 않는다.** XSS로 탈취된다.

---

## UI에서 지켜야 할 도메인 규칙

코드 리뷰에서 가장 자주 지적될 것들이다. 설계 결정과 직결된다.

1. **분쇄도 환산값 옆에는 항상 "추정치" 배지와 경고 문구를 표시한다.** 정확한 등가 변환은 물리적으로 불가능하다. 확정값처럼 보이면 사용자가 잘못된 신뢰를 갖는다.
2. **TDS 입력은 선택 항목이다.** 리프랙토미터가 없는 게 기본이다. 비워두면 추출 수율·SCA 차트 영역을 숨기고, 브루 비율과 관능 평가만 보여준다. 입력을 강제하지 않는다.
3. **레시피 화면과 브루잉 로그 화면은 명확히 구분되어야 한다.** 레시피는 "이렇게 내릴 것"(설계도), 로그는 "이렇게 내렸다"(기록)다. 사용자가 헷갈리면 UI가 잘못된 것이다.
4. **포크 시 원본 대비 변경점(diff)을 보여준다.** "물 온도를 92°C → 94°C로 바꿈" 같은 표시가 공유의 재미다.
5. **푸어 스텝은 순서 변경·삽입·삭제가 가능해야 한다.** 단순 텍스트 입력으로 대체하지 않는다.
6. 로스팅일로부터의 경과일(days off roast)은 **계산해서 표시**한다. 사용자가 직접 입력하게 하지 않는다.

---

## 자주 하는 실수

- `app/` 페이지에 로직을 몰아넣는 것 → `features/`로 옮긴다.
- `'use client'`를 파일 최상단에 습관적으로 붙이는 것 → 필요한 최말단 컴포넌트에만 붙인다.
- TanStack Query 없이 `useEffect` + `fetch`로 데이터를 가져오는 것 → 캐싱·중복 요청 제어를 잃는다.
- 서버 응답 타입을 손으로 적는 것 → Zod 스키마에서 `z.infer`로 추론한다.
- `pnpm dev`만 확인하고 완료 처리 → 반드시 `pnpm build`까지 돌린다.
- 데스크톱 브라우저에서만 확인하는 것 → 모바일 뷰포트(375px)에서 확인한다.

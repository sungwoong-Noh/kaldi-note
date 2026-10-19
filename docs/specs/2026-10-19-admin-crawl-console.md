---
id: ADMIN
title: 관리자 콘솔 — 공통 틀 + 원두 수집 화면
status: 초안
milestone:
supersedes:
---

# 관리자 콘솔 — 원두 수집 스펙

> 작성 규칙은 [`docs/specs/README.md`](README.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 시나리오

ADMIN 권한을 가진 사람이 데스크톱 브라우저에서 `/admin/crawl`을 열어 구매처(모모스·언스페셜티)별
「수집」을 누르고, 실행이 끝날 때까지 상태를 지켜본 뒤, 실행 상세에서 **건너뛴 상품과 매핑하지 못한
원문**을 읽는다. 수집은 검수 없이 카탈로그에 바로 반영되므로 이 화면이 사실상의 검수다.

화면은 이미 있는 API(`docs/contracts/2026-10-14-bean-crawler.json`)에만 붙는다. 서버 변경은 크롤러
스펙의 AC-CRAWL-37·38(수집 0건이면 FAILED) 하나뿐이다.

디자인 입력: `docs/design/design_handoff_admin_console/` (`README.md`, `design/Admin.dc.html`).
요청문: `docs/design/2026-10-14-admin-design-request.md`.

### 범위 밖 (Non-goals)

- 장비 · 그라인더 영점 · 회원 화면 — API가 없다. 좌측 메뉴에도 넣지 않는다(화면을 만들 때 추가)
- 매핑하지 못한 원문을 화면에서 바로 매핑(규칙 추가) — 읽기 전용 (목업 질문 5)
- 실행 취소, 주기 실행 설정
- 1280px 미만에서 표 열 합치기·숨기기 (목업 「1280px 미만 동작」 표의 열 관련 행) — 패널 오버레이와 960 미만 안내만 한다
- 모바일 화면 — 960px 미만은 안내 문구만
- 새 색 토큰 — 목업의 `--a-*`는 앱 전역 토큰과 값이 같다. 전역 토큰을 쓴다

## 용어

| 용어 | 정의 |
|---|---|
| 구매처 | `GET /admin/crawl-sources`의 한 항목 (`key`, `name`, `listUrl`, `lastRun?`) |
| 실행 | `crawl_runs` 한 행 (`CrawlRun`) |
| 소요 | `finishedAt − startedAt`, `mm:ss`. RUNNING이면 「경과」 = 지금 − `startedAt` |
| 시각 표기 | 브라우저 로컬 시간 `MM.DD HH:mm` (예 `10.14 21:03`) |

## 계약

새 API 없음. 기존 계약을 그대로 쓴다.

| 메서드 | 경로 | 화면에서 |
|---|---|---|
| GET | `/api/v1/users/me` | `role`로 403 분기, 상단 바 아바타 |
| GET | `/api/v1/admin/crawl-sources` | 구매처 카드 |
| POST | `/api/v1/admin/crawl-sources/{key}/runs` | 「수집」 (202 / 409 `CRAWL_ALREADY_RUNNING`) |
| GET | `/api/v1/admin/crawl-runs?source=&page=&size=20` | 실행 이력 |
| GET | `/api/v1/admin/crawl-runs/{id}` | 실행 상세 패널 + 폴링 |

응답은 `non_null` 직렬화다 — `lastRun`·`finishedAt`·`errorMessage`는 없으면 **키가 빠진다**. 스키마는
`.optional()`로 받는다. 테스트 픽스처는 로컬 실제 응답에서 뜬다(`crawl-runs`에 momos·unspecialty 실행이 있다).

## 화면

경로·레이아웃·값은 목업 `README.md`의 수치를 따른다. 아래는 동작 규칙만.

- **경로**: `/admin` → `/admin/crawl`로 `replace`. 실행 상세는 쿼리 `?run={id}` — 있으면 패널이 열린 채로 진입,
  패널을 닫으면 쿼리를 지운다.
- **진입점**: 더보기(`/more`)에 `role=ADMIN`일 때만 「관리자」 링크(`/admin`).
- **권한**: 세션 없음 → 기존 `useRequireSession` 흐름. `role !== "ADMIN"` → 403 화면, **admin API를 부르지 않는다**.
- **상단 바**: 워드마크 + 「관리자」 + 「앱으로 돌아가기」(`/`) + 아바타. 403 화면은 「관리자」 라벨이 없다.
- **좌측 메뉴**: 그룹 `카탈로그` 아래 「원두 수집」 하나(활성).
- **폴링**: 패널의 실행이 RUNNING이면 `GET /crawl-runs/{id}`를 3000ms마다. 탭이 숨겨지면 멈춘다(react-query 기본).
  RUNNING이 아니게 되면 멈추고, `crawl-sources`와 `crawl-runs` 목록을 다시 읽는다.
- **반응형**: ≥1280 목업 그대로 / 960–1279 상세 패널을 본문 위 오버레이(오른쪽 고정, 스크림) / <960 안내만.

---

## 인수 조건

### 기능

#### AC-ADMIN-01 · 구매처 카드

- **Given** `crawl-sources` = momos(`lastRun` 있음, SUCCEEDED, `startedAt` 21:03:00, `finishedAt` 21:03:41) · unspecialty(`lastRun` 키 없음)
- **When** ADMIN이 `/admin/crawl`을 연다
- **Then** 행 2개. momos 행에 `모모스커피`, `momos`, 목록 URL, 상태 `SUCCEEDED`, `00:41`, 활성 「수집」 버튼. unspecialty 행의 상태는 `—`
- **검증** 컴포넌트 테스트 `app/admin/crawl/page.test.tsx`

#### AC-ADMIN-02 · 「수집」 → 실행 시작 + 패널

- **Given** momos `lastRun` 없음, `POST …/momos/runs` → 202 `{id: 130, status: "RUNNING"}`
- **When** momos 「수집」 클릭
- **Then** POST 1회, URL 쿼리가 `?run=130`, 패널에 `Run #130 · momos`, `● RUNNING`, 히어로 `진행 중`, `갱신 — · 건너뜀 — · 미매핑 —`,
  문장 「수집 중입니다. 3초마다 상태를 다시 읽습니다. 생성·갱신 집계와 목록은 실행이 끝나면 표시됩니다.」
- **검증** 컴포넌트 테스트

#### AC-ADMIN-03 · 실행 중인 구매처는 버튼이 막힌다

- **Given** momos `lastRun.status = RUNNING`
- **Then** momos 행의 버튼이 비활성 「수집 중」, unspecialty 버튼은 활성
- **검증** 컴포넌트 테스트

#### AC-ADMIN-04 · 폴링이 끝나면 멈추고 목록을 다시 읽는다

- **Given** `GET /crawl-runs/130` 첫 응답 RUNNING, 두 번째 응답 SUCCEEDED(`created` 3)
- **When** 패널이 열린 채 3000ms가 지난다
- **Then** 두 번째 GET이 일어나고 히어로가 `생성 3`. 이후 6000ms 동안 `/crawl-runs/130` GET은 더 없다. `crawl-sources` GET이 1회 더 일어난다
- **검증** 컴포넌트 테스트 (fake timers)

#### AC-ADMIN-05 · 실행 이력 표

- **Given** `crawl-runs` 응답 2건(최신순): #131 unspecialty SUCCEEDED created 0 updated 72 skipped 0 unmapped 41 / #130 momos RUNNING
- **Then** 제목 옆 `2건 · 최신순`. #131 행: `언스페셜티 몰`, `SUCCEEDED`, 생성 `0`, 갱신 `72`, 건너뜀 `0`, 미매핑 `41`(굵게). #130 행의 집계 네 칸은 `—`
- **검증** 컴포넌트 테스트
- 소스 이름은 `crawl-sources`의 `name`으로 찾는다. 못 찾으면 `key`를 그대로 쓴다.

#### AC-ADMIN-06 · 구매처 필터

- **When** pill 「모모스커피」 클릭
- **Then** `GET /crawl-runs?source=momos&page=0&size=20` 요청. 「전체」는 `source` 파라미터 없음
- **검증** 컴포넌트 테스트

#### AC-ADMIN-07 · 이력 행 클릭 → 패널 교체

- **When** #131 행 클릭
- **Then** URL `?run=131`, 패널 eyebrow `Run #131 · unspecialty`
- **검증** 컴포넌트 테스트

#### AC-ADMIN-08 · 패널 요약 (SUCCEEDED)

- **Given** 실행: created 19, updated 42, skipped 3, unmapped 5
- **Then** 히어로 `생성 19`, 부가 `갱신 42 · 건너뜀 3 · 미매핑 5`,
  문장 「이번 실행에서 상품 3건을 건너뛰고, 원문 5건을 매핑하지 못했습니다.」
- **검증** 컴포넌트 테스트

#### AC-ADMIN-09 · 건너뛴 상품 — 사유별 묶음

- **Given** skipped: USER_OWNED 1, FETCH_FAILED 2
- **Then** 묶음 제목 `USER_OWNED 사용자가 등록한 원두 — 덮어쓰지 않음 1건`, `FETCH_FAILED 상품 페이지를 읽지 못함 2건`.
  `PARSE_FAILED` 설명은 「페이지 구조를 해석하지 못함」
- **검증** 단위 테스트 (묶음 함수) + 컴포넌트 테스트

#### AC-ADMIN-10 · 매핑하지 못한 원문 — field별, 많은 순, 5건 접기

- **Given** unmapped: variety 7건, process 2건
- **Then** 묶음 순서 `variety 품종 7건` → `process 가공법 2건`. 품종 묶음은 원문 5개 + 「나머지 2건 보기」. 누르면 7개.
  원문은 `“Heirloom”`처럼 따옴표로 감싼다. `roastLevel` 라벨은 「로스팅」
- **검증** 단위 테스트 + 컴포넌트 테스트

#### AC-ADMIN-11 · 40건 이상이면 가장 많은 field를 짚는다

- **Given** skipped 0, unmapped 41 (variety 25, process 16)
- **Then** 문장 「이번 실행에서 상품 0건을 건너뛰고, 원문 41건을 매핑하지 못했습니다. 품종(variety)이 25건으로 가장 많습니다.」
- **검증** 단위 테스트 (문장 함수)

#### AC-ADMIN-12 · 딥링크

- **Given** URL `/admin/crawl?run=131`
- **When** 페이지 진입
- **Then** `GET /crawl-runs/131` 후 패널이 열려 있다. 「닫기」 → 쿼리 없는 `/admin/crawl`
- **검증** 컴포넌트 테스트

#### AC-ADMIN-13 · `/admin`은 `/admin/crawl`로

- **Then** `router.replace("/admin/crawl")` 1회
- **검증** 컴포넌트 테스트

#### AC-ADMIN-14 · 더보기의 관리자 링크

- **Given** `me.role = ADMIN` / `USER`
- **Then** ADMIN이면 `/admin`으로 가는 「관리자」 링크가 있고, USER면 없다
- **검증** 컴포넌트 테스트 `app/more/page.test.tsx`

### 엣지

#### AC-ADMIN-20 · 실행 이력 0건

- **Given** `crawl-runs` `content: []`
- **Then** 「아직 실행 이력이 없습니다.」 + 「위에서 구매처를 골라 「수집」을 누르면 첫 실행이 여기 쌓입니다.」, 표 헤더 없음
- **검증** 컴포넌트 테스트

#### AC-ADMIN-21 · 건너뜀·미매핑 0건

- **Given** SUCCEEDED, skipped `[]`, unmapped `[]`
- **Then** 문장 「이번 실행에서 건너뛴 상품과 매핑하지 못한 원문이 없습니다.」, 이력 표의 `0`은 흐린 글자(`text-ink-3`)
- **검증** 컴포넌트 테스트

#### AC-ADMIN-22 · INTERRUPTED는 종료·소요가 `—`

- **Given** INTERRUPTED, `finishedAt` 있음 (서버는 재시작 시각을 넣는다)
- **Then** 패널의 종료·소요, 이력 표의 소요가 `—`. 집계 네 칸도 `—`.
  문장 「앱이 재시작되어 실행이 중단되었습니다. 중단 전에 반영된 원두는 집계에 남지 않았습니다.」
- **검증** 컴포넌트 테스트
- 목업 문구(「아래는 중단 시점까지의 집계입니다」)와 다르다 — 서버는 집계를 실행이 끝날 때 한 번에 쓰므로 INTERRUPTED의 집계는 언제나 0이다. 0을 보여 주면 거짓말이 된다.

#### AC-ADMIN-23 · 페이지 넘김

- **Given** 응답 `page 0, totalElements 25, totalPages 2, hasNext true`
- **Then** `1–20 / 25`, 「← 이전」 비활성. 「다음 →」 → `page=1` 요청, 표기 `21–25 / 25`, 「다음 →」 비활성
- **검증** 컴포넌트 테스트

### 실패

#### AC-ADMIN-30 · ADMIN이 아니면 403 화면

- **Given** `me.role = USER`
- **Then** `403 · /admin`, 「관리자 권한이 있는 계정만 볼 수 있는 화면입니다.」, 「앱으로 돌아가기」(`/`). `/api/v1/admin/**` 요청 0회
- **검증** 컴포넌트 테스트

#### AC-ADMIN-31 · 409 → 진행 중 실행을 보여 준다

- **Given** momos `lastRun = {id: 129, RUNNING}`인데 버튼이 눌렸다(목록이 낡은 경우), POST → HTTP `409` `code: "CRAWL_ALREADY_RUNNING"`
- **Then** momos 행 아래 「409 CRAWL_ALREADY_RUNNING — 이 구매처는 이미 수집 중이라 새 실행을 시작하지 않았습니다. 진행 중인 실행 #129를 표시합니다.」,
  `crawl-sources`를 다시 읽고 URL `?run=129`
- **검증** 컴포넌트 테스트
- 진행 중 실행 id는 다시 읽은 `crawl-sources`의 `lastRun.id`다. 그것도 RUNNING이 아니면 안내 문구만 남긴다.

#### AC-ADMIN-32 · FAILED 패널

- **Given** FAILED, `errorMessage = "목록에서 상품 링크를 찾지 못했습니다"`
- **Then** 문장 「실행 전체가 실패했습니다. 이번 실행으로 생성되거나 갱신된 원두는 없습니다.」, errorMessage 상자에 원문, 건너뜀·미매핑 목록 없음
- **검증** 컴포넌트 테스트

#### AC-ADMIN-33 · 없는 실행 딥링크

- **Given** `?run=999999`, GET → HTTP `404` `code: "CRAWL_RUN_NOT_FOUND"`
- **Then** 패널에 「실행 #999999을 찾지 못했습니다.」, 구매처·이력은 그대로 보인다
- **검증** 컴포넌트 테스트

### 비기능

#### AC-ADMIN-40 · 960px 미만은 안내만

- **Given** 뷰포트 폭 900px
- **Then** 「관리자 화면은 데스크톱에서 열어 주세요.」가 보이고 구매처 표는 보이지 않는다
- **검증** e2e `e2e/admin-crawl.spec.ts`

#### AC-ADMIN-41 · 960–1279px은 패널이 오버레이

- **Given** 뷰포트 1100px, `?run=131`
- **Then** 패널의 `position`이 `fixed`, 오른쪽 끝이 뷰포트 오른쪽 끝과 같다. 1440px에서는 `fixed`가 아니고 본문 오른쪽 열(폭 420px)이다
- **검증** e2e

#### AC-ADMIN-42 · 새 색 토큰 없음

- **Then** `globals.css`에 `--a-` 접두 토큰이 없다
- **검증** 단위 테스트 (`globals.css` 문자열 검사)

---

## 구현 순서

- [ ] **Task 0: 크롤러 0건 FAILED** — 크롤러 스펙 Task 8 (AC-CRAWL-37, 38). 백엔드는 이것뿐

- [ ] **Task 1: 스키마·쿼리** — Covers: AC-ADMIN-06 (요청 파라미터)
  `features/admin/schema.ts`: `crawlSourceSchema`, `crawlRunSchema`, `crawlRunPageSchema` (생성 타입과 `satisfies`로 맞춘다).
  `features/admin/queries.ts`: `useCrawlSources`, `useCrawlRuns(source, page)`, `useCrawlRun(id)`(RUNNING이면 `refetchInterval: 3000`), `useStartCrawl`.
  픽스처는 로컬 실제 응답에서 떠 `test/fixtures.ts`에.

- [ ] **Task 2: 표시 함수** — Covers: AC-ADMIN-09, 10, 11
  `features/admin/format.ts`: `groupSkipped`, `groupUnmapped`, `observation(run)`, `duration(run)`, `clock(iso)`.

- [ ] **Task 3: 틀 + 권한** — Covers: AC-ADMIN-13, 30, 42
  `app/admin/layout.tsx`(상단 바·좌측 메뉴·960 안내·403 분기), `app/admin/page.tsx`(replace).

- [ ] **Task 4: 원두 수집 화면** — Covers: AC-ADMIN-01~05, 07, 08, 12, 20~23, 31~33
  `app/admin/crawl/page.tsx` + `features/admin/components/{SourceList,RunTable,RunPanel,StatusTag}.tsx`.

- [ ] **Task 5: 더보기 링크** — Covers: AC-ADMIN-14

- [ ] **Task 6: e2e 반응형** — Covers: AC-ADMIN-40, 41
  기존 e2e 스텁 방식(`installStubs`)에 admin 응답 추가.

---

## 수동 확인

- [ ] ★ 로컬 백엔드 + `pnpm dev`로 ADMIN 계정에서 `/admin/crawl` → momos 「수집」 → RUNNING 표시 → SUCCEEDED로 바뀌고 이력·구매처가 갱신된다. 실행 중 unspecialty 「수집」도 독립적으로 돈다
- [ ] 목업 `Admin.dc.html`과 1440×900 라이트·다크 나란히 보기

## 열어둔 결정

- 장비·영점·회원 화면 — API 스펙과 함께 각자 스펙에서
- 목업 질문 6~12(병합·승격·환산식·관리자 0명 방지·다크 wash) — 해당 화면 스펙에서

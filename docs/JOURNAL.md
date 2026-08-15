# 작업 일지

세션마다 한 항목. **최신이 위**, append-only — 과거 항목을 고치지 않는다.
작성 규칙은 [`docs/conventions/handover.md`](conventions/handover.md).

체크박스가 담지 못하는 것을 담는 곳이다 — 막힌 지점, 계획과 달라진 이유, 확인·반증된 가정.

---

## 2026-08-15 · Task 3 — `extraction` 추출 수율/SCA 구간 순수 도메인

**브랜치:** `feat/task-03-extraction` (main에서 분기) · **PR:** 아래 참조
**상태:** 완료

### 한 일
- `BrewMeasurement`·`ExtractionAnalyzer`·`ExtractionAnalysis` + `StrengthZone`·`ExtractionZone`·`InvalidBrewMeasurementException` 추가 (Spring·JPA 무의존)
- `ExtractionAnalyzerTest` 25개 작성, AC-EXT-01~36 전체 검증 — 이 스펙은 HTTP가 없어 전부 단위 테스트로 끝난다
- `clean check`·`check-spec-coverage.sh` 그린 확인

### 발견한 것
- 계획 문서 Step 6이 예상한 대로 두 스펙(`grind`·`extraction`) 모두 `status: 초안`으로 남아 커버리지 검사를 건너뛴다. 이 스펙은 Task 11 같은 후속 API 태스크가 없어(AC 전체가 이미 이번 태스크로 끝) `구현완료`로 바꿔야 하는지 애매하지만, 계획이 명시한 기대값을 그대로 따랐다 — 바꾸려면 사람 확인이 먼저 필요해 보인다

### 다음 세션에게
- **`extraction` 스펙의 `status`를 `구현완료`로 바꿀지 사람에게 확인받을 것.** AC 25개가 전부 이 태스크로 끝났는데 계획 문서는 status 전환 시점을 Task 11(grind용)로만 언급해 extraction 몫이 비어 있다
- Task 2(`feat/task-02-grind`)와 이 브랜치는 둘 다 main에서 독립적으로 분기했다

---

## 2026-08-15 · 세션 복구 (앞 세션 비정상 종료)

**브랜치:** `docs/journal-resume-recovery` · **PR:** #4 (머지됨)
**상태:** 완료 — 구현 없음, 저장소 상태 복구만

### 한 일
- `/resume`이 안 된다는 보고로 조사: 앞 세션이 `.claude/worktrees/resume-session`(브랜치 `feat/task-01-scaffolding`)에서 작업하다 handover 없이 끊겼다. 그 브랜치는 이미 PR #3으로 GitHub에서 스쿼시 머지됐지만, worktree·로컬 브랜치가 정리되지 않고 로컬 `main`도 pull이 안 된 채 남아 있었다
- worktree 제거, 로컬 `feat/task-01-scaffolding` 삭제, `main`을 `origin/main`(`22546b0`)으로 fast-forward
- `./gradlew clean check`, `check-spec-coverage.sh` 재확인 — 둘 다 초록
- Task 2용 브랜치 `feat/task-02-grind`를 만들었으나 이번 세션에서 실제 구현은 진행하지 않음(커밋 0개) — 사용자가 곧바로 `/handover`를 호출해 빈 브랜치는 삭제하고 이 항목만 남김

### 발견한 것
- **핸드오버 없이 세션이 끊기면 worktree·브랜치가 고아로 남아 다음 `/resume`을 헷갈리게 한다.** PR이 머지됐는지, 로컬이 그걸 반영했는지를 `git worktree list` + `gh pr list`로 직접 대조해야 확인 가능했다

### 다음 세션에게
- **Task 2(`grind` 순수 도메인)부터 시작.** `main`은 최신(`22546b0`)이고 검증도 초록이니 바로 `feat/task-02-grind` 브랜치를 새로 따서 계획 문서 Task 2 Step 1부터 진행하면 된다. 이번 세션은 코드를 전혀 건드리지 않았다

---

## 2026-08-15 · Task 1 — 프로젝트 스캐폴딩

**브랜치:** `feat/task-01-scaffolding` · **PR:** 아래 참조
**상태:** 완료 — Step 1~10 전부, `./gradlew clean check` 통과

### 한 일
- start.spring.io로 Java 21 / Boot 4.1.0 프로젝트 생성, 루트 `docker-compose.yml`(Postgres 17), `application.yml`/`-local`/`-test`, `AbstractIntegrationTest` + `TestcontainersConfiguration`, `ApplicationSmokeTest`(`/actuator/health` PASS), Spotless 추가
- `.github/workflows/backend.yml`의 임시 가드(`backend/gradlew` 존재 확인 step과 각 step의 `if:`) 제거 — 계획에서 지시한 대로

### 발견한 것 — 계획의 "검증되지 않은 가정" 결과
1. `bootVersion=4.1.0` 그대로 받아짐 (가정 1 확인)
2. `@ServiceConnection` import 경로는 그대로였다 (가정 2 확인). 다만 **`PostgreSQLContainer` 자체의 패키지가 `org.testcontainers.containers` → `org.testcontainers.postgresql`로 이동**했고 제네릭도 사라져 raw type이 됐다 (계획에 없던 추가 변경)
3. `AutoConfigureMockMvc`도 이동했다: `org.springframework.boot.test.autoconfigure.web.servlet` → `org.springframework.boot.webmvc.test.autoconfigure`
4. Task 7·8의 가정(`MockRestServiceServer.bindTo`, `@MockitoBean`)은 아직 미확인 — 해당 태스크에서 확인할 것

### 발견한 것 — 계획과 달라진 점
- 저장소가 이미 `git init`되어 있어 Step 2의 `git init`은 건너뛰었다. 스캐폴딩만 새 브랜치에 일반 커밋으로 추가
- 루트 `.gitignore`가 이미 백엔드 패턴을 다 포함하고 있어 `backend/.gitignore`는 옮길 것 없이 삭제만 했다
- **환경 이슈:** Spotless 기본 google-java-format(1.24.0)이 이 머신 JDK에서 `NoSuchMethodError`(javac 내부 API가 `Queue`→`List`로 바뀐 최신 JDK 호환성 문제, diffplug/spotless#2468)를 냈다. `1.28.0`으로 버전을 고정해 해결. **PR #3에서 CI(ubuntu-latest + Temurin 21) 확인 완료 — `clean check` 1m38s 초록.**
- `backend/gradle.properties`에 google-java-format용 `--add-exports`/`--add-opens` JVM 인자 추가 (JDK 16+ 공통 이슈, 머신별 경로 아님 — 커밋 안전)
- 생성된 기본 클래스명이 `KaldiNoteApiApplication`(artifactId 기반)이라 문서 구조(`backend/CLAUDE.md`)에 맞춰 `KaldiNoteApplication`으로 정리. 기본 생성 보일러플레이트(`HELP.md`, 컨텍스트 로드 테스트, `TestKaldiNoteApiApplication`)는 계획의 파일 목록에 없어 제거

### 다음 세션에게
- **Task 2(`grind` 순수 도메인)부터.** DB·Spring 의존 없어 바로 시작 가능. PR #3(CI 초록)이 머지된 뒤 `main`에서 새 브랜치를 딴다

---

## 2026-08-14 · 세션 운영 방식 정의 (설계 세션)

**브랜치:** `docs/session-flow` → `docs/journal-design-session` · **PR:** #1 (머지됨), #2
**상태:** 완료 — 이 세션으로 기초 설계와 개발 방식 정의가 끝났다

### 한 일
- 핸드오버 프로토콜 수립 — `/resume`·`/handover` 커맨드, JOURNAL, 체크박스 소유권
- 세션을 **설계 / 구현 / 디자인** 셋으로 나누고 브랜치·산출물·사용 스킬을 정의
- 병렬 작업 규칙 — worktree 사용 조건과 안전한 조합
- 설계 세션도 PR을 거치도록 결정. PR #1이 저장소 첫 PR이다

### 발견한 것
- **superpowers의 `executing-plans`·`using-git-worktrees`·`subagent-driven-development`가 이 프로젝트 흐름과 충돌한다.** 앞 둘은 계획 실행 때마다 worktree를 강제해서 백엔드가 여러 워크스페이스로 갈라진다. `handover.md`에 "쓰지 말 것"으로 명시했다
- **백엔드 세션은 하나만 돌릴 수 있다.** `docker-compose.yml`의 PostgreSQL이 5432 포트 고정이고, 계획의 `TestcontainersConfiguration`이 `.withReuse(true)`라 컨테이너를 공유한다. 둘을 동시에 돌리면 Flyway 마이그레이션과 테스트 데이터가 섞이는데, 증상이 "내 테스트가 이유 없이 실패"로 나타나 원인을 자기 코드에서 찾게 된다
- `EnterWorktree` 도구는 **CLAUDE.md나 메모리가 지시할 때만** 동작한다. 지시가 없으면 병렬 세션이 같은 디렉터리를 공유해버린다. CLAUDE.md에 지시를 넣었다
- CLAUDE.md 영어화를 검토했으나 **한국어는 전체 문자의 21~33%뿐**이라 절감이 세션당 1% 수준이었다. 번역본 이중 관리 비용이 더 커서 한국어 단일로 유지하기로 했다

### 다음 세션에게
- **구현 세션에서 `/resume` → Plan 1 Task 1**부터 시작한다. 설계·계획·스펙이 모두 준비돼 있어 인터뷰가 필요 없다
- 저장소 초기 커밋 5개(`c625b2b`~`359c41a`)는 `main` 직행이다. **규칙 제정 전이라 그런 것이지 예외가 아니다.** 앞으로는 문서만 바꿔도 브랜치·PR을 거친다
- JOURNAL은 파일 하나를 모든 세션이 공유한다. 병렬 세션의 PR을 머지할 때 이 파일에서 충돌이 날 수 있는데, **두 항목을 다 남기면 끝**이다

---

## 2026-08-14 · 설계 · 규칙 수립 (구현 착수 전)

**브랜치:** `main` · **PR:** 없음 (문서만)
**상태:** 완료

### 한 일
- 커피 도메인 조사 → 아키텍처 설계 → Plan 1(태스크 11개) 작성
- 작업 규칙 확립: **스펙 → 계획 → 코드**, 인수 조건은 기계적으로 검증 가능해야 함
- `/interview`로 기능 스펙 2건 작성 — `grind`(AC 21개), `extraction`(AC 25개)
- 두 스펙에 맞춰 Plan 1 갱신 (AC 매핑표 신설, 46개 전부 대응)
- GitHub 저장소 생성 + CI 3종(backend / frontend / spec)

### 발견한 것
- **Spring Boot 3.5는 2026-06-30 OSS 지원 종료.** 신규 프로젝트는 4.1을 써야 한다. Boot 4 함정 3가지(Security 7 CSRF 기본 활성, Jackson 3 = `tools.jackson.*`, springdoc 3.1.0+)는 `backend/CLAUDE.md`에 정리했다
- **OCI 프리티어가 2 OCPU/12GB로 축소**됐다(2026-06-15). 인스턴스는 생성 완료
- 스펙을 쓰면서 Plan 1의 구멍 7개를 찾았다 — 분쇄도 범위 검증 부재, 영점 미만이 500으로 떨어짐, 결과 범위 초과 미정의, 추출 입력 검증 부재, EY 물리 한계 미검증 등. 전부 계획에 반영했다
- **로스팅 원두는 약 28~30%만 수용성**이라 EY 30% 초과는 측정 오입력이다

### 다음 세션에게
- **Plan 1 Task 1부터 시작한다.** `/resume`으로 시작할 것
- 브랜치는 `feat/task-01-scaffolding`
- 계획에 **검증되지 않은 가정 4개**가 명시돼 있다(문서 맨 아래 "자체 검토 결과"). 실행 중 확인되면 이 일지에 결과를 남길 것:
  1. `start.spring.io`가 `bootVersion=4.1.0`을 받는지
  2. Boot 4에서 `@ServiceConnection` import 경로가 그대로인지
  3. `MockRestServiceServer.bindTo(RestClient.Builder)` 가용 여부 (Task 7)
  4. Boot 4에서 `@MockBean`이 제거됐는지 (Task 8) → `@MockitoBean`
- **넷 다 "버전을 낮춘다"로 해결하지 않는다.** 3.5는 지원이 끝났다
- CI 워크플로에 **임시 가드**가 있다. `backend/gradlew`가 생기면 `backend.yml`의 가드 단계와 각 step의 `if:` 조건을 **반드시 지운다.** 안 지우면 CI가 초록인데 아무것도 검사하지 않는 상태가 된다

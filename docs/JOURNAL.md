# 작업 일지

세션마다 한 항목. **최신이 위**, append-only — 과거 항목을 고치지 않는다.
작성 규칙은 [`docs/conventions/handover.md`](conventions/handover.md).

체크박스가 담지 못하는 것을 담는 곳이다 — 막힌 지점, 계획과 달라진 이유, 확인·반증된 가정.

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

# kaldi note

커피 레시피를 재현 가능한 형태로 기록하고 공유하는 서비스.

푸어오버 레시피를 **푸어 스텝 시퀀스**로 구조화해 저장하고, 실제 추출 기록을 레시피와 분리해 누적하며, 서로 다른 그라인더 간 분쇄도를 환산한다.

> **상태: 설계 완료, 구현 미착수**

## 왜 만드나

메신저로 주고받는 커피 레시피는 세 가지가 안 된다.

1. **재현이 안 된다** — "그때 몇 클릭이었지?"
2. **분쇄도가 안 통한다** — 그라인더가 서로 다르면 "22클릭"이 같은 굵기가 아니다
3. **비교가 안 된다** — 같은 레시피를 세 번 내렸을 때 뭐가 달랐는지 남지 않는다

## 스택

| | |
|---|---|
| 백엔드 | Java 21 · Spring Boot 4.1 · PostgreSQL 17 · Flyway · Testcontainers |
| 프론트 | Next.js (App Router) · TypeScript · Tailwind · PWA |
| 배포 | 백엔드 → Oracle Cloud (ARM VM) / 프론트 → Vercel |

## 구조

```
backend/     Spring Boot API 서버
frontend/    Next.js PWA
docs/
├── specs/         설계 문서 — 무엇을 왜 만드는가
├── plans/         구현 계획 — 태스크 단위
└── conventions/   코딩 규칙
```

## 시작하기

```bash
docker compose up -d          # 로컬 PostgreSQL

cd backend && ./gradlew bootRun    # → localhost:8080
cd frontend && pnpm dev            # → localhost:3000
```

## 문서

작업 전에 [`CLAUDE.md`](CLAUDE.md)를 먼저 읽는다. 전체 구조와 **뒤집으면 안 되는 설계 결정**이 정리돼 있다.

- [설계 문서](docs/design/2026-08-14-architecture.md)
- [구현 계획 — Plan 1](docs/plans/2026-08-14-plan1-foundation.md)
- [작업 일지](docs/JOURNAL.md) — 지금 어디까지 왔는지
- 컨벤션: [작업 흐름](docs/conventions/workflow.md) · [핸드오버](docs/conventions/handover.md) · [git](docs/conventions/git.md) · [backend](docs/conventions/backend.md) · [frontend](docs/conventions/frontend.md)

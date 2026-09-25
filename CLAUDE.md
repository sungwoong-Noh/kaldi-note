# kaldi note

커피 레시피를 재현 가능한 형태로 기록하고 공유하는 서비스. 푸어오버 레시피의 **푸어 스텝
시퀀스**를 구조화해 저장하고, 실제 추출 기록을 레시피와 분리해 누적하며, 서로 다른 그라인더
간 분쇄도를 환산한다. 지금은 **둘이 매일 쓰는 도구**가 목표다 — 공개 서비스 전환은 보류됐다
(`docs/decisions/0009-public-service-deferred.md`).

**지금 무엇을 하는지는 이 파일이 아니라 [`docs/ROADMAP.md`](docs/ROADMAP.md) + GitHub
Issues/Project 보드가 안다.** 이 파일은 지도만 담는다 — 상태·숫자·진행률은 여기 두지 않는다.

---

## ★ 작업 규칙 — 스펙 → 코드

**모든 기능 개발(갈래 A)은 두 단계를 순서대로 거친다.**

```
1. 스펙 (docs/specs/)   무엇을·왜·어떻게 동작해야 하는가 + 구현 순서   → 승인
2. 코드                  TDD로 구현
```

스펙은 `/interview`로 만든다. 인수 조건은 기계적으로 검증 가능해야 하고, 테스트에
`AC-<기능>-<번호>` ID를 남긴다 — `./scripts/check-spec-coverage.sh`가 CI에서 이를 검사한다.

작업은 **갈래(A 풀 흐름 / B 시각 / C 버그·잔손질)**로 나뉜다. 애매하면 A.

**상세 규칙: [`docs/conventions/workflow.md`](docs/conventions/workflow.md) — 코드를 쓰기 전에
반드시 읽는다.**

---

## ★ 세션 핸드오버

```
세션 시작:  /resume     상태 파악 + 테스트 실행 + 할 일 제안 → 승인 후 시작
세션 종료:  /handover   검증 + 체크박스 갱신 + PR 본문 작성 + 커밋/PR
```

**세션 1개 = 브랜치 1개 = PR 1개.** 스택 PR(브랜치가 서로를 base로 잡는 구조)은 쓰지 않는다
(`docs/conventions/git.md`). **다른 세션이 동시에 돈다면 `EnterWorktree`로 격리한다.** 백엔드
세션은 하나만 돌린다 — 5432 포트와 Testcontainers 재사용 컨테이너를 공유한다.

**상세 규칙: [`docs/conventions/handover.md`](docs/conventions/handover.md)**

---

## 저장소 구조

모노레포다. 배포 대상은 서로 다르다(백엔드 → OCI VM, 프론트 → Cloudflare Workers).

```
kaldi-note/
├── CLAUDE.md                 이 파일. 지도만
├── .claude/commands/         /interview · /resume · /handover · /fix
├── backend/                  Spring Boot 4.1 API 서버 — 작업 전 backend/CLAUDE.md
├── frontend/                 Next.js PWA — 작업 전 frontend/CLAUDE.md
├── docs/
│   ├── ROADMAP.md             ★ 유일한 계획 문서 — 마일스톤 목표·완료 정의
│   ├── decisions/              ADR — 되돌리기 어려운 설계 결정
│   ├── specs/                  ★ AC를 가진 기능 스펙만 (README.md에 작성 규칙)
│   ├── contracts/               OpenAPI 조각
│   ├── design/                  목업·브랜드·아키텍처 (입력물, AC 없음)
│   ├── GOTCHAS.md               지금 유효한 함정만
│   ├── archive/                 역할이 끝난 문서 (plans/, JOURNAL.md)
│   └── conventions/
│       ├── workflow.md         ★ 갈래·흐름·문서 수명. 코드 쓰기 전 필독
│       ├── handover.md         ★ 세션 인계
│       ├── git.md · verification.md · backend.md · frontend.md
├── scripts/
│   ├── check-spec-coverage.sh   AC ID가 테스트에 있는지 검사
│   └── status.sh                 현황 계산 — 저장하지 않는다
└── .github/workflows/           CI
```

GitHub Issues + Project 보드가 백로그·버그·시각 보정을 추적한다. Milestone은
`docs/ROADMAP.md`의 마일스톤과 같다.

---

## 작업 시작 전 읽을 문서

| 하려는 일 | 읽을 문서 |
|---|---|
| **세션을 시작할 때** | **`/resume`** (그 전에 아무것도 하지 않는다) |
| **무엇이든** | 이 파일 → **`docs/conventions/workflow.md`** → `docs/conventions/git.md` |
| 세션을 마칠 때 | **`/handover`** |
| 기능 스펙 작성 | `docs/specs/README.md` |
| 백엔드 코드 작성 | `backend/CLAUDE.md` → `docs/conventions/backend.md` |
| 프론트 코드 작성 | `frontend/CLAUDE.md` → `docs/conventions/frontend.md` |
| 「수동 확인」을 밟을 때 | `docs/conventions/verification.md` |
| 되돌리면 안 되는 결정인지 확인할 때 | `docs/decisions/` |

---

## 뒤집으면 안 되는 설계 결정

**`docs/decisions/`가 정본이다** (ADR 0001~0009). 코드만 보면 "왜 이렇게 복잡한가" 싶을 수
있으나 각각 이유가 있다. 바꿔야 할 근거가 생기면 먼저 사람에게 확인받는다.

## 배포 환경 제약

- **OCI Always Free ARM VM: 2 OCPU / 12GB.** 2026-06-15부로 4 OCPU/24GB에서 절반으로 축소됐다.
- OCI Object Storage 무료 10GB — 이미지 저장용.
- **프론트는 Cloudflare Workers 무료 플랜.** 호출당 CPU 10ms가 SSR에서 실제로 닿을 수 있는
  상한이다.

## 명령어 요약

```bash
docker compose up -d && docker compose down     # 로컬 DB (백엔드 작업 전 필수)

cd backend && ./gradlew test                     # 백엔드 테스트
cd backend && ./gradlew bootRun                  # localhost:8080

cd frontend && pnpm test                         # 프론트 테스트
cd frontend && pnpm dev                          # localhost:3000
```

---

## 에이전트에게

- **스펙 없이 코드를 쓰지 않는다.** "이 기능 만들어줘"라고만 해도 스펙부터 쓰고 승인을 받는다.
- **인수 조건은 리터럴 값으로 쓴다.** 검증할 수 없는 조건을 쓰느니 값을 정해달라고 묻는다.
- **테스트에 AC ID를 남긴다.** 빠뜨리면 `check-spec-coverage.sh`가 CI에서 잡는다.
- **TDD를 지킨다.** 실패하는 테스트 → 실행해서 실패 확인 → 최소 구현 → 통과 확인 → 커밋.
- **검증 없이 "완료"라고 말하지 않는다.** 실제로 명령을 실행하고 출력을 기대값과 대조한다
  (`docs/conventions/workflow.md`「검증은 출력을 찍는 것이 아니라」).
- **테스트 픽스처는 실제 응답에서 뜬다.** 지어낸 픽스처는 코드가 아니라 내 가정을 검증한다
  (`docs/conventions/frontend.md`).
- 스펙에 없는 리팩터링·기능 추가를 임의로 하지 않는다. 필요해 보이면 제안하고 확인받는다.
- **메모리에는 사실을 저장하지 않는다.** 자동 메모리는 사용자 선호 1개 파일만 둔다 — 테스트
  수·AC 수·진행률·설계 결정 같은 사실은 저장소가 정본이고 금방 낡는다.
- 사람과의 대화는 한국어로 한다. 코드 식별자는 영어, 주석과 커밋 메시지는 한국어다.

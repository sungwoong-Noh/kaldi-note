# kaldi note

커피 레시피를 재현 가능한 형태로 기록하고 공유하는 서비스. 푸어오버 레시피의 **푸어 스텝 시퀀스**를 구조화해 저장하고, 실제 추출 기록을 레시피와 분리해 누적하며, 서로 다른 그라인더 간 분쇄도를 환산한다.

> **현재 상태: 설계 완료, 구현 미착수.** 코드는 아직 없다.

---

## ★ 작업 규칙 — 스펙 → 계획 → 코드

**모든 기능 개발은 세 단계를 순서대로 거친다. 건너뛰지 않는다.**

```
1. 스펙 (docs/specs/)    무엇을 · 왜 · 어떻게 동작해야 하는가   → 승인
2. 계획 (docs/plans/)    어떻게 개발할 것인가 (태스크 단위)     → 승인
3. 코드                   TDD로 구현
```

**스펙은 인터뷰로 만든다.** 요구사항을 추측하지 않는다.

```
/interview <만들려는 기능 한 줄>
```

한 번에 한 주제만 묻고, 숫자가 확정될 때까지 전진하지 않는다. 인터뷰가 끝나면 결정 목록을 확인받고 스펙 파일을 만든다.

가장 중요한 것: **스펙의 인수 조건은 기계적으로 검증 가능해야 한다.** 자동화된 테스트로 옮길 수 없는 조건은 인수 조건이 아니다. "적절히", "빠르게", "잘 동작한다" 같은 표현은 금지이며, 구체적인 리터럴 값으로 쓴다.

각 인수 조건에는 `AC-<기능>-<번호>` 형태의 ID를 붙이고, **테스트에 그 ID를 남긴다.** 이게 스펙과 코드를 잇는 유일한 끈이다.

```java
@DisplayName("AC-GRIND-01 · C40 22클릭은 660마이크론이다")
```

`./scripts/check-spec-coverage.sh`가 모든 AC ID가 테스트에 존재하는지 검사한다. CI에서도 돌아간다.

**상세 규칙: [`docs/conventions/workflow.md`](docs/conventions/workflow.md) — 코드를 쓰기 전에 반드시 읽는다.**

---

## ★ 세션 핸드오버

작업은 세션 단위로 나뉘고, **세션마다 다른 에이전트가 붙는다.** 새 에이전트는 이전 대화를 보지 못하고 저장소에 남은 것만 본다.

```
세션 시작:  /resume     상태 파악 + 테스트 실행 + 할 일 제안 → 승인 후 시작
세션 종료:  /handover   검증 + 체크박스 갱신 + JOURNAL 기록 + 커밋/PR
```

| 정보 | 어디에 |
|---|---|
| 어디까지 했나 | `docs/plans/*.md`의 `- [ ]` 체크박스 — **단일 진실 원천** |
| 왜 그렇게 했나 | [`docs/JOURNAL.md`](docs/JOURNAL.md) — 막힌 지점, 계획과 달라진 이유 |

**태스크 1개 = 브랜치 1개 = PR 1개.** 브랜치명은 `feat/task-02-grind`처럼 계획의 태스크 번호를 넣는다.

**`/resume`은 반드시 테스트를 실행한다.** 초록이라고 가정하고 시작하면, 앞 세션의 실패를 내 작업 탓으로 오해하며 시간을 날린다.

**상세 규칙: [`docs/conventions/handover.md`](docs/conventions/handover.md)**

---

## 저장소 구조

프론트엔드와 백엔드를 한 저장소에 두는 모노레포다. 배포 대상은 서로 다르다(백엔드 → OCI VM, 프론트 → Vercel).

```
kaldi-note/
├── CLAUDE.md                 ← 이 파일. 전체 개요와 문서 지도
├── .claude/commands/
│   ├── interview.md          /interview — 스펙 작성 전 요구사항 인터뷰
│   ├── resume.md             /resume   — 세션 시작
│   └── handover.md           /handover — 세션 종료
├── backend/                  Spring Boot 4.1 API 서버
│   └── CLAUDE.md             ← 백엔드 작업 시 반드시 먼저 읽을 것
├── frontend/                 Next.js PWA
│   └── CLAUDE.md             ← 프론트 작업 시 반드시 먼저 읽을 것
├── docs/
│   ├── JOURNAL.md            ★ 세션 일지 — 왜 지금 이 상태인가
│   ├── design/               전체 아키텍처 — 왜 이런 구조인가
│   │   └── 2026-08-14-architecture.md
│   ├── specs/                ★ 기능 스펙 — AC를 가진 문서만 여기 둔다
│   │   └── TEMPLATE.md
│   ├── plans/                구현 계획 (태스크 단위)
│   │   ├── TEMPLATE.md
│   │   └── 2026-08-14-plan1-foundation.md
│   └── conventions/
│       ├── workflow.md       ★ 스펙 → 계획 → 코드. 코드 쓰기 전 필독
│       ├── handover.md       ★ 세션 인계 프로토콜
│       ├── git.md            커밋·브랜치·PR (공통)
│       ├── backend.md        Java / Spring Boot
│       └── frontend.md       TypeScript / Next.js
├── scripts/
│   └── check-spec-coverage.sh   AC ID가 테스트에 있는지 검사
├── docker-compose.yml        로컬 개발용 PostgreSQL
└── .github/workflows/        CI (백엔드/프론트/스펙 분리)
```

**`docs/design/`과 `docs/specs/`의 차이:** `design/`은 시스템 전체가 왜 이렇게 생겼는지를 설명하는 문서로 AC가 없다. `specs/`는 개별 기능의 동작을 인수 조건으로 못박는 문서다. 커버리지 스크립트는 `specs/`만 검사한다.

---

## 작업 시작 전 읽을 문서

| 하려는 일 | 읽을 문서 |
|---|---|
| **세션을 시작할 때** | **`/resume`** (그 전에 아무것도 하지 않는다) |
| **무엇이든** | 이 파일 → **`docs/conventions/workflow.md`** → `docs/conventions/git.md` |
| 세션을 마칠 때 | **`/handover`** → `docs/conventions/handover.md` |
| 기능 스펙 작성 | `docs/conventions/workflow.md` → `docs/specs/TEMPLATE.md` |
| 구현 계획 작성 | `docs/conventions/workflow.md` → `docs/plans/TEMPLATE.md` |
| 백엔드 코드 작성 | `backend/CLAUDE.md` → `docs/conventions/backend.md` |
| 프론트 코드 작성 | `frontend/CLAUDE.md` → `docs/conventions/frontend.md` |
| "왜 이런 구조인가" 판단이 필요할 때 | `docs/design/2026-08-14-architecture.md` |

---

## 구현 순서

계획 문서 4개로 나뉜다. 각각 그 자체로 동작하고 테스트 가능한 소프트웨어를 산출한다.

| 계획 | 상태 | 범위 | 완료 시 가능한 것 |
|---|---|---|---|
| **Plan 1 — Foundation** | ✅ 작성 완료 | 스캐폴딩, `grind`/`extraction` 순수 도메인, 인증(OAuth2+JWT), 마스터 데이터 | 로그인 → 마스터 조회 → 분쇄도 환산 |
| **Plan 2 — Core Domain** | 미작성 | 원두 재고, 레시피+스텝, 브루잉 로그(EY/SCA), 포크, 공개범위 인가 | Swagger로 실사용 가능한 API 완성 |
| **Plan 3 — Media & Deploy** | 미작성 | 사진 첨부(Object Storage), OCI 배포, CI/CD, 백업 | 인터넷에서 접속되는 서비스 |
| **Plan 4 — Frontend** | 미작성 | Next.js PWA | 폰 홈화면에서 쓰는 앱 |

**계획은 앞 단계를 끝낸 뒤에 쓴다.** Plan 1을 구현하면서 알게 된 것이 Plan 2의 내용을 바꾼다. 미리 다 써두면 실제와 어긋난 문서를 따르게 된다.

프론트는 백엔드 Plan 3이 끝난 뒤 시작한다. 그 전까지 검증은 Swagger UI로 한다.

---

## 뒤집으면 안 되는 설계 결정

인터뷰로 확정된 것들이다. 코드만 보면 "왜 이렇게 복잡한가" 싶을 수 있으나 각각 이유가 있다. **바꿔야 할 근거가 생기면 먼저 사람에게 확인받는다.**

1. **Recipe(설계도) ↔ BrewLog(실행 기록)는 분리한다.** 같은 레시피를 여러 번 내렸을 때 결과 차이를 추적하는 것이 이 서비스의 존재 이유다. 합치자는 제안은 요구사항 위반이다.
2. **BrewLog는 레시피 값을 스냅샷으로 복사해 갖는다.** 레시피의 `dose_g`를 15g→16g로 수정해도 과거 기록은 15g으로 남아야 한다. FK 참조만으로 대체하면 과거가 조작된다.
3. **분쇄도 환산 결과는 언제나 "추정치"다.** 버 형상·입도 분포가 달라 정확한 등가 변환은 물리적으로 불가능하다. 확정값처럼 표시하면 안 된다.
4. **TDS 없이도 앱이 온전히 동작해야 한다.** 리프랙토미터가 없는 게 기본 상황이다. 추출 수율은 옵션 정보다.
5. **`users.role`과 JWT role claim은 MVP에 포함한다.** 관리자 API·화면은 후속이지만, 역할 컬럼을 나중에 넣으면 발급된 토큰이 전부 무효화되고 전체 인가 정책을 다시 훑어야 한다.
6. **마스터 데이터(품종·가공법·그라인더)는 FK로 정규화한다.** 문자열로 박으면 나중에 중복 병합이 불가능해진다.
7. **PostgreSQL을 쓴다.** Oracle 프리티어를 쓰면서도 Autonomous DB를 쓰지 않는 이유는 7일 유휴 자동 정지·90일 미사용 삭제 정책과 로컬 환경 불일치 때문이다.
8. **에스프레소는 MVP 제외.** 머신을 보유하지 않았다. `brew_method` enum에 자리만 확보한다.

---

## 배포 환경 제약

- **OCI Always Free ARM VM: 2 OCPU / 12GB** (인스턴스 생성 완료). 2026-06-15부로 한도가 4 OCPU/24GB에서 절반으로 축소됐다. 이 상한을 전제로 설계한다.
- OCI Object Storage 무료 10GB — 이미지 저장용.
- 프론트는 Vercel 무료 플랜.

---

## 명령어 요약

각 워크스페이스의 CLAUDE.md에 상세 내용이 있다. 자주 쓰는 것만:

```bash
# 로컬 DB 기동 (백엔드 작업 전 필수)
docker compose up -d
docker compose down

# 백엔드
cd backend && ./gradlew test          # 테스트
cd backend && ./gradlew bootRun       # 실행 (localhost:8080)

# 프론트
cd frontend && pnpm test              # 테스트
cd frontend && pnpm dev               # 실행 (localhost:3000)
```

---

## 에이전트에게

- **스펙 없이 계획을 쓰지 않고, 계획 없이 코드를 쓰지 않는다.** 사용자가 "이 기능 만들어줘"라고만 해도 스펙부터 쓰고 승인을 받는다.
- **인수 조건은 리터럴 값으로 쓴다.** 검증할 수 없는 조건을 쓰느니 "이 값을 정해달라"고 묻는다.
- **테스트에 AC ID를 남긴다.** 빠뜨리면 `check-spec-coverage.sh`가 CI에서 잡는다.
- **계획 문서의 태스크를 순서대로 실행한다.** 태스크는 각각 테스트가 초록인 상태로 끝나야 한다.
- **TDD를 지킨다.** 실패하는 테스트 → 실행해서 실패 확인 → 최소 구현 → 통과 확인 → 커밋.
- **검증 없이 "완료"라고 말하지 않는다.** 테스트를 실제로 실행하고 출력을 확인한 뒤 보고한다.
- 계획에 없는 리팩터링·기능 추가를 임의로 하지 않는다. 필요해 보이면 제안하고 확인받는다.
- 사람과의 대화는 한국어로 한다. 코드 식별자는 영어, 주석과 커밋 메시지는 한국어다.

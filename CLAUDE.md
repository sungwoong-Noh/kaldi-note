# kaldi note

커피 레시피를 재현 가능한 형태로 기록하고 공유하는 서비스. 푸어오버 레시피의 **푸어 스텝 시퀀스**를 구조화해 저장하고, 실제 추출 기록을 레시피와 분리해 누적하며, 서로 다른 그라인더 간 분쇄도를 환산한다.

> **현재 상태: 설계 완료, 구현 미착수.** 코드는 아직 없다. 구현을 시작하는 에이전트는 `docs/plans/`의 계획을 순서대로 실행한다.

---

## 저장소 구조

프론트엔드와 백엔드를 한 저장소에 두는 모노레포다. 배포 대상은 서로 다르다(백엔드 → OCI VM, 프론트 → Vercel).

```
kaldi-note/
├── CLAUDE.md                 ← 이 파일. 전체 개요와 문서 지도
├── backend/                  Spring Boot 4.1 API 서버
│   └── CLAUDE.md             ← 백엔드 작업 시 반드시 먼저 읽을 것
├── frontend/                 Next.js PWA
│   └── CLAUDE.md             ← 프론트 작업 시 반드시 먼저 읽을 것
├── docs/
│   ├── specs/                설계 문서 (무엇을 왜 만드는가)
│   │   └── 2026-08-14-kaldi-note-design.md
│   ├── plans/                구현 계획 (어떻게 만드는가, 태스크 단위)
│   │   └── 2026-08-14-plan1-foundation.md   ← 현재 유일하게 작성된 계획
│   │       (plan2~4는 앞 단계 완료 후 작성한다. 미리 쓰면 실제와 어긋난다)
│   └── conventions/          코딩 규칙
│       ├── git.md            커밋·브랜치·PR (프론트/백엔드 공통)
│       ├── backend.md        Java / Spring Boot
│       └── frontend.md       TypeScript / Next.js
├── docker-compose.yml        로컬 개발용 PostgreSQL
└── .github/workflows/        CI (백엔드/프론트 분리)
```

---

## 작업 시작 전 읽을 문서

| 하려는 일 | 읽을 문서 |
|---|---|
| 무엇이든 | 이 파일 → `docs/conventions/git.md` |
| 백엔드 코드 작성 | `backend/CLAUDE.md` → `docs/conventions/backend.md` |
| 프론트 코드 작성 | `frontend/CLAUDE.md` → `docs/conventions/frontend.md` |
| "왜 이런 구조인가" 판단이 필요할 때 | `docs/specs/2026-08-14-kaldi-note-design.md` |
| 다음에 뭘 만들지 | `docs/plans/` 의 해당 Plan 문서 |

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

- **계획 문서의 태스크를 순서대로 실행한다.** 태스크는 각각 테스트가 초록인 상태로 끝나야 한다.
- **TDD를 지킨다.** 실패하는 테스트 → 실행해서 실패 확인 → 최소 구현 → 통과 확인 → 커밋.
- **검증 없이 "완료"라고 말하지 않는다.** 테스트를 실제로 실행하고 출력을 확인한 뒤 보고한다.
- 계획에 없는 리팩터링·기능 추가를 임의로 하지 않는다. 필요해 보이면 제안하고 확인받는다.
- 사람과의 대화는 한국어로 한다. 코드 식별자는 영어, 주석과 커밋 메시지는 한국어다.

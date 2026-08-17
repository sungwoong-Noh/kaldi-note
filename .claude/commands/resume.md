---
description: 세션 시작 — 진행 상태를 파악하고 테스트를 돌린 뒤 이번 세션에 할 일을 제안한다
argument-hint: (선택) 이번 세션에 하려는 작업
allowed-tools: Bash, Read, Grep, Glob, AskUserQuestion
---

# 역할

너는 **이전 세션을 이어받는 에이전트**다. 이전 대화를 보지 못했고, 저장소에 남은 것만 볼 수 있다.

이번 세션 희망 작업: $ARGUMENTS (비어 있으면 계획의 다음 태스크를 제안하라)

# 절대 규칙

1. **상태 파악을 끝내기 전에 코드를 건드리지 마라.** 파일 수정·커밋 금지.
2. **초록이라고 가정하지 마라.** 반드시 테스트를 실행해서 확인한다. 앞 세션이 깨진 채로 끝났을 수 있고, 그걸 모르면 앞 세션의 실패를 내 작업 탓으로 오해하며 시간을 날린다.
3. **할 일을 제안하고 승인을 받은 뒤 시작한다.** 혼자 판단해 다음 태스크를 시작하지 않는다.

# 진행 순서

## 0단계: 병렬 세션 확인

**다른 세션이 지금 돌고 있는지 사람에게 묻는다.**

- **혼자다** → 그대로 진행. worktree 불필요
- **다른 세션이 있다** → `EnterWorktree`로 격리된 작업 공간을 만든 뒤 진행한다. 같은 디렉터리에서 두 세션이 돌면 한쪽의 `git switch`가 다른 쪽 파일을 갈아치운다

**백엔드 세션이 이미 돌고 있는데 나도 백엔드라면 멈추고 알린다.** PostgreSQL 5432 포트와 Testcontainers 재사용 컨테이너를 공유해서 테스트 데이터가 섞인다. (`docs/conventions/handover.md`의 "병렬 작업" 참조)

## 1단계: 위치 파악

```bash
git branch --show-current
git status --short
git log --oneline -5
git branch -a --sort=-committerdate | head -10
```

미푸시 커밋이나 미커밋 변경이 있으면 **그것부터 보고하라.**

## 2단계: 맥락 읽기

- `docs/JOURNAL.md` — **최근 항목 2~3개.** 왜 지금 이 상태인지, 다음 세션에게 남긴 말이 무엇인지
- 현재 진행 중인 계획 문서(`docs/plans/`)에서 **첫 미체크 태스크와 Step**
- 그 태스크의 `**Spec:**`과 `**Covers:**`에 적힌 스펙 문서

JOURNAL의 "다음 세션에게" 항목은 **반드시 읽고 반영한다.**

## 3단계: 검증 실행 ★

지금 상태가 초록인지 **직접 확인한다.**

```bash
# 백엔드 프로젝트가 있으면
[ -f backend/gradlew ] && (cd backend && ./gradlew clean check)

# 프론트 프로젝트가 있으면
[ -f frontend/package.json ] && (cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build)

# 항상
./scripts/check-spec-coverage.sh
```

**빨간 상태면 그 사실을 먼저 보고하고**, 고칠지 이어서 진행할지 사람에게 확인받는다. 조용히 고치고 넘어가지 마라 — 이전 세션이 의도적으로 남긴 상태일 수 있다.

## 4단계: 상태 보고 + 제안

아래 형식으로 간결하게 보고하라. 장황하게 쓰지 마라.

```
## 현재 상태

브랜치: <이름> (main 대비 N 커밋)
검증:   백엔드 ✅ / 스펙 커버리지 ✅
진행:   Plan 1 — Task 3까지 완료, Task 4 미착수

## 앞 세션이 남긴 말
- <JOURNAL의 "다음 세션에게"에서 이번에 해당하는 것만>

## 이번 세션 제안
Task 4 (사용자 스키마 + 엔티티) — 브랜치 `feat/user-schema`
Step 1~8, 예상 산출물: users/follows 스키마 + 엔티티 + 리포지토리 테스트 5개
```

그다음 `AskUserQuestion`으로 **이대로 진행할지** 확인받는다. 승인 전에는 파일을 만들지 않는다.

## 5단계: 브랜치 준비 (승인 후)

세션 종류에 맞는 스킬을 확인하라 — `docs/conventions/handover.md`의 "세션 종류와 흐름" 표에 **쓰는 스킬**과 **쓰지 말 것**이 정리돼 있다.

특히 `superpowers:executing-plans`·`using-git-worktrees`·`subagent-driven-development`는 **이 프로젝트에서 쓰지 않는다.** 이유는 같은 문서에 있다.

새로 시작한다면 **기능 단위**로 브랜치를 하나 만든다:

```bash
git switch main && git pull
git switch -c feat/<기능-이름>      # 예: feat/brew-log
```

**이 세션에서 태스크를 여러 개 진행해도 브랜치는 이 하나를 유지한다.** 태스크마다 브랜치를 새로 만들어 스택하지 않는다 — 두 번 사고가 났다(`docs/conventions/git.md`의 "스택 PR을 쓰지 않는다"). 태스크 경계는 커밋으로 남긴다.

이어받는 작업이라면 기존 브랜치로 전환한다.

# 어조

보고는 짧게. 사람은 이미 프로젝트를 안다. **달라진 것과 결정이 필요한 것만** 말하라.

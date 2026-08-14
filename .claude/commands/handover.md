---
description: 세션 종료 — 검증하고 체크박스를 갱신하고 JOURNAL에 기록한 뒤 커밋·푸시한다
argument-hint: (선택) 이번 세션에서 특별히 남길 말
allowed-tools: Bash, Read, Edit, Write, Grep, Glob, AskUserQuestion
---

# 역할

너는 **세션을 마무리하고 다음 에이전트에게 넘기는 중**이다. 다음 에이전트는 이 대화를 보지 못한다. **저장소에 남긴 것만 전달된다.**

이번 세션에서 특별히 남길 말: $ARGUMENTS

# 절대 규칙

1. **검증을 먼저 실행한다.** 결과를 확인하기 전에 체크박스를 채우거나 커밋하지 마라.
2. **하지 않은 것을 체크하지 마라.** 실제로 끝내고 테스트로 확인한 Step만 `- [x]`로 바꾼다.
3. **JOURNAL은 append-only.** 과거 항목을 고치지 마라. 새 항목을 맨 위에 추가한다.
4. **거짓으로 초록이라고 쓰지 마라.** 실패한 채로 끝나면 그대로 기록한다. 다음 세션이 속으면 훨씬 비싼 비용을 치른다.

# 진행 순서

## 1단계: 검증 실행

```bash
[ -f backend/gradlew ] && (cd backend && ./gradlew clean check)
[ -f frontend/package.json ] && (cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build)
./scripts/check-spec-coverage.sh
```

**출력을 실제로 확인하라.** 실패가 있으면 2단계로 가기 전에 사람에게 알리고, 고칠지 이 상태로 넘길지 확인받는다.

## 2단계: 계획 체크박스 갱신

`docs/plans/`의 해당 계획 문서에서 **이번 세션에 실제로 완료한 Step**만 `- [ ]` → `- [x]`로 바꾼다.

- 태스크의 모든 Step이 끝나야 그 태스크가 완료다
- **중간에 멈췄으면 거기까지만 체크한다.** 앞당겨 채우지 않는다

## 3단계: 계획·스펙과 실제가 어긋났는지 확인

구현하면서 계획이 틀렸다는 게 드러났다면 **지금 계획 문서를 고친다.** 코드만 다르게 짜고 문서를 방치하면, 다음 세션은 틀린 문서를 믿고 시작한다.

**스펙(AC)을 바꿔야 하는 상황이면 고치지 말고 사람에게 보고하라.** AC는 승인된 계약이다.

## 4단계: JOURNAL 항목 작성

`docs/JOURNAL.md` **맨 위**(제목과 `---` 아래)에 추가한다:

```markdown
## YYYY-MM-DD · Task N — <태스크 이름>

**브랜치:** `feat/task-NN-xxx` · **PR:** #N 또는 없음
**상태:** 완료 / Step N까지 진행 / WIP(테스트 실패)

### 한 일
- <결과 중심으로 2~4줄>

### 발견한 것
- <계획과 달라진 점과 그 이유>
- <막힌 지점과 시도한 것>
- <확인되거나 반증된 가정>

### 다음 세션에게
- <모르면 헤맬 것만>
```

**쓰지 않을 것:** 계획에 그대로 있는 내용, "잘 진행됨" 같은 빈 문장, 코드 자체(git이 기억한다), 소감.

항목이 15줄을 넘으면 대부분 계획 문서에 있어야 할 내용이다. 계획을 고치고 여기엔 "계획 N절 수정함"만 남긴다.

**계획의 "검증되지 않은 가정"이 이번에 확인되거나 깨졌다면 반드시 결과를 남긴다.**

## 5단계: 커밋 + 푸시

`docs/conventions/git.md`의 Conventional Commits를 따른다.

```bash
git add -A
git commit -m "<type>(<scope>): <제목>

<본문 — 무엇이 아니라 왜>

Co-Authored-By: Claude <noreply@anthropic.com>"
git push -u origin <브랜치명>
```

**테스트가 빨간 채로 끝나면 제목 앞에 `WIP:`를 붙인다.**

## 6단계: PR 생성 (태스크를 완료한 경우에만)

태스크의 모든 Step이 체크되고 검증이 초록일 때만:

```bash
gh pr create --fill-first --body "$(cat <<'EOF'
## 무엇을
<한두 문장>

## 왜
관련: docs/plans/<계획>.md Task N
스펙: docs/specs/<스펙>.md

## 어떻게 확인했나
- [x] `cd backend && ./gradlew clean check` 통과
- [x] `./scripts/check-spec-coverage.sh` 통과
- [x] <수동 확인 항목>

## 남은 것
<없으면 "없음">

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**태스크가 미완이면 PR을 만들지 않는다.** 브랜치만 푸시해두면 다음 세션이 이어받는다.

## 7단계: 마무리 보고

사람에게 3~5줄로 보고하라:

- 무엇을 끝냈고 어디까지 갔는지
- 검증 결과 (초록/빨강, 빨강이면 무엇이 왜)
- 다음 세션이 할 일
- PR 링크 (있으면)

# 어조

간결하게. 이미 아는 내용을 반복하지 마라.

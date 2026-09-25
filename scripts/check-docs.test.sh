#!/usr/bin/env bash
# check-docs.sh의 여섯 검사 각각이 실제로 잡는지/놓아주는지 확인한다.
#
# 각 시나리오는 독립된 임시 디렉터리 하나를 쓴다 — 관심 없는 검사는 전부
# 트리비얼하게 통과하도록 최소 픽스처를 채워, 딱 하나의 실패/통과만 본다.
#
# set -e를 쓰지 않는 이유: 검사가 실패해도 나머지를 계속 돌려 전체 그림을 봐야 한다.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/check-docs.sh"

failed=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✓ $name"
  else
    echo "  ✗ $name"
    echo "      기대: $expected"
    echo "      실제: $actual"
    failed=1
  fi
}

# 공통: 관심 없는 검사를 트리비얼하게 통과시키는 최소 픽스처 하나를 만든다.
new_fixture() {
  local dir
  dir="$(mktemp -d)"
  mkdir -p "$dir/specs" "$dir/empty"
  printf '# 로드맵\n\n### M1 · 레시피 서랍\n' >"$dir/ROADMAP.md"
  printf '# CLAUDE\n' >"$dir/CLAUDE.md"
  printf '# GOTCHAS\n' >"$dir/GOTCHAS.md"
  echo "$dir"
}

run() {
  # $1=fixture dir, 나머지는 env 오버라이드 없이 기본값(위 new_fixture 결과) 사용
  local dir="$1"
  ROADMAP="$dir/ROADMAP.md" \
    SPEC_DIR="$dir/specs" \
    CLAUDE_MD="$dir/CLAUDE.md" \
    GOTCHAS_MD="$dir/GOTCHAS.md" \
    LINK_CHECK_ROOT="$dir/empty" \
    "$SCRIPT" 2>&1
}

# ── 1) milestone이 ROADMAP에 없으면 실패 ────────────────────────────────
DIR=$(new_fixture)
cat >"$DIR/specs/a.md" <<'EOF'
---
id: A
title: a
status: 초안
milestone: M9
---
EOF
out=$(run "$DIR")
rc=$?
check "1a · 없는 milestone이면 실패" "1" "$rc"
check "1a · 메시지에 M9가 있다" "1" "$(echo "$out" | grep -c "milestone 'M9'")"
rm -rf "$DIR"

DIR=$(new_fixture)
cat >"$DIR/specs/a.md" <<'EOF'
---
id: A
title: a
status: 초안
milestone: M1
---
EOF
out=$(run "$DIR")
rc=$?
check "1b · 있는 milestone이면 통과" "0" "$rc"
rm -rf "$DIR"

# ── 2) supersedes 대상이 대체됨이 아니면 실패 ───────────────────────────
DIR=$(new_fixture)
cat >"$DIR/specs/old.md" <<'EOF'
---
id: OLD
title: old
status: 승인
---
EOF
cat >"$DIR/specs/new.md" <<EOF
---
id: NEW
title: new
status: 초안
supersedes: $DIR/specs/old.md
---
EOF
out=$(run "$DIR")
rc=$?
check "2a · 대체됨이 아니면 실패" "1" "$rc"
rm -rf "$DIR"

DIR=$(new_fixture)
cat >"$DIR/specs/old.md" <<'EOF'
---
id: OLD
title: old
status: 대체됨
---
EOF
cat >"$DIR/specs/new.md" <<EOF
---
id: NEW
title: new
status: 초안
supersedes: $DIR/specs/old.md
---
EOF
out=$(run "$DIR")
rc=$?
check "2b · 대체됨이면 통과" "0" "$rc"
rm -rf "$DIR"

# ── 3) CLAUDE.md 150줄 상한 ──────────────────────────────────────────
DIR=$(new_fixture)
yes "x" | head -151 >"$DIR/CLAUDE.md"
out=$(run "$DIR")
rc=$?
check "3a · 151줄이면 실패" "1" "$rc"
rm -rf "$DIR"

DIR=$(new_fixture)
yes "x" | head -150 >"$DIR/CLAUDE.md"
out=$(run "$DIR")
rc=$?
check "3b · 150줄이면 통과" "0" "$rc"
rm -rf "$DIR"

# ── 4) GOTCHAS.md 100줄 상한 ─────────────────────────────────────────
DIR=$(new_fixture)
yes "x" | head -101 >"$DIR/GOTCHAS.md"
out=$(run "$DIR")
rc=$?
check "4 · 101줄이면 실패" "1" "$rc"
rm -rf "$DIR"

# ── 5) 상대 링크 — 깨진 것만 잡고 펜스 안은 건너뛴다 ────────────────────
DIR=$(new_fixture)
mkdir -p "$DIR/linkroot"
cat >"$DIR/linkroot/a.md" <<'EOF'
[깨진 링크](missing.md)

```markdown
[펜스 안의 가짜 링크](also-missing.md)
```
EOF
ROADMAP="$DIR/ROADMAP.md" SPEC_DIR="$DIR/specs" CLAUDE_MD="$DIR/CLAUDE.md" \
  GOTCHAS_MD="$DIR/GOTCHAS.md" LINK_CHECK_ROOT="$DIR/linkroot" \
  "$SCRIPT" >/tmp/check-docs-link-test.out 2>&1
rc=$?
check "5a · 깨진 링크가 있으면 실패" "1" "$rc"
check "5b · 펜스 밖 깨진 링크 1개만 센다(펜스 안은 제외)" "1" \
  "$(grep -c 'missing.md' /tmp/check-docs-link-test.out)"
rm -f /tmp/check-docs-link-test.out
rm -rf "$DIR"

# ── 6) 구현완료 + 구현 순서 잔존 — 경고만, 실패 아님 ────────────────────
DIR=$(new_fixture)
cat >"$DIR/specs/done.md" <<'EOF'
---
id: DONE
title: done
status: 구현완료
---

#### AC-DONE-01 · 하나

## 구현 순서

- [x] Task 1
EOF
out=$(run "$DIR")
rc=$?
check "6a · 경고가 있어도 exit 0" "0" "$rc"
check "6b · 경고 문구가 찍힌다" "1" "$(echo "$out" | grep -c '△')"
rm -rf "$DIR"

echo
if [ "$failed" -eq 0 ]; then
  echo "전부 통과"
else
  echo "실패가 있습니다"
fi
exit "$failed"

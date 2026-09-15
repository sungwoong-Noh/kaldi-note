#!/usr/bin/env bash
# check-spec-coverage.sh의 AC 집계 로직 검증 — docs/specs/2026-09-15-readability.md
#
# 임시 스펙 디렉터리를 만들어 스크립트를 돌린다. infra/scripts/deploy.test.sh와 같은
# 방식이고 순수 bash라 새 의존성이 없다.
#
# set -e를 쓰지 않는 이유: 검사가 실패해도 나머지를 계속 돌려 전체 그림을 봐야 한다.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/check-spec-coverage.sh"

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

# ── AC-READ-19 · 자기 접두어의 AC만 센다 ────────────────────────────────
#
# 스펙이 갱신 대상 기존 AC를 본문에 언급하는 일이 있다. 그것까지 이 스펙의 AC로
# 세면 전체 집계가 부풀려진다.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/specs"

cat > "$TMP/specs/2099-01-01-fixture.md" <<'SPEC'
---
id: FOO
title: 픽스처
status: 초안
---
#### AC-FOO-01 · 하나
#### AC-FOO-02 · 둘
갱신 대상: AC-BAR-99 는 이 스펙 것이 아니다.
SPEC

out=$(SPEC_DIR="$TMP/specs" "$SCRIPT" 2>&1)
count=$(echo "$out" | grep -oE 'AC [0-9]+개' | grep -oE '[0-9]+' | head -1)
check "AC-READ-19 · AC-BAR-99를 세지 않는다" "2" "$count"

# ── AC-READ-20 · 합계가 헤딩 총합과 같다 ────────────────────────────────
#
# 숫자를 박지 않는다. 박으면 스펙을 하나 추가할 때마다 이 조건이 깨지고, 그때마다 승인된
# AC를 고쳐야 한다. 대신 같은 값을 독립적으로 두 번 세어 대조한다.
#
# 스크립트가 본문 언급까지 다시 세기 시작하면 왼쪽이 커져 어긋난다. 그것이 이 조건이
# 잡으려는 회귀다 — 헤딩으로 좁히기 전 합계는 747이었고 실제 소유분은 739였다.
real=$("$SCRIPT" 2>&1)
total=$(echo "$real" | grep -oE '인수 조건 [0-9]+개' | grep -oE '[0-9]+')

expected=0
for spec in "$HERE/../docs/specs"/2*.md; do
  status=$(grep -m1 '^status:' "$spec" | sed 's/^status:[[:space:]]*//' | tr -d '\r')
  [ "$status" = "구현완료" ] || continue
  n=$(grep -cE '^#### AC-[A-Z][A-Z0-9_]*-[0-9]+' "$spec" || true)
  expected=$((expected + n))
done

check "AC-READ-20 · 합계가 헤딩 총합과 같다" "$expected" "$total"

echo
if [ "$failed" -eq 0 ]; then
  echo "전부 통과"
else
  echo "실패가 있습니다"
fi
exit "$failed"

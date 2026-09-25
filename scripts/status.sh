#!/usr/bin/env bash
#
# 지금 상태를 계산해서 보여준다. 아무것도 저장하지 않는다 — 실행할 때마다 다시 센다.
#
#   1. 마일스톤별 스펙 status·AC 수 (docs/ROADMAP.md + docs/specs/)
#   2. 열린 이슈 요약 (gh, 마일스톤·갈래별)
#   3. 진행 중인 로컬 브랜치 (origin/main 대비)
#
# 사용법: ./scripts/status.sh
# SessionStart 훅과 /resume이 이 스크립트를 부른다 — 상세는 docs/conventions/workflow.md.

set -uo pipefail

cd "$(dirname "$0")/.."

SPEC_DIR="docs/specs"
ROADMAP="docs/ROADMAP.md"
AC_PATTERN='AC-[A-Z][A-Z0-9_]*-[0-9]+[a-z]?'

echo "════════════════════════════════════════"
echo " 1. 마일스톤별 스펙"
echo "════════════════════════════════════════"

# bash 3.2(macOS 기본) 호환 — 연관 배열을 쓰지 않는다. 스펙 수가 적어 마일스톤마다
# docs/specs/를 다시 훑어도 비용이 무시할 만하다.
milestones=""
if [ -f "$ROADMAP" ]; then
  milestones=$(grep -oE '^### (M[0-9]+) ·' "$ROADMAP" | sed -E 's/^### (M[0-9]+) ·/\1/')
else
  echo "로드맵이 없습니다: $ROADMAP"
fi

spec_line() {
  # $1 = 스펙 파일 경로. milestone·status·title·AC 수를 한 줄로 찍는다.
  local spec="$1"
  local status milestone title ac_count
  status=$(grep -m1 '^status:' "$spec" 2>/dev/null | sed 's/^status:[[:space:]]*//' | tr -d '\r')
  [ -z "$status" ] && status="(미지정)"
  milestone=$(grep -m1 '^milestone:' "$spec" 2>/dev/null | sed 's/^milestone:[[:space:]]*//' | tr -d '\r')
  title=$(grep -m1 '^title:' "$spec" 2>/dev/null | sed 's/^title:[[:space:]]*//' | tr -d '\r')
  ac_count=$(grep -cE "^#### $AC_PATTERN" "$spec" 2>/dev/null || true)
  echo "$milestone|  [$status] $(basename "$spec") — $title (AC ${ac_count}개)"
}

if [ -d "$SPEC_DIR" ]; then
  for m in $milestones; do
    echo
    echo "-- $m --"
    found=0
    for spec in "$SPEC_DIR"/*.md; do
      [ -e "$spec" ] || continue
      case "$(basename "$spec")" in
        TEMPLATE.md | README.md) continue ;;
      esac
      entry=$(spec_line "$spec")
      if [ "${entry%%|*}" = "$m" ]; then
        echo "${entry#*|}"
        found=1
      fi
    done
    [ "$found" -eq 0 ] && echo "  (스펙 없음)"
  done

  echo
  echo "-- 상시 트랙 (milestone 미지정) --"
  found=0
  for spec in "$SPEC_DIR"/*.md; do
    [ -e "$spec" ] || continue
    case "$(basename "$spec")" in
      TEMPLATE.md | README.md) continue ;;
    esac
    entry=$(spec_line "$spec")
    if [ -z "${entry%%|*}" ]; then
      echo "${entry#*|}"
      found=1
    fi
  done
  [ "$found" -eq 0 ] && echo "  (없음)"
fi

echo
echo "════════════════════════════════════════"
echo " 2. 열린 이슈"
echo "════════════════════════════════════════"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI가 없어 건너뜁니다."
else
  total=$(gh issue list --state open --limit 200 --json number -q '. | length' 2>/dev/null || echo "?")
  echo "열린 이슈 총 ${total}건"
  for m in ${milestones:-}; do
    count=$(gh issue list --state open --milestone "$m" --limit 200 --json number -q '. | length' 2>/dev/null || echo 0)
    [ "$count" = "0" ] && continue
    echo "  $m: ${count}건"
    gh issue list --state open --milestone "$m" --limit 200 \
      --json number,title,labels -q '.[] | "    #\(.number) \(.title) [\((.labels // []) | map(.name) | join(","))]"' 2>/dev/null
  done
fi

echo
echo "════════════════════════════════════════"
echo " 3. 진행 중인 브랜치 (origin/main 대비)"
echo "════════════════════════════════════════"

current=$(git branch --show-current)
listed=0
for b in $(git for-each-ref --format='%(refname:short)' refs/heads/ | grep -v '^main$'); do
  ahead=$(git rev-list --count "origin/main..$b" 2>/dev/null || echo 0)
  # origin/main에 이미 다 들어간(ahead=0) 브랜치는 머지 후 안 지운 잔재다 — "진행 중"이 아니다.
  [ "$ahead" = "0" ] && continue
  behind=$(git rev-list --count "$b..origin/main" 2>/dev/null || echo "?")
  marker=""
  [ "$b" = "$current" ] && marker=" (지금 여기)"
  echo "  $b — origin/main보다 ${ahead}커밋 앞, ${behind}커밋 뒤${marker}"
  listed=1
done
[ "$listed" -eq 0 ] && echo "  (없음)"

exit 0

#!/usr/bin/env bash
#
# 스펙의 인수 조건(AC)이 실제 테스트에 존재하는지 검사한다.
#
#   docs/specs/*.md 에서 AC-XXX-NN 형태의 ID를 뽑아
#   backend/src/test/ 와 frontend/src/ 에서 찾는다.
#
# 스펙 frontmatter의 status에 따라 검사 강도가 다르다:
#   초안 / 승인  → 건너뜀
#   구현중       → 경고만 (통과)
#   구현완료     → 누락 시 실패
#
# 사용법: ./scripts/check-spec-coverage.sh
# 규칙:   docs/conventions/workflow.md

set -euo pipefail

cd "$(dirname "$0")/.."

SPEC_DIR="docs/specs"
AC_PATTERN='AC-[A-Z][A-Z0-9_]*-[0-9]+'

# 테스트 코드가 있을 수 있는 경로 중 실제로 존재하는 것만 모은다
SEARCH_PATHS=()
for path in backend/src/test frontend/src; do
  [ -d "$path" ] && SEARCH_PATHS+=("$path")
done

failed=0
total_ac=0
missing_ac=0
checked_specs=0

if [ ! -d "$SPEC_DIR" ]; then
  echo "스펙 디렉터리가 없습니다: $SPEC_DIR"
  exit 0
fi

for spec in "$SPEC_DIR"/*.md; do
  [ -e "$spec" ] || continue
  case "$(basename "$spec")" in
    TEMPLATE.md) continue ;;
  esac

  status=$(grep -m1 '^status:' "$spec" 2>/dev/null | sed 's/^status:[[:space:]]*//' | tr -d '\r' || true)
  [ -z "$status" ] && status="(미지정)"

  ids=$(grep -oE "$AC_PATTERN" "$spec" 2>/dev/null | sort -u || true)

  if [ -z "$ids" ]; then
    case "$status" in
      구현중|구현완료)
        echo "✗ $spec [$status]"
        echo "    인수 조건이 하나도 없습니다. 스펙은 AC를 반드시 포함해야 합니다."
        failed=1
        ;;
      *)
        echo "- $spec [$status] — AC 없음, 건너뜀"
        ;;
    esac
    continue
  fi

  count=$(echo "$ids" | wc -l | tr -d ' ')

  case "$status" in
    초안|승인|"(미지정)")
      echo "- $spec [$status] — AC ${count}개, 아직 구현 단계가 아니므로 건너뜀"
      continue
      ;;
  esac

  checked_specs=$((checked_specs + 1))
  missing=""

  for id in $ids; do
    total_ac=$((total_ac + 1))
    found=0
    if [ ${#SEARCH_PATHS[@]} -gt 0 ]; then
      if grep -rqF "$id" "${SEARCH_PATHS[@]}" 2>/dev/null; then
        found=1
      fi
    fi
    if [ "$found" -eq 0 ]; then
      missing="${missing}${id}"$'\n'
      missing_ac=$((missing_ac + 1))
    fi
  done

  if [ -z "$missing" ]; then
    echo "✓ $spec [$status] — AC ${count}개 전부 테스트에 존재"
  else
    missing_count=$(echo "$missing" | grep -c . || true)
    case "$status" in
      구현완료)
        echo "✗ $spec [$status] — AC ${count}개 중 ${missing_count}개가 테스트에 없습니다"
        echo "$missing" | grep . | sed 's/^/    누락: /'
        failed=1
        ;;
      구현중)
        echo "△ $spec [$status] — AC ${count}개 중 ${missing_count}개 미구현 (구현중이므로 통과)"
        echo "$missing" | grep . | sed 's/^/    미구현: /'
        ;;
    esac
  fi
done

echo
if [ ${#SEARCH_PATHS[@]} -eq 0 ]; then
  echo "참고: 테스트 디렉터리가 아직 없습니다 (backend/src/test, frontend/src)."
fi

if [ "$failed" -ne 0 ]; then
  echo "실패: 구현완료 스펙의 인수 조건 ${missing_ac}개가 테스트에서 발견되지 않았습니다."
  echo
  echo "테스트에 AC ID를 남기세요. 이것이 스펙과 코드를 잇는 유일한 끈입니다."
  echo '  Java: @DisplayName("AC-GRIND-01 · C40 22클릭은 660마이크론이다")'
  echo "  TS:   it('AC-GRIND-08 · 환산 결과에 추정치 배지가 표시된다', ...)"
  exit 1
fi

if [ "$checked_specs" -eq 0 ]; then
  echo "검사 대상 스펙 없음 (구현중·구현완료 상태인 스펙이 없습니다)."
else
  echo "통과: 스펙 ${checked_specs}건, 인수 조건 ${total_ac}개 확인."
fi

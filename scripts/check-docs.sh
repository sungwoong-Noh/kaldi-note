#!/usr/bin/env bash
#
# 문서가 스스로 정한 규칙을 지키는지 기계적으로 검사한다.
#
#   1. 스펙 frontmatter의 milestone이 docs/ROADMAP.md에 실제로 있는 마일스톤인가
#   2. 스펙 frontmatter의 supersedes가 가리키는 대상이 status: 대체됨으로 표시돼 있는가
#   3. 루트 CLAUDE.md ≤150줄
#   4. docs/GOTCHAS.md ≤100줄
#   5. 문서 안 상대 링크가 실제로 존재하는 파일을 가리키는가
#   6. status: 구현완료인 스펙에 「구현 순서」 절이 남아 있으면 경고(실패 아님)
#
# 1·2·3·4·5는 실패하면 exit 1. 6은 경고만 찍고 통과시킨다.
#
# 사용법: ./scripts/check-docs.sh
# 규칙:   docs/conventions/workflow.md

set -uo pipefail

cd "$(dirname "$0")/.."

# 테스트가 임시 디렉터리를 가리킬 수 있게 전부 환경변수로 열어 둔다. 기본값은 저장소의 실제 경로다.
ROADMAP="${ROADMAP:-docs/ROADMAP.md}"
SPEC_DIR="${SPEC_DIR:-docs/specs}"
CLAUDE_MD="${CLAUDE_MD:-CLAUDE.md}"
GOTCHAS_MD="${GOTCHAS_MD:-docs/GOTCHAS.md}"
LINK_CHECK_ROOT="${LINK_CHECK_ROOT:-.}"
LINK_CHECK_EXCLUDE="${LINK_CHECK_EXCLUDE:-./docs/archive}"
failed=0

echo "1) 스펙 milestone이 ROADMAP에 있는가"
roadmap_milestones=""
if [ -f "$ROADMAP" ]; then
  roadmap_milestones=$(grep -oE '^### (M[0-9]+) ·' "$ROADMAP" | sed -E 's/^### (M[0-9]+) ·/\1/')
fi
checked=0
for spec in "$SPEC_DIR"/*.md; do
  [ -e "$spec" ] || continue
  case "$(basename "$spec")" in TEMPLATE.md | README.md) continue ;; esac
  milestone=$(grep -m1 '^milestone:' "$spec" 2>/dev/null | sed 's/^milestone:[[:space:]]*//' | tr -d '\r')
  [ -z "$milestone" ] && continue
  checked=1
  found=0
  for m in $roadmap_milestones; do
    [ "$m" = "$milestone" ] && found=1
  done
  if [ "$found" -eq 0 ]; then
    echo "  ✗ $spec — milestone '$milestone'이 ${ROADMAP}에 없다"
    failed=1
  fi
done
[ "$failed" -eq 0 ] && [ "$checked" -eq 1 ] && echo "  통과"
[ "$checked" -eq 0 ] && echo "  (milestone을 쓴 스펙 없음 — 건너뜀)"

echo
echo "2) supersedes 대상이 대체됨으로 표시돼 있는가"
checked=0
for spec in "$SPEC_DIR"/*.md; do
  [ -e "$spec" ] || continue
  case "$(basename "$spec")" in TEMPLATE.md | README.md) continue ;; esac
  target=$(grep -m1 '^supersedes:' "$spec" 2>/dev/null | sed 's/^supersedes:[[:space:]]*//' | tr -d '\r')
  [ -z "$target" ] && continue
  checked=1
  if [ ! -f "$target" ]; then
    echo "  ✗ $spec — supersedes 대상 '$target'이 존재하지 않는다"
    failed=1
    continue
  fi
  target_status=$(grep -m1 '^status:' "$target" 2>/dev/null | sed 's/^status:[[:space:]]*//' | tr -d '\r')
  if [ "$target_status" != "대체됨" ]; then
    echo "  ✗ $target — ${spec}가 supersedes로 가리키는데 status가 '대체됨'이 아니다(현재: ${target_status:-없음})"
    failed=1
  fi
done
[ "$failed" -eq 0 ] && [ "$checked" -eq 1 ] && echo "  통과"
[ "$checked" -eq 0 ] && echo "  (supersedes를 쓴 스펙 없음 — 건너뜀)"

echo
echo "3) CLAUDE.md ≤150줄"
if [ -f "$CLAUDE_MD" ]; then
  claude_lines=$(wc -l <"$CLAUDE_MD" | tr -d ' ')
  if [ "$claude_lines" -gt 150 ]; then
    echo "  ✗ ${CLAUDE_MD}가 ${claude_lines}줄이다 (150줄 상한)"
    failed=1
  else
    echo "  통과 (${claude_lines}줄)"
  fi
else
  echo "  ✗ ${CLAUDE_MD}가 없다"
  failed=1
fi

echo
echo "4) GOTCHAS.md ≤100줄"
if [ -f "$GOTCHAS_MD" ]; then
  gotchas_lines=$(wc -l <"$GOTCHAS_MD" | tr -d ' ')
  if [ "$gotchas_lines" -gt 100 ]; then
    echo "  ✗ ${GOTCHAS_MD}가 ${gotchas_lines}줄이다 (100줄 상한)"
    failed=1
  else
    echo "  통과 (${gotchas_lines}줄)"
  fi
else
  echo "  ($GOTCHAS_MD 없음 — 건너뜀)"
fi

echo
echo "5) 문서 안 상대 링크가 실제 파일을 가리키는가"
broken=0
checked_links=0
# docs/archive/는 역할이 끝난 동결 기록이라 링크가 깨져도 고치지 않는다(문서 수명표 참조).
md_files=$(find "$LINK_CHECK_ROOT" -name '*.md' \
  -not -path "$LINK_CHECK_EXCLUDE/*" \
  -not -path '*/node_modules/*' \
  -not -path '*/build/*' \
  -not -path '*/.next/*' \
  -not -path '*/.git/*')

for file in $md_files; do
  dir=$(dirname "$file")
  # 펜스(```  ~~~) 안의 코드 예시는 건너뛴다 — 예시 경로가 실재할 필요는 없다.
  while IFS=: read -r lineno target; do
    [ -z "$target" ] && continue
    # 제목이 붙은 링크 `(path "title")`는 공백 앞부분만 경로로 본다
    target="${target%% *}"
    case "$target" in
      http://* | https://* | mailto:* | '#'*) continue ;;
    esac
    target="${target%%#*}" # 앵커 제거
    [ -z "$target" ] && continue
    checked_links=$((checked_links + 1))
    case "$target" in
      /*) resolved="${LINK_CHECK_ROOT}${target}" ;; # 저장소 루트 기준 절대 경로
      *) resolved="$dir/$target" ;;
    esac
    if [ ! -e "$resolved" ]; then
      echo "  ✗ $file:$lineno → $target (풀린 경로: $resolved)"
      broken=$((broken + 1))
    fi
  done < <(awk '
    /^```/ || /^~~~/ { fence = !fence; next }
    fence { next }
    {
      line = $0
      while (match(line, /\]\([^)]+\)/)) {
        print NR ":" substr(line, RSTART + 2, RLENGTH - 3)
        line = substr(line, RSTART + RLENGTH)
      }
    }
  ' "$file")
done

if [ "$broken" -gt 0 ]; then
  echo "  ✗ 상대 링크 ${broken}개 깨짐 (검사한 링크 ${checked_links}개 중)"
  failed=1
else
  echo "  통과 (링크 ${checked_links}개)"
fi

echo
echo "6) 구현완료 스펙에 「구현 순서」 잔존 (경고만)"
warned=0
for spec in "$SPEC_DIR"/*.md; do
  [ -e "$spec" ] || continue
  case "$(basename "$spec")" in TEMPLATE.md | README.md) continue ;; esac
  status=$(grep -m1 '^status:' "$spec" 2>/dev/null | sed 's/^status:[[:space:]]*//' | tr -d '\r')
  [ "$status" = "구현완료" ] || continue
  if grep -qE '^## 구현 순서' "$spec"; then
    echo "  △ $spec — status: 구현완료인데 「구현 순서」 절이 남아 있다. 지워도 된다"
    warned=$((warned + 1))
  fi
done
[ "$warned" -eq 0 ] && echo "  통과"

echo
if [ "$failed" -ne 0 ]; then
  echo "실패: 위 ✗ 항목을 고치세요."
  exit 1
fi
echo "통과."
exit 0

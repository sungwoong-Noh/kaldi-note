#!/usr/bin/env bash
# deploy.sh의 헬스 대기 로직 검증 — docs/specs/2026-09-05-build-info.md
#
# deploy.sh를 source해 함수만 부른다. curl과 sleep을 가짜로 덮어
# 「구 컨테이너가 아직 떠 있는 상황」을 재현한다. 새 의존성은 없다.
#
# set -e를 쓰지 않는 이유: wait_healthy가 1을 돌려줄 때 테스트 셸이 즉시 죽는다.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KALDI_DEPLOY_TEST=1 source "$HERE/deploy.sh"

# ★ source한 deploy.sh가 자기 set -e를 이 셸에 켜 놓는다. 끄지 않으면 wait_healthy가
# 1을 돌려주는 순간(AC-07·09) 테스트 셸이 그 자리에서 죽어 나머지가 실행되지 않는다.
set +e

failed=0
COMMIT=""        # 가짜 curl이 돌려줄 build.commit
COMMIT_AFTER=""  # SWITCH_AT 번째 info 호출부터 바뀔 값
SWITCH_AT=0

# ★ 호출 횟수를 셸 변수에 담을 수 없다. deploy.sh가 `curl ... | grep -q`로 부르는데
# 파이프라인의 각 구간은 서브셸이라 증가시킨 값이 부모로 돌아오지 않는다.
COUNTER_FILE="$(mktemp)"
trap 'rm -f "$COUNTER_FILE"' EXIT

# 진짜 sleep을 쓰면 AC-09가 60초 걸린다.
sleep() { :; }

curl() {
  local url="${*: -1}"
  case "$url" in
    *"/actuator/health")
      echo '{"status":"UP"}'
      ;;
    *"/actuator/info")
      local calls=$(( $(cat "$COUNTER_FILE") + 1 ))
      echo "$calls" > "$COUNTER_FILE"
      local value="$COMMIT"
      if [ "$SWITCH_AT" -gt 0 ] && [ "$calls" -ge "$SWITCH_AT" ]; then
        value="$COMMIT_AFTER"
      fi
      if [ -z "$value" ]; then
        echo '{}'
      else
        echo "{\"build\":{\"commit\":\"$value\",\"time\":\"2026-09-05T09:12:33Z\"}}"
      fi
      ;;
  esac
}

# check <AC 이름> <기대 종료코드> <실제 종료코드>
check() {
  if [ "$2" = "$3" ]; then
    echo "  ✓ $1"
  else
    echo "  ✗ $1 — 종료코드 기대 $2, 실제 $3"
    failed=1
  fi
}

reset() {
  COMMIT="$1"
  COMMIT_AFTER="${2:-}"
  SWITCH_AT="${3:-0}"
  echo 0 > "$COUNTER_FILE"
}

echo "deploy.sh 헬스 대기 로직"

# AC-BUILDINFO-06 · UP이고 sha가 맞으면 통과한다
reset "abc123"
wait_healthy "abc123" > /dev/null
check "AC-BUILDINFO-06 · UP이고 sha가 맞으면 통과한다" 0 $?

# AC-BUILDINFO-07 · UP이어도 sha가 다르면 통과하지 않는다
reset "old999"
wait_healthy "abc123" > /dev/null
check "AC-BUILDINFO-07 · UP이어도 sha가 다르면 통과하지 않는다" 1 $?

# AC-BUILDINFO-08 · 늦게 교체돼도 12회 안이면 성공이다
reset "old999" "abc123" 4
wait_healthy "abc123" > /dev/null
check "AC-BUILDINFO-08 · 늦게 교체돼도 12회 안이면 성공이다" 0 $?

# AC-BUILDINFO-09 · 끝내 불일치면 실패로 끝난다
reset "old999"
wait_healthy "abc123" > /dev/null
check "AC-BUILDINFO-09 · 끝내 불일치면 실패로 끝난다" 1 $?

# AC-BUILDINFO-10 · 롤백은 sha를 보지 않는다 (구버전이라 info가 {}다)
reset ""
wait_healthy > /dev/null
check "AC-BUILDINFO-10 · 롤백은 sha를 보지 않는다" 0 $?

if [ "$failed" -eq 0 ]; then
  echo "5개 전부 통과"
fi
exit "$failed"

#!/usr/bin/env bash
set -euo pipefail

INFRA_DIR="${KALDI_INFRA_DIR:-/opt/kaldi-note/infra}"
COMPOSE_FILE="$INFRA_DIR/docker-compose.prod.yml"
STATE_FILE="$INFRA_DIR/.last-deployed-tag"
BASE_URL="${KALDI_BASE_URL:-https://api.kaldi-note.today}"
HEALTH_URL="$BASE_URL/actuator/health"
INFO_URL="$BASE_URL/actuator/info"

deploy_tag() {
  KALDI_IMAGE_TAG="$1" docker compose -f "$COMPOSE_FILE" pull app
  KALDI_IMAGE_TAG="$1" docker compose -f "$COMPOSE_FILE" up -d
}

# wait_healthy [기대sha]
#
# 기대 sha를 주면 「UP」만으로는 통과하지 않는다. docker compose up -d가 조용히 실패해
# 구 컨테이너가 그대로 살아 있어도 헬스체크는 통과하기 때문이다 — 그러면 뜬 적 없는 태그가
# .last-deployed-tag에 적혀 다음 배포의 롤백 대상이 된다(docs/specs/2026-09-05-build-info.md).
#
# 인자를 비우면 헬스만 본다. 롤백 대상은 build.commit을 모르는 구버전일 수 있고,
# 롤백의 목적은 서비스 복구지 버전 증명이 아니다.
wait_healthy() {
  local expected_sha="${1:-}"
  for i in $(seq 1 12); do
    if curl -fsS "$HEALTH_URL" 2>/dev/null | grep -q '"status":"UP"'; then
      if [ -z "$expected_sha" ]; then
        echo "헬스체크 통과 (시도 $i/12)"
        return 0
      fi
      if curl -fsS "$INFO_URL" 2>/dev/null | grep -q "\"commit\":\"$expected_sha\""; then
        echo "헬스체크 통과 + 버전 일치 $expected_sha (시도 $i/12)"
        return 0
      fi
      echo "떠 있으나 아직 이전 버전이다 (시도 $i/12)"
    fi
    sleep 5
  done
  return 1
}

main() {
  local IMAGE_TAG="${1:?사용법: deploy.sh <git-sha>}"
  cd "$INFRA_DIR"

  local PREVIOUS_TAG=""
  [ -f "$STATE_FILE" ] && PREVIOUS_TAG=$(cat "$STATE_FILE")

  echo "배포 시작: $IMAGE_TAG (직전: ${PREVIOUS_TAG:-없음})"
  deploy_tag "$IMAGE_TAG"

  if wait_healthy "$IMAGE_TAG"; then
    echo "$IMAGE_TAG" > "$STATE_FILE"
    echo "배포 성공: $IMAGE_TAG"
    exit 0
  fi

  echo "헬스체크 실패 — 롤백 시도"
  if [ -n "$PREVIOUS_TAG" ] && [ "$PREVIOUS_TAG" != "$IMAGE_TAG" ]; then
    deploy_tag "$PREVIOUS_TAG"
    if wait_healthy; then
      echo "롤백 성공: $PREVIOUS_TAG (배포 자체는 실패로 표시)"
    else
      echo "롤백 후에도 헬스체크 실패 — 수동 개입 필요"
    fi
  else
    echo "롤백할 이전 태그가 없다 — 수동 개입 필요"
  fi

  exit 1
}

# 테스트가 source할 때는 실행하지 않는다 — infra/scripts/deploy.test.sh
if [ -z "${KALDI_DEPLOY_TEST:-}" ]; then
  main "$@"
fi

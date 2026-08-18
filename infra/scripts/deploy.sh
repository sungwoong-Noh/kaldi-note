#!/usr/bin/env bash
set -euo pipefail

IMAGE_TAG="${1:?사용법: deploy.sh <git-sha>}"
INFRA_DIR="/opt/kaldi-note/infra"
COMPOSE_FILE="$INFRA_DIR/docker-compose.prod.yml"
STATE_FILE="$INFRA_DIR/.last-deployed-tag"
HEALTH_URL="https://api.kaldi-note.today/actuator/health"

cd "$INFRA_DIR"

PREVIOUS_TAG=""
[ -f "$STATE_FILE" ] && PREVIOUS_TAG=$(cat "$STATE_FILE")

deploy_tag() {
  KALDI_IMAGE_TAG="$1" docker compose -f "$COMPOSE_FILE" pull app
  KALDI_IMAGE_TAG="$1" docker compose -f "$COMPOSE_FILE" up -d
}

wait_healthy() {
  for i in $(seq 1 12); do
    if curl -fsS "$HEALTH_URL" 2>/dev/null | grep -q '"status":"UP"'; then
      echo "헬스체크 통과 (시도 $i/12)"
      return 0
    fi
    sleep 5
  done
  return 1
}

echo "배포 시작: $IMAGE_TAG (직전: ${PREVIOUS_TAG:-없음})"
deploy_tag "$IMAGE_TAG"

if wait_healthy; then
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

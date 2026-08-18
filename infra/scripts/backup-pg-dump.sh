#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/kaldi-note/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILENAME="kaldinote-${TIMESTAMP}.sql.gz"
# 사진 버킷(OCI_BUCKET_NAME)과 반드시 분리한다. 사진 버킷은 public-read인데
# 백업 파일명은 UUID가 아니라 날짜 기반이라 추측 가능해, 같은 버킷에 두면 DB 덤프가 공개된다.
BUCKET="${OCI_BACKUP_BUCKET_NAME:?OCI_BACKUP_BUCKET_NAME 환경변수가 필요하다 — crontab에서 source .env 후 실행할 것. 사진용 OCI_BUCKET_NAME과 다른 private 버킷이어야 한다}"

mkdir -p "$BACKUP_DIR"

docker exec kaldi-note-postgres pg_dump -U kaldinote kaldinote | gzip > "$BACKUP_DIR/$FILENAME"

oci os object put \
  --bucket-name "$BUCKET" \
  --file "$BACKUP_DIR/$FILENAME" \
  --name "backups/$FILENAME" \
  --force

rm -f "$BACKUP_DIR/$FILENAME"

# 최근 7개만 남기고 오래된 백업 삭제.
# 목록 조회를 명령 치환으로 분리해 둔다 — mapfile < <(...)의 프로세스 치환은
# 안쪽 명령이 실패해도 종료 코드를 전파하지 않아, set -e가 조용히 통과한다.
OBJECT_LIST=$(oci os object list --bucket-name "$BUCKET" --prefix "backups/" --query "data[].name")

mapfile -t OLD_BACKUPS < <(
  printf '%s' "$OBJECT_LIST" | python3 -c "
import json, sys
raw = sys.stdin.read().strip()
names = json.loads(raw) if raw else []   # 첫 실행이면 출력이 비어 있다
old = sorted(names)[:-7]
if old:                                  # 빈 줄을 흘리지 않는다 — mapfile이 빈 원소로 받는다
    print('\n'.join(old))
"
)

# 조건문으로 감싼다. '[ -n "$old" ] && oci ...' 형태면 지울 게 없을 때(=정상)
# 마지막 명령의 종료 코드 1이 그대로 스크립트 종료 코드가 되어, cron이 매일
# 실패로 기록한다 — 진짜 실패와 구분할 수 없게 된다.
for old in "${OLD_BACKUPS[@]:-}"; do
  if [ -n "$old" ]; then
    oci os object delete --bucket-name "$BUCKET" --object-name "$old" --force
  fi
done

#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/kaldi-note/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILENAME="kaldinote-${TIMESTAMP}.sql.gz"
BUCKET="${OCI_BUCKET_NAME:?OCI_BUCKET_NAME 환경변수가 필요하다 — crontab에서 source .env 후 실행할 것}"

mkdir -p "$BACKUP_DIR"

docker exec kaldi-note-postgres pg_dump -U kaldinote kaldinote | gzip > "$BACKUP_DIR/$FILENAME"

oci os object put \
  --bucket-name "$BUCKET" \
  --file "$BACKUP_DIR/$FILENAME" \
  --name "backups/$FILENAME" \
  --force

rm -f "$BACKUP_DIR/$FILENAME"

# 최근 7개만 남기고 오래된 백업 삭제
mapfile -t OLD_BACKUPS < <(
  oci os object list --bucket-name "$BUCKET" --prefix "backups/" \
    --query "data[].name" --raw-output-json \
    | python3 -c "import json,sys; print('\n'.join(sorted(json.load(sys.stdin))[:-7]))"
)

for old in "${OLD_BACKUPS[@]:-}"; do
  [ -n "$old" ] && oci os object delete --bucket-name "$BUCKET" --object-name "$old" --force
done

#!/usr/bin/env bash
# 배포 실패 시 자동 롤백이 실제로 동작하는지 확인한다. VM에서 실행한다.
#
# 사용법 (맥에서, 저장소 루트):
#   ssh ubuntu@<VM> 'bash -s' < infra/scripts/verify-rollback.sh
#
# 어떻게 검증하는가
#   깨진 이미지를 만들 필요 없이 정상 이미지 두 개로 "실패 → 롤백"을 재현한다.
#   진짜 deploy.sh를 복사해 HEALTH_URL만 가짜 서버로 바꾸고, 그 서버가 처음 12번은
#   503을, 이후에는 200을 돌려주게 한다. 새 배포는 실패하고 롤백본은 성공하는
#   실제 상황과 같은 모양이 된다.
#
# 서비스 영향
#   두 이미지 모두 정상이라 컨테이너가 두 번 교체되는 순간만 끊긴다(각 10~20초).
#   deploy.sh는 성공했을 때만 상태 파일을 갱신하므로 .last-deployed-tag는 오염되지 않는다.

set -uo pipefail

INFRA_DIR="/opt/kaldi-note/infra"
STATE_FILE="$INFRA_DIR/.last-deployed-tag"
REAL_SCRIPT="$INFRA_DIR/scripts/deploy.sh"
IMAGE_REPO="ghcr.io/sungwoong-noh/kaldi-note-api"
FAKE_PORT=9999

# 롤백 대상으로 쓸 후보. 상태 파일의 태그와 다른 것을 고른다.
CANDIDATES=(
  2efac2674d5118a4d83e5b8c9b3b20470305e0f9
  f7f88fb970928985c1d11fc784af312318e47748
  5ea01913b3064d15e5b1c2b6b8a53d1e07a4f4c9
)

fail() { echo "중단: $*" >&2; exit 2; }

[ -d "$INFRA_DIR" ] || fail "$INFRA_DIR 가 없다. VM에서 실행하는 것이 맞는지 확인할 것"
[ -f "$REAL_SCRIPT" ] || fail "$REAL_SCRIPT 가 없다"
[ -f "$STATE_FILE" ] || fail "$STATE_FILE 이 없다 — 성공한 배포가 한 번은 있어야 롤백할 대상이 생긴다"

cd "$INFRA_DIR"

CURRENT=$(cat "$STATE_FILE")
BEFORE_IMAGE=$(docker inspect --format '{{.Config.Image}}' kaldi-note-app 2>/dev/null) \
  || fail "kaldi-note-app 컨테이너를 찾을 수 없다"

NEW=""
for tag in "${CANDIDATES[@]}"; do
  [ "$tag" = "$CURRENT" ] && continue
  if docker manifest inspect "$IMAGE_REPO:$tag" > /dev/null 2>&1; then
    NEW="$tag"
    break
  fi
done
[ -n "$NEW" ] || fail "GHCR에서 쓸 수 있는 다른 태그를 못 찾았다"

echo "=== 1. 시작 상태 ==="
echo "  상태파일       : $CURRENT"
echo "  현재 컨테이너  : $BEFORE_IMAGE"
echo "  새 배포로 시도 : $NEW"

echo
echo "=== 2. 가짜 헬스 서버 기동 (처음 12번 503, 이후 200) ==="
python3 - > /tmp/fake-health.log 2>&1 <<PY &
from http.server import BaseHTTPRequestHandler, HTTPServer

# deploy.sh의 wait_healthy는 12번까지 시도한다. 그 12번을 모두 실패시켜야
# 롤백 분기로 들어간다. 롤백본은 통과해야 하므로 13번째부터 200을 준다.
FAIL_UNTIL = 12
count = 0

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        global count
        # /reset은 카운터를 건드리지 않는다. 점검용 요청이 실패 예산을 갉아먹어
        # 12번째에 통과해버리는 오프바이원을 실제로 겪었다.
        if self.path == "/reset":
            count = 0
            self.send_response(200); self.end_headers(); self.wfile.write(b"reset")
            return
        count += 1
        healthy = count > FAIL_UNTIL
        self.send_response(200 if healthy else 503)
        self.end_headers()
        self.wfile.write(b'{"status":"UP"}' if healthy else b'{"status":"DOWN"}')

    def log_message(self, *args):
        pass

HTTPServer(("127.0.0.1", $FAKE_PORT), Handler).serve_forever()
PY
FAKE_PID=$!
trap 'kill "$FAKE_PID" 2>/dev/null; rm -f /tmp/deploy-rbtest.sh' EXIT
sleep 1

FIRST=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$FAKE_PORT/health")
[ "$FIRST" = "503" ] || fail "가짜 서버 첫 응답이 $FIRST 다 (503이어야 한다)"
curl -s -o /dev/null "http://127.0.0.1:$FAKE_PORT/reset"
echo "  첫 응답 503 확인, 카운터 초기화 (점검 요청이 실패 예산을 쓰지 않게)"

echo
echo "=== 3. 진짜 deploy.sh 복사, HEALTH_URL만 교체 ==="
sed "s#^HEALTH_URL=.*#HEALTH_URL=\"http://127.0.0.1:$FAKE_PORT/health\"#" \
  "$REAL_SCRIPT" > /tmp/deploy-rbtest.sh
grep -n '^HEALTH_URL=' /tmp/deploy-rbtest.sh

echo
echo "=== 4. 실행 — 헬스 실패 60초 대기 후 롤백 ==="
bash /tmp/deploy-rbtest.sh "$NEW" 2>&1 | tee /tmp/rbtest.out
EXIT=${PIPESTATUS[0]}

# 판정에 쓸 상태는 자동 복구보다 **먼저** 찍는다. 복구한 뒤에 재면 무엇이 일어났든
# 원래 태그로 보여 거짓 PASS가 난다.
AFTER_IMAGE=$(docker inspect --format '{{.Config.Image}}' kaldi-note-app 2>/dev/null)
AFTER_STATE=$(cat "$STATE_FILE")

# 안전장치: 예상은 "헬스 실패 → 롤백 → exit 1"이다. 배포가 성공해버리면 이 테스트가
# 운영 상태를 바꾼 것이므로 즉시 원래 태그로 되돌린다. 실제로 이걸 빠뜨려 운영이
# 예전 이미지로 넘어간 적이 있다.
if [ "$EXIT" = "0" ]; then
  echo
  echo "!! 예상과 다르게 배포가 성공했다. 운영 상태가 바뀌었으므로 되돌린다"
  echo "   ($CURRENT 로 복구)"
  "$REAL_SCRIPT" "$CURRENT" || fail "자동 복구 실패 — 수동으로 '$REAL_SCRIPT $CURRENT' 실행할 것"
  echo "   복구 완료"
fi

echo
echo "=== 5. 판정 ==="
PASS=0

check() { # check <설명> <조건결과>
  if [ "$2" = "0" ]; then echo "  PASS  $1"; else echo "  FAIL  $1"; PASS=1; fi
}

[ "$EXIT" = "1" ]; check "배포가 실패로 끝난다 (종료 코드 1, 실제 $EXIT)" $?
grep -q "롤백 성공" /tmp/rbtest.out; check "롤백 성공 메시지가 찍힌다" $?
[ "$AFTER_IMAGE" = "$BEFORE_IMAGE" ]; check "컨테이너가 직전 태그로 돌아왔다" $?
[ "$AFTER_STATE" = "$CURRENT" ]; check "상태 파일이 오염되지 않았다" $?

echo
echo "=== 6. 실서비스 확인 ==="
sleep 3
REAL=$(curl -fsS https://api.kaldi-note.today/actuator/health 2>/dev/null)
echo "  $REAL"
case "$REAL" in *'"status":"UP"'*) check "서비스가 정상이다" 0 ;; *) check "서비스가 정상이다" 1 ;; esac

echo
if [ "$PASS" = "0" ]; then
  echo "결과: 롤백 검증 통과"
else
  echo "결과: 실패한 항목이 있다. 서비스가 내려갔다면 아래로 복구한다"
  echo "  $REAL_SCRIPT $CURRENT"
fi
exit "$PASS"

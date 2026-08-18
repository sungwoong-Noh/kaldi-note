# 배포 런북

코드로 재현할 수 없는 VM 최초 설정과, 배포 후 사람이 직접 확인해야 할 항목이다.
스펙 `docs/specs/2026-08-18-oci-deploy.md`의 "수동 확인" 절과 1:1로 대응한다.

## VM 최초 설정 (1회)

1. `/opt/kaldi-note/infra`에 이 저장소의 `infra/` 디렉터리를 배치한다(git clone 또는 scp). **`ubuntu` 계정으로 clone하거나, clone 후 `sudo chown -R ubuntu:ubuntu /opt/kaldi-note`를 반드시 실행한다** — 소유권이 `root`면 GitHub Actions의 SCP 배포 스텝이 `create folder` 다음 단계에서 조용히 실패한다(2026-08-18 실제로 겪음).
2. `infra/.env.example`을 `infra/.env`로 복사하고 실제 값을 채운다. `KALDI_JWT_SECRET`은 **HS256 최소 요구사항인 32바이트 이상**이어야 한다 — 짧으면 앱이 기동 직후 `Failed to bind properties under 'kaldi.jwt'`로 크래시 루프에 빠진다. `openssl rand -base64 48`로 생성하면 안전하다.
3. VM 타임존을 KST로 맞춘다: `sudo timedatectl set-timezone Asia/Seoul`
4. OCI CLI를 설치하고 인증을 설정한다(`backup-pg-dump.sh`가 `oci os object put/list/delete`를 쓴다): `bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)"` 후 `oci setup config`로 `infra/.env`와 같은 자격증명을 등록한다.
5. `crontab -e`로 매일 백업을 등록한다:
   ```
   0 3 * * * /opt/kaldi-note/infra/scripts/backup-pg-dump.sh >> /var/log/kaldi-backup.log 2>&1
   ```
6. VM 방화벽(iptables/ufw + OCI Security List 둘 다)에서 80·443을 전체 허용, 22는 GitHub Actions IP 대역만 허용하고 나머지(5432 포함)는 차단한다. GitHub Actions IP 대역은 `https://api.github.com/meta`의 `actions` 키로 확인한다.

   > **함정(2026-08-18 실제로 겪음):** OCI 콘솔에서 Ingress 규칙을 추가할 때 **Source Port Range를 반드시 "전체(All)"로 둬야 한다.** 특정 값으로 잘못 들어가면 콘솔엔 규칙이 정상으로 보이는데도 실제 트래픽(출발지 포트가 매번 다른 임시 포트)과 매치가 안 돼 조용히 막힌다. `sudo iptables -L INPUT -n -v`로 각 규칙의 `pkts` 카운터가 실제로 올라가는지 확인하면 이 문제를 바로 잡아낼 수 있다 — VM iptables 규칙 자체는 멀쩡한데 카운터가 0으로 멈춰 있으면 OCI 쪽(VM보다 바깥)에서 막히고 있다는 뜻이다.
7. GitHub 저장소 Settings → Secrets에 `OCI_VM_HOST`·`OCI_VM_USER`·`OCI_VM_SSH_KEY`를 등록한다.
8. DNS에서 `api.kaldi-note.today` A 레코드가 이 VM의 공인 IP를 가리키는지 확인한다.
9. `cd /opt/kaldi-note/infra && docker compose -f docker-compose.prod.yml up -d`로 최초 기동한다.

## 배포 후 확인 (스펙의 "수동 확인" 그대로)

- [x] `main`에 머지하면 `backend.yml`의 `deploy` job이 돌고, GHCR에 `:<git-sha>`·`:latest` 두 태그가 모두 올라간다 — 2026-08-18 확인, 재검증 시 `deploy` job 전체 2분 12초
- [x] SSH 액션이 VM에 접속해 배포하고, VM에서 새 컨테이너가 뜬다 — 2026-08-18 확인
- [x] 배포 직후 `https://api.kaldi-note.today/actuator/health`가 60초 이내 HTTP 200을 반환한다 — 2026-08-18 확인 (`SSL certificate verify ok`, `{"status":"UP"}`)
- [ ] 헬스체크가 실패하도록 강제했을 때, 직전 태그로 자동 롤백되고 워크플로가 실패로 표시된다 — 아직 실제로 강제 실패시켜 확인한 적 없음(`.env` 없음 등으로 실패한 적은 있으나, 그때는 직전 태그 자체가 없어 롤백 분기를 타지 않았다)
- [ ] `nmap`이나 외부 접속 시도로 5432(PostgreSQL)가 막혀 있는지 확인한다
- [x] `https://api.kaldi-note.today`가 유효한 HTTPS 인증서로 응답한다(Caddy 자동 발급) — 2026-08-18 확인, production Let's Encrypt 인증서
- [ ] `crontab -l`에 백업 작업이 등록돼 있고, 다음날 Object Storage에 백업 파일이 실제로 생긴다 — OCI 버킷 미생성, 미착수
- [ ] 8일 연속 백업 후 버킷에 최근 7개만 남아 있다
- [ ] `.env`의 값으로 카카오/구글 실계정 로그인과 사진 업로드가 실제로 동작한다 — 지금 `.env`는 KAKAO_*/GOOGLE_*/OCI_* 전부 dummy 값

---
id: DEPLOY
title: OCI 배포 · CI/CD
status: 구현완료
plan:
---

# OCI 배포 · CI/CD 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

`main` 브랜치에 푸시되면 GitHub Actions가 백엔드를 Docker 이미지로 빌드해 GHCR에 올리고, SSH로 OCI VM에 접속해 `docker compose pull && up -d`로 배포한다. 배포 직후 헬스체크로 성공 여부를 확인하고, 실패하면 직전 이미지로 자동 롤백한다. PostgreSQL은 VM의 crontab이 매일 새벽 `pg_dump`로 백업해 OCI Object Storage에 올린다.

### 범위 밖 (Non-goals)

- **프론트엔드 배포.** Vercel이든 Cloudflare든 프론트 호스팅 자체는 Plan 4에서 다룬다. 이 스펙은 백엔드만 다룬다.
- **외부 모니터링·알림.** Grafana·Sentry 같은 관측 도구 연동은 만들지 않는다. 배포 성공/실패는 GitHub Actions 워크플로 결과로만 확인한다.
- **무다운타임 배포.** `docker compose up -d`가 기존 컨테이너를 내리고 새로 올리는 동안의 짧은 다운타임을 감수한다. 블루/그린이나 롤링 배포는 만들지 않는다.
- **백업 복구 리허설 자동화.** 백업 파일이 Object Storage에 쌓이는 것까지만 다루고, 실제로 그 파일로 복구가 되는지 정기적으로 검증하는 자동화는 만들지 않는다.

## 왜

지금까지는 Swagger UI로만 기능을 검증했다. `architecture.md`의 핵심 시나리오 마지막 단계("여자친구 계정으로 로그인해 FRIENDS 레시피 조회")를 실제로 확인하려면 인터넷에서 접속되는 배포가 먼저 필요하다. 또한 코드가 바뀔 때마다 SSH로 수동 배포하면 반복 작업이자 실수 지점이 된다.

## 용어

| 용어 | 정의 |
|---|---|
| GHCR | GitHub Container Registry. 빌드된 Docker 이미지를 저장하는 곳 |
| 헬스체크 | 배포 직후 `/actuator/health`를 폴링해 애플리케이션이 정상 기동했는지 확인하는 절차 |
| 롤백 | 헬스체크 실패 시 직전에 배포됐던 이미지 태그로 `compose up`을 다시 실행하는 것 |

---

## 어떻게 동작 — 인수 조건

> 각 조건은 리터럴 값을 쓴다. 경계값은 각각 별도 조건으로 나눈다.
> ID는 한 번 부여하면 바꾸지 않는다.

### 정상 동작

이 스펙의 결정 대부분(SSH 배포, 방화벽, cron 백업, HTTPS 인증서)은 실제 VM·도메인·GitHub Secrets가 있어야만 검증 가능해 자동 테스트로 옮길 수 없다. 자동 테스트(AC)로 다루는 범위는 **Docker 이미지가 실제로 빌드되고 컨테이너가 정상 기동하는지**로 한정한다. 나머지는 "수동 확인"에 체크리스트로 남긴다.

#### AC-DEPLOY-01 · Dockerfile이 빌드에 성공한다

- **Given** `backend/Dockerfile`
- **When** 그 Dockerfile로 이미지를 빌드한다
- **Then** 빌드가 예외 없이 성공한다
- **검증** 통합 테스트 `DockerfileHealthcheckTest`

#### AC-DEPLOY-02 · 컨테이너 기동 후 60초 이내에 헬스체크가 통과한다

- **Given** AC-DEPLOY-01로 빌드한 이미지, 테스트용 PostgreSQL(Testcontainers)과 같은 Docker 네트워크
- **When** 그 이미지로 컨테이너를 기동하고 `GET /actuator/health`를 5초 간격으로 최대 12회(총 60초) 폴링한다
- **Then** 60초 이내에 HTTP `200`과 응답 본문의 `status` 필드가 `"UP"`인 응답을 받는다
- **검증** 통합 테스트 `DockerfileHealthcheckTest`

### 경계값

해당 없음 — 이 스펙에 수치 범위의 안/밖을 가르는 인수 조건이 없다. 헬스체크 폴링 횟수(5초×12회)는 CI 배포 스크립트의 설정값이지 AC 경계가 아니다.

### 에러

해당 없음 — 이 스펙은 새 HTTP API를 추가하지 않는다. 배포 실패 시나리오(헬스체크 실패 → 롤백)는 위 AC-DEPLOY-02가 실패하는 경우로 커버되며, 실제 롤백 동작 자체는 "수동 확인" 항목이다.

---

## 수동 확인

- [ ] `main`에 머지하면 GitHub Actions `backend.yml`의 `deploy` job이 돌고, GHCR에 `:<git-sha>`·`:latest` 두 태그가 모두 올라간다
- [ ] SSH 액션이 OCI VM에 접속해 `docker compose pull && up -d`를 실행하고, VM에서 새 컨테이너가 뜬다
- [ ] 배포 직후 `https://api.kaldi-note.today/actuator/health`가 60초 이내 HTTP 200을 반환한다
- [ ] 헬스체크가 실패하도록 강제했을 때, 직전 `:<git-sha>` 태그로 자동 롤백되고 워크플로가 실패(⨯)로 표시된다
- [ ] VM 방화벽이 80/443/22(GitHub Actions IP 대역만) 외 전부 차단하고 있다. `nmap`이나 외부 접속 시도로 5432(PostgreSQL)가 막혀 있는지 확인한다
- [ ] `https://kaldi-note.today`·`https://api.kaldi-note.today`가 유효한 HTTPS 인증서로 응답한다(Caddy 자동 발급)
- [ ] VM의 `crontab -l`에 매일 03:00 KST `pg_dump` 백업 작업이 등록돼 있다
- [ ] 다음날 OCI Object Storage 백업 버킷에 전날 백업 파일이 실제로 생긴다
- [ ] 8일 연속 백업이 쌓인 뒤 버킷에 최근 7개 파일만 남아 있다(8일 전 파일이 삭제됐다)
- [ ] VM의 `.env`에 채운 운영 비밀값으로 카카오/구글 실계정 로그인과 사진 업로드가 실제로 동작한다

## 열어둔 결정

- **Dockerfile 베이스 이미지**(`eclipse-temurin:21-jre` 등 구체 태그)와 멀티스테이지 구성은 구현 계획에서 정한다
- **Caddyfile의 정확한 설정**(reverse_proxy 대상, 로그 포맷 등)은 구현 계획에서 정한다
- **`.env`의 정확한 키 목록**은 `backend/CLAUDE.md`에 이미 정리된 `kaldi.oci.*` 등 기존 환경변수 목록을 그대로 따른다 — 이 스펙에서 새로 정의하지 않는다
- **Caddy 인증서 자동 갱신 실패 시 알림 여부**는 정하지 않는다(외부 모니터링이 비목표이므로 알림 자체가 없다는 뜻)

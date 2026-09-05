---
id: BUILDINFO
title: 배포된 버전을 밖에서 확인한다
status: 구현완료
plan: docs/plans/2026-09-05-plan-build-info.md
---

# 배포된 버전을 밖에서 확인한다 스펙

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.
> **모든 인수 조건은 자동화된 테스트로 옮길 수 있어야 한다.**

## 무엇을

`GET /actuator/info`가 **지금 실행 중인 jar이 어느 커밋에서 나왔는지**를 돌려준다.
그리고 `deploy.sh`가 배포 직후 그 값을 **방금 배포한 sha와 대조해서**, 일치할 때만 배포를 성공으로 기록한다.

### 범위 밖 (Non-goals)

- **롤백 조건을 재설계하지 않는다.** 지금 로직(직전 태그로 되돌린다)을 그대로 두고, 롤백 성공 판정에는
  commit을 보지 않는다 — 직전 이미지가 `build.commit`을 모르는 구버전일 수 있다.
- **백업·방화벽의 미체크 항목을 다루지 않는다.** SSH 키가 GitHub Secrets에만 있어 접근 수단이 없다.
- **`frontend/`를 건드리지 않는다.**
- **버전 문자열(`0.0.1-SNAPSHOT`)을 관리하지 않는다.** 노출하지도 않는다.
- **외부 모니터링·알림을 만들지 않는다**(`oci-deploy` 스펙의 비목표를 그대로 잇는다).

## 왜

`docs/specs/2026-08-18-oci-deploy.md`의 수동 확인 항목 하나가 **밟을 수 없는 상태로 남아 있다.**

> ⏸ **SSH 배포로 새 컨테이너가 뜨는 것 — 부분 확인.** deploy job이 성공했고 헬스체크가 통과했으나,
> 그것이 「새 이미지로 교체됐다」의 증거는 아니다 — 구 컨테이너가 계속 떠 있어도 헬스체크는 통과한다.
> `/actuator/info`가 `{}`라 밖에서 실행 중인 버전을 알 수 없다.

`deploy.sh`를 읽으면 이 지적이 정확하다. `wait_healthy`의 통과 조건이 `"status":"UP"` 하나뿐이라,
**`docker compose up -d`가 조용히 실패해 구 컨테이너가 그대로 살아 있어도 배포는 「성공」으로 기록되고
`.last-deployed-tag`에 새 sha가 적힌다.** 다음 배포의 롤백 대상이 실제로는 뜬 적 없는 태그가 된다.

즉 이것은 문서의 구멍이 아니라 **배포 파이프라인의 구멍**이다.

## 용어

| 용어 | 정의 |
|---|---|
| 기대 sha | `deploy.sh`가 인자로 받은 `IMAGE_TAG`. GitHub Actions의 `${{ github.sha }}`(40자 hex) |
| 관측 sha | `GET /actuator/info`의 `build.commit`. 지금 응답하는 컨테이너가 스스로 보고하는 값 |
| 굽는다 | 빌드 시점에 값을 jar 안(`META-INF/build-info.properties`)에 넣는 것. 런타임 주입과 대비된다 |

## 데이터

스키마 변경 없음. jar 안에 `META-INF/build-info.properties`가 새로 생긴다.

**sha는 런타임 환경변수가 아니라 빌드 시점에 굽는다.** 이유가 이 스펙의 핵심이다 —
환경변수로 넘기면 `docker-compose.prod.yml`의 `KALDI_IMAGE_TAG`를 그대로 앱에 전달하는 셈이라,
**구 이미지를 새 sha 이름으로 띄워도 대조를 통과한다.** 그건 이 스펙이 막으려는 상황 그 자체다.

## API

새 엔드포인트 없음. 기존 `GET /actuator/info`의 응답이 `{}`에서 아래로 바뀐다.

### 응답 예시

```json
// GET /actuator/info — 인증 불필요
{
  "build": {
    "commit": "6d5cd90b3f2a1c4e8d7b6a5f4e3d2c1b0a9f8e7d",
    "time": "2026-09-05T09:12:33Z"
  }
}
```

```json
// sha를 주입하지 않고 빌드했을 때 (로컬 개발·테스트)
{
  "build": {
    "commit": "unknown",
    "time": "2026-09-05T08:41:02Z"
  }
}
```

`commit` 키는 **항상 있다.** 값만 `"unknown"`이 된다 — 클라이언트가 두 가지 응답 모양을 다루지 않게 한다.

### `deploy.sh`의 대조

기존 헬스체크 루프(12회 × 5초)의 **통과 조건을 넓힌다.** 새 재시도 로직을 만들지 않는다.

```
지금:  "status":"UP" 이면 통과
바뀜:  "status":"UP"  그리고  build.commit == 기대 sha  이면 통과
```

컨테이너 교체에 시간이 걸리는 동안은 구 컨테이너가 응답하므로 통과하지 않고, 60초 안에 교체되면 통과한다.
끝내 불일치면 루프가 실패로 끝나 **기존 롤백 경로를 그대로 탄다.**

**롤백 호출은 commit을 보지 않는다.** 직전 이미지가 이 변경 이전 버전이면 `build.commit`이 없어
대조가 영원히 실패하고, 그러면 「롤백도 안 된다」로 잘못 보인다. 롤백의 목적은 서비스 복구지 버전 증명이 아니다.

---

## 어떻게 동작 — 인수 조건

### 정보 노출

> 검증은 `InfoEndpointTest`(MockMvc 통합 테스트).

#### AC-BUILDINFO-01 · sha를 주입하지 않으면 `unknown`이다

- **Given** `-Pcommit`을 주지 않고 빌드한 애플리케이션
- **When** `GET /actuator/info`
- **Then** `build.commit`이 정확히 `"unknown"`이다
- **검증** API 테스트 `InfoEndpointTest`

#### AC-BUILDINFO-02 · 빌드 시각이 ISO-8601 UTC다

- **Given** 애플리케이션이 떠 있다
- **When** `GET /actuator/info`
- **Then** `build.time`이 `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$`에 맞는 문자열이다
- **검증** API 테스트 `InfoEndpointTest`

#### AC-BUILDINFO-03 · 필요 없는 필드를 내보내지 않는다

- **Given** 애플리케이션이 떠 있다
- **When** `GET /actuator/info`
- **Then** 응답에 `build.artifact`·`build.group`·`build.version` 셋 다 **없다**
- **검증** API 테스트 `InfoEndpointTest`

#### AC-BUILDINFO-04 · 주입한 sha가 그대로 나온다

- **Given** 빌드 정보의 `commit`이 `0123456789abcdef0123456789abcdef01234567`(40자)로 채워졌다
- **When** 정보 기여자가 `build` 항목을 만든다
- **Then** `commit`이 그 40자와 정확히 같다
- **검증** 단위 테스트 `BuildInfoContributorTest`
  — API 테스트로 하려면 테스트 전용 `BuildProperties` 빈이 필요하고, 그러면 스프링 컨텍스트가 하나 더 생겨
  캐시가 갈라진다(`backend/CLAUDE.md`「`@MockBean`을 남발하면 캐시가 깨진다」). 주입된 값이 그대로 나가는지는
  기여자 하나만 보면 되므로 단위 테스트로 충분하다.

#### AC-BUILDINFO-05 · `/actuator/info`는 인증 없이 열린다

- **Given** `Authorization` 헤더가 없다
- **When** `GET /actuator/info`
- **Then** HTTP `200`이다 — 기존 `permitAll` 유지(회귀 방지)
- **검증** API 테스트 `InfoEndpointTest`

### 배포 대조

> 검증은 `infra/scripts/deploy.test.sh`. `deploy.sh`를 `source`해 함수만 부르고,
> `curl`을 PATH 앞에 놓은 가짜로 바꿔 응답을 만든다. **새 의존성은 없다.**

#### AC-BUILDINFO-06 · UP이고 sha가 맞으면 통과한다

- **Given** `/actuator/health`가 `{"status":"UP"}`, `/actuator/info`의 `build.commit`이 `abc123`
- **When** 기대 sha `abc123`으로 헬스 대기 함수를 부른다
- **Then** 종료 코드가 `0`이다
- **검증** 셸 테스트 `deploy.test.sh`

#### AC-BUILDINFO-07 · UP이어도 sha가 다르면 통과하지 않는다

- **Given** `/actuator/health`가 `UP`, `build.commit`이 `old999`(구 컨테이너)
- **When** 기대 sha `abc123`으로 헬스 대기 함수를 부른다
- **Then** 종료 코드가 `1`이다 — `UP` 하나로 통과하지 않는다
- **검증** 셸 테스트 `deploy.test.sh`

#### AC-BUILDINFO-08 · 늦게 교체돼도 12회 안이면 성공이다

- **Given** 처음 3회는 `build.commit`이 `old999`, 4회째부터 `abc123`
- **When** 기대 sha `abc123`으로 헬스 대기 함수를 부른다
- **Then** 종료 코드가 `0`이다
- **검증** 셸 테스트 `deploy.test.sh`

#### AC-BUILDINFO-09 · 끝내 불일치면 실패로 끝난다

- **Given** 12회 내내 `build.commit`이 `old999`
- **When** 기대 sha `abc123`으로 헬스 대기 함수를 부른다
- **Then** 종료 코드가 `1`이다
- **검증** 셸 테스트 `deploy.test.sh`

#### AC-BUILDINFO-10 · 롤백은 sha를 보지 않는다

- **Given** `/actuator/health`가 `UP`이고 `/actuator/info`가 `{}`(구버전이라 `build.commit`이 없다)
- **When** 롤백용 헬스 대기(기대 sha 없이)를 부른다
- **Then** 종료 코드가 `0`이다
- **검증** 셸 테스트 `deploy.test.sh`

---

## 수동 확인

없음. 노출은 MockMvc로, 대조는 셸 테스트로 전부 검증된다.

> **이 스펙이 갚는 빚:** `docs/specs/2026-08-18-oci-deploy.md`의 「SSH 액션이 … VM에서 새 컨테이너가 뜬다」는
> 이 변경 뒤 **배포 때마다 `deploy.sh`가 스스로 검사**한다. 다만 그 스펙의 체크박스를 이 스펙이 대신 켜지는
> 않는다 — 실제로 배포가 한 번 돌아 로그에 대조 통과가 찍힌 뒤에 사람이 켠다.

## 열어둔 결정

- **`/actuator/info`를 인증 뒤로 옮길지.** 지금은 열어 둔다. 저장소가 PUBLIC이라 커밋 sha는 비밀이 아니고,
  `deploy.sh`가 VM 밖에서 HTTPS로 부르기 때문에 닫으면 대조에 토큰이 필요해진다. 저장소를 비공개로 바꾸면
  그때 다시 본다.
- **`build.time`을 대조에 쓸지.** 지금은 노출만 한다. sha 대조로 충분하고, 시각까지 맞추려면 빌드 재현성
  문제가 딸려 온다.

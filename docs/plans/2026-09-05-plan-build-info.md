# 배포된 버전을 밖에서 확인한다 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-09-05-build-info.md`

**Goal:** `GET /actuator/info`가 실행 중인 jar의 커밋 sha를 돌려주고, `deploy.sh`가 배포 직후 그 값을 방금
배포한 sha와 대조해 일치할 때만 성공으로 기록한다.

**Architecture:** Spring Boot Gradle 플러그인의 `buildInfo()`로 `META-INF/build-info.properties`를 굽고,
거기에 `commit`을 추가 프로퍼티로 넣는다. 기본 `build` 정보 기여자는 **끄고**(`artifact`·`group`·`version`이
함께 새어 나가므로) `commit`·`time`만 내는 기여자를 직접 만든다. `deploy.sh`는 기존 헬스체크 루프의 통과
조건을 넓히는 것으로 끝난다 — 새 재시도 로직을 만들지 않는다.

**작업 위치:** `backend/`, `infra/scripts/`, `.github/workflows/`, `scripts/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-BUILDINFO-01 | sha 미주입이면 `unknown` | Task 1 | API 테스트 |
| AC-BUILDINFO-02 | `build.time`이 ISO-8601 UTC | Task 1 | API 테스트 |
| AC-BUILDINFO-03 | `artifact`·`group`·`version`이 없다 | Task 1 | API 테스트 |
| AC-BUILDINFO-04 | 주입한 sha가 그대로 나온다 | Task 2 | 단위 테스트 |
| AC-BUILDINFO-05 | `/actuator/info`는 인증 없이 200 | Task 1 | API 테스트 |
| AC-BUILDINFO-06 | UP + sha 일치 → 통과 | Task 3 | 셸 테스트 |
| AC-BUILDINFO-07 | UP + sha 불일치 → 통과 안 함 | Task 3 | 셸 테스트 |
| AC-BUILDINFO-08 | 늦게 교체돼도 12회 안이면 성공 | Task 3 | 셸 테스트 |
| AC-BUILDINFO-09 | 끝내 불일치면 실패 | Task 3 | 셸 테스트 |
| AC-BUILDINFO-10 | 롤백은 sha를 보지 않는다 | Task 3 | 셸 테스트 |

**스펙의 AC 10개 중 10개가 매핑됨.**

---

## Global Constraints

- **`frontend/`를 건드리지 않는다.** 끝난 뒤 `git diff --stat main...HEAD`에 `frontend/`가 0줄이어야 한다.
- **`deploy.sh`의 롤백 로직을 바꾸지 않는다.** 통과 조건만 넓힌다. 되돌릴 태그를 고르는 부분,
  `.last-deployed-tag` 갱신 시점, 종료 코드는 그대로다.
- **셸 테스트에 새 의존성을 넣지 않는다.** bats·shunit2를 쓰지 않는다. `bash`만으로 짠다.
- **셸 테스트는 5초 안에 끝나야 한다.** AC-09는 12회 루프를 도는데 실제로 `sleep 5`를 하면 60초다 —
  테스트에서 `sleep`을 가짜로 덮는다.

---

## File Structure

```
backend/
├── build.gradle.kts                                    Modify — buildInfo() + commit 프로퍼티
├── src/main/resources/application.yml                  Modify — 기본 build 기여자 끄기
├── src/main/java/com/kaldinote/common/config/
│   └── BuildInfoContributor.java                       Create
└── src/test/java/com/kaldinote/common/config/
    ├── BuildInfoContributorTest.java                   Create — AC-04
    └── InfoEndpointTest.java                           Create — AC-01·02·03·05
infra/scripts/
├── deploy.sh                                           Modify — 통과 조건 + main 분리
└── deploy.test.sh                                      Create — AC-06~10
.github/workflows/
├── backend.yml                                         Modify — bootJar에 -Pcommit
└── spec.yml                                            Modify — 셸 테스트 실행
scripts/
└── check-spec-coverage.sh                              Modify — infra/scripts를 검색 경로에
```

---

## Task 1: `/actuator/info`가 commit·time만 낸다

**Files:**
- Modify: `backend/build.gradle.kts`
- Modify: `backend/src/main/resources/application.yml`
- Create: `backend/src/main/java/com/kaldinote/common/config/BuildInfoContributor.java`
- Test: `backend/src/test/java/com/kaldinote/common/config/InfoEndpointTest.java`

**Covers:** AC-BUILDINFO-01, AC-BUILDINFO-02, AC-BUILDINFO-03, AC-BUILDINFO-05

**Interfaces:**
- Produces: `BuildInfoContributor implements InfoContributor` — 생성자가 `BuildProperties`를 받는다.
  Task 2의 단위 테스트가 이 생성자를 직접 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

새 파일 `backend/src/test/java/com/kaldinote/common/config/InfoEndpointTest.java`:

```java
package com.kaldinote.common.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kaldinote.AbstractIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 배포된 버전 노출 — docs/specs/2026-09-05-build-info.md */
class InfoEndpointTest extends AbstractIntegrationTest {

  @Test
  @DisplayName("AC-BUILDINFO-01 · sha를 주입하지 않으면 unknown이다")
  void sha를_주입하지_않으면_unknown이다() throws Exception {
    mockMvc
        .perform(get("/actuator/info"))
        .andExpect(jsonPath("$.build.commit").value("unknown"));
  }

  @Test
  @DisplayName("AC-BUILDINFO-02 · 빌드 시각이 ISO-8601 UTC다")
  void 빌드_시각이_ISO8601_UTC다() throws Exception {
    mockMvc
        .perform(get("/actuator/info"))
        .andExpect(
            jsonPath("$.build.time")
                .value(org.hamcrest.Matchers.matchesPattern(
                    "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z$")));
  }

  @Test
  @DisplayName("AC-BUILDINFO-03 · 필요 없는 필드를 내보내지 않는다")
  void 필요_없는_필드를_내보내지_않는다() throws Exception {
    mockMvc
        .perform(get("/actuator/info"))
        .andExpect(jsonPath("$.build.artifact").doesNotExist())
        .andExpect(jsonPath("$.build.group").doesNotExist())
        .andExpect(jsonPath("$.build.version").doesNotExist());
  }

  @Test
  @DisplayName("AC-BUILDINFO-05 · /actuator/info는 인증 없이 열린다")
  void info는_인증_없이_열린다() throws Exception {
    mockMvc.perform(get("/actuator/info")).andExpect(status().isOk());
  }
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*InfoEndpointTest'`
Expected: FAIL 2개(AC-01·02 — `$.build.commit`/`$.build.time`이 없다), PASS 2개(AC-03·05).

> **AC-03·05가 처음부터 통과하는 것이 정상이다.** 지금 응답이 `{}`라 없는 필드도 「없다」이고, `permitAll`도
> 이미 걸려 있다. 둘은 회귀 방지 조건이다 — Step 4 뒤에도 통과해야 의미가 생긴다.

- [ ] **Step 3: 최소 구현**

`backend/build.gradle.kts` — `springBoot { }` 블록을 추가(없으면 새로):

```kotlin
springBoot {
    buildInfo {
        properties {
            // CI가 -Pcommit=<40자 sha>로 넘긴다. 로컬 빌드에는 없으므로 unknown.
            // 런타임 환경변수로 넘기지 않는 이유는 스펙에 있다 — 구 이미지를 새 sha로
            // 띄워도 통과해버리기 때문이다.
            additional.put("commit", project.findProperty("commit")?.toString() ?: "unknown")
        }
    }
}
```

`application.yml`의 `management:` 아래에 추가:

```yaml
  info:
    # 기본 build 기여자는 artifact·group·version까지 내보낸다. 공개 엔드포인트라
    # BuildInfoContributor가 commit·time만 골라 낸다.
    build:
      enabled: false
```

새 파일 `BuildInfoContributor.java`:

```java
package com.kaldinote.common.config;

import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.actuate.info.Info;
import org.springframework.boot.actuate.info.InfoContributor;
import org.springframework.boot.info.BuildProperties;
import org.springframework.stereotype.Component;

/**
 * 실행 중인 jar이 어느 커밋에서 나왔는지를 알린다 — docs/specs/2026-09-05-build-info.md
 *
 * <p>deploy.sh가 배포 직후 이 값을 방금 배포한 sha와 대조한다. 헬스체크만으로는 구 컨테이너가 그대로
 * 살아 있어도 배포가 성공으로 기록된다.
 */
@Component
public class BuildInfoContributor implements InfoContributor {

  private final BuildProperties buildProperties;

  public BuildInfoContributor(BuildProperties buildProperties) {
    this.buildProperties = buildProperties;
  }

  @Override
  public void contribute(Info.Builder builder) {
    Map<String, Object> build = new LinkedHashMap<>();
    build.put("commit", buildProperties.get("commit"));
    build.put("time", DateTimeFormatter.ISO_INSTANT.format(buildProperties.getTime()));
    builder.withDetail("build", build);
  }
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*InfoEndpointTest'`
Expected: PASS, 4 tests

실제 응답도 한 번 눈으로 본다:

```bash
unzip -p build/libs/*.jar META-INF/build-info.properties
```
Expected: `build.commit=unknown`과 `build.time=...`이 보인다.

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(backend): /actuator/info가 커밋 sha를 알린다" && cd backend
```

---

## Task 2: 주입한 sha가 그대로 나온다 + CI 배선

**Files:**
- Create: `backend/src/test/java/com/kaldinote/common/config/BuildInfoContributorTest.java`
- Modify: `.github/workflows/backend.yml`

**Covers:** AC-BUILDINFO-04

**Interfaces:**
- Consumes: Task 1의 `BuildInfoContributor(BuildProperties)` 생성자

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.kaldinote.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.Properties;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.actuate.info.Info;
import org.springframework.boot.info.BuildProperties;

class BuildInfoContributorTest {

  @Test
  @DisplayName("AC-BUILDINFO-04 · 주입한 sha가 그대로 나온다")
  void 주입한_sha가_그대로_나온다() {
    Properties properties = new Properties();
    properties.setProperty("commit", "0123456789abcdef0123456789abcdef01234567");
    properties.setProperty("time", "1757062353000");

    Info.Builder builder = new Info.Builder();
    new BuildInfoContributor(new BuildProperties(properties)).contribute(builder);

    @SuppressWarnings("unchecked")
    Map<String, Object> build = (Map<String, Object>) builder.build().getDetails().get("build");
    assertThat(build.get("commit")).isEqualTo("0123456789abcdef0123456789abcdef01234567");
  }
}
```

> `BuildProperties`는 `time`을 epoch 밀리초 문자열로 읽는다. 값이 없으면 `getTime()`이 null이라
> `DateTimeFormatter`가 NPE를 낸다 — 그래서 테스트에도 넣는다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*BuildInfoContributorTest'`
Expected: FAIL — 컴파일은 되지만 값이 다르거나(구현이 `commit`을 안 읽으면) 통과.
**처음부터 통과하면 Task 1의 구현이 이미 이 조건을 만족한다는 뜻이다.** 그때는
`build.put("commit", buildProperties.get("commit"))`를 `build.put("commit", "unknown")`으로 잠시
바꿔 빨간불을 확인하고 되돌린다 — 이 테스트가 무엇을 지키는지 증명해야 한다.

- [ ] **Step 3: CI가 sha를 넘기게 한다**

`.github/workflows/backend.yml`의 `bootJar` 단계:

```yaml
      - name: bootJar 빌드 (네이티브)
        working-directory: backend
        # -Pcommit이 build-info.properties에 굽힌다. 이 값이 deploy.sh의 대조 대상이다.
        run: ./gradlew bootJar --no-daemon -Pcommit=${{ github.sha }}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*BuildInfoContributorTest'`
Expected: PASS, 1 test

로컬에서 주입 경로도 실제로 확인한다:

```bash
./gradlew bootJar -Pcommit=0123456789abcdef0123456789abcdef01234567 -q
unzip -p build/libs/*.jar META-INF/build-info.properties | grep commit
```
Expected: `build.commit=0123456789abcdef0123456789abcdef01234567`
확인 뒤 `./gradlew bootJar -q`로 되돌려 `unknown`으로 다시 굽는다.

- [ ] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add . && git commit -m "feat(ci): 빌드에 커밋 sha를 굽는다" && cd backend
```

---

## Task 3: `deploy.sh`가 sha를 대조한다

**Files:**
- Modify: `infra/scripts/deploy.sh`
- Create: `infra/scripts/deploy.test.sh`

**Covers:** AC-BUILDINFO-06, 07, 08, 09, 10

**Interfaces:**
- Produces: `wait_healthy [기대sha]` — 인자가 있으면 commit까지 대조하고, 없으면 헬스만 본다.
  종료 코드 `0`이 통과다.

- [ ] **Step 1: 실패하는 테스트 작성**

새 파일 `infra/scripts/deploy.test.sh` (실행 권한 필요):

```bash
#!/usr/bin/env bash
# deploy.sh의 헬스 대기 로직 검증 — docs/specs/2026-09-05-build-info.md
#
# deploy.sh를 source해 함수만 부른다. curl과 sleep을 가짜로 덮어
# 「구 컨테이너가 아직 떠 있는 상황」을 재현한다. 새 의존성은 없다.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KALDI_DEPLOY_TEST=1 source "$HERE/deploy.sh"

failed=0
COMMIT=""          # 가짜 curl이 돌려줄 build.commit
COMMIT_AFTER=""    # SWITCH_AT 번째 호출부터 바뀔 값
SWITCH_AT=0
CALLS=0

# 진짜 sleep을 쓰면 AC-09가 60초 걸린다.
sleep() { :; }

curl() {
  local url="${*: -1}"
  CALLS=$((CALLS + 1))
  case "$url" in
    *"/actuator/health") echo '{"status":"UP"}' ;;
    *"/actuator/info")
      local value="$COMMIT"
      if [ "$SWITCH_AT" -gt 0 ] && [ "$CALLS" -ge "$SWITCH_AT" ]; then
        value="$COMMIT_AFTER"
      fi
      if [ -z "$value" ]; then echo '{}'; else echo "{\"build\":{\"commit\":\"$value\"}}"; fi
      ;;
  esac
}

check() {  # check <이름> <기대 종료코드> <실제 종료코드>
  if [ "$2" = "$3" ]; then
    echo "  ✓ $1"
  else
    echo "  ✗ $1 — 종료코드 기대 $2, 실제 $3"
    failed=1
  fi
}

echo "AC-BUILDINFO-06 · UP이고 sha가 맞으면 통과한다"
COMMIT="abc123"; SWITCH_AT=0; CALLS=0
wait_healthy "abc123" > /dev/null; check "AC-BUILDINFO-06" 0 $?

echo "AC-BUILDINFO-07 · UP이어도 sha가 다르면 통과하지 않는다"
COMMIT="old999"; SWITCH_AT=0; CALLS=0
wait_healthy "abc123" > /dev/null; check "AC-BUILDINFO-07" 1 $?

echo "AC-BUILDINFO-08 · 늦게 교체돼도 12회 안이면 성공이다"
COMMIT="old999"; COMMIT_AFTER="abc123"; SWITCH_AT=4; CALLS=0
wait_healthy "abc123" > /dev/null; check "AC-BUILDINFO-08" 0 $?

echo "AC-BUILDINFO-09 · 끝내 불일치면 실패로 끝난다"
COMMIT="old999"; SWITCH_AT=0; CALLS=0
wait_healthy "abc123" > /dev/null; check "AC-BUILDINFO-09" 1 $?

echo "AC-BUILDINFO-10 · 롤백은 sha를 보지 않는다"
COMMIT=""; SWITCH_AT=0; CALLS=0
wait_healthy > /dev/null; check "AC-BUILDINFO-10" 0 $?

exit "$failed"
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `chmod +x infra/scripts/deploy.test.sh && ./infra/scripts/deploy.test.sh`
Expected: **AC-07·09가 실패**(지금은 `UP`만 보므로 종료코드 0이 나온다). AC-06·08·10은 통과.
스크립트 전체 종료 코드는 `1`.

> AC-06·10이 처음부터 통과하는 것은 정상이다 — 지금 로직도 `UP`이면 통과시킨다.
> **이 태스크가 실제로 바꾸는 것은 AC-07·09다.**

- [ ] **Step 3: 최소 구현**

`infra/scripts/deploy.sh`를 「함수 정의 + 맨 끝 `main` 호출」로 나눈다. **롤백 로직은 그대로 옮기기만 한다.**

```bash
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
# 구 컨테이너가 그대로 살아 있어도 헬스체크는 통과하기 때문이다(docs/JOURNAL.md 2026-09-03).
# 인자를 비우면 헬스만 본다 — 롤백 대상은 build.commit을 모르는 구버전일 수 있다.
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
    # 롤백은 버전을 대조하지 않는다 — 직전 이미지가 build.commit을 모를 수 있다.
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

# 테스트가 source할 때는 실행하지 않는다.
if [ -z "${KALDI_DEPLOY_TEST:-}" ]; then
  main "$@"
fi
```

> **`set -e`와 `source`의 상호작용에 주의한다.** 테스트가 `set -uo pipefail`(`-e` 없이)로 시작하는 이유가
> 이것이다 — `-e`가 켜진 채로 `wait_healthy`가 1을 돌려주면 테스트 셸이 즉시 죽는다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `./infra/scripts/deploy.test.sh`
Expected: `✓` 5개, 종료 코드 `0`. **5초 안에 끝난다**(`sleep`을 덮었으므로).

```bash
time ./infra/scripts/deploy.test.sh
```

- [ ] **Step 5: 커밋**

```bash
git add . && git commit -m "feat(infra): 배포가 실행 중인 버전을 대조한다"
```

---

## Task 4: 커버리지·CI 배선 + 스펙 `status`

**Files:**
- Modify: `scripts/check-spec-coverage.sh`
- Modify: `.github/workflows/spec.yml`
- Modify: `docs/specs/2026-09-05-build-info.md`

**Covers:** 없음 (배선 태스크)

- [ ] **Step 1: 커버리지 스크립트가 셸 테스트를 본다**

`scripts/check-spec-coverage.sh`의 검색 경로에 `infra/scripts`를 추가한다:

```bash
for path in backend/src/test frontend/src frontend/e2e infra/scripts; do
```

주석도 함께 고친다(파일 상단 「backend/src/test/, frontend/src/, frontend/e2e/ 에서 찾는다」).

- [ ] **Step 2: 검사 — 지금은 건너뛴다**

Run: `./scripts/check-spec-coverage.sh`
Expected: `- docs/specs/2026-09-05-build-info.md [초안] — AC 10개, 아직 구현 단계가 아니므로 건너뜀`
**AC가 10개로 세어져야 한다.** 다른 숫자면 산문 속 AC 참조가 섞인 것이다(2026-09-03에 한 번 겪었다).

- [ ] **Step 3: CI가 셸 테스트를 돌린다**

`.github/workflows/spec.yml`의 `coverage` job에 step 추가:

```yaml
      - name: 배포 스크립트 테스트
        run: ./infra/scripts/deploy.test.sh
```

- [ ] **Step 4: 스펙 `status`를 `구현완료`로**

수동 확인이 0개이므로 바로 올린다.

Run: `./scripts/check-spec-coverage.sh`
Expected: `✓ docs/specs/2026-09-05-build-info.md [구현완료] — AC 10개 전부 테스트에 존재`

- [ ] **Step 5: 전체 검증 + 커밋**

```bash
cd backend && ./gradlew clean check && cd ..
./scripts/check-spec-coverage.sh
./infra/scripts/deploy.test.sh
git diff --stat main...HEAD | grep frontend/ && echo "★ 프론트를 건드렸다" || echo "프론트 0줄 확인"
git add . && git commit -m "docs(spec-build-info): status를 구현완료로"
```

Expected: 백엔드 **482개**(477 + 5), 커버리지 AC **508개**(498 + 10), 셸 테스트 5개 초록.

---

## 완료 기준

- [ ] `cd backend && ./gradlew clean check` 통과
- [ ] `./infra/scripts/deploy.test.sh` 통과 (5초 이내)
- [ ] `./scripts/check-spec-coverage.sh` 통과 — `BUILDINFO` 10개가 **확인됨**
- [ ] 스펙의 `status`를 `구현완료`로 변경
- [ ] `git diff --stat main...HEAD`에 `frontend/`가 0줄
- [ ] 수동 확인: 없음

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 10개 중 10개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** Task 2의 단위 테스트가 Task 1의 `BuildInfoContributor(BuildProperties)` 생성자를 쓴다.
Task 3의 셸 테스트가 Task 3에서 정의하는 `wait_healthy [기대sha]` 시그니처를 쓴다.

**확인된 사실:**

- 배포 워크플로가 `./gradlew bootJar --no-daemon`으로 **CI에서 jar을 만든다**(`backend.yml`). 따라서
  `-Pcommit`을 여기 붙이면 이미지에 굽힌다. 도커 빌드는 `COPY`만 하므로 손댈 필요가 없다.
- `deploy.sh`는 `${{ github.sha }}`(40자)를 인자로 받는다 — 기대 sha의 형식이 이미 정해져 있다.
- 저장소가 **PUBLIC**이라 커밋 sha 노출은 비밀 유출이 아니다.
- `SecurityConfig`가 `/actuator/info`를 이미 `permitAll`한다.

**검증되지 않은 가정:**

1. **Boot 4 Gradle 플러그인의 `buildInfo { properties { additional.put(...) } }` DSL이 이 형태다.**
   Boot 3.x에서 `additional`이 `MapProperty`로 바뀌었는데 코틀린 DSL 표기를 확인하지 않았다.
   Task 1 Step 3에서 깨지면 `./gradlew tasks --all | grep -i buildinfo`와 플러그인 소스로 확인한다.
   **버전을 낮추는 방식으로 해결하지 않는다.**
2. **`management.info.build.enabled: false`로 기본 기여자만 끌 수 있고 `BuildProperties` 빈은 남는다.**
   빈까지 사라지면 `BuildInfoContributor` 주입이 실패해 컨텍스트가 안 뜬다. Task 1 Step 4에서 드러난다.
3. **`buildInfo()`를 켜면 테스트 실행 시에도 `build-info.properties`가 클래스패스에 있다.**
   `bootBuildInfo` 태스크가 `classes`에 묶인다는 전제다. 없으면 `BuildProperties` 빈이 없어 Task 1이 깨진다.
4. **`DateTimeFormatter.ISO_INSTANT`의 출력이 AC-02의 정규식에 맞는다.** `2026-09-05T09:12:33Z` 또는
   소수점이 붙은 형태다. 밀리초가 0이면 소수부가 사라지므로 정규식을 그렇게 썼다.
5. **가짜 `curl` 함수가 `deploy.sh` 안의 `curl` 호출을 가로챈다.** bash 함수가 외부 명령보다 먼저 찾아지므로
   된다고 보지만, `source` 순서(테스트가 함수를 **나중에** 정의)에서도 유효한지는 Task 3 Step 2에서 확인한다.
6. **백엔드 테스트 총계가 482개가 된다** — 477 + 5(API 4 + 단위 1).

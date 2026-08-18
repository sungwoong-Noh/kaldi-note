# OCI 배포 · CI/CD 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-08-18-oci-deploy.md`

**Goal:** `main`에 머지되면 백엔드가 자동으로 OCI VM에 배포되고, `https://api.kaldi-note.today`로 실제 접속된다. 배포 실패는 헬스체크로 자동 감지되고 직전 버전으로 롤백된다. DB는 매일 자동 백업된다.

**Architecture:** `backend/Dockerfile`로 Spring Boot 애플리케이션을 이미지로 빌드한다(멀티스테이지: JDK로 `bootJar` 빌드 → JRE 런타임에 jar만 복사). GitHub Actions가 `main` 푸시마다 이 이미지를 arm64로 빌드해 GHCR에 `:<sha>`·`:latest` 두 태그로 올리고, SSH로 OCI VM에 접속해 `infra/scripts/deploy.sh`를 실행한다. 이 스크립트가 `docker compose pull && up -d` → 헬스체크 폴링 → 실패 시 직전 태그로 롤백까지 전부 담당해, GitHub Actions YAML에는 배포 로직을 길게 넣지 않는다. VM 자체(방화벽·crontab·`.env`·`docker compose` 최초 설치)는 코드로 재현할 수 없는 부분이라 스펙의 "수동 확인" 그대로 별도 런북 문서로 남긴다.

**작업 위치:** `backend/`, 저장소 루트 `infra/`, `.github/workflows/`

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `backend/CLAUDE.md` → `docs/conventions/backend.md` → `docs/conventions/git.md`

**선행 조건:** PR #58(`feat/media-attachment`)이 먼저 머지돼 있어야 한다. `application.yml`의 `kaldi.oci.*` 설정(Task 2가 `.env.example`에 나열)이 그 PR에만 있고 `main`엔 아직 없다. 이 계획을 시작하기 전에 `main`에 그 PR이 반영됐는지 확인한다.

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-DEPLOY-01 | Dockerfile이 빌드에 성공한다 | Task 1 | 통합 테스트(Testcontainers) |
| AC-DEPLOY-02 | 컨테이너 기동 후 60초 이내 헬스체크 통과 | Task 1 | 통합 테스트(Testcontainers) |

**2개 전부 매핑됨** (Task 2~4는 인프라 설정·스크립트 태스크라 직접 매핑된 AC가 없다 — 스펙이 이미 "자동 테스트로 옮길 수 없다"고 못박은 영역이다).

---

## Global Constraints

- **AC로 다루는 건 Dockerfile 빌드+헬스체크뿐이다.** SSH 배포·방화벽·cron·HTTPS 인증서·백업 업로드는 스펙의 "수동 확인" 항목이며, 이 계획도 그 구분을 그대로 따른다 — 별도 AC ID를 붙이지 않는다.
- **GHCR 이미지 경로는 `ghcr.io/sungwoong-noh/kaldi-note-api`다.** GHCR은 대문자를 허용하지 않아 저장소 소유자 `sungwoong-Noh`를 소문자로 쓴다.
- **이미지는 반드시 `linux/arm64`로 빌드한다.** OCI VM이 Ampere A1(aarch64)이기 때문이다. GitHub Actions의 `ubuntu-latest`는 amd64다. **`main`에 처음 배포하며 QEMU 에뮬레이션으로 JDK 컴파일이 극도로 느리다는 게 실측됐다(`compileJava` 하나에 500초 이상, 완주 못 함).** 최종 구조: `backend/Dockerfile`은 `RUN` 없는 단일 스테이지(`COPY build/libs/*.jar app.jar`)로 두고, jar는 GitHub Actions 러너에서 `./gradlew bootJar`로 네이티브(amd64) 컴파일한다. 이미지 빌드 자체는 메타데이터 연산(`COPY`/`ENV`/`ENTRYPOINT`)뿐이라 `linux/arm64`를 타깃으로 해도 에뮬레이션이 필요 없다 — `docker/setup-qemu-action`도 제거했다.
- **JVM 플래그는 `-XX:MaxRAMPercentage=50` 고정.** 아키텍처 문서(`architecture.md:74`)의 결정이다.
- **컨테이너 메모리 한도는 app 4GB / postgres 2GB / caddy 256MB.** 스펙에서 확정된 값.
- **PostgreSQL은 production compose에서 호스트에 포트 매핑하지 않는다.** 로컬 개발용 루트 `docker-compose.yml`(5432 매핑)은 건드리지 않는다 — 별개 파일이다.
- **비밀값은 VM의 `infra/.env`(git 미추적) 하나로 통일한다.** `docker compose`가 compose 파일 변수 치환과 컨테이너 환경변수 주입 둘 다에 이 파일을 쓴다.
- **배포 로직(헬스체크 폴링·롤백)은 GitHub Actions YAML이 아니라 `infra/scripts/deploy.sh`에 둔다.** 매 배포마다 최신 스크립트를 VM에 복사(scp)한 뒤 실행해, 로직이 바뀌어도 VM에 수동 개입이 필요 없다.
- **헬스체크 실패 후 롤백에 성공해도 워크플로는 실패로 표시한다.** 스펙 결정 8 — 성공한 롤백이라도 `main`의 최신 배포가 실패했다는 신호는 남아야 한다.

---

## File Structure

```
backend/
└── Dockerfile                                          (Create — Task 1)

backend/src/test/java/com/kaldinote/deploy/
└── DockerfileHealthcheckTest.java                       (Create — Task 1)

backend/src/main/resources/
└── application-prod.yml                                 (Create — Task 2)

infra/
├── docker-compose.prod.yml                               (Create — Task 2)
├── Caddyfile                                              (Create — Task 2)
├── .env.example                                           (Create — Task 4)
├── README.md                                              (Create — Task 4, 배포 런북)
└── scripts/
    ├── deploy.sh                                          (Create — Task 3)
    └── backup-pg-dump.sh                                  (Create — Task 4)

.github/workflows/backend.yml                              (Modify — Task 3, deploy job 추가)
```

---

## Task 1: Dockerfile + 빌드·헬스체크 테스트

**Files:**
- Create: `backend/Dockerfile`
- Test: `backend/src/test/java/com/kaldinote/deploy/DockerfileHealthcheckTest.java`

**Covers:** AC-DEPLOY-01, AC-DEPLOY-02

**Interfaces:**
- Consumes: 없음 (이 계획의 첫 태스크)
- Produces: `backend/Dockerfile` — Task 2의 `docker-compose.prod.yml`과 Task 3의 GitHub Actions 빌드 스텝이 이 파일을 그대로 쓴다. 이미지 내부에서 앱은 `8080` 포트로 뜨고, `-XX:MaxRAMPercentage=50`을 `JAVA_OPTS` 환경변수로 받는다(기본값 포함, 없어도 뜬다).

- [x] **Step 1: 실패하는 테스트 작성**

`backend/Dockerfile`이 아직 없으므로 이 테스트는 이미지 빌드 단계에서 실패한다.

```java
package com.kaldinote.deploy;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.File;
import java.time.Duration;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.ImageFromDockerfile;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

class DockerfileHealthcheckTest {

  private static final File DOCKERFILE_CONTEXT = new File(System.getProperty("user.dir"));

  @Test
  @DisplayName("AC-DEPLOY-01 · Dockerfile이 빌드에 성공한다")
  void Dockerfile이_빌드에_성공한다() {
    ImageFromDockerfile image =
        new ImageFromDockerfile()
            .withDockerfile(DOCKERFILE_CONTEXT.toPath().resolve("Dockerfile"));

    assertThat(image.get()).isNotBlank();
  }

  @Test
  @DisplayName("AC-DEPLOY-02 · 컨테이너 기동 후 60초 이내에 헬스체크가 통과한다")
  void 컨테이너_기동_60초_이내_헬스체크가_통과한다() {
    try (Network network = Network.newNetwork();
        PostgreSQLContainer postgres =
            new PostgreSQLContainer(DockerImageName.parse("postgres:17-alpine"))
                .withNetwork(network)
                .withNetworkAliases("postgres")
                .withDatabaseName("kaldinote")
                .withUsername("kaldinote")
                .withPassword("localdev")) {
      postgres.start();

      ImageFromDockerfile image =
          new ImageFromDockerfile()
              .withDockerfile(DOCKERFILE_CONTEXT.toPath().resolve("Dockerfile"));

      try (GenericContainer<?> app =
          new GenericContainer<>(image)
              .withNetwork(network)
              .withExposedPorts(8080)
              .withEnv("SPRING_DATASOURCE_URL", "jdbc:postgresql://postgres:5432/kaldinote")
              .withEnv("SPRING_DATASOURCE_USERNAME", "kaldinote")
              .withEnv("SPRING_DATASOURCE_PASSWORD", "localdev")
              .withEnv("KALDI_JWT_SECRET", "local-development-only-secret-key-32bytes-minimum")
              .withEnv("KAKAO_CLIENT_ID", "dummy")
              .withEnv("GOOGLE_CLIENT_ID", "dummy")
              .withEnv("GOOGLE_CLIENT_SECRET", "dummy")
              .waitingFor(
                  Wait.forHttp("/actuator/health")
                      .forStatusCode(200)
                      .forResponsePredicate(body -> body.contains("\"status\":\"UP\""))
                      .withStartupTimeout(Duration.ofSeconds(60)))) {
        app.start();

        assertThat(app.isRunning()).isTrue();
      }
    }
  }
}
```

**주의:** `DOCKERFILE_CONTEXT`는 `System.getProperty("user.dir")`를 쓴다 — Gradle이 테스트를 `backend/` 디렉터리를 작업 디렉터리로 실행하므로 `backend/Dockerfile`을 정확히 가리킨다. `PostgreSQLContainer`는 제네릭 없는 raw type이다 — `TestcontainersConfiguration.java`와 동일한 이유(Boot 4 마이그레이션 시 패키지가 `org.testcontainers.containers`에서 `org.testcontainers.postgresql`로 옮기며 제네릭도 사라졌다).

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `./gradlew test --tests '*DockerfileHealthcheckTest'`
Expected: FAIL — `backend/Dockerfile`이 없어 `ImageFromDockerfile`이 `NoSuchFileException` 또는 빌드 실패로 예외를 던진다.

- [x] **Step 3: Dockerfile 작성**

```dockerfile
# syntax=docker/dockerfile:1

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY build/libs/*.jar app.jar
ENV JAVA_OPTS="-XX:MaxRAMPercentage=50"
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
```

**계획 작성 시점과 다른 점(실제 실행으로 확인됨, 두 번 바뀌었다):**
1. 원래 계획은 빌드 스테이지에 `FROM --platform=$BUILDPLATFORM ...`를 써서 QEMU 에뮬레이션 없이 크로스 빌드하려 했다. Testcontainers의 `ImageFromDockerfile`이 classic build API를 써서 `$BUILDPLATFORM`을 치환 못하고 `DockerClientException`으로 깨져, 플랫폼 고정 없는 멀티스테이지(JDK 빌드 스테이지 + JRE 런타임 스테이지)로 바꿨다.
2. **`main`에 처음 머지된 뒤 실제 GHCR 빌드에서 이 멀티스테이지가 QEMU 에뮬레이션으로 `compileJava` 하나에만 500초 넘게 걸리는 게 실측됐다.** JVM 컴파일이 에뮬레이션에서 특히 느리다. **최종 해결책:** Dockerfile을 완전히 단일 스테이지로 바꿔 `RUN`을 아예 없앴다 — 컴파일은 GitHub Actions 러너(amd64, 네이티브)에서 `./gradlew bootJar`로 미리 끝내고, Dockerfile은 그 jar를 `COPY`만 한다. `COPY`·`ENV`·`ENTRYPOINT`는 메타데이터 연산이라 타깃 아키텍처와 무관하게 에뮬레이션이 필요 없다. 이 변경 때문에 Task 3의 `docker/setup-qemu-action` 스텝도 제거했다(더 이상 어떤 스텝도 타깃 아키텍처 코드를 실행하지 않는다).

이 두 번째 수정으로 `backend/build.gradle.kts`에 `tasks.named("test") { dependsOn("bootJar") }`가 추가됐다 — `DockerfileHealthcheckTest`가 이미지를 빌드하기 전에 `build/libs/*.jar`가 반드시 있어야 하기 때문이다.

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `./gradlew test --tests '*DockerfileHealthcheckTest'`
Expected: PASS, 2 tests. (이미지 빌드가 포함돼 있어 다른 테스트보다 오래 걸린다 — 첫 실행 약 2분, 이후 Docker 레이어 캐시로 더 빠를 수 있다. 정상이다.)

- [x] **Step 5: 커밋**

```bash
./gradlew spotlessApply && ./gradlew clean check
cd .. && git add backend/Dockerfile backend/src/test/java/com/kaldinote/deploy/DockerfileHealthcheckTest.java && git commit -m "feat(deploy): Dockerfile + 빌드·헬스체크 테스트 (AC 2개)" && cd backend
```

---

## Task 2: 운영 프로필 + production docker-compose + Caddyfile

**Files:**
- Create: `backend/src/main/resources/application-prod.yml`
- Create: `infra/docker-compose.prod.yml`
- Create: `infra/Caddyfile`

**Covers:** 없음 (인프라 설정 파일. 자동 테스트로 옮길 수 없다고 스펙이 명시한 영역)

**Interfaces:**
- Consumes: Task 1의 `backend/Dockerfile` (이미지 빌드 방식)
- Produces: `infra/docker-compose.prod.yml`의 서비스명 `app`·`postgres`·`caddy` — Task 3의 `deploy.sh`가 `docker compose -f infra/docker-compose.prod.yml pull app`으로 이 서비스명을 그대로 쓴다. 이미지 태그는 컴포즈 변수 `KALDI_IMAGE_TAG`로 주입한다(기본값 `latest`).

- [x] **Step 1: `application-prod.yml` 작성**

```yaml
spring:
  jpa:
    properties:
      hibernate:
        format_sql: false
logging:
  level:
    org.hibernate.SQL: warn
```

운영에 필요한 값(`KALDI_JWT_SECRET`, `KAKAO_CLIENT_ID` 등)은 전부 루트 `application.yml`이 이미 `${VAR}` 형태로 요구하고 있어 이 파일에 다시 쓸 필요가 없다. `spring.datasource.*`도 `docker-compose.prod.yml`이 환경변수로 주입하므로 여기서 하드코딩하지 않는다.

- [x] **Step 2: `infra/docker-compose.prod.yml` 작성**

```yaml
services:
  app:
    image: ghcr.io/sungwoong-noh/kaldi-note-api:${KALDI_IMAGE_TAG:-latest}
    container_name: kaldi-note-app
    restart: unless-stopped
    mem_limit: "4g"
    env_file:
      - path: .env
        required: false
    environment:
      SPRING_PROFILES_ACTIVE: prod
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/kaldinote
      SPRING_DATASOURCE_USERNAME: kaldinote
      SPRING_DATASOURCE_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD가 .env에 있어야 한다}
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - kaldi-net

  postgres:
    image: postgres:17-alpine
    container_name: kaldi-note-postgres
    restart: unless-stopped
    mem_limit: "2g"
    environment:
      POSTGRES_DB: kaldinote
      POSTGRES_USER: kaldinote
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD가 .env에 있어야 한다}
    volumes:
      - kaldi-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kaldinote -d kaldinote"]
      interval: 5s
      timeout: 3s
      retries: 10
    networks:
      - kaldi-net

  caddy:
    image: caddy:2-alpine
    container_name: kaldi-note-caddy
    restart: unless-stopped
    mem_limit: "256m"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - app
    networks:
      - kaldi-net

networks:
  kaldi-net:

volumes:
  kaldi-pgdata:
  caddy-data:
  caddy-config:
```

`env_file`이 `app` 서비스 컨테이너에 `.env`의 모든 줄(`KALDI_JWT_SECRET`, `KAKAO_CLIENT_ID`, `OCI_*` 등)을 그대로 환경변수로 주입한다. `POSTGRES_PASSWORD`는 컴포즈 파일 자체의 변수 치환(`${...}`)에도 쓰이므로 `.env`가 두 역할을 동시에 한다 — Global Constraints에 적어둔 대로다. `required: false`를 쓴 이유는 Step 4에서 실제로 확인됨 — 아래 참조.

- [x] **Step 3: `infra/Caddyfile` 작성**

```
api.kaldi-note.today {
	reverse_proxy app:8080
}
```

루트 도메인(`kaldi-note.today`)은 프론트(Cloudflare, Plan 4)가 맡으므로 이 Caddy 인스턴스는 API 서브도메인만 처리한다.

- [x] **Step 4: 구문 검증**

Run:
```bash
cd infra && POSTGRES_PASSWORD=dummy docker compose -f docker-compose.prod.yml config -q && cd ..
docker run --rm -v "$(pwd)/infra/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```
Expected: 둘 다 종료 코드 0.

**계획 작성 시점과 다른 점(실제 실행으로 확인됨):** `env_file: - .env`(짧은 형식)는 `.env` 파일이 실제로 없으면 `docker compose config`가 "env file ... not found"로 즉시 실패했다 — "변수 경고만 뜨고 성공"이라는 원래 예상은 틀렸다. Compose Spec의 긴 형식(`path` + `required: false`)으로 바꿔 파일이 없어도 구문 검증이 통과하게 했다(운영에서 `.env`가 실제로 없으면 앱이 필수 환경변수 누락으로 기동 실패하니 안전은 그대로 유지된다). `docker-compose.prod.yml`의 `env_file` 블록에 반영했다.

- [x] **Step 5: 커밋**

```bash
git add backend/src/main/resources/application-prod.yml infra/docker-compose.prod.yml infra/Caddyfile
git commit -m "feat(deploy): 운영 프로필 + production docker-compose + Caddyfile"
```

---

## Task 3: GitHub Actions 배포 job + deploy.sh

**Files:**
- Create: `infra/scripts/deploy.sh`
- Modify: `.github/workflows/backend.yml`

**Covers:** 없음 (인프라 스크립트·워크플로. 자동 테스트로 옮길 수 없는 영역)

**Interfaces:**
- Consumes: Task 2의 `infra/docker-compose.prod.yml` 서비스명 `app`, 변수 `KALDI_IMAGE_TAG`
- Produces: `infra/scripts/deploy.sh <git-sha>` — VM에서 실행되는 배포 진입점. 성공하면 종료 코드 0, 헬스체크 실패(롤백 성공 포함)면 종료 코드 1.

- [x] **Step 1: `infra/scripts/deploy.sh` 작성**

```bash
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
```

- [x] **Step 2: 실행 권한 부여 확인**

Run: `chmod +x infra/scripts/deploy.sh && git diff --stat infra/scripts/deploy.sh`
Expected: 파일 모드 변경(`100644` → `100755`)이 `git diff`에 잡힌다. git이 실행 비트를 추적하므로 커밋에 포함돼야 VM에서 별도 `chmod` 없이도 동작한다(단, Step 4의 SSH 스텝에서도 안전하게 `chmod +x`를 한 번 더 실행한다).

- [x] **Step 3: `.github/workflows/backend.yml`에 `deploy` job 추가**

기존 `check` job 아래에 추가한다 (전체 파일이 아니라 추가되는 부분만 표시):

```yaml
  deploy:
    name: OCI VM 배포
    needs: check
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: JDK 21 설치
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'

      - name: Gradle 설정 (캐시 포함)
        uses: gradle/actions/setup-gradle@v4

      # 이미지는 이미 만들어진 jar를 COPY만 한다 — RUN이 없어 크로스 빌드에 에뮬레이션이 불필요하다.
      # 컴파일은 여기서(amd64 러너, 네이티브) 미리 끝낸다.
      - name: bootJar 빌드 (네이티브)
        working-directory: backend
        run: ./gradlew bootJar --no-daemon

      - name: Buildx 설정
        uses: docker/setup-buildx-action@v3

      - name: GHCR 로그인
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: 이미지 빌드 + 푸시 (arm64, sha + latest)
        uses: docker/build-push-action@v6
        with:
          context: backend
          platforms: linux/arm64
          push: true
          tags: |
            ghcr.io/sungwoong-noh/kaldi-note-api:${{ github.sha }}
            ghcr.io/sungwoong-noh/kaldi-note-api:latest

      - name: 배포 스크립트를 VM으로 복사
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.OCI_VM_HOST }}
          username: ${{ secrets.OCI_VM_USER }}
          key: ${{ secrets.OCI_VM_SSH_KEY }}
          source: "infra/scripts/deploy.sh"
          target: "/opt/kaldi-note/infra/scripts"
          strip_components: 2

      - name: VM에서 배포 실행
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.OCI_VM_HOST }}
          username: ${{ secrets.OCI_VM_USER }}
          key: ${{ secrets.OCI_VM_SSH_KEY }}
          script: |
            chmod +x /opt/kaldi-note/infra/scripts/deploy.sh
            /opt/kaldi-note/infra/scripts/deploy.sh ${{ github.sha }}
```

`needs: check`와 `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` 덕분에 PR에서는 이 job이 아예 돌지 않고, `main` 푸시에서 `check`가 통과했을 때만 돈다. GH Actions IP 대역 허용은 VM 방화벽 쪽 설정(Task 4 런북)이지 이 워크플로 파일의 책임이 아니다.

- [x] **Step 4: YAML 문법 검증**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/backend.yml'))" && echo OK`
Expected: `OK` 출력. (구문 오류만 잡는다 — GitHub Actions 자체 스키마 검증은 실제 푸시 시점에 GitHub이 한다.)

- [x] **Step 5: 커밋**

```bash
git add infra/scripts/deploy.sh .github/workflows/backend.yml
git commit -m "feat(deploy): GitHub Actions 배포 job + deploy.sh (SSH 배포, 헬스체크, 자동 롤백)"
```

---

## Task 4: 백업 스크립트 + `.env` 템플릿 + 배포 런북

**Files:**
- Create: `infra/scripts/backup-pg-dump.sh`
- Create: `infra/.env.example`
- Create: `infra/README.md`

**Covers:** 없음 (운영 스크립트·문서)

**Interfaces:**
- Consumes: Task 2의 `docker-compose.prod.yml` 컨테이너명 `kaldi-note-postgres`
- Produces: 없음 (이 계획의 마지막 태스크)

- [x] **Step 1: `infra/scripts/backup-pg-dump.sh` 작성**

```bash
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
```

- [x] **Step 2: `infra/.env.example` 작성**

```bash
# 실제 값을 채운 .env 파일을 VM의 /opt/kaldi-note/infra/ 안에 직접 만든다.
# .env는 git에 커밋하지 않는다 (루트 .gitignore의 .env / .env.* 패턴이 이미 커버한다).

POSTGRES_PASSWORD=

KALDI_JWT_SECRET=
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
KAKAO_REDIRECT_URI=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

OCI_TENANCY_ID=
OCI_USER_ID=
OCI_FINGERPRINT=
OCI_PRIVATE_KEY=
OCI_REGION=ap-chuncheon-1
OCI_NAMESPACE=
OCI_BUCKET_NAME=
```

**계획 작성 시점과 다른 점(실제 실행으로 확인됨):** `infra/.gitignore`는 만들지 않는다. `git check-ignore -v infra/.env`로 직접 확인해보니 루트 `.gitignore`의 `.env`/`.env.*`/`!.env.example` 패턴(경로 접두어 없음)이 이미 모든 하위 디렉터리에 적용돼 `infra/.env`도 무시되고 `infra/.env.example`만 예외로 살아남는다. 별도 파일을 만들면 중복이었다.

- [x] **Step 3: `infra/README.md`(배포 런북) 작성**

```markdown
# 배포 런북

코드로 재현할 수 없는 VM 최초 설정과, 배포 후 사람이 직접 확인해야 할 항목이다.
스펙 `docs/specs/2026-08-18-oci-deploy.md`의 "수동 확인" 절과 1:1로 대응한다.

## VM 최초 설정 (1회)

1. `/opt/kaldi-note/infra`에 이 저장소의 `infra/` 디렉터리를 배치한다(git clone 또는 scp).
2. `infra/.env.example`을 `infra/.env`로 복사하고 실제 값을 채운다.
3. VM 타임존을 KST로 맞춘다: `sudo timedatectl set-timezone Asia/Seoul`
4. OCI CLI를 설치하고 인증을 설정한다(`backup-pg-dump.sh`가 `oci os object put/list/delete`를 쓴다): `bash -c "$(curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh)"` 후 `oci setup config`로 `infra/.env`와 같은 자격증명을 등록한다.
5. `crontab -e`로 매일 백업을 등록한다:
   ```
   0 3 * * * /opt/kaldi-note/infra/scripts/backup-pg-dump.sh >> /var/log/kaldi-backup.log 2>&1
   ```
6. VM 방화벽(iptables/ufw + OCI Security List 둘 다)에서 80·443을 전체 허용, 22는 GitHub Actions IP 대역만 허용하고 나머지(5432 포함)는 차단한다. GitHub Actions IP 대역은 `https://api.github.com/meta`의 `actions` 키로 확인한다.
7. GitHub 저장소 Settings → Secrets에 `OCI_VM_HOST`·`OCI_VM_USER`·`OCI_VM_SSH_KEY`를 등록한다.
8. DNS에서 `api.kaldi-note.today` A 레코드가 이 VM의 공인 IP를 가리키는지 확인한다.
9. `cd /opt/kaldi-note/infra && docker compose -f docker-compose.prod.yml up -d`로 최초 기동한다.

## 배포 후 확인 (스펙의 "수동 확인" 그대로)

- [x] `main`에 머지하면 `backend.yml`의 `deploy` job이 돌고, GHCR에 `:<git-sha>`·`:latest` 두 태그가 모두 올라간다
- [x] SSH 액션이 VM에 접속해 배포하고, VM에서 새 컨테이너가 뜬다
- [x] 배포 직후 `https://api.kaldi-note.today/actuator/health`가 60초 이내 HTTP 200을 반환한다
- [ ] 헬스체크가 실패하도록 강제했을 때, 직전 태그로 자동 롤백되고 워크플로가 실패로 표시된다
- [x] `nmap`이나 외부 접속 시도로 5432(PostgreSQL)가 막혀 있는지 확인한다 — 2026-08-19
- [x] `https://api.kaldi-note.today`가 유효한 HTTPS 인증서로 응답한다(Caddy 자동 발급)
- [x] `crontab -l`에 백업 작업이 등록돼 있고, 다음날 Object Storage에 백업 파일이 실제로 생긴다 — 2026-08-19, 매분 임시 등록으로 cron 실동작까지 확인
- [x] 백업 버킷이 private이고 사진 버킷(public)과 분리돼 있다 — 2026-08-19, 인증 없는 GET이 404
- [x] 8일 연속 백업 후 버킷에 최근 7개만 남아 있다 — 2026-08-19, 과거 날짜 더미로 회전 검증
- [ ] `.env`의 값으로 카카오/구글 실계정 로그인과 사진 업로드가 실제로 동작한다
```

- [x] **Step 4: 커밋**

```bash
git add infra/scripts/backup-pg-dump.sh infra/.env.example infra/README.md
git commit -m "docs(deploy): 백업 스크립트 + .env 템플릿 + 배포 런북"
```

---

## 완료 기준

- [x] `cd backend && ./gradlew clean check` 통과 (`DockerfileHealthcheckTest` 포함 — 이미지 빌드가 들어가 다른 태스크보다 느리다)
- [x] `./scripts/check-spec-coverage.sh` 통과 (스펙 `status`를 `구현완료`로 바꾼 뒤 실행) — AC-DEPLOY-01·02가 테스트에 존재하는지 확인
- [x] 스펙(`docs/specs/2026-08-18-oci-deploy.md`)의 `status`를 `구현완료`로 변경
- [x] `infra/docker-compose.prod.yml`·`Caddyfile`·`deploy.sh`·`backup-pg-dump.sh`가 전부 존재하고, `docker compose config`로 구문 검증됨
- [x] **`infra/README.md`의 "배포 후 확인" 체크리스트(= 스펙의 수동 확인)는 이 계획의 완료 기준에 포함하지 않는다.** 실제 OCI VM·도메인·GitHub Secrets가 있어야 확인 가능해, 코드 작성 세션이 아니라 사용자가 직접 VM에 접속해 진행할 별도 단계다. 미디어 첨부 계획 때도 실제 OCI 자격증명 검증은 동일하게 배포 이후로 미뤘다

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 2개 중 2개가 Task 1에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음. 모든 코드·설정 블록이 그대로 붙여넣을 수 있는 실제 내용임

**타입 일관성:** `docker-compose.prod.yml`의 서비스명(`app`)과 `deploy.sh`의 `docker compose ... pull app`, GitHub Actions의 이미지 태그(`${{ github.sha }}` = `deploy.sh`의 `$1`)가 전부 일치함

**검증되지 않은 가정:**
- **~~`FROM --platform=$BUILDPLATFORM`로 에뮬레이션을 피한다~~ — Task 1 구현 중 반증됨, 그다음 대안도 반증됨.** 1차: Testcontainers classic build API가 `$BUILDPLATFORM`을 치환 못해 깨짐 → 플랫폼 고정 없는 멀티스테이지로 변경. 2차: **`main`에 처음 머지한 실제 배포에서 그 멀티스테이지가 QEMU 에뮬레이션으로 `compileJava`에만 500초 이상 걸리는 게 확인됐다**(워크플로를 수동으로 취소함). **최종 확정:** `fix/docker-build-no-emulation`에서 Dockerfile을 `RUN` 없는 단일 스테이지로 바꾸고 `bootJar`를 GitHub Actions 러너에서 네이티브로 미리 빌드하도록 고쳤다 — 이 방식은 로컬(`./gradlew clean check`, 44초)에서 확인됐고, 실제 GHCR 크로스 빌드에서의 재시도 결과는 다음 세션에서 확인해야 한다
- **`appleboy/scp-action`·`appleboy/ssh-action`의 최신 메이저 버전(v0.1.7, v1.2.0)이 실제로 존재하고 인터페이스가 이 계획과 같은지.** 마켓플레이스 액션은 계획 작성 시점 기준으로 골랐다 — Task 3 Step 3에서 실제 워크플로 실행 시 버전 태그가 유효한지 반드시 확인한다
- **`docker exec kaldi-note-postgres pg_dump`가 `postgres:17-alpine` 이미지 안의 `pg_dump` 버전과 호환되는지.** 같은 메이저 버전(17)이라 문제없어야 하지만 실제 백업 파일을 한 번 복원해보기 전까지는 가정이다(스펙이 복구 리허설을 비목표로 뺐으므로 이 계획도 검증하지 않는다)
- **OCI CLI 공식 설치 스크립트(`install.sh`)가 Ubuntu 24.04 aarch64에서 문제없이 도는지.** `infra/README.md`에 설치 단계를 추가했지만(자체 검토에서 발견해 반영), 실제 실행은 VM 접속 시점에 처음 확인된다

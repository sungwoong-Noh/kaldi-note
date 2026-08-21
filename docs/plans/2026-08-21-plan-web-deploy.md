# 프론트엔드 배포 — Cloudflare Workers 구현 계획

> 작성 규칙은 [`docs/conventions/workflow.md`](../conventions/workflow.md) 참조.

**Spec:** `docs/specs/2026-08-21-web-deploy.md`

**Goal:** `main`에 프론트 변경이 머지되면 자동으로 Cloudflare Workers에 배포되고, 폰 브라우저에서 `https://kaldi-note.today`로 접속해 카카오 로그인부터 레시피 포크까지 할 수 있다.

**Architecture:** `@opennextjs/cloudflare`로 Next 16 앱을 Worker 번들로 변환하고 `wrangler deploy`로 올린다. **핵심 판단은 검증을 workerd에서 한다는 것**이다 — 기존 테스트 59개는 Node + jsdom에서 돌고 배포 대상은 workerd라, 지금 구조로는 "노드에선 되는데 Workers에선 안 되는" 부류를 잡을 수 없다. 그래서 빌드 산출물을 실제 workerd에 띄워 HTTP로 검사하는 테스트를 별도 vitest 설정으로 만들고, 빌드가 오래 걸리므로 기존 `pnpm test`와 분리해 CI와 배포 전에만 돌린다.

**작업 위치:** `frontend/` (Task 1~3) → 저장소 루트 (Task 4)

**반드시 먼저 읽을 것:** `CLAUDE.md`(루트) → `frontend/CLAUDE.md` → `docs/conventions/frontend.md` → `docs/conventions/git.md`

---

## AC 커버리지 매핑

| AC ID | 요약 | 담당 태스크 | 검증 방식 |
|---|---|---|---|
| AC-WEBDEPLOY-01 | OpenNext 빌드가 Worker 번들 산출 | Task 1 | 통합 테스트 `WorkerBuildTest` |
| AC-WEBDEPLOY-02 | workerd에서 `/login` 200 | Task 2 | 통합 테스트 `WorkerSmokeTest` |
| AC-WEBDEPLOY-03 | 응답에 운영 redirect_uri 포함 인가 URL | Task 2 | 통합 테스트 `WorkerSmokeTest` |
| AC-WEBDEPLOY-04 | BFF 로그인이 httpOnly 쿠키를 심음 | Task 2 | 통합 테스트 `WorkerSmokeTest` |
| AC-WEBDEPLOY-05 | 그 쿠키에 Secure 속성 | Task 2 | 통합 테스트 `WorkerSmokeTest` |
| AC-WEBDEPLOY-06 | `/`가 `/recipes`로 리다이렉트 | Task 2 | 통합 테스트 `WorkerSmokeTest` |

스펙의 AC 6개 중 6개가 매핑됐다. Task 3(배포 워크플로)과 Task 4(문서 정정)는 AC를 담당하지 않는다 — 스펙의 「배포 워크플로 동작」과 「수동 확인」이 그 검증을 맡는다.

---

## Global Constraints

- **`any` 금지, `as` 단언 금지.** 기존 규칙 그대로다.
- **워커 테스트는 기존 `pnpm test`에 섞지 않는다.** OpenNext 빌드가 매번 돌면 59개 테스트의 3.8초가 분 단위가 된다. 별도 설정 파일과 별도 스크립트로 나눈다.
- **포트를 고정한다.** `NEXT_PUBLIC_*`는 빌드 타임에 번들에 박히므로, 테스트용 백엔드 스텁 주소를 빌드 시점에 알아야 한다. 랜덤 포트를 쓸 수 없다.
- **`.open-next/`는 커밋하지 않는다.** `.gitignore`에 추가한다.
- **Cloudflare 대시보드·카카오 콘솔·VM SSH는 사람이 한다.** 에이전트에게 접근 권한이 없다. 해당 단계는 명령을 만들어 사람에게 넘기고 출력을 받아 판정한다.

---

## File Structure

```
frontend/
├── package.json                          Modify: 의존성 + 스크립트 추가
├── wrangler.jsonc                        Create: Worker 설정
├── open-next.config.ts                   Create: OpenNext 설정
├── vitest.worker.config.mts              Create: 워커 테스트 전용 설정
├── .gitignore                            Modify: .open-next 추가
└── src/test/worker/
    ├── globalSetup.ts                    Create: 빌드 + workerd + 스텁 기동
    ├── build.test.ts                      Create: WorkerBuildTest (AC-01)
    └── smoke.test.ts                      Create: WorkerSmokeTest (AC-02~06)

.github/workflows/frontend.yml            Modify: deploy job 추가

CLAUDE.md                                 Modify: Vercel 표기 정정
docs/design/2026-08-14-architecture.md    Modify: 같음
frontend/CLAUDE.md                        Modify: 같음
```

---

## Task 1: OpenNext 빌드 파이프라인

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/wrangler.jsonc`
- Create: `frontend/open-next.config.ts`
- Create: `frontend/vitest.worker.config.mts`
- Create: `frontend/src/test/worker/build.test.ts`
- Modify: `frontend/.gitignore`

**Covers:** AC-WEBDEPLOY-01

**Interfaces:**
- Produces: `.open-next/worker.js`(Worker 진입점)와 `.open-next/assets/`(정적 자산). Task 2가 이 두 경로에 의존한다.
- Produces: `pnpm build:worker` 스크립트. Task 2·3이 호출한다.

> **이 태스크가 이 계획에서 가장 불확실하다.** Next 16.3.1 + React 19.2.8 조합에서 OpenNext가 실제로 도는지는 문서의 지원 범위 선언(`"All minor and patch versions of Next.js 16 ... are supported"`)만 확인했을 뿐 직접 돌려본 적이 없다. **Step 3에서 막히면 뒤 태스크의 모양이 전부 달라지므로, 여기서 실패하면 계획을 이어가지 말고 사람에게 보고한다.**

- [ ] **Step 1: 의존성 설치**

Run:
```bash
cd frontend
pnpm add @opennextjs/cloudflare@latest
pnpm add -D wrangler@latest
```

Expected: `package.json`에 두 패키지가 추가되고 설치가 성공한다. `wrangler`는 3.99.0 이상이어야 한다 — 확인:
```bash
pnpm exec wrangler --version
```

- [ ] **Step 2: 설정 파일 작성**

`frontend/wrangler.jsonc`:
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "main": ".open-next/worker.js",
  "name": "kaldi-note-web",
  // OpenNext 문서가 요구하는 최소 날짜. 올릴 때는 Workers 런타임 변경점을 확인하고 올린다.
  "compatibility_date": "2024-12-30",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "services": [
    {
      "binding": "WORKER_SELF_REFERENCE",
      "service": "kaldi-note-web"
    }
  ]
}
```

`frontend/open-next.config.ts`:
```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 증분 캐시(R2)는 쓰지 않는다. 레시피 상세의 오프라인 캐시는 PWA 슬라이스에서
// Service Worker로 다루기로 했고(스펙의 범위 밖), R2 버킷을 지금 붙이면
// 그때 전략을 두 번 정하게 된다.
export default defineCloudflareConfig({});
```

`frontend/.gitignore`에 추가:
```
.open-next
```

- [ ] **Step 3: 빌드 스크립트 추가 후 실제로 돌려본다**

`package.json`의 `scripts`에 추가:
```json
"build:worker": "opennextjs-cloudflare build",
"preview:worker": "opennextjs-cloudflare preview",
"deploy:worker": "opennextjs-cloudflare deploy"
```

Run:
```bash
cd frontend && NEXT_PUBLIC_API_BASE_URL=https://api.kaldi-note.today \
  NEXT_PUBLIC_KAKAO_REDIRECT_URI=https://kaldi-note.today/auth/callback \
  NEXT_PUBLIC_KAKAO_CLIENT_ID=dummy \
  pnpm build:worker
```

Expected: 종료 코드 0. `.open-next/worker.js`와 `.open-next/assets/`가 생긴다.

**실패하면 여기서 멈추고 보고한다.** 흔히 걸릴 지점: Next 16의 빌드 산출물 구조 변화, `next typegen`이 만드는 타입과의 충돌, React 19.2.8과 어댑터의 불일치. 어느 쪽이든 계획 수정이 필요하다.

- [ ] **Step 4: 실패하는 테스트 작성**

`frontend/vitest.worker.config.mts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/worker/**/*.test.ts"],
    globalSetup: ["src/test/worker/globalSetup.ts"],
    // 빌드와 workerd 기동을 globalSetup이 담당한다. 개별 테스트는 HTTP 요청만 하므로 짧아도 된다.
    testTimeout: 30_000,
    hookTimeout: 300_000,
    environment: "node",
  },
});
```

`package.json`에 추가:
```json
"test:worker": "vitest run --config vitest.worker.config.mts"
```

`frontend/src/test/worker/build.test.ts`:
```ts
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** WorkerBuildTest */
describe("WorkerBuildTest", () => {
  it("AC-WEBDEPLOY-01 · OpenNext 빌드가 Worker 번들을 산출한다", () => {
    // globalSetup이 빌드를 끝낸 뒤에만 이 테스트가 실행된다.
    // 빌드가 0이 아닌 코드로 끝나면 globalSetup이 던져 스위트 전체가 실패한다.
    expect(existsSync(resolve(__dirname, "../../../.open-next/worker.js"))).toBe(
      true,
    );
    expect(existsSync(resolve(__dirname, "../../../.open-next/assets"))).toBe(
      true,
    );
  });
});
```

- [ ] **Step 5: 테스트 실행 — 실패 확인**

`globalSetup.ts`를 아직 만들지 않았으므로 먼저 빈 파일로 만든 뒤, `.open-next`를 지우고 돌린다.

Run:
```bash
cd frontend && rm -rf .open-next && pnpm test:worker
```
Expected: FAIL — `.open-next/worker.js`가 없어 `existsSync`가 `false`를 반환한다.

- [ ] **Step 6: globalSetup에 빌드 실행 추가**

`frontend/src/test/worker/globalSetup.ts`:
```ts
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** 워커 테스트용 백엔드 스텁이 뜰 포트. 빌드 타임에 번들에 박히므로 고정값이어야 한다. */
export const STUB_PORT = 8788;

const frontendRoot = resolve(__dirname, "../../..");

export default async function setup() {
  execFileSync("pnpm", ["build:worker"], {
    cwd: frontendRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      // 백엔드 호출은 로컬 스텁으로 보낸다(AC-04·05).
      NEXT_PUBLIC_API_BASE_URL: `http://localhost:${STUB_PORT}`,
      // redirect_uri만 운영값이어야 한다(AC-03).
      NEXT_PUBLIC_KAKAO_REDIRECT_URI: "https://kaldi-note.today/auth/callback",
      NEXT_PUBLIC_KAKAO_CLIENT_ID: "test-kakao-client-id",
    },
  });
}
```

- [ ] **Step 7: 테스트 실행 — 통과 확인**

Run: `cd frontend && rm -rf .open-next && pnpm test:worker`
Expected: PASS, 1 test

- [ ] **Step 8: 기존 검증이 깨지지 않았는지 확인**

Run: `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: 전부 통과, 테스트 59개 그대로

`vitest.config.mts`의 `include`가 `src/test/worker/`를 집어삼키지 않는지 확인한다. 삼킨다면 기존 설정에 `exclude`를 추가한다.

- [ ] **Step 9: 커밋**

```bash
cd frontend && pnpm format && cd ..
git add . && git commit -m "chore(web): OpenNext 빌드 파이프라인 (AC-WEBDEPLOY-01)"
```

---

## Task 2: workerd 스모크 테스트

**Files:**
- Modify: `frontend/src/test/worker/globalSetup.ts`
- Create: `frontend/src/test/worker/smoke.test.ts`

**Covers:** AC-WEBDEPLOY-02, AC-WEBDEPLOY-03, AC-WEBDEPLOY-04, AC-WEBDEPLOY-05, AC-WEBDEPLOY-06

**Interfaces:**
- Consumes: Task 1의 `.open-next/worker.js`, `pnpm build:worker`, `STUB_PORT`
- Produces: `pnpm test:worker`가 AC 6개를 전부 검사하는 상태

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/test/worker/smoke.test.ts`:
```ts
import { describe, expect, it } from "vitest";

const WORKER_URL = "http://localhost:8787";

/** WorkerSmokeTest */
describe("WorkerSmokeTest", () => {
  it("AC-WEBDEPLOY-02 · workerd에서 /login이 200을 반환한다", async () => {
    const response = await fetch(`${WORKER_URL}/login`);

    expect(response.status).toBe(200);
  });

  it("AC-WEBDEPLOY-03 · /login 응답에 운영 redirect_uri가 담긴 카카오 인가 URL이 있다", async () => {
    const html = await (await fetch(`${WORKER_URL}/login`)).text();

    expect(html).toContain("https://kauth.kakao.com/oauth/authorize");
    expect(html).toContain(
      "redirect_uri=https%3A%2F%2Fkaldi-note.today%2Fauth%2Fcallback",
    );
  });

  it("AC-WEBDEPLOY-04 · BFF 로그인 라우트가 httpOnly refresh 쿠키를 심는다", async () => {
    const response = await fetch(`${WORKER_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "test-authorization-code" }),
    });

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("kaldi_refresh=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("AC-WEBDEPLOY-05 · 운영 빌드에서 그 쿠키에 Secure 속성이 붙는다", async () => {
    const response = await fetch(`${WORKER_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "test-authorization-code" }),
    });

    expect(response.headers.get("set-cookie") ?? "").toContain("Secure");
  });

  it("AC-WEBDEPLOY-06 · /가 /recipes로 리다이렉트한다", async () => {
    const response = await fetch(`${WORKER_URL}/`, { redirect: "manual" });

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("location")).toContain("/recipes");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test:worker`
Expected: FAIL — 5개 전부. `localhost:8787`에 아무것도 떠 있지 않아 `fetch`가 `ECONNREFUSED`로 던진다.

- [ ] **Step 3: globalSetup에 백엔드 스텁과 workerd 기동 추가**

`globalSetup.ts`에 추가한다. 빌드(Task 1 Step 6) 뒤에 이어진다:

```ts
import { createServer } from "node:http";
import { spawn } from "node:child_process";

/** 백엔드 로그인 응답을 대신한다. 실제 백엔드는 이 테스트에 필요 없다. */
function startBackendStub() {
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url?.startsWith("/api/v1/auth/login/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          userId: 1,
          nickname: "테스트",
          newUser: false,
          tokens: {
            accessToken: "test-access-token",
            refreshToken: "test-refresh-token",
            expiresInSeconds: 1800,
          },
        }),
      );
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(STUB_PORT);
  return server;
}

/** 응답이 올 때까지 기다린다. 준비 시간을 재보지 않고 sleep으로 때우지 않는다. */
async function waitForHttp(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`${url}가 ${timeoutMs}ms 안에 응답하지 않았다`);
}
```

`setup()`에서 빌드 후 스텁과 `wrangler dev`를 띄우고, teardown에서 둘 다 내린다. `wrangler dev`는 `--port 8787 --local`로 띄운다.

> **`loginResponseSchema`와 스텁 응답의 모양이 일치해야 한다.** 지어낸 픽스처는 코드가 아니라 내 가정을 검증한다(`docs/conventions/frontend.md`). **스텁을 쓰기 전에 `frontend/src/features/auth/schema.ts`의 `loginResponseSchema`를 열어 필드 이름과 중첩 구조를 그대로 옮긴다.** 위 코드는 `route.ts:49~56`에서 읽어낸 모양이지만, 스키마 원본과 대조해 확인한다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test:worker`
Expected: PASS, 6 tests (Task 1의 build 1개 + smoke 5개)

**AC-WEBDEPLOY-05가 실패할 가능성이 실재한다.** `cookie.ts:18`이 `NODE_ENV === "production"`으로 `secure`를 켜는데, OpenNext 번들에서 이 값이 무엇인지 확인된 바 없다. 실패하면 **테스트를 고치지 말고** — 그건 운영에서 refresh token이 평문 채널로 나가도 된다고 선언하는 것이다 — `secure` 판정 방식을 고친다. 이 경우 계획에 없는 소스 변경이므로 사람에게 먼저 알린다.

**AC-04·05가 `global_fetch_strictly_public` 때문에 실패할 수도 있다.** 이 플래그는 워커의 `fetch`를 공개 인터넷 규칙에 맞추는데, `localhost` 스텁으로의 호출이 막힐 가능성이 있다. 막히면 스텁을 워커 바인딩으로 바꾸거나 이 테스트에 한해 플래그를 빼는 방안을 검토한다.

- [ ] **Step 5: 커밋**

```bash
cd frontend && pnpm format && cd ..
git add . && git commit -m "test(web): workerd 스모크 테스트 (AC-WEBDEPLOY-02~06)"
```

---

## Task 3: 배포 워크플로

**Files:**
- Modify: `.github/workflows/frontend.yml`

**Covers:** 없음 (스펙의 「배포 워크플로 동작」과 「수동 확인」이 검증한다)

**Interfaces:**
- Consumes: Task 1의 `pnpm build:worker`, Task 2의 `pnpm test:worker`

- [ ] **Step 1: 기존 check job에 워커 테스트 추가**

`빌드` 단계 뒤에 이어 붙인다:
```yaml
      # Node에서 통과하는 테스트가 workerd에서도 통과한다는 보장은 없다.
      - name: 워커 테스트
        working-directory: frontend
        run: pnpm test:worker
```

- [ ] **Step 2: deploy job 추가**

```yaml
  deploy:
    name: Cloudflare Workers 배포
    needs: check
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest

    steps:
      # (checkout / pnpm / node / install 은 check job과 같다)

      - name: 배포
        working-directory: frontend
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          # 공개값이라 리터럴로 둔다 — 무엇이 배포되는지 diff에 보이는 편이 낫다.
          NEXT_PUBLIC_API_BASE_URL: https://api.kaldi-note.today
          NEXT_PUBLIC_KAKAO_REDIRECT_URI: https://kaldi-note.today/auth/callback
          NEXT_PUBLIC_KAKAO_CLIENT_ID: ${{ secrets.NEXT_PUBLIC_KAKAO_CLIENT_ID }}
        run: pnpm deploy:worker

      - name: 스모크 체크
        run: |
          # Workers는 부팅 과정이 없다. 백엔드의 60초를 베끼지 않는다.
          for i in $(seq 1 6); do
            code=$(curl -s -o /dev/null -w '%{http_code}' https://kaldi-note.today/login || true)
            if [ "$code" = "200" ]; then
              echo "스모크 체크 통과 (시도 $i/6)"
              exit 0
            fi
            echo "시도 $i/6: HTTP $code"
            sleep 5
          done
          echo "30초 안에 200을 받지 못했다"
          exit 1
```

> **오프바이원을 주의한다.** 지난 세션에서 검증 스크립트의 재시도 횟수를 한 번 소진해 롤백이 아니라 배포 성공으로 끝난 사고가 있었다(`docs/JOURNAL.md` 2026-08-21). 위 루프는 6회 시도하고 각 시도 뒤에 5초를 쉬므로, 마지막 실패 후에도 5초를 더 기다린 뒤 종료한다. 총 대기가 30초를 넘는 것은 의도된 여유다.

- [ ] **Step 3: 워크플로 문법 검증**

Run:
```bash
gh workflow view frontend.yml 2>&1 | head -5
```
Expected: 파싱 오류 없이 워크플로 정보가 출력된다. (푸시 전이면 `actionlint`가 있을 경우 그것을 쓴다.)

- [ ] **Step 4: 커밋**

```bash
git add . && git commit -m "ci(web): Cloudflare Workers 배포 job + 스모크 체크"
```

---

## Task 4: 문서의 Vercel 표기 정정

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/design/2026-08-14-architecture.md`
- Modify: `frontend/CLAUDE.md`

**Covers:** 없음

- [ ] **Step 1: 세 곳을 고친다**

| 파일 | 현재 | 고칠 내용 |
|---|---|---|
| `CLAUDE.md` | "프론트는 Vercel 무료 플랜" | Cloudflare Workers로. 무료 한도(10만 요청/일, CPU 10ms/호출, 정적 자산 무제한)를 함께 적는다 |
| `docs/design/2026-08-14-architecture.md:81` | "Vercel 무료 배포" | 같음. **`design/`은 왜 이런 구조인지를 설명하는 문서이므로**, 도메인이 이미 Cloudflare에 있다는 것과 Vercel이 Cloudflare 프록시 앞단 구성을 권장하지 않는다는 근거를 남긴다 |
| `frontend/CLAUDE.md:32` | 배포 표에 "Vercel (무료)" | Cloudflare Workers (OpenNext)로. 11행의 "아직 로컬 전용이다" 문장도 배포 완료 상태로 갱신한다 |

- [ ] **Step 2: 남은 표기가 없는지 확인**

Run:
```bash
grep -rn -i "vercel" --include="*.md" . | grep -v node_modules
```
Expected: `docs/specs/2026-08-18-oci-deploy.md:19`(과거 스펙의 범위 밖 서술)과 `docs/JOURNAL.md`(과거 기록)만 남는다. **이 둘은 고치지 않는다** — 스펙과 일지는 append-only이고, 그때의 판단을 사후에 바꾸면 왜 방향이 바뀌었는지 추적할 수 없게 된다. `frontend/README.md`는 Next 기본 생성물이므로 확인 후 판단한다.

- [ ] **Step 3: 커밋**

```bash
git add . && git commit -m "docs: 프론트 배포 대상을 Cloudflare Workers로 정정"
```

---

## 완료 기준

- [ ] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 (기존 59개 유지)
- [ ] `cd frontend && pnpm test:worker` 통과 (6개)
- [ ] `./scripts/check-spec-coverage.sh` 통과
- [ ] 스펙 `docs/specs/2026-08-21-web-deploy.md`의 `status`를 `구현완료`로 변경
- [ ] 스펙의 「수동 확인」 10개 항목을 사람이 수행하고 결과를 확인 — 특히 **폰 브라우저에서 카카오 실계정 로그인 → 레시피 목록 → 상세 → 포크**가 동작하는 것
- [ ] 배포 후 `infra/scripts/verify-rollback.sh`로 백엔드 배포·롤백이 여전히 정상인지 확인

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 6개 중 6개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** Task 2가 쓰는 `STUB_PORT`·`.open-next/worker.js` 경로·`pnpm build:worker`는 모두 Task 1에서 정의된다. Task 3이 쓰는 `pnpm deploy:worker`·`pnpm test:worker`도 Task 1·2에서 정의된다.

**검증되지 않은 가정:**

이 계획은 확인된 문서 위에 서 있지만, 아래는 **직접 돌려보기 전에는 모르는 것들**이다. 실제로 이 중 하나라도 어긋나면 계획을 고쳐야 한다.

1. **OpenNext가 Next 16.3.1 + React 19.2.8에서 빌드된다.** 문서의 지원 범위 선언만 확인했다. Task 1 Step 3이 이걸 처음 시험한다 — 이 계획에서 가장 먼저 깨질 수 있는 지점이다.
2. **`wrangler dev --local`로 띄운 workerd가 `localhost` 스텁으로 `fetch`할 수 있다.** `global_fetch_strictly_public` 플래그와 충돌할 가능성이 있다(Task 2 Step 4에 대안을 적어뒀다).
3. **OpenNext 번들에서 `process.env.NODE_ENV`가 `"production"`이다.** 아니면 AC-WEBDEPLOY-05가 실패하고, 그건 테스트가 아니라 `cookie.ts`를 고쳐야 하는 신호다.
4. **`wrangler.jsonc`의 `services` 자기참조 바인딩에 쓴 이름 `kaldi-note-web`이 실제 Worker 이름과 같아야 한다.** 사람이 Cloudflare에서 Worker를 만들 때 다른 이름을 쓰면 어긋난다.
5. **CPU 10ms/호출 한도가 이 앱의 SSR에 충분하다.** 레시피 상세는 클라이언트 렌더가 대부분이라 여유가 있을 것으로 보지만 측정한 적이 없다. 배포 후 Cloudflare 대시보드에서 실제 CPU 시간을 확인한다.
6. **`vitest.config.mts`의 `include`가 `src/test/worker/`를 집어삼키지 않는다.** 삼키면 기존 `pnpm test`가 매번 빌드를 돌리게 된다(Task 1 Step 8에서 확인한다).

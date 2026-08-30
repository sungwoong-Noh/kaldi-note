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

- [x] **Step 1: 의존성 설치**

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

> **실행 결과(2026-08-23):** `@opennextjs/cloudflare 1.20.2`, `wrangler 4.125.0`.
>
> **계획에 없던 것 — `pnpm-workspace.yaml`의 `allowBuilds`.** 설치가 `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild, workerd`로 끝나고, pnpm이 `frontend/pnpm-workspace.yaml`에 두 항목을 `set this to true or false` 자리표시자로 추가한다. **둘 다 `true`로 바꾸고 `pnpm install`을 다시 돌려야 한다** — `workerd`는 Workers 런타임 바이너리를 postinstall로 받아오므로 막히면 Task 2의 `wrangler dev`가 뜨지 않는다. 심볼릭 링크가 생긴 것만으로는 확인이 안 되니 바이너리를 직접 실행해 검증한다:
> ```bash
> node_modules/.pnpm/node_modules/.bin/workerd --version   # workerd 2026-08-20
> ```

- [x] **Step 2: 설정 파일 작성**

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
.wrangler
```

> **실행 결과(2026-08-23) — 계획이 놓친 무시 설정 둘.**
>
> 1. **`eslint.config.mjs`의 `globalIgnores`에 `.open-next/**`·`.wrangler/**`를 넣어야 한다.** 안 넣으면 `pnpm lint`가 생성된 번들을 검사해 **377 errors / 12354 warnings**로 터진다. `.gitignore`와 ESLint의 ignore는 별개다.
> 2. **`vitest.config.mts`의 `exclude`에 `src/test/worker/**`·`.open-next/**`를 넣어야 한다.** 이 계획은 Step 8에서 확인하라고 했지만 **Step 4보다 먼저 해야 한다** — 기존 설정의 `include`가 기본값이라 워커 테스트를 집어삼키고, 그러면 `pnpm test`가 매번 OpenNext 빌드를 돌려 4초짜리 스위트가 분 단위가 된다.
>
> 반면 **`.prettierignore`는 필요 없다.** Prettier v3는 `.gitignore`를 이미 존중한다 — `prettier --check .`로 `.open-next` 아래 대상이 0개임을 확인했다.

- [x] **Step 3: 빌드 스크립트 추가 후 실제로 돌려본다**

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

> **실행 결과(2026-08-23) — 통과했다.** 종료 코드 `0`, `.open-next/worker.js`(2278바이트)와 `.open-next/assets/` 생성. **이 계획의 가장 큰 가정이 확인됐다.** 우려했던 세 지점 중 어느 것도 발생하지 않았다.
>
> 추가로 `wrangler`가 설정을 읽는지도 검증했다(계획에 없던 단계):
> ```bash
> pnpm exec wrangler deploy --dry-run
> ```
> 결과: 바인딩 2개(`WORKER_SELF_REFERENCE`·`ASSETS`)를 인식, 자산 29개 / 6609 KiB(gzip 1304 KiB), 종료 코드 0. **가정 4번(`services` 자기참조 이름이 실제 Worker 이름과 같아야 한다)이 최소한 파싱 레벨에서 확인됐고, Task 3의 배포 경로도 미리 검증된 셈이다.**
>
> 주의: `pnpm format`이 `wrangler.jsonc`에 trailing comma를 넣는다. JSONC 문법상 유효하고 위 dry-run이 그 상태로 통과했으므로 되돌리지 않는다.

- [x] **Step 4: 실패하는 테스트 작성**

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

- [x] **Step 5: 테스트 실행 — 실패 확인**

`globalSetup.ts`를 아직 만들지 않았으므로 먼저 빈 파일로 만든 뒤, `.open-next`를 지우고 돌린다.

Run:
```bash
cd frontend && rm -rf .open-next && pnpm test:worker
```
Expected: FAIL — `.open-next/worker.js`가 없어 `existsSync`가 `false`를 반환한다.

- [x] **Step 6: globalSetup에 빌드 실행 추가**

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

- [x] **Step 7: 테스트 실행 — 통과 확인**

Run: `cd frontend && rm -rf .open-next && pnpm test:worker`
Expected: PASS, 1 test

- [x] **Step 8: 기존 검증이 깨지지 않았는지 확인**

Run: `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: 전부 통과, 테스트 59개 그대로

`vitest.config.mts`의 `include`가 `src/test/worker/`를 집어삼키지 않는지 확인한다. 삼킨다면 기존 설정에 `exclude`를 추가한다.

- [x] **Step 9: 커밋**

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

- [x] **Step 1: 실패하는 테스트 작성**

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

- [x] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd frontend && pnpm test:worker`
Expected: FAIL — 5개 전부. `localhost:8787`에 아무것도 떠 있지 않아 `fetch`가 `ECONNREFUSED`로 던진다.

- [x] **Step 3: globalSetup에 백엔드 스텁과 workerd 기동 추가**

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

- [x] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd frontend && pnpm test:worker`
Expected: PASS, 6 tests (Task 1의 build 1개 + smoke 5개)

**AC-WEBDEPLOY-05가 실패할 가능성이 실재한다.** `cookie.ts:18`이 `NODE_ENV === "production"`으로 `secure`를 켜는데, OpenNext 번들에서 이 값이 무엇인지 확인된 바 없다. 실패하면 **테스트를 고치지 말고** — 그건 운영에서 refresh token이 평문 채널로 나가도 된다고 선언하는 것이다 — `secure` 판정 방식을 고친다. 이 경우 계획에 없는 소스 변경이므로 사람에게 먼저 알린다.

**AC-04·05가 `global_fetch_strictly_public` 때문에 실패할 수도 있다.** 이 플래그는 워커의 `fetch`를 공개 인터넷 규칙에 맞추는데, `localhost` 스텁으로의 호출이 막힐 가능성이 있다. 막히면 스텁을 워커 바인딩으로 바꾸거나 이 테스트에 한해 플래그를 빼는 방안을 검토한다.

> **실행 결과(2026-08-23) — PASS, 6 tests. 위 두 우려는 모두 기우였다.**
>
> - **AC-WEBDEPLOY-05 통과** → OpenNext 번들에서 `process.env.NODE_ENV`가 `"production"`이다. `cookie.ts:18`을 고칠 필요가 없었다
> - **AC-04·05 통과** → `global_fetch_strictly_public`이 `localhost` 스텁 호출을 막지 않았다. 스텁을 바인딩으로 바꾸는 대안은 불필요
> - **`GET /`는 정확히 `307 Temporary Redirect`였다.** 스펙이 스모크 체크 대상으로 `/login`을 고른 판단이 맞았다 — 루트로 200을 기대했으면 실패했을 것이다
>
> `wrangler dev` 기동에 걸린 시간을 포함해 스위트 전체가 13.6초다.
>
> **`globalSetup`이 계획보다 커졌다.** `waitForHttp`(최대 120초 폴링)로 workerd 준비를 기다리고, teardown 함수를 반환해 워커 프로세스와 스텁 서버를 함께 내린다. 준비 시간을 `sleep`으로 때우지 않은 것은 지난 세션의 실패(`docs/JOURNAL.md` 2026-08-21, "검사 시점을 대상의 준비 시간에 맞추지 않았다")를 반복하지 않기 위해서다.

- [x] **Step 5: 커밋**

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

- [x] **Step 1: 기존 check job에 워커 테스트 추가**

`빌드` 단계 뒤에 이어 붙인다:
```yaml
      # Node에서 통과하는 테스트가 workerd에서도 통과한다는 보장은 없다.
      - name: 워커 테스트
        working-directory: frontend
        run: pnpm test:worker
```

- [x] **Step 2: deploy job 추가**

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

> **★ 실행 결과(2026-08-23) — 위 Step 2 코드는 틀렸다. 고쳐서 구현했다.**
>
> `opennextjs-cloudflare --help`가 `deploy`를 **"Deploy a *built* OpenNext app"** 으로 정의한다. 빌드를 포함하지 않는다. 위 코드처럼 `pnpm deploy:worker` 하나만 돌리면 **올릴 산출물이 없고**, `NEXT_PUBLIC_*`를 배포 단계 `env`에 걸어봐야 그 값들은 빌드 타임에 번들에 박히므로 **아무 효과가 없다.**
>
> 실제 구현은 단계를 둘로 나눴다:
> - **빌드 단계** — `NEXT_PUBLIC_*` 3개를 여기 준다. `run: pnpm build:worker`
> - **배포 단계** — `CLOUDFLARE_API_TOKEN`·`CLOUDFLARE_ACCOUNT_ID`만. `run: pnpm deploy:worker`
>
> **스모크 체크 스크립트는 양쪽 경로를 로컬에서 실제로 돌려 확인했다**(운영에 들이대기 전에 로컬에서 먼저 돌린다 — 지난 세션 교훈):
> - 실패 경로(미배포 상태의 `kaldi-note.today`): `시도 1/6`~`시도 6/6` 정확히 6회 → exit 1, 31초. **오프바이원 없음**
> - 성공 경로(`api.kaldi-note.today/actuator/health`로 URL만 교체): `스모크 체크 통과 (시도 1/6)` → exit 0
>
> `gh workflow view`는 푸시된 워크플로만 보므로 쓰지 않았다. 대신 YAML을 파싱해 job 2개·의존 관계·단계 순서를 대조했다.

- [x] **Step 3: 워크플로 문법 검증**

Run:
```bash
gh workflow view frontend.yml 2>&1 | head -5
```
Expected: 파싱 오류 없이 워크플로 정보가 출력된다. (푸시 전이면 `actionlint`가 있을 경우 그것을 쓴다.)

- [x] **Step 4: 커밋**

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

- [x] **Step 1: 세 곳을 고친다**

| 파일 | 현재 | 고칠 내용 |
|---|---|---|
| `CLAUDE.md` | "프론트는 Vercel 무료 플랜" | Cloudflare Workers로. 무료 한도(10만 요청/일, CPU 10ms/호출, 정적 자산 무제한)를 함께 적는다 |
| `docs/design/2026-08-14-architecture.md:81` | "Vercel 무료 배포" | 같음. **`design/`은 왜 이런 구조인지를 설명하는 문서이므로**, 도메인이 이미 Cloudflare에 있다는 것과 Vercel이 Cloudflare 프록시 앞단 구성을 권장하지 않는다는 근거를 남긴다 |
| `frontend/CLAUDE.md:32` | 배포 표에 "Vercel (무료)" | Cloudflare Workers (OpenNext)로. 11행의 "아직 로컬 전용이다" 문장도 배포 완료 상태로 갱신한다 |

- [x] **Step 2: 남은 표기가 없는지 확인**

Run:
```bash
grep -rn -i "vercel" --include="*.md" . | grep -v node_modules
```
Expected: `docs/specs/2026-08-18-oci-deploy.md:19`(과거 스펙의 범위 밖 서술)과 `docs/JOURNAL.md`(과거 기록)만 남는다. **이 둘은 고치지 않는다** — 스펙과 일지는 append-only이고, 그때의 판단을 사후에 바꾸면 왜 방향이 바뀌었는지 추적할 수 없게 된다. `frontend/README.md`는 Next 기본 생성물이므로 확인 후 판단한다.

> **실행 결과(2026-08-23) — 대상이 계획보다 많았다. 실제로 고친 곳 7군데:**
>
> | 파일 | 고친 것 |
> |---|---|
> | `CLAUDE.md:73` | 모노레포 설명의 "프론트 → Vercel" |
> | `CLAUDE.md:162` | 배포 환경 제약. Workers 무료 한도를 수치로 적었다 |
> | `docs/design/2026-08-14-architecture.md:81` | 근거 셋을 함께 남겼다 |
> | `frontend/CLAUDE.md:11` | 현재 상태 |
> | `frontend/CLAUDE.md:32` | 배포 표 |
> | `frontend/CLAUDE.md` 「검증」 | **계획에 없던 것** — `pnpm test:worker`와 배포 명령어 3개를 추가했다. 안 넣으면 다음 세션이 워커 테스트를 빠뜨린다 |
> | `README.md:23` | **계획이 놓친 곳** — 루트 README의 기술 스택 표 |
> | `frontend/README.md:32` | **계획이 "판단하라"고 남긴 곳** — create-next-app의 "Deploy on Vercel" 섹션이 실제 배포 방법과 정면으로 달라 교체했다. 나머지 Vercel 언급(폰트·Next 저장소 링크)은 사실 서술이라 그대로 뒀다 |
>
> **`frontend/CLAUDE.md:11`은 계획 지시를 그대로 따르지 않았다.** 계획은 "배포 완료 상태로 갱신"하라고 했지만 **실제 배포는 아직 안 됐다** — Worker 생성·DNS·Secret 등록이 사람 작업으로 남아 있다. 그대로 썼으면 거짓이 된다. "파이프라인 준비 완료, 인터넷에 떠 있지 않음"으로 쓰고 남은 사람 작업을 나열했다.
>
> `docs/specs/2026-08-21-web-recipe-read.md`의 Vercel 언급 2곳도 고치지 않았다 — 위와 같은 이유(과거 스펙)다.

- [x] **Step 3: 커밋**

```bash
git add . && git commit -m "docs: 프론트 배포 대상을 Cloudflare Workers로 정정"
```

---

## 완료 기준

- [x] `cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build` 통과 (기존 59개 유지)
- [x] `cd frontend && pnpm test:worker` 통과 (6개)
- [x] `./scripts/check-spec-coverage.sh` 통과
- [x] 스펙 `docs/specs/2026-08-21-web-deploy.md`의 `status`를 `구현완료`로 변경 — 2026-08-30. 커버리지 스크립트가 이제 AC 6개를 실제로 검사하고 통과한다(스펙 13건·AC 414개)
- [x] 스펙의 「수동 확인」 10개 항목을 사람이 수행하고 결과를 확인 — 특히 **폰 브라우저에서 카카오 실계정 로그인 → 레시피 목록 → 상세 → 포크**가 동작하는 것
  - **2026-08-29에 6개, 2026-08-30에 나머지 4개 완료.** 폰에서 상세·포크까지 동작을 확인했고, `kaldi_refresh` 쿠키의 `HttpOnly`·`Secure`도 브라우저 개발자도구로 실물 확인했다
- [x] 배포 후 `infra/scripts/verify-rollback.sh`로 백엔드 배포·롤백이 여전히 정상인지 확인
  - **2026-08-30 전부 PASS.** 판정 4개(종료 코드 1·롤백 메시지·직전 태그 복귀·상태 파일 무오염)와 실서비스 확인까지. **`헬스체크 통과 (시도 1/12)`** — 지난 세션의 오프바이원이 재발하지 않았다

---

## 자체 검토 결과

**AC 커버리지:** 스펙의 AC 6개 중 6개가 태스크에 매핑됨

**자리표시자 검사:** `TODO`, `TBD`, "나중에", "비슷하게" 없음

**타입 일관성:** Task 2가 쓰는 `STUB_PORT`·`.open-next/worker.js` 경로·`pnpm build:worker`는 모두 Task 1에서 정의된다. Task 3이 쓰는 `pnpm deploy:worker`·`pnpm test:worker`도 Task 1·2에서 정의된다.

**검증되지 않은 가정:**

이 계획은 확인된 문서 위에 서 있지만, 아래는 **직접 돌려보기 전에는 모르는 것들**이다. 실제로 이 중 하나라도 어긋나면 계획을 고쳐야 한다.

1. ~~**OpenNext가 Next 16.3.1 + React 19.2.8에서 빌드된다.**~~ → **확인됨(2026-08-23).** `@opennextjs/cloudflare 1.20.2`로 종료 코드 0, 번들 생성. 우려했던 세 지점(산출물 구조 변화·typegen 충돌·React 버전 불일치) 모두 발생하지 않았다.
2. ~~**`wrangler dev --local`로 띄운 workerd가 `localhost` 스텁으로 `fetch`할 수 있다.**~~ → **확인됨(2026-08-23).** `global_fetch_strictly_public`이 켜진 채로 AC-04·05가 통과했다. 대안은 불필요했다.
3. ~~**OpenNext 번들에서 `process.env.NODE_ENV`가 `"production"`이다.**~~ → **확인됨(2026-08-23).** AC-WEBDEPLOY-05가 통과했다 — 쿠키에 `Secure`가 실제로 붙는다. `cookie.ts`는 손대지 않았다.
4. ~~**`wrangler.jsonc`의 `services` 자기참조 바인딩에 쓴 이름 `kaldi-note-web`이 실제 Worker 이름과 같아야 한다.**~~ → **확인됨(2026-08-29).** 대시보드에서 Worker를 미리 만들 필요가 없었다 — `wrangler deploy`가 `name` 값으로 Worker를 자동 생성하므로 이름이 어긋날 여지 자체가 없다. 자기참조 바인딩도 첫 배포에서 정상적으로 붙었다.
5. **CPU 10ms/호출 한도가 이 앱의 SSR에 충분하다.** 레시피 상세는 클라이언트 렌더가 대부분이라 여유가 있을 것으로 보지만 측정한 적이 없다. 배포 후 Cloudflare 대시보드에서 실제 CPU 시간을 확인한다.
6. ~~**`vitest.config.mts`의 `include`가 `src/test/worker/`를 집어삼키지 않는다.**~~ → **깨졌다(2026-08-23).** 실제로 집어삼킨다. `exclude`에 `src/test/worker/**`·`.open-next/**`를 추가해 막았다. 함께 드러난 것: `eslint.config.mjs`도 `.open-next/**`를 무시해야 한다(안 하면 lint가 377 errors로 실패). 둘 다 Step 2에 기록했다.

7. **(신규) `pnpm` 설치가 `esbuild`·`workerd`의 빌드 스크립트를 기본 차단한다.** `pnpm-workspace.yaml`의 `allowBuilds`에서 `true`로 바꿔야 한다. Step 1에 기록했다.

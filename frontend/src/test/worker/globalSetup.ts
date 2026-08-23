import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";

/** 워커 테스트용 백엔드 스텁이 뜰 포트. 빌드 타임에 번들에 박히므로 고정값이어야 한다. */
export const STUB_PORT = 8788;

/** workerd가 뜰 포트. smoke.test.ts의 WORKER_URL과 맞춘다. */
const WORKER_PORT = 8787;

const frontendRoot = resolve(import.meta.dirname, "../../..");

/**
 * 백엔드 로그인 응답을 대신한다. 실제 백엔드는 이 테스트에 필요 없다.
 *
 * <p>응답 모양은 `src/features/auth/schema.ts`의 `loginResponseSchema`를 그대로 따른다 — 지어낸 픽스처는 코드가 아니라 가정을 검증한다.
 */
function startBackendStub(): Server {
  const server = createServer((req, res) => {
    if (req.method === "POST" && req.url?.startsWith("/api/v1/auth/login/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          tokens: {
            accessToken: "test-access-token",
            refreshToken: "test-refresh-token",
            expiresInSeconds: 1800,
          },
          userId: 1,
          nickname: "테스트",
          newUser: false,
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
async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`${url}가 ${timeoutMs}ms 안에 응답하지 않았다: ${lastError}`);
}

export default async function setup() {
  execFileSync("pnpm", ["build:worker"], {
    cwd: frontendRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      // 백엔드 호출은 로컬 스텁으로 보낸다(AC-WEBDEPLOY-04·05).
      NEXT_PUBLIC_API_BASE_URL: `http://localhost:${STUB_PORT}`,
      // redirect_uri만 운영값이어야 한다(AC-WEBDEPLOY-03).
      NEXT_PUBLIC_KAKAO_REDIRECT_URI: "https://kaldi-note.today/auth/callback",
      NEXT_PUBLIC_KAKAO_CLIENT_ID: "test-kakao-client-id",
    },
  });

  const stub = startBackendStub();

  const worker: ChildProcess = spawn(
    "pnpm",
    ["exec", "wrangler", "dev", "--port", String(WORKER_PORT), "--local"],
    { cwd: frontendRoot, stdio: "inherit" },
  );

  await waitForHttp(`http://localhost:${WORKER_PORT}/login`, 120_000);

  return () => {
    worker.kill();
    stub.close();
  };
}

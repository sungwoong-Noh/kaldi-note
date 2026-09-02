#!/usr/bin/env node
/**
 * 특정 사용자로 로그인된 브라우저 창을 연다. **로컬 확인 전용이다.**
 *
 *   node scripts/open-as.mjs [userId]      기본 11
 *
 * 카카오 OAuth는 자동화할 수 없고 계정을 여러 개 만들 수도 없다. 그런데 공개범위(FRIENDS)처럼
 * **두 계정이 있어야만 확인되는 동작**이 있다. 이 스크립트가 그 간극을 메운다.
 *
 * 원리: accessToken은 메모리에만 살고, 앱은 세션이 없으면 `/api/auth/refresh`로 한 번 복구한다.
 * 그래서 refresh JWT를 직접 서명해 그 SHA-256 hex를 `refresh_tokens`에 넣고 쿠키로 심으면
 * 첫 화면에서 앱이 스스로 로그인 상태가 된다.
 *
 * 자세한 규칙은 `docs/conventions/verification.md` 참조.
 */
import { execFileSync } from "node:child_process";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Playwright는 frontend에만 설치돼 있다. pnpm이라 호이스팅되지 않아 직접 짚어준다.
// `playwright`가 아니라 `@playwright/test`인 이유도 같다 — 전자는 .pnpm 안에만 있다.
const require = createRequire(`${ROOT}/frontend/package.json`);
let chromium;
try {
  ({ chromium } = require("@playwright/test"));
} catch {
  fail("Playwright가 없다. `cd frontend && pnpm install`을 먼저 돌린다.");
}

const userId = process.argv[2] ?? "11";
if (!/^\d+$/.test(userId)) fail(`사용자 id는 숫자여야 한다: ${userId}`);

const APP = "http://localhost:3000";
const API = "http://localhost:8080";

/**
 * 시크릿을 하드코딩하지 않는다. `application-local.yml`이 바뀌면 서명이 조용히 어긋나
 * "로그인이 안 되는데 이유를 모르는" 상태가 된다.
 */
function localJwtSecret() {
  const yml = readFileSync(
    `${ROOT}/backend/src/main/resources/application-local.yml`,
    "utf8",
  );
  const match = yml.match(/^\s*secret:\s*(\S+)\s*$/m);
  if (match === null) fail("application-local.yml에서 jwt secret을 찾지 못했다.");
  return match[1];
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

async function requireUp(url, name, hint) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(3000) });
  } catch {
    fail(`${name}이 떠 있지 않다 (${url}).\n  ${hint}`);
  }
}

await requireUp(
  `${API}/actuator/health`,
  "백엔드",
  "cd backend && SPRING_PROFILES_ACTIVE=local ./gradlew bootRun",
);
await requireUp(`${APP}/login`, "프론트", "cd frontend && pnpm dev");

const now = Math.floor(Date.now() / 1000);
const expiresAt = now + 60 * 60 * 24 * 14;

const base64url = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const signingInput = `${base64url({ alg: "HS256" })}.${base64url({
  issuer: undefined,
  iss: "kaldi-note",
  iat: now,
  exp: expiresAt,
  sub: userId,
  // refresh_tokens.token_hash가 UNIQUE라 같은 초에 두 번 발급하면 저장이 실패한다.
  jti: randomUUID(),
})}`;
const refreshToken = `${signingInput}.${createHmac("sha256", localJwtSecret())
  .update(signingInput)
  .digest("base64url")}`;

// 백엔드는 원문이 아니라 SHA-256 hex를 저장한다(AuthService.hash와 같은 방식).
const tokenHash = createHash("sha256")
  .update(refreshToken, "utf8")
  .digest("hex");

try {
  execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "kaldinote",
      "-d",
      "kaldinote",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `insert into refresh_tokens (user_id, token_hash, expires_at)
       select ${userId}, '${tokenHash}', '${new Date(expiresAt * 1000).toISOString()}'
       where exists (select 1 from users where id = ${userId});`,
    ],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );
} catch (error) {
  fail(`refresh 토큰을 넣지 못했다.\n  ${String(error.stderr ?? error)}`);
}

// 없는 사용자를 주면 위 insert가 0건이라 로그인도 안 된다. 여기서 끊어 알려준다.
const exists = execFileSync(
  "docker",
  [
    "compose",
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "kaldinote",
    "-d",
    "kaldinote",
    "-tAc",
    `select nickname from users where id = ${userId};`,
  ],
  { cwd: ROOT },
)
  .toString()
  .trim();
if (exists === "") {
  fail(
    `사용자 ${userId}가 없다. 있는 계정을 고른다:\n  docker compose exec postgres psql -U kaldinote -d kaldinote -c 'select id,nickname from users'`,
  );
}

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  // 이 앱의 주 사용 환경은 폰이다. 데스크톱 폭으로 확인하면 놓치는 것이 생긴다.
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
await context.addCookies([
  {
    name: "kaldi_refresh",
    value: refreshToken,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    expires: expiresAt,
  },
]);

const page = await context.newPage();
await page.goto(APP);

console.log(`\n✓ 사용자 ${userId}(${exists})로 로그인된 창을 열었다.`);
console.log("  확인이 끝나면 창을 닫는다. 이 프로세스도 함께 끝난다.\n");

await page.waitForEvent("close", { timeout: 0 }).catch(() => {});
await browser.close();

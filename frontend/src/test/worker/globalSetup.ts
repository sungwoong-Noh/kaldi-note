import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** 워커 테스트용 백엔드 스텁이 뜰 포트. 빌드 타임에 번들에 박히므로 고정값이어야 한다. */
export const STUB_PORT = 8788;

const frontendRoot = resolve(import.meta.dirname, "../../..");

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
}

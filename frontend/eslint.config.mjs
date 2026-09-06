import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // OpenNext 빌드 산출물. 생성된 번들이라 린트 대상이 아니다.
    ".open-next/**",
    ".wrangler/**",
    // Service Worker는 번들러를 거치지 않는다. 브라우저가 그대로 읽는 순수 JS라
    // self·ExtendableEvent 같은 워커 전역을 쓰고, 프로젝트의 TS 규칙이 맞지 않는다.
    "public/sw.js",
  ]),
]);

export default eslintConfig;

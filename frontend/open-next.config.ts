import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 증분 캐시(R2)는 쓰지 않는다. 레시피 상세의 오프라인 캐시는 PWA 슬라이스에서
// Service Worker로 다루기로 했고(docs/specs/2026-08-21-web-deploy.md의 범위 밖),
// R2 버킷을 지금 붙이면 그때 전략을 두 번 정하게 된다.
export default defineCloudflareConfig({});

/*
 * kaldi note Service Worker.
 *
 * 번들러를 거치지 않는다 — import도 TypeScript도 쓸 수 없다. 브라우저가 이 파일을 그대로 읽는다.
 * 캐시 규칙은 docs/specs/2026-09-05-web-pwa.md가 정한다.
 */

// skipWaiting/claim을 둘 다 켠다. 안 켜면 첫 방문에서 컨트롤러가 붙지 않아
// 그 세션 동안 fetch 핸들러가 한 번도 돌지 않는다.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

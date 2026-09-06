/*
 * kaldi note Service Worker.
 *
 * 번들러를 거치지 않는다 — import도 TypeScript도 쓸 수 없다. 브라우저가 이 파일을 그대로 읽는다.
 * 캐시 규칙은 docs/specs/2026-09-05-web-pwa.md가 정한다.
 */

// skipWaiting/claim을 둘 다 켠다. 안 켜면 첫 방문에서 컨트롤러가 붙지 않아
// 그 세션 동안 fetch 핸들러가 한 번도 돌지 않는다.
const SHELL_CACHE = "kaldi-shell-v1";

self.addEventListener("install", (event) => {
  // /offline은 "네트워크가 없을 때 여는 화면"이라 그때 받아올 수 없다. 설치 시점에 담는다.
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add("/offline"))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const RECIPE_CACHE = "kaldi-recipe-v1";
const RECIPE_LIMIT = 50;
const RECIPE_PATH = /^\/api\/v1\/recipes\/\d+$/;

function offlineResponse() {
  return new Response(
    JSON.stringify({
      code: "OFFLINE",
      message: "네트워크에 연결되어 있지 않습니다.",
    }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  );
}

/**
 * 응답을 넣고 상한을 지킨다.
 *
 * 넣기 전에 지우는 것이 핵심이다 — Cache Storage의 keys()는 넣은 순서를 돌려주므로,
 * 다시 연 항목을 맨 뒤로 옮겨야 "가장 오래전에 연 것"이 앞에 온다. 안 그러면 LRU가 아니라
 * "가장 먼저 처음 연 것"을 지우게 된다.
 */
async function putRecipe(url, response) {
  const cache = await caches.open(RECIPE_CACHE);
  await cache.delete(url);
  await cache.put(url, response);

  const keys = await cache.keys();
  for (const stale of keys.slice(0, Math.max(0, keys.length - RECIPE_LIMIT))) {
    await cache.delete(stale);
  }
}

async function handleRecipe(request) {
  try {
    const response = await fetch(request);
    if (response.ok) await putRecipe(request.url, response.clone());
    return response;
  } catch {
    const cache = await caches.open(RECIPE_CACHE);
    const cached = await cache.match(request.url);
    return cached ?? offlineResponse();
  }
}

/** 문서. 온라인이면 최신을 받고 담아 두며, 실패하면 담아 둔 것을, 그것도 없으면 /offline을 준다. */
async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request.url, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request.url);
    return cached ?? (await cache.match("/offline")) ?? offlineResponse();
  }
}

/** 해시가 박힌 정적 자산. 내용이 바뀌면 이름이 바뀌므로 캐시를 먼저 본다. */
async function handleAsset(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request.url, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (RECIPE_PATH.test(url.pathname)) {
    event.respondWith(handleRecipe(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (
    url.origin === self.location.origin &&
    url.pathname.startsWith("/_next/")
  ) {
    event.respondWith(handleAsset(request));
  }
});

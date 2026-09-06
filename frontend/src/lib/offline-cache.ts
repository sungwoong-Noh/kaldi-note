/**
 * Service Worker가 쌓아 둔 레시피 캐시를 창(window) 쪽에서 읽고 지운다.
 *
 * <p>SW에 메시지를 보내지 않는다 — Cache Storage는 창에서도 열 수 있어서, 한쪽만 알면 되는 지식을 둘로 나눌 이유가 없다. 캐시 이름은
 * `public/sw.js`와 <b>문자열이 같아야 한다.</b>
 */
const RECIPE_CACHE = "kaldi-recipe-v1";

export interface CachedRecipe {
  readonly id: number;
  readonly title: string;
}

function supported(): boolean {
  return typeof caches !== "undefined";
}

/**
 * 캐시에 실제로 든 레시피만 돌려준다.
 *
 * <p>순서는 Cache Storage가 돌려주는 순서, 즉 넣은 순이다. 본문이 깨진 항목은 조용히 건너뛴다 — 「연결 없음」 화면이 파싱 오류로 통째로 비는
 * 것이 더 나쁘다.
 */
export async function readCachedRecipes(): Promise<CachedRecipe[]> {
  if (!supported()) return [];

  const cache = await caches.open(RECIPE_CACHE);
  const found: CachedRecipe[] = [];

  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (response === undefined) continue;
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        "id" in body &&
        "title" in body &&
        typeof body.id === "number" &&
        typeof body.title === "string"
      ) {
        found.push({ id: body.id, title: body.title });
      }
    } catch {
      continue;
    }
  }

  return found;
}

/** 로그아웃에서 쓴다. 캐시가 없어도 오류를 내지 않는다. */
export async function clearRecipeCache(): Promise<void> {
  if (!supported()) return;
  await caches.delete(RECIPE_CACHE);
}

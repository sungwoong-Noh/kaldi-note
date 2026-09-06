import type { BrowserContext, Page, Route } from "@playwright/test";
// 픽스처는 실제 응답에서 뜬 것이다. 여기서 새로 지어내지 않는다.
import {
  brewLogPage,
  brewLogWithTds,
  brewers,
  comandanteC40,
  filters,
  fritzRoaster,
  hoffmann,
  hoffmannSummary,
  holzklotzE80,
  kasuyaRecipe,
  kasuyaSummary,
  me,
  myComandante,
  pageOf,
  wilfaUniform,
  yirgacheffeBatch,
  yirgacheffeProduct,
} from "../src/test/fixtures";

/**
 * 경로 하나와 그 응답 본문. 위에 있는 것이 먼저 걸린다.
 *
 * 쿼리스트링을 떼어낸 pathname으로 맞춘다 — `/recipes?page=0`과 `/recipes/12`를 정규식 하나로
 * 구분하려면 앵커가 지저분해지고, 목록 경로에 파라미터가 붙는 순간 조용히 빗나간다.
 */
const HANDLERS: ReadonlyArray<readonly [RegExp, unknown]> = [
  [/^\/api\/v1\/users\/me$/, me],
  // 상세가 목록보다 먼저 와야 한다. 순서를 바꾸면 `/recipes/12`가 목록 응답을 받는다.
  // id 3만 kasuya다 — 「연결 없음」 화면이 서로 다른 레시피 둘을 보여주는지 재려면
  // 캐시에 제목이 다른 항목이 둘 필요하다. `kasuyaSummary`가 3이라 id를 맞춘다.
  [/^\/api\/v1\/recipes\/3$/, { ...kasuyaRecipe, id: 3 }],
  [/^\/api\/v1\/recipes\/\d+$/, hoffmann],
  [/^\/api\/v1\/recipes$/, pageOf([hoffmannSummary, kasuyaSummary])],
  [/^\/api\/v1\/brew-logs\/\d+$/, brewLogWithTds],
  [/^\/api\/v1\/brew-logs$/, brewLogPage],
  [/^\/api\/v1\/gear\/brewers$/, brewers],
  [/^\/api\/v1\/gear\/filters$/, filters],
  [/^\/api\/v1\/gear\/user-grinders$/, [myComandante]],
  [/^\/api\/v1\/gear\/grinders$/, [comandanteC40, holzklotzE80, wilfaUniform]],
  // 단건이 목록보다 위에 와야 한다. 순서를 바꾸면 `/bean-batches/3`이 목록 응답을 받는다.
  // 상세·편집이 원두 이름을 만들려고 부른다(배치 → 제품 → 로스터).
  [/^\/api\/v1\/bean-batches\/\d+$/, yirgacheffeBatch],
  [/^\/api\/v1\/bean-batches$/, [yirgacheffeBatch]],
  [/^\/api\/v1\/bean-products\/\d+$/, yirgacheffeProduct],
  // 로그 작성 화면이 품고 있는 원두 재고 등록 모달(로스터 → 제품 → 재고 3단)이 부른다.
  [/^\/api\/v1\/bean-products$/, [yirgacheffeProduct]],
  [/^\/api\/v1\/roasters$/, [fritzRoaster]],
];

export interface Stubs {
  /** 스텁 없이 나간 요청의 URL. 비어 있지 않으면 화면이 새 API를 부르기 시작한 것이다. */
  readonly unstubbed: string[];
}

/**
 * 모든 API 요청을 가로챈다. 백엔드는 띄우지 않는다.
 *
 * accessToken은 메모리에만 사는데 새 탭은 그것이 없다. 앱은 세션이 없으면 `/api/auth/refresh`로
 * 복구를 한 번 시도하므로, 그 경로만 스텁하면 로그인 상태가 된다 — refresh 토큰도 DB도 필요 없다.
 */
export async function installStubs(page: Page): Promise<Stubs> {
  const unstubbed: string[] = [];

  await page.route("**/api/auth/refresh", (route: Route) =>
    route.fulfill({
      json: { accessToken: "e2e.access.token", expiresInSeconds: 1800 },
    }),
  );

  await page.route("**/api/v1/**", (route: Route) => {
    const url = route.request().url();
    const { pathname } = new URL(url);
    const matched = HANDLERS.find(([pattern]) => pattern.test(pathname));
    if (matched === undefined) {
      unstubbed.push(url);
      return route.fulfill({
        status: 500,
        json: { code: "E2E_UNSTUBBED", message: url, fieldErrors: [] },
      });
    }
    return route.fulfill({ json: matched[1] });
  });

  return { unstubbed };
}

/**
 * Service Worker가 보낸 요청까지 가로챈다.
 *
 * <p>`installStubs(page)`는 `page.route`라 SW의 fetch를 못 잡는다. PWA 테스트는 SW가 네트워크에
 * 나가는 것을 봐야 하므로 컨텍스트에 건다.
 *
 * <p><b>page.route가 context.route보다 우선한다</b>(2026-09-06에 측정했다). 그래서 둘을 함께 걸면
 * 페이지가 보낸 요청은 `installStubs`가, SW가 보낸 요청은 이쪽이 처리한다 — 원하는 분담이다.
 */
export async function installSwStubs(context: BrowserContext): Promise<void> {
  await context.route("**/api/auth/refresh", (route: Route) =>
    route.fulfill({
      json: { accessToken: "e2e.access.token", expiresInSeconds: 1800 },
    }),
  );

  await context.route("**/api/v1/**", (route: Route) => {
    const pathname = new URL(route.request().url()).pathname;
    const handler = HANDLERS.find(([pattern]) => pattern.test(pathname));
    if (handler === undefined) return route.fulfill({ status: 404, json: {} });
    return route.fulfill({ json: handler[1] });
  });
}

/** `/api/v1/recipes/<숫자>` 하나의 응답을 갈아끼운다. 나중에 건 라우트가 이긴다. */
export async function stubRecipeDetail(
  context: BrowserContext,
  body: unknown,
): Promise<void> {
  await context.route(/\/api\/v1\/recipes\/\d+$/, (route: Route) =>
    route.fulfill({ json: body }),
  );
}

/**
 * id 101~151이 각자 자기 id를 담은 응답을 낸다. <b>개수만 세는 테스트 전용이다</b> — 지어낸 픽스처로
 * 내용을 검증하지 않는다. 서로 다른 레시피 51개를 실제 응답으로 뜰 수는 없다.
 */
export async function stubSyntheticRecipes(
  context: BrowserContext,
): Promise<void> {
  await context.route(/\/api\/v1\/recipes\/1\d\d$/, (route: Route) => {
    const id = Number(new URL(route.request().url()).pathname.split("/").pop());
    return route.fulfill({ json: { ...hoffmann, id, title: `레시피 ${id}` } });
  });
}

/**
 * 오프라인으로 만든다.
 *
 * <p><b>`context.setOffline(true)`만으로는 부족하다</b>(2026-09-06에 확인했다). 스텁은
 * `route.fulfill`로 응답을 만들어 내므로 네트워크를 끊어도 계속 답한다. 라우트를 `abort`로 덮어야
 * 실제로 끊긴다 — 나중에 건 라우트가 이긴다.
 */
export async function goOffline(context: BrowserContext): Promise<void> {
  await context.route("**/*", (route: Route) =>
    route.abort("internetdisconnected"),
  );
  await context.setOffline(true);
}

import type { Page, Route } from "@playwright/test";
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
  [/^\/api\/v1\/recipes\/\d+$/, hoffmann],
  [/^\/api\/v1\/recipes$/, pageOf([hoffmannSummary, kasuyaSummary])],
  [/^\/api\/v1\/brew-logs\/\d+$/, brewLogWithTds],
  [/^\/api\/v1\/brew-logs$/, brewLogPage],
  [/^\/api\/v1\/gear\/brewers$/, brewers],
  [/^\/api\/v1\/gear\/filters$/, filters],
  [/^\/api\/v1\/gear\/user-grinders$/, [myComandante]],
  [/^\/api\/v1\/gear\/grinders$/, [comandanteC40, holzklotzE80, wilfaUniform]],
  [/^\/api\/v1\/bean-batches$/, [yirgacheffeBatch]],
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

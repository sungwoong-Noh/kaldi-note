import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecipeDetail } from "@/features/recipe/components/RecipeDetail";
import { clearSession, setAccessToken } from "@/lib/session";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/recipes/2",
}));

afterEach(() => clearSession());

function ssr() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderToString(
    <QueryClientProvider client={client}>
      <RecipeDetail id={2} />
    </QueryClientProvider>,
  );
}

/**
 * 서버 렌더 결과가 브라우저 메모리 상태에 좌우되면 하이드레이션이 깨진다.
 *
 * <p>실제로 겪은 버그다 — `useState(() => getAccessToken() !== null)`로 초기값을 잡았더니 서버는 빈 껍데기를, 클라이언트는 본문을 그려
 * `/recipes/[id]`에서 "A tree hydrated but some attributes ... didn't match"가 났다. 목록(`/recipes`)은 정적
 * 프리렌더라 드러나지 않았다.
 *
 * <p>Testing Library는 클라이언트 렌더만 해서 이걸 잡지 못한다. 그래서 renderToString으로 따로 본다.
 */
describe("서버 렌더 스냅샷", () => {
  it("토큰이 있든 없든 서버 출력이 같다", () => {
    const withoutToken = ssr();

    setAccessToken("a.b.c");
    const withToken = ssr();

    expect(withToken).toBe(withoutToken);
  });

  it("토큰이 메모리에 있어도 서버는 본문을 그리지 않는다", () => {
    setAccessToken("a.b.c");

    const html = ssr();

    // 로그인 여부는 서버가 알 수 없다. 콘텐츠는 하이드레이션 후에 나온다.
    expect(html).not.toContain("푸어 스텝");
    expect(html).not.toContain("내 레시피로 가져오기");
  });
});

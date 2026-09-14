import { expect, test } from "@playwright/test";
import { pageOf } from "../src/test/fixtures";
import { installStubs } from "./stubs";

/**
 * 간격·모서리의 렌더 검사.
 *
 * <p><b>소스 검사는 「금지된 것이 없다」만 본다.</b> 클래스가 맞아도 부모가 덮으면 화면이 다르다.
 * 여기서만 그것을 잡는다.
 */

test.describe("간격·모서리 — 렌더값", () => {
  test("AC-SPACE-09 · 카드가 padding 16px · radius 8px다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const card = page.getByRole("link", { name: /James Hoffmann/ }).first();
    await expect(card).toBeVisible();

    const box = await card.evaluate((el) => {
      const style = getComputedStyle(el);
      return { pad: style.paddingTop, radius: style.borderTopLeftRadius };
    });

    expect(box).toEqual({ pad: "16px", radius: "8px" });
  });

  test("AC-SPACE-10 · 버튼이 radius 6px다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const button = page.getByRole("link", { name: "새 레시피" });
    await expect(button).toBeVisible();

    expect(
      await button.evaluate((el) => getComputedStyle(el).borderTopLeftRadius),
    ).toBe("6px");
  });

  test("AC-SPACE-11 · 빈 상태의 세로 여백이 48px다", async ({ page }) => {
    await installStubs(page);
    // 기본 스텁은 레시피 둘을 준다. 목록만 빈 페이지로 덮어쓴다. 나중에 등록한 route가 이긴다.
    // 경로를 술어로 정확히 집는다 — 글로브 `recipes?**`는 `?`가 한 글자 와일드카드라
    // `/recipes/12`까지 잡는다. 봉투는 지어내지 않고 `pageOf([])`를 그대로 쓴다.
    await page.route(
      (url) => url.pathname === "/api/v1/recipes",
      (route) => route.fulfill({ json: pageOf([]) }),
    );
    await page.goto("/recipes");

    const empty = page.getByText("레시피가 없습니다");
    await expect(empty).toBeVisible();

    expect(await empty.evaluate((el) => getComputedStyle(el).paddingTop)).toBe(
      "48px",
    );
  });
});

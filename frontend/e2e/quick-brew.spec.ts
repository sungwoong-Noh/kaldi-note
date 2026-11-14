import { expect, test, type Locator, type Route } from "@playwright/test";
import {
  brewLogPage,
  brewLogWithoutTds,
  me,
  myComandante,
  pageOf,
  yirgacheffeProduct,
} from "../src/test/fixtures";
import { installStubs } from "./stubs";

const LAST_LOG = {
  ...brewLogWithoutTds,
  id: 501,
  recipeId: undefined,
  beanBatchId: undefined,
  beanProductId: 41,
  actualDoseG: 16.0,
  actualWaterG: 250.0,
  userGrinderId: 3,
  actualGrindSettingValue: 24.0,
  actualWaterTempC: 92.0,
  visibility: "FRIENDS" as const,
};

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`AC-QUICKBREW-20 · ${viewport.width}×${viewport.height} 홈에서 「이대로 기록」→ 별 4개 → 「저장」 3회 클릭으로 기록을 끝낸다`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await installStubs(page);

    const postedBodies: Array<Record<string, unknown>> = [];

    await page.route("**/api/v1/gear/user-grinders", async (route: Route) => {
      await route.fulfill({ json: [{ ...myComandante, id: 3 }] });
    });
    await page.route("**/api/v1/bean-products/**", async (route: Route) => {
      await route.fulfill({ json: { ...yirgacheffeProduct, id: 41 } });
    });
    await page.route("**/api/v1/bean-products", async (route: Route) => {
      await route.fulfill({ json: [{ ...yirgacheffeProduct, id: 41 }] });
    });
    await page.route("**/api/v1/brew-logs*", async (route: Route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (req.method() === "POST" && url.pathname === "/api/v1/brew-logs") {
        const body = req.postDataJSON() as Record<string, unknown>;
        postedBodies.push(body);
        await route.fulfill({
          status: 201,
          json: {
            ...LAST_LOG,
            id: 502,
            rating: body.rating,
          },
        });
        return;
      }
      if (url.pathname === "/api/v1/brew-logs") {
        await route.fulfill({
          json: {
            ...brewLogPage,
            ...pageOf([LAST_LOG]),
          },
        });
        return;
      }
      await route.fallback();
    });

    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "이대로 기록" }),
    ).toBeVisible();

    await page.evaluate(() => {
      const w = window as unknown as { __domClickCount?: number };
      w.__domClickCount = 0;
      document.addEventListener(
        "click",
        () => {
          w.__domClickCount = (w.__domClickCount ?? 0) + 1;
        },
        true,
      );
    });

    let clickSteps = 0;
    async function countClick(
      target: Locator,
      options?: Parameters<Locator["click"]>[0],
    ) {
      clickSteps += 1;
      await target.click(options);
    }

    // 1. 홈 「이대로 기록」 → ① 건너뛰고 ② 별점으로 바로 연다
    await countClick(page.getByRole("button", { name: "이대로 기록" }));

    // 2. 별 4개 오른쪽 절반 클릭(4.0)
    const fourthStar = page.getByRole("radio", { name: "별 4" });
    await expect(fourthStar).toBeVisible();
    const starBox = await fourthStar.boundingBox();
    expect(starBox).not.toBeNull();
    await countClick(fourthStar, {
      position: {
        x: Math.round((starBox?.width ?? 44) * 0.75),
        y: Math.round((starBox?.height ?? 44) * 0.5),
      },
    });

    // 3. 「저장」 클릭
    await countClick(page.getByRole("button", { name: "저장" }));

    await expect(page.getByText("기록했어요")).toBeVisible();
    expect(clickSteps).toBe(3);
    const domClicks = await page.evaluate(
      () => (window as unknown as { __domClickCount?: number }).__domClickCount,
    );
    expect(domClicks).toBe(3);

    expect(postedBodies).toHaveLength(1);
    expect(postedBodies[0]).toMatchObject({
      beanProductId: 41,
      actualDoseG: 16.0,
      actualWaterG: 250.0,
      userGrinderId: 3,
      actualGrindSettingValue: 24.0,
      actualWaterTempC: 92.0,
      visibility: "FRIENDS",
      rating: 4.0,
    });
  });
}

test.describe("AC-QUICKBREW-65 · 오늘 홈 300ms 지연 로딩 뼈대 규칙", () => {
  test("250ms 이내에 응답이 오면 로딩 뼈대를 전혀 그리지 않는다", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      const w = window as unknown as { __sawTodaySkeleton?: boolean };
      w.__sawTodaySkeleton = false;
      const observer = new MutationObserver(() => {
        if (document.querySelector("[data-today-skeleton]") !== null) {
          w.__sawTodaySkeleton = true;
        }
      });
      observer.observe(document, { childList: true, subtree: true });
    });

    await installStubs(page);
    await page.route("**/api/v1/users/me", async (route: Route) => {
      await route.fulfill({ json: me });
    });
    await page.route(/\/api\/v1\/brew-logs(?:\?.*)?$/, async (route: Route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ json: pageOf([]) });
    });

    await page.goto("/");
    await expect(page.getByText("첫 잔을 기록해 보세요")).toBeVisible();
    const sawEarly = await page.evaluate(
      () =>
        (window as unknown as { __sawTodaySkeleton?: boolean })
          .__sawTodaySkeleton,
    );
    expect(sawEarly).toBe(false);
  });

  test("600ms 지연이면 300ms 이후 뼈대를 보이고 도착 시 120ms 페이드로 전환한다", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installStubs(page);
    await page.route("**/api/v1/users/me", async (route: Route) => {
      await route.fulfill({ json: me });
    });
    await page.route(/\/api\/v1\/brew-logs(?:\?.*)?$/, async (route: Route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fulfill({ json: pageOf([]) });
    });

    await page.goto("/");
    await expect(page.locator("[data-today-skeleton]")).toBeVisible();
    await expect(page.getByText("첫 잔을 기록해 보세요")).toBeVisible();

    const fadeDuration = await page
      .locator(".kn-today-fade-in")
      .evaluate((el) => getComputedStyle(el).animationDuration);
    expect(fadeDuration).toBe("0.12s");
  });
});

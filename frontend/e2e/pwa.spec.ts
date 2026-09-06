import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { hoffmann } from "../src/test/fixtures";
import {
  goOffline,
  installStubs,
  installSwStubs,
  stubRecipeDetail,
  stubSyntheticRecipes,
} from "./stubs";

test.describe("매니페스트", () => {
  test("AC-PWA-01 · /manifest.json이 200이고 manifest MIME이다", async ({
    request,
  }) => {
    const response = await request.get("/manifest.json");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(
      "application/manifest+json",
    );
  });

  test("AC-PWA-02 · 이름이 kaldi note다", async ({ request }) => {
    const manifest = await (await request.get("/manifest.json")).json();
    expect(manifest.name).toBe("kaldi note");
    expect(manifest.short_name).toBe("kaldi note");
  });

  test("AC-PWA-03 · standalone으로 / 에서 시작한다", async ({ request }) => {
    const manifest = await (await request.get("/manifest.json")).json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
  });

  test("AC-PWA-04 · 색이 흰색이다", async ({ request }) => {
    const manifest = await (await request.get("/manifest.json")).json();
    expect(manifest.theme_color).toBe("#ffffff");
    expect(manifest.background_color).toBe("#ffffff");
  });

  test("AC-PWA-05 · 아이콘 3장이 실제로 열린다", async ({ request }) => {
    const manifest = await (await request.get("/manifest.json")).json();
    expect(manifest.icons).toHaveLength(3);
    expect(
      manifest.icons.map(
        (i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`,
      ),
    ).toEqual(["192x192 any", "512x512 any", "512x512 maskable"]);

    for (const icon of manifest.icons) {
      const file = await request.get(icon.src);
      expect(file.status(), icon.src).toBe(200);
      expect(file.headers()["content-type"], icon.src).toContain("image/png");
    }
  });

  test("AC-PWA-06 · 문서가 매니페스트를 가리킨다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");
    await expect(
      page.locator('link[rel="manifest"][href="/manifest.json"]'),
    ).toHaveCount(1);
  });
});

test.describe("Service Worker", () => {
  test("AC-PWA-07 · /sw.js가 열린다", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/javascript");
  });

  test("AC-PWA-08 · 등록되고 scope가 루트다", async ({ page, baseURL }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.scope;
    });
    expect(scope).toBe(`${baseURL}/`);
    expect(
      await page.evaluate(() => navigator.serviceWorker.controller !== null),
    ).toBe(true);
  });
});

/** `kaldi-recipe-v1`에 든 키의 URL 목록. */
async function recipeCacheKeys(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const cache = await caches.open("kaldi-recipe-v1");
    return (await cache.keys()).map((request) => request.url);
  });
}

test.describe("레시피 캐시", () => {
  test("AC-PWA-09 · 연 레시피가 캐시에 들어간다", async ({ page, context }) => {
    await installSwStubs(context);
    await installStubs(page);
    // Given이 "Service Worker가 등록됐고"다. 목록은 캐시 대상이 아니라 캐시는 빈 채로 남는다.
    await page.goto("/recipes");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    await page.goto("/recipes/2");
    await expect(page.getByText("James Hoffmann Ultimate V60")).toBeVisible();

    await expect
      .poll(() => recipeCacheKeys(page))
      .toEqual([expect.stringMatching(/\/api\/v1\/recipes\/2$/)]);
  });

  test("AC-PWA-10 · 온라인에서는 캐시가 최신을 가리지 않는다", async ({
    page,
    context,
  }) => {
    await installSwStubs(context);
    await installStubs(page);
    // SW가 붙기 전에는 page.route가 이겨서 갈아끼운 응답이 무시된다.
    await page.goto("/recipes");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    await page.goto("/recipes/2");
    await expect(page.getByText("100°C")).toBeVisible();

    await stubRecipeDetail(context, { ...hoffmann, waterTempC: 94.0 });
    await page.goto("/recipes/2");

    await expect(page.getByText("94°C")).toBeVisible();
    await expect(page.getByText("100°C")).toHaveCount(0);
  });

  test("AC-PWA-19 · 50개까지는 전부 남는다", async ({ page, context }) => {
    await installSwStubs(context);
    await stubSyntheticRecipes(context);
    await installStubs(page);
    await page.goto("/recipes");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    for (let id = 101; id <= 150; id += 1) await page.goto(`/recipes/${id}`);

    await expect.poll(async () => (await recipeCacheKeys(page)).length).toBe(50);
    expect(await recipeCacheKeys(page)).toContainEqual(
      expect.stringMatching(/\/api\/v1\/recipes\/101$/),
    );
  });

  test("AC-PWA-20 · 51번째에서 가장 오래된 것이 빠진다", async ({
    page,
    context,
  }) => {
    await installSwStubs(context);
    await stubSyntheticRecipes(context);
    await installStubs(page);
    await page.goto("/recipes");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    for (let id = 101; id <= 151; id += 1) await page.goto(`/recipes/${id}`);

    // 개수만 기다리면 101~150으로 이미 50이라, 마지막 151의 캐시 쓰기를 기다리지 않는다.
    await expect
      .poll(async () =>
        (await recipeCacheKeys(page)).some((url) => url.endsWith("/151")),
      )
      .toBe(true);

    await expect.poll(async () => (await recipeCacheKeys(page)).length).toBe(50);
    const keys = await recipeCacheKeys(page);
    expect(keys).not.toContainEqual(
      expect.stringMatching(/\/api\/v1\/recipes\/101$/),
    );
    expect(keys).toContainEqual(
      expect.stringMatching(/\/api\/v1\/recipes\/151$/),
    );
  });

  test("AC-PWA-21 · 캐시에 없는 API 요청은 오프라인에서 503이다", async ({
    page,
    context,
  }) => {
    await installSwStubs(context);
    await installStubs(page);
    await page.goto("/recipes/2");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    await goOffline(context);
    const result = await page.evaluate(async () => {
      const response = await fetch("http://localhost:8080/api/v1/recipes/3");
      return { status: response.status, body: await response.text() };
    });

    expect(result.status).toBe(503);
    expect(JSON.parse(result.body)).toEqual({
      code: "OFFLINE",
      message: "네트워크에 연결되어 있지 않습니다.",
    });
  });
});

test.describe("오프라인 재방문", () => {
  test("AC-PWA-11 · 연 적 있는 레시피가 오프라인에서 열린다", async ({
    page,
    context,
  }) => {
    await installSwStubs(context);
    await installStubs(page);
    await page.goto("/recipes");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });

    await page.goto("/recipes/2");
    await expect(page.getByText("James Hoffmann Ultimate V60")).toBeVisible();

    await goOffline(context);
    await page.reload();

    await expect(page.getByText("James Hoffmann Ultimate V60")).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(7);
  });

  test("AC-PWA-12 · 연 적 없는 레시피는 안내로 떨어진다", async ({
    page,
    context,
  }) => {
    await installSwStubs(context);
    await installStubs(page);
    await page.goto("/recipes");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.goto("/recipes/2");

    await goOffline(context);
    await page.goto("/recipes/3");

    await expect(page.getByText("연결 없음")).toBeVisible();
  });

  test("AC-PWA-13 · 오프라인 콜드 스타트가 로그인으로 튕기지 않는다", async ({
    page,
    context,
  }) => {
    await installSwStubs(context);
    await installStubs(page);
    await page.goto("/recipes");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.goto("/recipes/2");

    await goOffline(context);
    await page.reload();
    await page.waitForTimeout(5000);

    expect(new URL(page.url()).pathname).toBe("/recipes/2");
  });
});

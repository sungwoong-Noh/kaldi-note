import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

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

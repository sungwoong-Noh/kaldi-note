import { expect, test, type Page } from "@playwright/test";
import { me } from "../src/test/fixtures";
import unspecialty from "../src/test/admin/run-unspecialty.json";
import runsPage from "../src/test/admin/runs-page.json";
import sources from "../src/test/admin/sources.json";
import { installStubs } from "./stubs";

/** 관리자 콘솔 반응형 — docs/specs/2026-10-19-admin-crawl-console.md AC-ADMIN-40·41. */
async function open(page: Page, width: number, path: string) {
  await page.setViewportSize({ width, height: 900 });
  await installStubs(page);
  // installStubs 뒤에 등록해야 이긴다(GOTCHAS 「page.route는 나중에 등록한 쪽이 이긴다」).
  await page.route("**/api/v1/users/me", (route) =>
    route.fulfill({ json: { ...me, role: "ADMIN" } }),
  );
  await page.route("**/api/v1/admin/crawl-sources", (route) =>
    route.fulfill({ json: sources }),
  );
  await page.route("**/api/v1/admin/crawl-runs?*", (route) =>
    route.fulfill({ json: runsPage }),
  );
  await page.route("**/api/v1/admin/crawl-runs/*", (route) =>
    route.fulfill({ json: unspecialty }),
  );
  await page.goto(path);
}

test("AC-ADMIN-40 · 960px 미만은 안내만 보인다", async ({ page }) => {
  await open(page, 900, "/admin/crawl");

  await expect(
    page.getByText("관리자 화면은 데스크톱에서 열어 주세요."),
  ).toBeVisible();
  await expect(page.getByTestId("source-momos")).toBeHidden();
});

test("AC-ADMIN-41 · 960–1279px은 패널이 오른쪽 오버레이, 1440px은 오른쪽 열", async ({
  page,
}) => {
  await open(page, 1100, "/admin/crawl?run=4");
  const panel = page.getByTestId("run-panel");
  await expect(panel.getByText("Run #4 · unspecialty")).toBeVisible();
  expect(await panel.evaluate((el) => getComputedStyle(el).position)).toBe(
    "fixed",
  );
  const box = await panel.boundingBox();
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBe(1100);

  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await panel.evaluate((el) => getComputedStyle(el).position)).not.toBe(
    "fixed",
  );
  const wide = await panel.boundingBox();
  expect(wide?.width).toBe(420);
  expect((wide?.x ?? 0) + (wide?.width ?? 0)).toBe(1440);
});

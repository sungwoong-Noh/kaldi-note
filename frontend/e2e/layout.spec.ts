import { expect, test } from "@playwright/test";
import { SCREENS } from "./screens";
import { installStubs } from "./stubs";

for (const screen of SCREENS) {
  test(`AC-WEBLAYOUT-04 · ${screen.path} — 스텁되지 않은 요청이 없다`, async ({
    page,
  }) => {
    const stubs = await installStubs(page);

    await page.goto(screen.path);
    await page.waitForLoadState("networkidle");

    expect(stubs.unstubbed).toEqual([]);
  });
}

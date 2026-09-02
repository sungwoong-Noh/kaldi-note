import { expect, test, type Locator } from "@playwright/test";
import { SCREENS, TAB_BAR_SCREENS } from "./screens";
import { installStubs } from "./stubs";
import { notBelow, withinTolerance } from "./tolerance";

/** playwright.config.ts의 뷰포트와 같아야 한다. */
const VIEWPORT = { width: 360, height: 800 } as const;

const TAB_BAR = { role: "navigation", name: "주요 화면" } as const;

/**
 * `boundingBox()`는 요소가 화면에 없으면 null을 준다. `!`로 지우면 그 경우가 "0에서 잰 값"으로
 * 둔갑해 판정이 조용히 통과한다. 여기서 끊어 실패 메시지에 어느 요소인지 남긴다.
 */
async function boxOf(
  locator: Locator,
  label: string,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error(
      `${label}의 boundingBox가 null이다 — 화면에 그려지지 않았다`,
    );
  }
  return box;
}

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

for (const screen of TAB_BAR_SCREENS) {
  test(`AC-WEBLAYOUT-01 · ${screen.path} — 탭바가 뷰포트 하단에 붙는다`, async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto(screen.path);

    const nav = page.getByRole(TAB_BAR.role, { name: TAB_BAR.name });
    await nav.waitFor();
    const box = await boxOf(nav, "탭바");
    const bottom = box.y + box.height;

    expect(
      withinTolerance(bottom, VIEWPORT.height),
      `탭바 하단이 ${bottom}px다. 뷰포트 높이 ${VIEWPORT.height}px여야 한다`,
    ).toBe(true);
  });
}

for (const screen of SCREENS) {
  test(`AC-WEBLAYOUT-02 · ${screen.path} — 가로 스크롤이 없다`, async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto(screen.path);
    await page.waitForLoadState("networkidle");

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );

    expect(
      notBelow(scrollWidth, VIEWPORT.width),
      `문서 폭이 ${scrollWidth}px다. 뷰포트 폭 ${VIEWPORT.width}px를 넘으면 가로로 스크롤된다`,
    ).toBe(true);
  });
}

for (const screen of TAB_BAR_SCREENS) {
  test(`AC-WEBLAYOUT-03 · ${screen.path} — 탭바가 본문 끝을 가리지 않는다`, async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto(screen.path);
    const nav = page.getByRole(TAB_BAR.role, { name: TAB_BAR.name });
    await nav.waitFor();
    // 탭바가 보인다고 본문이 다 그려진 것은 아니다. 레시피 상세는 이 시점에 문서가 아직
    // 800px이라 스크롤이 0에 클램프되고, 그 뒤 993px로 자란다 — 맨 아래가 아닌 곳을 재게 된다.
    await page.waitForLoadState("networkidle");
    await page.evaluate(async () => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((resolve) =>
        requestAnimationFrame(() => resolve(null)),
      );
    });

    // 「맨 아래까지 스크롤한다」가 이 조건의 전제다. 못 갔으면 잰 값에 의미가 없다.
    const atBottom = await page.evaluate(
      () =>
        window.scrollY >=
        document.documentElement.scrollHeight - window.innerHeight - 1,
    );
    expect(atBottom, "문서 맨 아래까지 스크롤되지 않았다").toBe(true);

    const main = await boxOf(page.locator("main").first(), "본문");
    const navBox = await boxOf(nav, "탭바");
    const mainBottom = main.y + main.height;

    expect(
      notBelow(mainBottom, navBox.y),
      `본문 끝이 ${mainBottom}px, 탭바 위쪽이 ${navBox.y}px다. 본문이 탭바 밑으로 들어갔다`,
    ).toBe(true);
  });
}

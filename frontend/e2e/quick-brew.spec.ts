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

async function setupQuickBrewPanelStubs(
  page: Parameters<typeof installStubs>[0],
) {
  const postedBodies: Array<Record<string, unknown>> = [];
  await installStubs(page);
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
  return postedBodies;
}

async function waitForMotionSettled(locator: Locator) {
  await locator.evaluate((el) =>
    Promise.all(el.getAnimations().map((animation) => animation.finished)),
  );
}

test.describe("AC-QUICKBREW-67 · 웹 오른쪽 패널 폭 · Esc · 바깥 클릭 · Enter", () => {
  for (const { width, height, expectedWidth } of [
    { width: 1440, height: 900, expectedWidth: 440 },
    { width: 1100, height: 900, expectedWidth: 400 },
    { width: 900, height: 900, expectedWidth: 520 },
  ]) {
    test(`${width}×${height}에서 오른쪽 패널 폭 ${expectedWidth}px와 Esc·바깥 클릭·Enter가 동작한다`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      const postedBodies = await setupQuickBrewPanelStubs(page);

      await page.goto("/");
      const trigger = page
        .locator("button:visible", { hasText: "기록하기" })
        .first();
      await expect(trigger).toBeVisible();
      await trigger.click();

      const dialog = page.getByRole("dialog", { name: "빠른 기록" });
      await expect(dialog).toBeVisible();
      await waitForMotionSettled(dialog);

      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.round(box!.width)).toBe(expectedWidth);
      expect(Math.round(box!.x + box!.width)).toBe(width);
      expect(Math.round(box!.y)).toBe(0);
      expect(Math.round(box!.height)).toBe(height);
      await expect(dialog.locator("[data-sheet-handle]")).toBeHidden();

      // 바뀐 입력 없이 Esc → 즉시 닫힘
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);

      // 다시 열고 Enter로 ① → ② 진행 후 별점 선택
      await trigger.click();
      await expect(dialog).toBeVisible();
      await waitForMotionSettled(dialog);
      await expect(
        dialog.getByRole("heading", { name: "지난번과 같은가요?" }),
      ).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(
        dialog.getByRole("heading", { name: "맛은 어땠나요?" }),
      ).toBeVisible();

      await dialog.getByRole("radio", { name: "별 4" }).click();

      // 입력 변경 뒤 Esc → 확인 카드 → 다시 Esc로 계속 쓰기
      await page.keyboard.press("Escape");
      const alertDialog = dialog.getByRole("alertdialog", {
        name: "기록을 그만둘까요?",
      });
      await expect(alertDialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(alertDialog).toBeHidden();

      // 바깥(스크림) 클릭 → 확인 카드 → Enter로 「계속 쓰기」
      await page.mouse.click(20, 20);
      await expect(alertDialog).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(alertDialog).toBeHidden();

      // Enter로 「저장」 → 「기록했어요」 → Enter로 「확인」 닫기
      await page.keyboard.press("Enter");
      await expect(
        dialog.getByRole("heading", { name: "기록했어요" }),
      ).toBeVisible();
      expect(postedBodies).toHaveLength(1);
      await page.keyboard.press("Enter");
      await expect(dialog).toHaveCount(0);
    });
  }

  test("AC-QUICKBREW-61 · reduced-motion이면 닫을 때 즉시 언마운트된다", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setupQuickBrewPanelStubs(page);

    await page.goto("/");
    await page
      .locator("button:visible", { hasText: "기록하기" })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "빠른 기록" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});

test.describe("AC-QUICKBREW-68 · 모바일 바텀시트 손잡이 끌어 닫기", () => {
  test("바뀐 입력이 없으면 시트 높이의 29%에서 복귀하고 31%에서 닫히며, 바뀐 입력이 있으면 확인 카드를 연다", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupQuickBrewPanelStubs(page);

    await page.goto("/");
    const recordButton = page
      .locator("button:visible", { hasText: "기록하기" })
      .first();
    await expect(recordButton).toBeVisible();
    await recordButton.click();

    const dialog = page.getByRole("dialog", { name: "빠른 기록" });
    const handle = dialog.locator("[data-sheet-handle]");
    await expect(dialog).toBeVisible();
    await expect(handle).toBeVisible();
    await waitForMotionSettled(dialog);

    const sheetBox = await dialog.boundingBox();
    const handleBox = await handle.boundingBox();
    expect(sheetBox).not.toBeNull();
    expect(handleBox).not.toBeNull();
    expect(Math.round(sheetBox!.y + sheetBox!.height)).toBe(844);

    const cx = handleBox!.x + handleBox!.width / 2;
    const cy = handleBox!.y + handleBox!.height / 2;

    // 29% 드래그 → 제자리 복귀
    const dy29 = Math.floor(sheetBox!.height * 0.29);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy + dy29, { steps: 10 });
    await page.mouse.up();
    await waitForMotionSettled(dialog);
    await expect(dialog).toBeVisible();
    const restoredBox = await dialog.boundingBox();
    expect(restoredBox).not.toBeNull();
    expect(Math.abs(restoredBox!.y - sheetBox!.y)).toBeLessThanOrEqual(1);

    // 31% 드래그 → 닫힘
    const dy31 = Math.ceil(sheetBox!.height * 0.31);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy + dy31, { steps: 10 });
    await page.mouse.up();
    await expect(dialog).toHaveCount(0);

    // 입력이 바뀐 상태에서 31% 드래그 → 확인 카드 표시 후 「그만두기」로 닫기
    await page.getByRole("button", { name: "이대로 기록" }).click();
    await expect(dialog).toBeVisible();
    await waitForMotionSettled(dialog);
    await dialog.getByRole("radio", { name: "별 4" }).click();

    const dirtySheetBox = await dialog.boundingBox();
    const dirtyHandleBox = await handle.boundingBox();
    const dcx = dirtyHandleBox!.x + dirtyHandleBox!.width / 2;
    const dcy = dirtyHandleBox!.y + dirtyHandleBox!.height / 2;
    await page.mouse.move(dcx, dcy);
    await page.mouse.down();
    await page.mouse.move(dcx, dcy + Math.ceil(dirtySheetBox!.height * 0.31), {
      steps: 10,
    });
    await page.mouse.up();

    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("alertdialog", { name: "기록을 그만둘까요?" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "그만두기" }).click();
    await expect(dialog).toHaveCount(0);
  });
});

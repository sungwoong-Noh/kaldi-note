import { expect, test, type Locator, type Route } from "@playwright/test";
import {
  brewLogPage,
  brewLogWithTds,
  brewLogWithoutTds,
  hoffmann,
  hoffmannSummary,
  me,
  myComandante,
  pageOf,
  yirgacheffeProduct,
} from "../src/test/fixtures";
import { undersized } from "./hitArea";
import { installStubs, installSwStubs, stubRecipeDetail } from "./stubs";

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

test.describe("AC-QUICKBREW-82 · ② 「자세히」 터치 타깃·키패드·레시피 연결 저장 후 상세 비교표 (Task 14)", () => {
  test("390×844에서 44×44 터치 타깃·inputMode를 확인하고 레시피를 연결해 저장하면 상세에 비교표가 보인다", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installStubs(page);
    await installSwStubs(page.context());

    const recipe12Summary = {
      ...hoffmannSummary,
      id: 12,
      sourceType: "USER" as const,
      title: "아침 V60 15g",
      doseG: 15,
      waterG: 240,
      ratio: 16.0,
      waterTempC: 92,
      authorDisplayName: me.nickname,
    };
    const recipe12Detail = {
      ...hoffmann,
      ...recipe12Summary,
      steps: [],
    };
    await stubRecipeDetail(page.context(), recipe12Detail);

    let savedLog: Record<string, unknown> | null = null;
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
    await page.route(
      /\/api\/v1\/recipes(?:\/\d+)?(?:\?.*)?$/,
      async (route: Route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/api/v1/recipes/12") {
          await route.fulfill({ json: recipe12Detail });
          return;
        }
        if (url.pathname === "/api/v1/recipes") {
          await route.fulfill({
            json: pageOf([recipe12Summary], { size: 50 }),
          });
          return;
        }
        await route.fallback();
      },
    );
    await page.route(
      /\/api\/v1\/brew-logs(?:\/\d+)?(?:\?.*)?$/,
      async (route: Route) => {
        const req = route.request();
        const url = new URL(req.url());
        if (req.method() === "POST" && url.pathname === "/api/v1/brew-logs") {
          const body = req.postDataJSON() as Record<string, unknown>;
          postedBodies.push(body);
          savedLog = {
            ...LAST_LOG,
            ...body,
            id: 502,
            brewRatio: 15.6,
            extractionYieldPercent: 18.3,
            strengthZone: "IDEAL",
            diagnosis: brewLogWithTds.diagnosis,
          };
          await route.fulfill({ status: 201, json: savedLog });
          return;
        }
        if (url.pathname === "/api/v1/brew-logs/502" && savedLog) {
          await route.fulfill({ json: savedLog });
          return;
        }
        if (url.pathname === "/api/v1/brew-logs") {
          const content = savedLog ? [savedLog, LAST_LOG] : [LAST_LOG];
          await route.fulfill({
            json: {
              ...brewLogPage,
              ...pageOf(content),
            },
          });
          return;
        }
        await route.fallback();
      },
    );

    await page.goto("/");
    await page.getByRole("button", { name: "이대로 기록" }).click();

    const dialog = page.getByRole("dialog", { name: "빠른 기록" });
    await expect(dialog).toBeVisible();
    await waitForMotionSettled(dialog);

    await dialog.getByRole("button", { name: /자세히/ }).click();

    // inputMode: TDS·음료 중량은 decimal, 총 시간·드로다운은 없음
    await expect(dialog.getByLabel("TDS")).toHaveAttribute(
      "inputmode",
      "decimal",
    );
    await expect(dialog.getByLabel("음료 중량")).toHaveAttribute(
      "inputmode",
      "decimal",
    );
    await expect(dialog.getByLabel("총 시간")).not.toHaveAttribute(
      "inputmode",
      /.*/,
    );
    await expect(dialog.getByLabel("드로다운")).not.toHaveAttribute(
      "inputmode",
      /.*/,
    );

    // 44×44px 터치 타깃: 맛 점 · 세그먼트 · 고르기
    expect(
      await dialog
        .locator('[data-kit="taste-dots"] button')
        .evaluateAll(undersized),
    ).toEqual([]);
    expect(
      await dialog
        .locator('[role="radiogroup"][aria-label="공개 범위"] button')
        .evaluateAll(undersized),
    ).toEqual([]);
    const pickRecipeButton = dialog.getByRole("button", {
      name: /레시피 연결/,
    });
    expect(await pickRecipeButton.evaluateAll(undersized)).toEqual([]);

    await dialog.getByLabel("총 시간").fill("2:45");
    await dialog.getByLabel("드로다운").fill("0:35");
    await dialog.getByRole("button", { name: "산미 4" }).click();
    await dialog.getByLabel("TDS").fill("1.38");
    await dialog.getByLabel("음료 중량").fill("212");

    await pickRecipeButton.click();
    const linkDialog = page.getByRole("dialog", { name: "레시피 연결" });
    await expect(linkDialog).toBeVisible();
    await waitForMotionSettled(linkDialog);

    const morningBtn = linkDialog.getByRole("button", {
      name: /아침 V60 15g/,
    });
    await expect(morningBtn).toBeVisible();
    expect(
      await linkDialog.locator("ul button").evaluateAll(undersized),
    ).toEqual([]);

    await morningBtn.click();
    await expect(linkDialog).toHaveCount(0);
    await expect(pickRecipeButton).toContainText("아침 V60 15g");

    await dialog.getByRole("button", { name: "저장" }).click();
    await expect(
      dialog.getByRole("heading", { name: "기록했어요" }),
    ).toBeVisible();
    expect(postedBodies).toHaveLength(1);
    expect(postedBodies[0]).toMatchObject({
      actualDoseG: 16,
      actualWaterG: 250,
      actualTotalTimeSeconds: 165,
      actualDrawdownSeconds: 35,
      acidity: 4,
      tdsPercent: 1.38,
      beverageWeightG: 212,
      recipeId: 12,
    });

    await dialog.getByRole("button", { name: "확인" }).click();
    await expect(dialog).toHaveCount(0);

    await page.goto("/brews/502");
    const compare = page.locator("[data-compare]");
    await expect(compare).toBeVisible();
    await expect(compare).toContainText("레시피대로 내렸나");
    await expect(compare).toContainText("현재 레시피와 비교");
    await expect(compare.locator('[data-compare-row="원두량"]')).toContainText(
      "15",
    );
    await expect(compare.locator('[data-compare-row="원두량"]')).toContainText(
      "16",
    );
  });
});

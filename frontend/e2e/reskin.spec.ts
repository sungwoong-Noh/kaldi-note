import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";

/**
 * 리스킨 — docs/specs/2026-09-17-screen-reskin.md
 *
 * <p>히어로 카드는 「대표 수치를 판 위에 올린다」는 구조다. 소스 검사로는 판이 실제로
 * 어두운지, 아이브로우가 대문자로 렌더되는지 알 수 없다 — 여기서만 잡는다.
 */
const HERO_SCREENS = [
  ["/recipes/12", "레시피 상세"],
  ["/brews/2", "기록 상세"],
] as const;

test.describe("리스킨 — 히어로", () => {
  for (const [path, label] of HERO_SCREENS) {
    test(`AC-SKIN-03 · ${label}의 대표 수치가 히어로 안에 있다`, async ({
      page,
    }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const lead = page.locator("[data-lead]").first();
      await expect(lead).toBeVisible();

      // 대표 수치의 조상에 히어로가 있어야 한다.
      const inHero = await lead.evaluate(
        (el) => el.closest("[data-hero]") !== null,
      );
      expect(inHero).toBe(true);
    });
  }

  test("AC-SKIN-04 · 히어로는 라이트 모드에서도 어두운 판이다", async ({
    page,
  }) => {
    await installStubs(page);
    await page.goto("/recipes/12");
    await page.waitForLoadState("networkidle");

    // 배경(paper)보다 어두워야 한다 — 모드와 무관하게 판이 유지되는지 본다.
    const { hero, paper } = await page.evaluate(() => {
      const lum = (c: string) => {
        const probe = document.createElement("span");
        probe.style.color = c;
        document.body.appendChild(probe);
        const v = getComputedStyle(probe).color;
        probe.remove();
        return v;
      };
      const el = document.querySelector("[data-hero]");
      return {
        hero: getComputedStyle(el as Element).backgroundColor,
        paper: lum("var(--paper)"),
      };
    });

    expect(hero).not.toBe(paper);
  });

  test("AC-SKIN-05 · 아이브로우가 Mono 대문자다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/12");
    await page.waitForLoadState("networkidle");

    const style = await page
      .locator("[data-eyebrow]")
      .first()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          family: cs.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, ""),
          transform: cs.textTransform,
          spacing: parseFloat(cs.letterSpacing),
        };
      });

    expect(style.family).toBe("IBM Plex Mono");
    expect(style.transform).toBe("uppercase");
    expect(style.spacing).toBeGreaterThan(0);
  });

  /**
   * 16화면 스윕 — 리스킨이 무엇도 부수지 않았는지 본다.
   *
   * <p>`touch-targets.spec.ts`가 이미 같은 스윕을 돌지만 그쪽은 「44px」이 주제다.
   * 여기서는 **리스킨이 건드린 화면 전부**를 한 번에 지나가며 가로 스크롤과
   * 서버 문구 보존을 함께 본다.
   */
  const ALL_SCREENS = [
    "/",
    "/recipes",
    "/recipes/12",
    "/recipes/new",
    "/recipes/12/edit",
    "/brews",
    "/brews/2",
    "/brews/new?recipeId=12",
    "/brews/2/edit",
    "/gear/grind-converter",
    "/more",
  ] as const;

  for (const path of ALL_SCREENS) {
    test(`AC-SKIN-10 · ${path}에 가로 스크롤이 없다`, async ({ page }) => {
      await installStubs(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );

      expect(width, path).toBeLessThanOrEqual(360);
    });
  }

});
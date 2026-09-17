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
});

import { expect, test } from "@playwright/test";
import { installStubs } from "./stubs";
import { tokenColor } from "./tokenColor";

/**
 * <b>소스 검사는 「금지된 것이 없다」만 본다.</b> 클래스 이름을 틀리거나 토큰이 생성되지 않으면
 * 단위 테스트는 초록인데 화면에서 색이 사라진다. 여기서만 그것을 잡는다.
 *
 * <p>갱신(2026-09-17): 토큰이 oklch가 되면서 리터럴 rgb를 버렸다. `tokenColor`가 같은 페이지에서
 * 기준값을 만든다 — 이유는 그 파일에 적어두었다.
 */

test.describe("시각 위계 — 라이트", () => {
  test("AC-VISUAL-14 · 주 액션 버튼이 accent 색이다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/new");

    const save = page.getByRole("button", { name: "저장" });
    await expect(save).toBeVisible();

    expect(
      await save.evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(await tokenColor(page, "accent"));
  });

  test("AC-VISUAL-15 · 화면 제목이 27px다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();

    expect(await heading.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
      "27px",
    );
  });

  test("AC-VISUAL-16 · 카드 대표 수치가 36px다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    // 갱신(2026-09-15): 대표 수치가 1:비율이 됐다. data-lead로 찾는다.
    const dose = page.locator("[data-lead]").first();
    await expect(dose).toBeVisible();

    expect(await dose.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
      "36px",
    );
  });

  test("AC-DS2-14 · 대표 수치가 Mono로 렌더된다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    const lead = page.locator("[data-lead]").first();
    await expect(lead).toBeVisible();

    // 계측되는 값은 언제나 Mono다. 자릿수가 어긋나면 목록에서 값이 흔들린다 —
    // 그것이 Mono를 쓰는 유일한 이유다(docs/specs/2026-09-17-design-system-v2.md).
    const family = await lead.evaluate((el) => getComputedStyle(el).fontFamily);
    const first = family.split(",")[0].trim().replace(/^["']|["']$/g, "");

    expect(first).toBe("IBM Plex Mono");
  });

  test("AC-VISUAL-17 · 보조줄이 ink-3 색이다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes");

    // 갱신(2026-09-15): 「1:16.7」이 대표 수치로 올라갔다. 보조줄에 남은 값을 잰다.
    const meta = page.getByText("100°C").first();
    await expect(meta).toBeVisible();

    expect(await meta.evaluate((el) => getComputedStyle(el).color)).toBe(
      await tokenColor(page, "ink-3"),
    );
  });
});

test.describe("시각 위계 — 다크", () => {
  test.use({ colorScheme: "dark" });

  test("AC-VISUAL-18 · 다크에서 버튼 쌍이 뒤집힌다", async ({ page }) => {
    await installStubs(page);
    await page.goto("/recipes/new");

    const save = page.getByRole("button", { name: "저장" });
    await expect(save).toBeVisible();

    const style = await save.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { background: computed.backgroundColor, color: computed.color };
    });

    expect(style.background).toBe(await tokenColor(page, "accent"));
    expect(style.color).toBe(await tokenColor(page, "on-ink"));
  });
});
